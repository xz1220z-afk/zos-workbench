import test from 'node:test';
import assert from 'node:assert/strict';
import {
  MOBILE_PRIMARY_ITEMS,
  buildMobileMoreGroups,
  mobilePrimaryPage,
} from '../src/app/mobile-navigation.mjs';

test('mobile navigation exposes Today, Calendar, Voice, Agent and More without dropping old routes', () => {
  assert.deepEqual(MOBILE_PRIMARY_ITEMS.map((item) => item.id), ['today', 'calendar', 'voice', 'agent-workbench', 'more']);
  assert.equal(mobilePrimaryPage('agent-workbench'), 'agent-workbench');
  assert.equal(mobilePrimaryPage('local-life'), 'more');
  const groups = buildMobileMoreGroups({ recentPages: ['local-life'], pinnedPages: ['intelligence'] });
  const routes = groups.flatMap((group) => group.items.map((item) => item.pageId));
  for (const pageId of ['dashboard', 'decisions', 'local-life', 'spark-media', 'lingli', 'intelligence', 'tasks', 'zos-brain', 'settings']) {
    assert.equal(routes.includes(pageId), true, pageId);
  }
});
