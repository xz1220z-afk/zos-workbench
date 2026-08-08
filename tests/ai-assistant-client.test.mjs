import test from 'node:test';
import assert from 'node:assert/strict';
import { createAiAssistantClient } from '../src/app/ai-assistant-client.mjs';

test('AI assistant client sends only the structured prompt to the authenticated edge function', async () => {
  const calls = [];
  const client = createAiAssistantClient({
    url: 'https://example.supabase.co', anonKey: 'publishable', getAccessToken: async () => 'user-token',
    fetchImpl: async (url, init) => {
      calls.push({ url: String(url), init });
      return { ok: true, json: async () => ({ state: 'answered', answer: '已解释。', sources: [] }) };
    },
  });
  const result = await client.ask({ mode: 'intelligence', question: 'Astra 是什么？', intelligence: { externalId: 'astra', title: 'Astra 延期' } });
  assert.equal(result.answer, '已解释。');
  assert.equal(calls.length, 1);
  assert.match(calls[0].url, /\/functions\/v1\/zos-ai-assistant$/);
  assert.equal(calls[0].init.headers.Authorization, 'Bearer user-token');
  assert.deepEqual(JSON.parse(calls[0].init.body), {
    mode: 'intelligence', question: 'Astra 是什么？', intelligence: { externalId: 'astra', title: 'Astra 延期' },
  });
});

test('AI assistant client exposes safe server configuration states', async () => {
  const client = createAiAssistantClient({
    url: 'https://example.supabase.co', anonKey: 'publishable', getAccessToken: async () => 'user-token',
    fetchImpl: async () => ({ ok: false, status: 503, json: async () => ({ error: 'ai_not_configured' }) }),
  });
  await assert.rejects(() => client.ask({ mode: 'agent', question: '分析今日任务', agent: { agentId: 'JARVIS-001' } }), /ai_not_configured/);
});
