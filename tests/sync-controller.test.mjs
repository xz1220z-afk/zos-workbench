import test from 'node:test';
import assert from 'node:assert/strict';

import { createSyncController } from '../src/app/sync-controller.mjs';

function makeClock() {
  let callbacks = [];
  return {
    setTimeout(callback) { callbacks.push(callback); return callback; },
    clearTimeout(callback) { callbacks = callbacks.filter((item) => item !== callback); },
    async flush() {
      const queued = callbacks;
      callbacks = [];
      for (const callback of queued) await callback();
      await Promise.resolve();
    },
  };
}

test('controller syncs after online, visibility restore and debounced local change', async () => {
  const reasons = [];
  const eventTarget = new EventTarget();
  const visibility = new EventTarget();
  visibility.visibilityState = 'hidden';
  const clock = makeClock();
  const state = { tasks: [] };
  const controller = createSyncController({
    userId: 'user-1',
    deviceId: 'mac-1',
    transport: { pull: async () => [], upsert: async () => [] },
    eventTarget,
    visibility,
    clock,
    readState: () => state,
    writeState: () => {},
    loadBaseRevisions: () => ({}),
    saveBaseRevisions: () => {},
    onStatus: ({ reason, phase }) => { if (phase === 'complete') reasons.push(reason); },
  });

  controller.start();
  eventTarget.dispatchEvent(new Event('online'));
  await clock.flush();
  assert.deepEqual(reasons, ['online']);

  visibility.visibilityState = 'visible';
  visibility.dispatchEvent(new Event('visibilitychange'));
  await clock.flush();
  assert.deepEqual(reasons, ['online', 'visibility']);

  eventTarget.dispatchEvent(new Event('zos:local-change'));
  eventTarget.dispatchEvent(new Event('zos:local-change'));
  await clock.flush();
  assert.deepEqual(reasons, ['online', 'visibility', 'local-change']);
  controller.stop();
});

test('controller persists shared revisions and reports critical conflicts without uploading', async () => {
  const savedBases = [];
  const writes = [];
  const conflicts = [];
  let upsertCalls = 0;
  const localTarget = {
    id: 'target-1', value: 100, createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z', deletedAt: null, revision: 3, deviceId: 'mac-1',
  };
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1',
    transport: {
      pull: async () => [{
        entity_type: 'targets', record_id: 'target-1', payload: { id: 'target-1', value: 120 },
        created_at: localTarget.createdAt, updated_at: '2026-08-02T08:01:00.000Z',
        deleted_at: null, revision: 3, device_id: 'phone-1',
      }],
      upsert: async () => { upsertCalls += 1; },
    },
    readState: () => ({ targets: [localTarget] }),
    writeState: (next) => writes.push(next),
    loadBaseRevisions: () => ({ 'targets:target-1': 2 }),
    saveBaseRevisions: (next) => savedBases.push(next),
    onConflict: (items) => conflicts.push(...items),
  });

  await controller.sync('manual');
  assert.equal(conflicts.length, 1);
  assert.equal(upsertCalls, 0);
  assert.equal(writes.length, 1);
  assert.equal(savedBases.length, 1);
});

test('controller uploads independent records even when another record conflicts and reports attention required', async () => {
  const uploads = [];
  const statuses = [];
  const local = {
    targets: [{ id: 'target-1', value: 100, createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z', deletedAt: null, revision: 3, deviceId: 'mac-1' }],
    tasks: [{ id: 'task-1', title: '本机新任务', createdAt: '2026-08-03T08:00:00.000Z', updatedAt: '2026-08-03T08:00:00.000Z', deletedAt: null, revision: 1, deviceId: 'mac-1' }],
  };
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1',
    transport: {
      pull: async () => [{
        entity_type: 'targets', record_id: 'target-1', payload: { id: 'target-1', value: 120 },
        created_at: '2026-08-01T08:00:00.000Z', updated_at: '2026-08-03T08:01:00.000Z',
        deleted_at: null, revision: 3, device_id: 'phone-1',
      }],
      upsert: async (rows) => uploads.push(...rows),
    },
    readState: () => local, writeState: () => {},
    loadBaseRevisions: () => ({ 'targets:target-1': 2 }), saveBaseRevisions: () => {},
    onStatus: (status) => statuses.push(status),
  });
  await controller.sync('manual');
  assert.deepEqual(uploads.map((row) => row.record_id), ['task-1']);
  assert.equal(controller.getStatus().phase, 'needs-attention');
  assert.equal(controller.getStatus().pendingUploads, 1);
  assert.equal(statuses.at(-1).conflicts, 1);
});

test('controller resolves one conflict, uploads the selected value and persists it locally', async () => {
  const uploads = [];
  let state = { targets: [] };
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'ipad-1', now: () => '2026-08-02T10:00:00.000Z',
    transport: { pull: async () => [], upsert: async (rows) => { uploads.push(...rows); return rows; } },
    readState: () => state,
    writeState: (next) => { state = next; },
    loadBaseRevisions: () => ({}),
    saveBaseRevisions: () => {},
  });
  controller.setConflicts([{
    id: 'targets:target-1', entityType: 'targets', recordId: 'target-1',
    local: { id: 'target-1', value: 100, createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:00:00.000Z', deletedAt: null, revision: 3, deviceId: 'mac-1' },
    remote: { id: 'target-1', value: 120, createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:01:00.000Z', deletedAt: null, revision: 4, deviceId: 'phone-1' },
  }]);

  const resolved = await controller.resolve('targets:target-1', 'remote');
  assert.equal(resolved.value, 120);
  assert.equal(state.targets[0].revision, 5);
  assert.equal(uploads[0].payload.value, 120);
});

test('controller keeps a status snapshot and retries failed sync with increasing delay', async () => {
  const clock = makeClock();
  let calls = 0;
  const statuses = [];
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1', clock, retryDelays: [1000, 5000],
    transport: { pull: async () => { calls += 1; if (calls < 2) throw new Error('offline'); return []; }, upsert: async () => [] },
    readState: () => ({ tasks: [] }), writeState: () => {},
    onStatus: (status) => statuses.push(status),
    now: () => `2026-08-06T08:00:0${calls}.000Z`,
  });
  await assert.rejects(controller.sync('manual'));
  assert.equal(controller.getStatus().phase, 'retry-wait');
  assert.equal(controller.getStatus().attempts, 1);
  await clock.flush();
  assert.equal(calls, 2);
  assert.equal(controller.getStatus().phase, 'complete');
  assert.equal(controller.getStatus().attempts, 0);
  assert.ok(statuses.some((item) => item.phase === 'retry-wait'));
});

test('controller does not recreate a retry timer after stop while an active request is failing', async () => {
  const clock = makeClock();
  let rejectPull;
  const pull = new Promise((resolve, reject) => { rejectPull = reject; });
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1', clock,
    transport: { pull: async () => pull, upsert: async () => [] },
    readState: () => ({ tasks: [] }), writeState: () => {},
  });
  controller.start();
  const syncing = controller.sync('manual');
  controller.stop();
  rejectPull(new Error('network failed after stop'));
  await assert.rejects(syncing);
  await clock.flush();
  assert.notEqual(controller.getStatus().phase, 'retry-wait');
});

test('controller reports queued local work while offline and resumes when online', async () => {
  const eventTarget = new EventTarget();
  const clock = makeClock();
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1', eventTarget, clock,
    isOnline: () => false,
    transport: { pull: async () => [], upsert: async () => [] },
    readState: () => ({ tasks: [] }), writeState: () => {},
  });
  controller.start();
  eventTarget.dispatchEvent(new Event('zos:local-change'));
  await clock.flush();
  assert.equal(controller.getStatus().phase, 'offline');
  assert.equal(controller.getStatus().pendingUploads, 1);
  controller.stop();
});

test('controller resolves conflict with an explicit field merge and protected metadata', async () => {
  let state = { targets: [] };
  const uploads = [];
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1', now: () => '2026-08-06T09:00:00.000Z',
    transport: { pull: async () => [], upsert: async (rows) => uploads.push(...rows) },
    readState: () => state, writeState: (next) => { state = next; },
  });
  controller.setConflicts([{
    id: 'targets:t1', entityType: 'targets', recordId: 't1',
    local: { id: 't1', title: '本机标题', value: 100, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z', revision: 3, deviceId: 'phone' },
    remote: { id: 't1', title: '云端标题', value: 120, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-05T01:00:00.000Z', revision: 4, deviceId: 'ipad' },
  }]);
  const result = await controller.resolve('targets:t1', 'merge', { title: '本机标题', value: 120, id: 'evil', revision: 99 });
  assert.equal(result.id, 't1');
  assert.equal(result.title, '本机标题');
  assert.equal(result.value, 120);
  assert.equal(result.revision, 5);
  assert.equal(result.deviceId, 'mac-1');
  assert.equal(uploads.length, 1);
});

test('resolving a conflict writes only active collections and never promotes sync tombstones', async () => {
  const deletedTask = {
    id: 'deleted-task', title: '已删除任务', entity: 'tasks',
    createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z',
    deletedAt: '2026-08-02T00:00:00.000Z', revision: 2, deviceId: 'mac-1',
  };
  let written;
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1', now: () => '2026-08-06T09:00:00.000Z',
    transport: { pull: async () => [], upsert: async () => [] },
    readState: () => ({ tasks: [], targets: [] }),
    readSyncState: () => ({ tasks: [deletedTask], targets: [] }),
    writeState: (next) => { written = next; },
  });
  controller.setConflicts([{
    id: 'targets:t1', entityType: 'targets', recordId: 't1',
    local: { id: 't1', value: 100, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z', revision: 3, deviceId: 'mac-1' },
    remote: { id: 't1', value: 120, createdAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-05T01:00:00.000Z', revision: 4, deviceId: 'phone-1' },
  }]);
  await controller.resolve('targets:t1', 'local');
  assert.deepEqual(written.tasks, []);
  assert.equal(written.targets[0].id, 't1');
});

test('a realtime signal during an active pull schedules exactly one follow-up authoritative pull', async () => {
  const timer = makeClock();
  const resolvers = [];
  let pulls = 0;
  const controller = createSyncController({
    userId: 'user-1', deviceId: 'mac-1', clock: timer,
    transport: {
      pull: async () => { pulls += 1; if (pulls === 1) return new Promise((resolve) => resolvers.push(resolve)); return []; },
      upsert: async () => [],
    },
    readState: () => ({ tasks: [] }), writeState: () => {},
  });
  const first = controller.sync('startup');
  controller.signal('realtime-signal');
  controller.signal('realtime-signal');
  resolvers[0]([]);
  await first;
  await timer.flush();
  assert.equal(pulls, 2);
  assert.equal(controller.getStatus().reason, 'realtime-signal');
});
