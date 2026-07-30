import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  daysSince,
  isDone,
  hasUnfinished,
  isHighRisk,
  isRevenuePending,
  riskLevelFromReasons,
  detectRisks,
  bucketRisks,
  DEFAULT_STALE_DAYS,
} from '../src/risk-detector.mjs';

// Fixed reference instant for deterministic tests.
const AS_OF = new Date('2026-07-30T00:00:00Z');

function daysAgo(n) {
  return new Date(AS_OF.getTime() - n * 86400000).toISOString();
}

test('daysSince computes whole-day deltas', () => {
  assert.equal(daysSince(daysAgo(7), AS_OF), 7);
  assert.equal(daysSince(daysAgo(14), AS_OF), 14);
  assert.equal(daysSince('not-a-date', AS_OF), Infinity);
});

test('isDone honors terminal stages per kind', () => {
  assert.equal(isDone({ stage: '已结束' }, 'wanjia'), true);
  assert.equal(isDone({ stage: '执行中' }, 'wanjia'), false);
  assert.equal(isDone({ stage: '已结项' }, 'huahuo'), true);
  assert.equal(isDone({ status: '已完成' }, 'project'), true);
});

test('hasUnfinished varies by kind', () => {
  assert.equal(hasUnfinished({ nextAction: '核对核销' }, 'wanjia'), true);
  assert.equal(hasUnfinished({ nextAction: '无' }, 'wanjia'), false);
  assert.equal(hasUnfinished({ deliveryStatus: '待交付' }, 'huahuo'), true);
  assert.equal(hasUnfinished({ deliveryStatus: '已交付', revenueStatus: '已回款' }, 'huahuo'), false);
  assert.equal(hasUnfinished({ status: '进行中' }, 'project'), true);
  assert.equal(hasUnfinished({ status: '已完成' }, 'project'), false);
});

test('isHighRisk / isRevenuePending honor source semantics', () => {
  assert.equal(isHighRisk({ riskLevel: '高' }, 'wanjia'), true);
  assert.equal(isHighRisk({ profitStatus: '亏损' }, 'huahuo'), true);
  assert.equal(isHighRisk({ riskLevel: '低' }, 'wanjia'), false);
  assert.equal(isRevenuePending({ revenueStatus: '待收款' }, 'wanjia'), true);
  assert.equal(isRevenuePending({ revenueStatus: '待回款' }, 'huahuo'), true);
  assert.equal(isRevenuePending({ revenueStatus: '已收款' }, 'wanjia'), false);
});

test('riskLevelFromReasons derives from highest severity', () => {
  assert.equal(riskLevelFromReasons([]), '低');
  assert.equal(riskLevelFromReasons([{ severity: 'medium' }]), '中');
  assert.equal(riskLevelFromReasons([{ severity: 'medium' }, { severity: 'high' }]), '高');
});

test('detectRisks flags stale / stuck / unfinished / high', () => {
  const records = [
    { id: 'w1', merchantName: '老街奶茶店', stage: '执行中', riskLevel: '中', revenueStatus: '待收款', nextAction: '核对核销', updatedAt: daysAgo(20), source: 'wanjia' },
    { id: 'w2', merchantName: '海岸咖啡', stage: '复盘', riskLevel: '高', revenueStatus: '已收款', nextAction: '无', updatedAt: daysAgo(2), source: 'wanjia' },
    { id: 'w3', merchantName: '已结项店', stage: '已结束', riskLevel: '低', revenueStatus: '已收款', nextAction: '无', updatedAt: daysAgo(40), source: 'wanjia' },
  ];
  const risks = detectRisks(records, 'wanjia', { asOf: AS_OF });
  // w3 is done -> skipped. w1 stale(20>7 -> high since >14) + stuck + unfinished + revenue_pending. w2 high_risk only.
  const w1 = risks.find((r) => r.recordId === 'w1');
  const w2 = risks.find((r) => r.recordId === 'w2');
  assert.ok(w1, 'w1 should be flagged');
  assert.ok(w2, 'w2 should be flagged');
  assert.equal(w1.level, '高');
  assert.ok(w1.reasons.some((x) => x.code === 'stale'));
  assert.ok(w1.reasons.some((x) => x.code === 'stuck'));
  assert.ok(w1.reasons.some((x) => x.code === 'unfinished'));
  assert.ok(w1.reasons.some((x) => x.code === 'revenue_pending'));
  assert.equal(w2.level, '高');
  assert.ok(w2.reasons.some((x) => x.code === 'high_risk'));
  assert.equal(risks.length, 2);
});

test('detectRisks respects staleDays threshold', () => {
  const fresh = [{ id: 'a', merchantName: 'm', stage: '执行中', riskLevel: '低', revenueStatus: '已收款', nextAction: '无', updatedAt: daysAgo(3), source: 'wanjia' }];
  assert.equal(detectRisks(fresh, 'wanjia', { asOf: AS_OF, staleDays: DEFAULT_STALE_DAYS }).length, 0);
  const stale = [{ id: 'b', merchantName: 'm', stage: '执行中', riskLevel: '低', revenueStatus: '已收款', nextAction: '无', updatedAt: daysAgo(10), source: 'wanjia' }];
  const out = detectRisks(stale, 'wanjia', { asOf: AS_OF, staleDays: DEFAULT_STALE_DAYS });
  assert.equal(out.length, 1);
  assert.ok(out[0].reasons.some((x) => x.code === 'stale'));
});

test('bucketRisks splits into high / delayed / followUp', () => {
  const risks = detectRisks(
    [
      { id: 'w1', merchantName: 'm', stage: '执行中', riskLevel: '高', revenueStatus: '待收款', nextAction: '跟进', updatedAt: daysAgo(20), source: 'wanjia' },
    ],
    'wanjia',
    { asOf: AS_OF },
  );
  const buckets = bucketRisks(risks);
  assert.equal(buckets.high.length, 1);
  assert.equal(buckets.delayed.length, 1);
  assert.equal(buckets.followUp.length, 1);
});

test('detectRisks throws on bad kind', () => {
  assert.throws(() => detectRisks([], 'nope'), /kind must/);
});
