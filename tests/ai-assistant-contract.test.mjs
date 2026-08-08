import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeAssistantRequest, selectKnowledgeContext } from '../supabase/functions/_shared/ai-assistant-contract.mjs';

test('assistant contract accepts bounded intelligence questions and strips unknown fields', () => {
  const request = normalizeAssistantRequest({
    mode: 'intelligence', question: 'Astra 是什么？', ignored: 'never forward',
    intelligence: { externalId: 'astra', title: 'Astra 延期', factSummary: '安全评估仍在进行。', rawHtml: '<script>' },
  });
  assert.equal(request.mode, 'intelligence');
  assert.equal(request.intelligence.rawHtml, undefined);
  assert.throws(() => normalizeAssistantRequest({ mode: 'agent', question: 'x', agent: { agentId: 'REL-001' } }), /private_agent_not_supported/);
});

test('assistant context selection uses matching approved excerpts and never returns private scope', () => {
  const selected = selectKnowledgeContext('Astra 模型的发布影响', [
    { title: 'Astra 技术观察', source_ref: 'note:astra', scope: 'work', excerpt: 'Astra 是一个待评估模型。', tags: ['Astra'] },
    { title: '关系记录', source_ref: 'note:private', scope: 'private', excerpt: '不应出现', tags: ['关系'] },
  ]);
  assert.deepEqual(selected.map((item) => item.sourceRef), ['note:astra']);
});
