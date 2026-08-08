import test from 'node:test';
import assert from 'node:assert/strict';
import { buildIntelligenceAnswer } from '../src/app/intelligence-explainer.mjs';

const selected = {
  externalId: 'astra-delay',
  title: 'OpenAI 因网络安全风险延缓 Astra 模型发布',
  sourceName: '行业媒体',
  sourceUrl: 'https://example.com/astra',
  factSummary: '报道声称 Astra 的发布计划因网络安全评估而延后。',
  impactAnalysis: '模型发布时间存在不确定性。',
  suggestedAction: '等待 OpenAI 官方公告交叉验证。',
};

test('contextual answer separates known evidence from an undefined concept', () => {
  const answer = buildIntelligenceAnswer({ item: selected, allItems: [selected], question: 'Astra 模型是什么？' });
  assert.equal(answer.state, 'answered');
  assert.match(answer.directAnswer, /现有情报/);
  assert.match(answer.directAnswer, /Astra/);
  assert.match(answer.uncertainty, /没有给出.*定义|无法确认/);
  assert.deepEqual(answer.sources, [{ name: '行业媒体', url: 'https://example.com/astra' }]);
  assert.doesNotMatch(JSON.stringify(answer), /已调用|GPT 回答|联网搜索/);
});

test('related loaded intelligence can add evidence but never turns inference into fact', () => {
  const related = {
    ...selected,
    externalId: 'astra-related',
    title: 'Astra 项目继续进行安全测试',
    factSummary: '另一来源称该项目仍在进行红队测试。',
    sourceName: '研究简报',
    sourceUrl: 'https://example.com/related',
  };
  const answer = buildIntelligenceAnswer({ item: selected, allItems: [selected, related], question: 'Astra 为什么延期？' });
  assert.equal(answer.relatedEvidence.length, 1);
  assert.match(answer.relatedEvidence[0].factSummary, /红队测试/);
  assert.equal(answer.sources.length, 2);
  assert.match(answer.uncertainty, /仍需.*官方|无法确认/);
});

test('unmatched questions return an explicit insufficient-evidence state', () => {
  const answer = buildIntelligenceAnswer({ item: selected, allItems: [selected], question: '这家公司去年收入多少？' });
  assert.equal(answer.state, 'insufficient');
  assert.match(answer.directAnswer, /没有足够证据/);
  assert.match(answer.nextStep, /来源|调研/);
});
