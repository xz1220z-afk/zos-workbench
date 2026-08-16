import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const migrationUrl = new URL('../supabase/migrations/012_zos_records_realtime.sql', import.meta.url);

test('realtime migration adds zos_records to the publication only when absent', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(migration, /pg_publication_tables/i);
  assert.match(migration, /pubname\s*=\s*'supabase_realtime'/i);
  assert.match(migration, /schemaname\s*=\s*'public'/i);
  assert.match(migration, /tablename\s*=\s*'zos_records'/i);
  assert.match(migration, /if\s+not\s+exists/i);
  assert.match(migration, /alter publication supabase_realtime add table public\.zos_records/i);
});

test('realtime migration preserves owner RLS and supports complete change identity', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.match(migration, /alter table public\.zos_records enable row level security/i);
  assert.match(migration, /alter table public\.zos_records replica identity full/i);
  assert.doesNotMatch(migration, /disable row level security/i);
  assert.doesNotMatch(migration, /create policy/i);
  assert.doesNotMatch(migration, /using\s*\(\s*true\s*\)/i);
  assert.doesNotMatch(migration, /with check\s*\(\s*true\s*\)/i);
});

test('realtime migration is configuration-only and contains no credentials or fixed users', async () => {
  const migration = await readFile(migrationUrl, 'utf8');

  assert.doesNotMatch(migration, /service_role|api[_-]?key|secret|password|bearer/i);
  assert.doesNotMatch(migration, /[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/i);
});
