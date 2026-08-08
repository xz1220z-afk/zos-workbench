import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDurableStateView,
  buildSafeMergeSnapshot,
  createDurableBackup,
  parseBackupFile,
  summarizeBackup,
} from '../src/app/data-durability.mjs';
import { STATE_ENTITY_TYPES } from '../src/app/state-store.mjs';

const now = '2026-08-07T02:00:00.000Z';

function fullState() {
  return {
    schemaVersion: '1.7',
    deviceId: 'mac-1',
    collections: Object.fromEntries(STATE_ENTITY_TYPES.map((type, index) => [type, [{
      id: `${type}-1`, title: type, revision: index + 1, updatedAt: '2026-08-06T01:00:00.000Z',
      accessToken: 'remove-me',
    }]])),
    tombstones: [{ id: 'deleted-1', entity: 'tasks', title: 'deleted', deletedAt: '2026-08-06T01:00:00.000Z' }],
    auditLog: [{ id: 'audit-1', action: 'create', apiKey: 'remove-me' }],
  };
}

test('durable backup covers every collection, counts records and excludes credentials', () => {
  const backup = createDurableBackup({
    state: fullState(), baseRevisions: { 'tasks:tasks-1': 3 }, createdAt: now, appVersion: '2.6.0',
  });
  assert.equal(backup.backupVersion, '2.6.0');
  assert.equal(backup.createdAt, now);
  assert.deepEqual(Object.keys(backup.state.collections).sort(), [...STATE_ENTITY_TYPES].sort());
  assert.equal(backup.summary.totalRecords, STATE_ENTITY_TYPES.length);
  assert.equal(backup.summary.collections.tasks, 1);
  assert.match(backup.integrity.algorithm, /^fnv1a32$/);
  assert.match(backup.integrity.digest, /^[a-f0-9]{8}$/);
  assert.doesNotMatch(JSON.stringify(backup), /accessToken|apiKey|remove-me/);
  assert.deepEqual(backup.baseRevisions, { 'tasks:tasks-1': 3 });
});

test('durable view conservatively keeps live records when another surface has a deletion marker', () => {
  const current = { collections: { tasks: [{ id: 'deleted-later', title: '旧内容', updatedAt: '2026-08-01T00:00:00.000Z' }] } };
  const legacy = {
    collections: { tasks: [{ id: 'edited-later', title: '新内容', updatedAt: '2026-08-03T00:00:00.000Z' }] },
    tombstones: [
      { id: 'deleted-later', entity: 'tasks', deletedAt: '2026-08-02T00:00:00.000Z', updatedAt: '2026-08-02T00:00:00.000Z' },
      { id: 'edited-later', entity: 'tasks', deletedAt: '2026-08-01T00:00:00.000Z', updatedAt: '2026-08-01T00:00:00.000Z' },
    ],
  };
  const view = buildDurableStateView(current, legacy);
  assert.equal(view.collections.tasks.some((item) => item.id === 'deleted-later'), true);
  assert.equal(view.collections.tasks.some((item) => item.id === 'edited-later'), true);
  assert.equal(view.tombstones.some((item) => item.id === 'deleted-later'), false);
  assert.equal(view.tombstones.some((item) => item.id === 'edited-later'), false);
});

test('backup parser validates malformed, unsupported, oversized and tampered inputs', () => {
  assert.throws(() => parseBackupFile('{bad'), /invalid_json/);
  assert.throws(() => parseBackupFile(JSON.stringify({ hello: 'world' })), /unsupported_backup/);
  assert.throws(() => parseBackupFile('x'.repeat(10_485_761)), /backup_too_large/);
  const backup = createDurableBackup({ state: fullState(), createdAt: now });
  backup.state.collections.tasks[0].title = 'tampered';
  assert.throws(() => parseBackupFile(JSON.stringify(backup)), /integrity_mismatch/);
});

test('backup creation and parsing reject malformed records and metadata', () => {
  assert.throws(() => createDurableBackup({ state: { collections: { tasks: [null] } } }), /invalid_record/);
  assert.throws(() => createDurableBackup({ state: { collections: { tasks: [{ title: 'missing id' }] } } }), /missing_record_id/);
  assert.throws(() => createDurableBackup({ state: { collections: { tasks: [{ id: 'same' }, { id: 'same' }] } } }), /duplicate_record_id/);
  assert.throws(() => createDurableBackup({ state: { auditLog: [null] } }), /invalid_audit_entry/);
  assert.throws(() => createDurableBackup({ state: { collections: [] } }), /invalid_collections/);
  assert.throws(() => createDurableBackup({ state: { tombstones: {} } }), /invalid_tombstones/);
  assert.throws(() => createDurableBackup({ state: { tombstones: [{ id: 'x', deletedAt: now }] } }), /invalid_tombstone_entity/);
  assert.throws(() => createDurableBackup({ state: { tombstones: [{ id: 'x', entity: 'tasks' }] } }), /missing_tombstone_deleted_at/);
  assert.throws(() => createDurableBackup({ state: { collections: { tasks: [{ id: 'x', updatedAt: 'not-a-date' }] } } }), /invalid_timestamp/);
  assert.throws(() => createDurableBackup({ state: { auditLog: [{}] } }), /invalid_audit_entry/);
  assert.throws(() => createDurableBackup({ state: fullState(), baseRevisions: [] }), /invalid_base_revisions/);
  assert.throws(() => createDurableBackup({ state: fullState(), baseRevisions: { 'tasks:x': 1.5 } }), /invalid_base_revision/);
});

test('tombstone duplicate identity is scoped by entity', () => {
  const backup = createDurableBackup({ state: { tombstones: [
    { id: 'same', entity: 'tasks', deletedAt: now },
    { id: 'same', entity: 'projects', deletedAt: now },
  ] } });
  assert.equal(backup.state.tombstones.length, 2);
  assert.throws(() => createDurableBackup({ state: { tombstones: [
    { id: 'same', entity: 'tasks', deletedAt: now },
    { id: 'same', entity: 'tasks', deletedAt: now },
  ] } }), /duplicate_tombstone/);
});

test('credential aliases are stripped from all nested backup content', () => {
  const state = fullState();
  Object.assign(state.collections.tasks[0], {
    authToken: 'auth-secret', feishu_key: 'feishu-secret', supabaseToken: 'supabase-secret', encryption_key: 'crypto-secret',
  });
  const serialized = JSON.stringify(createDurableBackup({ state, createdAt: now }));
  assert.doesNotMatch(serialized, /auth-secret|feishu-secret|supabase-secret|crypto-secret/);
});

test('legacy 1.0.4 backup is converted into the unified state contract', () => {
  const parsed = parseBackupFile(JSON.stringify({
    version: '1.0.4', exportedAt: now,
    tasks: [{ id: 't1', title: '任务' }], inbox: [], projects: [], commands: [],
  }), { deviceId: 'phone-1', now });
  assert.equal(parsed.sourceVersion, '1.0.4');
  assert.equal(parsed.state.collections.tasks[0].id, 't1');
  assert.deepEqual(Object.keys(parsed.state.collections).sort(), [...STATE_ENTITY_TYPES].sort());
  assert.equal(summarizeBackup(parsed).totalRecords, 1);
});

test('safe merge preserves current-only records and never replays backup tombstones', () => {
  const current = fullState();
  current.collections.tasks = [
    { id: 'current-only', title: '保留', revision: 4, updatedAt: '2026-08-06T01:00:00.000Z' },
    { id: 'shared', title: '当前', revision: 2, updatedAt: '2026-08-06T01:00:00.000Z' },
  ];
  const incoming = fullState();
  incoming.collections.tasks = [
    { id: 'shared', title: '备份恢复', revision: 9, updatedAt: '2026-07-01T01:00:00.000Z' },
    { id: 'backup-only', title: '新增恢复', revision: 1, updatedAt: '2026-07-01T01:00:00.000Z' },
  ];
  incoming.tombstones = [{ id: 'current-only', entity: 'tasks', deletedAt: '2026-07-01T01:00:00.000Z' }];
  const merged = buildSafeMergeSnapshot(current, incoming, { now, deviceId: 'mac-1' });
  assert.deepEqual(merged.collections.tasks.map((item) => item.id).sort(), ['backup-only', 'current-only', 'shared']);
  assert.equal(merged.collections.tasks.find((item) => item.id === 'shared').title, '备份恢复');
  assert.equal(merged.collections.tasks.find((item) => item.id === 'shared').revision, 10);
  assert.equal(merged.collections.tasks.find((item) => item.id === 'shared').updatedAt, now);
  assert.equal(merged.collections.tasks.find((item) => item.id === 'current-only').title, '保留');
  assert.equal(merged.tombstones.some((item) => item.id === 'current-only'), false);
});
