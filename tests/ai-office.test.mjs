import test from 'node:test';
import assert from 'node:assert/strict';

import { buildAiOffice } from '../src/app/ai-office.mjs';

const agents = [
  { agentId: 'WAN-001', name: '万嘉运营', category: 'wanjia', status: 'pilot', department: '运营部' },
  { agentId: 'REL-001', name: '关系关怀', category: 'life', status: 'draft', department: '私密关系' },
  { agentId: 'SHARED-001', name: 'Jarvis', category: 'shared', status: 'active', department: '总控' },
];

test('AI office derives current state from the latest run instead of identity status', () => {
  const office = buildAiOffice({
    agents,
    agentRuns: [
      { id: 'r-old', agentId: 'WAN-001', objective: '旧任务', status: 'completed', updatedAt: '2026-08-16T08:00:00Z' },
      { id: 'r-new', agentId: 'WAN-001', objective: '检查商家异常', status: 'awaiting_approval', updatedAt: '2026-08-16T09:00:00Z' },
    ],
    now: '2026-08-16T10:00:00Z',
  });
  const wanjia = office.agents.find((agent) => agent.agentId === 'WAN-001');
  assert.equal(wanjia.officeState, 'awaiting_confirmation');
  assert.equal(wanjia.currentTask, '检查商家异常');
  assert.equal(office.summary.awaitingConfirmation, 1);
});

test('AI office groups dynamic agents without hard-coded counts', () => {
  const office = buildAiOffice({ agents, agentRuns: [], taskArchives: [] });
  assert.equal(office.summary.total, 3);
  assert.deepEqual(office.organizations.map((item) => item.id), ['shared', 'wanjia', 'life']);
  assert.equal(office.organizations.find((item) => item.id === 'wanjia').departments[0].agents.length, 1);
});

test('private relationship agent never exposes its objective in cross-organization status', () => {
  const office = buildAiOffice({
    agents,
    taskArchives: [{ id: 'private-1', agentId: 'REL-001', objective: '私人关系具体事项', phase: 'draft', updatedAt: '2026-08-16T09:00:00Z' }],
  });
  const relationship = office.agents.find((agent) => agent.agentId === 'REL-001');
  assert.equal(relationship.currentTask, '私密任务');
  assert.equal(JSON.stringify(office).includes('私人关系具体事项'), false);
});

test('failed work takes precedence and idle agents do not claim to be running', () => {
  const office = buildAiOffice({
    agents,
    agentRuns: [{ id: 'failed-1', agentId: 'SHARED-001', objective: '同步巡检', status: 'failed', updatedAt: '2026-08-16T09:00:00Z' }],
  });
  assert.equal(office.agents.find((agent) => agent.agentId === 'SHARED-001').officeState, 'failed');
  assert.equal(office.agents.find((agent) => agent.agentId === 'WAN-001').officeState, 'idle');
  assert.equal(office.summary.failed, 1);
});
