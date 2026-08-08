import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const view = await readFile(new URL('../src/app/views/dashboard-view.mjs', import.meta.url), 'utf8');

test('dashboard uses one quiet source summary with expandable details', () => {
  assert.match(view, /<details class="v15-sync-disclosure"/);
  assert.match(view, /<summary>[\s\S]*数据自动更新/);
  assert.match(view, /class="v15-sync-sources"/);
  assert.match(view, /data-refresh-all/);
});

test('dashboard hero has one dominant action and secondary content is grouped', () => {
  const hero = view.match(/<section class="v14-hero[^\"]*"[^>]*>([\s\S]*?)<\/section>/)?.[1] || '';
  assert.equal((hero.match(/v13-action-primary/g) || []).length, 1);
  assert.match(hero, /v14-quick-menu/);
  assert.match(view, /class="v14-secondary-region"/);
});
