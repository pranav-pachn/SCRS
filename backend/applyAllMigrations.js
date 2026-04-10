require('dotenv').config({ path: __dirname + '/.env' });
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

function parseSQLStatements(sqlContent) {
  let cleaned = sqlContent.split('\n').filter(line => !line.trim().startsWith('--')).join('\n');
  return cleaned.split(';').map(s => s.trim()).filter(s => s.length > 0);
}

async function runAllMigrations() {
  console.log('🔄 Starting full migration process...\n');
  const dbConfig = require('./config/dbConfig');
  const connection = await mysql.createConnection(dbConfig);
  console.log('✅ Connected to MySQL');

  const migrationsDir = path.join(__dirname, 'migrations');
  const files = fs.readdirSync(migrationsDir).filter(f => f.endsWith('.sql'));

  for (const file of files) {
    console.log(`\n📝 Running migration: ${file}`);
    const sqlPath = path.join(migrationsDir, file);
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    const statements = parseSQLStatements(sqlContent);

    for (let i = 0; i < statements.length; i++) {
       try {
          await connection.query(statements[i]);
          console.log(`   ✅ Statement ${i + 1} completed`);
       } catch (error) {
          if (error.message.includes('Duplicate column name') || 
              error.message.includes('already exists') ||
              error.message.includes('1060')) {
            console.log(`   ⚠️  Statement ${i+1}: Already exists, skipping`);
          } else {
            console.error(`   ❌ Statement ${i+1} failed:`, error.message);
          }
       }
    }
  }

  await connection.end();
  console.log('\n✅ All migrations applied.');
}

runAllMigrations().catch(e => {
  console.error('❌ Migration script failed:', e);
  process.exit(1);
});
