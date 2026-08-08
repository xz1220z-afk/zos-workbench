import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createBusinessDataCache } from '../src/app/business-data-cache.mjs';

function quotaStorage(limit) {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) {
      if (String(value).length > limit) {
        const error = new Error('Setting the value exceeded the quota.');
        error.name = 'QuotaExceededError';
        throw error;
      }
      values.set(key, String(value));
    },
  };
}

test('quota fallback keeps freshly read business data available for this page and persists a compact read-only copy', () => {
  const storage = quotaStorage(2400);
  const cache = createBusinessDataCache({ storage, maxPersistedBytes: 1800 });
  const records = Array.from({ length: 80 }, (_, index) => ({
    merchantName: `商家 ${index + 1}`,
    merchantId: `merchant-${index + 1}`,
    paymentGmv: index * 10,
    rawPayload: 'x'.repeat(500),
  }));

  const result = cache.save({
    wanjia: { summary: { totalMerchants: 80, activeMerchants: 40, paymentGmv: 1530 }, records, fetchedAt: '2026-08-08T00:00:00.000Z' },
  });

  assert.equal(result.persisted, true);
  assert.equal(result.compacted, true);
  assert.equal(cache.load().wanjia.records.length, 80, 'the just-read page session must not be downgraded');
  const persisted = JSON.parse(storage.getItem('zos_business_data_cache_v1'));
  assert.equal(persisted.wanjia.summary.totalMerchants, 80);
  assert.ok(persisted.wanjia.records.length < 80, 'the disk copy is bounded after quota fallback');
  assert.ok(storage.getItem('zos_business_data_cache_v1').length <= 1800);
});

test('storage quota failure never turns a successful read-only refresh into a data-read exception', () => {
  const storage = quotaStorage(20);
  const cache = createBusinessDataCache({ storage, maxPersistedBytes: 10 });

  const result = cache.save({
    huahuo: { summary: { activeProjects: 1, pendingDeliveries: 0, receivedAmount: 0 }, records: [{ projectName: '项目' }], fetchedAt: '2026-08-08T00:00:00.000Z' },
  });

  assert.equal(result.persisted, false);
  assert.equal(result.sessionOnly, true);
  assert.equal(cache.load().huahuo.summary.activeProjects, 1);
  assert.match(result.message, /本次页面/);
});

test('legacy source refresh routes cache writes through the quota-safe cache store', async () => {
  const source = await readFile(new URL('../src/legacy-app.mjs', import.meta.url), 'utf8');
  assert.match(source, /saveBusinessDataCache\(cache, source\)/);
  assert.match(source, /saveBusinessDataCache\(bcache, 'brain'\)/);
  assert.doesNotMatch(source, /localStorage\.setItem\(BUSINESS_DATA_CACHE_KEY/);
});
