import test from 'node:test';
import assert from 'node:assert/strict';
import { render } from '../src/app/views/intelligence-view.mjs';

const item = {
  externalId: 'astra-delay', title: 'OpenAI 延缓 Astra 模型发布', sourceName: '行业媒体',
  sourceUrl: 'https://example.com/astra', factSummary: '安全评估仍在进行。',
  impactAnalysis: '发布时间不确定。', suggestedAction: '等待官方公告。', credibility: 'medium',
  relevantCompanies: ['ceo'], capturedAt: '2026-08-08T08:00:00Z', status: 'candidate',
};

test('every intelligence card exposes an in-page contextual question entry', () => {
  const container = { innerHTML: '' };
  render(container, { intelligence: [item], intelligenceAll: [item] });
  assert.match(container.innerHTML, /data-intelligence-ask="astra-delay"/);
  assert.match(container.innerHTML, />问这条情报</);
});

test('question drawer keeps selected context, input, answer boundary and source visible', () => {
  const container = { innerHTML: '' };
  render(container, {
    intelligence: [item], intelligenceAll: [item],
    intelligenceQuestion: { externalId: 'astra-delay', question: 'Astra 是什么？' },
    intelligenceAnswer: {
      state: 'answered', directAnswer: '根据现有情报，只能确认它与本次发布计划有关。',
      knownFacts: ['安全评估仍在进行。'], relatedEvidence: [],
      uncertainty: '现有证据没有给出 Astra 的正式定义。', nextStep: '查看来源并等待官方公告。',
      sources: [{ name: '行业媒体', url: 'https://example.com/astra' }],
    },
  });
  assert.match(container.innerHTML, /class="intelligence-question-drawer"/);
  assert.match(container.innerHTML, /data-intelligence-question-form/);
  assert.match(container.innerHTML, /data-intelligence-question/);
  assert.match(container.innerHTML, /基于当前卡片与已载入情报/);
  assert.match(container.innerHTML, /现有证据没有给出 Astra/);
  assert.match(container.innerHTML, /href="https:\/\/example\.com\/astra"/);
  assert.match(container.innerHTML, /data-intelligence-question-close/);
});
