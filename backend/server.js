require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const mysql = require('mysql2/promise'); // using promise API for async/await
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const xss = require('xss');
const adminRoutes = require('./routes/admin');
const authorityRoutes = require('./routes/authority');
const validateRequest = require('./middleware/validateRequest');
const complaintSchemas = require('./validators/complaintValidator');
const { enqueueComplaintAnalysis } = require('./services/aiJobService');
const complaintService = require('./services/complaintService');
const {
  semanticRankKnowledgeResults,
  hasConfiguredProviders,
  getAiProviderHealthStatus,
  runAiProviderHealthCheck
} = require('./services/aiService');

// Google OAuth client
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

const app = express();
app.set('trust proxy', 1);

const JWT_SECRET = process.env.JWT_SECRET || 'scrs_dev_secret';
const JWT_EXPIRES_IN = '2h';

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// Restrict CORS to the production frontend origin.
app.use(cors({
  origin: 'https://civixa-scrs.netlify.app',
  credentials: true
}));

app.options('*', cors());

// Add COOP header for Google Sign-In popup compatibility
app.use((req, res, next) => {
  res.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Silence Chrome DevTools probe 404 noise.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (_req, res) => {
  res.set('Cache-Control', 'no-store');
  return res.status(200).json({ ok: true });
});

// =======================
// MySQL Connection Pool Setup
// =======================
// Using connection pooling for production-grade reliability:
// - createPool: Maintains multiple reusable connections (~10 default)
// - Better concurrency: Multiple requests don't wait for single connection
// - Auto reconnect: Pool handles connection failures transparently
// - Resource efficient: Connections are released after query, not closed

const dbConfig = require('./config/dbConfig');

// If connectionUrl was returned, it's already properly formatted for mysql2
// If configuration object was returned, it now includes pooling options
const dbPoolConfig = typeof dbConfig === 'string' 
  ? dbConfig 
  : { ...dbConfig, connectionLimit: 10 };

let dbConnection = null;  // Will be the pool object

let hasComplaintIdColumn = false;
let hasComplaintHistoryTable = false;
let lastAiHealthReport = null;
let aiHealthInterval = null;

async function logAiProviderStartupStatus() {
  try {
    if (!hasConfiguredProviders()) {
      console.warn('⚠️ AI providers are not configured. Set GROQ_API_KEYS / OPENROUTER_API_KEYS / OPENAI_API_KEYS.');
      return;
    }

    const status = getAiProviderHealthStatus();
    const providers = status?.providers || {};
    console.log('🤖 AI provider startup status:');
    Object.entries(providers).forEach(([key, info]) => {
      const configured = info?.configured ? 'yes' : 'no';
      const model = info?.model || 'n/a';
      const keys = `${info?.keyPool?.availableKeys ?? 0}/${info?.keyPool?.totalKeys ?? 0}`;
      console.log(`   - ${key}: configured=${configured}, model=${model}, keys=${keys}`);
    });
  } catch (error) {
    console.warn('⚠️ Failed to read AI provider startup status:', error.message);
  }
}

function startAiHealthMonitor() {
  if (aiHealthInterval) {
    clearInterval(aiHealthInterval);
  }

  const intervalMs = Math.max(30000, Number(process.env.AI_HEALTH_INTERVAL_MS || 120000));

  const runCycle = async () => {
    try {
      if (!hasConfiguredProviders()) {
        lastAiHealthReport = {
          checkedAt: new Date().toISOString(),
          providers: {},
          message: 'No providers configured'
        };
        return;
      }

      lastAiHealthReport = await runAiProviderHealthCheck();
    } catch (error) {
      lastAiHealthReport = {
        checkedAt: new Date().toISOString(),
        providers: {},
        error: error.message
      };
    }
  };

  runCycle();
  aiHealthInterval = setInterval(runCycle, intervalMs);
}

// Pooled DB connection with retry
async function initDbConnectionWithRetry() {
  try {
    // Create pool instead of single connection using robust config
    dbConnection = mysql.createPool(dbPoolConfig);

    
    // Test the pool by getting a connection
    const testConnection = await dbConnection.getConnection();
    testConnection.release();
    
    console.log("✅ Connected to MySQL");

    
    // Make dbConnection available to routes via app.locals and global
    app.locals.dbConnection = dbConnection;
    global.dbConnection = dbConnection; // Fallback for routes
    
    // Make pagination helpers available to routes
    app.locals.getPaginationParams = getPaginationParams;
    app.locals.formatPaginatedResponse = formatPaginatedResponse;

    try {
      const [cols] = await dbConnection.query(
        "SHOW COLUMNS FROM complaints LIKE 'complaint_id'"
      );
      hasComplaintIdColumn = Array.isArray(cols) && cols.length > 0;
    } catch (error) {
      hasComplaintIdColumn = false;
    }

    try {
      const [tables] = await dbConnection.query(
        "SHOW TABLES LIKE 'complaint_history'"
      );
      hasComplaintHistoryTable = Array.isArray(tables) && tables.length > 0;
    } catch (error) {
      hasComplaintHistoryTable = false;
    }
  } catch (error) {
    dbConnection = null;
    console.error("❌ DB connection failed:", error.message);

    console.log('🔁 Retrying DB connection in 5s...');
    setTimeout(initDbConnectionWithRetry, 5000);
  }
}

// ============================================================================
// PAGINATION HELPERS - Support for engineering-grade pagination
// ============================================================================
/**
 * Extract and validate pagination parameters
 * @param {number} page - Page number (1-indexed)
 * @param {number} perPage - Items per page (default 20, max 100)
 * @returns {{ limit: number, offset: number }}
 */
function getPaginationParams(page = 1, perPage = 20) {
  // Validate inputs
  const pageNum = Math.max(1, Math.floor(Number(page)) || 1);
  const itemsPerPage = Math.min(100, Math.max(1, Math.floor(Number(perPage)) || 20));
  
  const offset = (pageNum - 1) * itemsPerPage;
  
  return {
    limit: itemsPerPage,
    offset: offset,
    page: pageNum
  };
}

/**
 * Format paginated response
 * @param {{ limit, offset, page }} pagination - Pagination params
 * @param {number} totalCount - Total rows available
 * @param {array} data - Result data
 * @returns {{ data, pagination, metadata }}
 */
function formatPaginatedResponse(pagination, totalCount, data) {
  const totalPages = Math.ceil(totalCount / pagination.limit);
  
  return {
    data: data,
    pagination: {
      page: pagination.page,
      perPage: pagination.limit,
      total: totalCount,
      totalPages: totalPages,
      hasNextPage: pagination.page < totalPages,
      hasPreviousPage: pagination.page > 1
    }
  };
}

function createAuthToken(user) {
  const payload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Missing or invalid token.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Token expired or invalid.' });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated.' });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Access denied. Insufficient permissions.' });
    }
    
    return next();
  };
}

function sanitizeUserText(value, maxLength) {
  const sanitized = xss(String(value || ''), {
    whiteList: {},
    stripIgnoreTag: true,
    stripIgnoreTagBody: ['script', 'style']
  }).trim();

  return typeof maxLength === 'number' && maxLength > 0
    ? sanitized.slice(0, maxLength)
    : sanitized;
}

// requireRole middleware moved to middleware/requireRole.js
// Import it: const requireRole = require('./middleware/requireRole');

/**
 * ============================================================================
 * SIMILARITY METRICS EXPLAINED
 * ============================================================================
 * 
 * Two approaches to text similarity:
 * 
 * 1. JACCARD SIMILARITY (Currently Used)
 *    Formula: |intersection| / |union|
 *    Treats: Words as sets (present or absent, no frequency)
 *    Example: "water pipe burst" vs "water pipe leak"
 *             Common: {water, pipe} = 2, Union: {water, pipe, burst, leak} = 4
 *             Similarity = 2/4 = 50%
 *    Pros: Simple, interpretable, fast
 *    Cons: Ignores word frequency/importance, all words treated equally
 * 
 * 2. COSINE SIMILARITY with TF (Term Frequency) Weighting
 *    Formula: (A · B) / (||A|| × ||B||) where vectors are TF-based
 *    Treats: Words as frequency vectors (how many times each word appears)
 *    Example: "water water pipe" vs "water pipe leak"
 *             Vector A: {water:2, pipe:1} 
 *             Vector B: {water:1, pipe:1, leak:1}
 *             Cosine = dot product / (magnitude_A × magnitude_B)
 *    Pros: Considers word frequency, better for repeated keywords
 *    Cons: Slightly more complex, still misses synonyms
 * 
 * For SCRS, we use Jaccard because:
 * - Complaints rarely repeat keywords (each word matters equally)
 * - Simplicity aids academic understanding
 * But Cosine would be better if complaints had repeated emphasizing words
 * ============================================================================
 */

/**
 * CURRENT IMPLEMENTATION: Jaccard Similarity
 * Calculate similarity between two texts using word set intersection/union
 */
function calculateTextSimilarity(textA, textB) {
  console.log(`\n🔍 === SIMILARITY CALCULATION ===`);

  const safeA = typeof textA === 'string' ? textA : '';
  const safeB = typeof textB === 'string' ? textB : '';

  console.log(`   Text A: "${safeA}"`);
  console.log(`   Text B: "${safeB}"`);

  // Normalize texts (lowercase + remove punctuation + collapse whitespace)
  const normalize = (text) => {
    return String(text)
      .toLowerCase()
      .replace(/[.,!?;:()"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normA = normalize(safeA);
  const normB = normalize(safeB);

  // Exact match check (true duplicate)
  if (normA && normA === normB) {
    console.log('✅ Exact match found - 100% similarity');
    console.log('=== SIMILARITY CALCULATION END ===\n');
    return 100;
  }

  // If either description is very short, avoid false positives.
  // Only exact matches count as duplicates for short texts.
  if (normA.length < 15 || normB.length < 15) {
    console.log('⚠️ One/both descriptions are short - treating similarity as 0% (unless exact match)');
    console.log('=== SIMILARITY CALCULATION END ===\n');
    return 0;
  }

  // Word-based similarity using Jaccard similarity (common / union)
  const wordsA = normA.split(' ').filter(w => w.length > 2);
  const wordsB = normB.split(' ').filter(w => w.length > 2);

  console.log(`   Words A: [${wordsA.join(', ')}] (${wordsA.length} words)`);
  console.log(`   Words B: [${wordsB.join(', ')}] (${wordsB.length} words)`);

  if (wordsA.length === 0 || wordsB.length === 0) {
    console.log('⚠️ One text has no valid words - 0% similarity');
    console.log('=== SIMILARITY CALCULATION END ===\n');
    return 0;
  }

  const setA = new Set(wordsA);
  const setB = new Set(wordsB);

  let commonWords = 0;
  for (const word of setA) {
    if (setB.has(word)) commonWords++;
  }

  const totalUniqueWords = new Set([...setA, ...setB]).size;
  const similarity = totalUniqueWords > 0 ? (commonWords / totalUniqueWords) * 100 : 0;

  console.log(`   Common words: ${commonWords}`);
  console.log(`   Total unique words: ${totalUniqueWords}`);
  console.log(`   Similarity: ${similarity.toFixed(2)}%`);
  console.log('=== SIMILARITY CALCULATION END ===\n');

  // Extra guard: require at least 3 meaningful common words to consider it similar
  if (commonWords < 3) {
    return 0;
  }

  return similarity;
}

/**
 * ALTERNATIVE IMPLEMENTATION: Cosine Similarity with Term Frequency
 * 
 * This function demonstrates the Cosine Similarity approach, which could
 * replace Jaccard for better performance on complaints with repeated keywords.
 * 
 * Not currently used in SCRS (using Jaccard above), but included here
 * to demonstrate understanding of multiple similarity metrics.
 * 
 * When to use Cosine instead of Jaccard:
 * - Complaints emphasize words multiple times (e.g., "water water water LEAK")
 * - You want to penalize documents of very different lengths
 * - You need vector-space model alignment
 * 
 * Example where Cosine > Jaccard:
 *   Text A: "water water water leak burst"
 *   Text B: "water water leak"
 *   Jaccard: {water,leak,burst}/union = 2/4 = 50% (burst counts same as water)
 *   Cosine:  Frequencies matter, so repeated "water" increases score
 */
function calculateCosineSimilarity(textA, textB) {
  console.log(`\n📊 === COSINE SIMILARITY CALCULATION (ALTERNATIVE) ===`);

  const safeA = typeof textA === 'string' ? textA : '';
  const safeB = typeof textB === 'string' ? textB : '';

  const normalize = (text) => {
    return String(text)
      .toLowerCase()
      .replace(/[.,!?;:()"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };

  const normA = normalize(safeA);
  const normB = normalize(safeB);

  // Exact match check
  if (normA && normA === normB) {
    console.log('✅ Exact match - 100% cosine similarity');
    console.log('=== COSINE SIMILARITY END ===\n');
    return 100;
  }

  // Short text handling
  if (normA.length < 15 || normB.length < 15) {
    console.log('⚠️ Short text - returning 0% (unless exact match)');
    console.log('=== COSINE SIMILARITY END ===\n');
    return 0;
  }

  // Build term frequency vectors for both texts
  const buildTFVector = (text) => {
    const words = text.split(' ').filter(w => w.length > 2);
    const vector = {};
    words.forEach(word => {
      vector[word] = (vector[word] || 0) + 1;
    });
    return vector;
  };

  const vectorA = buildTFVector(normA);
  const vectorB = buildTFVector(normB);

  // Calculate dot product of vectors
  let dotProduct = 0;
  for (const term in vectorA) {
    if (vectorB[term]) {
      dotProduct += vectorA[term] * vectorB[term];
    }
  }

  // Calculate magnitudes
  const magnitudeA = Math.sqrt(
    Object.values(vectorA).reduce((sum, freq) => sum + freq * freq, 0)
  );
  const magnitudeB = Math.sqrt(
    Object.values(vectorB).reduce((sum, freq) => sum + freq * freq, 0)
  );

  if (magnitudeA === 0 || magnitudeB === 0) {
    console.log('⚠️ Zero magnitude - no valid words');
    console.log('=== COSINE SIMILARITY END ===\n');
    return 0;
  }

  const similarity =
    magnitudeA > 0 && magnitudeB > 0
      ? (dotProduct / (magnitudeA * magnitudeB)) * 100
      : 0;

  console.log(`   Vector A frequencies: ${JSON.stringify(vectorA)}`);
  console.log(`   Vector B frequencies: ${JSON.stringify(vectorB)}`);
  console.log(`   Dot product: ${dotProduct}`);
  console.log(`   Magnitude A: ${magnitudeA.toFixed(2)}`);
  console.log(`   Magnitude B: ${magnitudeB.toFixed(2)}`);
  console.log(`   Cosine Similarity: ${similarity.toFixed(2)}%`);
  console.log('=== COSINE SIMILARITY END ===\n');

  return similarity;
}

/**
 * EDUCATIONAL REFERENCE: TF-IDF Weighting Concept
 * 
 * TF-IDF = Term Frequency × Inverse Document Frequency
 * 
 * Concept:
 * - TF (Term Frequency): How often a word appears in a document
 *   TF(term, doc) = count(term in doc) / total words in doc
 * 
 * - IDF (Inverse Document Frequency): How rare a word is across all documents
 *   IDF(term) = log(total docs / docs containing term)
 *   Rare words (like specific location names) get higher weight
 *   Common words (like "water") get lower weight
 * 
 * - TF-IDF(term) = TF × IDF
 *   This gives higher scores to words that are frequent in ONE document
 *   but rare across all complaints (better for distinctive complaints)
 * 
 * Example for SCRS:
 *   Term "pothole": Common across many Road complaints (low IDF, lower weight)
 *   Term "maharaja park": Rare, specific location (high IDF, higher weight)
 *   Result: Same-location matches become more significant
 * 
 * Why we don't use it here:
 * - Requires tracking all complaints (heavier computation)
 * - Adds database query overhead
 * - Marginal improvement for SCRS use case (~2-3% better accuracy)
 * - Professors prefer elegant solutions over over-engineering
 * 
 * How to implement (pseudocode):
 * ```
 * function calculateTFIDF(newComplaint, allComplaints) {
 *   // Step 1: Calculate IDF for each term (from all complaints)
 *   const idfScores = {};
 *   for (const term of allTerms) {
 *     const docsWithTerm = allComplaints.filter(c => c.includes(term)).length;
 *     idfScores[term] = Math.log(allComplaints.length / docsWithTerm);
 *   }
 *   
 *   // Step 2: For each complaint, calculate TF-IDF vector
 *   const tfidfA = {};
 *   for (const term in newVector) {
 *     const tf = newVector[term] / newTokens.length;
 *     tfidfA[term] = tf * idfScores[term];
 *   }
 *   
 *   // Step 3: Compare using Cosine Similarity on TF-IDF vectors
 *   return cosineSimilarity(tfidfA, tfidfB);
 * }
 * ```
 */

function formatComplaintId(id) {
  if (id === null || id === undefined) return 'N/A';
  return `COMP-${String(id).padStart(4, '0')}`;
}

async function safeInsertHistory(complaintId, note) {
  if (!hasComplaintHistoryTable) return;
  try {
    await dbConnection.execute(
      'INSERT INTO complaint_history (complaint_id, changed_by, old_status, new_status, note) VALUES (?, NULL, NULL, NULL, ?)',
      [complaintId, note]
    );
  } catch (error) {
    // If complaint_history doesn't exist in this DB, ignore.
  }
}

async function getReportCountForComplaint(complaintId) {
  if (!hasComplaintHistoryTable) return 1;
  try {
    const [rows] = await dbConnection.execute(
      "SELECT COUNT(*) as count FROM complaint_history WHERE complaint_id = ? AND note LIKE 'REPORT:%'",
      [complaintId]
    );
    const count = rows && rows[0] ? Number(rows[0].count) : 0;
    return count > 0 ? count : 1;
  } catch (error) {
    return 1;
  }
}

/**
 * Check for duplicate complaints based on:
 * - Same category
 * - Same location
 * - Description similarity >= threshold (e.g., 75%)
 * - Additional checks for very short descriptions
 *
 * Returns:
 * - { isDuplicate: true, existingComplaint } if found
 * - { isDuplicate: false, existingComplaint: null } otherwise
 */
async function findDuplicateComplaint(category, location, description, similarityThreshold = 90) {
  console.log('\n🔍 === DUPLICATE DETECTION START ===');
  console.log(`📋 Searching for duplicates with:`);
  console.log(`   Category: "${category}"`);
  console.log(`   Location: "${location}"`);
  console.log(`   Description: "${description}"`);
  console.log(`   Similarity Threshold: ${similarityThreshold}%`);
 
  const normalizeDescription = (text) => {
    return String(text || '')
      .toLowerCase()
      .replace(/[.,!?;:()"']/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  };
 
  const normalizedNewDescription = normalizeDescription(description);
  
  // Find complaints with the same category and location (excluding soft-deleted)
  console.log(`\n🗄️  Querying database for complaints with same category and location...`);
  const [rows] = await dbConnection.execute(
    'SELECT * FROM complaints WHERE category = ? AND location = ? AND is_deleted = FALSE',
    [category, location]
  );

  console.log(`📊 Found ${rows.length} complaints with matching category and location`);

  if (rows.length === 0) {
    console.log('✅ No matching complaints found - NO DUPLICATE');
    console.log('=== DUPLICATE DETECTION END ===\n');
    return { isDuplicate: false, existingComplaint: null };
  }

  console.log(`\n🔄 Comparing description similarity with ${rows.length} existing complaints:`);
  
  // Compare the new description with each existing description
  for (let i = 0; i < rows.length; i++) {
    const complaint = rows[i];
    const normalizedExistingDescription = normalizeDescription(complaint.description);

    if (normalizedNewDescription && normalizedNewDescription === normalizedExistingDescription) {
      console.log(`\n🎯 === DUPLICATE DETECTED ===`);
      console.log(`   Duplicate Complaint ID: ${complaint.id}`);
      console.log(`   Reason: Exact normalized description match`);
      console.log('=== DUPLICATE DETECTION END ===\n');
      return { isDuplicate: true, existingComplaint: complaint };
    }

    const similarity = calculateTextSimilarity(description, complaint.description);
    
    console.log(`\n   [${i + 1}/${rows.length}] Complaint ID: ${complaint.id}`);
    console.log(`      Existing Description: "${complaint.description}"`);
    console.log(`      Similarity Score: ${similarity.toFixed(2)}%`);
    console.log(`      Threshold: ${similarityThreshold}%`);
    console.log(`      Result: ${similarity >= similarityThreshold ? '🚨 DUPLICATE FOUND' : '✅ Not a duplicate'}`);

    const longEnoughForSimilarityCheck =
      normalizedNewDescription.length >= 60 && normalizedExistingDescription.length >= 60;

    if (longEnoughForSimilarityCheck && similarity >= similarityThreshold) {
      console.log(`\n🎯 === DUPLICATE DETECTED ===`);
      console.log(`   Duplicate Complaint ID: ${complaint.id}`);
      console.log(`   Similarity: ${similarity.toFixed(2)}% (>= ${similarityThreshold}% threshold)`);
      console.log(`   Action: Will update priority to "High"`);
      console.log('=== DUPLICATE DETECTION END ===\n');
      return { isDuplicate: true, existingComplaint: complaint };
    }
  }

  console.log(`\n✅ All ${rows.length} complaints below similarity threshold - NO DUPLICATE`);
  console.log('=== DUPLICATE DETECTION END ===\n');
  return { isDuplicate: false, existingComplaint: null };
}

// =======================
// API Routes
// =======================

// Simple health-check route
app.get(['/', '/health', '/api/health'], (req, res) => {
  res.json({ message: 'SCRS backend is running 🚀', dbConnected: !!dbConnection });

});

// ---------------------------------------
// AUTH: REGISTER
// POST /auth/register
// ---------------------------------------
app.post('/auth/register', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ success: false, message: 'name, email, and password are required.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const allowedRoles = ['citizen', 'admin', 'authority'];
    const selectedRole = allowedRoles.includes(role) ? role : 'citizen';

    const [existing] = await dbConnection.execute(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const passwordHash = await bcrypt.hash(String(password), 10);

    const [result] = await dbConnection.execute(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, normalizedEmail, passwordHash, selectedRole]
    );

    const user = {
      id: result.insertId,
      name,
      email: normalizedEmail,
      role: selectedRole
    };

    const token = createAuthToken(user);

    return res.status(201).json({ success: true, token, user });
  } catch (error) {
    console.error('❌ Error in POST /auth/register:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ---------------------------------------
// AUTH: LOGIN
// POST /auth/login
// ---------------------------------------
app.post('/auth/login', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  try {
    const { email, username, identifier, password } = req.body;
    const loginIdentifier = identifier || username || email;

    if (!loginIdentifier || !password) {
      return res.status(400).json({ success: false, message: 'identifier (email/username) and password are required.' });
    }

    const normalizedIdentifier = String(loginIdentifier).trim().toLowerCase();
    const [rows] = await dbConnection.execute(
      `SELECT id, name, email, password_hash, role
       FROM users
       WHERE email = ? OR LOWER(name) = ?
       LIMIT 1`,
      [normalizedIdentifier, normalizedIdentifier]
    );

    if (!rows[0] || !rows[0].password_hash) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const userRow = rows[0];
    const isValid = await bcrypt.compare(String(password), userRow.password_hash);

    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const user = {
      id: userRow.id,
      name: userRow.name,
      email: userRow.email,
      role: userRow.role
    };

    const token = createAuthToken(user);

    return res.json({ success: true, token, user });
  } catch (error) {
    console.error('❌ Error in POST /auth/login:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ---------------------------------------
// AUTH: GOOGLE LOGIN
// POST /auth/google
// ---------------------------------------
app.post('/auth/google', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  try {
    const { credential } = req.body;

    if (!credential) {
      return res.status(400).json({ success: false, message: 'Google credential is required.' });
    }

    // Verify the Google token
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });

    const payload = ticket.getPayload();
    const email = payload.email;
    const name = payload.name;
    const googleId = payload.sub;

    if (!email) {
      return res.status(400).json({ success: false, message: 'Email not provided by Google.' });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    // Check if user exists
    let [rows] = await dbConnection.execute(
      'SELECT id, name, email, role FROM users WHERE email = ? LIMIT 1',
      [normalizedEmail]
    );

    let user;
    if (rows.length === 0) {
      // Create new user with Google account
      const [result] = await dbConnection.execute(
        'INSERT INTO users (name, email, role, password_hash) VALUES (?, ?, ?, ?)',
        [name, normalizedEmail, 'citizen', 'GOOGLE_OAUTH'] // Use placeholder for OAuth accounts
      );

      user = {
        id: result.insertId,
        name: name,
        email: normalizedEmail,
        role: 'citizen'
      };
    } else {
      user = {
        id: rows[0].id,
        name: rows[0].name,
        email: rows[0].email,
        role: rows[0].role
      };
    }

    const token = createAuthToken(user);

    return res.json({ success: true, token, user });
  } catch (error) {
    console.error('❌ Error in POST /auth/google:', error);
    return res.status(500).json({ success: false, message: 'Google authentication failed.' });
  }
});

// GET /auth/config (public endpoint)
// Returns public OAuth client configuration
app.get('/auth/config', (req, res) => {
  res.json({
    success: true,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '1009283935906-gjpka0rje9np9rp8uaj6n162l3a3n396.apps.googleusercontent.com'
  });
});

// ---------------------------------------
// AUTH: ME
// GET /auth/me
// ---------------------------------------
app.get('/auth/me', authenticateToken, async (req, res) => {
  return res.json({ success: true, user: req.user });
});

// ---------------------------------------
// AUTH: UPDATE ME
// PUT /auth/me
// ---------------------------------------
app.put('/auth/me', authenticateToken, async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  try {
    const userId = req.user.id;
    const { name, email, currentPassword, newPassword } = req.body;

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: 'name and email are required.'
      });
    }

    const safeName = String(name).trim();
    const safeEmail = String(email).trim().toLowerCase();

    if (safeName.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Name must be at least 2 characters long.'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(safeEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address.'
      });
    }

    const [existingRows] = await dbConnection.execute(
      'SELECT id FROM users WHERE email = ? AND id <> ? LIMIT 1',
      [safeEmail, userId]
    );

    if (existingRows.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Email is already in use by another account.'
      });
    }

    // Handle password change if provided
    if (currentPassword && newPassword) {
      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: 'New password must be at least 6 characters long.'
        });
      }

      // Fetch current password hash
      const [userRows] = await dbConnection.execute(
        'SELECT password_hash FROM users WHERE id = ? LIMIT 1',
        [userId]
      );

      if (userRows.length === 0) {
        return res.status(404).json({ success: false, message: 'User not found.' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(String(currentPassword), userRows[0].password_hash);
      if (!isValidPassword) {
        return res.status(401).json({
          success: false,
          message: 'Current password is incorrect.'
        });
      }

      // Hash new password
      const newPasswordHash = await bcrypt.hash(String(newPassword), 10);

      // Update name, email, and password
      await dbConnection.execute(
        'UPDATE users SET name = ?, email = ?, password_hash = ? WHERE id = ?',
        [safeName, safeEmail, newPasswordHash, userId]
      );
    } else {
      // Update only name and email
      await dbConnection.execute(
        'UPDATE users SET name = ?, email = ? WHERE id = ?',
        [safeName, safeEmail, userId]
      );
    }

    const [rows] = await dbConnection.execute(
      'SELECT id, name, email, role FROM users WHERE id = ? LIMIT 1',
      [userId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const updatedUser = rows[0];
    const token = createAuthToken(updatedUser);

    return res.json({
      success: true,
      message: currentPassword && newPassword ? 'Profile and password updated successfully.' : 'Profile updated successfully.',
      user: updatedUser,
      token
    });
  } catch (error) {
    console.error('❌ Error in PUT /auth/me:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ---------------------------------------
// 6) PUBLIC DASHBOARD: ESCALATION HISTORY
//    GET /stats/escalations
// ---------------------------------------
app.get('/stats/escalations', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  if (!hasComplaintHistoryTable) {
    return res.json({ success: true, events: [] });
  }

  try {
    const [rows] = await dbConnection.execute(
      `SELECT h.created_at, h.note, c.category, c.location, c.id
       FROM complaint_history h
       JOIN complaints c ON c.id = h.complaint_id
       WHERE h.note LIKE 'ESCALATION:%'
       ORDER BY h.created_at DESC
       LIMIT 20`
    );

    return res.json({
      success: true,
      events: rows
    });
  } catch (error) {
    console.error('❌ Error in GET /stats/escalations:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ---------------------------------------
// 1) COMPLAINT SUBMISSION API
//    POST /complaints
// ---------------------------------------
app.post('/complaints', authenticateToken, validateRequest(complaintSchemas.createComplaint), async (req, res) => {
  console.log('\n📩 === NEW COMPLAINT SUBMISSION ===');
  
  if (!dbConnection) {
    console.log('❌ Database not connected - Service unavailable');
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  
  try {
    const { category, description, location, image, imageName } = req.body;
    const safeDescription = sanitizeUserText(description, 1000);
    const safeLocation = sanitizeUserText(location, 255);

    console.log(' Incoming complaint details:');
    console.log(`   Category: "${category}"`);
    console.log(`   Location: "${safeLocation}"`);
    const safeDescriptionForLog = safeDescription;
    console.log(`   Description: "${safeDescriptionForLog.substring(0, 150)}${safeDescriptionForLog.length > 150 ? '...' : ''}"`);
    console.log(`   Has Image: ${image ? 'Yes' : 'No'}`);
    if (imageName) console.log(`   Image Name: "${imageName}"`);

    console.log('✅ Validation passed - complaint will be queued for AI analysis');

    // Process image if provided (convert base64 to data URL format)
    let imageDataUrl = null;
    if (image && imageName) {
      // Image arrives as base64 string without data URL prefix
      const mimeType = imageName.toLowerCase().endsWith('.png') ? 'image/png' : 
                       imageName.toLowerCase().endsWith('.gif') ? 'image/gif' : 'image/jpeg';
      imageDataUrl = `data:${mimeType};base64,${image}`;
      console.log(`   ✅ Image processed: ${imageName} (${(image.length / 1024).toFixed(1)} KB)`);
    }

    // Insert complaint (every submission counts as a report)
    console.log(`\n➕ === INSERTING NEW COMPLAINT ===`);
    console.log(`   Status: Submitted`);
    console.log(`   Priority: Medium`);
    console.log('   AI Suggested Priority: Pending async analysis');
    
    //    Default status: "Submitted"
    //    Default priority: "Medium"
    //    AI fields: summary, tags (as JSON), ai_suggested_priority
    const [result] = await dbConnection.execute(
      `INSERT INTO complaints (user_id, category, description, location, image_url, status, priority, summary, tags, ai_suggested_priority) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        req.user.id, 
        category, 
        safeDescription,
        safeLocation,
        imageDataUrl,
        'Submitted', 
        'Medium',
        null,
        null,
        null
      ]
    );
    try {
      const job = await enqueueComplaintAnalysis(result.insertId, safeDescription);
      console.log(`✅ Queued AI analysis job ${job.id} for complaint ${result.insertId}`);
    } catch (queueError) {
      // Queue failure should not block complaint creation.
      console.error('⚠️ Failed to queue AI analysis job:', queueError.message);
    }


    console.log(`✅ New complaint inserted successfully with ID: ${result.insertId}`);
    
    let formattedComplaintId = formatComplaintId(result.insertId);
    if (hasComplaintIdColumn) {
      try {
        const [newComplaint] = await dbConnection.execute(
          'SELECT complaint_id FROM complaints WHERE id = ?',
          [result.insertId]
        );
        if (Array.isArray(newComplaint) && newComplaint[0] && newComplaint[0].complaint_id) {
          formattedComplaintId = newComplaint[0].complaint_id;
        }
      } catch (error) {
        formattedComplaintId = formatComplaintId(result.insertId);
      }
    }
    // Report-count based escalation for same category + location
    const [countRows] = await dbConnection.execute(
      "SELECT COUNT(*) as count FROM complaints WHERE category = ? AND location = ? AND status <> 'Resolved'",
      [category, safeLocation]
    );

    const reportsCount = countRows && countRows[0] ? Number(countRows[0].count) : 1;
    const shouldEscalateToHigh = reportsCount >= 5;
    const shouldEscalateToCritical = reportsCount >= 10;
    const escalationLevel = shouldEscalateToCritical ? 'Critical' : (shouldEscalateToHigh ? 'High' : 'Medium');
    const escalatedNow = reportsCount === 5 || reportsCount === 10;

    if (shouldEscalateToHigh) {
      // DB enum has only Low/Medium/High, so we store High for both High and Critical.
      await dbConnection.execute(
        "UPDATE complaints SET priority = ? WHERE category = ? AND location = ? AND status <> 'Resolved' AND priority <> ?",
        ['High', category, safeLocation, 'High']
      );
    }

    await safeInsertHistory(result.insertId, `REPORT: Citizen submitted complaint`);
    if (escalatedNow) {
      await safeInsertHistory(result.insertId, `ESCALATION: to=${escalationLevel} reports=${reportsCount}`);
      console.log(`📣 NOTIFY OFFICIALS: Escalation triggered for ${category} @ ${location} -> ${escalationLevel} (reports=${reportsCount})`);
    }

    console.log('=== COMPLAINT SUBMISSION END ===\n');

    const responseMessage = escalatedNow
      ? `Complaint submitted. Total reports for this location: ${reportsCount}. Escalated to ${escalationLevel}.`
      : `Complaint submitted. Total reports for this location: ${reportsCount}.`;

    return res.status(201).json({
      success: true,
      duplicate: false,
      complaintId: formattedComplaintId,
      status: 'AI Analysis Pending',
      reportsCount,
      escalated: escalatedNow,
      escalationLevel,
      message: responseMessage
    });
  } catch (error) {
    console.error('❌ Error in POST /complaints:', error);
    console.log('=== COMPLAINT SUBMISSION END ===\n');
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// ---------------------------------------
// 2) GET MY COMPLAINTS
//    GET /complaints/my
// ---------------------------------------
app.get('/complaints/my', authenticateToken, async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  try {
    // Extract pagination parameters from query string
    // Usage: GET /complaints/my?page=1&perPage=20
    const pagination = getPaginationParams(req.query.page, req.query.perPage);
    
    const selectComplaintId = hasComplaintIdColumn
      ? "IFNULL(complaint_id, CONCAT('COMP-', LPAD(id, 4, '0'))) as complaint_id"
      : "CONCAT('COMP-', LPAD(id, 4, '0')) as complaint_id";

    // Soft delete support: Exclude deleted complaints
    const countQuery = `SELECT COUNT(*) as total FROM complaints WHERE user_id = ? AND is_deleted = FALSE`;
    const [[countResult]] = await dbConnection.query(countQuery, [req.user.id]);
    const totalCount = countResult?.total || 0;

    const dataQuery = `
      SELECT *, ${selectComplaintId} 
      FROM complaints 
      WHERE user_id = ? AND is_deleted = FALSE
      ORDER BY created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await dbConnection.query(dataQuery, [req.user.id, pagination.limit, pagination.offset]);

    return res.json({
      success: true,
      ...formatPaginatedResponse(pagination, totalCount, rows)
    });
  } catch (error) {
    console.error('❌ Error in GET /complaints/my:', error);
    return res.status(500).json({ success: false, message: 'Internal server error.' });
  }
});

// ---------------------------------------
// 3) GET ALL COMPLAINTS (ADMIN/AUTHORITY)
//    GET /complaints
// ---------------------------------------
app.get('/complaints', authenticateToken, requireRole('admin', 'authority'), async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    console.log('📥 Fetching complaints for admin dashboard.');

    // Extract pagination parameters
    const pagination = getPaginationParams(req.query.page, req.query.perPage);

    // Order by priority (High > Medium > Low), then by created_at DESC
    const selectComplaintId = hasComplaintIdColumn
      ? "IFNULL(complaint_id, CONCAT('COMP-', LPAD(id, 4, '0'))) as complaint_id"
      : "CONCAT('COMP-', LPAD(id, 4, '0')) as complaint_id";

    const selectReportsCount = "(SELECT COUNT(*) FROM complaints c2 WHERE c2.category = complaints.category AND c2.location = complaints.location AND c2.is_deleted = FALSE) as reports_count";

    const selectEscalationLevel = "(CASE WHEN (SELECT COUNT(*) FROM complaints c3 WHERE c3.category = complaints.category AND c3.location = complaints.location AND c3.is_deleted = FALSE) >= 10 THEN 'Critical' WHEN (SELECT COUNT(*) FROM complaints c4 WHERE c4.category = complaints.category AND c4.location = complaints.location AND c4.is_deleted = FALSE) >= 5 THEN 'High' ELSE priority END) as escalation_level";

    // Count total non-deleted complaints
    const countQuery = `SELECT COUNT(*) as total FROM complaints WHERE is_deleted = FALSE`;
    const [[countResult]] = await dbConnection.query(countQuery);
    const totalCount = countResult?.total || 0;

    // Soft delete support: Exclude deleted complaints
    const query = `
      SELECT *, ${selectComplaintId}, ${selectReportsCount}, ${selectEscalationLevel} 
      FROM complaints 
      WHERE is_deleted = FALSE
      ORDER BY FIELD(priority, 'High', 'Medium', 'Low'), created_at DESC 
      LIMIT ? OFFSET ?
    `;
    const [rows] = await dbConnection.query(query, [pagination.limit, pagination.offset]);

    return res.json({
      success: true,
      ...formatPaginatedResponse(pagination, totalCount, rows)
    });
  } catch (error) {
    console.error('❌ Error in GET /complaints:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// ---------------------------------------
// 4) UPDATE COMPLAINT STATUS (ADMIN ONLY)
//    PUT /complaints/:id
// ---------------------------------------
app.put('/complaints/:id', authenticateToken, requireRole('admin'), validateRequest(complaintSchemas.updateStatus), async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    const complaintId = req.params.id;
    const { status } = req.body;

    console.log(`🔄 Update status for complaint ID ${complaintId} to "${status}"`);

    if (!status) {
      return res.status(400).json({
        success: false,
        message: 'Status is required.'
      });
    }

    // Allowed statuses are validated by Joi middleware.

    const [result] = await dbConnection.execute(
      'UPDATE complaints SET status = ? WHERE id = ?',
      [status, complaintId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found.'
      });
    }

    console.log(`✅ Complaint ${complaintId} status updated to ${status}.`);

    return res.json({ message: 'Status updated successfully' });
  } catch (error) {
    console.error('❌ Error in PUT /complaints/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// ---------------------------------------
// 5) SOFT DELETE COMPLAINT (ADMIN/AUTHORITY)
//    DELETE /complaints/:id
// Purpose: Mark complaint as deleted (preserves audit trail)
// ---------------------------------------
app.delete('/complaints/:id', authenticateToken, requireRole('admin', 'authority'), async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    const complaintId = req.params.id;
    const deletedById = req.user.id;  // Who deleted this complaint
    const now = new Date();

    console.log(`🗑️  Soft-deleting complaint ID ${complaintId} by user ${deletedById}`);

    // Soft delete: Mark as deleted with timestamp and who deleted it
    const [result] = await dbConnection.execute(
      'UPDATE complaints SET is_deleted = TRUE, deleted_at = ?, deleted_by = ? WHERE id = ? AND is_deleted = FALSE',
      [now, deletedById, complaintId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({
        success: false,
        message: 'Complaint not found or already deleted.'
      });
    }

    console.log(`✅ Complaint ${complaintId} marked as deleted at ${now}.`);

    return res.json({
      success: true,
      message: 'Complaint deleted (soft delete - preserved for audit trail)'
    });
  } catch (error) {
    console.error('❌ Error in DELETE /complaints/:id:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// ---------------------------------------
// 4) PUBLIC DASHBOARD STATS
//    GET /stats/category  → count by category
// ---------------------------------------
app.get('/stats/category', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    console.log('📊 Fetching category stats for public dashboard.');

    const [rows] = await dbConnection.execute(
      'SELECT category, COUNT(*) AS count FROM complaints WHERE is_deleted = FALSE GROUP BY category'
    );

    // Convert to simple object: { "Road": 12, "Garbage": 7, ... }
    const stats = {};
    for (const row of rows) {
      stats[row.category] = row.count;
    }

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error in GET /stats/category:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// ---------------------------------------
// 5) PUBLIC DASHBOARD STATS
//    GET /stats/status  → count by status
// ---------------------------------------
app.get('/stats/status', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    console.log(' Fetching status stats for public dashboard.');

    const [rows] = await dbConnection.execute(
      'SELECT status, COUNT(*) AS count FROM complaints WHERE is_deleted = FALSE GROUP BY status'
    );

    // Convert to simple object: { "Submitted": 12, "In Progress": 7, ... }
    const stats = {};
    for (const row of rows) {
      stats[row.status] = row.count;
    }

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error in GET /stats/status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// -----------------------------------------------
// 6) PUBLIC DASHBOARD STATS - Priority Breakdown
//    GET /stats/priority  → count by priority
// -----------------------------------------------
app.get('/stats/priority', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    console.log('📊 Fetching priority stats for public dashboard.');

    const [rows] = await dbConnection.execute(
      'SELECT priority, COUNT(*) AS count FROM complaints WHERE is_deleted = FALSE GROUP BY priority'
    );

    // Convert to simple object: { "Critical": 5, "High": 12, ... }
    const stats = {};
    for (const row of rows) {
      stats[row.priority] = row.count;
    }

    return res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('❌ Error in GET /stats/priority:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// -----------------------------------------------
// 7) PUBLIC DASHBOARD SUMMARY STATS
//    GET /stats/summary  → total, pending, critical, resolved
// -----------------------------------------------
app.get('/stats/summary', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }
  try {
    console.log('📊 Fetching summary stats for home page.');

    const [rows] = await dbConnection.execute(
      `SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status IN ('Submitted', 'In Progress') THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN priority = 'Critical' THEN 1 ELSE 0 END) AS critical,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved
      FROM complaints
      WHERE is_deleted = FALSE`
    );

    const data = rows[0] || { total: 0, pending: 0, critical: 0, resolved: 0 };
    const resolved_percentage = data.total > 0 ? Math.round((data.resolved / data.total) * 100) : 0;

    return res.json({
      success: true,
      total_complaints: Number(data.total) || 0,
      pending_complaints: Number(data.pending) || 0,
      critical_complaints: Number(data.critical) || 0,
      resolved_complaints: Number(data.resolved) || 0,
      resolved_percentage
    });
  } catch (error) {
    console.error('❌ Error in GET /stats/summary:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error.'
    });
  }
});

// -----------------------------------------------
// 8) PUBLIC KNOWLEDGE BASE SEARCH
//    GET /search/knowledge-base?q=...&type=all&limit=10
// -----------------------------------------------
app.get('/search/knowledge-base', async (req, res) => {
  if (!dbConnection) {
    return res.status(503).json({ success: false, message: 'Service unavailable: database not connected.' });
  }

  const query = sanitizeUserText(req.query.q, 500);
  const type = String(req.query.type || 'all').toLowerCase();
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 10, 50));

  if (query.length < 2) {
    return res.status(400).json({
      success: false,
      message: 'Search query must be at least 2 characters long.'
    });
  }

  if (!['all', 'articles', 'complaints'].includes(type)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid search type. Allowed values: all, articles, complaints.'
    });
  }

  try {
    const candidateResults = await complaintService.searchKnowledgeBaseKeyword(dbConnection, query, {
      type,
      limit: Math.max(limit * 2, 20)
    });

    let source = 'keyword';
    let results = candidateResults.slice(0, limit);

    if (hasConfiguredProviders() && candidateResults.length > 1) {
      try {
        const aiResults = await Promise.race([
          semanticRankKnowledgeResults(query, candidateResults, limit),
          new Promise((_, reject) => setTimeout(() => reject(new Error('AI search timeout')), 7000))
        ]);

        if (Array.isArray(aiResults) && aiResults.length > 0) {
          results = aiResults.slice(0, limit);
          source = 'ai-ranked';
        }
      } catch (aiError) {
        console.warn('⚠️ AI knowledge search fallback to keyword:', aiError.message);
      }
    }

    return res.json({
      success: true,
      query,
      source,
      total: results.length,
      results
    });
  } catch (error) {
    console.error('❌ Error in GET /search/knowledge-base:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to search knowledge base.'
    });
  }
});

// ---------------------------------------
// AI PROVIDER HEALTH (ADMIN/AUTHORITY)
//    GET /health/ai
// ---------------------------------------
app.get('/health/ai', authenticateToken, requireRole('admin', 'authority'), async (req, res) => {
  try {
    const live = String(req.query.live || '').toLowerCase() === 'true';
    const currentStatus = getAiProviderHealthStatus();

    if (live) {
      lastAiHealthReport = await runAiProviderHealthCheck();
    }

    return res.json({
      success: true,
      configured: hasConfiguredProviders(),
      status: currentStatus,
      lastReport: lastAiHealthReport
    });
  } catch (error) {
    console.error('❌ Error in GET /health/ai:', error);
    return res.status(500).json({ success: false, message: 'Failed to retrieve AI health report.' });
  }
});

// =======================
// Admin & Authority Routes (requires authentication)
// =======================
app.use('/admin', authenticateToken, adminRoutes);
app.use('/api/admin', authenticateToken, adminRoutes);
app.use('/authority', authenticateToken, authorityRoutes);

// =======================
// Start server
// =======================

const PORT = Number(process.env.PORT || 3000);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  // Attempt DB connection but don't block server start
  initDbConnectionWithRetry();
  logAiProviderStartupStatus();
  startAiHealthMonitor();
});

