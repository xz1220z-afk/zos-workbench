import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  authorizeInternalRefresh,
  buildBusinessCacheRow,
  buildBusinessCacheRows,
} from '../supabase/functions/_shared/internal-refresh.mjs';

test('internal refresh rejects missing or incorrect server secret before returning an owner', () => {
  assert.throws(
    () => authorizeInternalRefresh({ providedSecret: '', expectedSecret: 'server-only', ownerId: 'owner-1' }),
    (error) => error.code === 'forbidden' && error.status === 403,
  );
  assert.throws(
    () => authorizeInternalRefresh({ providedSecret: 'wrong', expectedSecret: 'server-only', ownerId: 'owner-1' }),
    (error) => error.code === 'forbidden' && error.status === 403,
  );
});

test('internal refresh refuses incomplete server configuration', () => {
  assert.throws(
    () => authorizeInternalRefresh({ providedSecret: 'same', expectedSecret: 'same', ownerId: '' }),
    (error) => error.code === 'service_not_configured' && error.status === 503,
  );
});

test('authorized refresh returns only the configured owner identity', () => {
  assert.equal(authorizeInternalRefresh({
    providedSecret: 'server-only', expectedSecret: 'server-only', ownerId: 'owner-1',
  }), 'owner-1');
});

test('cache rows are owner scoped, expire after thirty minutes, and exclude response metadata', () => {
  const rows = buildBusinessCacheRows('owner-1', {
    wanjia: { summary: { paymentGmv: 1 }, records: [], contractVersion: '1.3' },
    huahuo: { summary: { outstandingAmount: 2 }, records: [], contractVersion: '1.3' },
    lingli: { summary: { received: 3 }, records: [], contractVersion: '1.6' },
    projects: { projects: [], contractVersion: '1.3' },
    meta: { mode: 'read_only', fetchedAt: '2026-08-02T08:00:00.000Z' },
  }, 1_754_121_600_000);

  assert.deepEqual(rows.map((row) => row.source), ['wanjia', 'huahuo', 'lingli', 'projects']);
  assert.ok(rows.every((row) => row.user_id === 'owner-1'));
  assert.ok(rows.every((row) => row.expires_at === '2025-08-02T08:30:00.000Z'));
  assert.ok(rows.every((row) => row.payload.mode === 'read_only'));
  assert.ok(rows.every((row) => !('meta' in row.payload)));
});

test('cache builder rejects non-read-only or incomplete source payloads', () => {
  assert.throws(() => buildBusinessCacheRows('owner-1', {
    wanjia: {}, huahuo: {}, lingli: {}, projects: {}, meta: { mode: 'write' },
  }, 0), /read_only/);
  assert.throws(() => buildBusinessCacheRows('owner-1', {
    wanjia: {}, huahuo: {}, lingli: {}, meta: { mode: 'read_only' },
  }, 0), /projects/);
});

test('single-source cache rows let the scheduler isolate company failures', () => {
  const row = buildBusinessCacheRow('owner-1', 'lingli', {
    lingli: { summary: { received: 3 }, records: [], contractVersion: '1.6' },
    meta: { mode: 'read_only' },
  }, 1_754_121_600_000);

  assert.equal(row.user_id, 'owner-1');
  assert.equal(row.source, 'lingli');
  assert.equal(row.payload.summary.received, 3);
  assert.equal(row.payload.mode, 'read_only');
  assert.equal(row.expires_at, '2025-08-02T08:30:00.000Z');
  assert.throws(() => buildBusinessCacheRow('owner-1', 'unknown', {
    unknown: {}, meta: { mode: 'read_only' },
  }, 0), /unsupported source/);
});

test('server refresh updates business caches and isolates Feishu from public intelligence failures', async () => {
  const source = await readFile(new URL('../supabase/functions/zos-business-refresh/index.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /readBusinessSources\('all'\)/);
  for (const businessSource of ['wanjia', 'huahuo', 'lingli', 'projects']) {
    assert.match(source, new RegExp(`'${businessSource}'`));
  }
  assert.match(source, /buildBusinessCacheRow/);
  assert.match(source, /readIntelligenceSource\(\)/);
  assert.match(source, /readAihotSource\(/);
  assert.match(source, /intelligence_feishu/);
  assert.match(source, /intelligence_aihot/);
  assert.match(source, /prepareIntelligenceRows/);
  assert.match(source, /chunkIntelligenceRows/);
  assert.match(source, /zos_intelligence_items/);
  assert.match(source, /prepareIntelligenceRows\(ownerId/);
  assert.doesNotMatch(source, /raw_body|article_body|full_content/i);
});
