import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sourceUrl = new URL('../supabase/functions/zos-ai-realtime-session/index.ts', import.meta.url);

test('realtime voice endpoint is owner-only, POST-only and JWT protected', async () => {
  const source = await readFile(sourceUrl, 'utf8');
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

  assert.match(source, /req\.method === 'OPTIONS'/);
  assert.match(source, /req\.method !== 'POST'/);
  assert.match(source, /requireOwnerUser\(req\)/);
  assert.match(source, /error instanceof AuthError[^\n]*error\.code/);
  assert.match(source, /error instanceof AuthError[^\n]*error\.status/);
  assert.match(config, /\[functions\.zos-ai-realtime-session\][\s\S]*?verify_jwt\s*=\s*true/);
});

test('realtime voice endpoint accepts bounded multipart SDP and returns SDP only', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /multipart\/form-data/i);
  assert.match(source, /await req\.formData\(\)/);
  assert.match(source, /form\.get\('sdp'\)/);
  assert.match(source, /normalizeRealtimeVoiceContext/);
  assert.match(source, /Content-Type': 'application\/sdp'/);
  assert.doesNotMatch(source, /return reply\([^\n]*(?:session|model|userId|token)/i);
});

test('realtime voice endpoint keeps the OpenAI key server-side and uses the unified calls API', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /Deno\.env\.get\('OPENAI_API_KEY'\)/);
  assert.match(source, /https:\/\/api\.openai\.com\/v1\/realtime\/calls/);
  assert.match(source, /Authorization: `Bearer \$\{openAiKey\}`/);
  assert.match(source, /new Blob\(\[sdp\], \{ type: 'application\/sdp' \}\)/);
  assert.match(source, /new Blob\(\[JSON\.stringify\(session\)\], \{ type: 'application\/json' \}\)/);
  assert.doesNotMatch(source, /req\.(?:json|text)\(\).*OPENAI_API_KEY/s);
  assert.match(source, /ai_upstream_failed/);
  assert.match(source, /ai_response_invalid/);
});

test('realtime voice endpoint retrieves only approved knowledge excerpts by authenticated owner and reference', async () => {
  const source = await readFile(sourceUrl, 'utf8');

  assert.match(source, /\.from\('zos_knowledge_context'\)/);
  assert.match(source, /\.eq\('user_id', identity\.user\.id\)/);
  assert.match(source, /\.eq\('enabled', true\)/);
  assert.match(source, /\.in\('source_ref', context\.knowledgeRefs\)/);
  assert.doesNotMatch(source, /knowledgeBodies|rawKnowledge|systemPrompt|destinationId/);
});
