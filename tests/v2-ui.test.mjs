import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { render as renderContentGrowth } from '../src/app/views/content-growth-view.mjs';
import { render as renderAgentWorkbench } from '../src/app/views/agent-workbench-view.mjs';
import { render as renderKnowledgeWorkspace } from '../src/app/views/knowledge-workspace-view.mjs';
import { render as renderSocialInsights } from '../src/app/views/social-insights-view.mjs';
import { render as renderReviews } from '../src/app/views/review-view.mjs';

const root = new URL('../', import.meta.url);

function container() {
  return { innerHTML: '' };
}

test('content growth view exposes a real lifecycle, performance, experiments and compounding', () => {
  const target = container();
  renderContentGrowth(target, {
    contentItems: [{ id: 'c1', title: '阳西探店', company: 'wanjia', platform: 'douyin', stage: 'idea', metrics: {} }],
    contentExperiments: [], compoundCandidates: [], contentPerformance: { published: 0, views: 0, interactions: 0, leads: 0, revenue: 0, conversionRate: null },
  });
  assert.match(target.innerHTML, /内容增长中心/);
  assert.match(target.innerHTML, /data-content-capture/);
  assert.match(target.innerHTML, /选题池/);
  assert.match(target.innerHTML, /内容实验/);
  assert.match(target.innerHTML, /复利候选/);
  assert.doesNotMatch(target.innerHTML, /虚构|示例数据/);
});

test('knowledge workspace unifies reading cards assets and brainstorm without storing source bodies', () => {
  const target = container();
  renderKnowledgeWorkspace(target, {
    readingItems: [], knowledgeCards: [], contentAssets: [], brainstorms: [], knowledgeReview: [],
  });
  for (const label of ['AI 阅读', '知识卡片', '素材资产', '知识头脑风暴']) assert.match(target.innerHTML, new RegExp(label));
  assert.match(target.innerHTML, /不保存原文正文/);
  assert.match(target.innerHTML, /data-reading-capture/);
  assert.match(target.innerHTML, /data-brainstorm-capture/);
});

test('social insight and agent workbench show evidence and approval boundaries', () => {
  const social = container();
  renderSocialInsights(social, { socialInsights: [{ id: 's1', claim: '本地生活讨论增长', status: 'pending_evidence', company: 'wanjia', score: 80 }] });
  assert.match(social.innerHTML, /社媒洞察/);
  assert.match(social.innerHTML, /待补证据/);
  assert.match(social.innerHTML, /data-social-to-content/);

  const agent = container();
  renderAgentWorkbench(agent, { agentRuns: [], agentSummary: { total: 0, awaitingApproval: 0, completed: 0, failed: 0 } });
  assert.match(agent.innerHTML, /Agent 工作台/);
  assert.match(agent.innerHTML, /万嘉增长 Agent/);
  assert.match(agent.innerHTML, /正式发布、消息发送、ERP 写入和删除均需确认/);
  assert.match(agent.innerHTML, /data-agent-run/);
});

test('review center closes the loop with content metrics, experiments and compounding candidates', () => {
  const target = container();
  renderReviews(target, {
    inbox: [],
    contentPerformance: { published: 2, views: 3000, interactions: 90, leads: 12, revenue: 6800 },
    contentExperiments: [{ id: 'e1', title: '开头三秒测试', variable: '开头', winnerId: 'B' }],
    compoundCandidates: [{ id: 'c1', title: '阳西探店案例', type: 'case', status: 'pending_review' }],
  });
  assert.match(target.innerHTML, /内容表现复盘/);
  assert.match(target.innerHTML, /实验结果/);
  assert.match(target.innerHTML, /资产复利候选/);
  assert.match(target.innerHTML, /仅统计真实录入结果/);
  assert.match(target.innerHTML, /审核后再进入长期知识库/);
});

test('production shell mounts the two new primary routes and knowledge upgrades', async () => {
  const [html, router, app, css, legacy] = await Promise.all([
    readFile(new URL('index.html', root), 'utf8'),
    readFile(new URL('src/app/router.mjs', root), 'utf8'),
    readFile(new URL('src/app.mjs', root), 'utf8'),
    readFile(new URL('assets/app.css', root), 'utf8'),
    readFile(new URL('src/legacy-app.mjs', root), 'utf8'),
  ]);
  for (const page of ['content-growth', 'agent-workbench']) {
    assert.match(html, new RegExp(`data-page="${page}"`));
    assert.match(html, new RegExp(`id="page-${page}"`));
    assert.match(router, new RegExp(`'${page}'`));
  }
  for (const rootId of ['contentGrowthRoot', 'agentWorkbenchRoot', 'knowledgeWorkspaceRoot', 'socialInsightsRoot']) {
    assert.match(html, new RegExp(`id="${rootId}"`));
  }
  for (const renderer of ['renderContentGrowth', 'renderAgentWorkbench', 'renderKnowledgeWorkspace', 'renderSocialInsights']) {
    assert.match(app, new RegExp(renderer));
  }
  assert.match(css, /\.growth-stage-board/);
  assert.match(css, /\.knowledge-workspace-grid/);
  assert.match(css, /@media \(max-width:\s*767px\)[\s\S]*\.growth-stage-board/);
  assert.match(legacy, /'content-growth': '内容增长中心'/);
  assert.match(legacy, /'agent-workbench': 'Agent 工作台'/);
  assert.match(css, /\.growth-filter-chips button\s*\{[^}]*min-height:\s*44px/s);
});
