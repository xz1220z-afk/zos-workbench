import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/005_ceo_os_v1_4.sql', import.meta.url), 'utf8');

test('v1.4 sync contract includes private intelligence, calendar and life entities', () => {
  for (const type of ['intelligence', 'calendar', 'life']) assert.match(sql, new RegExp(`'${type}'`));
  assert.match(sql, /alter table public\.zos_records[\s\S]*zos_records_entity_type_check/i);
});

test('intelligence cache is owner scoped and cannot store raw article bodies', () => {
  assert.match(sql, /create table if not exists public\.zos_intelligence_items/i);
  assert.match(sql, /user_id uuid not null references auth\.users\(id\)/i);
  assert.match(sql, /alter table public\.zos_intelligence_items enable row level security/i);
  assert.match(sql, /auth\.uid\(\)[\s\S]*user_id/i);
  assert.match(sql, /unique \(user_id, external_id\)/i);
  assert.doesNotMatch(sql, /\b(raw_body|article_body|full_content|正文)\b/i);
});

