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
