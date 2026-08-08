import test from 'node:test';
import assert from 'node:assert/strict';
import { createCeoOsApplication } from '../src/app.mjs';

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('contextual intelligence questions use the injected assistant and preserve the intelligence record', async () => {
  const requests = [];
  const app = createCeoOsApplication({
    document: { getElementById: () => null, addEventListener() {} }, storage: memoryStorage(),
    now: () => '2026-08-08T08:00:00.000Z', createOperatingRuntime: false,
    askAi: async (request) => { requests.push(request); return { state: 'answered', answer: 'Astra 是待评估模型。', sources: [] }; },
  });
  const item = app.store.saveEntity('intelligence', {
    id: 'intelligence:astra', externalId: 'astra', title: 'Astra 延期', sourceName: '行业媒体',
    sourceUrl: 'https://example.com/astra', factSummary: '安全评估仍在进行。',
    credibility: 'medium', relevantCompanies: ['ceo'], capturedAt: '2026-08-08T08:00:00Z', status: 'candidate',
  });
  const before = structuredClone(app.store.load().collections.intelligence);
  app.openIntelligenceQuestion('astra');
  const answer = await app.askIntelligenceQuestion('astra', 'Astra 是什么？');
  assert.equal(answer.state, 'answered');
  assert.equal(answer.directAnswer, 'Astra 是待评估模型。');
  assert.equal(requests[0].mode, 'intelligence');
  assert.equal(app.runtime.intelligenceQuestion.question, 'Astra 是什么？');
  assert.deepEqual(app.store.load().collections.intelligence, before);
  assert.equal(app.store.load().collections.intelligence[0].id, item.id);
  app.closeIntelligenceQuestion();
  assert.equal(app.runtime.intelligenceQuestion, null);
  assert.equal(app.runtime.intelligenceAnswer, null);
});
