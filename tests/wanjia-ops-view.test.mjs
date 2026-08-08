import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { render } from '../src/app/views/wanjia-ops-view.mjs';

test('wanjia ops view renders all required operating sections and safe empty state', () => {
  const container = { innerHTML: '' };
  render(container, {
    wanjiaOps: {
      status: { state: 'historical_snapshot', label: '历史快照', sourceLabel: '旧林客快照', dataDate: '2026-07-31', lastSyncedAt: '2026-08-07', trustworthy: false, message: '当前为历史林客快照，不代表今日实时经营结果。', sourceTables: [] },
      kpis: [
        ['total','商家总数'],['active','动销商家数'],['payment','今日支付 GMV'],['redeemed','今日核销 GMV'],
        ['rate','平均核销率'],['exceptions','异常商家数'],['pending','待处理异常数'],['tasks','今日完成任务数'],
      ].map(([key,label]) => ({ key, label, display: '待同步', available: false })),
      historicalReference: { totalMerchants: 342, activeMerchants: 218, paymentGmv: 2882884, dataDate: '2026-07-31' },
      urgentMerchants: [], merchants: [], filteredMerchants: [], opportunities: [],
      filterOptions: { industries: [], cooperationTypes: [], owners: [] }, filters: {},
    },
  });
  assert.match(container.innerHTML, /万嘉本地生活运营总控台/);
  assert.match(container.innerHTML, /当前为历史林客快照，不代表今日实时经营结果/);
  assert.match(container.innerHTML, /今日最需要处理的商家/);
  assert.match(container.innerHTML, /商家健康看板/);
  assert.match(container.innerHTML, /增长机会池/);
  assert.match(container.innerHTML, /待同步/);
  assert.match(container.innerHTML, /data-wanjia-kpi-filter/);
});

test('existing local-life route remains and legacy KPI nodes are compatibility-only', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  const section = html.match(/<section class="page" id="page-local-life"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(section, /id="wanjiaOperatingRoot"/);
  assert.match(section, /data-wanjia-legacy-compat/);
  assert.match(section, /hidden/);
  assert.match(section, /id="wanjiaMerchantCount"/);
});

test('wanjia ops view renders a dated history workspace without treating missing history as zero', () => {
  const container = { innerHTML: '' };
  render(container, {
    wanjiaOps: {
      status: {}, kpis: [], historicalReference: null, urgentMerchants: [], merchants: [], filteredMerchants: [], opportunities: [],
      filterOptions: { industries: [], cooperationTypes: [], owners: [] }, filters: {},
      history: {
        range: { preset: 'custom', startDate: '2026-08-06', endDate: '2026-08-07' },
        availability: { state: 'validated', label: '已校验', source: 'local_sqlite', earliestDate: '2026-08-06', latestDate: '2026-08-07', batchCount: 2 },
        metricRisk: null, insufficient: false, message: '历史数据已校验，所有指标按选定时间范围与字段口径计算。',
        rangeSummary: { paymentGmv: 310, redeemedGmv: 210, refundGmv: null, redemptionRate: 210 / 310, activeMerchants: 2, exceptionMerchants: 1 },
        trend: [{ date: '2026-08-06', paymentGmv: 150, redeemedGmv: 110, exceptionMerchants: 0 }, { date: '2026-08-07', paymentGmv: 160, redeemedGmv: 100, exceptionMerchants: 1 }],
        rankings: { paymentGmv: [{ merchantId: 'm-1', merchantName: '甲店', value: 250 }], redeemedGmv: [], growth: [], decline: [], refund: [], lowRedemption: [], video: [], live: [] },
        rows: [{ merchantId: 'm-1', merchantName: '甲店', businessDate: '2026-08-06', paymentGmv: 150 }],
      },
    },
  });
  assert.match(container.innerHTML, /时间范围查询与历史经营分析/);
  assert.match(container.innerHTML, /data-wanjia-history-form/);
  assert.match(container.innerHTML, /支付 GMV Top 20/);
  assert.match(container.innerHTML, /单商家历史趋势/);
  assert.match(container.innerHTML, /本地 SQLite 历史仓/);
});

test('wanjia history query exposes a visible result message instead of silently repainting an empty range', () => {
  const container = { innerHTML: '' };
  render(container, {
    wanjiaOps: {
      status: {}, kpis: [], historicalReference: null, urgentMerchants: [], merchants: [], filteredMerchants: [], opportunities: [],
      filterOptions: { industries: [], cooperationTypes: [], owners: [] }, filters: {},
      history: {
        range: { preset: 'today', startDate: '2026-08-08', endDate: '2026-08-08' }, filters: {}, allRows: [], rows: [],
        availability: { state: 'missing', label: '数据缺失' }, insufficient: true,
        message: '历史数据积累中：对应日期尚无已校验的本地历史数据。',
        queryFeedback: '已应用查询：2026-08-08 至 2026-08-08。暂无已校验历史数据，因此没有新的图表或排行。',
      },
    },
  });
  assert.match(container.innerHTML, /data-wanjia-history-feedback/);
  assert.match(container.innerHTML, /暂无已校验历史数据，因此没有新的图表或排行/);
  assert.match(container.innerHTML, /aria-live="polite"/);
});
