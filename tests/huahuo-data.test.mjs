import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  extractHuahuoRecord,
  buildHuahuoIndex,
  validateHuahuoIndex,
  summarizeHuahuoRecords,
  normalizeProjectType,
  normalizeStage,
  normalizeDeliveryStatus,
  normalizeRevenueStatus,
  normalizeProfitStatus,
  REQUIRED_HUAHUO_KEYS,
  FORBIDDEN_HUAHUO_FIELDS,
} from '../src/huahuo-data.mjs';

const sampleRaw = [
  {
    id: 'h1',
    clientName: '万嘉餐饮',
    projectName: '品牌宣传片',
    projectType: '宣传片',
    shootingDate: '2026-07-15T10:00:00Z',
    stage: '后期中',
    deliveryStatus: '交付中',
    revenueStatus: '部分回款',
    profitStatus: '盈利',
  },
  {
    projectId: 'h2',
    客户名称: '海岸集团',
    项目名称: '电商直播',
    项目类型: '电商',
    拍摄日期: '2026-07-28T09:00:00Z',
    当前阶段: '拍摄中',
    交付状态: '待交付',
    回款状态: '待回款',
    利润状态: '待核算',
  },
];

test('extractHuahuoRecord normalizes both camelCase and Chinese-field sources', () => {
  const a = extractHuahuoRecord(sampleRaw[0]);
  assert.equal(a.clientName, '万嘉餐饮');
  assert.equal(a.projectName, '品牌宣传片');
  assert.equal(a.projectType, '宣传片');
  assert.equal(a.stage, '后期中');
  assert.equal(a.deliveryStatus, '交付中');
  assert.equal(a.revenueStatus, '部分回款');
  assert.equal(a.profitStatus, '盈利');
  assert.equal(a.source, 'huahuo');

  const b = extractHuahuoRecord(sampleRaw[1]);
  assert.equal(b.id, 'h2');
  assert.equal(b.clientName, '海岸集团');
  assert.equal(b.projectName, '电商直播');
  assert.equal(b.projectType, '电商');
  assert.equal(b.stage, '拍摄中');
  assert.equal(b.deliveryStatus, '待交付');
  assert.equal(b.revenueStatus, '待回款');
  assert.equal(b.profitStatus, '待核算');
});

test('buildHuahuoIndex produces a read_only payload with all required keys', () => {
  const idx = buildHuahuoIndex(sampleRaw);
  assert.equal(idx.source, 'huahuo');
  assert.equal(idx.mode, 'read_only');
  assert.equal(idx.records.length, 2);
  for (const r of idx.records) {
    for (const key of REQUIRED_HUAHUO_KEYS) assert.ok(key in r, `missing ${key}`);
  }
});

test('validateHuahuoIndex rejects non read_only payloads', () => {
  const idx = buildHuahuoIndex(sampleRaw);
  assert.equal(validateHuahuoIndex(idx), true);
  assert.throws(() => validateHuahuoIndex({ ...idx, mode: 'write' }), /read_only/);
  assert.throws(() => validateHuahuoIndex({ ...idx, source: 'wanjia' }), /source/);
});

test('validateHuahuoIndex rejects smuggled body fields', () => {
  const bad = buildHuahuoIndex(sampleRaw);
  bad.records[0].description = 'secret shooting brief';
  assert.throws(() => validateHuahuoIndex(bad), /must not contain/);
});

test('summarizeHuahuoRecords derives active / pending / atRisk', () => {
  const idx = buildHuahuoIndex(sampleRaw);
  const s = summarizeHuahuoRecords(idx);
  assert.equal(s.total, 2);
  assert.equal(s.active, 2); // both not done
  assert.equal(s.pendingDelivery, 2); // h1 交付中 + h2 待交付
  assert.equal(s.revenuePending, 1); // h2 待回款
  assert.equal(s.atRisk, 1); // only h2 (待回款 + 待交付)
  assert.equal(s.byType['宣传片'], 1);
  assert.equal(s.byType['电商'], 1);
});

test('normalizers map fuzzy source strings to canonical vocab', () => {
  assert.equal(normalizeProjectType('抖音短视频'), '短视频');
  assert.equal(normalizeStage('推进中'), '筹备中');
  assert.equal(normalizeStage('已结案'), '已结项');
  assert.equal(normalizeDeliveryStatus('完成交付'), '已交付');
  assert.equal(normalizeRevenueStatus('全款到账'), '已回款');
  assert.equal(normalizeProfitStatus('亏损'), '亏损');
});

test('extractHuahuoRecord throws when id or projectName missing', () => {
  assert.throws(() => extractHuahuoRecord({ projectName: 'x' }), /id is required/);
  assert.throws(() => extractHuahuoRecord({ id: 'a' }), /projectName is required/);
});

test('buildHuahuoIndex drops records without id and stays read_only', () => {
  const idx = buildHuahuoIndex([{ id: 'ok', projectName: 'm' }, { projectName: 'no-id' }]);
  assert.equal(idx.records.length, 1);
  assert.equal(idx.mode, 'read_only');
});

test('forbidden fields are declared and non-empty', () => {
  assert.ok(FORBIDDEN_HUAHUO_FIELDS.includes('description'));
  assert.ok(FORBIDDEN_HUAHUO_FIELDS.length >= 8);
});

test('花火 page keeps a read-only source rail with empty and error states', async () => {
  const page = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const section = page.match(/<section class="page" id="page-spark-media"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(section, /data-source="huahuo"/);
  assert.match(section, /data-source-rail/);
  assert.match(section, /data-source-empty-state/);
  assert.match(section, /data-source-error/);
  assert.match(section, /不会回写飞书/);
});
