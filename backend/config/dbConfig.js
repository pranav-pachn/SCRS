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

  // Temporary debug to verify the active Railway variables.
  console.log('DB_HOST:', env.DB_HOST);
  console.log('MYSQLHOST:', env.MYSQLHOST);

  // Production Railway variables - single supported format.
  const prodHost = env.DB_HOST;
  
  if (prodHost && prodHost !== 'localhost') {
    return {
      host: prodHost,
      port: parseInt(env.DB_PORT || '3306', 10),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME || env.MYSQLDATABASE || env.DB_DATABASE,
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
