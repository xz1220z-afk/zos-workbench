import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildCalendar,
  calendarLayout,
  calendarPeriod,
  detectCalendarConflicts,
  redactLifeEventForWork,
} from '../src/app/calendar-center.mjs';

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

test('calendar excludes countdowns while keeping completed focus records optional', () => {
  const source = {
    countdowns: [{ id: 'c1', title: '交付倒数', date: '2026-08-10' }],
    focusSessions: [{
      id: 'f1', title: '专注', startedAt: '2026-08-03T09:00:00+08:00',
      endedAt: '2026-08-03T09:25:00+08:00', state: 'completed',
    }],
  };
  assert.deepEqual(
    buildCalendar(source, { showCountdowns: true, showFocus: false }).map((item) => item.source),
    [],
  );
  assert.deepEqual(
    buildCalendar(source, { showCountdowns: false, showFocus: true }).map((item) => item.source),
    ['focus'],
  );
});

test('calendar layout creates 7-day week, 42-cell month and grouped list models', () => {
  const events = buildCalendar({
    calendar: [
      { id: 'a', title: '周会', startAt: '2026-08-03T09:00:00+08:00' },
      { id: 'b', title: '复盘', startAt: '2026-08-09T16:00:00+08:00' },
    ],
  });
  const week = calendarLayout(events, { view: 'week', anchor: '2026-08-05T12:00:00+08:00' });
  const month = calendarLayout(events, { view: 'month', anchor: '2026-08-05T12:00:00+08:00' });
  const list = calendarLayout(events, { view: 'list', anchor: '2026-08-05T12:00:00+08:00' });
  assert.equal(week.days.length, 7);
  assert.deepEqual(week.days.flatMap((day) => day.events).map((item) => item.id), ['a', 'b']);
  assert.equal(month.days.length, 42);
  assert.deepEqual(list.groups.map((group) => group.date), ['2026-08-03', '2026-08-09']);
});

test('multi-day events appear on every covered date and period filtering uses overlap', () => {
  const event = {
    id: 'trip', title: '三日拍摄', startAt: '2026-08-03T01:00:00.000Z',
    endAt: '2026-08-05T10:00:00.000Z', source: 'user_calendar',
  };
  const week = calendarLayout([event], { view: 'week', anchor: '2026-08-04', timeZone: 'UTC' });
  assert.deepEqual(
    week.days.filter((day) => day.events.some((row) => row.id === 'trip')).map((day) => day.date),
    ['2026-08-03', '2026-08-04', '2026-08-05'],
  );
  assert.deepEqual(
    calendarPeriod([event], { view: 'day', anchor: '2026-08-04T12:00:00.000Z' }).map((row) => row.id),
    ['trip'],
  );
});
