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
