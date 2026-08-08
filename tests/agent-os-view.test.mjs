import assert from 'node:assert/strict';
import test from 'node:test';
import { render } from '../src/app/views/agent-workbench-view.mjs';
import { render as renderTasks } from '../src/app/views/task-view.mjs';

function container() { return { innerHTML: '' }; }

const base = {
  agentSummary: { total: 1 }, agentRuns: [], agentOsFilter: 'all',
  agentOsIndex: { schemaVersion: 'agent-os-index-v1', generatedAt: '2026-08-07T01:15:00.000Z' },
  agentOsOverview: { generatedAt: '2026-08-07T01:15:00.000Z', summary: { total: 2, status: { draft: 1, pilot: 1, active: 0, deprecated: 0 } } },
  agentOsPatrol: { message: 'Agent OS 无结构变化。', added: [], modified: [], missing: [], deprecated: [], risks: [] },
  agentOsAgents: [{ agentId: 'WANJIA-001', name: '万嘉运营 Agent', category: 'wanjia', status: 'pilot', sections: { mission: '经营诊断' }, skillIds: ['SK-WJ-001'], updatedAt: '2026-08-07', logIds: ['PILOT-WJ-001'], recentPilot: { status: 'review', name: '万嘉试运行', updatedAt: '2026-08-07' } }],
};

test('Agent OS view keeps execution history and adds dynamic overview, filters and actions', () => {
  const node = container();
  render(node, base);
  assert.match(node.innerHTML, /Agent OS 管理与调用中心/);
  assert.match(node.innerHTML, /总控与共享中台/);
  assert.match(node.innerHTML, /我的生活/);
  assert.match(node.innerHTML, /data-agent-index-import/);
  assert.match(node.innerHTML, /data-agent-details="WANJIA-001"/);
  assert.match(node.innerHTML, /data-agent-invoke="WANJIA-001"/);
  assert.match(node.innerHTML, /Pilot 待复核/);
  assert.match(node.innerHTML, /执行记录与审批链/);
});

test('private relationship details display local drafts and controlled metadata only', () => {
  const node = container();
  render(node, {
    ...base, agentOsFilter: 'private-relations',
    agentOsAgents: [{ agentId: 'REL-001', name: '关系关怀 Agent', category: 'life', confidentiality: 'private', status: 'draft', sections: { mission: '只使用确认信息', scopeOut: '不读取私密聊天全文' }, skillIds: [], updatedAt: '2026-08-07' }],
    agentOsDetails: { agentId: 'REL-001', name: '关系关怀 Agent', status: 'draft', sections: { mission: '只使用确认信息', scopeOut: '不读取私密聊天全文' }, skills: [], workflows: [], evaluations: [], logs: [], runbooks: [], knowledgeEntries: [] },
    relationReminderDrafts: [{ kind: 'daily-care', title: '今天是否有一件具体关怀动作？', delivery: 'local_draft' }],
  });
  assert.match(node.innerHTML, /私密关系/);
  assert.match(node.innerHTML, /今天是否有一件具体关怀动作/);
  assert.match(node.innerHTML, /不自动发送/);
});

test('existing task drawer shows the selected Agent context as a draft-only handoff', () => {
  const node = container();
  renderTasks(node, {
    tasks: [],
    taskDrawerOpen: true,
    taskDraft: {
      title: '请补充具体任务',
      company: 'wanjia',
      agentContext: {
        agentId: 'WANJIA-001',
        agentName: '万嘉运营 Agent',
        agentStatus: 'pilot',
        mode: 'draft_or_readonly_analysis',
      },
    },
  });
  assert.match(node.innerHTML, /已带入 Agent 上下文/);
  assert.match(node.innerHTML, /WANJIA-001/);
  assert.match(node.innerHTML, /万嘉运营 Agent/);
  assert.match(node.innerHTML, /草稿或只读分析/);
  assert.match(node.innerHTML, /不会自动执行外部动作/);
});

test('private Agent task drawer clearly marks local-only storage', () => {
  const node = container();
  renderTasks(node, {
    tasks: [], localAgentTasks: [], taskDrawerOpen: true,
    taskDraft: { title: '关系关怀草稿', company: 'life', agentContext: { agentId: 'REL-001', agentName: '关系关怀 Agent', localOnly: true } },
  });
  assert.match(node.innerHTML, /只保存在本机/);
  assert.match(node.innerHTML, /不参与云同步/);
});
