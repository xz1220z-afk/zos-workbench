function text(value) {
  return String(value ?? '').trim();
}

function hasEvidence(item) {
  return Boolean(text(item.platform) && text(item.sourceUrl) && text(item.capturedAt));
}

export function routeInsightCompany(item = {}) {
  const corpus = `${text(item.claim)} ${text(item.topic)} ${text(item.category)} ${text(item.platform)}`.toLowerCase();
  if (/婚礼|婚庆|影像|摄影|旅拍|跟拍/.test(corpus)) return 'huahuo';
  if (/教育|课程|培训|招生|学习/.test(corpus)) return 'lingli';
  if (/商家|团购|探店|本地生活|抖音|门店|gmv/.test(corpus)) return 'wanjia';
  return 'personal';
}

export function normalizeSocialInsight(input = {}) {
  const sourced = hasEvidence(input);
  const normalized = {
    ...input,
    claim: text(input.claim) || '待命名洞察',
    platform: text(input.platform),
    sourceUrl: text(input.sourceUrl),
    capturedAt: text(input.capturedAt),
    score: Math.max(0, Math.min(100, Number(input.score) || 0)),
    status: sourced ? 'observed' : 'pending_evidence',
  };
  return { ...normalized, company: text(input.company) || routeInsightCompany(normalized) };
}

export function rankSocialOpportunities(items = []) {
  return items.map(normalizeSocialInsight).sort((left, right) => {
    const evidenceDelta = Number(hasEvidence(right)) - Number(hasEvidence(left));
    return evidenceDelta || right.score - left.score;
  });
}
