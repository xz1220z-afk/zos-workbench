import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { createOwnerSessionClient } from '../src/app/owner-session-client.mjs';

test('owner session client accepts only the exact authorized contract', async () => {
  const calls = [];
  const client = createOwnerSessionClient({
    url: 'https://project.supabase.co',
    anonKey: 'public-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(JSON.stringify({ state: 'authorized' }), { status: 200 });
    },
  });

  assert.deepEqual(await client.verify('access-token'), { state: 'authorized' });
  assert.match(calls[0].url, /\/functions\/v1\/zos-auth-session$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-token');
  assert.equal(calls[0].options.headers.apikey, 'public-key');

  const invalid = createOwnerSessionClient({
    url: 'https://project.supabase.co', anonKey: 'public-key',
    fetchImpl: async () => new Response(JSON.stringify({ state: 'authorized', userId: 'leak' }), { status: 200 }),
  });
  await assert.rejects(() => invalid.verify('access-token'), /owner_session_contract_invalid/);
});

test('owner session client preserves only safe server error codes', async () => {
  const client = createOwnerSessionClient({
    url: 'https://project.supabase.co', anonKey: 'public-key',
    fetchImpl: async () => new Response(JSON.stringify({ error: 'authorization_forbidden', detail: 'private' }), { status: 403 }),
  });
  await assert.rejects(
    () => client.verify('access-token'),
    (error) => error.code === 'authorization_forbidden' && error.message === 'authorization_forbidden',
  );
});

test('owner session edge function is identity-only and JWT protected', async () => {
  const source = await readFile(new URL('../supabase/functions/zos-auth-session/index.ts', import.meta.url), 'utf8');
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

  assert.match(source, /requireOwnerUser\(req\)/);
  assert.match(source, /\{ state: 'authorized' \}/);
  assert.match(source, /error instanceof AuthError[^\n]*error\.code/);
  assert.match(source, /error instanceof AuthError[^\n]*error\.status/);
  assert.doesNotMatch(source, /createClient|service_role|FEISHU|OPENAI|\.from\(/i);
  assert.doesNotMatch(source, /user\.id|token/);
  assert.match(config, /\[functions\.zos-auth-session\][\s\S]*?verify_jwt\s*=\s*true/);
});
