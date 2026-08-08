import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import { createCeoOsApplication, persistSyncMeta } from '../src/app.mjs';
import { createDurableBackup } from '../src/app/data-durability.mjs';
import { createStateStore } from '../src/app/state-store.mjs';
import { createMemorySnapshotAdapter, createSnapshotRepository } from '../src/app/snapshot-repository.mjs';
import { buildLocalSyncInput } from '../src/sync-engine.mjs';
import { installSettingsSyncBridge } from '../src/app/settings-sync-bridge.mjs';

function memoryStorage() {
  const values = new Map([['zos_device_id', 'mac-1']]);
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('settings sync uses the signed-in modular controller instead of the quota-prone legacy inbox mirror', async () => {
  let legacyCalls = 0;
  let modularCalls = 0;
  const browserWindow = {
    async syncNow() {
      legacyCalls += 1;
      const error = new Error("Setting the value of 'zos_inbox' exceeded the quota.");
      error.name = 'QuotaExceededError';
      throw error;
    },
  };
  const application = {
    operatingRuntime: { syncController: { sync: async () => ({ phase: 'complete' }) } },
    async syncNow() {
      modularCalls += 1;
      return { phase: 'complete' };
    },
  };

  installSettingsSyncBridge({ browserWindow, application });
  const result = await browserWindow.syncNow();

  assert.deepEqual(result, { phase: 'complete' });
  assert.equal(modularCalls, 1);
  assert.equal(legacyCalls, 0);
});

test('settings sync keeps the legacy sign-in path available before a modular session exists', async () => {
  let legacyCalls = 0;
  const browserWindow = {
    async syncNow() {
      legacyCalls += 1;
      return { phase: 'login-required' };
    },
  };
  const application = {
    operatingRuntime: null,
    async syncNow() {
      throw new Error('must_not_run_without_session');
    },
  };

  installSettingsSyncBridge({ browserWindow, application });

  assert.deepEqual(await browserWindow.syncNow(), { phase: 'login-required' });
  assert.equal(legacyCalls, 1);
});

test('settings sync waits for modular startup before falling back to the legacy mirror', async () => {
  let legacyCalls = 0;
  let modularCalls = 0;
  const browserWindow = {
    async syncNow() {
      legacyCalls += 1;
      return { phase: 'login-required' };
    },
  };
  const application = {
    operatingRuntime: null,
    async whenIdle() {
      application.operatingRuntime = {
        syncController: { async sync() { return { phase: 'complete' }; } },
      };
    },
    async syncNow() {
      modularCalls += 1;
      return { phase: 'complete' };
    },
  };

  installSettingsSyncBridge({ browserWindow, application });

  assert.deepEqual(await browserWindow.syncNow(), { phase: 'complete' });
  assert.equal(modularCalls, 1);
  assert.equal(legacyCalls, 0);
});

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

test('an unrelated restore cannot leave a stale deletion marker that later removes a current live record during sync', async () => {
  const storage = memoryStorage();
  const store = createStateStore({
    storage, deviceId: 'mac-1', createId: () => 'generated-id',
    now: () => '2026-08-07T03:00:00.000Z',
  });
  store.saveEntity('tasks', {
    id: 'must-survive', title: '当前有效任务', revision: 5,
    updatedAt: '2026-08-07T02:00:00.000Z',
  });
  storage.setItem('zos_tombstones', JSON.stringify([{
    id: 'must-survive', entity: 'tasks', deletedAt: '2026-08-07T01:00:00.000Z',
    updatedAt: '2026-08-07T01:00:00.000Z', revision: 4,
  }]));
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    snapshotRepository: createSnapshotRepository({ adapter: createMemorySnapshotAdapter() }),
    createOperatingRuntime: false, now: () => '2026-08-07T03:00:00.000Z',
  });
  const incoming = createDurableBackup({
    state: { collections: { inbox: [{ id: 'unrelated', title: '无关恢复内容' }] } },
    createdAt: '2026-08-01T00:00:00.000Z',
  });

  await app.importBackupText(JSON.stringify(incoming));
  const persisted = store.load();
  const syncInput = buildLocalSyncInput(persisted);
  assert.equal(persisted.collections.tasks.some((item) => item.id === 'must-survive'), true);
  assert.equal(persisted.tombstones.some((item) => item.entity === 'tasks' && item.id === 'must-survive'), false);
  assert.equal(syncInput.tasks.find((item) => item.id === 'must-survive')?.deletedAt, null);
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
    preUpgradeRaw: {
      zos_tasks: JSON.stringify([{ id: 'before-startup', title: '升级前状态' }]),
      zos_device_id: 'mac-1',
    },
    createOperatingRuntime: false, deferSafetyWork: (callback) => { deferred = callback; },
    now: () => '2026-08-07T04:00:00.000Z',
  });
  await app.start();
  await deferred();
  assert.deepEqual((await snapshots.latest('upgrade')).backup.state.collections.tasks.map((item) => item.id), ['before-startup']);
  app.stop();
});

test('legacy projection quota failure keeps modular restore successful and retries the compatibility view', async () => {
  const base = memoryStorage();
  let failOnce = true;
  const storage = {
    getItem: base.getItem,
    setItem(key, value) {
      if (key === 'zos_inbox' && failOnce) {
        failOnce = false;
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      base.setItem(key, value);
    },
  };
  const store = createStateStore({ storage, deviceId: 'mac-1', createId: () => 'generated-id', now: () => '2026-08-07T05:00:00.000Z' });
  const snapshots = createSnapshotRepository({ adapter: createMemorySnapshotAdapter(), createId: () => 'pre-import' });
  let retry;
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store, snapshotRepository: snapshots,
    createOperatingRuntime: false, deferSafetyWork: (callback) => { retry = callback; },
    now: () => '2026-08-07T05:00:00.000Z',
  });
  const incoming = createDurableBackup({ state: { collections: { tasks: [{ id: 'restored', title: '安全恢复' }] } } });
  const result = await app.importBackupText(JSON.stringify(incoming));
  assert.equal(result.projectionComplete, false);
  assert.equal(store.load().collections.tasks.some((item) => item.id === 'restored'), true);
  assert.equal(app.runtime.protectionState, '主数据已安全保存，兼容页面稍后刷新');
  await retry();
  assert.equal(JSON.parse(storage.getItem('zos_inbox')).length, 0);
  assert.equal(app.runtime.protectionState, '本机数据已保护');
});

test('legacy projection retry re-reads intervening edits and keeps retrying without claiming protection early', async () => {
  const base = memoryStorage();
  let failuresRemaining = 2;
  const storage = {
    getItem: base.getItem,
    setItem(key, value) {
      if (key === 'zos_tasks' && failuresRemaining > 0) {
        failuresRemaining -= 1;
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      base.setItem(key, value);
    },
  };
  const queued = [];
  const store = createStateStore({ storage, deviceId: 'mac-1', createId: () => 'generated-id', now: () => '2026-08-07T06:00:00.000Z' });
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    snapshotRepository: createSnapshotRepository({ adapter: createMemorySnapshotAdapter(), createId: () => 'pre-import' }),
    createOperatingRuntime: false, deferSafetyWork: (callback) => queued.push(callback),
    legacyProjectionRetryDelays: [0, 0, 0],
    now: () => '2026-08-07T06:00:00.000Z',
  });
  const incoming = createDurableBackup({ state: { collections: { tasks: [{ id: 'restored', title: '安全恢复' }] } } });

  const result = await app.importBackupText(JSON.stringify(incoming));
  assert.equal(result.projectionComplete, false);
  base.setItem('zos_tasks', JSON.stringify([{ id: 'intervening', title: '重试前的新编辑', updatedAt: '2026-08-07T06:01:00.000Z' }]));
  await queued.shift()();
  assert.equal(app.runtime.protectionState, '主数据已安全保存，兼容页面稍后刷新');
  assert.equal(queued.length, 1);
  await queued.shift()();
  assert.equal(store.load().collections.tasks.some((item) => item.id === 'intervening'), true);
  assert.equal(JSON.parse(base.getItem('zos_tasks')).some((item) => item.id === 'intervening'), true);
  assert.equal(app.runtime.protectionState, '本机数据已保护');
});

test('stopping the application cancels a queued legacy projection and stale callbacks cannot write or claim success', async () => {
  const base = memoryStorage();
  let writeCount = 0;
  const storage = {
    getItem: base.getItem,
    setItem(key, value) {
      writeCount += 1;
      if (key === 'zos_tasks') {
        const error = new Error('quota');
        error.name = 'QuotaExceededError';
        throw error;
      }
      base.setItem(key, value);
    },
  };
  let deferred;
  let cancelled = null;
  const store = createStateStore({ storage, deviceId: 'mac-1', createId: () => 'generated-id', now: () => '2026-08-07T07:00:00.000Z' });
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage, store,
    snapshotRepository: createSnapshotRepository({ adapter: createMemorySnapshotAdapter(), createId: () => 'pre-import' }),
    createOperatingRuntime: false,
    deferSafetyWork(callback) { deferred = callback; return 'idle-1'; },
    cancelSafetyWork(handle) { cancelled = handle; },
    now: () => '2026-08-07T07:00:00.000Z',
  });
  const incoming = createDurableBackup({ state: { collections: { tasks: [{ id: 'restored', title: '安全恢复' }] } } });
  await app.importBackupText(JSON.stringify(incoming));
  assert.equal(app.runtime.protectionState, '主数据已安全保存，兼容页面稍后刷新');

  app.stop();
  const writesAtStop = writeCount;
  await deferred();
  assert.equal(cancelled, 'idle-1');
  assert.equal(writeCount, writesAtStop);
  assert.equal(app.runtime.protectionState, '主数据已安全保存，兼容页面稍后刷新');
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
