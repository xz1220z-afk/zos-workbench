import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const indexHtml = await readFile(new URL('index.html', root), 'utf8');

test('desktop and mobile navigation expose the approved CEO OS information architecture', () => {
  const required = [
    'dashboard', 'decisions', 'today', 'local-life', 'spark-media', 'enterprise',
    'targets', 'health', 'zos-brain', 'risk', 'inbox', 'tasks', 'settings',
  ];
  const targets = new Set([...indexHtml.matchAll(/data-page="([^"]+)"/g)].map(([, page]) => page));
  const pages = new Set([...indexHtml.matchAll(/id="page-([^"]+)"/g)].map(([, page]) => page));
  required.forEach((page) => {
    assert.equal(targets.has(page), true, `${page} must be navigable`);
    assert.equal(pages.has(page), true, `${page} must have a page`);
  });

  const bottom = indexHtml.match(/<nav class="bottom-nav" id="bottomNav">([\s\S]*?)<\/nav>/)?.[1] || '';
  const labels = [...bottom.matchAll(/<button[^>]*class="bottom-nav-item[^>]*>[\s\S]*?<span[^>]*>[\s\S]*?<\/span>\s*([^<]+?)\s*<\/button>/g)]
    .map(([, label]) => label.trim());
  assert.deepEqual(labels, ['今日', '日历', '添加', '专注', '更多']);
});

test('HTML is a modular shell with external design and application entrypoints', () => {
  assert.match(indexHtml, /<link rel="stylesheet" href="assets\/app\.css"\s*\/?>/);
  assert.match(indexHtml, /<script type="module" src="src\/app\.mjs\?v=1\.7\.4"><\/script>/);
  assert.doesNotMatch(indexHtml, /<style>/);
  assert.doesNotMatch(indexHtml, /<script type="module">[\s\S]*?\/functions\/v1\/zos-business-data/);
});

test('responsive CSS preserves dark tokens, safe areas and four-device touch contracts', async () => {
  const css = await readFile(new URL('assets/app.css', root), 'utf8');
  ['--cc-background', '--cc-panel', '--cc-border', '--cc-text', '--cc-accent-gold', '--cc-success', '--cc-warning', '--cc-risk']
    .forEach((token) => assert.match(css, new RegExp(token)));
  assert.match(css, /min-height:\s*44px/);
  assert.match(css, /env\(safe-area-inset-bottom\)/);
  assert.match(css, /@media\s*\(max-width:\s*375px\)/);
  assert.match(css, /@media\s*\(min-width:\s*768px\)/);
  assert.match(css, /@media\s*\(min-width:\s*1280px\)/);
  assert.doesNotMatch(css, /\.v13-mobile-dashboard\s*\{\s*display:\s*block/, 'mobile must not duplicate the responsive CEO dashboard');
});

test('mobile dashboard follows the action-first order and never embeds sample KPIs', async () => {
  const source = await readFile(new URL('src/app/views/mobile-view.mjs', root), 'utf8');
  const order = ['mobile-decisions', 'mobile-today', 'mobile-business-exceptions', 'mobile-quick-capture', 'mobile-target-gaps', 'mobile-health'];
  let previous = -1;
  for (const id of order) {
    const position = source.indexOf(id);
    assert.ok(position > previous, `${id} must follow the approved mobile order`);
    previous = position;
  }
  assert.doesNotMatch(source, /(?:GMV|营业额|回款)[^\n]{0,40}(?:482600|243700|183700)/);
});

test('views render explicit loading, empty, stale, failed and conflict states', async () => {
  const files = ['view-utils.mjs', 'dashboard-view.mjs', 'decision-view.mjs', 'targets-view.mjs', 'health-view.mjs', 'business-view.mjs'];
  const source = (await Promise.all(files.map((file) => readFile(new URL(`src/app/views/${file}`, root), 'utf8')))).join('\n');
  ['loading', 'empty', 'stale', 'failed', 'conflict'].forEach((state) => assert.match(source, new RegExp(`['"]${state}['"]`)));
  assert.match(source, /预览更新/);
  assert.match(source, /确认执行/);
});
