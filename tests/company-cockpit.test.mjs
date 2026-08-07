import test from 'node:test';
import assert from 'node:assert/strict';

import { buildCompanyCockpit } from '../src/app/company-cockpit.mjs';

const base = {
  health: { state: 'synced', updatedAt: '2026-08-07T08:00:00Z', recordCount: 3 },
  finance: { cashIn: { value: null, source: 'unavailable' }, outstanding: { value: null, source: 'unavailable' }, grossProfit: { value: null, source: 'unavailable' } },
  operations: { total: { value: null, source: 'unavailable' }, active: { value: null, source: 'unavailable' }, leads: { value: null, source: 'unavailable' }, students: { value: null, source: 'unavailable' }, consumed: { value: null, source: 'unavailable' } },
  projects: { active: { value: null, source: 'unavailable' }, pendingDelivery: { value: null, source: 'unavailable' } },
  businessVolume: { value: null, source: 'unavailable' },
};

test('company cockpit exposes the exact company-specific operating modules', () => {
  assert.deepEqual(buildCompanyCockpit('wanjia', { operating: base }).analysis.map((item) => item.key), ['merchant_growth', 'gmv_efficiency', 'delivery_risk']);
  assert.deepEqual(buildCompanyCockpit('huahuo', { operating: base }).analysis.map((item) => item.key), ['project_delivery', 'cash_collection', 'schedule_capacity']);
  assert.deepEqual(buildCompanyCockpit('lingli', { operating: base }).analysis.map((item) => item.key), ['lead_conversion', 'student_consumption', 'class_profit']);
});

test('company cockpit keeps unavailable values explicit and groups risks and intelligence by company', () => {
  const cockpit = buildCompanyCockpit('wanjia', {
    operating: base,
    decisions: [{ id: 'd1', company: 'wanjia', status: 'open', factSummary: '待确认回款' }, { id: 'd2', company: 'huahuo', status: 'open' }],
    intelligence: [{ externalId: 'i1', relevantCompanies: ['wanjia'], title: '本地生活趋势' }],
  });
  assert.equal(cockpit.summary[0].value, null);
  assert.equal(cockpit.summary[0].available, false);
  assert.equal(cockpit.risks.length, 1);
  assert.equal(cockpit.intelligence.length, 1);
  assert.equal(cockpit.source.state, 'synced');
});
