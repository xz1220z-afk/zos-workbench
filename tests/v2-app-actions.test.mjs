import assert from 'node:assert/strict';
import test from 'node:test';
import { createCeoOsApplication } from '../src/app.mjs';

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
