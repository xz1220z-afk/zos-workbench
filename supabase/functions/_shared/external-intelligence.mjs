const AIHOT_ORIGIN = 'https://aihot.virxact.com';
const AIHOT_USER_AGENT = 'Mozilla/5.0 (compatible; ZOS-CEO-OS/1.6; +private-intelligence-candidate-sync)';
const COMPANY_RULES = Object.freeze([
  ['wanjia', /本地生活|抖音|团购|商家|门店|电商|营销|探店/i],
  ['huahuo', /影像|摄影|视频|剪辑|婚礼|相机|图像|生成视频/i],
  ['lingli', /教育|培训|招生|课程|学生|学员|教培/i],
]);

function iso(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function text(value) {
  return typeof value === 'string' ? value.trim() : '';
}

export class ExternalIntelligenceError extends Error {
  constructor(code = 'external_intelligence_failed') {
    super(code);
    this.code = code;
  }
}

export function buildAihotUrl(now = new Date().toISOString(), { limit = 50, windowHours = 24 } = {}) {
  const anchor = new Date(now);
  if (Number.isNaN(anchor.getTime())) throw new ExternalIntelligenceError('invalid_intelligence_window');
  const safeLimit = Math.max(1, Math.min(100, Number(limit) || 50));
  const safeHours = Math.max(1, Math.min(168, Number(windowHours) || 24));
  const url = new URL('/api/public/items', AIHOT_ORIGIN);
  url.searchParams.set('mode', 'selected');
  url.searchParams.set('since', new Date(anchor.getTime() - safeHours * 3_600_000).toISOString());
  url.searchParams.set('take', String(safeLimit));
  return url.toString();
}

export function classifyIntelligenceCompanies(input = '') {
  const combined = String(input);
  return ['ceo', ...COMPANY_RULES.filter(([, pattern]) => pattern.test(combined)).map(([company]) => company)];
}

export function mapAihotItem(item = {}, { capturedAt = new Date().toISOString() } = {}) {
  const id = text(item.id);
  const title = text(item.title);
  const summary = text(item.summary);
  const sourceName = text(item.source);
  const sourceUrl = text(item.permalink) || text(item.url);
  if (!id || !title || !summary || !sourceName || !sourceUrl || item.selected !== true) return null;
  const publishedAt = iso(item.publishedAt);
  const score = Number(item.score);
  const category = text(item.category);
  return {
    external_id: `aihot:${id}`,
    title,
    source_name: sourceName,
    source_url: sourceUrl,
    published_at: publishedAt,
    captured_at: iso(item.discoveredAt) || iso(capturedAt) || new Date(0).toISOString(),
    credibility: 'medium',
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, score)) : null,
    relevant_companies: classifyIntelligenceCompanies(`${title}\n${summary}`),
    tags: [category, 'AI HOT'].filter(Boolean),
    fact_summary: summary,
    impact_analysis: null,
    suggested_action: null,
    status: 'candidate',
    source_updated_at: publishedAt,
  };
}

export async function readAihotSource({ fetchImpl = fetch, now = new Date().toISOString(), limit = 50 } = {}) {
  let response;
  try {
    response = await fetchImpl(buildAihotUrl(now, { limit }), {
      headers: { Accept: 'application/json', 'User-Agent': AIHOT_USER_AGENT },
    });
  } catch {
    throw new ExternalIntelligenceError('aihot_request_failed');
  }
  if (!response?.ok) throw new ExternalIntelligenceError('aihot_read_failed');
  let payload;
  try { payload = await response.json(); }
  catch { throw new ExternalIntelligenceError('aihot_contract_invalid'); }
  if (!Array.isArray(payload?.items)) throw new ExternalIntelligenceError('aihot_contract_invalid');
  const unique = new Map();
  for (const item of payload.items) {
    const mapped = mapAihotItem(item, { capturedAt: now });
    if (mapped && !unique.has(mapped.external_id)) unique.set(mapped.external_id, mapped);
  }
  return [...unique.values()];
}
