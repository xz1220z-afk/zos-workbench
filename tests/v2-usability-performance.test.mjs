import assert from 'node:assert/strict';
import test from 'node:test';
import { render as renderContentGrowth } from '../src/app/views/content-growth-view.mjs';
import { render as renderAgentWorkbench } from '../src/app/views/agent-workbench-view.mjs';
import { render as renderKnowledgeWorkspace } from '../src/app/views/knowledge-workspace-view.mjs';
import { render as renderSocialInsights } from '../src/app/views/social-insights-view.mjs';

function container() {
  return { innerHTML: '' };
}

test('content growth company filters reflect the active selection and remain actionable', () => {
  const target = container();
  renderContentGrowth(target, {
    contentCompany: 'huahuo', contentOwner: 'all', contentItems: [], contentExperiments: [], compoundCandidates: [],
    contentPerformance: { published: 0, views: 0, interactions: 0, leads: 0, revenue: 0, conversionRate: null },
  });
  assert.match(target.innerHTML, /data-content-company="huahuo" class="active"/);
  assert.match(target.innerHTML, /data-content-owner="mine"/);
});

test('large content, social and agent collections are capped before entering the DOM', () => {
  const content = container();
  renderContentGrowth(content, {
    contentItems: Array.from({ length: 90 }, (_, index) => ({
      id: `content-${index}`, title: `内容 ${index}`, company: 'wanjia', platform: 'douyin', stage: 'idea', metrics: {},
    })),
    contentExperiments: [], compoundCandidates: [],
    contentPerformance: { published: 0, views: 0, interactions: 0, leads: 0, revenue: 0, conversionRate: null },
  });
  assert.ok((content.innerHTML.match(/class="growth-content-card"/g) || []).length <= 30);
  assert.match(content.innerHTML, /还有 60 条/);

  const social = container();
  renderSocialInsights(social, {
    socialInsights: Array.from({ length: 60 }, (_, index) => ({ id: `social-${index}`, claim: `洞察 ${index}`, status: 'observed', company: 'wanjia', score: 80 })),
  });
  assert.ok((social.innerHTML.match(/class="social-insight-card"/g) || []).length <= 24);
  assert.match(social.innerHTML, /还有 36 条/);

  const agent = container();
  renderAgentWorkbench(agent, {
    agentRuns: Array.from({ length: 60 }, (_, index) => ({ id: `run-${index}`, objective: `任务 ${index}`, agentId: 'ceo', status: 'draft' })),
    agentSummary: { total: 60, awaitingApproval: 0, completed: 0, failed: 0 },
  });
  assert.ok((agent.innerHTML.match(/class="agent-run-row"/g) || []).length <= 30);
  assert.match(agent.innerHTML, /还有 30 条/);
});

test('every destructive private record presented in v2 has an explicit delete action', () => {
  const social = container();
  renderSocialInsights(social, { socialInsights: [{ id: 's1', claim: '洞察', status: 'observed' }] });
  assert.match(social.innerHTML, /data-social-delete="s1"/);

  const content = container();
  renderContentGrowth(content, {
    contentItems: [], contentExperiments: [], contentPerformance: {},
    compoundCandidates: [{ id: 'cc1', title: '案例候选', status: 'pending_review' }],
  });
  assert.match(content.innerHTML, /data-compound-review="cc1"/);
  assert.match(content.innerHTML, /data-compound-delete="cc1"/);

  const knowledge = container();
  renderKnowledgeWorkspace(knowledge, {
    readingItems: [{ id: 'r1', title: '阅读' }],
    knowledgeCards: [{ id: 'k1', title: '卡片', sourceId: 'r1' }],
    contentAssets: [{ id: 'a1', title: '素材' }],
    brainstorms: [{ id: 'b1', title: '脑暴', nodes: [] }], knowledgeReview: [],
  });
  for (const marker of ['data-reading-delete="r1"', 'data-knowledge-delete="k1"', 'data-asset-delete="a1"', 'data-brainstorm-delete="b1"']) {
    assert.match(knowledge.innerHTML, new RegExp(marker));
  }
});
