const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function initDatabase() {
  try {
    console.log('🔄 Initializing database...\n');

    // Step 1: Connect to MySQL (no database specified yet)
    const conn = await mysql.createConnection({
      host: process.env.MYSQLHOST,
      user: process.env.MYSQLUSER,
      password: process.env.MYSQLPASSWORD
    });
    console.log('✅ Connected to MySQL\n');

    // Step 2: Create database
    await conn.query('CREATE DATABASE IF NOT EXISTS scrs');
    console.log('✅ Database "scrs" created/verified\n');

    // Step 3: Switch to the database
    await conn.changeUser({ database: process.env.MYSQLDATABASE });
    console.log('✅ Switched to database\n');

    // Step 4: Read and execute SQL file
    const sqlPath = path.join(__dirname, '..', 'db.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and filter out empty statements
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

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
