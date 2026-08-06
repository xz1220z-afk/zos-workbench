import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_CATALOG, agentActionPolicy, createAgentRun, summarizeAgentRuns } from '../src/app/agent-workbench.mjs';

test('agent catalog covers CEO and three companies with explicit boundaries', () => {
  assert.equal(AGENT_CATALOG.length, 6);
  assert.ok(AGENT_CATALOG.some((agent) => agent.company === 'wanjia'));
  assert.ok(AGENT_CATALOG.some((agent) => agent.company === 'huahuo'));
  assert.ok(AGENT_CATALOG.some((agent) => agent.company === 'lingli'));
  assert.equal(agentActionPolicy('draft', { approved: false }).allowed, true);
  for (const action of ['publish', 'message', 'erp_write', 'delete']) assert.equal(agentActionPolicy(action, { approved: false }).allowed, false);
});

test('agent runs require objective and retain input references', () => {
  assert.throws(() => createAgentRun({ agentId: 'ceo' }), /objective_required/);
  const run = createAgentRun({ agentId: 'ceo', objective: '生成今日建议', inputRefs: ['task:1'] });
  assert.equal(run.status, 'draft');
  assert.deepEqual(run.inputRefs, ['task:1']);
  assert.deepEqual(summarizeAgentRuns([run]), { total: 1, awaitingApproval: 0, completed: 0, failed: 0 });
});
