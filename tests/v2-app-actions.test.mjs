import assert from 'node:assert/strict';
import test from 'node:test';
import { createCeoOsApplication } from '../src/app.mjs';
import { buildLocalSyncInput, toCloudRow } from '../src/sync-engine.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

function application({ answers = [], confirm = true } = {}) {
  let answer = 0;
  return createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} },
    storage: memoryStorage(),
    now: () => '2026-08-06T08:00:00.000Z',
    prompt: () => answers[answer++],
    confirm: () => confirm,
  });
}

const agentOsIndex = {
  schemaVersion: 'agent-os-index-v1', generatedAt: '2026-08-07T01:15:00.000Z', sourceRoot: '07 06 Agent OS｜Jarvis',
  agents: [
    { agentId: 'WANJIA-001', name: '万嘉运营 Agent', status: 'pilot', relativePath: '02 Agents/WANJIA-001.md', hash: 'wanjia-hash', updatedAt: '2026-08-07', skillIds: ['SK-WJ-001'], workflowIds: ['WF-WJ-001'], evidenceIds: ['EV-WJ-001'], logIds: [], runbookIds: [], knowledgeEntries: ['万嘉索引'], sections: { mission: '经营诊断', outputContract: '事实、推断、建议、待确认、下一步。' } },
    { agentId: 'REL-001', name: '关系关怀 Agent', status: 'draft', confidentiality: 'private', relativePath: '02 Agents/REL-001.md', hash: 'rel-hash', updatedAt: '2026-08-07', skillIds: [], workflowIds: [], evidenceIds: [], logIds: [], runbookIds: [], knowledgeEntries: [], sections: { mission: '本地私密提醒' } },
  ],
  skills: [{ skillId: 'SK-WJ-001', name: '万嘉诊断', agentIds: ['WANJIA-001'] }],
  workflows: [{ workflowId: 'WF-WJ-001', name: '万嘉流程', agentIds: ['WANJIA-001'] }],
  evaluations: [{ evaluationId: 'EV-WJ-001', name: 'Pilot', agentIds: ['WANJIA-001'], status: 'passed' }],
  logs: [], runbooks: [],
};

test('Agent OS import is dynamic, private-safe and preserves existing run history', () => {
  const app = application();
  app.store.saveEntity('agent_runs', { title: '旧执行记录', agentId: 'legacy', objective: '保留', status: 'draft' });
  const imported = app.importAgentOsIndexText(JSON.stringify(agentOsIndex));
  assert.equal(imported.index.agents.length, 2);
  assert.equal(app.viewModel().agentOsOverview.summary.total, 2);
  assert.equal(app.viewModel().agentOsAgents.some((item) => item.agentId === 'REL-001'), false);
  app.setAgentOsFilter('life');
  assert.deepEqual(app.viewModel().agentOsAgents.map((item) => item.agentId), []);
  app.setAgentOsFilter('private-relations');
  assert.deepEqual(app.viewModel().agentOsAgents.map((item) => item.agentId), ['REL-001']);
  app.openAgentDetails('REL-001');
  assert.equal(app.viewModel().agentOsDetails.agentId, 'REL-001');
  assert.equal(app.viewModel().relationReminderDrafts.length, 3);
  assert.equal(app.viewModel().agentRuns.length, 1);
  assert.equal(Object.hasOwn(app.viewModel().agentOsIndex, 'body'), false);
});

test('Agent OS invocation prepares the existing task input without claiming execution', () => {
  const app = application();
  app.importAgentOsIndexText(JSON.stringify(agentOsIndex));
  const draft = app.invokeAgent('WANJIA-001');
  assert.equal(app.runtime.taskDrawerOpen, true);
  assert.equal(draft.agentContext.agentId, 'WANJIA-001');
  assert.equal(draft.agentContext.mode, 'draft_or_readonly_analysis');
  assert.equal(app.viewModel().tasks.length, 0);
  assert.equal(app.viewModel().agentRuns.length, 0);
});

test('Agent invocation saves only a minimal cloud reference while REL-001 stays local-only', () => {
  const app = application();
  app.importAgentOsIndexText(JSON.stringify(agentOsIndex));
  const cloudDraft = app.invokeAgent('WANJIA-001');
  app.saveTask({ ...cloudDraft, title: '万嘉只读诊断' });
  const [cloudTask] = app.store.load().collections.tasks;
  assert.deepEqual(Object.keys(cloudTask.agentContext).sort(), ['agentId', 'agentName', 'agentStatus', 'category', 'mode']);
  assert.equal(JSON.stringify(cloudTask).includes('knowledgeEntries'), false);
  assert.equal(JSON.stringify(cloudTask).includes('identityHash'), false);
  const syncInput = buildLocalSyncInput(app.store.load());
  const cloudRow = toCloudRow({ userId: 'owner', entityType: 'tasks', record: syncInput.tasks[0] });
  assert.equal(JSON.stringify(cloudRow).includes('knowledgeEntries'), false);
  assert.equal(JSON.stringify(cloudRow).includes('identityHash'), false);

  app.setAgentOsFilter('private-relations');
  const privateDraft = app.invokeAgent('REL-001');
  app.saveTask({ ...privateDraft, title: '关系关怀草稿' });
  assert.equal(app.store.load().collections.tasks.length, 1);
  assert.equal(app.store.load().collections.local_agent_tasks.length, 1);
  assert.equal(app.viewModel().localAgentTasks[0].agentContext.localOnly, true);
  assert.equal(Object.hasOwn(buildLocalSyncInput(app.store.load()), 'local_agent_tasks'), false);
});

test('Agent OS import rejects body-bearing payloads without changing data', () => {
  const app = application();
  assert.throws(() => app.importAgentOsIndexText(JSON.stringify({ ...agentOsIndex, agents: [{ ...agentOsIndex.agents[0], body: 'secret' }] })), /body_forbidden/);
  assert.equal(app.store.load().collections.agent_os_indexes.length, 0);
});

test('content capture and lifecycle persist to the private synchronized collection', () => {
  const app = application({ answers: ['阳西探店增长', 'wanjia', 'douyin', '解决商家不会拍的问题'] });
  const created = app.captureContentItem();
  assert.equal(created.title, '阳西探店增长');
  assert.equal(app.viewModel().contentOverview.idea, 1);
  app.advanceContentItem(created.id, 'evaluating');
  assert.equal(app.viewModel().contentItems[0].stage, 'evaluating');
});

test('publishing remains blocked until an explicit approval is provided', () => {
  const blocked = application({ confirm: false });
  const review = blocked.saveContentItem({ title: '待审片', stage: 'review' });
  blocked.advanceContentItem(review.id, 'published');
  assert.equal(blocked.viewModel().contentItems[0].stage, 'review');

  const approved = application({ confirm: true });
  const approvedReview = approved.saveContentItem({ title: '已审片', stage: 'review' });
  approved.advanceContentItem(approvedReview.id, 'published');
  assert.equal(approved.viewModel().contentItems[0].stage, 'published');
});

test('reading evidence becomes a reviewable card and social evidence becomes a content idea', () => {
  const reading = application({ answers: ['https://example.com/video', '商家访谈', 'video', '原文摘录', '用户真正关心转化'] });
  const readingItem = reading.captureReadingItem();
  const card = reading.readingToKnowledgeCard(readingItem.id);
  assert.equal(card.sourceUrl, 'https://example.com/video');
  assert.equal(reading.viewModel().knowledgeReview.length, 1);

  const social = application({ answers: ['本地商家不会做短视频', 'https://example.com/post', 'douyin', '万嘉内容选题', 'wanjia', 'douyin', '解决不会拍'] });
  const insight = social.captureSocialInsight();
  social.socialInsightToContent(insight.id);
  assert.deepEqual(social.viewModel().contentItems[0].sourceRefs, ['https://example.com/post']);
});

test('agent runs and synchronized deletion retain an auditable tombstone', () => {
  const app = application({ answers: ['诊断本周万嘉内容机会'], confirm: true });
  const run = app.launchAgentRun('wanjia-growth');
  assert.equal(app.viewModel().agentSummary.total, 1);
  app.deletePrivateEntity('agent_runs', run.id, '确认删除');
  assert.equal(app.viewModel().agentSummary.total, 0);
  assert.equal(app.store.load().tombstones[0].entity, 'agent_runs');
});

test('social edits and experiment results are persisted as real records', () => {
  const social = application({ answers: ['原洞察', '', 'douyin', '已补证据的洞察', 'https://example.com/evidence', 'wanjia'] });
  const insight = social.captureSocialInsight();
  const edited = social.editSocialInsight(insight.id);
  assert.equal(edited.status, 'observed');
  assert.equal(edited.company, 'wanjia');

  const experiment = application({ answers: ['封面测试', '封面', '人物版', '场景版', '90', '60'] });
  const created = experiment.captureContentExperiment();
  const evaluated = experiment.updateContentExperiment(created.id);
  assert.equal(evaluated.winnerId, 'A');
  assert.equal(evaluated.status, 'evaluated');
});
