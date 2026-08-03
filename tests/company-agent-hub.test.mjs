import test from 'node:test';
import assert from 'node:assert/strict';

import { COMPANY_AGENT_TYPES, runCompanyAgent } from '../src/app/company-agent-hub.mjs';

const context = {
  companies: {
    wanjia: { businessVolume: { value: 10000 }, operations: { active: { value: 8 }, total: { value: 12 } }, finance: { cashIn: { value: null } } },
    huahuo: { finance: { cashIn: { value: 5000 }, outstanding: { value: 3000 } }, projects: { pendingDelivery: { value: 2 } } },
    lingli: { finance: { cashIn: { value: 2000 } }, operations: { leads: { value: 20 }, students: { value: 8 } } },
  },
  todayTop3: [{ id: 'task:1', title: '核对回款', reason: '今天到期' }],
};

test('defines CEO and three company agents with review-only deterministic fallback', async () => {
  assert.deepEqual(COMPANY_AGENT_TYPES, ['ceo', 'wanjia', 'huahuo', 'lingli']);
  for (const agent of COMPANY_AGENT_TYPES) {
    const draft = await runCompanyAgent(agent, context, { now: '2026-08-03T09:00:00.000Z' });
    assert.equal(draft.agent, agent);
    assert.equal(draft.mode, 'deterministic');
    assert.equal(draft.reviewStatus, 'pending_review');
    assert.deepEqual(draft.sideEffects, []);
    assert.ok(draft.actions.length > 0);
  }
});

test('model output remains a draft and cannot declare external writes', async () => {
  const model = async () => ({ summary: '建议先核对项目事实', actions: ['确认负责人'], sideEffects: ['write_feishu'] });
  const draft = await runCompanyAgent('huahuo', context, { now: '2026-08-03T09:00:00.000Z', model });
  assert.equal(draft.mode, 'model');
  assert.equal(draft.reviewStatus, 'pending_review');
  assert.deepEqual(draft.sideEffects, []);
  assert.deepEqual(draft.actions, ['确认负责人']);
});

test('rejects unsupported agent types', async () => {
  await assert.rejects(() => runCompanyAgent('unknown', context), /unsupported agent/);
});
