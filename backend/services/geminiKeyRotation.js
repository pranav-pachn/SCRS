/**
 * Gemini API Key Rotation Manager
 * 
 * Handles multiple Gemini API keys with automatic rotation on rate limits/failures.
 * Tracks which keys have failed and cycles through them intelligently.
 */

class GeminiKeyRotation {
  constructor(keysString) {
    this.allKeys = (keysString || '')
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (this.allKeys.length === 0) {
      throw new Error('No Gemini API keys provided');
    }

    this.currentIndex = 0;
    this.failedKeys = new Set(); // Track indices of failed keys
    this.failureTimestamps = {}; // Track when each key failed (for recovery)
    this.FAILURE_RECOVERY_WINDOW_MS = 60 * 60 * 1000; // 1 hour - reset failed status after this

    console.log(`✅ Gemini Key Rotation initialized with ${this.allKeys.length} keys`);
  }

  /**
   * Get the current active API key
   * @returns {string} The current API key
   */
  getCurrentKey() {
    const key = this.allKeys[this.currentIndex];
    return key;
  }

  /**
   * Get detailed info about current state
   * @returns {Object} Current state info
   */
  getStatus() {
    return {
      currentIndex: this.currentIndex,
      currentKey: this.maskKey(this.allKeys[this.currentIndex]),
      totalKeys: this.allKeys.length,
      failedKeys: Array.from(this.failedKeys),
      availableKeys: this.allKeys.length - this.failedKeys.size
    };
  }

  /**
   * Mask API key for safe logging (show first and last 4 chars)
   * @param {string} key - Full API key
   * @returns {string} Masked key
   */
  maskKey(key) {
    if (!key || key.length < 8) return '***';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  }

  /**
   * Check if a failure is a rate limit error
   * @param {Error} error - The error to check
   * @returns {boolean} True if rate limit error
   */
  isRateLimitError(error) {
    const msg = error?.message || '';
    return (
      msg.includes('429') ||
      msg.includes('RESOURCE_EXHAUSTED') ||
      msg.includes('rate limit') ||
      msg.includes('quota exceeded') ||
      msg.includes('too many requests')
    );
  }

  /**
   * Check if an error is due to invalid API key
   * @param {Error} error - The error to check
   * @returns {boolean} True if invalid key error
   */
  isInvalidKeyError(error) {
    const msg = error?.message || '';
    return (
      msg.includes('API_KEY_INVALID') ||
      msg.includes('API key not valid') ||
      msg.includes('Invalid authentication') ||
      msg.includes('401') ||
      msg.includes('authentication') ||
      msg.includes('unauthorized')
    );
  }

  /**
   * Handle error and determine if key should be rotated
   * Returns true if rotation occurred, false if current key should be retried
   * @param {Error} error - The error that occurred
   * @returns {boolean} True if key was rotated
   */
  handleError(error) {
    const msg = error?.message || '';
    const currentKey = this.maskKey(this.allKeys[this.currentIndex]);

    // Rate limit: mark this key as failed temporarily
    if (this.isRateLimitError(error)) {
      console.warn(`⚠️ Rate limit hit on key ${currentKey} - rotating to next key`);
      this.failedKeys.add(this.currentIndex);
      this.failureTimestamps[this.currentIndex] = Date.now();
      return this.rotateToNextKey();
    }

    // Invalid key: permanently mark as failed for this session
    if (this.isInvalidKeyError(error)) {
      console.warn(`⚠️ Invalid API key at index ${this.currentIndex} (${currentKey}) - marking as failed`);
      this.failedKeys.add(this.currentIndex);
      this.failureTimestamps[this.currentIndex] = Date.now();
      return this.rotateToNextKey();
    }

    // Other errors: don't rotate immediately, let caller decide
    return false;
  }

  /**
   * Rotate to the next available (non-failed) key
   * @returns {boolean} True if rotation successful, false if no available keys
   */
  rotateToNextKey() {
    const startIndex = this.currentIndex;
    let attempts = 0;
    const maxAttempts = this.allKeys.length;

    while (attempts < maxAttempts) {
      this.currentIndex = (this.currentIndex + 1) % this.allKeys.length;
      attempts += 1;

      // Skip failed keys, but check if they can be recovered
      if (this.failedKeys.has(this.currentIndex)) {
        const failedAt = this.failureTimestamps[this.currentIndex] || 0;
        const timeSinceFail = Date.now() - failedAt;

        // If enough time has passed, allow recovery attempt
        if (timeSinceFail > this.FAILURE_RECOVERY_WINDOW_MS) {
          console.log(
            `🔄 Attempting recovery of key ${this.maskKey(
              this.allKeys[this.currentIndex]
            )} (failed ${Math.round(timeSinceFail / 1000 / 60)} minutes ago)`
          );
          this.failedKeys.delete(this.currentIndex);
          return true;
        }

        // Still too soon, continue to next
        continue;
      }

      // Found an available key
      console.log(`✅ Rotated to key ${this.currentIndex} (${this.maskKey(this.allKeys[this.currentIndex])})`);
      return true;
    }

    // No available keys found
    console.error('❌ All API keys exhausted or in cooldown');
    return false;
  }

  /**
   * Mark current key as successful (resets recovery window if needed)
   */
  markCurrentKeyAsSuccess() {
    if (this.failedKeys.has(this.currentIndex)) {
      console.log(`✅ Key ${this.currentIndex} recovery successful`);
      this.failedKeys.delete(this.currentIndex);
      delete this.failureTimestamps[this.currentIndex];
    }
  }

  /**
   * Get all keys that are currently available (not failed or recovered)
   * @returns {number} Count of available keys
   */
  getAvailableKeyCount() {
    return this.allKeys.length - this.failedKeys.size;
  }

  /**
   * Reset rotation state (useful for tests or manual reset)
   */
  reset() {
    this.currentIndex = 0;
    this.failedKeys.clear();
    this.failureTimestamps = {};
    console.log('🔄 Gemini key rotation state reset');
  }
}

// Singleton instance
let rotationInstance = null;

function initializeKeyRotation() {
  if (!rotationInstance) {
    const keysEnv = process.env.GEMINI_API_KEY;
    if (!keysEnv) {
      console.warn('⚠️ GEMINI_API_KEY not set in environment');
      return null;
    }
    rotationInstance = new GeminiKeyRotation(keysEnv);
  }
  return rotationInstance;
}

function getKeyRotation() {
  if (!rotationInstance) {
    return initializeKeyRotation();
  }
  return rotationInstance;
}

module.exports = {
  GeminiKeyRotation,
  initializeKeyRotation,
  getKeyRotation
};
