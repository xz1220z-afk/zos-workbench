import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  MOBILE_PRIMARY_ITEMS,
  buildMobileMoreGroups,
  mobilePrimaryPage,
} from '../src/app/mobile-navigation.mjs';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');

const RETAINED_MORE_PAGE_IDS = [
  'local-life', 'spark-media', 'lingli', 'enterprise', 'targets',
  'intelligence', 'content-growth', 'zos-brain', 'search',
  'life', 'relations', 'reviews', 'inbox', 'tasks', 'risk', 'privacy', 'settings',
  'dashboard', 'decisions', 'health', 'today', 'focus',
];

test('mobile navigation exposes Today, Calendar, Voice, Agent and More without dropping legacy routes', () => {
  assert.deepEqual(MOBILE_PRIMARY_ITEMS.map((item) => item.id), ['today', 'calendar', 'voice', 'agent-workbench', 'more']);
  assert.equal(mobilePrimaryPage('agent-workbench'), 'agent-workbench');
  assert.equal(mobilePrimaryPage('local-life'), 'more');
  const groups = buildMobileMoreGroups({ recentPages: ['local-life'], pinnedPages: ['intelligence'] });
  const routes = groups.flatMap((group) => group.items.map((item) => item.pageId));
  assert.deepEqual(routes, RETAINED_MORE_PAGE_IDS);
  assert.equal(routes.includes('agent-workbench'), false);
});

test('More mounts one dynamic group target per navigation-model group', async () => {
  const moreMenu = html.match(/<section class="mobile-more-menu" id="mobileMoreMenu"[\s\S]*?<\/section>/)?.[0] || '';
  const mountedGroupIds = [...moreMenu.matchAll(/data-mobile-more-group="([^"]+)"/g)].map(([, groupId]) => groupId);
  const modelGroupIds = buildMobileMoreGroups().map((group) => group.id);
  assert.deepEqual(mountedGroupIds, modelGroupIds);
  assert.doesNotMatch(moreMenu, /class="mobile-more-item" data-page=/);
  const app = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(app, /buildMobileMoreGroups\(/);
});
