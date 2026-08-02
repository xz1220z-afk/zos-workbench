import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCachedBusinessPayload } from '../supabase/functions/_shared/business-cache.mjs';

const now = Date.parse('2026-08-02T12:00:00.000Z');
const row = (source, minutes = 20) => ({
  source,
  payload: { source, mode: 'read_only', contractVersion: '1.3', records: [] },
  fetched_at: '2026-08-02T11:55:00.000Z',
  expires_at: new Date(now + minutes * 60_000).toISOString(),
});

test('fresh owner-scoped cache satisfies a selected business source without Feishu fallback', () => {
  const payload = buildCachedBusinessPayload([row('wanjia')], 'wanjia', now);
  assert.equal(payload.wanjia.source, 'wanjia');
  assert.equal(payload.meta.mode, 'read_only');
  assert.equal(payload.meta.cache, 'cloud');
  assert.equal(payload.meta.fetchedAt, '2026-08-02T11:55:00.000Z');
});

test('all-source cache requires every business source and rejects stale or unsafe rows', () => {
  assert.equal(buildCachedBusinessPayload([row('wanjia'), row('huahuo')], 'all', now), null);
  assert.equal(buildCachedBusinessPayload([row('wanjia', -1)], 'wanjia', now), null);
  const unsafe = row('wanjia');
  unsafe.payload.mode = 'write';
  assert.equal(buildCachedBusinessPayload([unsafe], 'wanjia', now), null);
  assert.ok(buildCachedBusinessPayload([row('wanjia'), row('huahuo'), row('projects')], 'all', now));
});

test('business endpoint reads RLS cache first and preserves read-only Feishu fallback', async () => {
  const source = await import('node:fs/promises').then(({ readFile }) =>
    readFile(new URL('../supabase/functions/zos-business-data/index.ts', import.meta.url), 'utf8'));
  assert.match(source, /zos_business_cache/);
  assert.match(source, /buildCachedBusinessPayload/);
  assert.ok(source.indexOf("from('zos_business_cache')") < source.indexOf('readBusinessSources(requestedSource'));
  assert.doesNotMatch(source, /method:\s*['"](?:POST|PUT|PATCH|DELETE)['"]/i);
  assert.doesNotMatch(source, /app_secret|FEISHU_APP_SECRET/);
});
