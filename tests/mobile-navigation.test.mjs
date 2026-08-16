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

test('static More markup and the navigation model expose exactly the same routes', () => {
  const moreMenu = html.match(/<section class="mobile-more-menu" id="mobileMoreMenu"[\s\S]*?<\/section>/)?.[0] || '';
  const staticRoutes = [...moreMenu.matchAll(/class="mobile-more-item" data-page="([^"]+)"/g)].map(([, pageId]) => pageId);
  const modelRoutes = buildMobileMoreGroups().flatMap((group) => group.items.map((item) => item.pageId));
  assert.deepEqual(staticRoutes, modelRoutes);
});
