const mysql = require('mysql2/promise');

async function checkDatabase() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pranav@sql296',
      database: 'scrs'
    });

    console.log('✅ Connected to database\n');

    // Check if users table exists
    const [usersTables] = await conn.query('SHOW TABLES LIKE "users"');
    if (usersTables.length > 0) {
      console.log('✅ Users table exists\n');
      const [usersColumns] = await conn.query('DESCRIBE users');
      console.log('Users table columns:');
      usersColumns.forEach(col => console.log(`  - ${col.Field}`));
    } else {
      console.log('❌ Users table NOT found\n');
    }

    // Check if complaints table exists
    console.log('\n');
    const [complaintsTables] = await conn.query('SHOW TABLES LIKE "complaints"');
    if (complaintsTables.length > 0) {
      console.log('✅ Complaints table exists\n');
      const [complaintsColumns] = await conn.query('DESCRIBE complaints');
      console.log('Complaints table columns:');
      complaintsColumns.forEach(col => console.log(`  - ${col.Field} (${col.Type})`));
    } else {
      console.log('❌ Complaints table NOT found\n');
    }

    await conn.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkDatabase();
