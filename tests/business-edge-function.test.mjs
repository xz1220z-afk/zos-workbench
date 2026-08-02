import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../supabase/functions/zos-business-data/index.ts', import.meta.url), 'utf8');
const sharedAuth = await readFile(new URL('../supabase/functions/_shared/auth.ts', import.meta.url), 'utf8');
const sharedFeishu = await readFile(new URL('../supabase/functions/_shared/feishu.ts', import.meta.url), 'utf8');
const runtimeSource = `${source}\n${sharedAuth}\n${sharedFeishu}`;
const migration = await readFile(new URL('../supabase/migrations/002_business_data_cache.sql', import.meta.url), 'utf8');
const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

assert.match(runtimeSource, /FEISHU_APP_ID/);
assert.match(runtimeSource, /FEISHU_APP_SECRET/);
assert.match(runtimeSource, /auth\.getUser/);
assert.match(runtimeSource, /SUPABASE_PUBLISHABLE_KEYS/,
  'Function supports current Supabase publishable-key environment variables');
assert.match(runtimeSource, /SUPABASE_ANON_KEY/,
  'Function remains compatible with legacy Supabase anon-key environments');
assert.match(runtimeSource, /tenant_access_token\/internal/);
assert.match(runtimeSource, /records\/search/);
assert.match(runtimeSource, /feishu_auth_failed/,
  'Function reports the safe application-auth failure reason to signed-in clients');
assert.match(runtimeSource, /feishu_read_failed/,
  'Function reports the safe table-read failure reason to signed-in clients');
assert.match(runtimeSource, /AbortSignal\.timeout\(12_000\)/,
  'Every Feishu request has a bounded timeout instead of leaving page refreshes pending indefinitely');
assert.match(source, /sourceRecordId:\s*record\.record_id\s*\|\|\s*null/,
  'Mapped records preserve the real Feishu record identity and never synthesize a write identity');
assert.match(source, /writeAvailable:\s*Boolean\(record\.record_id\)/,
  'Records without a real Feishu identity remain readable but cannot be written');
assert.match(source, /sourceUpdatedAt/,
  'Mapped records preserve a safe source update timestamp');
assert.match(source, /contractVersion:\s*'1\.3'/,
  'Read payloads expose the explicit v1.3 contract');
assert.match(source, /const health = \(recordCount: number\) => \(\{\s*recordCount,\s*durationMs,\s*lastSuccessAt: completedAt,\s*safeCode: null\s*\}\)/,
  'Read payloads expose safe source health evidence');
assert.doesNotMatch(source, /sourceRecordId:\s*`[^`]*\$\{idx\}/,
  'Array indexes must never become Feishu write identities');
assert.match(source, /searchParams\.get\('source'\)/,
  'Function can limit a page refresh to its requested read-only source');
assert.match(runtimeSource, /1254302/,
  'Function classifies Feishu advanced-permission failures without exposing raw upstream responses');
assert.match(runtimeSource, /1254045/,
  'Function classifies missing or inaccessible Feishu field names safely');
assert.match(source, /wanjia/);
assert.match(source, /huahuo/);
assert.doesNotMatch(runtimeSource, /cli_aab7f0f691b8dcb3|yimbjqe4EDassDFqmUR9Lh0xdzBHyMvQ/,
  'No user-provided credential may be committed to the Edge Function');
assert.match(migration, /create table if not exists public\.zos_business_cache/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /auth\.uid\(\) = user_id/i);
assert.match(config, /\[functions\.zos-business-data\]/);
assert.match(config, /verify_jwt\s*=\s*true/);

console.log('Business Edge Function safety checks passed');
