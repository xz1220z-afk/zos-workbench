import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  extractWanjiaRecord,
  buildWanjiaIndex,
  validateWanjiaIndex,
  summarizeWanjiaRecords,
  normalizeRiskLevel,
  normalizeRevenueStatus,
  normalizeStage,
  normalizeCooperationType,
  REQUIRED_WANJIA_KEYS,
  FORBIDDEN_WANJIA_FIELDS,
} from '../src/wanjia-data.mjs';

const sampleRaw = [
  {
    id: 'w1',
    merchantName: '老街奶茶店',
    cooperationType: '团购',
    stage: '执行中',
    owner: '小林',
    updatedAt: '2026-07-20T09:00:00Z',
    nextAction: '核对本周核销数据',
    riskLevel: '中',
    revenueStatus: '待收款',
  },
  {
    merchantId: 'w2',
    商家名称: '海岸咖啡',
    合作类型: '直播',
    当前阶段: '复盘',
    项目负责人: '阿May',
    最近更新时间: '2026-07-29T15:00:00Z',
    下一步动作: '',
    风险等级: '低',
    收入状态: '已收款',
  },
];

test('extractWanjiaRecord normalizes both camelCase and Chinese-field sources', () => {
  const a = extractWanjiaRecord(sampleRaw[0]);
  assert.equal(a.merchantName, '老街奶茶店');
  assert.equal(a.cooperationType, '团购');
  assert.equal(a.stage, '执行中');
  assert.equal(a.owner, '小林');
  assert.equal(a.riskLevel, '中');
  assert.equal(a.revenueStatus, '待收款');
  assert.equal(a.source, 'wanjia');

  const b = extractWanjiaRecord(sampleRaw[1]);
  assert.equal(b.id, 'w2');
  assert.equal(b.merchantName, '海岸咖啡');
  assert.equal(b.cooperationType, '直播');
  assert.equal(b.owner, '阿May');
  assert.equal(b.riskLevel, '低');
  assert.equal(b.revenueStatus, '已收款');
});

test('buildWanjiaIndex produces a read_only payload with all required keys', () => {
  const idx = buildWanjiaIndex(sampleRaw);
  assert.equal(idx.source, 'wanjia');
  assert.equal(idx.mode, 'read_only');
  assert.equal(idx.records.length, 2);
  for (const r of idx.records) {
    for (const key of REQUIRED_WANJIA_KEYS) assert.ok(key in r, `missing ${key}`);
  }
});

test('validateWanjiaIndex rejects non read_only payloads', () => {
  const idx = buildWanjiaIndex(sampleRaw);
  assert.equal(validateWanjiaIndex(idx), true);
  assert.throws(() => validateWanjiaIndex({ ...idx, mode: 'write' }), /read_only/);
  assert.throws(() => validateWanjiaIndex({ ...idx, source: 'brain' }), /source/);
});

test('validateWanjiaIndex rejects smuggled body fields', () => {
  const bad = buildWanjiaIndex(sampleRaw);
  bad.records[0].description = 'secret merchant notes';
  assert.throws(() => validateWanjiaIndex(bad), /must not contain/);
});

test('summarizeWanjiaRecords derives active / atRisk / revenuePending', () => {
  const idx = buildWanjiaIndex(sampleRaw);
  const s = summarizeWanjiaRecords(idx);
  assert.equal(s.total, 2);
  assert.equal(s.active, 2); // both not done
  assert.equal(s.atRisk, 1); // 老街奶茶店: revenueStatus 待收款
  assert.equal(s.revenuePending, 1); // 老街奶茶店: 待收款
  assert.equal(s.byCooperationType['团购'], 1);
  assert.equal(s.byCooperationType['直播'], 1);
});

test('normalizers map fuzzy source strings to canonical vocab', () => {
  assert.equal(normalizeRiskLevel('严重'), '高');
  assert.equal(normalizeRiskLevel('紧急'), '高');
  assert.equal(normalizeRiskLevel(''), '低');
  assert.equal(normalizeRevenueStatus('全款到账'), '已收款');
  assert.equal(normalizeRevenueStatus('还没开始'), '未开始');
  assert.equal(normalizeStage('推进中'), '执行中');
  assert.equal(normalizeStage('已结案'), '已结束');
  assert.equal(normalizeCooperationType('抖音短视频'), '短视频');
});

test('extractWanjiaRecord throws when id or merchantName missing', () => {
  assert.throws(() => extractWanjiaRecord({ merchantName: 'x' }), /id is required/);
  assert.throws(() => extractWanjiaRecord({ id: 'a' }), /merchantName is required/);
});

test('buildWanjiaIndex drops records without id and stays read_only', () => {
  const idx = buildWanjiaIndex([{ id: 'ok', merchantName: 'm' }, { merchantName: 'no-id' }]);
  assert.equal(idx.records.length, 1);
  assert.equal(idx.mode, 'read_only');
});

test('forbidden fields are declared and non-empty', () => {
  assert.ok(FORBIDDEN_WANJIA_FIELDS.includes('description'));
  assert.ok(FORBIDDEN_WANJIA_FIELDS.length >= 8);
});
