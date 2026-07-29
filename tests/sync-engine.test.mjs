import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRemoteSnapshot, fromCloudRow, toCloudRow } from '../src/sync-engine.mjs';

test('toCloudRow creates an owner-scoped sync row without credentials', () => {
  const row = toCloudRow({
    userId: 'user-1',
    entityType: 'tasks',
    record: {
      id: 'task-1', title: '确认拍摄排期', createdAt: '2026-07-29T08:00:00.000Z',
      updatedAt: '2026-07-29T09:00:00.000Z', deletedAt: null, revision: 2, deviceId: 'mac-1',
    },
  });

  assert.deepEqual(row, {
    user_id: 'user-1', entity_type: 'tasks', record_id: 'task-1',
    payload: { id: 'task-1', title: '确认拍摄排期', createdAt: '2026-07-29T08:00:00.000Z', updatedAt: '2026-07-29T09:00:00.000Z', deletedAt: null, revision: 2, deviceId: 'mac-1' },
    created_at: '2026-07-29T08:00:00.000Z', updated_at: '2026-07-29T09:00:00.000Z', deleted_at: null,
    revision: 2, device_id: 'mac-1',
  });
});

test('fromCloudRow trusts persisted sync metadata over a stale payload copy', () => {
  const record = fromCloudRow({
    record_id: 'task-1', payload: { id: 'wrong-id', title: '任务', revision: 1, deviceId: 'old' },
    created_at: '2026-07-29T08:00:00.000Z', updated_at: '2026-07-29T10:00:00.000Z',
    deleted_at: null, revision: 3, device_id: 'phone-1',
  });

  assert.equal(record.id, 'task-1');
  assert.equal(record.revision, 3);
  assert.equal(record.deviceId, 'phone-1');
  assert.equal(record.updatedAt, '2026-07-29T10:00:00.000Z');
});

test('applyRemoteSnapshot keeps a newer remote tombstone and does not resurrect it locally', () => {
  const result = applyRemoteSnapshot({
    local: { tasks: [{ id: 'task-1', title: '旧任务', createdAt: '2026-07-29T08:00:00.000Z', updatedAt: '2026-07-29T09:00:00.000Z', deletedAt: null, revision: 1, deviceId: 'mac-1' }] },
    remoteRows: [{ entity_type: 'tasks', record_id: 'task-1', payload: { id: 'task-1', title: '旧任务' }, created_at: '2026-07-29T08:00:00.000Z', updated_at: '2026-07-29T10:00:00.000Z', deleted_at: '2026-07-29T10:00:00.000Z', revision: 2, device_id: 'phone-1' }],
  });

  assert.deepEqual(result.collections.tasks, []);
  assert.equal(result.tombstones[0].id, 'task-1');
  assert.equal(result.tombstones[0].deletedAt, '2026-07-29T10:00:00.000Z');
});

test('applyRemoteSnapshot keeps a newer local record and marks it for upload', () => {
  const result = applyRemoteSnapshot({
    local: { inbox: [{ id: 'inbox-1', content: '确认客户需求', createdAt: '2026-07-29T08:00:00.000Z', updatedAt: '2026-07-29T11:00:00.000Z', deletedAt: null, revision: 2, deviceId: 'mac-1' }] },
    remoteRows: [{ entity_type: 'inbox', record_id: 'inbox-1', payload: { id: 'inbox-1', content: '旧内容' }, created_at: '2026-07-29T08:00:00.000Z', updated_at: '2026-07-29T10:00:00.000Z', deleted_at: null, revision: 1, device_id: 'phone-1' }],
  });

  assert.equal(result.collections.inbox[0].content, '确认客户需求');
  assert.equal(result.uploads[0].record_id, 'inbox-1');
  assert.equal(result.uploads[0].payload.content, '确认客户需求');
});
