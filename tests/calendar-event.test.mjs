import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarEventCapabilities,
  normalizeCalendarDraft,
  validateCalendarDraft,
} from '../src/app/calendar-event.mjs';

test('calendar drafts preserve multi-day fields and reject inverted ranges', () => {
  const event = normalizeCalendarDraft({
    title: '花火连拍',
    startAt: '2026-08-10T09:00:00+08:00',
    endAt: '2026-08-12T18:00:00+08:00',
    company: 'huahuo',
    privacy: 'work',
    notes: '三日拍摄',
    allDay: false,
  });
  assert.equal(event.title, '花火连拍');
  assert.equal(event.company, 'huahuo');
  assert.equal(event.notes, '三日拍摄');
  assert.equal(event.source, 'user_calendar');
  assert.throws(
    () => normalizeCalendarDraft({ title: '错误', startAt: '2026-08-12T10:00', endAt: '2026-08-11T10:00' }),
    /calendar_end_before_start/,
  );
});

test('draft validation reports required title and invalid timestamps', () => {
  assert.deepEqual(validateCalendarDraft({ title: '', startAt: 'bad' }), ['calendar_title_required', 'calendar_time_invalid']);
  assert.throws(() => normalizeCalendarDraft({ title: '', startAt: '2026-08-10T09:00' }), /calendar_title_required/);
});

test('partial edits preserve existing optional values and support explicit clearing', () => {
  const existing = {
    title: '经营会', startAt: '2026-08-10T01:00:00.000Z', endAt: '2026-08-10T02:00:00.000Z',
    allDay: false, company: 'wanjia', privacy: 'private', notes: '保留', reminders: [15],
  };
  assert.equal(normalizeCalendarDraft({ title: '经营复盘' }, existing).notes, '保留');
  assert.equal(normalizeCalendarDraft({ notes: '' }, existing).notes, '');
});

test('recurrence and synchronized exception identity survive normalization', () => {
  const recurring = normalizeCalendarDraft({
    title: '每周经营会', startAt: '2026-08-10T01:00:00.000Z', endAt: '2026-08-10T02:00:00.000Z',
    recurrenceRule: { frequency: 'weekly', interval: 2, byWeekdays: [1, 3] },
  });
  assert.deepEqual(recurring.recurrenceRule, { frequency: 'weekly', interval: 2, byWeekdays: [1, 3] });

  const exception = normalizeCalendarDraft({
    id: 'calendar-exception:series-1:2026-08-10T01:00:00.000Z',
    title: '改期经营会', startAt: '2026-08-10T03:00:00.000Z', endAt: '2026-08-10T04:00:00.000Z',
    seriesId: 'series-1', originalStartAt: '2026-08-10T01:00:00.000Z', exceptionType: 'modified',
  });
  assert.equal(exception.id, 'calendar-exception:series-1:2026-08-10T01:00:00.000Z');
  assert.equal(exception.seriesId, 'series-1');
  assert.equal(exception.originalStartAt, '2026-08-10T01:00:00.000Z');
  assert.equal(exception.exceptionType, 'modified');
});

test('only ZOS local events expose destructive calendar actions', () => {
  assert.deepEqual(
    calendarEventCapabilities({ source: 'user_calendar' }),
    { edit: true, remove: true, drag: true, openSource: false, copy: true },
  );
  assert.deepEqual(
    calendarEventCapabilities({ source: 'feishu_calendar', sourceUrl: 'https://open.feishu.cn/' }),
    { edit: false, remove: false, drag: false, openSource: true, copy: true },
  );
  assert.equal(calendarEventCapabilities({ source: 'feishu_calendar', sourceUrl: 'javascript:alert(1)' }).openSource, false);
});
