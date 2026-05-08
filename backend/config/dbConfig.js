/**
 * @file dbConfig.js
 * @description Centralized, robust database configuration for NivaraHub.
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

  // Check if production variables are set (not localhost)
  const prodHost = env.DB_HOST;
  
  // If production DB_HOST is set, use production config
  if (prodHost && prodHost !== 'localhost') {
    return {
      host: prodHost,
      port: parseInt(env.DB_PORT || '3306', 10),
      user: env.DB_USER,
      password: env.DB_PASSWORD,
      database: env.DB_NAME || env.MYSQLDATABASE || env.DB_DATABASE,
      connectTimeout: 30000,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  }

  // If DB_HOST is explicitly set to localhost with other DB vars, use them
  if (env.DB_HOST === 'localhost' && env.DB_USER) {
    return {
      host: env.DB_HOST,
      port: parseInt(env.DB_PORT || '3306', 10),
      user: env.DB_USER,
      password: env.DB_PASSWORD || '',
      database: env.DB_NAME || 'nivarahub',
      waitForConnections: true,
      connectionLimit: 5,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0
    };
  }

  // Local fallback variables (no DB_HOST set)
  return {
    host: env.LOCAL_MYSQLHOST || 'localhost',
    user: env.LOCAL_MYSQLUSER || 'root',
    password: env.LOCAL_MYSQLPASSWORD || '',
    database: env.LOCAL_MYSQLDATABASE || 'nivarahub',
    port: parseInt(env.LOCAL_MYSQLPORT || '3306', 10),
    waitForConnections: true,
    connectionLimit: 5,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 0
  };
}

module.exports = getDbConfig();






