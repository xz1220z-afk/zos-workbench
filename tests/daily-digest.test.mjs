import test from 'node:test';
import assert from 'node:assert/strict';

import {
  buildDailyDigestItems,
  buildEveningDigest,
  buildMorningDigest,
} from '../src/app/daily-digest.mjs';

const input = {
  tasks: [
    { id: 'today', title: '确认万嘉回款', dueAt: '2026-08-04T10:00:00+08:00', status: 'todo', priority: 3 },
    { id: 'private', title: '私人办理事项', startAt: '2026-08-04T14:00:00+08:00', status: 'todo', privacy: 'private' },
    { id: 'done', title: '完成花火排期', dueAt: '2026-08-04T09:00:00+08:00', status: 'done', completedAt: '2026-08-04T09:30:00+08:00' },
    { id: 'tomorrow', title: '玲丽招生复盘', dueAt: '2026-08-05T11:00:00+08:00', status: 'todo' },
  ],
  calendar: [
    { id: 'meeting', title: '团队周会', startAt: '2026-08-04T10:00:00+08:00', endAt: '2026-08-04T11:00:00+08:00', privacy: 'work' },
    { id: 'personal', title: '私人约会标题', startAt: '2026-08-04T16:00:00+08:00', endAt: '2026-08-04T17:00:00+08:00', privacy: 'private' },
  ],
  conflicts: [{ left: { id: 'today' }, right: { id: 'meeting' } }],
  importantDates: {
    work: [{ id: 'deadline', title: '合同到期', occurrence: '2026-08-08', days: 4, company: 'wanjia' }],
  },
};

test('morning digest contains only today actions conflicts and key deadlines', () => {
  const digest = buildMorningDigest(input, { date: '2026-08-04', timeZone: 'Asia/Shanghai' });
  assert.equal(digest.kind, 'morning_digest');
  assert.deepEqual(digest.sections.actions.map((item) => item.title), ['确认万嘉回款', '团队周会', '个人安排']);
  assert.equal(digest.sections.conflictCount, 1);
  assert.deepEqual(digest.sections.deadlines.map((item) => item.title), ['合同到期']);
  assert.doesNotMatch(JSON.stringify(digest), /私人约会标题|私人办理事项/);
});

test('evening digest contains completed carry-over and tomorrow focus without private titles', () => {
  const digest = buildEveningDigest(input, { date: '2026-08-04', timeZone: 'Asia/Shanghai' });
  assert.deepEqual(digest.sections.completed.map((item) => item.title), ['完成花火排期']);
  assert.deepEqual(digest.sections.carryOver.map((item) => item.title), ['确认万嘉回款', '个人安排']);
  assert.deepEqual(digest.sections.tomorrow.map((item) => item.title), ['玲丽招生复盘']);
  assert.doesNotMatch(JSON.stringify(digest), /私人办理事项|私人约会标题/);
});

test('daily digest reminder items schedule today evening and next morning in stable UTC', () => {
  const items = buildDailyDigestItems(input, {
    date: '2026-08-04', timeZone: 'Asia/Shanghai', morningTime: '07:30', eveningTime: '21:30', includeTomorrowMorning: true,
  });
  assert.deepEqual(items.map((item) => [item.entityType, item.reminderAt]), [
    ['morning_digest', '2026-08-03T23:30:00.000Z'],
    ['evening_digest', '2026-08-04T13:30:00.000Z'],
    ['morning_digest', '2026-08-04T23:30:00.000Z'],
  ]);
  assert.equal(new Set(items.map((item) => item.id)).size, 3);
  assert.ok(items.every((item) => item.body && item.privacy === 'work'));
});
