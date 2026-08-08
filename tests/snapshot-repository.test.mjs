import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createMemorySnapshotAdapter,
  createSnapshotRepository,
} from '../src/app/snapshot-repository.mjs';

function backup(label) {
  return { backupVersion: '2.4.0', state: { collections: { tasks: [{ id: label, title: label }] } } };
}

test('snapshot repository keeps three upgrade checkpoints and latest pre-import checkpoint', async () => {
  let tick = 0;
  const repository = createSnapshotRepository({
    adapter: createMemorySnapshotAdapter(),
    now: () => `2026-08-07T02:00:0${tick++}.000Z`,
    createId: () => `snapshot-${tick}`,
  });
  await repository.save({ kind: 'upgrade', appVersion: '1.9.0', backup: backup('u1') });
  await repository.save({ kind: 'upgrade', appVersion: '2.0.0', backup: backup('u2') });
  await repository.save({ kind: 'upgrade', appVersion: '2.0.1', backup: backup('u3') });
  await repository.save({ kind: 'upgrade', appVersion: '2.4.0', backup: backup('u4') });
  await repository.save({ kind: 'pre-import', appVersion: '2.4.0', backup: backup('before-1') });
  const latest = await repository.save({ kind: 'pre-import', appVersion: '2.4.0', backup: backup('before-2') });

  const rows = await repository.list();
  assert.equal(rows.filter((item) => item.kind === 'upgrade').length, 3);
  assert.equal(rows.some((item) => item.backup.state.collections.tasks[0].id === 'u1'), false);
  assert.equal(rows.filter((item) => item.kind === 'pre-import').length, 1);
  assert.equal((await repository.latest('pre-import')).id, latest.id);
  assert.equal((await repository.load(latest.id)).backup.state.collections.tasks[0].id, 'before-2');
});

test('snapshot repository reports unavailable storage without pretending a checkpoint exists', async () => {
  const repository = createSnapshotRepository({
    adapter: null, now: () => '2026-08-07T02:00:00.000Z', createId: () => 'snapshot-1',
  });
  await assert.rejects(() => repository.save({ kind: 'pre-import', backup: backup('x') }), /snapshot_storage_unavailable/);
  assert.deepEqual(await repository.list(), []);
});

test('snapshot repository preserves quota failures for a fail-closed import flow', async () => {
  const error = new Error('quota');
  error.name = 'QuotaExceededError';
  const repository = createSnapshotRepository({
    adapter: { put: async () => { throw error; }, list: async () => [], get: async () => null, delete: async () => {} },
    now: () => '2026-08-07T02:00:00.000Z', createId: () => 'snapshot-1',
  });
  await assert.rejects(() => repository.save({ kind: 'pre-import', backup: backup('x') }), /snapshot_storage_failed/);
});

test('snapshot repository requires committed data to pass readback before reporting success', async () => {
  const repository = createSnapshotRepository({
    adapter: { put: async (value) => value, list: async () => [], get: async () => null, delete: async () => {} },
    now: () => '2026-08-07T02:00:00.000Z', createId: () => 'snapshot-1',
  });
  await assert.rejects(() => repository.save({ kind: 'pre-import', backup: backup('x') }), /snapshot_storage_failed/);
});
