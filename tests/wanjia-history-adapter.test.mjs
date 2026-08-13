import assert from 'node:assert/strict';
import test from 'node:test';
import { buildHistoryPayload, collectHistoryPages } from '../supabase/functions/_shared/wanjia-history.mjs';

const batches = [
  { business_date: '2026-08-07', row_count: 351, source_kind: 'period_snapshot', validated_at: '2026-08-08T09:00:00Z' },
  { business_date: '2026-08-08', row_count: 351, source_kind: 'period_snapshot', validated_at: '2026-08-08T09:05:00Z' },
];

test('maps only the allowlisted 8/7-8 snapshot view and never returns source artefacts', () => {
  const result = buildHistoryPayload(batches, [{
    business_date: '2026-08-08', merchant_id: 'merchant-1', merchant_name: '测试商家',
    payment_gmv: '123.45', redeemed_gmv: 100, exception: false, source_kind: 'period_snapshot',
    source_sha256: 'a'.repeat(64), source_name: 'private.xlsx', raw_json: '{"unsafe":true}',
  }]);
  assert.deepEqual(result.availability, {
    state: 'validated', source: 'local_sqlite', earliestDate: '2026-08-07', latestDate: '2026-08-08', batchCount: 2,
  });
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].paymentGmv, 123.45);
  assert.equal(result.rows[0].sourceKind, 'period_snapshot');
  assert.doesNotMatch(JSON.stringify(result), /source_sha256|source_name|raw_json|private\.xlsx/i);
});

test('collects every deterministic history page instead of silently stopping at the Supabase 1000-row limit', async () => {
  const source = Array.from({ length: 2_105 }, (_, index) => ({ merchant_id: `merchant-${index}` }));
  const requested = [];
  const result = await collectHistoryPages(async (from, to) => {
    requested.push([from, to]);
    return { data: source.slice(from, to + 1), error: null };
  });

  assert.equal(result.error, null);
  assert.equal(result.rows.length, 2_105);
  assert.deepEqual(requested, [[0, 999], [1000, 1999], [2000, 2999]]);
});
