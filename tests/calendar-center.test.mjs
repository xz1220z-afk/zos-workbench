import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, calendarPeriod, detectCalendarConflicts, redactLifeEventForWork } from '../src/app/calendar-center.mjs';

test('calendar combines company milestones, local tasks and private busy slots', () => {
  const calendar = buildCalendar({
    tasks: [{ id: 't1', title: '复核方案', dueDate: '2026-08-02', company: 'wanjia' }],
    projects: [{ id: 'p1', name: '客户片交付', dueAt: '2026-08-02T10:00:00+08:00', company: 'huahuo' }],
    life: [{ id: 'l1', title: '家庭安排', startAt: '2026-08-02T10:30:00+08:00', endAt: '2026-08-02T11:30:00+08:00', privacy: 'private' }],
  });
  assert.equal(calendar.length, 3);
  assert.equal(calendar.find((entry) => entry.id === 'l1').title, '家庭安排');
  assert.equal(redactLifeEventForWork(calendar.find((entry) => entry.id === 'l1')).title, '个人安排');
});

test('calendar conflict detector finds overlapping timed events', () => {
  const conflicts = detectCalendarConflicts([
    { id: 'a', startAt: '2026-08-02T10:00:00+08:00', endAt: '2026-08-02T11:00:00+08:00' },
    { id: 'b', startAt: '2026-08-02T10:30:00+08:00', endAt: '2026-08-02T12:00:00+08:00' },
    { id: 'c', startAt: '2026-08-02T13:00:00+08:00', endAt: '2026-08-02T14:00:00+08:00' },
  ]);
  assert.deepEqual(conflicts.map((conflict) => conflict.ids), [['a', 'b']]);
});

test('calendar includes private user-created events and supports day week month ranges', () => {
  const calendar = buildCalendar({
    calendar: [
      { id: 'manual-1', title: '经营会', startAt: '2026-08-02T09:00:00+08:00', endAt: '2026-08-02T10:00:00+08:00', company: 'ceo' },
      { id: 'manual-2', title: '月度复盘', startAt: '2026-08-16T09:00:00+08:00', company: 'ceo' },
    ],
  });
  assert.equal(calendar.length, 2);
  assert.deepEqual(calendarPeriod(calendar, { view: 'day', anchor: '2026-08-02T12:00:00+08:00' }).map((item) => item.id), ['manual-1']);
  assert.deepEqual(calendarPeriod(calendar, { view: 'month', anchor: '2026-08-02T12:00:00+08:00' }).map((item) => item.id), ['manual-1', 'manual-2']);
});
