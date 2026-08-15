import test from 'node:test';
import assert from 'node:assert/strict';

import { routeIntent } from '../src/app/intent-router.mjs';

test('real-time Wanjia questions route to the current business source', () => {
  assert.deepEqual(routeIntent('查一下万嘉今天支付 GMV'), {
    intent: 'business_query', scope: 'wanjia', sourcePlan: ['wanjia_business'],
    agentId: null, riskLevel: 'L0', requestedAction: 'read_analysis',
  });
});

test('company scopes route to their own current facts', () => {
  assert.deepEqual(routeIntent('花火今天有哪些待交付项目').sourcePlan, ['huahuo_business']);
  assert.deepEqual(routeIntent('玲丽今天招生情况').sourcePlan, ['lingli_business']);
});

test('knowledge lookup routes to Enterprise Brain without overriding business facts', () => {
  const route = routeIntent('查以前沉淀的商家诊断 SOP');
  assert.equal(route.intent, 'knowledge_lookup');
  assert.equal(route.scope, 'knowledge');
  assert.deepEqual(route.sourcePlan, ['enterprise_brain_index']);
});

test('calendar, intelligence and Agent tasks use their existing sources', () => {
  assert.deepEqual(routeIntent('我明天有什么日程').sourcePlan, ['private_calendar']);
  assert.deepEqual(routeIntent('今天行业最新情报').sourcePlan, ['intelligence_center']);
  const agent = routeIntent('让万嘉运营 Agent 分析风险', { agentId: 'WANJIA-001' });
  assert.equal(agent.intent, 'agent_task');
  assert.equal(agent.agentId, 'WANJIA-001');
  assert.deepEqual(agent.sourcePlan, ['agent_os']);
});

test('explicit scope wins when it does not cross a safety boundary', () => {
  assert.equal(routeIntent('给我建议', { scope: 'life' }).scope, 'life');
});

test('external writes are always L2 while reversible drafts are L1', () => {
  assert.equal(routeIntent('把任务写进飞书并发给运营').riskLevel, 'L2');
  assert.equal(routeIntent('保存为任务草案').riskLevel, 'L1');
  assert.equal(routeIntent('删除这条记录').riskLevel, 'L2');
});
