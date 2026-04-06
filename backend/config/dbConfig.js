/**
 * @file dbConfig.js
 * @description Centralized, robust database configuration for SCRS.
 * Automatically handles:
 * 1. Connection strings (MYSQL_URL, DATABASE_URL, etc.)
 * 2. Individual environment variables (MYSQLHOST, MYSQLUSER, etc.)
 * 3. Local fallback (LOCAL_MYSQLHOST, etc.)
 */

function getDbConfig() {
  const env = process.env;

  // 0. Explicit connection URL (Highest priority - standard for Render/Railway)
  const connectionUrl = env.MYSQL_URL || env.DATABASE_URL || env.MYSQL_PRIVATE_URL;
  if (connectionUrl) {
    return connectionUrl; // mysql2/promise createPool accepts a URI string
  }

  // 1. Production individual variables (Common for Railway)
  const prodHost = env.MYSQLHOST || env.DB_HOST;
  if (prodHost && prodHost !== 'localhost') {
    return {
      host: prodHost,
      user: env.MYSQLUSER || env.DB_USER,
      password: env.MYSQLPASSWORD || env.DB_PASSWORD,
      database: env.MYSQLDATABASE || env.DB_DATABASE || env.MYSQL_DATABASE,
      port: parseInt(env.MYSQLPORT || env.DB_PORT || '3306', 10),
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true
    };
  }

  // 2. Local fallback variables
  return {
    host: env.LOCAL_MYSQLHOST || 'localhost',
    user: env.LOCAL_MYSQLUSER || 'root',
    password: env.LOCAL_MYSQLPASSWORD || '',
    database: env.LOCAL_MYSQLDATABASE || 'scrs',
    port: parseInt(env.LOCAL_MYSQLPORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true
  };
}

module.exports = getDbConfig();
