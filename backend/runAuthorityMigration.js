/**
 * Authority Migration Runner
 * Executes authority-specific database schema changes with error handling
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runAuthorityMigration() {
  try {
    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });

    console.log('✅ Connected to MySQL\n');
    console.log('📝 Running Authority Supervisory Role Migration\n');

    // Commands to run - these are safe and handle existing columns
    const commands = [
      {
        name: 'Add manual_priority_override column',
        sql: 'ALTER TABLE complaints ADD COLUMN manual_priority_override BOOLEAN DEFAULT FALSE'
      },
      {
        name: 'Add is_escalated column',
        sql: 'ALTER TABLE complaints ADD COLUMN is_escalated BOOLEAN DEFAULT FALSE'
      },
      {
        name: 'Create index on manual_priority_override',
        sql: 'CREATE INDEX idx_manual_priority_override ON complaints(manual_priority_override)'
      },
      {
        name: 'Create index on is_escalated',
        sql: 'CREATE INDEX idx_is_escalated ON complaints(is_escalated)'
      },
      {
        name: 'Add action column to complaint_history',
        sql: 'ALTER TABLE complaint_history ADD COLUMN action VARCHAR(50)'
      },
      {
        name: 'Add role column to complaint_history',
        sql: 'ALTER TABLE complaint_history ADD COLUMN role ENUM(\'citizen\',\'admin\',\'authority\') DEFAULT \'admin\''
      },
      {
        name: 'Add old_value column to complaint_history',
        sql: 'ALTER TABLE complaint_history ADD COLUMN old_value VARCHAR(255)'
      },
      {
        name: 'Add new_value column to complaint_history',
        sql: 'ALTER TABLE complaint_history ADD COLUMN new_value VARCHAR(255)'
      },
      {
        name: 'Add field_changed column to complaint_history',
        sql: 'ALTER TABLE complaint_history ADD COLUMN field_changed VARCHAR(100)'
      },
      {
        name: 'Create index on complaint_history.role',
        sql: 'CREATE INDEX idx_complaint_history_role ON complaint_history(role)'
      },
      {
        name: 'Create index on complaint_history.action',
        sql: 'CREATE INDEX idx_complaint_history_action ON complaint_history(action)'
      },
      {
        name: 'Create index on complaint_history.created_at',
        sql: 'CREATE INDEX idx_complaint_history_created ON complaint_history(created_at)'
      }
    ];

    let successCount = 0;
    let skipCount = 0;
    let errorCount = 0;

    for (let i = 0; i < commands.length; i++) {
      const cmd = commands[i];
      console.log(`⏳ [${i + 1}/${commands.length}] ${cmd.name}...`);

      try {
        await connection.execute(cmd.sql);
        console.log('   ✅ Success\n');
        successCount++;
      } catch (error) {
        if (error.code === 'ER_DUP_FIELDNAME' || 
            error.message.includes('already exists') ||
            error.code === 'ER_DUP_KEYNAME') {
          console.log('   ⚠️  Already exists, skipping\n');
          skipCount++;
        } else {
          console.log(`   ❌ Error: ${error.message}\n`);
          errorCount++;
          // Continue with other migrations even if one fails
        }
      }
    }

    console.log('\n========================================');
    console.log('📊 Migration Summary');
    console.log('========================================');
    console.log(`✅ Successful: ${successCount}`);
    console.log(`⚠️  Skipped: ${skipCount}`);
    console.log(`❌ Errors: ${errorCount}`);
    console.log('========================================\n');

    // Verify new columns exist
    console.log('🔍 Verifying Authority Schema...\n');

    const [complaintsCols] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'complaints'
        AND TABLE_SCHEMA = 'scrs'
        AND COLUMN_NAME IN ('manual_priority_override', 'is_escalated')
      ORDER BY COLUMN_NAME
    `);

    console.log('✅ Complaints table columns:');
    complaintsCols.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

    const [historyCols] = await connection.execute(`
      SELECT COLUMN_NAME, DATA_TYPE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = 'complaint_history'
        AND TABLE_SCHEMA = 'scrs'
        AND COLUMN_NAME IN ('action', 'role', 'old_value', 'new_value', 'field_changed')
      ORDER BY COLUMN_NAME
    `);

    console.log('\n✅ Complaint_history table columns:');
    historyCols.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE}`);
    });

    await connection.end();
    console.log('\n✅ Authority migration complete!\n');

  } catch (error) {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  }
}

runAuthorityMigration();
