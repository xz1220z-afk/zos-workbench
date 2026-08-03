import test from 'node:test';
import assert from 'node:assert/strict';

import {
  METRIC_CATALOG,
  actualMetrics,
  buildDailySnapshots,
  calculateGap,
  validateTarget,
} from '../src/app/targets.mjs';

const EXPECTED_KEYS = [
  'wanjia.paymentGmv',
  'wanjia.redeemedGmv',
  'wanjia.activeMerchants',
  'wanjia.videoPosts',
  'wanjia.liveSessions',
  'wanjia.estimatedCommission',
  'huahuo.contractAmount',
  'huahuo.receivedAmount',
  'huahuo.outstandingAmount',
  'huahuo.activeProjects',
  'huahuo.pendingDeliveries',
  'huahuo.lossRiskProjects',
  'lingli.received',
  'lingli.leads',
  'lingli.students',
  'lingli.consumed',
  'lingli.activeClasses',
];

test('metric catalog exposes only the approved three-company facts', () => {
  assert.deepEqual(Object.keys(METRIC_CATALOG), EXPECTED_KEYS);
});

test('targets reject inferred, invalid and unknown metrics', () => {
  assert.throws(
    () => validateTarget({ metricKey: 'wanjia.guessedProfit', value: 1, confirmation: 'confirmed' }),
    /unsupported metric/,
  );
  assert.throws(
    () => validateTarget({ metricKey: 'wanjia.paymentGmv', value: 1, confirmation: 'inferred' }),
    /confirmed target required/,
  );
  assert.throws(
    () => validateTarget({ metricKey: 'wanjia.paymentGmv', value: -1, confirmation: 'confirmed' }),
    /non-negative number/,
  );

  assert.deepEqual(
    validateTarget({ metricKey: 'wanjia.paymentGmv', value: 100000, confirmation: 'confirmed', period: 'month' }),
    { metricKey: 'wanjia.paymentGmv', value: 100000, confirmation: 'confirmed', period: 'month' },
  );
});

test('calculateGap distinguishes zero from missing actual data and preserves overachievement', () => {
  assert.deepEqual(
    calculateGap({ value: 100 }, 0),
    { actual: 0, gap: 100, completionRate: 0, state: 'behind' },
  );
  assert.deepEqual(
    calculateGap({ value: 100 }, undefined),
    { actual: null, gap: null, completionRate: null, state: 'missing_actual' },
  );
  assert.deepEqual(
    calculateGap({ value: 100 }, 125),
    { actual: 125, gap: -25, completionRate: 1.25, state: 'ahead' },
  );
});

test('actualMetrics extracts only demonstrable numbers and keeps missing facts null', () => {
  const metrics = actualMetrics({
    wanjia: {
      summary: { paymentGmv: 0, activeMerchants: 3, redeemedGmv: undefined },
      fetchedAt: '2026-08-02T08:00:00.000Z',
    },
    huahuo: {
      summary: { contractAmount: 10000, receivedAmount: 4500, lossRiskProjects: 2 },
      fetchedAt: '2026-08-02T08:05:00.000Z',
    },
    lingli: {
      summary: { received: 3000, students: 9, activeClasses: 2 },
      fetchedAt: '2026-08-02T08:10:00.000Z',
    },
  });

  assert.equal(metrics['wanjia.paymentGmv'].value, 0);
  assert.equal(metrics['wanjia.redeemedGmv'].value, null);
  assert.equal(metrics['wanjia.activeMerchants'].value, 3);
  assert.equal(metrics['huahuo.receivedAmount'].value, 4500);
  assert.equal(metrics['huahuo.pendingDeliveries'].value, null);
  assert.equal(metrics['huahuo.lossRiskProjects'].value, 2);
  assert.equal(metrics['lingli.received'].value, 3000);
  assert.equal(metrics['lingli.students'].value, 9);
  assert.equal(metrics['lingli.activeClasses'].value, 2);
});

test('daily snapshots are owner/date idempotent and contain no business body', () => {
  const metrics = actualMetrics({
    wanjia: {
      summary: { paymentGmv: 2000, activeMerchants: 4 },
      fetchedAt: '2026-08-02T08:00:00.000Z',
    },
    huahuo: {
      summary: { receivedAmount: 5000 },
      fetchedAt: '2026-08-02T08:05:00.000Z',
    },
  });
  const snapshots = buildDailySnapshots(metrics, {
    userId: 'user-1',
    date: '2026-08-02',
    contractVersion: '1.3.0',
  });

  assert.deepEqual(snapshots.map((row) => row.id), [
    'user-1:huahuo.receivedAmount:2026-08-02',
    'user-1:wanjia.activeMerchants:2026-08-02',
    'user-1:wanjia.paymentGmv:2026-08-02',
  ]);
  assert.deepEqual(Object.keys(snapshots[0]), [
    'id',
    'metricKey',
    'value',
    'source',
    'sourceUpdatedAt',
    'capturedOn',
    'contractVersion',
  ]);
  assert.equal(JSON.stringify(snapshots).includes('records'), false);
});
