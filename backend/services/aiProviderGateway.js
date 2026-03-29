const ApiKeyPool = require('./apiKeyPool');

const PROVIDER_ORDER = ['groq', 'openrouter', 'openai'];

const PROVIDER_CONFIG = {
  groq: {
    name: 'Groq',
    keysEnv: 'GROQ_API_KEYS',
    legacyKeyEnv: 'GROQ_API_KEY',
    modelEnv: 'GROQ_MODEL',
    defaultModel: 'llama-3.3-70b-versatile',
    endpoint: 'https://api.groq.com/openai/v1/chat/completions'
  },
  openrouter: {
    name: 'OpenRouter',
    keysEnv: 'OPENROUTER_API_KEYS',
    legacyKeyEnv: 'OPENROUTER_API_KEY',
    modelEnv: 'OPENROUTER_MODEL',
    defaultModel: 'openai/gpt-4o-mini',
    endpoint: 'https://openrouter.ai/api/v1/chat/completions'
  },
  openai: {
    name: 'OpenAI',
    keysEnv: 'OPENAI_API_KEYS',
    legacyKeyEnv: 'OPENAI_API_KEY',
    modelEnv: 'OPENAI_MODEL',
    defaultModel: 'gpt-4o-mini',
    endpoint: 'https://api.openai.com/v1/chat/completions'
  }
};

class AiProviderGateway {
  constructor() {
    this.providerCooldownMs = Number(process.env.AI_PROVIDER_COOLDOWN_MS || 60000);
    this.timeoutMs = Number(process.env.AI_PROVIDER_TIMEOUT_MS || 15000);

    this.providers = {};
    for (const key of PROVIDER_ORDER) {
      const cfg = PROVIDER_CONFIG[key];
      const keysCsv = process.env[cfg.keysEnv] || process.env[cfg.legacyKeyEnv] || '';
      const model = process.env[cfg.modelEnv] || cfg.defaultModel;

      this.providers[key] = {
        key,
        cfg,
        model,
        pool: new ApiKeyPool(cfg.name, keysCsv, {
          cooldownMs: Number(process.env.AI_KEY_COOLDOWN_MS || 60000),
          recoverAfterMs: Number(process.env.AI_KEY_RECOVER_AFTER_MS || 15 * 60 * 1000)
        }),
        health: {
          state: 'unknown',
          consecutiveFailures: 0,
          lastSuccess: null,
          lastFailure: null,
          lastError: null,
          cooldownUntil: null
        }
      };
    }
  }

  hasConfiguredProviders() {
    return PROVIDER_ORDER.some((p) => this.providers[p].pool.hasKeys());
  }

  _providerReady(provider) {
    if (!provider.pool.hasKeys()) return false;
    const cd = provider.health.cooldownUntil;
    return !cd || Date.now() >= cd;
  }

  _markProviderSuccess(provider, providerKeyMasked) {
    provider.health.state = provider.health.consecutiveFailures > 0 ? 'degraded' : 'healthy';
    provider.health.consecutiveFailures = 0;
    provider.health.lastSuccess = new Date().toISOString();
    provider.health.lastError = null;
    provider.health.cooldownUntil = null;
    provider.pool.markSuccess();
    if (providerKeyMasked) {
      console.log(`   ✅ Provider ${provider.cfg.name} success on key ${providerKeyMasked}`);
    }
  }

  _markProviderFailure(provider, error, errorType, providerKeyMasked) {
    provider.health.consecutiveFailures += 1;
    provider.health.lastFailure = new Date().toISOString();
    provider.health.lastError = String(error?.message || error);

    if (provider.health.consecutiveFailures >= 3) {
      provider.health.state = 'down';
      provider.health.cooldownUntil = Date.now() + this.providerCooldownMs;
    } else {
      provider.health.state = 'degraded';
    }

    if (providerKeyMasked) {
      console.warn(`   ⚠️ Provider ${provider.cfg.name} failed on key ${providerKeyMasked} (${errorType})`);
    }
  }

  _extractErrorType(status, bodyText) {
    const text = String(bodyText || '').toLowerCase();
    if (status === 401 || status === 403 || text.includes('invalid api key') || text.includes('unauthorized')) {
      return 'invalid_auth';
    }
    if (status === 429 && text.includes('quota')) {
      return 'quota_exceeded';
    }
    if (status === 429 || text.includes('rate limit') || text.includes('too many requests')) {
      return 'rate_limit';
    }
    if (status >= 500) {
      return 'provider_error';
    }
    return 'other';
  }

  async _callProviderOnce(provider, messages, options) {
    const apiKey = provider.pool.getCurrentKey();
    if (!apiKey) {
      throw new Error(`${provider.cfg.name}: no available API keys`);
    }

    const masked = provider.pool.maskKey(apiKey);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      const headers = {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      };

      if (provider.key === 'openrouter') {
        if (process.env.OPENROUTER_SITE_URL) {
          headers['HTTP-Referer'] = process.env.OPENROUTER_SITE_URL;
        }
        if (process.env.OPENROUTER_APP_NAME) {
          headers['X-Title'] = process.env.OPENROUTER_APP_NAME;
        }
      }

      const payload = {
        model: options.modelOverride || provider.model,
        messages,
        temperature: Number(options.temperature ?? 0.2),
        max_tokens: Number(options.maxTokens ?? 500)
      };

      const response = await fetch(provider.cfg.endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      const text = await response.text();

      if (!response.ok) {
        const type = this._extractErrorType(response.status, text);
        const err = new Error(`${provider.cfg.name} ${response.status}: ${text.slice(0, 300)}`);
        err.errorType = type;
        err.status = response.status;
        err.provider = provider.key;
        err.keyMasked = masked;
        throw err;
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (_) {
        throw new Error(`${provider.cfg.name}: invalid JSON response`);
      }

      const content = parsed?.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error(`${provider.cfg.name}: response missing choices[0].message.content`);
      }

      this._markProviderSuccess(provider, masked);
      return {
        provider: provider.key,
        keyMasked: masked,
        model: payload.model,
        content,
        raw: parsed
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`${provider.cfg.name}: request timeout`);
        timeoutError.errorType = 'timeout';
        timeoutError.provider = provider.key;
        timeoutError.keyMasked = masked;
        throw timeoutError;
      }
      if (!error.errorType) {
        error.errorType = 'other';
        error.provider = provider.key;
        error.keyMasked = masked;
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async _callProviderWithRotation(provider, messages, options = {}) {
    const attempts = Math.max(1, provider.pool.getAvailableKeyCount());
    let lastError = null;

    for (let i = 0; i < attempts; i += 1) {
      try {
        return await this._callProviderOnce(provider, messages, options);
      } catch (error) {
        lastError = error;
        const errorType = error.errorType || 'other';

        this._markProviderFailure(provider, error, errorType, error.keyMasked);

        const rotated = provider.pool.handleError(errorType);
        if (!rotated) {
          break;
        }
      }
    }

    throw lastError || new Error(`${provider.cfg.name}: all keys exhausted`);
  }

  async callAiWithFallback(messages, options = {}) {
    if (!this.hasConfiguredProviders()) {
      throw new Error('No AI providers configured. Add GROQ_API_KEYS or OPENROUTER_API_KEYS or OPENAI_API_KEYS.');
    }

    let lastError = null;

    for (const key of PROVIDER_ORDER) {
      const provider = this.providers[key];
      if (!this._providerReady(provider)) {
        continue;
      }

      try {
        return await this._callProviderWithRotation(provider, messages, options);
      } catch (error) {
        lastError = error;
        console.warn(`⚠️ Provider fallback: ${provider.cfg.name} unavailable, trying next provider...`);
      }
    }

    throw lastError || new Error('All configured AI providers failed');
  }

  getProviderHealthStatus() {
    const out = {
      priorityOrder: [...PROVIDER_ORDER],
      providers: {}
    };

    for (const key of PROVIDER_ORDER) {
      const provider = this.providers[key];
      out.providers[key] = {
        provider: provider.cfg.name,
        model: provider.model,
        configured: provider.pool.hasKeys(),
        health: provider.health,
        keyPool: provider.pool.status()
      };
    }

    return out;
  }

  async runProviderHealthCheck() {
    const probeMessages = [
      { role: 'system', content: 'Return only the text OK.' },
      { role: 'user', content: 'Health check' }
    ];

    const report = { checkedAt: new Date().toISOString(), providers: {} };

    for (const key of PROVIDER_ORDER) {
      const provider = this.providers[key];
      if (!provider.pool.hasKeys()) {
        report.providers[key] = { configured: false, ok: false, reason: 'no_keys' };
        continue;
      }

      try {
        const res = await this._callProviderWithRotation(provider, probeMessages, {
          temperature: 0,
          maxTokens: 16
        });
        report.providers[key] = {
          configured: true,
          ok: true,
          provider: res.provider,
          model: res.model,
          keyMasked: res.keyMasked
        };
      } catch (error) {
        report.providers[key] = {
          configured: true,
          ok: false,
          reason: String(error.message || error)
        };
      }
    }

    return report;
  }
}

let singleton = null;

function getGateway() {
  if (!singleton) singleton = new AiProviderGateway();
  return singleton;
}

module.exports = {
  getGateway,
  callAiWithFallback: (...args) => getGateway().callAiWithFallback(...args),
  getProviderHealthStatus: () => getGateway().getProviderHealthStatus(),
  runProviderHealthCheck: () => getGateway().runProviderHealthCheck(),
  hasConfiguredProviders: () => getGateway().hasConfiguredProviders()
};
