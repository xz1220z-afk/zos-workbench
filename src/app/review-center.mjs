import { partitionDecisions } from './decision-center.mjs?v=2.12.0';

const REVIEW_LABELS = {
  weekly_business: '本周经营复盘', monthly_company: '本月公司复盘', life: '生活复盘',
};

export function createReviewDraft(type, model = {}) {
  if (!REVIEW_LABELS[type]) throw new Error('unsupported review type');
  const sources = model.sources || {};
  const sourceStates = Object.fromEntries(['wanjia', 'huahuo', 'lingli'].map((source) => [source, sources[source]?.state || 'pending']));
  return {
    id: `review:${type}:${model.date || new Date().toISOString().slice(0, 10)}`,
    title: `${REVIEW_LABELS[type]}｜${model.date || new Date().toISOString().slice(0, 10)}`,
    kind: 'review_draft', type, status: 'pending_review', reviewRequired: true,
    facts: {
      sourceStates,
      openDecisions: partitionDecisions(model.decisions).ceo.length,
      targetGaps: (model.gaps || []).length,
      calendarConflicts: (model.calendarConflicts || []).length,
    },
    suggestions: ['核对异常来源', '确认关键决策', '把已确认动作进入下一周期'],
    generatedAt: model.generatedAt || new Date().toISOString(),
  };
}
