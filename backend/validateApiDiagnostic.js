require('dotenv').config();

const {
  analyzeComplaint,
  getAiProviderHealthStatus,
  runAiProviderHealthCheck,
  hasConfiguredProviders
} = require('./services/aiService');

function printHeader() {
  console.log('\n==============================================');
  console.log('SCRS AI PROVIDER DIAGNOSTIC REPORT');
  console.log('Priority: Groq -> OpenRouter -> OpenAI');
  console.log('==============================================\n');
}

function printProviderSummary(health) {
  const providers = health?.providers || {};

  console.log('Provider Health Snapshot:');
  Object.entries(providers).forEach(([key, info]) => {
    const configured = info?.configured ? 'yes' : 'no';
    const state = info?.health?.state || 'unknown';
    const model = info?.model || 'n/a';
    const availableKeys = info?.keyPool?.availableKeys ?? 0;
    const totalKeys = info?.keyPool?.totalKeys ?? 0;

    console.log(`- ${key}: configured=${configured}, state=${state}, model=${model}, keys=${availableKeys}/${totalKeys}`);

    const lastError = info?.health?.lastError;
    if (lastError) {
      console.log(`  lastError: ${String(lastError).slice(0, 220)}`);
    }
  });

  console.log('');
}

async function runAnalyzeProbe() {
  try {
    const output = await analyzeComplaint(
      'Streetlight outage near a school entrance causing low visibility and safety concerns for pedestrians at night.'
    );

    return {
      ok: true,
      output
    };
  } catch (error) {
    return {
      ok: false,
      error: error?.message || String(error)
    };
  }
}

async function main() {
  printHeader();

  if (!hasConfiguredProviders()) {
    console.error('No providers configured. Set GROQ_API_KEYS and/or OPENROUTER_API_KEYS and/or OPENAI_API_KEYS.');
    process.exit(1);
  }

  const preCheck = getAiProviderHealthStatus();
  printProviderSummary(preCheck);

  console.log('Running live provider health checks...\n');
  const report = await runAiProviderHealthCheck();
  const results = report?.providers || {};

  Object.entries(results).forEach(([provider, info]) => {
    const status = info.ok ? 'OK' : 'FAIL';
    const model = info.model || 'n/a';
    const keyMasked = info.keyMasked || 'n/a';
    const reason = info.reason || '';

    console.log(`${provider}: ${status} | model=${model} | key=${keyMasked}${reason ? ` | reason=${reason}` : ''}`);
  });

  console.log('\nRunning analyzeComplaint probe through fallback chain...\n');
  const probe = await runAnalyzeProbe();

  if (probe.ok) {
    console.log('analyzeComplaint: OK');
    console.log(`summary: ${probe.output.summary}`);
    console.log(`tags: ${(probe.output.tags || []).join(', ')}`);
    console.log(`ai_suggested_priority: ${probe.output.ai_suggested_priority}`);
  } else {
    console.log('analyzeComplaint: FAIL');
    console.log(`reason: ${probe.error}`);
  }

  const postCheck = getAiProviderHealthStatus();
  console.log('\nUpdated provider health snapshot:');
  printProviderSummary(postCheck);

  const anyProviderOk = Object.values(results).some((r) => r?.ok);
  const finalOk = anyProviderOk || probe.ok;

  console.log(finalOk ? 'DIAGNOSTIC RESULT: PARTIAL/OK (at least one provider path is working)' : 'DIAGNOSTIC RESULT: FAIL (no provider path working)');
  process.exit(finalOk ? 0 : 1);
}

main().catch((error) => {
  console.error('Diagnostic runner error:', error?.message || error);
  process.exit(1);
});
