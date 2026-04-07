/**
 * @file dbConfig.js
 * @description Centralized, robust database configuration for SCRS.
 * Automatically handles:
 * 1. Connection strings (MYSQL_URL, DATABASE_URL, etc.)
 * 2. Individual environment variables (DB_HOST, MYSQLHOST, etc.)
 * 3. SSL configuration for production (Render/Railway)
 * 4. Local fallback (LOCAL_MYSQLHOST, etc.)
 */

function getDbConfig() {
  const env = process.env;

  // 0. Explicit connection URL (Highest priority - standard for Render/Railway)
  const connectionUrl = env.MYSQL_URL || env.DATABASE_URL || env.MYSQL_PRIVATE_URL;
  if (connectionUrl) {
    // If it's a URL, we might still want to append SSL if it's not already there,
    // but usually, mysql2 handles it if the connection string includes it.
    return connectionUrl;
  }

  // 1. Production individual variables (User's Final Working VERSION)
  // Check both DB_* and MYSQL* conventions
  const prodHost = env.DB_HOST || env.MYSQLHOST;
  
  if (prodHost && prodHost !== 'localhost') {
    return {
      host: prodHost,
      port: parseInt(env.DB_PORT || env.MYSQLPORT || '3306', 10),
      user: env.DB_USER || env.MYSQLUSER,
      password: env.DB_PASSWORD || env.MYSQLPASSWORD,
      database: env.DB_NAME || env.MYSQLDATABASE || env.DB_DATABASE,
      ssl: {
        rejectUnauthorized: false
      },
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
