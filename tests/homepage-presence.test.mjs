import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { buildWorkHomepagePresence, buildLifeHomepagePresence } from '../src/app/homepage-presence.mjs';
import { render as renderDashboard } from '../src/app/views/dashboard-view.mjs';
import { render as renderLife } from '../src/app/views/life-view.mjs';

test('work presence prioritizes CEO decisions over lower-priority signals', () => {
  const result = buildWorkHomepagePresence({
    decisions: [{ id: 'd-1', title: '确认报价' }],
    importantDates: { work: [{ id: 'w-1', title: '交付', days: 1 }] },
    todayTop3: [{ id: 't-1', title: '准备方案' }],
  });
  assert.equal(result.title, '今天有 1 件事需要你拍板');
  assert.equal(result.primaryAction.target, 'decisions');
});

test('life presence names upcoming dates without exposing a private title', () => {
  const result = buildLifeHomepagePresence({
    importantDates: { life: [{ id: 'l-1', title: '纪念日', days: 3 }] },
    lifeNextSevenDays: [], rituals: [], life: [],
  });
  assert.equal(result.title, '未来 7 天有 1 个值得提前准备的日子');
  assert.equal(result.primaryAction.target, 'important-dates');
  assert.doesNotMatch(result.summary, /纪念日/);
});

test('both presences fall back to non-slogan states when records are empty', () => {
  assert.equal(buildWorkHomepagePresence({}).title, '今天的节奏已排好');
  assert.equal(buildLifeHomepagePresence({}).title, '今天可以给自己留一点空间');
});

test('dashboard and life views render dynamic briefs through existing actions', () => {
  const work = { innerHTML: '' };
  renderDashboard(work, {
    decisions: [{ id: 'd-1', title: '确认报价', status: 'open', requiresCeoDecision: true }], importantDates: { work: [] }, todayTop3: [],
    autoRefresh: {}, companyOperating: {}, mustRead: [], health: [], calendar: [], weather: {},
  });
  assert.match(work.innerHTML, /今天有 1 件事需要你拍板/);
  assert.match(work.innerHTML, /data-page="decisions"/);
  assert.doesNotMatch(work.innerHTML, /今天，先处理最重要的事/);

  const life = { innerHTML: '' };
  renderLife(life, { importantDates: { life: [] }, lifeNextSevenDays: [], rituals: [], life: [] });
  assert.match(life.innerHTML, /今天可以给自己留一点空间/);
  assert.doesNotMatch(life.innerHTML, /把生活安排好，工作才有稳定的能量/);
});

test('dashboard hero counts only unresolved CEO decisions instead of resolved history', () => {
  const work = { innerHTML: '' };
  const decisions = [
    { id: 'active', status: 'open', requiresCeoDecision: true, title: '待拍板事项' },
    ...Array.from({ length: 343 }, (_, index) => ({ id: `resolved-${index}`, status: 'resolved', title: '已解除历史' })),
  ];
  renderDashboard(work, {
    decisions, importantDates: { work: [] }, todayTop3: [], autoRefresh: {}, companyOperating: {},
    mustRead: [], health: [], calendar: [], weather: {}, businessExceptions: [], calendarConflicts: [],
  });
  assert.match(work.innerHTML, /今天有 1 件事需要你拍板/);
  assert.doesNotMatch(work.innerHTML, /今天有 344 件事需要你拍板/);
});

test('homepage material has a readable fallback and reduced-motion override', async () => {
  const css = await readFile(new URL('../assets/app.css', import.meta.url), 'utf8');
  assert.match(css, /\.v25-glass-hero[\s\S]*background:/);
  assert.match(css, /@supports \(backdrop-filter: blur\(1px\)\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.v25-glass-hero/);
});

test('delegated page navigation does not request a second full render after legacy navigation', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const branch = source.match(/else if \(pageButton && globalThis\.window\?\.navigateTo\) \{([\s\S]*?)\n        \}/)?.[1] || '';
  assert.match(branch, /globalThis\.window\.navigateTo\(pageButton\.dataset\.page\)/);
  assert.doesNotMatch(branch, /renderAll\(\)/);
});

test('history query applies range and filters in one render pass', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  const branch = source.match(/if \(event\.target\?\.matches\?\.\('\[data-wanjia-history-form\]'\)\) \{([\s\S]*?)\n      \}/)?.[1] || '';
  assert.match(branch, /applyWanjiaHistoryQuery\(/);
  assert.doesNotMatch(branch, /setWanjiaHistoryRange\(/);
  assert.doesNotMatch(branch, /setWanjiaHistoryFilters\(/);
});
