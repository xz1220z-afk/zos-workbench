import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarRangeKey,
  calendarVisibleRange,
  moveCalendarAnchor,
} from '../src/app/calendar-range.mjs';

test('calendar ranges match the visible day week month and list windows', () => {
  assert.equal(calendarVisibleRange({ view: 'day', anchor: '2026-08-03' }).days, 1);
  assert.equal(calendarVisibleRange({ view: 'week', anchor: '2026-08-05' }).startDate, '2026-08-03');
  assert.equal(calendarVisibleRange({ view: 'month', anchor: '2026-08-05' }).days, 42);
  assert.equal(calendarVisibleRange({ view: 'list', anchor: '2026-08-05' }).days, 31);
});

test('calendar navigation preserves date semantics across periods', () => {
  assert.equal(moveCalendarAnchor('2026-08-03', 'day', 1), '2026-08-04');
  assert.equal(moveCalendarAnchor('2026-08-03', 'week', -1), '2026-07-27');
  assert.equal(moveCalendarAnchor('2026-01-31', 'month', 1), '2026-02-28');
  assert.match(
    calendarRangeKey(calendarVisibleRange({ view: 'week', anchor: '2026-08-05' })),
    /^2026-08-03\/2026-08-10$/,
  );
});

test('calendar range rejects invalid anchors and normalizes unknown views', () => {
  assert.throws(() => calendarVisibleRange({ view: 'week', anchor: 'not-a-date' }), /calendar_anchor_invalid/);
  assert.equal(calendarVisibleRange({ view: 'unknown', anchor: '2026-08-05' }).view, 'week');
});
