/**
 * Generic API key pool with rotation and cooldown support.
 */
class ApiKeyPool {
  constructor(poolName, keysCsv, options = {}) {
    this.poolName = poolName || 'provider';
    this.keys = String(keysCsv || '')
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);

    this.currentIndex = 0;
    this.cooldownMs = Number(options.cooldownMs || 60000);
    this.recoverAfterMs = Number(options.recoverAfterMs || 15 * 60 * 1000);

    this.keyState = this.keys.map(() => ({
      consecutiveFailures: 0,
      lastFailure: null,
      lastSuccess: null,
      cooldownUntil: null,
      disabled: false,
      lastErrorType: null
    }));
  }

  hasKeys() {
    return this.keys.length > 0;
  }

  maskKey(key) {
    if (!key || key.length < 8) return '***';
    return `${key.slice(0, 4)}...${key.slice(-4)}`;
  }

  _isAvailable(index) {
    const state = this.keyState[index];
    if (!state) return false;

    if (state.disabled) {
      const failedAt = state.lastFailure ? new Date(state.lastFailure).getTime() : 0;
      if (failedAt && Date.now() - failedAt > this.recoverAfterMs) {
        state.disabled = false;
      }
    }

    if (state.disabled) return false;
    if (!state.cooldownUntil) return true;
    return Date.now() >= state.cooldownUntil;
  }

  getCurrentKey() {
    if (!this.hasKeys()) return null;

    for (let i = 0; i < this.keys.length; i += 1) {
      const idx = (this.currentIndex + i) % this.keys.length;
      if (this._isAvailable(idx)) {
        this.currentIndex = idx;
        return this.keys[idx];
      }
    }

    return null;
  }

  rotateToNextKey() {
    if (!this.hasKeys()) return null;

    const start = this.currentIndex;
    for (let i = 1; i <= this.keys.length; i += 1) {
      const idx = (start + i) % this.keys.length;
      if (this._isAvailable(idx)) {
        this.currentIndex = idx;
        return this.keys[idx];
      }
    }

    return null;
  }

  markSuccess() {
    if (!this.hasKeys()) return;
    const state = this.keyState[this.currentIndex];
    state.consecutiveFailures = 0;
    state.lastSuccess = new Date().toISOString();
    state.cooldownUntil = null;
    state.disabled = false;
    state.lastErrorType = null;
  }

  handleError(errorType) {
    if (!this.hasKeys()) return false;

    const state = this.keyState[this.currentIndex];
    state.consecutiveFailures += 1;
    state.lastFailure = new Date().toISOString();
    state.lastErrorType = errorType;

    if (errorType === 'invalid_auth') {
      state.disabled = true;
    } else if (errorType === 'rate_limit' || errorType === 'quota_exceeded') {
      state.cooldownUntil = Date.now() + this.cooldownMs;
    }

    return Boolean(this.rotateToNextKey());
  }

  getAvailableKeyCount() {
    let count = 0;
    for (let i = 0; i < this.keys.length; i += 1) {
      if (this._isAvailable(i)) count += 1;
    }
    return count;
  }

  status() {
    return {
      poolName: this.poolName,
      totalKeys: this.keys.length,
      availableKeys: this.getAvailableKeyCount(),
      currentIndex: this.currentIndex,
      currentKeyMasked: this.maskKey(this.keys[this.currentIndex]),
      keys: this.keys.map((key, i) => ({
        keyMasked: this.maskKey(key),
        state: this.keyState[i]
      }))
    };
  }
}

module.exports = ApiKeyPool;
