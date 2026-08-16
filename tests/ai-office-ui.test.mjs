import test from 'node:test';
import assert from 'node:assert/strict';

import { render as renderAgentOffice } from '../src/app/views/agent-workbench-view.mjs';
import { render as renderDashboard } from '../src/app/views/dashboard-view.mjs';

function container() { return { innerHTML: '' }; }

test('existing Agent page adds office status, permission registry and unified ledger', () => {
  const node = container();
  renderAgentOffice(node, {
    agentSummary: {}, agentRuns: [], agentOsFilter: 'all', agentOsIndex: null,
    aiOffice: {
      summary: { total: 2, idle: 0, draft: 0, awaitingConfirmation: 1, running: 1, completed: 0, failed: 0 },
      organizations: [{ id: 'wanjia', name: '万嘉网络', departments: [{ name: '运营', agents: [
        { agentId: 'WAN-001', name: '万嘉运营 Agent', officeState: 'running', currentTask: '检查异常商家', private: false },
      ] }] }],
    },
    capabilityRegistry: [
      { id: 'chat', name: 'ChatGPT 文字问答', level: 'L0', state: 'ready', boundary: '只读回答' },
      { id: 'external', name: '外部变更', level: 'L2', state: 'confirmation_required', boundary: '预览后确认' },
    ],
    executionLedger: [
      { id: 'run-1', kind: 'agent_run', state: 'running', summary: '检查异常商家', agentId: 'WAN-001', at: '2026-08-16T09:00:00Z', riskLevel: 'L0' },
    ],
  });

  assert.match(node.innerHTML, /AI Office 实时席位/);
  assert.match(node.innerHTML, /万嘉运营 Agent/);
  assert.match(node.innerHTML, /检查异常商家/);
  assert.match(node.innerHTML, /能力与权限注册表/);
  assert.match(node.innerHTML, /ChatGPT 文字问答/);
  assert.match(node.innerHTML, /执行台账/);
  assert.match(node.innerHTML, /WAN-001/);
});

test('office UI never exposes private relationship objective text', () => {
  const node = container();
  renderAgentOffice(node, {
    agentSummary: {}, agentRuns: [], agentOsFilter: 'private-relations', agentOsIndex: null,
    aiOffice: {
      summary: { total: 1 },
      organizations: [{ id: 'life', name: '我的生活', departments: [{ name: '私密关系', agents: [
        { agentId: 'REL-001', name: '关系关怀 Agent', officeState: 'completed', currentTask: '私密任务', private: true },
      ] }] }],
    },
    capabilityRegistry: [],
    executionLedger: [{ id: 'private', kind: 'agent_task', state: 'completed', summary: '私密任务', agentId: 'REL-001', at: '2026-08-16T09:00:00Z', riskLevel: 'L0' }],
  });

  assert.match(node.innerHTML, /私密任务/);
  assert.doesNotMatch(node.innerHTML, /具体私人关系内容/);
});

test('dashboard adds bounded AI continuity prompts using existing safe task actions', () => {
  const node = container();
  renderDashboard(node, {
    state: 'ready', today: '2026-08-16', health: [], mustRead: [], decisions: [], gaps: [], todayTop3: [], calendar: [], calendarConflicts: [],
    autoRefresh: {}, weather: {}, importantDates: { work: [] }, companyOperating: {}, sources: {},
    homePresence: {
      tone: 'steady', kicker: 'CEO COMMAND CENTER', title: '上午先收口，再开新任务', summary: '只显示已经确认的事实与下一步。',
      primaryAction: { target: 'today', label: '查看今日行动' }, secondaryAction: { label: '快速记录' },
    },
    continuityPrompts: [
      { id: 'overdue:1', kind: 'overdue_task', title: '核对花火交付', detail: '已逾期 2 天', action: 'open_task', sourceId: 'task-1' },
      { id: 'ai:1', kind: 'ai_next_step', title: '核对最新飞书数据', detail: '尚未保存为任务', action: 'draft_task', sourceId: 'cmd-1' },
    ],
  });

  assert.match(node.innerHTML, /AI 推进提醒/);
  assert.match(node.innerHTML, /核对花火交付/);
  assert.match(node.innerHTML, /data-page="tasks"/);
  assert.match(node.innerHTML, /data-continuity-draft/);
});
