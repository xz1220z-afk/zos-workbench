import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication } from '../src/app.mjs';
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
  incoming.state.collections.tasks = [{ id: 'restored', title: '从备份恢复', revision: 2 }];
  const { createDurableBackup } = await import('../src/app/data-durability.mjs');
  const validIncoming = createDurableBackup({ state: incoming.state, createdAt: '2026-08-01T00:00:00.000Z' });

  const preview = app.previewBackupText(JSON.stringify(validIncoming));
  assert.equal(preview.summary.totalRecords, 1);
  await app.importBackupText(JSON.stringify(validIncoming));
  assert.deepEqual(store.load().collections.tasks.map((item) => item.id).sort(), ['current-only', 'restored']);
  assert.equal((await snapshots.latest('pre-import'))?.kind, 'pre-import');

  await app.undoLastRestore();
  assert.deepEqual(store.load().collections.tasks.map((item) => item.id), ['current-only']);
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
