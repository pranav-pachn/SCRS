const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = require('../config/dbConfig');

async function listDbs() {
  let connection;
  try {
    const config = typeof dbConfig === 'string' ? dbConfig : { ...dbConfig, database: undefined };
    connection = await mysql.createConnection(config);
    const [dbs] = await connection.query('SHOW DATABASES');
    console.log('Available databases:', dbs.map(d => d.Database));
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) await connection.end();
  }
}
listDbs();
