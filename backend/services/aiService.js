const {
  callAiWithFallback,
  getProviderHealthStatus,
  runProviderHealthCheck,
  hasConfiguredProviders
} = require('./aiProviderGateway');

/**
 * AI Complaint Intelligence Module with provider fallback.
 * Priority order: Groq -> OpenRouter -> OpenAI.
 */

/**
 * System prompt for structured JSON output
 */
const SYSTEM_PROMPT = `You are an AI assistant helping a civic complaint management system.
Your task is to analyze citizen complaints and respond ONLY in valid JSON format.

Return JSON in this exact format (no additional text, ONLY this JSON):
{
  "summary": "short 1-2 line summary",
  "tags": ["tag1", "tag2", "tag3"],
  "ai_suggested_priority": "Low | Medium | High | Critical"
}

Rules:
- Summary must be concise (max 2 lines).
- Tags must be 3-5 meaningful civic issue keywords.
- Suggested priority should consider severity, urgency, and impact.
- Do NOT include explanations or any text outside the JSON.
- Output ONLY valid JSON, nothing else.`;

/**
 * Parse a JSON object from model text output.
 */
function parseJsonFromModelText(text, contextLabel) {
  if (!text || typeof text !== 'string') {
    throw new Error(`${contextLabel}: empty response from provider`);
  }

  try {
    return JSON.parse(text);
  } catch (_) {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error(`${contextLabel}: could not parse JSON from provider response`);
    }
    return JSON.parse(jsonMatch[0]);
  }
}

/**
 * Analyzes a complaint description using AI with provider fallback.
 * 
 * @param {string} description - The complaint description text
 * @returns {Promise<{summary: string, tags: string[], ai_suggested_priority: string}>}
 * @throws {Error} If all configured providers fail
 */
async function analyzeComplaint(description) {
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    throw new Error('Invalid complaint description provided');
  }

  if (!hasConfiguredProviders()) {
    throw new Error('No AI providers configured. Set GROQ_API_KEYS or OPENROUTER_API_KEYS or OPENAI_API_KEYS.');
  }

  console.log('\n🤖 === AI COMPLAINT ANALYSIS (Provider Fallback) ===');
  console.log('   Priority: Groq -> OpenRouter -> OpenAI');

  const messages = [
    { role: 'system', content: SYSTEM_PROMPT },
    { role: 'user', content: `Complaint: ${description.trim()}` }
  ];

  const completion = await callAiWithFallback(messages, {
    temperature: 0.2,
    maxTokens: 500
  });

  const aiData = parseJsonFromModelText(completion.content, 'Complaint analysis');

  if (!aiData.summary || !Array.isArray(aiData.tags) || !aiData.ai_suggested_priority) {
    throw new Error('Provider response missing required fields');
  }

  const validPriorities = ['Low', 'Medium', 'High', 'Critical'];
  if (!validPriorities.includes(aiData.ai_suggested_priority)) {
    console.warn(`⚠️ Invalid priority "${aiData.ai_suggested_priority}", defaulting to "Medium"`);
    aiData.ai_suggested_priority = 'Medium';
  }

  if (!Array.isArray(aiData.tags)) {
    aiData.tags = [];
  }
  aiData.tags = aiData.tags.slice(0, 5).filter((tag) => typeof tag === 'string' && tag.trim().length > 0);

  console.log(`   ✅ Provider: ${completion.provider}`);
  console.log(`   ✅ Model: ${completion.model}`);
  console.log(`   ✅ AI Analysis Complete`);
  console.log('=== AI COMPLAINT ANALYSIS END ===\n');

  return {
    summary: String(aiData.summary).trim(),
    tags: aiData.tags.map((tag) => tag.trim()),
    ai_suggested_priority: aiData.ai_suggested_priority
  };
}

/**
 * Semantic reranking for knowledge base search results with provider fallback.
 */
async function semanticRankKnowledgeResults(query, candidates, limit = 10) {
  if (!hasConfiguredProviders()) {
    throw new Error('No AI providers configured');
  }

  const safeQuery = String(query || '').trim();
  const safeCandidates = Array.isArray(candidates) ? candidates.slice(0, 20) : [];
  const safeLimit = Math.max(1, Math.min(Number(limit) || 10, 50));

  if (!safeQuery || safeCandidates.length === 0) {
    return [];
  }

  const compactCandidates = safeCandidates.map((candidate) => ({
    id: candidate.id,
    title: candidate.title,
    snippet: candidate.snippet,
    type: candidate.type,
    keywords: Array.isArray(candidate.keywords) ? candidate.keywords.slice(0, 8) : []
  }));

  const prompt = `You are ranking civic knowledge base search results.
Given the query and candidate items, return ONLY valid JSON:
{"ranked_ids":["id1","id2",...]}.
Rules:
- Include only ids from the candidates provided.
- Rank from most relevant to least relevant.
- Do not include explanations or markdown.

Query: ${safeQuery}
Candidates: ${JSON.stringify(compactCandidates)}`;

  const messages = [
    {
      role: 'system',
      content: 'You are a civic knowledge ranking assistant. Return only strict JSON.'
    },
    { role: 'user', content: prompt }
  ];

  const completion = await callAiWithFallback(messages, {
    temperature: 0,
    maxTokens: 500
  });

  const parsed = parseJsonFromModelText(completion.content, 'Knowledge rerank');

  const rankedIds = Array.isArray(parsed.ranked_ids) ? parsed.ranked_ids.map(String) : [];
  const byId = new Map(safeCandidates.map((candidate) => [String(candidate.id), candidate]));

  const ranked = [];
  rankedIds.forEach((id, index) => {
    const item = byId.get(id);
    if (item) {
      ranked.push({
        ...item,
        score: Number((1 - (index / Math.max(1, rankedIds.length))).toFixed(4)),
        ai_ranked: true
      });
      byId.delete(id);
    }
  });

  const remaining = Array.from(byId.values()).sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
  return ranked.concat(remaining).slice(0, safeLimit);
}

module.exports = {
  analyzeComplaint,
  semanticRankKnowledgeResults,
  getAiProviderHealthStatus: getProviderHealthStatus,
  runAiProviderHealthCheck: runProviderHealthCheck,
  hasConfiguredProviders
};
