import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CONTENT_STAGES, buildCompoundCandidate, contentOverview, contentPerformance,
  evaluateExperiment, normalizeContentItem, transitionContent,
} from '../src/app/content-growth.mjs';

test('content items normalize company platform variants and approved lifecycle', () => {
  const item = normalizeContentItem({ title: '阳西商家选题', company: 'wanjia', platform: 'douyin', variants: [{ platform: 'xiaohongshu', title: '笔记版' }] });
  assert.equal(item.stage, 'idea');
  assert.equal(item.variants[0].platform, 'xiaohongshu');
  assert.deepEqual(CONTENT_STAGES, ['idea', 'evaluating', 'planned', 'producing', 'review', 'published', 'reviewed', 'reusable']);
  assert.throws(() => transitionContent(item, 'published', { approved: false }), /approval_required/);
  assert.equal(transitionContent({ ...item, stage: 'review' }, 'published', { approved: true, now: '2026-08-06T09:00:00Z' }).publishedAt, '2026-08-06T09:00:00Z');
});

test('content analytics are zero-safe and never invent conversion', () => {
  assert.deepEqual(contentPerformance([]), { published: 0, views: 0, interactions: 0, leads: 0, revenue: 0, conversionRate: null });
  const items = [normalizeContentItem({ title: 'A', stage: 'published', metrics: { views: 100, interactions: 12, leads: 4, revenue: 600 } })];
  assert.equal(contentOverview(items).published, 1);
  assert.equal(contentPerformance(items).conversionRate, 4);
});

test('experiments and compounding retain source evidence', () => {
  const result = evaluateExperiment({ variants: [{ id: 'a', metric: 10 }, { id: 'b', metric: 22 }] });
  assert.equal(result.winnerId, 'b');
  const candidate = buildCompoundCandidate({ id: 'c1', title: '爆款复盘', sourceRefs: ['https://example.com'] }, { type: 'case' });
  assert.equal(candidate.sourceContentId, 'c1');
  assert.deepEqual(candidate.sourceRefs, ['https://example.com']);
});
