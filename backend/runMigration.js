/**
 * Database Migration Runner
 * Executes the AI Intelligence columns migration
 */

const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Remove comments and split SQL statements
function parseSQLStatements(sqlContent) {
  // Remove SQL comments (-- comments)
  let cleaned = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');

  // Split by semicolon, but preserve content
  const statements = cleaned
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);

  return statements;
}

async function runMigration() {
  try {
    // Read migration file
    const migrationPath = path.join(__dirname, 'migrations', 'add_ai_intelligence_columns.sql');
    let migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Create connection
    const connection = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD,
      database: process.env.MYSQLDATABASE,
      port: process.env.MYSQLPORT || 3306
    });

    console.log('✅ Connected to MySQL');
    console.log('📝 Running migration: add_ai_intelligence_columns.sql\n');

    // Parse and execute statements
    const statements = parseSQLStatements(migrationSQL);

    for (let i = 0; i < statements.length; i++) {
      const stmt = statements[i];
      if (stmt.length > 0) {
        try {
          console.log(`⏳ Executing statement ${i + 1}/${statements.length}...`);
          await connection.query(stmt);
          console.log(`✅ Statement ${i + 1} completed`);
        } catch (error) {
          // Ignore "column already exists" errors from ALTER TABLE ADD COLUMN
          if (error.message.includes('Duplicate column name') || 
              error.message.includes('already exists') ||
              error.message.includes('1060')) {
            console.log(`⚠️  Already exists, skipping...`);
          } else if (error.message.includes('1091')) {
            // Error 1091: Key doesn't exist (multiple ALTER INDEX attempts)
            console.log(`⚠️  Key/Index issue, skipping...`);
          } else {
            console.error(`❌ Error executing statement: ${error.message}`);
            console.log(`   Query: ${stmt.substring(0, 100)}...`);
          }
        }
      }
    }

    await connection.end();
    console.log('\n✅ Database migration complete!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

runMigration();
