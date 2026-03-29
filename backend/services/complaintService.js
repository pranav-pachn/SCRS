/**
 * Complaint Service - Business Logic Layer
 * 
 * Handles all database operations for complaints.
 * Separates business logic from route handlers.
 */

const SLA_DAYS_BY_PRIORITY = {
  Low: 7,
  Medium: 5,
  High: 3,
  Critical: 1
};

function getSlaDays(priority) {
  return SLA_DAYS_BY_PRIORITY[priority] || SLA_DAYS_BY_PRIORITY.Medium;
}

function withOperationalMetadata(row) {
  const daysSinceCreated = Number(row.days_since_created || 0);
  const slaDays = getSlaDays(row.priority);
  const isResolved = row.status === 'Resolved';
  const isOverdue = !isResolved && daysSinceCreated > slaDays;
  const similarCount = Number(row.similar_count || 0);

  return {
    ...row,
    days_since_created: daysSinceCreated,
    sla_days: slaDays,
    is_overdue: isOverdue,
    has_similar: similarCount > 0,
    similar_count: similarCount
  };
}

/**
 * Get complaints assigned to a specific admin
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} adminId - Admin user ID
 * @param {Object} filters - Filter options
 * @param {string} filters.status - Filter by status
 * @param {string} filters.priority - Filter by priority
 * @param {string} filters.category - Filter by category
 * @returns {Promise<Array>} Array of complaint objects
 */
async function getAssignedComplaints(dbConnection, adminId, filters = {}) {
  let query = `
    SELECT 
      c.id,
      CONCAT('COMP-', LPAD(c.id, 4, '0')) as complaint_id,
      c.category,
      c.description,
      c.location,
      c.status,
      c.priority,
      c.summary,
      c.tags,
      c.ai_suggested_priority,
      c.image_url,
      c.proof_url,
      c.assigned_admin_id,
      c.created_at,
      c.updated_at,
      TIMESTAMPDIFF(DAY, c.created_at, NOW()) AS days_since_created,
      (
        SELECT COUNT(*)
        FROM complaints c2
        WHERE c2.id <> c.id
          AND c2.category = c.category
          AND c2.location = c.location
          AND c2.is_deleted = FALSE
      ) AS similar_count,
      u.name AS submitter_name,
      u.email AS submitter_email
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.assigned_admin_id = ? 
      AND c.is_deleted = FALSE
  `;

  const params = [adminId];

  // Apply filters
  if (filters.status) {
    query += ' AND c.status = ?';
    params.push(filters.status);
  }

  if (filters.priority) {
    query += ' AND c.priority = ?';
    params.push(filters.priority);
  }

  if (filters.category) {
    query += ' AND c.category = ?';
    params.push(filters.category);
  }

  // Sort by priority DESC, then created_at ASC
  query += ' ORDER BY FIELD(c.priority, "High", "Medium", "Low") DESC, c.created_at ASC';

  const [rows] = await dbConnection.execute(query, params);
  return rows.map(withOperationalMetadata);
}

/**
 * Get a single complaint by ID (with assignment check)
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId - Complaint ID
 * @param {number} adminId - Admin user ID (for authorization check)
 * @returns {Promise<Object|null>} Complaint object or null if not found/not assigned
 */
async function getComplaintById(dbConnection, complaintId, adminId) {
  const [rows] = await dbConnection.execute(
    `SELECT 
      c.*,
      TIMESTAMPDIFF(DAY, c.created_at, NOW()) AS days_since_created,
      (
        SELECT COUNT(*)
        FROM complaints c2
        WHERE c2.id <> c.id
          AND c2.category = c.category
          AND c2.location = c.location
          AND c2.is_deleted = FALSE
      ) AS similar_count,
      u.name AS submitter_name,
      u.email AS submitter_email
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.id
    WHERE c.id = ? AND c.is_deleted = FALSE`,
    [complaintId]
  );

  if (rows.length === 0) {
    return null;
  }

  const complaint = rows[0];

  // Security check: Admin can only access complaints assigned to them
  if (complaint.assigned_admin_id !== adminId) {
    return null; // Return null to indicate access denied
  }

  return withOperationalMetadata(complaint);
}

/**
 * Update complaint status with history logging
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId - Complaint ID
 * @param {string} newStatus - New status value
 * @param {number} adminId - Admin user ID making the change
 * @returns {Promise<Object>} Update result
 */
async function updateComplaintStatus(dbConnection, complaintId, newStatus, adminId) {
  // Valid status transitions
  const validStatuses = ['Submitted', 'In Progress', 'Resolved'];
  const validTransitions = {
    'Submitted': ['In Progress'],
    'In Progress': ['Resolved'],
    'Resolved': [] // Cannot transition from Resolved (unless reopening is added)
  };
  const normalizeStatus = (status) => {
    const raw = String(status || '').trim().toLowerCase().replace(/[-_]+/g, ' ').replace(/\s+/g, ' ');
    if (raw === 'in progress') return 'In Progress';
    if (raw === 'resolved' || raw === 'completed') return 'Resolved';
    if (raw === 'submitted' || raw === 'pending') return 'Submitted';
    return raw ? raw.replace(/\b\w/g, ch => ch.toUpperCase()) : '';
  };

  // Get current complaint
  const [complaintRows] = await dbConnection.execute(
    'SELECT status, assigned_admin_id, proof_url FROM complaints WHERE id = ? AND is_deleted = FALSE',
    [complaintId]
  );

  if (complaintRows.length === 0) {
    throw new Error('Complaint not found');
  }

  const complaint = complaintRows[0];

  // Security check: Must be assigned to this admin
  if (complaint.assigned_admin_id !== adminId) {
    throw new Error('Complaint is not assigned to you');
  }

  const normalizedNewStatus = normalizeStatus(newStatus);
  // Validate new status
  if (!validStatuses.includes(normalizedNewStatus)) {
    throw new Error(`Invalid status: ${newStatus}. Valid statuses: ${validStatuses.join(', ')}`);
  }

  // Validate status transition
  const currentStatus = normalizeStatus(complaint.status);
  const allowedTransitions = validTransitions[currentStatus] || [];

  if (!allowedTransitions.includes(normalizedNewStatus)) {
    throw new Error(`Invalid status transition: ${currentStatus} → ${newStatus}. Allowed transitions: ${allowedTransitions.join(', ') || 'none'}`);
  }

  // Additional validation: Cannot mark as Resolved without proof_url or stored resolution note.
  if (normalizedNewStatus === 'Resolved') {
    const [resolutionNoteRows] = await dbConnection.execute(
      `SELECT COUNT(*) AS note_count
       FROM complaint_history
       WHERE complaint_id = ?
         AND note LIKE 'Resolution Note:%'`,
      [complaintId]
    );
    const hasResolutionNote = Number(resolutionNoteRows[0]?.note_count || 0) > 0;
    if (!complaint.proof_url && !hasResolutionNote) {
      throw new Error('Cannot mark complaint as Resolved without uploading resolution proof or adding a resolution note.');
    }
  }

  // Start transaction
  const connection = await dbConnection.getConnection();
  await connection.beginTransaction();

  try {
    // Update complaint status and resolved_at timestamp if marking as resolved
    if (normalizedNewStatus === 'Resolved') {
      await connection.execute(
        'UPDATE complaints SET status = ?, resolved_at = NOW(), updated_at = NOW() WHERE id = ?',
        [normalizedNewStatus, complaintId]
      );
    } else {
      await connection.execute(
        'UPDATE complaints SET status = ?, updated_at = NOW() WHERE id = ?',
        [normalizedNewStatus, complaintId]
      );
    }

    // Insert into complaint_history
    await connection.execute(
      `INSERT INTO complaint_history (complaint_id, changed_by, old_status, new_status, note)
       VALUES (?, ?, ?, ?, ?)`,
      [
        complaintId,
        adminId,
        currentStatus,
        normalizedNewStatus,
        `Status changed from "${currentStatus}" to "${normalizedNewStatus}" by admin`
      ]
    );

    await connection.commit();

    // Return updated complaint
    const [updatedRows] = await dbConnection.execute(
      'SELECT * FROM complaints WHERE id = ?',
      [complaintId]
    );

    return updatedRows[0];
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Add a remark to a complaint
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId - Complaint ID
 * @param {string} remarkText - Remark content
 * @param {number} adminId - Admin user ID
 * @returns {Promise<Object>} Created remark object
 */
async function addComplaintRemark(dbConnection, complaintId, remarkText, adminId) {
  // Verify complaint exists and is assigned to admin
  const complaint = await getComplaintById(dbConnection, complaintId, adminId);
  if (!complaint) {
    throw new Error('Complaint not found or not assigned to you');
  }

  // Insert remark
  const [result] = await dbConnection.execute(
    `INSERT INTO complaint_remarks (complaint_id, admin_id, remark_text)
     VALUES (?, ?, ?)`,
    [complaintId, adminId, remarkText]
  );

  // Return created remark
  const [rows] = await dbConnection.execute(
    'SELECT * FROM complaint_remarks WHERE id = ?',
    [result.insertId]
  );

  return rows[0];
}

/**
 * Get remarks for a complaint
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId - Complaint ID
 * @param {number} adminId - Admin user ID (for authorization)
 * @returns {Promise<Array>} Array of remark objects
 */
async function getComplaintRemarks(dbConnection, complaintId, adminId) {
  // Verify complaint is assigned to admin
  const complaint = await getComplaintById(dbConnection, complaintId, adminId);
  if (!complaint) {
    throw new Error('Complaint not found or not assigned to you');
  }

  const [rows] = await dbConnection.execute(
    `SELECT 
      r.id,
      r.complaint_id,
      r.admin_id,
      r.remark_text,
      r.created_at,
      u.name AS admin_name
    FROM complaint_remarks r
    LEFT JOIN users u ON r.admin_id = u.id
    WHERE r.complaint_id = ?
    ORDER BY r.created_at DESC`,
    [complaintId]
  );

  return rows;
}

/**
 * Upload resolve proof (image URL)
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} complaintId - Complaint ID
 * @param {string} proofUrl - Proof image URL
 * @param {number} adminId - Admin user ID
 * @returns {Promise<Object>} Updated complaint object
 */
async function uploadResolveProof(dbConnection, complaintId, proofUrl, adminId) {
  // Verify complaint exists and is assigned to admin
  const complaint = await getComplaintById(dbConnection, complaintId, adminId);
  if (!complaint) {
    throw new Error('Complaint not found or not assigned to you');
  }

  // Update proof_url
  await dbConnection.execute(
    'UPDATE complaints SET proof_url = ?, updated_at = NOW() WHERE id = ?',
    [proofUrl, complaintId]
  );

  // Return updated complaint
  const [rows] = await dbConnection.execute(
    'SELECT * FROM complaints WHERE id = ?',
    [complaintId]
  );

  return rows[0];
}

/**
 * Get admin dashboard statistics
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} adminId - Admin user ID
 * @returns {Promise<Object>} Dashboard statistics
 */
async function getAdminDashboardStats(dbConnection, adminId) {
  // Get all assigned complaints
  const [complaints] = await dbConnection.execute(
    `SELECT 
      status,
      priority,
      created_at,
      updated_at,
      CASE 
        WHEN status = 'Resolved' AND updated_at IS NOT NULL 
        THEN TIMESTAMPDIFF(HOUR, created_at, updated_at)
        ELSE NULL
      END AS resolution_hours
    FROM complaints
    WHERE assigned_admin_id = ? AND is_deleted = FALSE`,
    [adminId]
  );

  const totalAssigned = complaints.length;
  const pendingCount = complaints.filter(c => c.status === 'Submitted').length;
  const inProgressCount = complaints.filter(c => c.status === 'In Progress').length;
  const resolvedCount = complaints.filter(c => c.status === 'Resolved').length;
  const criticalCount = complaints.filter(c => c.priority === 'Critical' || c.priority === 'High').length;
  const overdueCount = complaints.filter(c => {
    if (c.status === 'Resolved') return false;
    const daysOpen = Number(Math.floor((Date.now() - new Date(c.created_at).getTime()) / 86400000));
    const slaDays = getSlaDays(c.priority);
    return daysOpen > slaDays;
  }).length;

  // Calculate average resolution time (in hours)
  const resolvedComplaints = complaints.filter(c => c.resolution_hours !== null);
  const averageResolutionTime = resolvedComplaints.length > 0
    ? resolvedComplaints.reduce((sum, c) => sum + c.resolution_hours, 0) / resolvedComplaints.length
    : null;

  // Get complaints pending over 7 days
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const [oldComplaints] = await dbConnection.execute(
    `SELECT COUNT(*) as old_count 
     FROM complaints
     WHERE assigned_admin_id = ? 
       AND is_deleted = FALSE
       AND status != 'Resolved'
       AND created_at < ?`,
    [adminId, sevenDaysAgo.toISOString().slice(0, 19).replace('T', ' ')]
  );

  const pendingOver7Days = oldComplaints[0].old_count || 0;

  // Get complaints completed today
  const today = new Date().toISOString().split('T')[0];
  const [todayResolved] = await dbConnection.execute(
    `SELECT COUNT(*) as today_count 
     FROM complaints
     WHERE assigned_admin_id = ? 
       AND is_deleted = FALSE
       AND status = 'Resolved'
       AND DATE(resolved_at) = ?`,
    [adminId, today]
  );

  const completedToday = todayResolved[0].today_count || 0;

  return {
    total_assigned: totalAssigned,
    assigned_total: totalAssigned,
    pending_count: pendingCount,
    in_progress_count: inProgressCount,
    resolved_count: resolvedCount,
    critical_count: criticalCount,
    overdue_count: overdueCount,
    average_resolution_time: averageResolutionTime ? Math.round(averageResolutionTime * 100) / 100 : null,
    pending_over_7_days: pendingOver7Days,
    completed_today: completedToday
  };
}

/**
 * Get statistics trends for the past 30 days
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} adminId - Admin user ID
 * @returns {Promise<Object>} Trend statistics with daily data
 */
async function getStatisticsTrends(dbConnection, adminId) {
  try {
    // Get current stats
    const currentStats = await getAdminDashboardStats(dbConnection, adminId);
    
    // Get stats from 30 days ago
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const [oldComplaintsData] = await dbConnection.execute(
      `SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved
       FROM complaints
       WHERE assigned_admin_id = ? 
         AND is_deleted = FALSE
         AND created_at < ?`,
      [adminId, thirtyDaysAgo.toISOString().slice(0, 19).replace('T', ' ')]
    );
    
    const oldStats = {
      total: oldComplaintsData[0].total || 0,
      pending: oldComplaintsData[0].pending || 0,
      resolved: oldComplaintsData[0].resolved || 0
    };
    
    // Calculate trends (percentage change)
    const calculateTrend = (current, old) => {
      if (old === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - old) / old) * 100);
    };
    
    return {
      total_assigned: {
        value: currentStats.total_assigned,
        trend: calculateTrend(currentStats.total_assigned, oldStats.total)
      },
      pending: {
        value: currentStats.pending_count,
        trend: calculateTrend(currentStats.pending_count, oldStats.pending)
      },
      resolved: {
        value: currentStats.resolved_count,
        trend: calculateTrend(currentStats.resolved_count, oldStats.resolved)
      },
      critical: {
        value: (currentStats.high_priority_count || 0) + (currentStats.critical_priority_count || 0),
        trend: 0 // Can't calculate historical critical count without additional data
      },
      resolved_rate: {
        value: currentStats.total_assigned > 0 
          ? Math.round((currentStats.resolved_count / currentStats.total_assigned) * 100)
          : 0,
        trend: 0
      }
    };
  } catch (error) {
    console.error('❌ Error in getStatisticsTrends:', error);
    // Return default trends to prevent 500 errors
    return {
      total_assigned: { value: 0, trend: 0 },
      pending: { value: 0, trend: 0 },
      resolved: { value: 0, trend: 0 },
      critical: { value: 0, trend: 0 },
      resolved_rate: { value: 0, trend: 0 }
    };
  }
}

/**
 * Get monthly trends for an admin's assigned complaints
 *
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} adminId - Admin user ID
 * @returns {Promise<Array>} Monthly trend rows for charts
 */
async function getAdminMonthlyTrends(dbConnection, adminId) {
  const [rows] = await dbConnection.execute(
    `SELECT
       DATE_FORMAT(created_at, '%Y-%m') AS month,
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved,
       SUM(CASE WHEN status != 'Resolved' THEN 1 ELSE 0 END) AS pending,
       SUM(CASE WHEN priority IN ('High', 'Critical') THEN 1 ELSE 0 END) AS critical
     FROM complaints
     WHERE assigned_admin_id = ?
       AND is_deleted = FALSE
     GROUP BY DATE_FORMAT(created_at, '%Y-%m')
     ORDER BY month ASC`,
    [adminId]
  );

  return rows.map(row => ({
    month: row.month,
    total: Number(row.total) || 0,
    resolved: Number(row.resolved) || 0,
    pending: Number(row.pending) || 0,
    critical: Number(row.critical) || 0
  }));
}

/**
 * Get activity feed for admin dashboard (status changes + remarks)
 * 
 * @param {Object} dbConnection - MySQL connection pool
 * @param {number} adminId - Admin user ID
 * @param {number} limit - Maximum number of items to return (default: 20)
 * @returns {Promise<Array>} Array of activity objects
 */
async function getAdminActivityFeed(dbConnection, adminId, limit = 20) {
  const activities = [];
  
  // Ensure limit is a valid integer
  const validLimit = Math.max(1, Math.min(parseInt(limit) || 20, 100));
  
  console.log(`🔍 getAdminActivityFeed called with adminId=${adminId}, limit=${validLimit}`);
  
  try {
    // Get status changes from complaint_history (using INNER JOIN to avoid NULL issues)
    const [historyRows] = await dbConnection.execute(
      `SELECT 
        ch.id,
        ch.complaint_id,
        ch.old_status,
        ch.new_status,
        ch.action,
        ch.field_changed,
        ch.created_at,
        CONCAT('COMP-', LPAD(c.id, 4, '0')) as display_id,
        u.name as admin_name,
        'status_change' as activity_type
      FROM complaint_history ch
      INNER JOIN complaints c ON ch.complaint_id = c.id
      LEFT JOIN users u ON ch.changed_by = u.id
      WHERE c.assigned_admin_id = ? 
        AND c.is_deleted = FALSE
        AND (ch.action = 'status_change' OR ch.field_changed = 'status')
      ORDER BY ch.created_at DESC
      LIMIT ${validLimit}`,
      [adminId]
    );
    
    console.log(`✅ Found ${historyRows.length} history rows`);
    
    // Get remarks from complaint_remarks (using INNER JOIN to avoid NULL issues)
    const [remarkRows] = await dbConnection.execute(
      `SELECT 
        r.id,
        r.complaint_id,
        r.remark_text,
        r.created_at,
        CONCAT('COMP-', LPAD(c.id, 4, '0')) as display_id,
        u.name as admin_name,
        'remark' as activity_type
      FROM complaint_remarks r
      INNER JOIN complaints c ON r.complaint_id = c.id
      LEFT JOIN users u ON r.admin_id = u.id
      WHERE c.assigned_admin_id = ? 
        AND c.is_deleted = FALSE
      ORDER BY r.created_at DESC
      LIMIT ${validLimit}`,
      [adminId]
    );
    
    console.log(`✅ Found ${remarkRows.length} remark rows`);
    
    // Combine and format activities
    historyRows.forEach(row => {
      let description = 'updated complaint';
      if (row.action === 'status_change' || row.field_changed === 'status') {
        description = `marked ${row.new_status}`;
      }
      
      activities.push({
        id: `history_${row.id}`,
        type: 'status_change',
        complaint_id: row.display_id || `COMP-${String(row.complaint_id).padStart(4, '0')}`,
        description: description,
        old_status: row.old_status,
        new_status: row.new_status,
        admin_name: row.admin_name || 'Admin',
        timestamp: row.created_at
      });
    });
    
    remarkRows.forEach(row => {
      const preview = row.remark_text.length > 50 
        ? row.remark_text.substring(0, 50) + '...' 
        : row.remark_text;
      activities.push({
        id: `remark_${row.id}`,
        type: 'remark',
        complaint_id: row.display_id || `COMP-${String(row.complaint_id).padStart(4, '0')}`,
        description: `added note: "${preview}"`,
        admin_name: row.admin_name || 'Admin',
        timestamp: row.created_at
      });
    });
    
    // Sort by timestamp DESC and limit
    activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    return activities.slice(0, validLimit);
  } catch (error) {
    console.error('❌ Error in getAdminActivityFeed:', error);
    // Return empty array instead of throwing to prevent 500 errors
    return [];
  }
}

/**
 * Get category distribution for assigned complaints.
 */
async function getAdminCategoryDistribution(dbConnection, adminId) {
  const [rows] = await dbConnection.execute(
    `SELECT category, COUNT(*) AS total
     FROM complaints
     WHERE assigned_admin_id = ?
       AND is_deleted = FALSE
     GROUP BY category
     ORDER BY total DESC`,
    [adminId]
  );

  return rows.map((row) => ({
    category: row.category,
    total: Number(row.total) || 0
  }));
}

/**
 * Personal admin performance KPIs.
 */
async function getAdminPerformanceStats(dbConnection, adminId) {
  const stats = await getAdminDashboardStats(dbConnection, adminId);
  const averageDays = stats.average_resolution_time
    ? Math.round((stats.average_resolution_time / 24) * 100) / 100
    : null;

  return {
    assigned: stats.total_assigned,
    resolved: stats.resolved_count,
    avg_resolution_days: averageDays,
    pending: stats.pending_count,
    in_progress: stats.in_progress_count,
    overdue: stats.overdue_count
  };
}

/**
 * Complaint-level timeline/history for detail page.
 */
async function getComplaintHistory(dbConnection, complaintId, adminId, limit = 50) {
  const complaint = await getComplaintById(dbConnection, complaintId, adminId);
  if (!complaint) {
    throw new Error('Complaint not found or not assigned to you');
  }

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const [rows] = await dbConnection.execute(
    `SELECT
       ch.id,
       ch.old_status,
       ch.new_status,
       ch.note,
       ch.created_at,
       u.name AS actor_name
     FROM complaint_history ch
     LEFT JOIN users u ON ch.changed_by = u.id
     WHERE ch.complaint_id = ?
     ORDER BY ch.created_at DESC
     LIMIT ${safeLimit}`,
    [complaintId]
  );

  return rows;
}

const KNOWLEDGE_BASE_ARTICLES = [
  {
    id: 'kb-reporting-guidelines',
    title: 'Reporting Guidelines',
    snippet: 'Learn the essential steps to file a valid complaint and ensure swift resolution by city teams.',
    url: 'complaint.html',
    keywords: ['reporting', 'guidelines', 'complaint', 'filing', 'submission', 'process']
  },
  {
    id: 'kb-city-infrastructure',
    title: 'City Infrastructure',
    snippet: 'Information regarding road maintenance, public lighting, bridges, and utility works.',
    url: 'support.html#kb-timelines',
    keywords: ['city', 'infrastructure', 'roads', 'streetlight', 'utility', 'bridges']
  },
  {
    id: 'kb-public-safety',
    title: 'Public Safety',
    snippet: 'Guidance for emergency hazards, neighborhood safety, and urgent reporting workflows.',
    url: 'support.html#kb-timelines',
    keywords: ['public', 'safety', 'emergency', 'hazards', 'patrol']
  },
  {
    id: 'kb-resolution-process',
    title: 'Understanding the 3-Stage Resolution Process',
    snippet: 'How reports are triaged, assigned to departments, and verified on completion.',
    url: 'support.html#kb-featured',
    keywords: ['resolution', 'process', 'triage', 'assignment', 'stages']
  },
  {
    id: 'kb-documentation-required',
    title: 'Documentation Required for Property Issues',
    snippet: 'What photos and proof of residence are required for structural or zoning complaints.',
    url: 'support.html#kb-faq',
    keywords: ['documentation', 'property', 'photos', 'proof', 'residence', 'zoning']
  }
];

function tokenizeSearchText(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function scoreKnowledgeBaseMatch(query, text, keywords = []) {
  const queryTokens = tokenizeSearchText(query);
  if (queryTokens.length === 0) {
    return 0;
  }

  const haystackTokens = new Set([
    ...tokenizeSearchText(text),
    ...keywords.map((token) => String(token || '').toLowerCase())
  ]);

  let score = 0;
  queryTokens.forEach((token) => {
    if (haystackTokens.has(token)) {
      score += 1;
    }
  });

  return Number((score / queryTokens.length).toFixed(4));
}

function normalizeKnowledgeBaseResult(result) {
  return {
    id: result.id,
    type: result.type,
    title: result.title,
    snippet: result.snippet,
    url: result.url,
    score: Number(result.score || 0),
    keywords: Array.isArray(result.keywords) ? result.keywords : []
  };
}

async function searchKnowledgeBaseKeyword(dbConnection, query, options = {}) {
  const safeQuery = String(query || '').trim();
  const searchType = String(options.type || 'all').toLowerCase();
  const limit = Math.max(1, Math.min(Number(options.limit) || 10, 50));
  const sqlLimit = Math.max(limit * 3, 20);
  const wildcard = `%${safeQuery}%`;

  const includeArticles = searchType === 'all' || searchType === 'articles';
  const includeComplaints = searchType === 'all' || searchType === 'complaints';

  const results = [];

  if (includeArticles) {
    KNOWLEDGE_BASE_ARTICLES.forEach((article) => {
      const score = scoreKnowledgeBaseMatch(
        safeQuery,
        `${article.title} ${article.snippet} ${article.keywords.join(' ')}`,
        article.keywords
      );

      if (score > 0) {
        results.push(normalizeKnowledgeBaseResult({
          id: article.id,
          type: 'article',
          title: article.title,
          snippet: article.snippet,
          url: article.url,
          score,
          keywords: article.keywords
        }));
      }
    });
  }

  if (includeComplaints) {
    const [rows] = await dbConnection.execute(
      `SELECT id, category, description, summary, tags, status, priority
       FROM complaints
       WHERE is_deleted = FALSE
         AND (
           category LIKE ? OR
           description LIKE ? OR
           summary LIKE ? OR
           tags LIKE ?
         )
       ORDER BY created_at DESC
       LIMIT ${sqlLimit}`,
      [wildcard, wildcard, wildcard, wildcard]
    );

    rows.forEach((row) => {
      let parsedTags = [];
      try {
        parsedTags = JSON.parse(row.tags || '[]');
      } catch (error) {
        parsedTags = [];
      }

      const keywords = [row.category, row.status, row.priority]
        .concat(Array.isArray(parsedTags) ? parsedTags : [])
        .filter(Boolean);

      const snippet = (row.summary || row.description || '').slice(0, 180);
      const score = scoreKnowledgeBaseMatch(
        safeQuery,
        `${row.category || ''} ${row.description || ''} ${row.summary || ''} ${keywords.join(' ')}`,
        keywords
      );

      if (score > 0) {
        results.push(normalizeKnowledgeBaseResult({
          id: `complaint-${row.id}`,
          type: 'complaint',
          title: `${row.category || 'Complaint'} (${row.priority || 'Medium'})`,
          snippet,
          url: 'my-complaints.html',
          score,
          keywords
        }));
      }
    });
  }

  return results
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

module.exports = {
  getAssignedComplaints,
  getComplaintById,
  updateComplaintStatus,
  addComplaintRemark,
  getComplaintRemarks,
  uploadResolveProof,
  getAdminDashboardStats,
  getStatisticsTrends,
  getAdminMonthlyTrends,
  getAdminActivityFeed,
  getAdminCategoryDistribution,
  getAdminPerformanceStats,
  getComplaintHistory,
  searchKnowledgeBaseKeyword,
  scoreKnowledgeBaseMatch,
  SLA_DAYS_BY_PRIORITY
};
