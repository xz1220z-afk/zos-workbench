import test from 'node:test';
import assert from 'node:assert/strict';

import { buildDurableReminderSchedule, buildReminderQueue, notifyGrantedReminders } from '../src/app/reminder-center.mjs';

test('builds an idempotent in-app reminder queue from actionable Top 3 items', () => {
  const queue = buildReminderQueue([
    { id: 'task:1', title: '核对回款', reason: '已逾期 2 天', sourceType: 'task', sourceId: '1', dueAt: '2026-08-01', owner: '小王', recommendedAction: '确认收款日期' },
    { id: 'intel:2', title: '平台规则更新', reason: '高相关行业情报 · 95 分', sourceType: 'intelligence', sourceId: '2' },
  ], { now: '2026-08-03T09:00:00.000Z' });

  assert.equal(queue.length, 2);
  assert.equal(queue[0].id, 'reminder:task:1:2026-08-03');
  assert.equal(queue[0].channel, 'in_app');
  assert.equal(queue[0].status, 'pending');
  assert.equal(queue[0].owner, '小王');
  assert.equal(queue[1].owner, null);
});

test('browser notification adapter never prompts and sends only after permission was granted', () => {
  const calls = [];
  const queue = buildReminderQueue([{ id: 'task:1', title: '核对回款', sourceType: 'task', sourceId: '1' }], { now: '2026-08-03T09:00:00.000Z' });
  assert.deepEqual(notifyGrantedReminders(queue, { Notification: { permission: 'default' } }), { sent: 0, state: 'permission_required' });

  class FakeNotification {
    static permission = 'granted';
    constructor(title, options) { calls.push({ title, options }); }
  }
  assert.deepEqual(notifyGrantedReminders(queue, { Notification: FakeNotification }), { sent: 1, state: 'sent' });
  assert.equal(calls[0].title, 'ZOS 今日提醒');
  assert.equal(calls[0].options.tag, queue[0].id);
});

test('durable schedule converts explicit and relative reminders into stable UTC jobs', () => {
  const jobs = buildDurableReminderSchedule([
    { id: 'task-1', entityType: 'task', title: '核对回款', reminderAt: '2026-08-10T09:00:00+08:00' },
    { id: 'event-1', entityType: 'calendar', title: '团队周会', startAt: '2026-08-10T10:00:00+08:00', reminders: [15, 60] },
  ], { ownerId: 'owner-1', now: '2026-08-04T00:00:00.000Z' });

  assert.deepEqual(jobs.map((item) => item.scheduledAt), [
    '2026-08-10T01:00:00.000Z',
    '2026-08-10T01:00:00.000Z',
    '2026-08-10T01:45:00.000Z',
  ]);
  assert.equal(new Set(jobs.map((item) => item.dedupeKey)).size, 3);
  assert.ok(jobs.every((item) => item.ownerId === 'owner-1' && item.status === 'pending'));
});

test('durable schedule suppresses completed items, acknowledged keys and private titles', () => {
  const pending = buildDurableReminderSchedule([
    { id: 'done', entityType: 'task', title: '已完成', status: 'done', reminderAt: '2026-08-10T09:00:00Z' },
    { id: 'private', entityType: 'calendar', title: '私人标题', privacy: 'private', startAt: '2026-08-10T10:00:00Z', reminders: [30] },
  ], { ownerId: 'owner-1', now: '2026-08-04T00:00:00Z' });
  assert.equal(pending.length, 1);
  assert.equal(pending[0].title, '个人安排');
  assert.equal(buildDurableReminderSchedule([
    { id: 'private', entityType: 'calendar', title: '私人标题', privacy: 'private', startAt: '2026-08-10T10:00:00Z', reminders: [30] },
  ], { ownerId: 'owner-1', now: '2026-08-04T00:00:00Z', acknowledged: [pending[0].dedupeKey] }).length, 0);
});
