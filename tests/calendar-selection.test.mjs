import test from 'node:test';
import assert from 'node:assert/strict';

import {
  calendarSelectionDraft,
  normalizeCalendarSelection,
  shouldBeginCalendarSelection,
} from '../src/app/calendar-selection.mjs';

test('reverse drag produces one inclusive date range in chronological order', () => {
  assert.deepEqual(normalizeCalendarSelection('2026-08-12', '2026-08-10'), {
    startDate: '2026-08-10',
    endDate: '2026-08-12',
  });
});

test('month selection creates an all-day task draft that includes the last selected day', () => {
  assert.deepEqual(calendarSelectionDraft({
    startDate: '2026-08-10',
    endDate: '2026-08-12',
  }, { view: 'month' }), {
    kind: 'task',
    allDay: true,
    startAt: '2026-08-10T00:00',
    dueAt: '2026-08-12T23:59',
  });
});

test('day selection creates a one-hour schedule draft using the chosen time', () => {
  assert.deepEqual(calendarSelectionDraft({
    startDate: '2026-08-10',
    endDate: '2026-08-10',
  }, { view: 'day', startTime: '14:30' }), {
    kind: 'calendar',
    allDay: false,
    startAt: '2026-08-10T14:30',
    endAt: '2026-08-10T15:30',
  });
});

test('invalid date selections are rejected before an editor opens', () => {
  assert.throws(
    () => normalizeCalendarSelection('2026-02-30', '2026-08-10'),
    /calendar_selection_invalid/,
  );
});

test('mouse selection starts immediately while touch waits for a deliberate long press', () => {
  assert.equal(shouldBeginCalendarSelection({ pointerType: 'mouse', elapsedMs: 0 }), true);
  assert.equal(shouldBeginCalendarSelection({ pointerType: 'pen', elapsedMs: 0 }), true);
  assert.equal(shouldBeginCalendarSelection({ pointerType: 'touch', elapsedMs: 200 }), false);
  assert.equal(shouldBeginCalendarSelection({ pointerType: 'touch', elapsedMs: 350 }), true);
});
