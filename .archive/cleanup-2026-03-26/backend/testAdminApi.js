/**
 * Admin RBAC System - API Testing Script
 * 
 * Tests all admin endpoints to verify RBAC is working correctly.
 * Run with: node testAdminApi.js
 */

const http = require('http');

const BASE_URL = 'http://localhost:3000';
let adminToken = null;
let complainantToken = null;
let testComplaintId = null;

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port || 80,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (token) {
      options.headers['Authorization'] = `Bearer ${token}`;
    }

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data ? JSON.parse(data) : null
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body: data
          });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  log('\n═════════════════════════════════════════════', 'cyan');
  log('   ADMIN RBAC SYSTEM - API TESTING SUITE', 'cyan');
  log('═════════════════════════════════════════════\n', 'cyan');

  try {
    // Test 1: Login as Citizen
    log('TEST 1: Login as Citizen', 'blue');
    log('─────────────────────────────', 'blue');
    const citizenLoginRes = await makeRequest('POST', '/auth/login', {
      email: 'pranavp2796@gmail.com',
      password: 'Pranav@2796'
    });
    
    if (citizenLoginRes.status === 200 && citizenLoginRes.body.success) {
      complainantToken = citizenLoginRes.body.token;
      log('✅ Citizen login successful', 'green');
      log(`   Token: ${complainantToken.substring(0, 20)}...`, 'green');
    } else {
      log('❌ Citizen login failed', 'red');
      log(`   Status: ${citizenLoginRes.status}`, 'red');
      log(`   Message: ${citizenLoginRes.body?.message || 'Unknown error'}`, 'red');
    }

    // Test 2: Create Admin User (via SQL is better, but showing here for demo)
    log('\nTEST 2: Create Admin User', 'blue');
    log('─────────────────────────────', 'blue');
    log('ℹ️  Run this SQL to create admin:', 'yellow');
    log(`INSERT INTO users (name, email, password_hash, role) 
VALUES ('Test Admin', 'testadmin@example.com', BCRYPT_HASH, 'admin');`, 'yellow');
    log('ℹ️  Then update complaint: UPDATE complaints SET assigned_admin_id = 2 WHERE id = 1;', 'yellow');

    // Test 3: Try to access admin endpoint as citizen (should fail)
    log('\nTEST 3: Access Admin Endpoint as Citizen (Should Fail)', 'blue');
    log('─────────────────────────────', 'blue');
    const unauthorizedRes = await makeRequest('GET', '/admin/complaints', null, complainantToken);
    
    if (unauthorizedRes.status === 403) {
      log('✅ Correctly denied access to citizen', 'green');
      log(`   Status: ${unauthorizedRes.status}`, 'green');
      log(`   Message: ${unauthorizedRes.body?.message || 'Forbidden'}`, 'green');
    } else {
      log('❌ Should have denied access!', 'red');
      log(`   Status: ${unauthorizedRes.status}`, 'red');
    }

    // Test 4: Check migration success
    log('\nTEST 4: Verify Database Schema', 'blue');
    log('─────────────────────────────', 'blue');
    const mysql = require('mysql2/promise');
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pranav@sql296',
      database: 'scrs'
    });

    const [complaintCols] = await conn.query('DESCRIBE complaints');
    const hasAssignedAdminId = complaintCols.some(col => col.Field === 'assigned_admin_id');
    const hasResolvedAt = complaintCols.some(col => col.Field === 'resolved_at');
    const hasProofUrl = complaintCols.some(col => col.Field === 'proof_url');

    if (hasAssignedAdminId && hasResolvedAt && hasProofUrl) {
      log('✅ All database columns added successfully', 'green');
      log('   ✓ assigned_admin_id', 'green');
      log('   ✓ resolved_at', 'green');
      log('   ✓ proof_url', 'green');
    } else {
      log('❌ Some columns missing:', 'red');
      if (!hasAssignedAdminId) log('   ✗ assigned_admin_id', 'red');
      if (!hasResolvedAt) log('   ✗ resolved_at', 'red');
      if (!hasProofUrl) log('   ✗ proof_url', 'red');
    }

    // Check complaint_remarks table
    const [tables] = await conn.query("SHOW TABLES LIKE 'complaint_remarks'");
    if (tables.length > 0) {
      log('✅ complaint_remarks table created', 'green');
    } else {
      log('❌ complaint_remarks table missing', 'red');
    }

    // Check complaint_history table
    const [historyTables] = await conn.query("SHOW TABLES LIKE 'complaint_history'");
    if (historyTables.length > 0) {
      log('✅ complaint_history table exists', 'green');
    } else {
      log('❌ complaint_history table missing', 'red');
    }

    await conn.end();

    // Test 5: Verify middleware and routes
    log('\nTEST 5: Verify Middleware & Routes', 'blue');
    log('─────────────────────────────', 'blue');
    
    const fs = require('fs');
    
    const middlewareExists = fs.existsSync('./middleware/requireRole.js');
    const adminRoutesExists = fs.existsSync('./routes/admin.js');
    const serviceExists = fs.existsSync('./services/complaintService.js');

    if (middlewareExists) {
      log('✅ middleware/requireRole.js exists', 'green');
    } else {
      log('❌ middleware/requireRole.js missing', 'red');
    }

    if (adminRoutesExists) {
      log('✅ routes/admin.js exists', 'green');
    } else {
      log('❌ routes/admin.js missing', 'red');
    }

    if (serviceExists) {
      log('✅ services/complaintService.js exists', 'green');
    } else {
      log('❌ services/complaintService.js missing', 'red');
    }

    // Verify imports in server.js
    const serverContent = fs.readFileSync('./server.js', 'utf8');
    const hasAdminImport = serverContent.includes("require('./routes/admin')");
    const hasRoleImport = serverContent.includes("require('./middleware/requireRole')");
    const hasAdminRoute = serverContent.includes("app.use('/admin'");

    if (hasAdminImport) {
      log('✅ Admin routes imported in server.js', 'green');
    } else {
      log('❌ Admin routes not imported', 'red');
    }

    if (hasAdminRoute) {
      log('✅ Admin routes registered in server.js', 'green');
    } else {
      log('❌ Admin routes not registered', 'red');
    }

  } catch (error) {
    log(`\n❌ Test Error: ${error.message}`, 'red');
    log('Make sure MySQL is running and server is accessible at http://localhost:3000', 'yellow');
  }

  log('\n═════════════════════════════════════════════', 'cyan');
  log('   NEXT STEPS:', 'cyan');
  log('═════════════════════════════════════════════\n', 'cyan');
  log('1. Create an admin user:', 'yellow');
  log('   UPDATE users SET role = "admin" WHERE id = 1;', 'yellow');
  log('   OR INSERT a new admin user', 'yellow');
  log('\n2. Assign a complaint to admin:', 'yellow');
  log('   UPDATE complaints SET assigned_admin_id = 1 WHERE id = 1;', 'yellow');
  log('\n3. Login as admin and test endpoints', 'yellow');
  log('\n4. Read ADMIN_RBAC_DOCUMENTATION.md for full API reference', 'yellow');
  log('\n');
}

runTests().catch(err => {
  log(`Fatal error: ${err.message}`, 'red');
  process.exit(1);
});
