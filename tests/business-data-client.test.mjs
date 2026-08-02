import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBusinessData } from '../src/business-data-client.mjs';

test('requests the protected read-only summary endpoint with the current user token', async () => {
  let request;
  const data = await fetchBusinessData({
    url: 'https://project.supabase.co/',
    anonKey: 'public-key',
    accessToken: 'user-token',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({
        wanjia: { summary: { totalMerchants: 4 } },
        huahuo: { summary: { activeProjects: 2 } },
        meta: { mode: 'read_only', fetchedAt: '2026-07-30T00:00:00.000Z' },
      }), { status: 200 });
    },
  });

  assert.equal(request.url, 'https://project.supabase.co/functions/v1/zos-business-data');
  assert.deepEqual(request.options.headers, {
    apikey: 'public-key',
    Authorization: 'Bearer user-token',
  });
  assert.equal(data.wanjia.summary.totalMerchants, 4);
});

test('rejects a response that is not explicitly read-only', async () => {
  await assert.rejects(
    fetchBusinessData({
      url: 'https://project.supabase.co', anonKey: 'public-key', accessToken: 'user-token',
      fetchImpl: async () => new Response(JSON.stringify({ meta: { mode: 'write' } }), { status: 200 }),
    }),
    /read-only/i,
  );
});

test('reports a safe Feishu authentication diagnosis for a protected 502 response', async () => {
  await assert.rejects(
    fetchBusinessData({
      url: 'https://project.supabase.co', anonKey: 'public-key', accessToken: 'user-token',
      fetchImpl: async () => new Response(JSON.stringify({
        error: 'source_read_failed',
        reason: 'feishu_auth_failed',
      }), { status: 502 }),
    }),
    /Feishu application authentication failed/i,
  );
});
