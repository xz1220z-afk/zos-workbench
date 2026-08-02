const COMPANIES = new Set(['wanjia', 'huahuo', 'lingli', 'ceo']);
const STATUSES = new Set(['candidate', 'read', 'actioned', 'ignored', 'knowledge_pending']);
const TRANSITIONS = Object.freeze({
  candidate: new Set(['read', 'actioned', 'ignored']),
  read: new Set(['actioned', 'ignored', 'knowledge_pending']),
  actioned: new Set(['knowledge_pending']),
  ignored: new Set(['read']),
  knowledge_pending: new Set(['actioned']),
});

function requiredText(value, name) {
  const text = String(value || '').trim();
  if (!text) throw new Error(`${name} is required`);
  return text;
}

function validDate(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeIntelligenceItem(input = {}) {
  const relevantCompanies = [...new Set((input.relevantCompanies || input.relevant_companies || [])
    .map((value) => String(value).toLowerCase()).filter((value) => COMPANIES.has(value)))];
  const score = Number(input.score);
  return {
    externalId: requiredText(input.externalId || input.external_id || input.id, 'externalId'),
    title: requiredText(input.title, 'title'),
    sourceName: requiredText(input.sourceName || input.source_name || '待核对来源', 'sourceName'),
    sourceUrl: String(input.sourceUrl || input.source_url || ''),
    publishedAt: validDate(input.publishedAt || input.published_at),
    capturedAt: validDate(input.capturedAt || input.captured_at) || new Date(0).toISOString(),
    credibility: ['high', 'medium', 'low'].includes(input.credibility) ? input.credibility : 'medium',
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    relevantCompanies,
    tags: [...new Set((input.tags || []).map(String).filter(Boolean))],
    factSummary: requiredText(input.factSummary || input.fact_summary, 'factSummary'),
    impactAnalysis: String(input.impactAnalysis || input.impact_analysis || ''),
    suggestedAction: String(input.suggestedAction || input.suggested_action || ''),
    status: STATUSES.has(input.status) ? input.status : 'candidate',
    sourceUpdatedAt: validDate(input.sourceUpdatedAt || input.source_updated_at),
  };
}

export function rankIntelligence(items = []) {
  return items.map(normalizeIntelligenceItem).sort((left, right) => {
    const score = (right.score ?? -1) - (left.score ?? -1);
    if (score) return score;
    return String(right.publishedAt || right.capturedAt).localeCompare(String(left.publishedAt || left.capturedAt));
  });
}

export function todayMustRead(items = [], { now = new Date().toISOString(), limit = 5, maxAgeDays = 3 } = {}) {
  const cutoff = new Date(now).getTime() - maxAgeDays * 86_400_000;
  return rankIntelligence(items).filter((item) => {
    const timestamp = new Date(item.publishedAt || item.capturedAt).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff && item.status !== 'ignored';
  }).slice(0, limit);
}

export function transitionIntelligence(item, nextStatus) {
  const current = normalizeIntelligenceItem(item);
  if (!TRANSITIONS[current.status]?.has(nextStatus)) throw new Error('invalid intelligence transition');
  return { ...current, status: nextStatus };
}

export const INTELLIGENCE_COMPANIES = Object.freeze([...COMPANIES]);

