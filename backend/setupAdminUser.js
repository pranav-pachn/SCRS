/**
 * Admin RBAC System - Setup Script
 * 
 * Creates an admin user and assigns complaints for testing.
 * Run with: node setupAdminUser.js
 */

const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');

const dbConfig = require('./config/dbConfig');
const DB_CONFIG = dbConfig;


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

async function setupAdmin() {
  log('\n═════════════════════════════════════════════', 'cyan');
  log('   ADMIN RBAC SYSTEM - SETUP SCRIPT', 'cyan');
  log('═════════════════════════════════════════════\n', 'cyan');

  let conn = null;

  try {
    // Connect to database
    conn = await mysql.createConnection(DB_CONFIG);
    log('✅ Connected to database', 'green');

    // Create admin user
    log('\n📝 Creating admin user...', 'blue');
    const adminEmail = 'admin@scrs.local';
    const adminPassword = 'Admin@2796';
    const adminName = 'System Admin';

    // Check if admin already exists
    const [existingAdmins] = await conn.query(
      'SELECT id FROM users WHERE email = ? AND role = ?',
      [adminEmail, 'admin']
    );

    let adminId;
    if (existingAdmins.length > 0) {
      adminId = existingAdmins[0].id;
      log(`⚠️  Admin user already exists (ID: ${adminId})`, 'yellow');
    } else {
      // Hash password
      const passwordHash = await bcrypt.hash(adminPassword, 10);

      // Insert admin user
      const [result] = await conn.execute(
        'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
        [adminName, adminEmail, passwordHash, 'admin']
      );

      adminId = result.insertId;
      log(`✅ Admin user created (ID: ${adminId})`, 'green');
      log(`   Email: ${adminEmail}`, 'green');
      log(`   Password: ${adminPassword}`, 'green');
    }

    // Get complaints to assign
    log('\n📋 Fetching complaints without admin assignment...', 'blue');
    const [unassignedComplaints] = await conn.query(
      'SELECT id, category, status FROM complaints WHERE assigned_admin_id IS NULL AND is_deleted = FALSE LIMIT 5'
    );

    if (unassignedComplaints.length === 0) {
      log('⚠️  No unassigned complaints found', 'yellow');
      log('   You can view all complaints: SELECT * FROM complaints;', 'yellow');
    } else {
      log(`Found ${unassignedComplaints.length} complaints to assign`, 'green');

      // Assign complaints to admin
      log('\n🔗 Assigning complaints to admin...', 'blue');
      for (const complaint of unassignedComplaints) {
        await conn.execute(
          'UPDATE complaints SET assigned_admin_id = ? WHERE id = ?',
          [adminId, complaint.id]
        );
        log(`✅ Complaint ${complaint.id} (${complaint.category}) assigned to admin`, 'green');
      }
    }

    // Show dashboard stats
    log('\n📊 Admin Dashboard Statistics:', 'blue');
    const [stats] = await conn.query(
      `SELECT 
        COUNT(*) as total_assigned,
        SUM(CASE WHEN status = 'Submitted' THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) as in_progress,
        SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) as resolved,
        SUM(CASE WHEN priority = 'High' OR priority = 'Critical' THEN 1 ELSE 0 END) as critical
      FROM complaints 
      WHERE assigned_admin_id = ? AND is_deleted = FALSE`,
      [adminId]
    );

    const stat = stats[0];
    log(`Total Assigned: ${stat.total_assigned}`, 'cyan');
    log(`Pending: ${stat.pending || 0}`, 'cyan');
    log(`In Progress: ${stat.in_progress || 0}`, 'cyan');
    log(`Resolved: ${stat.resolved || 0}`, 'cyan');
    log(`High/Critical: ${stat.critical || 0}`, 'cyan');

    // Verify database schema
    log('\n🔍 Verifying database schema...', 'blue');
    const [tables] = await conn.query("SHOW TABLES");
    const tableNames = tables.map(t => Object.values(t)[0]);

    if (tableNames.includes('complaint_remarks')) {
      log('✅ complaint_remarks table exists', 'green');
    } else {
      log('❌ complaint_remarks table missing', 'red');
    }

    if (tableNames.includes('complaint_history')) {
      log('✅ complaint_history table exists', 'green');
    } else {
      log('❌ complaint_history table missing', 'red');
    }

    // Test requirements
    log('\n✅ Setup Complete!', 'green');
    log('\n═════════════════════════════════════════════', 'cyan');
    log('   QUICK START GUIDE', 'cyan');
    log('═════════════════════════════════════════════\n', 'cyan');

    log('1️⃣  LOGIN AS ADMIN:', 'yellow');
    log(`   curl -X POST http://localhost:3000/auth/login \\`, 'yellow');
    log(`     -H 'Content-Type: application/json' \\`, 'yellow');
    log(`     -d '{"email":"${adminEmail}","password":"${adminPassword}"}' |-jq .token`, 'yellow');

    log('\n2️⃣  GET YOUR ASSIGNED COMPLAINTS:', 'yellow');
    log(`   curl http://localhost:3000/admin/complaints \\`, 'yellow');
    log(`     -H 'Authorization: Bearer YOUR_TOKEN_HERE'`, 'yellow');

    log('\n3️⃣  UPDATE COMPLAINT STATUS:', 'yellow');
    log(`   curl -X PUT http://localhost:3000/admin/complaints/1/status \\`, 'yellow');
    log(`     -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\`, 'yellow');
    log(`     -H 'Content-Type: application/json' \\`, 'yellow');
    log(`     -d '{"status":"In Progress"}'`, 'yellow');

    log('\n4️⃣  ADD INTERNAL REMARK:', 'yellow');
    log(`   curl -X POST http://localhost:3000/admin/complaints/1/remark \\`, 'yellow');
    log(`     -H 'Authorization: Bearer YOUR_TOKEN_HERE' \\`, 'yellow');
    log(`     -H 'Content-Type: application/json' \\`, 'yellow');
    log(`     -d '{"remark_text":"Working on this issue"}'`, 'yellow');

    log('\n5️⃣  VIEW ADMIN DASHBOARD:', 'yellow');
    log(`   curl http://localhost:3000/admin/dashboard \\`, 'yellow');
    log(`     -H 'Authorization: Bearer YOUR_TOKEN_HERE' |-jq .dashboard`, 'yellow');

    log('\n6️⃣  READ FULL DOCUMENTATION:', 'yellow');
    log('   cat ADMIN_RBAC_DOCUMENTATION.md', 'yellow');

    log('\n═════════════════════════════════════════════\n', 'cyan');

  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (error.code === 'ER_NO_REFERENCED_ROW_2') {
      log('   Foreign key constraint failed. Check if users table exists.', 'red');
    }
  } finally {
    if (conn) {
      await conn.end();
    }
  }
}

setupAdmin();
