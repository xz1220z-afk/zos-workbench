import test from 'node:test';
import assert from 'node:assert/strict';

import { buildImportantDates } from '../src/app/important-dates.mjs';

const NOW = '2026-08-04T08:00:00+08:00';

test('work deadlines include only business dates in the next thirty days', () => {
  const result = buildImportantDates([
    { id: 'w1', title: '万嘉合同到期', date: '2026-08-10', company: 'wanjia', privacy: 'work' },
    { id: 'w2', title: '花火远期交付', date: '2026-10-10', company: 'huahuo', privacy: 'work' },
    { id: 'l1', title: '家人生日', date: '2026-08-12', company: 'life', privacy: 'private' },
  ], { now: NOW });

  assert.deepEqual(result.work.map((item) => item.id), ['w1']);
  assert.equal(result.work[0].days, 6);
});

test('life dates stay private and annual dates roll to the next occurrence', () => {
  const result = buildImportantDates([
    { id: 'l1', title: '纪念日', date: '2020-08-03', recurrence: 'yearly', company: 'life', privacy: 'private' },
    { id: 'old', title: '已过事项', date: '2026-08-01', company: 'life', privacy: 'private' },
  ], { now: NOW });

  assert.deepEqual(result.life.map((item) => item.id), ['l1']);
  assert.equal(result.life[0].occurrence, '2027-08-03');
});

