const mysql = require('mysql2/promise');
require('dotenv').config();
const dbConfig = require('../config/dbConfig');

async function checkScrs() {
  let connection;
  try {
    const config = { ...dbConfig, database: 'nivarahub' };
    connection = await mysql.createConnection(config);
    const [tables] = await connection.query('SHOW TABLES');
    console.log('Tables in "nivarahub":', tables.map(t => Object.values(t)[0]));
  } catch (err) {
    console.error(err);
  } finally {
    if (connection) await connection.end();
  }
}
checkScrs();






