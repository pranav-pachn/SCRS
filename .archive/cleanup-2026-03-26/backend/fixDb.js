const mysql = require('mysql2/promise');

async function fixDatabase() {
  try {
    const conn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'Pranav@sql296',
      database: 'scrs'
    });

    console.log('🔧 Fixing complaints table...\n');

    // Add missing columns
    const alterStatements = [
      `ALTER TABLE complaints ADD COLUMN user_id INT NULL AFTER id`,
      `ALTER TABLE complaints ADD COLUMN complaint_id VARCHAR(20) GENERATED ALWAYS AS (CONCAT('COMP-', LPAD(id, 4, '0'))) STORED AFTER id`,
      `ALTER TABLE complaints ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE AFTER priority`,
      `ALTER TABLE complaints ADD COLUMN deleted_at DATETIME NULL AFTER is_deleted`,
      `ALTER TABLE complaints ADD COLUMN deleted_by INT NULL AFTER deleted_at`,
      `ALTER TABLE complaints ADD COLUMN updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at`,
      `ALTER TABLE complaints ADD FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL`,
      `ALTER TABLE complaints ADD FOREIGN KEY (deleted_by) REFERENCES users(id) ON DELETE SET NULL`
    ];

    for (let i = 0; i < alterStatements.length; i++) {
      try {
        await conn.query(alterStatements[i]);
        console.log(`✅ Statement ${i + 1} executed`);
      } catch (error) {
        if (error.message.includes('Duplicate column') || error.message.includes('1060') || error.message.includes('1826')) {
          console.log(`⚠️  Statement ${i + 1} skipped (already exists)`);
        } else {
          console.error(`❌ Statement ${i + 1} failed:`, error.message);
        }
      }
    }

    await conn.end();
    
    console.log('\n✅ Database fixes complete!');
    console.log('🎉 Now try submitting a complaint again.\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

fixDatabase();
