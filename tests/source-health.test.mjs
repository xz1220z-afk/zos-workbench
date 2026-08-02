import test from 'node:test';
import assert from 'node:assert/strict';

import { classifySourceHealth, healthRecommendation } from '../src/app/source-health.mjs';

test('classifySourceHealth marks an old successful cache stale but preserves evidence', () => {
  const health = classifySourceHealth(
    { source: 'wanjia', lastSuccessAt: '2026-08-01T00:00:00.000Z', recordCount: 12 },
    { now: '2026-08-02T12:00:00.000Z', staleAfterMs: 86400000 },
  );
  assert.equal(health.state, 'stale');
  assert.equal(health.recordCount, 12);
  assert.equal(health.lastSuccessAt, '2026-08-01T00:00:00.000Z');
  assert.equal(healthRecommendation(health), '数据已过期，请刷新来源');
});

test('successful fresh, initial pending and safe failures have distinct states', () => {
  assert.equal(classifySourceHealth(
    { lastSuccessAt: '2026-08-02T11:59:00.000Z', recordCount: 0 },
    { now: '2026-08-02T12:00:00.000Z' },
  ).state, 'synced');
  assert.equal(classifySourceHealth({}, { now: '2026-08-02T12:00:00.000Z' }).state, 'pending');

  const failed = classifySourceHealth(
    { failed: true, safeCode: 'feishu_timeout', rawResponse: { customer: '不得外泄' } },
    { now: '2026-08-02T12:00:00.000Z' },
  );
  assert.deepEqual(failed, {
    source: null,
    state: 'failed',
    recordCount: null,
    lastSuccessAt: null,
    safeCode: 'feishu_timeout',
    checkedAt: '2026-08-02T12:00:00.000Z',
  });
});

test('approval confirmation and sync conflicts take precedence over freshness', () => {
  assert.equal(classifySourceHealth({ requiresConfirmation: true, lastSuccessAt: '2026-08-02T12:00:00.000Z' }, {
    now: '2026-08-02T12:00:00.000Z',
  }).state, 'confirm');
  assert.equal(classifySourceHealth({ conflict: true, failed: true }, {
    now: '2026-08-02T12:00:00.000Z',
  }).state, 'conflict');
});
