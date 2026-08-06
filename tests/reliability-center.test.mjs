import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildSafeBackup,
  listRestorableItems,
  reminderSnoozeAt,
  buildReliabilityOverview,
} from '../src/app/reliability-center.mjs';

test('safe backup includes recoverable state but removes credentials recursively', () => {
  const backup = buildSafeBackup({
    state: {
      schemaVersion: '1.7', deviceId: 'mac-1',
      collections: { tasks: [{
        id: 't1', title: '核对回款', accessToken: 'never', serviceRoleKey: 'never-role',
        privateKey: 'never-private', sessionCookie: 'never-cookie',
      }] },
      tombstones: [], auditLog: [{ id: 'a1', action: 'create', apiKey: 'never' }],
    },
    baseRevisions: { 'tasks:t1': 2 },
    createdAt: '2026-08-06T08:00:00.000Z',
  });
  assert.equal(backup.product, 'ZOS CEO Operating System');
  assert.equal(backup.createdAt, '2026-08-06T08:00:00.000Z');
  assert.equal(backup.state.collections.tasks[0].title, '核对回款');
  assert.doesNotMatch(JSON.stringify(backup), /accessToken|apiKey|serviceRoleKey|privateKey|sessionCookie|never/);
  assert.deepEqual(backup.baseRevisions, { 'tasks:t1': 2 });
});

test('safe backup keeps legitimate focus session records and their revision baselines', () => {
  const backup = buildSafeBackup({
    state: { collections: { focus_sessions: [{ id: 'focus-1', title: '专注工作' }] }, tombstones: [] },
    baseRevisions: { 'focus_sessions:focus-1': 4 },
  });
  assert.equal(backup.state.collections.focus_sessions[0].id, 'focus-1');
  assert.equal(backup.baseRevisions['focus_sessions:focus-1'], 4);
});

test('recycle bin exposes only records deleted within the last 30 days', () => {
  const items = listRestorableItems([
    { id: 'recent', entity: 'tasks', title: '近期删除', deletedAt: '2026-08-01T08:00:00.000Z' },
    { id: 'old', entity: 'tasks', title: '历史删除', deletedAt: '2026-06-01T08:00:00.000Z' },
  ], { now: '2026-08-06T08:00:00.000Z', retentionDays: 30 });
  assert.deepEqual(items.map((item) => item.id), ['recent']);
  assert.equal(items[0].daysRemaining, 25);
});

test('snooze supports ten minutes, one hour and next day at nine', () => {
  const now = '2026-08-06T08:15:00.000Z';
  assert.equal(reminderSnoozeAt('10m', { now }), '2026-08-06T08:25:00.000Z');
  assert.equal(reminderSnoozeAt('1h', { now }), '2026-08-06T09:15:00.000Z');
  assert.equal(reminderSnoozeAt('tomorrow', { now, timeZoneOffsetMinutes: 480 }), '2026-08-07T01:00:00.000Z');
});

test('reliability overview translates technical sync state into actionable counts', () => {
  const overview = buildReliabilityOverview({
    online: false,
    deviceId: 'mac-1',
    syncStatus: { phase: 'retry-wait', attempts: 2, pendingUploads: 3, nextRetryAt: '2026-08-06T08:01:00.000Z' },
    conflicts: [{ id: 'targets:1' }],
    tombstones: [{ id: 'x', entity: 'tasks', deletedAt: '2026-08-05T08:00:00.000Z' }],
    auditLog: [{ id: 'a1' }, { id: 'a2' }],
    now: '2026-08-06T08:00:00.000Z',
  });
  assert.equal(overview.label, '等待网络');
  assert.equal(overview.pendingUploads, 3);
  assert.equal(overview.conflicts, 1);
  assert.equal(overview.restorable, 1);
  assert.equal(overview.auditEntries, 2);
});
