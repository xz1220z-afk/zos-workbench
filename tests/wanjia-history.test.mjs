import test from 'node:test';
import assert from 'node:assert/strict';

import { buildWanjiaHistoryModel, normalizeWanjiaRange } from '../src/app/wanjia-history.mjs';

const rows = [
  { businessDate: '2026-08-06', merchantId: 'L-1', merchantName: '甲店', industry: '餐饮', owner: '阿林', paymentGmv: 100, redeemedGmv: 60, exception: false, sourceKind: 'daily_increment' },
  { businessDate: '2026-08-07', merchantId: 'L-1', merchantName: '甲店', industry: '餐饮', owner: '阿林', paymentGmv: 150, redeemedGmv: 90, exception: true, sourceKind: 'daily_increment' },
  { businessDate: '2026-08-06', merchantId: 'L-2', merchantName: '乙店', industry: '茶饮', owner: '阿华', paymentGmv: 50, redeemedGmv: 50, exception: false, sourceKind: 'daily_increment' },
  { businessDate: '2026-08-07', merchantId: 'L-2', merchantName: '乙店', industry: '茶饮', owner: '阿华', paymentGmv: 10, redeemedGmv: 10, exception: false, sourceKind: 'daily_increment' },
];

test('normalizes today and custom date ranges without ambiguous dates', () => {
  assert.deepEqual(normalizeWanjiaRange({ preset: 'today' }, { today: '2026-08-08' }), { startDate: '2026-08-08', endDate: '2026-08-08', preset: 'today' });
  assert.deepEqual(normalizeWanjiaRange({ preset: 'custom', startDate: '2026-08-06', endDate: '2026-08-07' }, { today: '2026-08-08' }), { startDate: '2026-08-06', endDate: '2026-08-07', preset: 'custom' });
});

test('builds a dated daily-increment trend and rankings only from verified history', () => {
  const model = buildWanjiaHistoryModel({
    availability: { state: 'validated', source: 'local_sqlite', latestDate: '2026-08-07', earliestDate: '2026-08-06', batchCount: 2 },
    rows,
  }, { range: { preset: 'custom', startDate: '2026-08-06', endDate: '2026-08-07' }, today: '2026-08-08' });
  assert.equal(model.availability.state, 'validated');
  assert.deepEqual(model.trend.map((item) => [item.date, item.paymentGmv, item.exceptionMerchants]), [['2026-08-06', 150, 0], ['2026-08-07', 160, 1]]);
  assert.equal(model.rankings.paymentGmv[0].merchantId, 'L-1');
  assert.equal(model.rankings.growth[0].merchantId, 'L-1');
  assert.equal(model.insufficient, false);
});

test('does not sum snapshot metrics and exposes a metric-risk message', () => {
  const model = buildWanjiaHistoryModel({
    availability: { state: 'validated', source: 'local_sqlite', latestDate: '2026-08-07', earliestDate: '2026-08-06' },
    rows: [
      { businessDate: '2026-08-05', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 100, sourceKind: 'period_snapshot' },
      { businessDate: '2026-08-06', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 100, sourceKind: 'period_snapshot' },
      { businessDate: '2026-08-07', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 160, sourceKind: 'period_snapshot' },
    ],
  }, { range: { preset: 'custom', startDate: '2026-08-06', endDate: '2026-08-07' }, today: '2026-08-08' });
  assert.equal(model.metricRisk, '口径不可累计');
  assert.equal(model.trend.at(-1).paymentGmv, null);
  assert.equal(model.rangeSummary.paymentGmv, 60);
});

test('shows verified 2026-08-07 to 2026-08-08 period snapshots without inventing a missing baseline', () => {
  const model = buildWanjiaHistoryModel({
    availability: { state: 'validated', source: 'local_sqlite', earliestDate: '2026-08-07', latestDate: '2026-08-08', batchCount: 2 },
    rows: [
      { businessDate: '2026-08-07', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 100, redeemedGmv: 50, sourceKind: 'period_snapshot' },
      { businessDate: '2026-08-08', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 130, redeemedGmv: 80, sourceKind: 'period_snapshot' },
    ],
  }, { range: { preset: 'custom', startDate: '2026-08-07', endDate: '2026-08-08' }, today: '2026-08-08' });

  assert.equal(model.availability.label, '历史数据已验证');
  assert.equal(model.metricRisk, '口径不可累计');
  assert.equal(model.rangeStatus, 'insufficient_history');
  assert.equal(model.rangeSummary.paymentGmv, null);
  assert.equal(model.rangeSummary.redeemedGmv, null);
  assert.deepEqual(model.snapshotTrend.map((item) => [item.date, item.paymentGmv, item.redeemedGmv]), [
    ['2026-08-07', 100, 50], ['2026-08-08', 130, 80],
  ]);
});

test('history missing or too short is shown as accumulation rather than zero performance', () => {
  const model = buildWanjiaHistoryModel(null, { range: { preset: 'last_7_days' }, today: '2026-08-08' });
  assert.equal(model.availability.state, 'missing');
  assert.equal(model.insufficient, true);
  assert.equal(model.rangeSummary.paymentGmv, null);
  assert.match(model.message, /历史数据积累中/);
});

test('does not reuse the latest snapshot as a zero delta when the selected date is outside history coverage', () => {
  const model = buildWanjiaHistoryModel({
    availability: { state: 'validated', source: 'local_sqlite', earliestDate: '2026-08-07', latestDate: '2026-08-08', batchCount: 2 },
    rows: [
      { businessDate: '2026-08-07', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 100, redeemedGmv: 50, sourceKind: 'period_snapshot' },
      { businessDate: '2026-08-08', merchantId: 'L-1', merchantName: '甲店', paymentGmv: 130, redeemedGmv: 80, sourceKind: 'period_snapshot' },
    ],
  }, { range: { preset: 'today' }, today: '2026-08-13' });

  assert.equal(model.rows.length, 0);
  assert.equal(model.rangeSummary.paymentGmv, null);
  assert.equal(model.rangeSummary.redeemedGmv, null);
  assert.equal(model.rangeSummary.redemptionRate, null);
  assert.match(model.message, /对应日期尚无已校验/);
});

test('accepts a read-only adapter record envelope without changing historical semantics', () => {
  const model = buildWanjiaHistoryModel({
    availability: { state: 'validated', source: 'local_sqlite' },
    records: [{ businessDate: '2026-08-08', merchantId: 'L-3', merchantName: '丙店', paymentGmv: 88, sourceKind: 'daily_increment' }],
  }, { range: { preset: 'today' }, today: '2026-08-08' });
  assert.equal(model.rows.length, 1);
  assert.equal(model.rangeSummary.paymentGmv, 88);
});
