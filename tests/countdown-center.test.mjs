import test from 'node:test';
import assert from 'node:assert/strict';

import {
  countdownDistance,
  nextCountdownOccurrence,
  normalizeCountdown,
} from '../src/app/countdown-center.mjs';

test('annual countdown rolls to the next occurrence in Shanghai', () => {
  const item = normalizeCountdown({
    id: 'c1', title: '纪念日', date: '2020-08-10', recurrence: 'yearly',
  });
  assert.equal(
    nextCountdownOccurrence(item, { now: '2026-08-11T00:00:00+08:00' }),
    '2027-08-10',
  );
  assert.equal(
    nextCountdownOccurrence(item, { now: '2026-08-10T20:00:00+08:00' }),
    '2026-08-10',
  );
});

test('one-off countdown reports future, today and expired calendar-day distance', () => {
  const item = normalizeCountdown({ id: 'c1', title: '交付', date: '2026-08-10' });
  assert.deepEqual(countdownDistance(item, { now: '2026-08-03T23:00:00+08:00' }), {
    occurrence: '2026-08-10', days: 7, state: 'future',
  });
  assert.equal(countdownDistance(item, { now: '2026-08-10T08:00:00+08:00' }).state, 'today');
  assert.deepEqual(countdownDistance(item, { now: '2026-08-12T08:00:00+08:00' }), {
    occurrence: '2026-08-10', days: -2, state: 'expired',
  });
});

test('countdown rejects invalid dates and unsupported recurrence', () => {
  assert.throws(() => normalizeCountdown({ title: '坏日期', date: '2026-02-31' }), /valid countdown date/);
  assert.throws(() => normalizeCountdown({ title: '坏规则', date: '2026-08-10', recurrence: 'weekly' }), /countdown recurrence/);
});
