import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const indexHtml = await readFile(new URL('../index.html', import.meta.url), 'utf8');

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

test('mobile navigation has five primary destinations and routes secondary pages through More', () => {
  const bottomNav = indexHtml.match(/<nav class="bottom-nav" id="bottomNav">([\s\S]*?)<\/nav>/)?.[1] || '';
  const mobileLabels = [...bottomNav.matchAll(/<button class="bottom-nav-item[^>]*>[\s\S]*?<span class="bn-icon">[\s\S]*?<\/span>\s*([^<\s][^<]*?)\s*<\/button>/g)]
    .map(([, label]) => label.trim());

  assert.deepEqual(mobileLabels, ['首页', '行动', '业务', '项目', '更多'],
    'mobile navigation must expose the agreed five destinations');
  assert.match(indexHtml, /id="mobileMoreMenu"[\s\S]*?data-page="zos-brain"[\s\S]*?data-page="risk"[\s\S]*?data-page="settings"/,
    'More must keep knowledge, risk, and settings routes reachable');
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
