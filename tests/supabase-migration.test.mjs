import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migration = await readFile(new URL('../supabase/migrations/001_zos_sync.sql', import.meta.url), 'utf8');

test('sync migration keeps records private to the authenticated owner', () => {
  assert.match(migration, /alter table public\.zos_records enable row level security;/i);
  assert.match(migration, /for select to authenticated/i);
  assert.match(migration, /for insert to authenticated/i);
  assert.match(migration, /for update to authenticated/i);
  assert.match(migration, /for delete to authenticated/i);
  assert.match(migration, /auth\.uid\(\)\) = user_id/i);
});

test('sync migration retains deletion tombstones and prevents duplicate owner records', () => {
  assert.match(migration, /deleted_at timestamptz/i);
  assert.match(migration, /unique \(user_id, entity_type, record_id\)/i);
  assert.doesNotMatch(migration, /service_role/i);
});
