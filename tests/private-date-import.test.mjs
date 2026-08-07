import test from 'node:test';
import assert from 'node:assert/strict';

import { parsePrivateDateMetadata } from '../src/app/private-date-import.mjs';

test('private date import keeps only explicitly allowed metadata and forces private scope', () => {
  const rows = parsePrivateDateMetadata(JSON.stringify([
    { title: '家人生日', monthDay: '08-10', category: 'relationship', reminderDays: [7, 1], recurring: true },
    { title: '纪念日', date: '2026-12-20', category: 'ritual', reminderDays: [3], recurring: false, privacy: 'private' },
  ]));
  assert.deepEqual(rows[0], {
    title: '家人生日', date: null, monthDay: '08-10', category: 'relationship',
    reminderDays: [7, 1], recurring: true, privacy: 'private',
  });
  assert.equal(rows[1].privacy, 'private');
});

test('private date import rejects bodies, contact details, invalid privacy and invalid dates', () => {
  assert.throws(() => parsePrivateDateMetadata([{ title: 'A', monthDay: '08-10', body: 'private note' }]), /unsupported field/);
  assert.throws(() => parsePrivateDateMetadata([{ title: 'A', monthDay: '08-10', phone: '123' }]), /unsupported field/);
  assert.throws(() => parsePrivateDateMetadata([{ title: 'A', monthDay: '08-10', privacy: 'work' }]), /private only/);
  assert.throws(() => parsePrivateDateMetadata([{ title: 'A', monthDay: '02-30' }]), /invalid monthDay/);
});

test('private date import is bounded and validates title/date shape', () => {
  assert.throws(() => parsePrivateDateMetadata(Array.from({ length: 201 }, (_, index) => ({ title: `A${index}`, monthDay: '01-01' }))), /maximum 200/);
  assert.throws(() => parsePrivateDateMetadata([{ title: '', date: '2026-01-01' }]), /title is required/);
  assert.throws(() => parsePrivateDateMetadata([{ title: 'A' }]), /date or monthDay is required/);
});
