import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildAgentOsOverview, buildAgentInvocationDraft, buildRelationReminderDrafts,
  compareAgentOsIndexes, visibleAgents,
} from '../src/app/agent-os-center.mjs';

const agent = (agentId, status = 'draft', extra = {}) => ({
  agentId, name: agentId, status, relativePath: `02 Agents/${agentId}.md`, hash: `hash-${agentId}`,
  updatedAt: '2026-08-07', skillIds: [], workflowIds: [], evidenceIds: [], logIds: [],
  sections: { mission: `${agentId} mission` }, knowledgeEntries: [], ...extra,
});

const index = {
  schemaVersion: 'agent-os-index-v1', generatedAt: '2026-08-07T09:15:00+08:00', sourceRoot: '/vault/agent-os',
  agents: [
    agent('JARVIS-001', 'pilot'), agent('WANJIA-001', 'pilot'), agent('WJ-SALES-001'),
    agent('HUAHUO-001'), agent('LL-CEO-001'), agent('LIFE-PLAN-001'),
    agent('REL-001', 'draft', { confidentiality: 'private', skillIds: ['SK-REL-001'] }),
  ],
  skills: [{ skillId: 'SK-REL-001', agentIds: ['REL-001'] }], workflows: [], evaluations: [], logs: [], runbooks: [],
};

test('overview is dynamically grouped into five categories and never hard-codes counts', () => {
  const overview = buildAgentOsOverview(index);
  assert.equal(overview.summary.total, index.agents.length);
  assert.equal(overview.categories.shared.length, 1);
  assert.equal(overview.categories.wanjia.length, 2);
  assert.equal(overview.categories.huahuo.length, 1);
  assert.equal(overview.categories.lingli.length, 1);
  assert.equal(overview.categories.life.length, 2);
  assert.equal(overview.summary.status.pilot, 2);
  assert.equal(overview.summary.status.active, 0);
});

test('REL-001 is visible only in the private life filter', () => {
  assert.equal(visibleAgents(index, 'all').some((item) => item.agentId === 'REL-001'), false);
  assert.equal(visibleAgents(index, 'wanjia').some((item) => item.agentId === 'REL-001'), false);
  assert.equal(visibleAgents(index, 'life').some((item) => item.agentId === 'REL-001'), false);
  assert.equal(visibleAgents(index, 'private-relations').map((item) => item.agentId).join(','), 'REL-001');
});

test('category metadata and identity name take precedence over ID fallback', () => {
  const metadataIndex = { ...index, agents: [
    agent('OPS-001', 'draft', { category: 'wanjia' }),
    agent('UNKNOWN-001', 'draft', { name: '花火交付 Agent' }),
  ] };
  assert.deepEqual(visibleAgents(metadataIndex, 'wanjia').map((item) => item.agentId), ['OPS-001']);
  assert.deepEqual(visibleAgents(metadataIndex, 'huahuo').map((item) => item.agentId), ['UNKNOWN-001']);
});

test('explicit category wins over a conflicting name', () => {
  const metadataIndex = { ...index, agents: [
    agent('OPS-002', 'draft', { category: 'life', name: '万嘉生活助手' }),
  ] };
  assert.deepEqual(visibleAgents(metadataIndex, 'life').map((item) => item.agentId), ['OPS-002']);
  assert.deepEqual(visibleAgents(metadataIndex, 'wanjia').map((item) => item.agentId), []);
});

test('private identity and confidentiality are normalized before visibility and invocation', () => {
  const privateIndex = { ...index, agents: [
    agent(' rel-001 ', 'draft', { category: 'life', confidentiality: ' Private ' }),
  ] };
  assert.deepEqual(visibleAgents(privateIndex, 'life'), []);
  assert.deepEqual(visibleAgents(privateIndex, 'private-relations').map((item) => item.agentId), ['REL-001']);
  const draft = buildAgentInvocationDraft(privateIndex.agents[0]);
  assert.equal(draft.agentContext.agentId, 'REL-001');
  assert.equal(draft.agentContext.confidentiality, 'private');
  assert.equal(draft.agentContext.localOnly, true);
});

test('cards derive the latest Pilot state from related evaluation or log metadata', () => {
  const pilotIndex = {
    ...index,
    agents: [agent('JARVIS-001', 'pilot', { logIds: ['PILOT-JV-001'] })],
    logs: [
      { logId: 'PILOT-JV-001', name: '早期试运行', status: 'draft', updatedAt: '2026-07-20', agentIds: [] },
      { logId: 'PILOT-JV-002', name: '最新试运行', status: 'review', updatedAt: '2026-08-07', agentIds: ['JARVIS-001'] },
    ],
  };
  const [visible] = visibleAgents(pilotIndex, 'shared');
  assert.equal(visible.recentPilot.status, 'review');
  assert.equal(visible.recentPilot.name, '最新试运行');
  assert.equal(visible.recentPilot.updatedAt, '2026-08-07');
});

test('invocation opens an existing task draft and never claims execution', () => {
  const draft = buildAgentInvocationDraft({ ...index.agents[1], sections: { outputContract: '仅输出经营摘要' } }, { now: '2026-08-07T10:00:00+08:00' });
  assert.equal(draft.status, 'todo');
  assert.equal(draft.company, 'wanjia');
  assert.equal(draft.agentContext.agentId, 'WANJIA-001');
  assert.equal(draft.agentContext.mode, 'draft_or_readonly_analysis');
  assert.match(draft.description, /事实/);
  assert.match(draft.description, /待确认/);
  assert.match(draft.description, /仅输出经营摘要/);
  assert.equal(JSON.stringify(draft).includes('execute'), false);
});

test('relation reminders are local drafts and contain no external action', () => {
  const reminders = buildRelationReminderDrafts({ now: '2026-08-07T10:00:00+08:00' });
  assert.deepEqual(reminders.map((item) => item.kind), ['daily-care', 'weekly-review', 'important-date']);
  assert.ok(reminders.every((item) => item.delivery === 'local_draft'));
  assert.ok(reminders.every((item) => item.autoSend === false));
});

test('patrol reports additions modifications removals and missing evidence', () => {
  const previous = { ...index, agents: [agent('JARVIS-001', 'pilot'), agent('OLD-001', 'deprecated')] };
  const result = compareAgentOsIndexes(previous, index);
  assert.ok(result.added.includes('WANJIA-001'));
  assert.ok(result.missing.includes('OLD-001'));
  assert.ok(result.risks.some((item) => item.agentId === 'WANJIA-001'));
  assert.notEqual(result.message, 'Agent OS 无结构变化。');

  const stable = compareAgentOsIndexes(index, structuredClone(index));
  assert.equal(stable.message, 'Agent OS 无结构变化。');
});
