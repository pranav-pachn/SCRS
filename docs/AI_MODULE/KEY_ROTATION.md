# Gemini API Key Rotation - Implementation Guide

## Overview

The SCRS backend now implements **automatic API key rotation** for Google Gemini API calls. When a key hits rate limits or becomes invalid, the system automatically switches to the next available key without blocking complaint creation.

## Features

✅ **Automatic Key Rotation** - Seamlessly rotates to the next key on rate limit (429) or invalid key (401) errors  
✅ **Key Recovery** - Automatically retries failed keys after 1 hour recovery window  
✅ **Multi-Key Support** - Supports up to 5+ API keys for load distribution  
✅ **Safe Keylogging** - API keys are masked in logs (shows only first/last 4 chars)  
✅ **Graceful Degradation** - If all keys are exhausted, system logs error but doesn't crash  
✅ **Per-Function Rotation** - Both `analyzeComplaint()` and `semanticRankKnowledgeResults()` use rotation  

## Configuration

### Setup Multiple Keys in .env

```bash
GEMINI_API_KEY=key1,key2,key3,key4,key5
```

Keys should be comma-separated without spaces. Example with real keys:

```ini
GEMINI_API_KEY=AIzaSyBgBqZkXKvBxBEl8s-dYSdyifbHfP6jqbI,AIzaSyDpvReINvMz5oFQb5v-CKjsSyN0wCUgmoY,AIzaSyDvS3pGIvP78aEYUZXpBtCiux8hYXo7-6g,AIzaSyBB2f6VckD-nu4uOp7eAUJrXhge6Zx-xbI,AIzaSyBPs8qVdunbW9fYKQI_xQB9RiYhIKrGcp8
```

## Architecture

### Files

| File | Purpose |
|------|---------|
| [`backend/services/geminiKeyRotation.js`](../../backend/services/geminiKeyRotation.js) | Key rotation manager class |
| [`backend/services/aiService.js`](../../backend/services/aiService.js) | Updated to use key rotation |
| [`backend/tests/testKeyRotation.js`](../../backend/tests/testKeyRotation.js) | Unit tests for rotation logic |

### Key Rotation Flow

```
Complaint Submission
    ↓
AI Analysis Triggered
    ↓
Get Current API Key (from rotation manager)
    ↓
Call Gemini with Key 1
    ├─ Success → Mark key as working, return result
    ├─ Rate Limit (429) → Mark key as failed, rotate to Key 2
    ├─ Invalid Key (401) → Mark key as failed, rotate to Key 2
    └─ Other Error → Throw, let aiJobService handle
    ↓
Retry with Key 2, Key 3, etc. (up to availableKeys count)
    ↓
All Keys Exhausted → Log error, return null (graceful degradation)
```

### GeminiKeyRotation Class API

#### Initialization

```javascript
const { getKeyRotation } = require('./services/geminiKeyRotation');

// Get singleton instance (auto-initializes from GEMINI_API_KEY env var)
const rotation = getKeyRotation();
```

#### Key Methods

| Method | Purpose | Returns |
|--------|---------|---------|
| `getCurrentKey()` | Get current active API key | string |
| `getStatus()` | Get rotation state (current index, failed keys, available count) | Object |
| `maskKey(key)` | Format key for safe logging | string (masked) |
| `handleError(error)` | Process error and decide if rotation needed | boolean |
| `rotateToNextKey()` | Move to next available key | boolean |
| `markCurrentKeyAsSuccess()` | Mark current key as working (clears failure flag) | void |
| `getAvailableKeyCount()` | Count of non-failed keys | number |
| `reset()` | Clear all rotation state | void |

#### Error Detection

```javascript
// Rate limit errors (429, quota exceeded, etc.)
if (rotation.isRateLimitError(error)) { }

// Invalid key errors (401, API key not valid, etc.)
if (rotation.isInvalidKeyError(error)) { }
```

## Usage Examples

### Direct Usage in Services

```javascript
const { getKeyRotation } = require('./services/geminiKeyRotation');

async function myAiFunction() {
  const keyRotation = getKeyRotation();
  
  let attempts = 0;
  while (attempts < keyRotation.getAvailableKeyCount()) {
    try {
      const apiKey = keyRotation.getCurrentKey();
      // Use apiKey for API call
      const result = await callGeminiApi(apiKey);
      
      // Success
      keyRotation.markCurrentKeyAsSuccess();
      return result;
      
    } catch (error) {
      attempts++;
      if (keyRotation.handleError(error)) {
        // Continue to next key
        continue;
      } else {
        // Not a rotation-worthy error
        throw error;
      }
    }
  }
  
  throw new Error('All API keys exhausted');
}
```

### Usage in analyzeComplaint()

The function is already integrated. It will:
1. Try current key (default: Key 0)
2. On API_KEY_INVALID or rate limit: mark as failed and try Key 1
3. Repeat until success or all keys exhausted
4. Logs show which key is being used and rotation events

### Usage in semanticRankKnowledgeResults()

Knowledge base search ranking also uses key rotation automatically.

## Monitoring & Logging

### Console Output Examples

**Successful rotation:**
```
🤖 === AI COMPLAINT ANALYSIS (Gemini) ===
   Key rotation status: {"currentIndex":0,"currentKey":"AIza...jqbI","totalKeys":5,"failedKeys":[],"availableKeys":5}
   Attempt 1/5: Using key AIza...jqbI
   ⚠️ Attempt 1 failed: API key not valid
   🔄 Rotating to next available key...
   ✅ Rotated to key 1 (AIza...gmoY)
   Attempt 2/5: Using key AIza...gmoY
   ✅ AI Analysis Complete:
      Summary: "Pothole near school"
```

**Rate limit handling:**
```
⚠️ Rate limit hit on key AIza...jqbI - rotating to next key
✅ Rotated to key 1 (AIza...gmoY)
```

**Key recovery after 1 hour:**
```
🔄 Attempting recovery of key 0 (AIza...jqbI) (failed 61 minutes ago)
```

**All keys exhausted:**
```
❌ All API keys exhausted or in cooldown
```

## Testing

### Run Key Rotation Tests

```bash
npm run test:keyrotation
```

Tests include:
- ✅ Basic key rotation initialization and cycling
- ✅ Rate limit error detection and handling
- ✅ Invalid key error detection and handling
- ✅ Multiple sequential key failures
- ✅ Success marking and recovery
- ✅ Exhausted keys handling
- ✅ Key masking for safe logging
- ✅ 1-hour recovery window logic

### Test Example Output

```
=== GEMINI KEY ROTATION TESTS ===

=== Test 1: Basic Key Rotation ===
✅ Gemini Key Rotation initialized with 5 keys
Initial state: {
  currentIndex: 0,
  currentKey: 'AIza...jqbI',
  totalKeys: 5,
  failedKeys: [],
  availableKeys: 5
}
✅ Key rotation working

=== Test 2: Rate Limit Error Handling ===
⚠️ Rate limit hit on key AIza...jqbI - rotating to next key
✅ Rotated to key 1 (AIza...gmoY)
✅ Rate limit error detection working

... (6 more tests)

=== ALL TESTS PASSED ===
```

### Run GenAI Validation with Rotation

```bash
npm run test:genai
```

This integration test will:
1. Create a citizen user
2. Submit a complaint
3. Wait for async AI processing
4. Verify AI fields populated (or logged key rotation attempts if API keys invalid)
5. Show key rotation status

## Failure Scenarios & Recovery

### Scenario 1: Key Rate Limit (429)

```
Current: Key 1 (quota hit)
→ Mark Key 1 as failed
→ Rotate to Key 2
→ Retry request with Key 2
Result: ✅ Success (if Key 2 available)
Recovery: Key 1 auto-retries after 1 hour
```

### Scenario 2: Invalid Key (401)

```
Current: Key 3 (invalid/expired)
→ Mark Key 3 as failed
→ Rotate to Key 4
Result: ✅ Success (if Key 4 available)
Recovery: Key 3 stays failed until app restart or manual reset
```

### Scenario 3: All Keys Exhausted

```
Active: 2/5 keys available
Current: Key 5 fails
→ No more keys available
→ Log error: "All API keys exhausted"
Result: ⚠️ Graceful degradation (complaint saved without AI)
Recovery: Manual inspection or wait 1 hour for recovery window
```

## Performance Impact

- **No blocking delay**: Key rotation happens asynchronously within the 5s complaint submission window
- **Cached models**: Gemini models are cached per API key to avoid reinitializing
- **Safe retry logic**: Max attempts = number of available keys (5 attempts max per complaint)

## Troubleshooting

### All Keys Show as "Failed"

**Cause**: Common error (not rate limit or invalid key) on all keys  
**Solution**: Check backend logs for actual error message; may be network/Gemini service issue

### Key Never Recovers After 1 Hour

**Cause**: Recovery logic checks timestamp; if app restarts, old timestamps may be lost  
**Solution**: Manually call `rotation.reset()` or restart backend to clear state

### Logs Show "API key not valid" Despite Fresh Keys

**Cause**: One of these:
- Keys are typo'd in .env (whitespace, missing char)
- Keys belong to different Google Cloud projects
- Keys have wrong permissions (not generative AI enabled)

**Solution**:
1. Verify .env formatting (comma-separated, no spaces)
2. Test each key manually with curl/Postman
3. Check Google Cloud project generative AI permissions

## Best Practices

1. **Rotate keys periodically** - Set up a cron job to refresh keys monthly
2. **Monitor key health** - Track "Failed Keys" count in logs
3. **Use separate projects** - Distribute keys across multiple GCP projects for resilience
4. **Set billing alerts** - Prevent rate limits on large workloads
5. **Log rotation events** - Store rotation telemetry for debugging

## Future Enhancements

- [ ] Persistent failure state (store in DB between app restarts)
- [ ] Metrics export (Prometheus/Grafana integration)
- [ ] Weighted key selection (prefer faster/more reliable keys)
- [ ] Dynamic key refresh from secure key management service
- [ ] Regional key distribution (route by geography)
