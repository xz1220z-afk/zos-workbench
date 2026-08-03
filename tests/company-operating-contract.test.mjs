import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompanyOperatingContract } from '../src/app/company-operating-contract.mjs';

test('unifies three companies without treating GMV or contract value as cash income', () => {
  const contract = buildCompanyOperatingContract({
    wanjia: {
      fetchedAt: '2026-08-03T01:00:00.000Z',
      summary: { paymentGmv: 120000, activeMerchants: 18, totalMerchants: 24 },
      records: [{ id: 'merchant-1' }],
    },
    huahuo: {
      fetchedAt: '2026-08-03T01:05:00.000Z',
      summary: { contractAmount: 80000, receivedAmount: 50000, outstandingAmount: 30000, activeProjects: 4, pendingDeliveries: 2 },
      records: [{ id: 'project-1' }],
    },
    lingli: {
      fetchedAt: '2026-08-03T01:10:00.000Z',
      summary: { leads: 31, students: 16, received: 22000, consumed: 48 },
      records: [{ id: 'student-1' }],
    },
  });

  assert.equal(contract.wanjia.businessVolume.value, 120000);
  assert.equal(contract.wanjia.finance.cashIn.value, null);
  assert.equal(contract.wanjia.finance.income.value, null);
  assert.equal(contract.huahuo.businessVolume.value, 80000);
  assert.equal(contract.huahuo.finance.cashIn.value, 50000);
  assert.equal(contract.huahuo.finance.outstanding.value, 30000);
  assert.equal(contract.lingli.finance.cashIn.value, 22000);
  assert.equal(contract.lingli.operations.leads.value, 31);
  assert.equal(contract.lingli.operations.students.value, 16);
});

test('preserves demonstrable zeroes but keeps missing facts null and source-aware', () => {
  const contract = buildCompanyOperatingContract({
    wanjia: { fetchedAt: '2026-08-03T01:00:00.000Z', summary: { paymentGmv: 0, activeMerchants: 0, totalMerchants: 0 }, records: [] },
    huahuo: { state: 'failed', safeCode: 'feishu_permission_denied' },
  });

  assert.equal(contract.wanjia.businessVolume.value, 0);
  assert.equal(contract.wanjia.operations.active.value, 0);
  assert.equal(contract.huahuo.finance.cashIn.value, null);
  assert.equal(contract.huahuo.health.state, 'failed');
  assert.equal(contract.huahuo.health.safeCode, 'feishu_permission_denied');
  assert.equal(contract.lingli.health.state, 'pending');
  assert.equal(contract.lingli.finance.grossProfit.value, null);
  assert.equal(contract.lingli.finance.grossProfit.source, 'unavailable');
});

test('rejects non-finite numbers instead of leaking invalid KPI values', () => {
  const contract = buildCompanyOperatingContract({
    lingli: { summary: { received: Number.NaN, leads: Number.POSITIVE_INFINITY } },
  });

  assert.equal(contract.lingli.finance.cashIn.value, null);
  assert.equal(contract.lingli.operations.leads.value, null);
});
