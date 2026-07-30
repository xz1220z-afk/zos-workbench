// V1.2.1 Hotfix — HuaHuo risk contract regression tests.
//
// Guards the P1 fix: huahuo records must carry `updatedAt` (preferring the
// Feishu project update-time field, falling back to shootingDate) so the risk
// detector never computes `Infinity` days-since and never false-positives every
// HuaHuo project as stale.
//
// Scope: data-contract + risk-detector behaviour only. No UI, no new business
// logic, no risk-rule changes.

import assert from 'node:assert/strict';
import { test } from 'node:test';
import { detectRisks } from '../src/risk-detector.mjs';
import { extractHuahuoRecord } from '../src/huahuo-data.mjs';

const ASOF = '2026-07-31T00:00:00.000Z';

// All reason labels across a risk list (flattened) — used to assert no
// 'Infinity' leaked into any human-readable reason.
function allReasonLabels(risks) {
  return risks.flatMap((r) => r.reasons.map((x) => x.label));
}

test('有 updatedAt 时正常计算 daysSince（有限、精确）', () => {
  const fresh = extractHuahuoRecord({
    id: 'h-fresh', projectName: '近期更新', shootingDate: '2026-07-29',
    updatedAt: '2026-07-29', stage: '后期中',
    deliveryStatus: '已交付', revenueStatus: '已回款', profitStatus: '盈利',
  });
  const stale = extractHuahuoRecord({
    id: 'h-stale', projectName: '停滞', shootingDate: '2026-07-19',
    updatedAt: '2026-07-19', stage: '拍摄中',
    deliveryStatus: '待交付', revenueStatus: '待回款', profitStatus: '待核算',
  });
  const risks = detectRisks([fresh, stale], 'huahuo', { asOf: ASOF });
  const staleRisk = risks.find((r) => r.recordId === 'h-stale');
  assert.ok(staleRisk, '停滞记录应被标记');
  const staleReason = staleRisk.reasons.find((x) => x.code === 'stale');
  assert.ok(staleReason, '应产生 stale 原因');
  assert.match(staleReason.label, /已停滞 12 天/, 'daysSince 应为有限值 12，而非 Infinity');
  assert.ok(!staleReason.label.includes('Infinity'));
});

test('无 updatedAt 时回退到 shootingDate（不产生 Infinity）', () => {
  // 仅提供飞书拍摄日期，不提供更新时间 —— 模拟旧契约缺失字段的场景。
  const raw = {
    id: 'h-noupdate', projectName: '无更新时间',
    拍摄日期: '2026-07-21', // 10 天前
    stage: '后期中', deliveryStatus: '已交付', revenueStatus: '已回款', profitStatus: '盈利',
  };
  const rec = extractHuahuoRecord(raw);
  // 契约修复点：extractHuahuoRecord 必须把 updatedAt 回退到 shootingDate。
  assert.ok(rec.updatedAt, '契约应保证 updatedAt 存在');
  assert.strictEqual(rec.updatedAt, '2026-07-21T00:00:00.000Z', 'updatedAt 应回退到 shootingDate');
  const risks = detectRisks([rec], 'huahuo', { asOf: ASOF });
  assert.ok(risks.length >= 1, '10 天未更新的项目应被标记');
  assert.ok(risks.every((r) => r.reasons.every((x) => !x.label.includes('Infinity'))),
    '回退后不应出现 Infinity');
  assert.ok(allReasonLabels(risks).every((l) => !l.includes('Infinity')));
});

test('不产生 Infinity（即便原始记录完全缺失更新时间字段）', () => {
  // 极端情况：既无 updatedAt 也无 shootingDate —— 契约回退到 epoch，daysSince 巨大但仍有限。
  const raw = { id: 'h-empty', projectName: '无日期' };
  const rec = extractHuahuoRecord(raw);
  assert.ok(rec.updatedAt, '即使无日期，updatedAt 也应被 normalizeDate 兜底填充');
  const risks = detectRisks([rec], 'huahuo', { asOf: ASOF });
  // 不应有任何原因文本包含 'Infinity'
  assert.ok(allReasonLabels(risks).every((l) => !l.includes('Infinity')),
    '任何情况下风险原因都不应含有 Infinity');
});

test('不误判全部花火项目（近期且已交付/已回款的健康项目不报警）', () => {
  const healthy = extractHuahuoRecord({
    id: 'h-healthy', projectName: '健康项目', shootingDate: '2026-07-29',
    updatedAt: '2026-07-29', stage: '后期中',
    deliveryStatus: '已交付', revenueStatus: '已回款', profitStatus: '盈利',
  });
  const stale = extractHuahuoRecord({
    id: 'h-stale2', projectName: '停滞项目', shootingDate: '2026-07-18',
    updatedAt: '2026-07-18', stage: '拍摄中',
    deliveryStatus: '待交付', revenueStatus: '待回款', profitStatus: '待核算',
  });
  const noUpdate = extractHuahuoRecord({
    id: 'h-noupdate2', projectName: '无更新时间', 拍摄日期: '2026-07-20',
    stage: '后期中', deliveryStatus: '已交付', revenueStatus: '已回款', profitStatus: '盈利',
  });
  const risks = detectRisks([healthy, stale, noUpdate], 'huahuo', { asOf: ASOF });
  // healthy 不应被标记；stale 与 noUpdate 应被标记 → 共 2 条，而非 3 条。
  const ids = risks.map((r) => r.recordId);
  assert.ok(!ids.includes('h-healthy'), '健康项目不应被误判为风险');
  assert.strictEqual(risks.length, 2, '不应将全部花火项目误判为风险');
});
