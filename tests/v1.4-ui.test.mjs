import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const css = await readFile(new URL('assets/app.css', root), 'utf8');

test('v1.4 navigation exposes double homes, three companies and shared centers', () => {
  const required = ['dashboard', 'life', 'lingli', 'calendar', 'intelligence', 'search', 'relations', 'reviews'];
  const targets = new Set([...html.matchAll(/data-page="([^"]+)"/g)].map(([, page]) => page));
  const pages = new Set([...html.matchAll(/id="page-([^"]+)"/g)].map(([, page]) => page));
  required.forEach((page) => {
    assert.equal(targets.has(page), true, `${page} must be navigable`);
    assert.equal(pages.has(page), true, `${page} must have a page`);
  });
  assert.match(html, /工作首页/);
  assert.match(html, /生活首页/);
  assert.match(html, /情报中心/);
  assert.match(html, /玲丽教育/);
});

test('mobile primary navigation dedicates a slot to calendar', () => {
  const bottom = html.match(/<nav class="bottom-nav" id="bottomNav">([\s\S]*?)<\/nav>/)?.[1] || '';
  const labels = [...bottom.matchAll(/<button[^>]*class="bottom-nav-item[^>]*>[\s\S]*?<span[^>]*>[\s\S]*?<\/span>\s*([^<]+?)\s*<\/button>/g)]
    .map(([, label]) => label.trim());
  assert.deepEqual(labels, ['首页', '决策', '行动', '日历', '更多']);
  const more = html.match(/id="mobileMoreMenu"[\s\S]*?<\/section>/)?.[0] || '';
  for (const page of ['local-life', 'spark-media', 'lingli', 'intelligence', 'life', 'search', 'relations', 'reviews']) {
    assert.match(more, new RegExp(`data-page="${page}"`), `${page} must remain reachable on mobile`);
  }
});

test('v1.4 visual system includes work-life mode, intelligence and calendar contracts', () => {
  for (const selector of ['workspace-switch', 'intelligence-card', 'calendar-grid', 'company-cockpit', 'global-search']) {
    assert.match(css, new RegExp(`\\.${selector}`));
  }
  assert.match(css, /@media\s*\(max-width:\s*390px\)/);
  assert.match(css, /overflow-x:\s*hidden/);
  assert.match(css, /\.zos-command #page-dashboard > \.command-center-hero[\s\S]{0,180}display:\s*none/);
});

test('calendar, intelligence and review controls expose executable application actions', async () => {
  const app = await readFile(new URL('src/app.mjs', root), 'utf8');
  assert.match(html, /data-calendar-capture/);
  assert.match(app, /data-calendar-view/);
  assert.match(app, /data-intelligence-company/);
  assert.match(app, /data-review-draft/);
});
