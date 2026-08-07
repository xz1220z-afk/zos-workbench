import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterIntelligence, normalizeIntelligenceItem, rankIntelligence, sortIntelligence,
  transitionIntelligence, todayMustRead,
} from '../src/app/intelligence-center.mjs';

const item = {
  externalId: 'intel-1', title: '平台调整本地生活规则', sourceName: '平台公告',
  sourceUrl: 'https://example.com/notice', publishedAt: '2026-08-02T01:00:00.000Z',
  capturedAt: '2026-08-02T02:00:00.000Z', credibility: 'high', score: 92,
  relevantCompanies: ['wanjia'], factSummary: '平台发布新的商家治理规则',
  impactAnalysis: '需复核商家素材与门店配置', suggestedAction: '建立受影响商家清单',
};

test('intelligence keeps evidence, impact and suggestion separate', () => {
  const result = normalizeIntelligenceItem(item);
  assert.equal(result.factSummary, item.factSummary);
  assert.equal(result.impactAnalysis, item.impactAnalysis);
  assert.equal(result.suggestedAction, item.suggestedAction);
  assert.equal(result.status, 'candidate');
  assert.equal('rawBody' in result, false);
});

test('daily must-read ranks current high-value intelligence without inventing items', () => {
  const ranked = todayMustRead([
    item,
    { ...item, externalId: 'intel-2', score: 70, relevantCompanies: ['huahuo'] },
    { ...item, externalId: 'intel-3', score: 99, publishedAt: '2026-07-20T01:00:00.000Z' },
  ], { now: '2026-08-02T08:00:00.000Z', limit: 5 });
  assert.deepEqual(ranked.map((entry) => entry.externalId), ['intel-1', 'intel-2']);
  assert.deepEqual(rankIntelligence([]), []);
});

test('intelligence lifecycle requires explicit transitions', () => {
  assert.equal(transitionIntelligence(normalizeIntelligenceItem(item), 'read').status, 'read');
  assert.equal(transitionIntelligence({ ...normalizeIntelligenceItem(item), status: 'read' }, 'actioned').status, 'actioned');
  assert.throws(() => transitionIntelligence(normalizeIntelligenceItem(item), 'archived'), /invalid intelligence transition/);
});

test('default intelligence order is newest first and invalid dates sort last', () => {
  const rows = [
    { ...item, externalId: 'old', publishedAt: '2026-08-01T01:00:00Z', score: 99 },
    { ...item, externalId: 'new', publishedAt: '2026-08-03T01:00:00Z', score: 10 },
    { ...item, externalId: 'missing', publishedAt: null, capturedAt: null, score: 100 },
  ];
  assert.deepEqual(sortIntelligence(rows, 'newest').map((entry) => entry.externalId), ['new', 'old', 'missing']);
  assert.deepEqual(rankIntelligence(rows).map((entry) => entry.externalId), ['new', 'old', 'missing']);
  assert.equal(sortIntelligence(rows, 'score')[0].externalId, 'missing');
});

test('intelligence filters combine company, source, credibility, status, age and search', () => {
  const rows = [
    { ...item, externalId: 'match', sourceName: '平台公告', credibility: 'high', status: 'candidate', tags: ['本地生活'] },
    { ...item, externalId: 'other', sourceName: 'AI HOT', credibility: 'medium', status: 'read', relevantCompanies: ['huahuo'] },
  ];
  const result = filterIntelligence(rows, {
    company: 'wanjia', source: '平台公告', credibility: 'high', status: 'candidate',
    age: '3d', search: '本地生活', now: '2026-08-03T01:00:00Z',
  });
  assert.deepEqual(result.map((entry) => entry.externalId), ['match']);
});
