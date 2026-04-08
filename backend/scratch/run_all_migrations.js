const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

function parseSQLStatements(sqlContent) {
  let cleaned = sqlContent
    .split('\n')
    .filter(line => !line.trim().startsWith('--'))
    .join('\n');
  return cleaned
    .split(';')
    .map(stmt => stmt.trim())
    .filter(stmt => stmt.length > 0);
}

async function runAllMigrations() {
  let connection;
  try {
    const dbConfig = require('../config/dbConfig');
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to MySQL');

    const migrationsDir = path.join(__dirname, '..', 'migrations');
    const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));
    
    for (const file of files) {
      console.log(`\n📝 Running migration: ${file}`);
      const sqlContent = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
      const statements = parseSQLStatements(sqlContent);
      
      for (let i = 0; i < statements.length; i++) {
        const stmt = statements[i];
        try {
          await connection.query(stmt);
          console.log(`✅ Statement ${i + 1} completed`);
        } catch (error) {
          if (error.message.includes('Duplicate column name') || 
              error.message.includes('already exists') ||
              error.message.includes('1060')) {
            console.log(`⚠️  Already exists, skipping...`);
          } else if (error.message.includes('1091') || error.message.includes('1061')) {
            console.log(`⚠️  Key/Index issue or Duplicate key name, skipping...`);
          } else {
            console.error(`❌ Error executing statement: ${error.message}`);
          }
        }
      }
    }
    console.log('\n✅ All migrations complete!');
  } catch (error) {
    console.error('❌ Failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

runAllMigrations();
