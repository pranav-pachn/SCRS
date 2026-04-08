const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = require('../config/dbConfig');

async function diagnose() {
  console.log('🔍 Starting Database Diagnosis...');
  let connection;
  try {
    const config = typeof dbConfig === 'string' ? dbConfig : { ...dbConfig, connectionLimit: 1 };
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to Database');

    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 Tables in database:', tables.map(t => Object.values(t)[0]));

    const usersTableExists = tables.some(t => Object.values(t)[0] === 'complaints');
    if (usersTableExists) {
      console.log('✅ "complaints" table exists');
      const [columns] = await connection.query('DESCRIBE complaints');
      console.log('🏛️  Complaints table columns:');
      console.table(columns.map(c => ({ Field: c.Field, Type: c.Type })));
    } else {
      console.log('❌ "complaints" table DOES NOT EXIST');
    }

  } catch (error) {
    console.error('❌ Diagnosis failed:', error.message);
  } finally {
    if (connection) await connection.end();
  }
}

diagnose();
