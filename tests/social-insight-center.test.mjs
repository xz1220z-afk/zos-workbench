import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeSocialInsight, rankSocialOpportunities, routeInsightCompany } from '../src/app/social-insight-center.mjs';

test('social claims without source evidence stay pending', () => {
  assert.equal(normalizeSocialInsight({ claim: '婚礼纪实升温' }).status, 'pending_evidence');
  const sourced = normalizeSocialInsight({ claim: '商家团购讨论增加', platform: 'douyin', sourceUrl: 'https://example.com/post', capturedAt: '2026-08-06T09:00:00Z', score: 88 });
  assert.equal(sourced.status, 'observed');
  assert.equal(routeInsightCompany(sourced), 'wanjia');
});

test('social opportunities rank evidence before unsupported scores', () => {
  const ranked = rankSocialOpportunities([
    { claim: '无证据高分', score: 99 },
    { claim: '有证据', score: 60, platform: 'xiaohongshu', sourceUrl: 'https://example.com/a', capturedAt: '2026-08-06T09:00:00Z' },
  ]);
  assert.equal(ranked[0].claim, '有证据');
});
