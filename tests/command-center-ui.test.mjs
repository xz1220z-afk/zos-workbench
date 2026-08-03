import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

const [shellHtml, legacySource, appCss] = await Promise.all([
  readFile(new URL('../index.html', import.meta.url), 'utf8'),
  readFile(new URL('../src/legacy-app.mjs', import.meta.url), 'utf8'),
  readFile(new URL('../assets/app.css', import.meta.url), 'utf8'),
]);
const indexHtml = `${shellHtml}\n${legacySource}\n${appCss}`;

test('CEO command center renders source-aware sections and all data states without sample business KPIs', () => {
  assert.match(indexHtml, /function renderCommandCenter\s*\(/,
    'dashboard must render the command center from current application state');
  assert.match(indexHtml, /function renderStatusCard\s*\(/,
    'dashboard must use a single explicit status-card renderer for unavailable sources');
  ['已同步', '待同步', '待确认', '读取失败'].forEach((label) => {
    assert.match(indexHtml, new RegExp(label), `dashboard must expose the ${label} state`);
  });
  assert.doesNotMatch(indexHtml, /(?:GMV|营业额|支付额|回款)[^<]{0,60}>\s*(?:\d{2,}|¥|￥)/,
    'business KPIs must come from the read-only business payload, never dashboard sample values');
});

test('selected business refresh preserves the other cached source', () => {
  assert.match(indexHtml, /if \(source === 'wanjia'\) \{\s*cache\.wanjia =/,
    'a 万嘉-only response must not replace the 花火 cache entry');
  assert.match(indexHtml, /else if \(source === 'huahuo'\) \{\s*cache\.huahuo =/,
    'a 花火-only response must not replace the 万嘉 cache entry');
});

function runtimeFunction(name, nextName) {
  const start = indexHtml.indexOf('function ' + name + '(');
  const end = indexHtml.indexOf('function ' + nextName + '(', start);
  assert.notEqual(start, -1, name + ' must be defined');
  assert.notEqual(end, -1, name + ' must have a stable runtime boundary');
  return vm.runInNewContext(indexHtml.slice(start, end) + '; ' + name);
}

test('business summary validation rejects metadata-only payloads but accepts demonstrable zeroes', () => {
  const hasBusinessSummary = runtimeFunction('hasBusinessSummary', 'businessSummaryMissingFields');

  assert.equal(hasBusinessSummary('wanjia', { mode: 'read_only' }), false);
  assert.equal(hasBusinessSummary('huahuo', {}), false);
  assert.equal(hasBusinessSummary('wanjia', { totalMerchants: 0, activeMerchants: 0, paymentGmv: 0 }), true);
  assert.equal(hasBusinessSummary('huahuo', { activeProjects: 0, pendingDeliveries: 0, receivedAmount: 0 }), true);
  assert.equal(hasBusinessSummary('wanjia', { totalMerchants: 1, activeMerchants: undefined }), false);
});

function detailPageRenderer(cache) {
  const start = indexHtml.indexOf('function hasBusinessSummary(');
  const end = indexHtml.indexOf('async function refreshBusinessData(', start);
  assert.notEqual(start, -1, 'detail-page validation helpers must be defined');
  assert.notEqual(end, -1, 'detail-page renderer must be available');
  const values = {};
  const elements = Object.fromEntries([
    'wanjiaDataStatus', 'huahuoDataStatus', 'brainDataStatus', 'wanjiaDataEmpty', 'huahuoDataEmpty',
    'wanjiaMerchantCount', 'wanjiaActiveMerchantCount', 'wanjiaPaymentGmv',
    'huahuoActiveProjects', 'huahuoPendingDeliveries', 'huahuoReceivedAmount',
  ].map((id) => [id, { textContent: '', style: {} }]));
  const renderBusinessDataStates = vm.runInNewContext(indexHtml.slice(start, end) + '; renderBusinessDataStates', {
    businessDataCache: () => cache,
    businessConnectionMessage: () => '待同步',
    setBusinessValue: (id, value) => { values[id] = value; },
    displayCurrency: (value) => '¥' + value,
    renderRecordList: () => {}, renderSourceRails: () => {}, renderCommandCenter: () => {},
    loadVal: (key) => key === 'zos_business_data_cache_v1' ? JSON.stringify(cache) : '{}',
    KEYS: { SYNC_SESSION: 'sync-session' },
    commandCenterReadErrors: {},
    window: {},
    document: { getElementById: (id) => elements[id] || null, querySelectorAll: () => [] },
  });
  return { renderBusinessDataStates, values, elements };
}

test('detail pages keep incomplete summaries pending with dashes while rendering proven zeroes', () => {
  const incomplete = detailPageRenderer({
    wanjia: { summary: { mode: 'read_only' }, fetchedAt: '2026-08-02T00:00:00.000Z' },
    huahuo: { summary: {}, fetchedAt: '2026-08-02T00:00:00.000Z' },
  });
  incomplete.renderBusinessDataStates();
  assert.deepEqual(
    [incomplete.elements.wanjiaMerchantCount.textContent, incomplete.elements.wanjiaActiveMerchantCount.textContent, incomplete.elements.wanjiaPaymentGmv.textContent,
      incomplete.elements.huahuoActiveProjects.textContent, incomplete.elements.huahuoPendingDeliveries.textContent, incomplete.elements.huahuoReceivedAmount.textContent],
    ['—', '—', '—', '—', '—', '—'],
  );
  assert.match(incomplete.elements.wanjiaDataStatus.textContent, /待确认.*缺少字段/);
  assert.match(incomplete.elements.huahuoDataStatus.textContent, /待确认.*缺少字段/);

  const zeroes = detailPageRenderer({
    wanjia: { summary: { totalMerchants: 0, activeMerchants: 0, paymentGmv: 0 }, fetchedAt: '2026-08-02T00:00:00.000Z' },
    huahuo: { summary: { activeProjects: 0, pendingDeliveries: 0, receivedAmount: 0 }, fetchedAt: '2026-08-02T00:00:00.000Z' },
  });
  zeroes.renderBusinessDataStates();
  assert.deepEqual(
    [zeroes.elements.wanjiaMerchantCount.textContent, zeroes.elements.wanjiaActiveMerchantCount.textContent, zeroes.elements.wanjiaPaymentGmv.textContent,
      zeroes.elements.huahuoActiveProjects.textContent, zeroes.elements.huahuoPendingDeliveries.textContent, zeroes.elements.huahuoReceivedAmount.textContent],
    ['0', '0', '¥0', '0', '0', '¥0'],
  );
});

test('mobile navigation has five primary destinations and routes secondary pages through More', () => {
  const bottomNav = indexHtml.match(/<nav class="bottom-nav" id="bottomNav">([\s\S]*?)<\/nav>/)?.[1] || '';
  const mobileLabels = [...bottomNav.matchAll(/<button class="bottom-nav-item[^>]*>[\s\S]*?<span class="bn-icon">[\s\S]*?<\/span>\s*([^<\s][^<]*?)\s*<\/button>/g)]
    .map(([, label]) => label.trim());

  assert.deepEqual(mobileLabels, ['今日', '日历', '添加', '专注', '更多'],
    'mobile navigation must expose the agreed five destinations');
  assert.match(indexHtml, /id="mobileMoreMenu"[\s\S]*?data-page="enterprise"[\s\S]*?data-page="targets"[\s\S]*?data-page="health"[\s\S]*?data-page="zos-brain"[\s\S]*?data-page="risk"[\s\S]*?data-page="settings"/,
    'More must keep projects, targets, health, knowledge, risk, and settings routes reachable');
  assert.match(indexHtml, /\.bottom-nav-item:focus-visible[\s\S]{0,180}outline:/,
    'mobile navigation must expose a visible keyboard focus indicator');
  assert.match(indexHtml, /\.bottom-nav-item[\s\S]{0,180}min-height:\s*44px/,
    'mobile navigation touch targets must be at least 44px tall');
});

test('selecting a More route moves focus out of the menu before it becomes hidden', () => {
  assert.match(indexHtml, /function focusPageContent\(target\)[\s\S]{0,360}focus\(/,
    'a More route must have an explicit page-focus handoff');
  assert.match(indexHtml, /function navigateTo\(pageId, options\)[\s\S]{0,980}options\.focusPage[\s\S]{0,120}focusPageContent\(target\)/,
    'navigation must apply the requested page-focus handoff after changing pages');
  assert.match(indexHtml, /\.mobile-more-item\[data-page\][\s\S]{0,240}navigateTo\(this\.dataset\.page, \{ focusPage: true \}\)/,
    'More item selection must request the page-focus handoff');
});
