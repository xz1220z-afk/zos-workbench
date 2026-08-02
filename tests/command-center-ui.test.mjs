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
