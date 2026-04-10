require('dotenv').config();
const mysql = require('mysql2/promise');
const baseConfig = require('./config/dbConfig');

/**
 * Advanced diagnostic script to test multiple MySQL connection variations.
 * Focuses on SSL, Auth, and Connection types.
 */
async function runAdvancedDiagnostics() {
  console.log('\n🔍 === ADVANCED DATABASE CONNECTION DIAGNOSTICS ===');
  console.log('Using Variables:');
  console.log(`- HOST: ${process.env.DB_HOST}`);
  console.log(`- PORT: ${process.env.DB_PORT}`);
  console.log(`- USER: ${process.env.DB_USER}`);
  console.log(`- DATABASE: ${process.env.DB_NAME}`);

  const variations = [
    {
      name: 'Variation 1: Standard SSL (rejectUnauthorized: false)',
      config: { 
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
        connectTimeout: 10000
      }
    },
    {
      name: 'Variation 2: No SSL',
      config: { 
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: null,
        connectTimeout: 10000
      }
    },
    {
      name: 'Variation 3: Native Password Auth + SSL',
      config: { 
        host: process.env.DB_HOST,
        port: parseInt(process.env.DB_PORT),
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        ssl: { rejectUnauthorized: false },
        authPlugins: {
            mysql_native_password: () => require('mysql2/lib/auth_plugins').mysql_native_password
        },
        connectTimeout: 10000
      }
    }
  ];

  for (const test of variations) {
    console.log(`\n📡 Testing: ${test.name}...`);
    
    try {
      const startTime = Date.now();
      // Using createConnection for testing (single attempt)
      const connection = await mysql.createConnection(test.config);
      const duration = Date.now() - startTime;
      
      console.log(`   ✅ SUCCESS (Connected in ${duration}ms)`);
      
      const [rows] = await connection.execute('SELECT 1 + 1 AS result');
      console.log('   📊 Query Result:', rows[0].result);
      
      await connection.end();
      console.log('   🏁 TEST PASSED.');
      return test.name;
    } catch (error) {
      console.error(`   ❌ FAILED: ${error.message}`);
      if (error.code) console.error(`      Code: ${error.code}`);
    }
  }

  console.error('\n❌ All variations failed.');
  return null;
}

runAdvancedDiagnostics().then(result => {
  if (!result) process.exit(1);
  process.exit(0);
});
