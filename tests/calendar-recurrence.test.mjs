import test from 'node:test';
import assert from 'node:assert/strict';

import {
  expandRecurringEvents,
  seriesMutationRecords,
} from '../src/app/calendar-recurrence.mjs';

const RANGE = {
  rangeStart: '2026-08-01T00:00:00.000Z',
  rangeEnd: '2026-08-25T00:00:00.000Z',
};

test('weekly recurrence expands only inside the visible range and applies a cancelled exception', () => {
  const rows = expandRecurringEvents([
    {
      id: 'series-1', seriesId: 'series-1', title: '经营周会',
      startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-03T03:00:00.000Z',
      recurrenceRule: { frequency: 'weekly', interval: 1, byWeekdays: [1] },
    },
    {
      id: 'exception-1', seriesId: 'series-1',
      originalStartAt: '2026-08-10T02:00:00.000Z', exceptionType: 'cancelled',
    },
  ], RANGE);
  assert.deepEqual(rows.map((row) => row.startAt.slice(0, 10)), ['2026-08-03', '2026-08-17', '2026-08-24']);
});

test('modified exceptions replace occurrences and count and until stop expansion', () => {
  const rows = expandRecurringEvents([
    {
      id: 'daily', title: '站会', startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-03T02:30:00.000Z',
      recurrenceRule: { frequency: 'daily', count: 4, until: '2026-08-10T00:00:00.000Z' },
    },
    {
      id: 'moved', seriesId: 'daily', originalStartAt: '2026-08-04T02:00:00.000Z',
      exceptionType: 'modified', title: '改期站会', startAt: '2026-08-04T06:00:00.000Z', endAt: '2026-08-04T06:30:00.000Z',
    },
  ], RANGE);
  assert.equal(rows.length, 4);
  assert.equal(rows[1].title, '改期站会');
  assert.equal(rows.at(-1).startAt.slice(0, 10), '2026-08-06');
});

test('daily recurrence is bounded to 500 visible instances per series', () => {
  const rows = expandRecurringEvents([{
    id: 'long', title: '长期打卡', startAt: '2020-01-01T02:00:00.000Z', endAt: '2020-01-01T03:00:00.000Z',
    recurrenceRule: { frequency: 'daily' },
  }], { rangeStart: '2020-01-01T00:00:00.000Z', rangeEnd: '2030-01-01T00:00:00.000Z' });
  assert.equal(rows.length, 500);
});

test('single occurrence deletion produces a synchronized cancelled exception', () => {
  const [record] = seriesMutationRecords(
    { id: 'series-1', seriesId: 'series-1', recurrenceRule: { frequency: 'weekly', interval: 1 } },
    { originalStartAt: '2026-08-10T02:00:00.000Z' },
    'single',
    { deleted: true },
  );
  assert.equal(record.exceptionType, 'cancelled');
  assert.equal(record.id, 'calendar-exception:series-1:2026-08-10T02:00:00.000Z');
  assert.equal(record.originalStartAt, '2026-08-10T02:00:00.000Z');
});

test('future mutation closes the old series and creates a new one at the boundary', () => {
  const [oldSeries, newSeries] = seriesMutationRecords(
    {
      id: 'series-1', seriesId: 'series-1', title: '周会',
      startAt: '2026-08-03T02:00:00.000Z', endAt: '2026-08-03T03:00:00.000Z',
      recurrenceRule: { frequency: 'weekly', interval: 1 },
    },
    { originalStartAt: '2026-08-17T02:00:00.000Z' },
    'future',
    { title: '新版周会' },
  );
  assert.ok(new Date(oldSeries.recurrenceRule.until) < new Date('2026-08-17T02:00:00.000Z'));
  assert.equal(newSeries.id, undefined);
  assert.equal(newSeries.seriesId, undefined);
  assert.equal(newSeries.startAt, '2026-08-17T02:00:00.000Z');
  assert.equal(newSeries.endAt, '2026-08-17T03:00:00.000Z');
  assert.equal(newSeries.title, '新版周会');
});
