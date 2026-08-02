import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseTransport } from '../src/supabase-transport.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('pull requests only the authenticated owner rows', async () => {
  const calls = [];
  const transport = createSupabaseTransport({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    getAccessToken: async () => 'session-token',
    fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse([{ record_id: 'task-1' }]); },
  });

  const rows = await transport.pull('user-1');

  assert.deepEqual(rows, [{ record_id: 'task-1' }]);
  assert.match(calls[0].url, /\/rest\/v1\/zos_records\?user_id=eq.user-1/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer session-token');
  assert.equal(calls[0].options.headers.apikey, 'public-anon-key');
});

test("upsert uses conflict resolution for a user's entity record identity", async () => {
  const calls = [];
  const transport = createSupabaseTransport({
    url: 'https://project.supabase.co/', anonKey: 'public-anon-key',
    getAccessToken: async () => 'session-token',
    fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse([]); },
  });

  await transport.upsert([{ user_id: 'user-1', entity_type: 'tasks', record_id: 'task-1' }]);

  assert.match(calls[0].url, /on_conflict=user_id%2Centity_type%2Crecord_id/);
  assert.equal(calls[0].options.method, 'POST');
  assert.equal(calls[0].options.headers.Prefer, 'resolution=merge-duplicates,return=representation');
  assert.deepEqual(JSON.parse(calls[0].options.body), [{ user_id: 'user-1', entity_type: 'tasks', record_id: 'task-1' }]);
});

test('transport rejects a failed Supabase response with a safe message', async () => {
  const transport = createSupabaseTransport({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    getAccessToken: async () => 'session-token',
    fetchImpl: async () => new Response('permission denied', { status: 401 }),
  });

  await assert.rejects(() => transport.pull('user-1'), /Supabase request failed \(401\)/);
});

test('transport forwards cancellation signals for automatic four-device sync', async () => {
  const calls = [];
  const controller = new AbortController();
  const transport = createSupabaseTransport({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    getAccessToken: async () => 'session-token',
    fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse([]); },
  });

  await transport.pull('user-1', { signal: controller.signal });
  await transport.upsert([{ user_id: 'user-1', entity_type: 'tasks', record_id: 'task-1' }], { signal: controller.signal });
  assert.equal(calls[0].options.signal, controller.signal);
  assert.equal(calls[1].options.signal, controller.signal);
});
