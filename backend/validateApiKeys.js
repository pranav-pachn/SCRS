/**
 * Gemini API Key Validator
 * 
 * Tests each API key to determine validity and capability
 * Checks:
 * - Key format (basic validation)
 * - API connectivity
 * - Model availability
 * - Quota/rate limit status
 */

require('dotenv').config();

const { GoogleGenerativeAI } = require('@google/generative-ai');

async function validateApiKey(keyString, index) {
  console.log(`\n🔍 Testing Key ${index + 1}: ${maskKey(keyString)}`);
  console.log('─'.repeat(65));

  const result = {
    index: index,
    key: maskKey(keyString),
    fullKey: keyString,
    valid: false,
    errors: [],
    capabilities: [],
    details: {}
  };

  try {
    // Check basic format
    if (!keyString || keyString.length < 20) {
      result.errors.push('Invalid key format (too short or empty)');
      return result;
    }

    if (!keyString.startsWith('AIza')) {
      result.errors.push('Invalid key prefix (should start with AIza)');
      return result;
    }

    // Try to initialize Gemini with this key
    console.log('   Testing connectivity...');
    const genAI = new GoogleGenerativeAI(keyString);
    
    // Try to get the model and make a simple call
    const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
    result.capabilities.push('gemini-pro available');

    // Make a minimal test request
    console.log('   Sending test request...');
    const response = await model.generateContent('Say "OK"');
    
    if (!response || !response.response) {
      result.errors.push('No response from API');
      return result;
    }

    const text = response.response.text();
    if (!text) {
      result.errors.push('Empty response from API');
      return result;
    }

    // Success!
    result.valid = true;
    result.capabilities.push('Test request succeeded');
    result.details.responseLength = text.length;
    result.details.responsePreview = text.substring(0, 50);

    console.log('   ✅ Key is VALID');
    console.log(`   Response: "${text}"`);

    return result;

  } catch (error) {
    console.log('   ❌ Key is INVALID');
    
    const errorMsg = error?.message || String(error);
    console.log(`   Error: ${errorMsg}`);

    result.valid = false;
    result.details.errorMessage = errorMsg;

    // Categorize error
    if (errorMsg.includes('API_KEY_INVALID') || errorMsg.includes('not valid')) {
      result.errors.push('API key rejected (invalid or expired)');
      result.details.category = 'INVALID_KEY';
    } else if (errorMsg.includes('429') || errorMsg.includes('quota exceeded') || errorMsg.includes('rate limit')) {
      result.errors.push('Rate limit or quota exceeded');
      result.details.category = 'RATE_LIMITED';
    } else if (errorMsg.includes('404') || errorMsg.includes('not found')) {
      result.errors.push('Model or endpoint not found');
      result.details.category = 'NOT_FOUND';
    } else if (errorMsg.includes('PERMISSION_DENIED')) {
      result.errors.push('Permission denied (key may not have Generative AI permissions)');
      result.details.category = 'PERMISSION_DENIED';
    } else if (errorMsg.includes('403')) {
      result.errors.push('Forbidden (check project billing/permissions)');
      result.details.category = 'FORBIDDEN';
    } else if (errorMsg.includes('401')) {
      result.errors.push('Unauthorized (authentication failed)');
      result.details.category = 'UNAUTHORIZED';
    } else {
      result.errors.push(`Unknown error: ${errorMsg}`);
      result.details.category = 'UNKNOWN';
    }

    return result;
  }
}

function maskKey(key) {
  if (!key || key.length < 8) return '***';
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════════╗');
  console.log('║           GEMINI API KEY VALIDATION REPORT                    ║');
  console.log('╚═══════════════════════════════════════════════════════════════╝');

  const keysString = process.env.GEMINI_API_KEY;
  
  if (!keysString) {
    console.error('\n❌ GEMINI_API_KEY not found in .env');
    process.exit(1);
  }

  const keys = keysString
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 0);

  console.log(`\nFound ${keys.length} API key(s) to validate\n`);

  // Validate all keys
  const results = [];
  for (let i = 0; i < keys.length; i++) {
    const result = await validateApiKey(keys[i], i);
    results.push(result);
    // Add delay between requests to avoid rate limiting test calls
    if (i < keys.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Print summary
  console.log('\n' + '═'.repeat(65));
  console.log('SUMMARY');
  console.log('═'.repeat(65));

  const validKeys = results.filter(r => r.valid).length;
  const invalidKeys = results.filter(r => !r.valid).length;

  console.log(`\nTotal Keys: ${results.length}`);
  console.log(`✅ Valid Keys: ${validKeys}`);
  console.log(`❌ Invalid Keys: ${invalidKeys}`);

  console.log('\nDetailed Results:');
  console.log('─'.repeat(65));

  results.forEach((result, idx) => {
    const status = result.valid ? '✅ VALID' : '❌ INVALID';
    console.log(`\nKey ${idx + 1}: ${result.key}`);
    console.log(`Status: ${status}`);
    
    if (result.errors.length > 0) {
      console.log('Errors:');
      result.errors.forEach(err => console.log(`  • ${err}`));
    }

    if (result.capabilities.length > 0) {
      console.log('Capabilities:');
      result.capabilities.forEach(cap => console.log(`  • ${cap}`));
    }

    if (Object.keys(result.details).length > 0) {
      console.log('Details:');
      Object.entries(result.details).forEach(([key, value]) => {
        if (key !== 'responseLength') {
          console.log(`  • ${key}: ${value}`);
        }
      });
    }
  });

  console.log('\n' + '═'.repeat(65));
  console.log('RECOMMENDATIONS');
  console.log('═'.repeat(65));

  if (validKeys === 0) {
    console.log('\n⚠️  No valid keys found! GenAI integration will not work.');
    console.log('\nAction items:');
    console.log('1. Visit Google Cloud Console: https://console.cloud.google.com');
    console.log('2. Create a new API key for Generative AI');
    console.log('3. Enable the Generative Language API');
    console.log('4. Ensure project has billing enabled');
    console.log('5. Update GEMINI_API_KEY in .env with the new key');
    console.log('6. Restart the backend server');
  } else if (validKeys < keys.length) {
    console.log(`\n⚠️  ${invalidKeys} out of ${keys.length} keys are invalid or rate-limited.`);
    console.log('\nAction items:');
    console.log('1. Replace invalid keys with new ones from Google Cloud Console');
    console.log('2. If rate-limited, wait 1 hour or check API quota limits');
    console.log(`3. Keep the ${validKeys} valid key(s) working as fallback`);
    console.log('4. Monitor error patterns to understand usage');
  } else {
    console.log(`\n✅ All ${keys.length} keys are valid and working!`);
    console.log('\nKey rotation is active and ready for production.');
  }

  console.log('\n' + '═'.repeat(65) + '\n');

  process.exit(validKeys > 0 ? 0 : 1);
}

main().catch(error => {
  console.error('Validator error:', error);
  process.exit(1);
});
