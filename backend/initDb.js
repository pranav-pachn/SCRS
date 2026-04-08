const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDatabase() {
  try {
    console.log('🔄 Initializing database...\n');

// Step 1: Connect to MySQL (no database specified yet) using centralized config
    const dbConfig = require('./config/dbConfig');
    
    // For init, we connect to the host without a database to create it first
    const initConfig = typeof dbConfig === 'string' 
      ? dbConfig.replace(/\/[^/]*$/, '') // Remove database from URI if it's a string
      : { host: dbConfig.host, user: dbConfig.user, password: dbConfig.password, port: dbConfig.port };

    const conn = await mysql.createConnection(initConfig);

    console.log('✅ Connected to MySQL\n');

    // Step 2: Get target database name
    const targetDb = typeof dbConfig === 'string' 
      ? dbConfig.split('/').pop().split('?')[0] 
      : dbConfig.database;

    console.log(`🔨 Verifying database "${targetDb}"...`);
    // Note: On some managed hosts, CREATE DATABASE might be restricted.
    try {
      await conn.query(`CREATE DATABASE IF NOT EXISTS ${targetDb}`);
    } catch (e) {
      console.log(`⚠️ Note: Could not run CREATE DATABASE (normal on some managed hosts): ${e.message}`);
    }

    // Step 3: Switch to the database
    await conn.changeUser({ database: targetDb });
    console.log(`✅ Switched to database "${targetDb}"\n`);

    // Step 4: Read and execute SQL file
    const sqlPath = path.join(__dirname, '..', 'db.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    // Strip comments first
    const cleanSql = sqlContent
      .split('\n')
      .map(line => line.split('--')[0].trim())
      .join(' ');

    const statements = cleanSql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.includes('?'));

    console.log(`📝 Executing ${statements.length} SQL statements...\n`);

    for (let i = 0; i < statements.length; i++) {
      try {
        await conn.query(statements[i]);
        console.log(`✅ Statement ${i + 1}/${statements.length} executed`);
      } catch (error) {
        // Ignore "already exists" errors
        if (error.message.includes('already exists') || error.message.includes('1050')) {
          console.log(`⚠️  Statement ${i + 1}/${statements.length} skipped (already exists)`);
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
        }
      }
    }

    await conn.end();
    
    console.log('\n✅ Database initialization complete!');
    console.log('🎉 You can now register and login.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Database initialization failed:', error.message);
    process.exit(1);
  }
}

initDatabase();
