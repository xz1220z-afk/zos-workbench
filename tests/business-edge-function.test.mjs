import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(new URL('../supabase/functions/zos-business-data/index.ts', import.meta.url), 'utf8');
const sharedAuth = await readFile(new URL('../supabase/functions/_shared/auth.ts', import.meta.url), 'utf8');
const sharedFeishu = await readFile(new URL('../supabase/functions/_shared/feishu.ts', import.meta.url), 'utf8');
const sharedValues = await readFile(new URL('../supabase/functions/_shared/feishu-values.mjs', import.meta.url), 'utf8');
const sharedBusiness = await readFile(new URL('../supabase/functions/_shared/business-data.ts', import.meta.url), 'utf8');
const runtimeSource = `${source}\n${sharedAuth}\n${sharedFeishu}\n${sharedValues}\n${sharedBusiness}`;
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
assert.match(runtimeSource, /sourceRecordId:\s*record\.record_id\s*\|\|\s*null/,
  'Mapped records preserve the real Feishu record identity and never synthesize a write identity');
assert.match(runtimeSource, /writeAvailable:\s*Boolean\(record\.record_id\)/,
  'Records without a real Feishu identity remain readable but cannot be written');
assert.match(runtimeSource, /sourceUpdatedAt/,
  'Mapped records preserve a safe source update timestamp');
assert.match(runtimeSource, /feishuText/,
  'Complex Feishu field values are normalized before entering the client contract');
assert.match(runtimeSource, /roundMoney/,
  'Money summaries are rounded at the source boundary');
assert.doesNotMatch(runtimeSource, /updatedAt:\s*updatedAt\s*\|\|\s*new Date\(0\)/,
  'Missing Feishu update fields must not be converted into a fake 1970 timestamp and false stale risk');
assert.match(runtimeSource, /contractVersion:\s*'1\.3'/,
  'Read payloads expose the explicit v1.3 contract');
assert.match(runtimeSource, /const health = \(recordCount: number\) => \(\{\s*recordCount,\s*durationMs,\s*lastSuccessAt: completedAt,\s*safeCode: null\s*\}\)/,
  'Read payloads expose safe source health evidence');
assert.doesNotMatch(runtimeSource, /sourceRecordId:\s*`[^`]*\$\{idx\}/,
  'Array indexes must never become Feishu write identities');
assert.match(source, /searchParams\.get\('source'\)/,
  'Function can limit a page refresh to its requested read-only source');
assert.match(source, /searchParams\.get\('diagnostic'\)/,
  'Function exposes an explicit diagnostics mode instead of overloading normal business reads');
assert.match(source, /\['lingli_tables', 'lingli_fields'\]\.includes\(diagnostic\)/,
  'Owner diagnostics can inspect current Lingli table titles without reading records');
assert.match(source, /lingli_fields/,
  'Owner diagnostics can inspect field titles for one explicitly selected Lingli table');
assert.match(source, /searchParams\.get\('table_name'\)/,
  'Field diagnostics require an explicit current table title');
assert.match(source, /listFieldNames/,
  'Field diagnostics use Feishu metadata rather than reading records');
assert.match(source, /identity\.user\.id\s*!==\s*ownerId/,
  'Schema diagnostics are restricted to the configured ZOS owner');
assert.match(source, /table\.name/,
  'Schema diagnostics return table titles only');
assert.doesNotMatch(source, /diagnostic[\s\S]{0,800}listRecords/,
  'Schema diagnostics must not read or return Lingli records');
assert.match(runtimeSource, /1254302/,
  'Function classifies Feishu advanced-permission failures without exposing raw upstream responses');
assert.match(runtimeSource, /1254045/,
  'Function classifies missing or inaccessible Feishu field names safely');
assert.match(runtimeSource, /wanjia/);
assert.match(sharedBusiness, /state:\s*'historical_snapshot'/,
  'The existing Wanjia source is explicitly historical until the daily tables are connected and validated');
assert.match(sharedBusiness, /sourceTables:\s*\['01\.04 商家管理（定时收集）'\]/,
  'The old Wanjia table is named as a historical source instead of an implicit realtime feed');
assert.match(runtimeSource, /huahuo/);
assert.match(runtimeSource, /开始时间|拍摄开始时间/,
  'Huahuo read contract requests a proven shooting start field alias');
assert.match(runtimeSource, /结束时间|拍摄结束时间/,
  'Huahuo read contract requests a proven shooting end field alias');
assert.match(runtimeSource, /members:/,
  'Huahuo metadata contract preserves assigned people without narrative bodies');
assert.match(runtimeSource, /roles:/,
  'Huahuo metadata contract preserves assignment roles');
assert.match(runtimeSource, /标准运营动作|预期动作|运营动作清单/,
  'Wanjia read contract requests the source-provided operating action standard');
assert.match(runtimeSource, /expectedActionLabels:\s*feishuList/,
  'Wanjia records preserve the source action standard for honest done and missing buckets');
assert.doesNotMatch(runtimeSource, /cli_aab7f0f691b8dcb3|yimbjqe4EDassDFqmUR9Lh0xdzBHyMvQ/,
  'No user-provided credential may be committed to the Edge Function');
assert.match(migration, /create table if not exists public\.zos_business_cache/i);
assert.match(migration, /enable row level security/i);
assert.match(migration, /auth\.uid\(\) = user_id/i);
assert.match(config, /\[functions\.zos-business-data\]/);
assert.match(config, /verify_jwt\s*=\s*true/);

console.log('Business Edge Function safety checks passed');
