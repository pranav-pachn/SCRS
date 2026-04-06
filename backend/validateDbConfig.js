/**
 * Database Configuration Validator
 * Run with: node backend/validateDbConfig.js
 */
require('dotenv').config({ path: __dirname + '/.env' });
const getDbConfig = require('./config/dbConfig');

console.log('\n🔍 === DATABASE CONFIGURATION DIAGNOSTIC ===');

try {
  const config = getDbConfig;
  
  if (typeof config === 'string') {
    console.log('📡 Mode: Connection URI');
    // Mask sensitive info in URI
    const maskedUri = config.replace(/\/\/([^:]+):([^@]+)@/, '//****:****@');
    console.log(`🔗 URI: ${maskedUri}`);
    
    const dbName = config.split('/').pop().split('?')[0];
    console.log(`🗄️  Database Name: ${dbName}`);
  } else {
    console.log('📂 Mode: Config Object');
    console.log(`🏠 Host: ${config.host}`);
    console.log(`👤 User: ${config.user}`);
    console.log(`🔒 Password: ${config.password ? '✓ (Set)' : '✗ (Empty)'}`);
    console.log(`🗄️  Database: ${config.database}`);
    console.log(`🔌 Port: ${config.port}`);
  }

  console.log('\n✅ Configuration logic looks good!');
  console.log('   (Note: This test only validates logic, it does not attempt a connection)\n');

} catch (error) {
  console.error('\n❌ Configuration validation failed:');
  console.error(error.message);
  process.exit(1);
}
