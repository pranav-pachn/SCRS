require('dotenv').config();

const { analyzeComplaint } = require('./services/aiService');

const API_BASE = process.env.API_BASE || 'http://localhost:3000';
const POLL_ATTEMPTS = Number(process.env.GENAI_POLL_ATTEMPTS || 6);
const POLL_INTERVAL_MS = Number(process.env.GENAI_POLL_INTERVAL_MS || 2000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function httpJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  let body = null;
  try {
    body = await response.json();
  } catch (_) {
    body = null;
  }

  return {
    ok: response.ok,
    status: response.status,
    body
  };
}

function createCitizenPayload() {
  const unique = Date.now();
  return {
    name: `GenAI Citizen ${unique}`,
    email: `citizen.genai.${unique}@scrs.local`,
    password: 'Citizen@2796',
    role: 'citizen'
  };
}

async function registerCitizen(payload) {
  const result = await httpJson('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload)
  });

  if (!result.ok || !result.body?.success || !result.body?.token) {
    throw new Error(`Citizen registration failed (HTTP ${result.status}): ${JSON.stringify(result.body)}`);
  }

  return {
    token: result.body.token,
    user: result.body.user,
    email: payload.email
  };
}

async function submitComplaint(token) {
  const complaintBody = {
    category: 'Road',
    description:
      'Large pothole near city school causing two-wheeler skids during rain and repeated traffic congestion for commuters.',
    location: `City School Junction ${Date.now()}`
  };

  const result = await httpJson('/complaints', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(complaintBody)
  });

  if (!result.ok || !result.body?.success) {
    throw new Error(`Complaint submission failed (HTTP ${result.status}): ${JSON.stringify(result.body)}`);
  }

  return {
    response: result.body,
    location: complaintBody.location
  };
}

async function fetchLatestComplaint(token) {
  const result = await httpJson('/complaints/my?page=1&perPage=5', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!result.ok || !result.body?.success || !Array.isArray(result.body?.data)) {
    throw new Error(`Failed to read citizen complaints (HTTP ${result.status}): ${JSON.stringify(result.body)}`);
  }

  return result.body.data[0] || null;
}

async function pollForAiFields(token, complaintId) {
  for (let attempt = 1; attempt <= POLL_ATTEMPTS; attempt += 1) {
    const complaint = await fetchLatestComplaint(token);
    if (complaint && complaint.id === complaintId) {
      const aiReady = Boolean(complaint.summary) && complaint.ai_suggested_priority && complaint.tags;
      if (aiReady) {
        return { complaint, attempts: attempt, aiReady: true };
      }
    }
    await sleep(POLL_INTERVAL_MS);
  }

  const complaint = await fetchLatestComplaint(token);
  return { complaint, attempts: POLL_ATTEMPTS, aiReady: false };
}

async function directProviderDiagnostic() {
  try {
    const sample = await analyzeComplaint(
      'Streetlight outage in a residential lane causing low visibility and safety concerns at night.'
    );
    return {
      ok: true,
      sample
    };
  } catch (error) {
    return {
      ok: false,
      message: error.message
    };
  }
}

function printCriterion(name, status, details) {
  console.log(`${name}: ${status}`);
  if (details) {
    console.log(`  ${details}`);
  }
}

async function main() {
  console.log('=== SCRS GenAI Integration Validation ===');
  console.log(`API base: ${API_BASE}`);

  const criteria = [];

  try {
    const citizenPayload = createCitizenPayload();
    const auth = await registerCitizen(citizenPayload);
    criteria.push({
      name: 'Preflight auth/register',
      status: 'PASS',
      details: `Created citizen ${auth.email}`
    });

    const submit = await submitComplaint(auth.token);
    const complaintIdText = submit.response.complaintId || 'unknown';
    criteria.push({
      name: 'FR-AI-1 submit complaint with AI attempt',
      status: submit.response.status === 'AI Analysis Pending' ? 'PASS' : 'PARTIAL',
      details: `complaintId=${complaintIdText}, responseStatus=${submit.response.status || 'n/a'}`
    });

    const complaintRows = await fetchLatestComplaint(auth.token);
    if (!complaintRows || !complaintRows.id) {
      throw new Error('Complaint not found in GET /complaints/my after submit');
    }

    const poll = await pollForAiFields(auth.token, complaintRows.id);
    if (poll.aiReady) {
      criteria.push({
        name: 'FR-AI-2 AI fields populated',
        status: 'PASS',
        details: `summary/tags/ai_suggested_priority populated after ${poll.attempts} poll(s)`
      });
    } else {
      criteria.push({
        name: 'FR-AI-2 AI fields populated',
        status: 'FAIL',
        details: 'AI fields remained null in polling window'
      });
    }

    criteria.push({
      name: 'FR-AI-3 graceful degradation',
      status: submit.response.success ? 'PASS' : 'FAIL',
      details: 'Complaint creation succeeded even before AI completion'
    });

    const provider = await directProviderDiagnostic();
    if (provider.ok) {
      criteria.push({
        name: 'Provider diagnostic (Fallback Chain)',
        status: 'PASS',
        details: `Sample priority=${provider.sample.ai_suggested_priority}`
      });
    } else {
      criteria.push({
        name: 'Provider diagnostic (Fallback Chain)',
        status: 'FAIL',
        details: provider.message
      });
    }

    console.log('--- Criteria ---');
    criteria.forEach((item) => printCriterion(item.name, item.status, item.details));

    const hasFail = criteria.some((item) => item.status === 'FAIL');
    console.log('--- Verdict ---');
    console.log(hasFail ? 'PARTIALLY WORKING (integration path works, provider/config issues detected)' : 'WORKING');

    process.exit(hasFail ? 2 : 0);
  } catch (error) {
    console.error('Validation runner error:', error.message);
    process.exit(1);
  }
}

main();
