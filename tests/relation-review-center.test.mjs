import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRelations } from '../src/app/relation-center.mjs';
import { createReviewDraft } from '../src/app/review-center.mjs';

test('relations are derived only from records that contain a real party name', () => {
  const relations = buildRelations([
    { id: 'w1', source: 'wanjia', merchantName: '黔念念', owner: '小朱', nextAction: '复核团购套餐', dueAt: '2026-08-03' },
    { id: 'h1', source: 'huahuo', clientName: '林女士', owner: '摄影组', nextAction: '确认选片' },
    { id: 'empty', source: 'lingli' },
  ]);
  assert.deepEqual(relations.map((item) => item.name), ['黔念念', '林女士']);
  assert.equal(relations[0].authority, 'business_fact');
});

test('review drafts keep facts, suggestions and confirmation state separate', () => {
  const draft = createReviewDraft('weekly_business', {
    date: '2026-08-02', sources: { wanjia: { state: 'synced' }, huahuo: { state: 'failed' } },
    decisions: [{ id: 'd1', status: 'open', decisionScope: 'ceo' }], gaps: [{ metricKey: 'wanjia.paymentGmv' }],
    calendarConflicts: [{ ids: ['a', 'b'] }],
  });
  assert.equal(draft.status, 'pending_review');
  assert.equal(draft.reviewRequired, true);
  assert.equal(draft.facts.openDecisions, 1);
  assert.match(draft.title, /经营复盘/);
});

test('review facts count only decisions that require CEO judgment', () => {
  const draft = createReviewDraft('weekly_business', {
    date: '2026-08-07',
    decisions: [
      { id: 'ceo', status: 'open', category: 'revenue_pending', factSummary: '待回款' },
      { id: 'follow', status: 'open', category: 'stale', factSummary: '超过 7 天未更新' },
      { id: 'history', status: 'pending_resolution', decisionNote: '来源风险已消失' },
    ],
  });
  assert.equal(draft.facts.openDecisions, 1);
});
