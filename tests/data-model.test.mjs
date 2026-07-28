import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecord, markDeleted, normalizeCollection, normalizeRecord, selectLatestRecord, touchRecord } from '../src/data-model.mjs';

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

test('normalizeCollection gives new records metadata without replacing existing backup ids', () => {
  const records = normalizeCollection(
    [{ id: 'id_21', title: '旧数据' }, { title: '刚创建的任务' }],
    { now: '2026-07-28T10:00:00.000Z', deviceId: 'device-a', createId: () => 'new-uuid-1' },
  );

  assert.equal(records[0].id, 'id_21');
  assert.equal(records[1].id, 'new-uuid-1');
  assert.equal(records[1].updatedAt, '2026-07-28T10:00:00.000Z');
  assert.equal(records[1].revision, 1);
});

test('selectLatestRecord keeps a newer deletion tombstone instead of resurrecting stale data', () => {
  const latest = selectLatestRecord(
    { id: 'id_9', title: '旧标题', updatedAt: '2026-07-28T10:00:00.000Z', revision: 2, deletedAt: null },
    { id: 'id_9', title: '旧标题', updatedAt: '2026-07-28T10:05:00.000Z', revision: 3, deletedAt: '2026-07-28T10:05:00.000Z' },
  );

  assert.equal(latest.deletedAt, '2026-07-28T10:05:00.000Z');
  assert.equal(latest.revision, 3);
});

test('touchRecord increments a revision without changing immutable creation data', () => {
  const updated = touchRecord(
    { id: 'id_9', title: '原任务', createdAt: '2026-07-20T08:00:00.000Z', updatedAt: '2026-07-20T08:00:00.000Z', revision: 1, deletedAt: null, deviceId: 'device-old' },
    { now: '2026-07-28T10:00:00.000Z', deviceId: 'device-a' },
  );

  assert.equal(updated.createdAt, '2026-07-20T08:00:00.000Z');
  assert.equal(updated.updatedAt, '2026-07-28T10:00:00.000Z');
  assert.equal(updated.revision, 2);
  assert.equal(updated.deviceId, 'device-a');
});

test('markDeleted produces a tombstone that carries the record identity and a newer revision', () => {
  const tombstone = markDeleted(
    { id: 'id_9', title: '待删除任务', createdAt: '2026-07-20T08:00:00.000Z', updatedAt: '2026-07-20T08:00:00.000Z', revision: 1, deletedAt: null, deviceId: 'device-old' },
    { now: '2026-07-28T10:00:00.000Z', deviceId: 'device-a' },
  );

  assert.equal(tombstone.id, 'id_9');
  assert.equal(tombstone.deletedAt, '2026-07-28T10:00:00.000Z');
  assert.equal(tombstone.updatedAt, '2026-07-28T10:00:00.000Z');
  assert.equal(tombstone.revision, 2);
});
