import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecord, normalizeRecord, selectLatestRecord } from '../src/data-model.mjs';

test('createRecord gives a new task a stable sync identity and audit fields', () => {
  const record = createRecord(
    { title: '完成客户回访', status: 'todo' },
    { id: 'device-a:0001', now: '2026-07-28T10:00:00.000Z', deviceId: 'device-a' },
  );

  assert.deepEqual(record, {
    id: 'device-a:0001',
    title: '完成客户回访',
    status: 'todo',
    createdAt: '2026-07-28T10:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
    deletedAt: null,
    revision: 1,
    deviceId: 'device-a',
  });
});

test('normalizeRecord preserves an existing backup id while adding sync metadata', () => {
  const record = normalizeRecord(
    { id: 'id_21', title: '旧备份任务', createdAt: '2026-07-20T08:00:00.000Z' },
    { now: '2026-07-28T10:00:00.000Z', deviceId: 'device-a', createId: () => 'must-not-be-used' },
  );

  assert.equal(record.id, 'id_21');
  assert.equal(record.createdAt, '2026-07-20T08:00:00.000Z');
  assert.equal(record.updatedAt, '2026-07-28T10:00:00.000Z');
  assert.equal(record.deletedAt, null);
  assert.equal(record.revision, 1);
  assert.equal(record.deviceId, 'device-a');
});

test('selectLatestRecord keeps a newer deletion tombstone instead of resurrecting stale data', () => {
  const latest = selectLatestRecord(
    { id: 'id_9', title: '旧标题', updatedAt: '2026-07-28T10:00:00.000Z', revision: 2, deletedAt: null },
    { id: 'id_9', title: '旧标题', updatedAt: '2026-07-28T10:05:00.000Z', revision: 3, deletedAt: '2026-07-28T10:05:00.000Z' },
  );

  assert.equal(latest.deletedAt, '2026-07-28T10:05:00.000Z');
  assert.equal(latest.revision, 3);
});
