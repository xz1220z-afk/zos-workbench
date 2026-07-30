import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../supabase/functions/zos-business-data/index.ts', import.meta.url), 'utf8');
const migration = await readFile(new URL('../supabase/migrations/002_business_data_cache.sql', import.meta.url), 'utf8');

assert.match(source, /FEISHU_APP_ID/);
assert.match(source, /FEISHU_APP_SECRET/);
assert.match(source, /auth\.getUser/);
assert.match(source, /tenant_access_token\/internal/);
assert.match(source, /records\/search/);
assert.match(source, /wanjia/);
assert.match(source, /huahuo/);
assert.doesNotMatch(source, /cli_aab7f0f691b8dcb3|yimbjqe4EDassDFqmUR9Lh0xdzBHyMvQ/,
  'No user-provided credential may be committed to the Edge Function');
assert.match(migration, /create table if not exists public\.zos_business_cache/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /auth\.uid\(\) = user_id/i);

console.log('Business Edge Function safety checks passed');
