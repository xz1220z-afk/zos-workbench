import test from 'node:test';
import assert from 'node:assert/strict';

import { pageIdFromHash } from '../src/app/router.mjs';

test('page hash resolves a known workbench route without treating Supabase auth fragments as pages', () => {
  const knownPages = new Set(['dashboard', 'calendar', 'intelligence']);
  const hasPage = (pageId) => knownPages.has(pageId);

  assert.equal(pageIdFromHash('#calendar', hasPage), 'calendar');
  assert.equal(pageIdFromHash('#intelligence', hasPage), 'intelligence');
  assert.equal(pageIdFromHash('#access_token=secret&type=magiclink', hasPage), '');
  assert.equal(pageIdFromHash('#missing', hasPage), '');
});
