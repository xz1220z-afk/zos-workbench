import assert from 'node:assert/strict';
import test from 'node:test';
import { applyRemoteSnapshot, buildLocalSyncInput, CRITICAL_ENTITY_TYPES, fromCloudRow, resolveConflict, toCloudRow } from '../src/sync-engine.mjs';

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

test('local tombstones are included in sync input and overwrite an older live cloud copy', () => {
  const deleted = {
    id: 'task-deleted', title: '已删除任务', entity: 'tasks',
    createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:00:00.000Z',
    deletedAt: '2026-08-02T08:00:00.000Z', revision: 2, deviceId: 'mac-1',
  };
  const local = buildLocalSyncInput({ collections: { tasks: [] }, tombstones: [deleted] });
  const result = applyRemoteSnapshot({
    local,
    userId: 'user-1',
    remoteRows: [{
      entity_type: 'tasks', record_id: deleted.id, payload: { id: deleted.id, title: deleted.title },
      created_at: deleted.createdAt, updated_at: '2026-08-01T09:00:00.000Z',
      deleted_at: null, revision: 1, device_id: 'phone-1',
    }],
  });
  assert.equal(result.collections.tasks.length, 0);
  assert.equal(result.tombstones[0].id, deleted.id);
  assert.equal(result.uploads[0].deleted_at, deleted.deletedAt);
});

test('a newer restored live revision wins over an older cloud tombstone and uploads', () => {
  const restored = {
    id: 'task-restored', title: '恢复任务', createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-03T08:00:00.000Z', deletedAt: null, revision: 3, deviceId: 'mac-1',
  };
  const result = applyRemoteSnapshot({
    local: { tasks: [restored] }, userId: 'user-1',
    remoteRows: [{
      entity_type: 'tasks', record_id: restored.id, payload: { id: restored.id, title: restored.title },
      created_at: restored.createdAt, updated_at: '2026-08-02T08:00:00.000Z',
      deleted_at: '2026-08-02T08:00:00.000Z', revision: 2, device_id: 'phone-1',
    }],
  });
  assert.equal(result.collections.tasks[0].id, restored.id);
  assert.equal(result.tombstones.length, 0);
  assert.equal(result.uploads[0].deleted_at, null);
  assert.equal(result.uploads[0].revision, 3);
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

test('concurrent target edits become a conflict instead of last-write-wins', () => {
  const local = {
    id: 'target-1', metricKey: 'wanjia.paymentGmv', value: 100,
    createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:00:00.000Z',
    deletedAt: null, revision: 3, deviceId: 'mac-1',
  };
  const remoteRow = {
    entity_type: 'targets', record_id: 'target-1',
    payload: { id: 'target-1', metricKey: 'wanjia.paymentGmv', value: 120 },
    created_at: '2026-08-01T08:00:00.000Z', updated_at: '2026-08-02T08:01:00.000Z',
    deleted_at: null, revision: 3, device_id: 'phone-1',
  };
  const result = applyRemoteSnapshot({
    local: { targets: [local] },
    remoteRows: [remoteRow],
    baseRevisions: { 'targets:target-1': 2 },
  });

  assert.equal(CRITICAL_ENTITY_TYPES.has('targets'), true);
  assert.equal(result.conflicts.length, 1);
  assert.equal(result.conflicts[0].id, 'targets:target-1');
  assert.equal(result.uploads.length, 0);
});

test('missing critical base revision falls back to deterministic merge', () => {
  const local = {
    id: 'decision-1', factSummary: '旧事实', createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z', deletedAt: null, revision: 2, deviceId: 'mac-1',
  };
  const result = applyRemoteSnapshot({
    local: { decisions: [local] },
    remoteRows: [{
      entity_type: 'decisions', record_id: 'decision-1', payload: { id: 'decision-1', factSummary: '新事实' },
      created_at: local.createdAt, updated_at: '2026-08-02T09:00:00.000Z', deleted_at: null,
      revision: 3, device_id: 'phone-1',
    }],
    baseRevisions: {},
  });

  assert.equal(result.conflicts.length, 0);
  assert.equal(result.collections.decisions[0].factSummary, '新事实');
  assert.equal(result.baseRevisions['decisions:decision-1'], 3);
});

test('remote tombstones remain authoritative for critical entities', () => {
  const local = {
    id: 'target-1', value: 100, createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z', deletedAt: null, revision: 3, deviceId: 'mac-1',
  };
  const result = applyRemoteSnapshot({
    local: { targets: [local] },
    remoteRows: [{
      entity_type: 'targets', record_id: 'target-1', payload: { id: 'target-1', value: 90 },
      created_at: local.createdAt, updated_at: '2026-08-02T09:00:00.000Z',
      deleted_at: '2026-08-02T09:00:00.000Z', revision: 4, device_id: 'phone-1',
    }],
    baseRevisions: { 'targets:target-1': 2 },
  });

  assert.equal(result.conflicts.length, 0);
  assert.equal(result.collections.targets.length, 0);
  assert.equal(result.tombstones[0].id, 'target-1');
});

test('resolved critical conflict creates a fresh revision on the resolving device', () => {
  const conflict = {
    id: 'targets:target-1', entityType: 'targets', recordId: 'target-1',
    local: { id: 'target-1', value: 100, createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:00:00.000Z', deletedAt: null, revision: 3, deviceId: 'mac-1' },
    remote: { id: 'target-1', value: 120, createdAt: '2026-08-01T08:00:00.000Z', updatedAt: '2026-08-02T08:01:00.000Z', deletedAt: null, revision: 4, deviceId: 'phone-1' },
  };
  const resolved = resolveConflict(conflict, 'local', { now: '2026-08-02T10:00:00.000Z', deviceId: 'ipad-1' });

  assert.equal(resolved.value, 100);
  assert.equal(resolved.revision, 5);
  assert.equal(resolved.deviceId, 'ipad-1');
  assert.equal(resolved.updatedAt, '2026-08-02T10:00:00.000Z');
  assert.throws(() => resolveConflict(conflict, 'merge', { now: 'x', deviceId: 'ipad-1' }), /merged fields are required/);
});

test('cloud rows and resolved conflicts strip credential fields before local display or upload', () => {
  const remote = fromCloudRow({
    record_id: 'target-secret', payload: { id: 'target-secret', value: 120, privateKey: 'never', sessionToken: 'never' },
    created_at: '2026-08-01T08:00:00.000Z', updated_at: '2026-08-02T08:00:00.000Z',
    deleted_at: null, revision: 3, device_id: 'phone-1',
  });
  assert.equal(remote.privateKey, undefined);
  assert.equal(remote.sessionToken, undefined);
  const resolved = resolveConflict({
    id: 'targets:target-secret', entityType: 'targets', recordId: 'target-secret',
    local: { id: 'target-secret', value: 100, createdAt: remote.createdAt, updatedAt: remote.updatedAt, revision: 3, deviceId: 'mac-1' },
    remote: { ...remote, privateKey: 'never-again' },
  }, 'merge', {
    now: '2026-08-03T08:00:00.000Z', deviceId: 'mac-1', merged: { value: 120, credential: 'never-again' },
  });
  const row = toCloudRow({ userId: 'user-1', entityType: 'targets', record: resolved });
  assert.doesNotMatch(JSON.stringify(row), /privateKey|sessionToken|credential|never/);
});

test('critical conflict comparison detects different nested evidence', () => {
  const metadata = {
    id: 'decision-2', createdAt: '2026-08-01T08:00:00.000Z',
    updatedAt: '2026-08-02T08:00:00.000Z', deletedAt: null, revision: 3,
  };
  const result = applyRemoteSnapshot({
    local: { decisions: [{ ...metadata, evidence: { amount: 100 }, deviceId: 'mac-1' }] },
    remoteRows: [{
      entity_type: 'decisions', record_id: 'decision-2',
      payload: { id: 'decision-2', evidence: { amount: 120 } },
      created_at: metadata.createdAt, updated_at: metadata.updatedAt,
      deleted_at: null, revision: 3, device_id: 'phone-1',
    }],
    baseRevisions: { 'decisions:decision-2': 2 },
  });
  assert.equal(result.conflicts.length, 1);
});
