import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication, persistSyncMeta } from '../src/app.mjs';
import { createDurableBackup } from '../src/app/data-durability.mjs';
import { createStateStore } from '../src/app/state-store.mjs';
import { createMemorySnapshotAdapter, createSnapshotRepository } from '../src/app/snapshot-repository.mjs';

function memoryStorage() {
  const values = new Map([['zos_device_id', 'mac-1']]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('application reliability actions snooze, restore, test reminders and export a credential-free backup', async () => {
  let tick = 0;
  const storage = memoryStorage();
  const store = createStateStore({
    storage, deviceId: 'mac-1', createId: () => `id-${tick++}`,
    now: () => '2026-08-06T08:00:00.000Z',
  });
  const task = store.saveEntity('tasks', { id: 'task-1', title: '核对回款', password: 'never' });
  store.deleteEntity('tasks', task.id);
  const downloads = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    now: () => '2026-08-06T08:00:00.000Z',
    downloadBackup: (value) => downloads.push(value),
    operatingRuntime: {
      syncController: { getStatus: () => ({ phase: 'complete' }), getConflicts: () => [] },
      pushClient: { test: async () => ({ state: 'sent' }) },
      session: { userId: 'user-1' },
    },
  });

  app.restoreReliabilityItem('tasks', 'task-1');
  const reminder = app.viewModel().reminderQueue.find((item) => item.sourceType === 'task');
  assert.equal(reminder?.actionId, 'task-1');
  assert.equal(reminder?.snoozable, true);
  const snoozed = app.snoozeReminder('tasks', 'task-1', '10m');
  assert.equal(snoozed.reminderAt, '2026-08-06T08:10:00.000Z');
  assert.equal((await app.testReminderDelivery()).state, 'sent');
  const backup = app.exportSafeBackup();
  assert.equal(downloads.length, 1);
  assert.doesNotMatch(JSON.stringify(backup), /password|never/);
  assert.ok(app.viewModel().auditLog.some((item) => item.action === 'snooze'));
});

test('failed durable reminder scheduling is queued for a forced retry and cleared on stop', async () => {
  const source = await readFile(new URL('../src/app.mjs', import.meta.url), 'utf8');
  assert.match(source, /queueReminderScheduleRetry\(\)/);
  assert.match(source, /scheduleDurableReminders\(\{ force: true \}\)/);
  assert.match(source, /clearTimeout\?\.\(reminderScheduleRetryTimer\)/);
});

test('application imports with a required checkpoint, preserves current-only data and can undo', async () => {
  let tick = 0;
  const storage = memoryStorage();
  const store = createStateStore({
    storage, deviceId: 'mac-1', createId: () => `id-${tick++}`,
    now: () => '2026-08-07T02:00:00.000Z',
  });
  store.saveEntity('tasks', { id: 'current-only', title: '保留当前' });
  const snapshots = createSnapshotRepository({
    adapter: createMemorySnapshotAdapter(),
    now: () => '2026-08-07T02:00:00.000Z', createId: () => `snapshot-${tick++}`,
  });
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage, store, snapshotRepository: snapshots, createOperatingRuntime: false,
    now: () => '2026-08-07T02:00:00.000Z',
  });
  const incoming = app.exportSafeBackup();
  incoming.state.collections.tasks = [
    { id: 'current-only', title: '备份中的旧标题', revision: 2 },
    { id: 'restored', title: '从备份恢复', revision: 2 },
  ];
  const validIncoming = createDurableBackup({ state: incoming.state, createdAt: '2026-08-01T00:00:00.000Z' });

  const preview = app.previewBackupText(JSON.stringify(validIncoming));
  assert.equal(preview.summary.totalRecords, 2);
  await app.importBackupText(JSON.stringify(validIncoming));
  assert.deepEqual(store.load().collections.tasks.map((item) => item.id).sort(), ['current-only', 'restored']);
  assert.equal(store.load().collections.tasks.find((item) => item.id === 'current-only').title, '备份中的旧标题');
  assert.equal((await snapshots.latest('pre-import'))?.kind, 'pre-import');

  await app.undoLastRestore();
  assert.deepEqual(store.load().collections.tasks.map((item) => item.id).sort(), ['current-only', 'restored']);
  assert.equal(store.load().collections.tasks.find((item) => item.id === 'current-only').title, '保留当前');
});

test('application fails closed when the pre-import checkpoint cannot be created', async () => {
  const storage = memoryStorage();
  const store = createStateStore({ storage, deviceId: 'mac-1', createId: () => 'id-1', now: () => '2026-08-07T02:00:00.000Z' });
  store.saveEntity('tasks', { id: 'keep', title: '不能丢' });
  const snapshots = createSnapshotRepository({ adapter: null });
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    snapshotRepository: snapshots, createOperatingRuntime: false,
  });
  const backup = app.exportSafeBackup();
  await assert.rejects(() => app.importBackupText(JSON.stringify(backup)), /snapshot_storage_unavailable/);
  assert.deepEqual(store.load().collections.tasks.map((item) => item.id), ['keep']);
});

test('complete backup includes newer legacy workspace records and restore mirrors them for old pages', async () => {
  const storage = memoryStorage();
  const store = createStateStore({
    storage, deviceId: 'mac-1', createId: () => 'generated-id',
    now: () => '2026-08-07T01:00:00.000Z',
  });
  store.saveEntity('tasks', {
    id: 'shared', title: '统一状态旧标题', revision: 2,
    updatedAt: '2026-08-07T01:00:00.000Z',
  });
  store.saveEntity('tasks', {
    id: 'modular-only', title: '新版页面记录', revision: 1,
    updatedAt: '2026-08-07T01:00:00.000Z',
  });
  storage.setItem('zos_tasks', JSON.stringify([
    { id: 'shared', title: '旧页面最新标题', revision: 4, updatedAt: '2026-08-07T02:00:00.000Z' },
    { id: 'legacy-only', title: '旧页面新增记录', revision: 1, updatedAt: '2026-08-07T02:00:00.000Z' },
  ]));
  const snapshots = createSnapshotRepository({ adapter: createMemorySnapshotAdapter() });
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    snapshotRepository: snapshots, createOperatingRuntime: false,
    now: () => '2026-08-07T03:00:00.000Z',
  });

  const backup = app.exportSafeBackup();
  assert.deepEqual(backup.state.collections.tasks.map((item) => item.id).sort(), ['legacy-only', 'modular-only', 'shared']);
  assert.equal(backup.state.collections.tasks.find((item) => item.id === 'shared').title, '旧页面最新标题');

  const incoming = createDurableBackup({
    state: { collections: { tasks: [{ id: 'restored', title: '恢复后旧页面可见', revision: 1 }] } },
    createdAt: '2026-08-01T00:00:00.000Z',
  });
  await app.importBackupText(JSON.stringify(incoming));
  assert.ok(JSON.parse(storage.getItem('zos_tasks')).some((item) => item.id === 'restored'));
});

test('upgrade checkpoint captures the state from before startup migration', async () => {
  const storage = memoryStorage();
  const store = createStateStore({ storage, deviceId: 'mac-1', createId: () => 'generated-id', now: () => '2026-08-07T04:00:00.000Z' });
  store.saveEntity('tasks', { id: 'after-startup', title: '启动后的状态' });
  const snapshots = createSnapshotRepository({
    adapter: createMemorySnapshotAdapter(), now: () => '2026-08-07T04:00:00.000Z', createId: () => 'upgrade-snapshot',
  });
  let deferred;
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store, snapshotRepository: snapshots,
    preUpgradeState: { collections: { tasks: [{ id: 'before-startup', title: '升级前状态' }] } },
    createOperatingRuntime: false, deferSafetyWork: (callback) => { deferred = callback; },
    now: () => '2026-08-07T04:00:00.000Z',
  });
  await app.start();
  await deferred();
  assert.deepEqual((await snapshots.latest('upgrade')).backup.state.collections.tasks.map((item) => item.id), ['before-startup']);
  app.stop();
});

test('sync metadata keeps the last success during attention states and storage failures never break sync UI', () => {
  const writes = [];
  assert.deepEqual(persistSyncMeta({ setItem: (key, value) => writes.push([key, value]) }, {
    phase: 'needs-attention', lastSuccessAt: '2026-08-07T03:00:00.000Z',
  }), { lastSuccessAt: '2026-08-07T03:00:00.000Z' });
  assert.equal(writes.length, 1);
  assert.equal(persistSyncMeta({ setItem: () => { throw new Error('quota'); } }, {
    phase: 'complete', lastSuccessAt: '2026-08-07T03:00:00.000Z',
  }), null);
});
