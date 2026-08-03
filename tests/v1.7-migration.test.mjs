import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createStateStore, STATE_STORAGE_KEYS } from '../src/app/state-store.mjs';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

test('v1.4 private state upgrades to v1.7 and accepts focus and countdown entities', () => {
  const storage = memoryStorage({
    zos_ceo_os_state_v1_4: JSON.stringify({
      schemaVersion: '1.4', deviceId: 'device-old', tombstones: [],
      collections: {
        tasks: [{
          id: 'task-1', title: '保留任务', revision: 4,
          createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
          deletedAt: null, deviceId: 'device-old',
        }],
      },
    }),
    zos_ceo_os_base_revisions_v1_4: JSON.stringify({ 'tasks:task-1': 4 }),
  });
  let id = 0;
  const store = createStateStore({
    storage, deviceId: 'device-new',
    now: () => '2026-08-03T00:00:00.000Z', createId: () => `new-${++id}`,
  });

  assert.equal(store.load().schemaVersion, '1.7');
  assert.equal(store.load().collections.tasks[0].revision, 4);
  assert.deepEqual(store.loadBaseRevisions(), { 'tasks:task-1': 4 });
  store.saveEntity('focus_sessions', { taskId: 'task-1', state: 'planned' });
  store.saveEntity('countdowns', { title: '项目交付', date: '2026-08-10' });
  assert.equal(store.load().collections.focus_sessions.length, 1);
  assert.equal(store.load().collections.countdowns.length, 1);
  assert.equal(STATE_STORAGE_KEYS.state, 'zos_ceo_os_state_v1_7');
});

test('migration 007 permits v1.7 entities while retaining owner-only policies', async () => {
  const sql = await readFile(new URL('../supabase/migrations/007_execution_query_v1_7.sql', import.meta.url), 'utf8');
  assert.match(sql, /focus_sessions/);
  assert.match(sql, /countdowns/);
  assert.match(sql, /auth\.uid\(\)\)\s*=\s*user_id/i);
  assert.doesNotMatch(sql, /service_role|public\s+using\s*\(true\)/i);
});
