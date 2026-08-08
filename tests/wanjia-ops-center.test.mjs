import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildWanjiaOpsModel,
  buildMerchantDiagnostic,
  filterWanjiaMerchants,
} from '../src/app/wanjia-ops-center.mjs';

const legacySource = {
  summary: { totalMerchants: 342, activeMerchants: 218, paymentGmv: 2882884 },
  fetchedAt: '2026-08-07T02:00:00.000Z',
  records: { records: [{
    id: 'm1', merchantId: 'L-001', merchantName: '老街奶茶', industry: '茶饮',
    cooperationType: '团购', owner: '阿林', isActive: true, isListed: true,
    paymentGmv: 12000, redeemedGmv: 6000, refundGmv: 0,
    updatedAt: '2026-07-31T02:00:00.000Z',
  }] },
};

const validatedSource = {
  dataStatus: {
    state: 'realtime_validated', dataDate: '2026-08-08',
    lastSyncedAt: '2026-08-08T01:20:00.000Z', validation: 'passed',
    sourceTables: ['01.00 商家主档', '01.04.03｜林客商家当前经营状态', '01.04.04｜林客每日汇总'],
  },
  summary: {
    totalMerchants: 2, activeMerchants: 1, todayPaymentGmv: 1000,
    todayRedeemedGmv: 600, averageRedemptionRate: 0.6,
    exceptionMerchants: 1, pendingExceptions: 1, completedTasksToday: 3,
  },
  records: { records: [
    {
      id: 'm1', merchantId: 'L-001', merchantName: '正常店', industry: '餐饮',
      cooperationType: '团购', owner: '阿林', isActive: true, isListed: true,
      paymentGmv: 1000, redeemedGmv: 600, refundGmv: 0, businessScore: 88,
      hasVideo: true, videoDirectPaymentGmv: 300, hasLive: true, livePaymentGmv: 200,
      updatedAt: '2026-08-08T01:00:00.000Z', dataDate: '2026-08-08',
    },
    {
      id: 'm2', merchantId: '', merchantName: '缺 ID 店', industry: '茶饮',
      cooperationType: '团购', owner: '未指定', isActive: false, isListed: true,
      paymentGmv: 0, redeemedGmv: 0, refundGmv: 0,
      updatedAt: '2026-08-08T01:00:00.000Z', dataDate: '2026-08-08',
    },
  ] },
};

test('legacy cache is explicitly historical and never fills today KPI cards', () => {
  const model = buildWanjiaOpsModel(legacySource, { today: '2026-08-08', tasks: [] });
  assert.equal(model.status.state, 'historical_snapshot');
  assert.equal(model.status.label, '历史快照');
  assert.match(model.status.message, /当前为历史林客快照/);
  assert.equal(model.kpis.every((item) => item.available === false && item.display === '待同步'), true);
  assert.equal(model.historicalReference.totalMerchants, 342);
  assert.equal(model.historicalReference.paymentGmv, 2882884);
  assert.deepEqual(model.merchants, []);
  assert.deepEqual(model.urgentMerchants, []);
  assert.deepEqual(model.opportunities, []);
});

test('today KPI values only appear after explicit same-day validation', () => {
  const model = buildWanjiaOpsModel(validatedSource, { today: '2026-08-08', tasks: [] });
  assert.equal(model.status.state, 'realtime_validated');
  assert.match(model.status.message, /今日林客数据已校验/);
  assert.deepEqual(model.kpis.map((item) => item.value), [2, 1, 1000, 600, 0.6, 1, 1, 3]);
  assert.equal(model.kpis.every((item) => item.available), true);
});

test('a validated batch excludes any merchant row whose own data date is not today', () => {
  const source = structuredClone(validatedSource);
  source.records.records.push({
    id: 'old', merchantId: 'L-OLD', merchantName: '旧快照店', paymentGmv: 9000,
    redeemedGmv: 1000, hasVideo: false, dataDate: '2026-07-31', updatedAt: '2026-07-31T10:00:00Z',
  });
  const model = buildWanjiaOpsModel(source, { today: '2026-08-08', tasks: [] });
  assert.equal(model.merchants.some((item) => item.id === 'old'), false);
  assert.equal(model.urgentMerchants.some((item) => item.id === 'old'), false);
  assert.equal(model.opportunities.some((item) => item.merchantId === 'old'), false);
});

test('KPI selection sorts the corresponding current merchant metric without changing facts', () => {
  const model = buildWanjiaOpsModel(validatedSource, {
    today: '2026-08-08', tasks: [], filters: { sort: 'today_payment_gmv' },
  });
  assert.deepEqual(model.filteredMerchants.map((item) => item.id), ['m1', 'm2']);
});

test('validated status still keeps missing KPI fields unavailable instead of inventing zero', () => {
  const source = structuredClone(validatedSource);
  source.summary.todayRedeemedGmv = null;
  delete source.summary.averageRedemptionRate;
  const model = buildWanjiaOpsModel(source, { today: '2026-08-08', tasks: [] });
  assert.equal(model.kpis.find((item) => item.key === 'today_redeemed_gmv').display, '待同步');
  assert.equal(model.kpis.find((item) => item.key === 'average_redemption_rate').display, '待同步');
});

test('yesterday data marked validated is still pending instead of realtime', () => {
  const model = buildWanjiaOpsModel({
    ...validatedSource,
    dataStatus: { ...validatedSource.dataStatus, dataDate: '2026-08-07' },
  }, { today: '2026-08-08', tasks: [] });
  assert.equal(model.status.state, 'pending_sync');
  assert.equal(model.kpis.every((item) => !item.available), true);
});

test('merchant health and action priority are deterministic rules', () => {
  const model = buildWanjiaOpsModel(validatedSource, { today: '2026-08-08', tasks: [] });
  const normal = model.merchants.find((item) => item.id === 'm1');
  const missing = model.merchants.find((item) => item.id === 'm2');
  assert.equal(normal.healthStatus, '正常');
  assert.equal(missing.healthStatus, '数据待核验');
  assert.equal(missing.priority, 'P0');
  assert.match(missing.anomalyTypes.join(','), /商家 ID 无法匹配/);
});

test('merchant filters cover owner, health and binary operating dimensions', () => {
  const model = buildWanjiaOpsModel(validatedSource, { today: '2026-08-08', tasks: [] });
  assert.deepEqual(filterWanjiaMerchants(model.merchants, { owner: '阿林' }).map((item) => item.id), ['m1']);
  assert.deepEqual(filterWanjiaMerchants(model.merchants, { health: '数据待核验' }).map((item) => item.id), ['m2']);
  assert.deepEqual(filterWanjiaMerchants(model.merchants, { active: 'yes' }).map((item) => item.id), ['m1']);
  assert.deepEqual(filterWanjiaMerchants(model.merchants, { abnormal: 'yes' }).map((item) => item.id), ['m2']);
});

test('diagnostic uses the fixed evidence-first funnel structure', () => {
  const diagnostic = buildMerchantDiagnostic(validatedSource.records.records[1]);
  assert.deepEqual(Object.keys(diagnostic), [
    '问题', '数据证据', '漏斗断点', '原因假设', '建议动作',
    '执行优先级', '建议负责人', '预计验证周期', '需要补充的数据',
  ]);
  assert.match(diagnostic.漏斗断点, /曝光 → 点击 → 支付成交 → 到店核销 → 复购\/推荐/);
  assert.doesNotMatch(diagnostic.原因假设.join(''), /没流量/);
});

test('growth opportunities are evidence backed and never auto executed', () => {
  const source = structuredClone(validatedSource);
  source.records.records[0].paymentGmv = 10000;
  source.records.records[0].redeemedGmv = 1000;
  const model = buildWanjiaOpsModel(source, { today: '2026-08-08', tasks: [] });
  const opportunity = model.opportunities.find((item) => item.merchantId === 'm1');
  assert.equal(opportunity.type, 'GMV 高但核销低');
  assert.equal(opportunity.autoExecute, false);
  assert.equal(opportunity.converted, false);
});
