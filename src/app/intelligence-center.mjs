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
  return sortIntelligence(items, 'newest');
}

function timestamp(item) {
  const value = new Date(item.publishedAt || item.capturedAt || '').getTime();
  return Number.isFinite(value) && value > 0 ? value : Number.NEGATIVE_INFINITY;
}

export function sortIntelligence(items = [], sortBy = 'newest') {
  const credibilityRank = { high: 3, medium: 2, low: 1 };
  return items.map((item, index) => ({ item: normalizeIntelligenceItem(item), index })).sort((left, right) => {
    let order = 0;
    if (sortBy === 'score') order = (right.item.score ?? -1) - (left.item.score ?? -1);
    else if (sortBy === 'credibility') order = credibilityRank[right.item.credibility] - credibilityRank[left.item.credibility];
    if (!order) order = timestamp(right.item) - timestamp(left.item);
    if (!Number.isFinite(order) || !order) order = left.index - right.index;
    return order;
  }).map(({ item }) => item);
}

export function filterIntelligence(items = [], filters = {}) {
  const now = new Date(filters.now || new Date().toISOString()).getTime();
  const ageDays = { '1d': 1, '3d': 3, '7d': 7, '30d': 30 }[filters.age] || null;
  const query = String(filters.search || '').trim().toLowerCase();
  return items.map(normalizeIntelligenceItem).filter((item) => {
    if (filters.company && filters.company !== 'all' && !(item.relevantCompanies || []).includes(filters.company)) return false;
    if (filters.source && filters.source !== 'all' && item.sourceName !== filters.source) return false;
    if (filters.credibility && filters.credibility !== 'all' && item.credibility !== filters.credibility) return false;
    if (filters.status && filters.status !== 'all' && item.status !== filters.status) return false;
    if (ageDays) {
      const at = timestamp(item);
      if (!Number.isFinite(at) || at < now - ageDays * 86_400_000) return false;
    }
    if (query) {
      const haystack = [item.title, item.sourceName, item.factSummary, item.impactAnalysis, item.suggestedAction, ...(item.tags || [])].join(' ').toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
}

export function todayMustRead(items = [], { now = new Date().toISOString(), limit = 5, maxAgeDays = 3 } = {}) {
  const cutoff = new Date(now).getTime() - maxAgeDays * 86_400_000;
  return sortIntelligence(items, 'newest').filter((item) => {
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
