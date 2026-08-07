import test from 'node:test';
import assert from 'node:assert/strict';

import { upcomingRituals } from '../src/app/ritual-calendar.mjs';

test('rituals are chronological, calculate lead days and roll into the next year', () => {
  const result = upcomingRituals({ now: '2026-12-26T08:00:00+08:00', horizonDays: 20 });
  assert.equal(result[0].id, 'new-years-eve');
  assert.equal(result[0].daysUntil, 5);
  assert.equal(result[1].id, 'new-year');
  assert.equal(result[1].occurrence, '2027-01-01');
  assert.equal(result[1].daysUntil, 6);
  assert.deepEqual(result[1].reminderDays, [7, 3, 1, 0]);
  assert.ok(result.every((item, index) => index === 0 || item.daysUntil >= result[index - 1].daysUntil));
});

test('ignored rituals and out-of-horizon rituals are excluded deterministically', () => {
  const result = upcomingRituals({
    now: '2026-08-01T08:00:00+08:00', horizonDays: 10, ignoredIds: ['start-of-autumn-milk-tea'],
  });
  assert.equal(result.some((item) => item.id === 'start-of-autumn-milk-tea'), false);
  assert.ok(result.every((item) => item.daysUntil >= 0 && item.daysUntil <= 10));
});
