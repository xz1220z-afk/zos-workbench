import test from 'node:test';
import assert from 'node:assert/strict';

import { createStateStore } from '../src/app/state-store.mjs';

function memoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    snapshot() { return Object.fromEntries(values); },
  };
}

const oldTask = {
  id: 'task-existing', title: '保留旧任务', revision: 7,
  createdAt: '2026-07-30T01:00:00.000Z', updatedAt: '2026-08-01T01:00:00.000Z',
  deletedAt: null, deviceId: 'old-device',
};
const oldTombstone = {
  id: 'task-deleted', title: '已删除任务', revision: 5,
  createdAt: '2026-07-29T01:00:00.000Z', updatedAt: '2026-08-01T02:00:00.000Z',
  deletedAt: '2026-08-01T02:00:00.000Z', deviceId: 'old-device', entity: 'tasks',
};

test('v1.2.3 keys migrate once without losing identities, revisions or tombstones', () => {
  const storage = memoryStorage({
    zos_tasks: JSON.stringify([oldTask]),
    zos_inbox: '[]', zos_projects: '[]', zos_commands: '[]',
    zos_tombstones: JSON.stringify([oldTombstone]),
    zos_device_id: 'legacy-device',
  });
  const store = createStateStore({
    storage, now: () => '2026-08-02T00:00:00.000Z',
    deviceId: 'new-device', createId: () => 'generated-id',
  });

  const state = store.load();
  assert.equal(state.collections.tasks[0].id, 'task-existing');
  assert.equal(state.collections.tasks[0].revision, 7);
  assert.equal(state.tombstones[0].id, 'task-deleted');
  assert.equal(state.tombstones[0].revision, 5);
  assert.equal(state.deviceId, 'legacy-device');

  const second = store.load();
  assert.deepEqual(second, state);
});

test('credentials and sessions are never copied into domain state', () => {
  const storage = memoryStorage({
    zos_tasks: JSON.stringify([{ id: 'unsafe', title: 'x', password: 'no', access_token: 'no', nested: { refreshToken: 'no', safe: 'yes' } }]),
    zos_supabase_session: JSON.stringify({ accessToken: 'access', refreshToken: 'refresh', userId: 'user-1' }),
    zos_supabase_config: JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'public-anon' }),
  });
  const store = createStateStore({
    storage, now: () => '2026-08-02T00:00:00.000Z',
    deviceId: 'device-1', createId: () => 'generated-id',
  });

  const serialized = JSON.stringify(store.load());
  assert.doesNotMatch(serialized, /password|access_token|accessToken|refreshToken|public-anon|\baccess\b|\brefresh\b/);
  assert.match(storage.getItem('zos_supabase_session'), /accessToken/);
});

test('save, delete and snapshot replacement preserve sync metadata and notify subscribers', () => {
  const storage = memoryStorage();
  let sequence = 0;
  const store = createStateStore({
    storage, now: () => `2026-08-02T00:00:0${sequence++}.000Z`,
    deviceId: 'device-1', createId: () => `id-${sequence}`,
  });
  const notices = [];
  const unsubscribe = store.subscribe((state) => notices.push(state));

  const created = store.saveEntity('decisions', { title: '确认交付顺序' });
  assert.equal(created.revision, 1);
  const updated = store.saveEntity('decisions', { ...created, title: '确认最终交付顺序' });
  assert.equal(updated.id, created.id);
  assert.equal(updated.revision, 2);
  const tombstone = store.deleteEntity('decisions', updated.id);
  assert.equal(tombstone.deletedAt !== null, true);
  assert.equal(store.load().collections.decisions.length, 0);
  assert.equal(store.load().tombstones.at(-1).id, updated.id);

  store.replaceSnapshot({ collections: { targets: [oldTask] }, tombstones: [oldTombstone] });
  assert.equal(store.load().collections.targets[0].revision, 7);
  assert.ok(notices.length >= 4);
  unsubscribe();
});

test('base revisions survive reload and missing legacy bases request a full-pull fallback', () => {
  const storage = memoryStorage();
  const options = { storage, now: () => '2026-08-02T00:00:00.000Z', deviceId: 'device-1', createId: () => 'id-1' };
  const first = createStateStore(options);
  first.saveBaseRevisions({ 'targets:target-1': 4 });

  const second = createStateStore(options);
  assert.deepEqual(second.loadBaseRevisions(), { 'targets:target-1': 4 });
  assert.equal(second.needsFullPull(['decisions:missing-base']), true);
  assert.equal(second.needsFullPull(['targets:target-1']), false);
});

test('v1.3 private state migrates to v1.4 without losing records or base revisions', () => {
  const storage = memoryStorage({
    zos_ceo_os_state_v1_3: JSON.stringify({
      schemaVersion: '1.3', deviceId: 'device-old', tombstones: [oldTombstone],
      collections: { tasks: [oldTask], decisions: [], targets: [] },
    }),
    zos_ceo_os_base_revisions_v1_3: JSON.stringify({ 'tasks:task-existing': 7 }),
  });
  const store = createStateStore({ storage, now: () => '2026-08-02T00:00:00.000Z', deviceId: 'device-new', createId: () => 'new-id' });
  const state = store.load();
  assert.equal(state.schemaVersion, '1.4');
  assert.equal(state.collections.tasks[0].revision, 7);
  assert.deepEqual(state.collections.life, []);
  assert.deepEqual(state.collections.calendar, []);
  assert.deepEqual(store.loadBaseRevisions(), { 'tasks:task-existing': 7 });
});
