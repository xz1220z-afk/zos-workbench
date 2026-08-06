export const CONTENT_STAGES = Object.freeze([
  'idea', 'evaluating', 'planned', 'producing', 'review', 'published', 'reviewed', 'reusable',
]);

const STAGE_LABELS = Object.freeze({
  idea: '选题池', evaluating: '评估中', planned: '已排期', producing: '制作中',
  review: '待审核', published: '已发布', reviewed: '已复盘', reusable: '可复用',
});

function text(value) {
  return String(value ?? '').trim();
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function normalizeContentItem(input = {}) {
  const stage = CONTENT_STAGES.includes(input.stage) ? input.stage : 'idea';
  return {
    ...input,
    title: text(input.title) || '未命名内容',
    company: text(input.company) || 'personal',
    platform: text(input.platform) || 'douyin',
    stage,
    stageLabel: STAGE_LABELS[stage],
    owner: text(input.owner) || '朱帅',
    dueAt: input.dueAt || null,
    publishedAt: input.publishedAt || null,
    sourceRefs: Array.isArray(input.sourceRefs) ? input.sourceRefs.filter(Boolean) : [],
    variants: Array.isArray(input.variants)
      ? input.variants.map((variant) => ({ ...variant, platform: text(variant.platform) || text(input.platform) || 'douyin' }))
      : [],
    metrics: {
      views: number(input.metrics?.views),
      interactions: number(input.metrics?.interactions),
      leads: number(input.metrics?.leads),
      revenue: number(input.metrics?.revenue),
    },
  };
}

export function transitionContent(input, nextStage, options = {}) {
  const item = normalizeContentItem(input);
  if (!CONTENT_STAGES.includes(nextStage)) throw new Error('invalid_content_stage');
  if (nextStage === 'published' && !options.approved) throw new Error('approval_required');
  const currentIndex = CONTENT_STAGES.indexOf(item.stage);
  const nextIndex = CONTENT_STAGES.indexOf(nextStage);
  if (Math.abs(nextIndex - currentIndex) > 1) throw new Error('invalid_stage_transition');
  return {
    ...item,
    stage: nextStage,
    stageLabel: STAGE_LABELS[nextStage],
    ...(nextStage === 'published' ? { publishedAt: options.now || new Date().toISOString() } : {}),
  };
}

export function contentOverview(items = []) {
  const normalized = items.map(normalizeContentItem);
  return CONTENT_STAGES.reduce((summary, stage) => {
    summary[stage] = normalized.filter((item) => item.stage === stage).length;
    return summary;
  }, { total: normalized.length });
}

export function contentPerformance(items = []) {
  const published = items.map(normalizeContentItem).filter((item) => ['published', 'reviewed', 'reusable'].includes(item.stage));
  const result = published.reduce((summary, item) => ({
    published: summary.published + 1,
    views: summary.views + item.metrics.views,
    interactions: summary.interactions + item.metrics.interactions,
    leads: summary.leads + item.metrics.leads,
    revenue: summary.revenue + item.metrics.revenue,
  }), { published: 0, views: 0, interactions: 0, leads: 0, revenue: 0 });
  return {
    ...result,
    conversionRate: result.views > 0 ? Number(((result.leads / result.views) * 100).toFixed(2)) : null,
  };
}

export function evaluateExperiment(experiment = {}) {
  const variants = Array.isArray(experiment.variants) ? experiment.variants : [];
  const ranked = variants
    .filter((variant) => Number.isFinite(Number(variant.metric)))
    .slice()
    .sort((left, right) => Number(right.metric) - Number(left.metric));
  return {
    ...experiment,
    winnerId: ranked[0]?.id || null,
    status: ranked.length > 1 ? 'evaluated' : 'insufficient_data',
  };
}

export function buildCompoundCandidate(content = {}, options = {}) {
  if (!content.id) throw new Error('source_content_required');
  return {
    title: text(options.title) || `${text(content.title) || '内容'} · 复利候选`,
    type: text(options.type) || 'case',
    status: 'pending_review',
    sourceContentId: content.id,
    sourceRefs: Array.isArray(content.sourceRefs) ? content.sourceRefs.slice() : [],
    suggestedUse: text(options.suggestedUse),
  };
}

export const CONTENT_STAGE_LABELS = STAGE_LABELS;
