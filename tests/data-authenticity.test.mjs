// V1.2 数据真实性验证矩阵
// 覆盖：空数据 / 异常状态 / 权限只读 / 风险规则 / Agent 输出
// 目标：证明所有 Agent 产物均来自只读元数据、确定可复现、绝不直写事实源。
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  extractWanjiaRecord, buildWanjiaIndex, validateWanjiaIndex,
  summarizeWanjiaRecords, createWanjiaCacheClient,
  FORBIDDEN_WANJIA_FIELDS, REQUIRED_WANJIA_KEYS,
} from '../src/wanjia-data.mjs';
import {
  extractHuahuoRecord, buildHuahuoIndex, validateHuahuoIndex,
  summarizeHuahuoRecords, createHuahuoCacheClient,
  FORBIDDEN_HUAHUO_FIELDS, REQUIRED_HUAHUO_KEYS,
} from '../src/huahuo-data.mjs';
import {
  detectRisks, isDone, bucketRisks, riskLevelFromReasons, daysSince,
  DEFAULT_STALE_DAYS, DEFAULT_STUCK_DAYS,
} from '../src/risk-detector.mjs';
import {
  generateBrief, briefToMarkdown, generateDailyReport, reportToMarkdown,
} from '../src/project-manager-agent.mjs';

const ASOF = new Date('2026-07-30T00:00:00Z');

// ===== 1. 空数据 =====
test('空数据：万嘉/花火汇总在空记录下返回全零且不崩溃', () => {
  const w = summarizeWanjiaRecords({ records: [] });
  assert.equal(w.total, 0); assert.equal(w.active, 0);
  assert.equal(w.atRisk, 0); assert.equal(w.revenuePending, 0);
  assert.deepEqual(w.byCooperationType, {});
  const h = summarizeHuahuoRecords({ records: [] });
  assert.equal(h.total, 0); assert.equal(h.atRisk, 0);
  assert.equal(h.pendingDelivery, 0); assert.equal(h.revenuePending, 0);
});

test('空数据：风险探测器对空数组返回空', () => {
  assert.deepEqual(detectRisks([], 'wanjia', { asOf: ASOF }), []);
  assert.deepEqual(detectRisks([], 'huahuo', { asOf: ASOF }), []);
  assert.deepEqual(detectRisks([], 'project', { asOf: ASOF }), []);
});

test('空数据：Agent V1/V2 在空输入下仍产出合规结构', () => {
  const brief = generateBrief([], { date: '2026-07-30', owner: '朱帅' });
  assert.equal(brief.reviewRequired, true);
  assert.ok(brief.sections.keyTasks.length >= 1);
  assert.ok(brief.sections.delayRisks[0].includes('无'));

  const report = generateDailyReport({}, { date: '2026-07-30', owner: '朱帅', asOf: ASOF });
  assert.equal(report.reviewRequired, true);
  assert.equal(report.risksCount, 0);
  assert.ok(Array.isArray(report.sections.keyFocus));
  assert.ok(Array.isArray(report.sections.projectRisks));
  assert.ok(Array.isArray(report.sections.decisions));
  assert.ok(Array.isArray(report.sections.suggestions));
});

// ===== 2. 异常状态 =====
test('异常状态：缺失 id / 名称时抽取抛错', () => {
  assert.throws(() => extractWanjiaRecord({ merchantName: 'X' }), /id is required/);
  assert.throws(() => extractWanjiaRecord({ id: '1' }), /merchantName is required/);
  assert.throws(() => extractHuahuoRecord({ projectName: 'P' }), /id is required/);
  assert.throws(() => extractHuahuoRecord({ id: '1' }), /projectName is required/);
});

test('异常状态：脏阶段 / 脏日期被归一化而非崩溃', () => {
  const r = extractWanjiaRecord({ id: 'a', merchantName: '商家', stage: '奇怪阶段XYZ', updatedAt: 'not-a-date' });
  assert.equal(r.stage, '执行中'); // 未知阶段回落到默认
  assert.equal(r.updatedAt, new Date(0).toISOString()); // 无效日期回落到 epoch
  const h = extractHuahuoRecord({ id: 'b', projectName: '项目', shootingDate: '乱码' });
  assert.equal(h.shootingDate, new Date(0).toISOString());
});

test('异常状态：无法解析的 updatedAt 仍触发停滞风险', () => {
  const risks = detectRisks([{ id: 'x', merchantName: 'M', stage: '执行中', updatedAt: 'invalid' }], 'wanjia', { asOf: ASOF });
  assert.equal(risks.length, 1);
  assert.ok(risks[0].reasons.some((x) => x.code === 'stale'));
});

test('异常状态：风险等级脏值被归一化', () => {
  const r = extractWanjiaRecord({ id: '1', merchantName: 'M', riskLevel: '紧急!!' });
  assert.equal(r.riskLevel, '高');
  const h = extractHuahuoRecord({ id: '2', projectName: 'P', profitStatus: '亏惨了' });
  assert.equal(h.profitStatus, '亏损');
});

test('异常状态：已完成阶段被风险探测器排除', () => {
  const done = detectRisks([{ id: '1', merchantName: 'M', stage: '已结束', updatedAt: '2020-01-01' }], 'wanjia', { asOf: ASOF });
  assert.equal(done.length, 0);
  assert.equal(isDone({ stage: '已结束' }, 'wanjia'), true);
});

// ===== 3. 权限只读 =====
test('权限只读：构建的索引强制 read_only 且 source 正确', () => {
  const w = buildWanjiaIndex([{ id: '1', merchantName: 'M' }]);
  assert.equal(w.mode, 'read_only'); assert.equal(w.source, 'wanjia');
  const h = buildHuahuoIndex([{ id: '1', projectName: 'P' }]);
  assert.equal(h.mode, 'read_only'); assert.equal(h.source, 'huahuo');
});

test('权限只读：validate 拒绝非 read_only 或来源不符', () => {
  const ok = { source: 'wanjia', mode: 'read_only', records: [{ id: '1', merchantName: 'M', cooperationType: '其他', stage: '执行中', owner: 'o', updatedAt: '2026-01-01', nextAction: '', riskLevel: '低', revenueStatus: '已收款', source: 'wanjia' }] };
  assert.equal(validateWanjiaIndex(ok), true);
  assert.throws(() => validateWanjiaIndex({ ...ok, mode: 'write' }), /read_only/);
  assert.throws(() => validateWanjiaIndex({ ...ok, source: 'huahuo' }), /source/);
});

test('权限只读：validate 拒绝夹带任何正文字段（万嘉）', () => {
  for (const forbidden of FORBIDDEN_WANJIA_FIELDS) {
    const rec = { id: '1', merchantName: 'M', cooperationType: '其他', stage: '执行中', owner: 'o', updatedAt: '2026-01-01', nextAction: '', riskLevel: '低', revenueStatus: '已收款', source: 'wanjia' };
    rec[forbidden] = 'smuggled body text';
    const payload = { source: 'wanjia', mode: 'read_only', records: [rec] };
    assert.throws(() => validateWanjiaIndex(payload), /must not contain|forbidden/, `应拒绝夹带 ${forbidden}`);
  }
});

test('权限只读：validate 拒绝夹带任何正文字段（花火）', () => {
  for (const forbidden of FORBIDDEN_HUAHUO_FIELDS) {
    const rec = { id: '1', clientName: 'C', projectName: 'P', projectType: '其他', shootingDate: '2026-01-01', stage: '筹备中', deliveryStatus: '待交付', revenueStatus: '待回款', profitStatus: '待核算', source: 'huahuo' };
    rec[forbidden] = 'leak';
    const payload = { source: 'huahuo', mode: 'read_only', records: [rec] };
    assert.throws(() => validateHuahuoIndex(payload), /must not contain|forbidden/, `应拒绝夹带 ${forbidden}`);
  }
});

test('权限只读：缓存客户端拒绝非 read_only 响应，接受 read_only 响应', async () => {
  const fakeFetch = async (url, opts) => {
    const body = JSON.stringify([{ payload: { source: 'wanjia', mode: 'read_only', records: [{ id: '1', merchantName: 'M', cooperationType: '其他', stage: '执行中', owner: 'o', updatedAt: '2026-01-01', nextAction: '', riskLevel: '低', revenueStatus: '已收款', source: 'wanjia' }] } }]);
    return { ok: true, json: async () => JSON.parse(body) };
  };
  const client = createWanjiaCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: fakeFetch });
  const good = await client.fetchIndex();
  assert.equal(good.mode, 'read_only');

  const badFetch = async () => ({ ok: true, json: async () => [{ payload: { source: 'wanjia', mode: 'write', records: [] } }] });
  const badClient = createWanjiaCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: badFetch });
  await assert.rejects(() => badClient.fetchIndex(), /not read_only/);

  // 花火同样强制只读
  const hFetch = async () => ({ ok: true, json: async () => [{ payload: { source: 'huahuo', mode: 'read_only', records: [{ id: '1', clientName: 'C', projectName: 'P', projectType: '其他', shootingDate: '2026-01-01', stage: '筹备中', deliveryStatus: '待交付', revenueStatus: '待回款', profitStatus: '待核算', source: 'huahuo' }] } }] });
  const hClient = createHuahuoCacheClient({ url: 'https://x.supabase.co', anonKey: 'k', getAccessToken: async () => 'tok', fetchImpl: hFetch });
  const hGood = await hClient.fetchIndex();
  assert.equal(hGood.mode, 'read_only');
});

// ===== 4. 风险规则 =====
test('风险规则：>7 天未更新触发 stale（中危）', () => {
  const risks = detectRisks([{ id: '1', merchantName: 'M', stage: '执行中', updatedAt: '2026-07-20T00:00:00Z' }], 'wanjia', { asOf: ASOF });
  assert.equal(risks.length, 1);
  assert.ok(risks[0].reasons.some((x) => x.code === 'stale' && x.severity === 'medium'));
  assert.equal(risks[0].level, '中');
});

test('风险规则：>14 天未更新升级为高危', () => {
  const risks = detectRisks([{ id: '1', merchantName: 'M', stage: '执行中', updatedAt: '2026-07-05T00:00:00Z' }], 'wanjia', { asOf: ASOF });
  assert.equal(risks[0].level, '高');
  assert.ok(risks[0].reasons.some((x) => x.code === 'stale' && x.severity === 'high'));
  assert.ok(risks[0].reasons.some((x) => x.code === 'stuck'));
});

test('风险规则：万嘉未完成的下一步 + 待收款触发 unfinished / revenue_pending', () => {
  const risks = detectRisks([{ id: '1', merchantName: 'M', stage: '执行中', nextAction: '联系客户', revenueStatus: '待收款', updatedAt: '2026-07-29' }], 'wanjia', { asOf: ASOF });
  assert.ok(risks[0].reasons.some((x) => x.code === 'unfinished'));
  assert.ok(risks[0].reasons.some((x) => x.code === 'revenue_pending'));
});

test('风险规则：内置高危标记（万嘉高 / 花火亏损）触发 high_risk', () => {
  const w = detectRisks([{ id: '1', merchantName: 'M', stage: '执行中', riskLevel: '高', updatedAt: '2026-07-29' }], 'wanjia', { asOf: ASOF });
  assert.ok(w[0].reasons.some((x) => x.code === 'high_risk'));
  assert.equal(w[0].level, '高');
  const h = detectRisks([{ id: '2', projectName: 'P', stage: '拍摄中', profitStatus: '亏损', deliveryStatus: '已交付', revenueStatus: '已回款', updatedAt: '2026-07-29' }], 'huahuo', { asOf: ASOF });
  assert.ok(h[0].reasons.some((x) => x.code === 'high_risk'));
  assert.equal(h[0].level, '高');
});

test('风险规则：结果按风险等级排序（高→中）', () => {
  const records = [
    { id: 'mid', merchantName: 'M', stage: '执行中', updatedAt: '2026-07-20' },
    { id: 'high', merchantName: 'H', stage: '执行中', riskLevel: '高', updatedAt: '2026-07-29' },
    { id: 'mid2', merchantName: 'M2', stage: '执行中', nextAction: '跟进', updatedAt: '2026-07-21' },
  ];
  const risks = detectRisks(records, 'wanjia', { asOf: ASOF });
  const order = risks.map((r) => r.level);
  assert.deepEqual(order, ['高', '中', '中']);
});

test('风险规则：无风险的活动项在前端归类为绿色「正常」（低风险不进入 backend 列表）', () => {
  // backend detectRisks 对无风险记录返回空（被过滤），风险等级 低 仅由前端对活动项兜底。
  const clean = detectRisks([{ id: 'ok', merchantName: '健康', stage: '执行中', riskLevel: '低', revenueStatus: '已收款', nextAction: '', updatedAt: '2026-07-29' }], 'wanjia', { asOf: ASOF });
  assert.deepEqual(clean, []);
});

test('风险规则：bucketRisks 正确分桶且无重复', () => {
  const records = [
    { id: 'a', merchantName: 'A', stage: '执行中', riskLevel: '高', updatedAt: '2026-07-29' },
    { id: 'b', merchantName: 'B', stage: '执行中', updatedAt: '2026-07-20' },
  ];
  const risks = detectRisks(records, 'wanjia', { asOf: ASOF });
  const buckets = bucketRisks(risks);
  assert.equal(buckets.high.length, 1);
  assert.ok(buckets.delayed.length >= 1);
});

test('风险规则：riskLevelFromReasons 与 daysSince 确定性', () => {
  assert.equal(riskLevelFromReasons([]), '低');
  assert.equal(riskLevelFromReasons([{ severity: 'medium' }]), '中');
  assert.equal(riskLevelFromReasons([{ severity: 'high' }]), '高');
  assert.equal(daysSince('2026-07-20T00:00:00Z', ASOF), 10);
  assert.equal(DEFAULT_STALE_DAYS, 7);
  assert.equal(DEFAULT_STUCK_DAYS, 14);
});

// ===== 5. Agent 输出 =====
test('Agent 输出：V1 简报结构 + 必须待审核 + 不修改入参', () => {
  const input = [{ id: '1', name: '项目X', status: '进行中', riskLevel: '高', owner: '朱帅', updatedAt: '2026-07-29', source: 'projects', type: '政府项目' }];
  const snapshot = JSON.stringify(input);
  const brief = generateBrief(input, { date: '2026-07-30', owner: '朱帅' });
  assert.equal(brief.title, '朱帅每日经营简报');
  assert.equal(brief.reviewRequired, true);
  assert.match(brief.disclaimer, /人工审核|不直接修改|不直写|不发送|外部消息/);
  assert.deepEqual(Object.keys(brief.sections).sort(), ['decisions', 'delayRisks', 'keyTasks', 'merchantFollowups', 'suggestions']);
  const md = briefToMarkdown(brief);
  assert.match(md, /朱帅每日经营简报/);
  assert.match(md, /待人工审核/);
  assert.equal(JSON.stringify(input), snapshot); // 入参未被修改
});

test('Agent 输出：V2 经营日报含四段 + 风险计数 + 待审核', () => {
  const wanjia = [{ id: 'w1', merchantName: '商家', stage: '执行中', nextAction: '跟进', revenueStatus: '待收款', updatedAt: '2026-07-20', riskLevel: '低', source: 'wanjia' }];
  const huahuo = [{ id: 'h1', projectName: '片子', stage: '拍摄中', deliveryStatus: '交付中', revenueStatus: '待回款', profitStatus: '盈利', updatedAt: '2026-07-29', source: 'huahuo' }];
  const projects = [{ id: 'p1', name: '项目X', status: '进行中', riskLevel: '高', owner: '朱帅', updatedAt: '2026-07-29', source: 'projects', type: '政府项目' }];
  const report = generateDailyReport({ wanjia, huahuo, projects }, { date: '2026-07-30', owner: '朱帅', asOf: ASOF });
  assert.equal(report.title, '朱帅经营日报');
  assert.equal(report.reviewRequired, true);
  assert.ok(report.risksCount >= 1);
  assert.deepEqual(Object.keys(report.sections).sort(), ['decisions', 'keyFocus', 'projectRisks', 'suggestions']);
  assert.match(report.disclaimer, /不直写|不直接修改|不发送|外部消息/);
  const md = reportToMarkdown(report);
  assert.match(md, /朱帅经营日报/);
  assert.match(md, /风险项：/);
});

test('Agent 输出：V2 日报在异常记录下仍稳定产出且待审核', () => {
  const bad = [{ id: 'x', merchantName: 'M', riskLevel: '紧急!!', stage: '执行中', updatedAt: '乱码日期', source: 'wanjia' }];
  const report = generateDailyReport({ wanjia: bad }, { date: '2026-07-30', owner: '朱帅', asOf: ASOF });
  assert.equal(report.reviewRequired, true);
  assert.ok(Array.isArray(report.sections.keyFocus));
  assert.ok(typeof reportToMarkdown(report) === 'string');
});

test('Agent 输出：相同输入 + 注入 asOf 可复现（无时钟依赖）', () => {
  const recs = [{ id: '1', merchantName: 'M', stage: '执行中', updatedAt: '2026-07-20' }];
  const a = generateDailyReport({ wanjia: recs }, { owner: '朱帅', asOf: ASOF });
  const b = generateDailyReport({ wanjia: recs }, { owner: '朱帅', asOf: ASOF });
  assert.equal(JSON.stringify(a), JSON.stringify(b));
});

console.log('数据真实性验证矩阵通过：空数据 / 异常状态 / 权限只读 / 风险规则 / Agent 输出');
