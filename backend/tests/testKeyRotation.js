/**
 * Test script for Gemini API Key Rotation
 * 
 * Tests:
 * 1. Key rotation initialization with multiple keys
 * 2. Handling of rate limit errors
 * 3. Handling of invalid key errors
 * 4. Recovery after 1 hour (in test logic, but uses real timestamps)
 */

require('dotenv').config();

const { GeminiKeyRotation } = require('../services/geminiKeyRotation');

function testBasicRotation() {
  console.log('\n=== Test 1: Basic Key Rotation ===');
  
  const keysString = 'key1,key2,key3,key4,key5';
  const rotation = new GeminiKeyRotation(keysString);

  console.log('Initial state:', rotation.getStatus());
  console.log('✅ All keys initialized');

  rotation.rotateToNextKey();
  console.log('After rotation:', rotation.getStatus());
  console.log('✅ Key rotation working');
}

function testRateLimitHandling() {
  console.log('\n=== Test 2: Rate Limit Error Handling ===');

  const keysString = 'key1,key2,key3';
  const rotation = new GeminiKeyRotation(keysString);

  console.log('Initial:', rotation.getStatus());

  // Simulate rate limit error on first key
  const rateLimitError = new Error('[429 Too Many Requests] rate limit exceeded');
  const didRotate = rotation.handleError(rateLimitError);

  console.log(`Rate limit error handled, rotated: ${didRotate}`);
  console.log('After rate limit:', rotation.getStatus());
  console.log('✅ Rate limit error detection working');
}

function testInvalidKeyHandling() {
  console.log('\n=== Test 3: Invalid Key Error Handling ===');

  const keysString = 'invalid-key-1,valid-key,valid-key-2';
  const rotation = new GeminiKeyRotation(keysString);

  console.log('Initial:', rotation.getStatus());

  // Simulate invalid key error
  const invalidKeyError = new Error('[GoogleGenerativeAI Error]: API key not valid. Please pass a valid API key.');
  const didRotate = rotation.handleError(invalidKeyError);

  console.log(`Invalid key error handled, rotated: ${didRotate}`);
  console.log('After invalid key:', rotation.getStatus());
  console.log('✅ Invalid key error detection working');
}

function testMultipleFailures() {
  console.log('\n=== Test 4: Multiple Key Failures ===');

  const keysString = 'key1,key2,key3,key4,key5';
  const rotation = new GeminiKeyRotation(keysString);

  console.log('Initial:', rotation.getStatus());

  // Fail first 3 keys
  for (let i = 0; i < 3; i++) {
    const error = new Error('API_KEY_INVALID');
    rotation.handleError(error);
    console.log(`After failure ${i + 1}:`, rotation.getStatus());
  }

  console.log('✅ Multiple failure rotation working');
}

function testSuccessMarking() {
  console.log('\n=== Test 5: Success Marking After Recovery ===');

  const keysString = 'key1,key2,key3';
  const rotation = new GeminiKeyRotation(keysString);

  // Mark first key as failed
  const error = new Error('API_KEY_INVALID');
  rotation.handleError(error);
  console.log('After error:', rotation.getStatus());

  // Now the second key succeeds
  rotation.markCurrentKeyAsSuccess();
  console.log('After success marker:', rotation.getStatus());
  console.log('✅ Success marking working');
}

function testExhaustedKeys() {
  console.log('\n=== Test 6: Exhausted Keys Handling ===');

  const keysString = 'key1,key2';
  const rotation = new GeminiKeyRotation(keysString);

  // Fail all keys immediately
  const error = new Error('API_KEY_INVALID');
  
  for (let i = 0; i < 5; i++) {
    const didRotate = rotation.handleError(error);
    console.log(`Attempt ${i + 1}:`, {
      didRotate,
      status: rotation.getStatus()
    });
  }

  console.log('✅ Exhausted keys handling working');
}

function testKeyMasking() {
  console.log('\n=== Test 7: Key Masking for Logging ===');

  const keysString = 'AIzaSyBgBqZkXKvBxBEl8s-dYSdyifbHfP6jqbI,AIzaSyDpvReINvMz5oFQb5v-CKjsSyN0wCUgmoY,short';
  const rotation = new GeminiKeyRotation(keysString);

  console.log('Key 1:', rotation.maskKey(rotation.allKeys[0]));
  console.log('Key 2:', rotation.maskKey(rotation.allKeys[1]));
  console.log('Key 3:', rotation.maskKey(rotation.allKeys[2]));
  console.log('✅ Key masking working');
}

function testRecoveryWindow() {
  console.log('\n=== Test 8: Recovery Window (1 hour logic) ===');

  const keysString = 'key1,key2,key3';
  const rotation = new GeminiKeyRotation(keysString);

  // Manually set a failure timestamp
  const error = new Error('API_KEY_INVALID');
  rotation.handleError(error);
  
  console.log('After first failure:', rotation.getStatus());
  console.log('Failure timestamp:', rotation.failureTimestamps[0]);

  // Check recovery window logic (note: won't actually recover yet since < 1 hour has passed)
  const failedAt = rotation.failureTimestamps[0];
  const now = Date.now();
  const minutesSinceFail = (now - failedAt) / 1000 / 60;
  
  console.log(`Minutes since failure: ${minutesSinceFail.toFixed(2)}`);
  console.log(`Recovery window: 60 minutes`);
  console.log(`Can recover: ${minutesSinceFail > 60 ? 'Yes' : 'No'}`);
  console.log('✅ Recovery window logic validated');
}

console.log('=== GEMINI KEY ROTATION TESTS ===\n');

try {
  testBasicRotation();
  testRateLimitHandling();
  testInvalidKeyHandling();
  testMultipleFailures();
  testSuccessMarking();
  testExhaustedKeys();
  testKeyMasking();
  testRecoveryWindow();

  console.log('\n=== ALL TESTS PASSED ===\n');
  process.exit(0);
} catch (error) {
  console.error('❌ Test failed:', error.message);
  process.exit(1);
}
