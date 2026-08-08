import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBusinessData, fetchWanjiaSchema } from '../src/business-data-client.mjs';

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

test('requests only the selected business source when a page refreshes', async () => {
  let request;
  await fetchBusinessData({
    url: 'https://project.supabase.co',
    anonKey: 'public-key',
    accessToken: 'user-token',
    source: 'wanjia',
    fetchImpl: async (url, options) => {
      request = { url, options };
      return new Response(JSON.stringify({ meta: { mode: 'read_only' } }), { status: 200 });
    },
  });

  assert.equal(request.url, 'https://project.supabase.co/functions/v1/zos-business-data?source=wanjia');
});

test("requests and preserves Wanjia's opt-in protected history inside the selected source contract", async () => {
  let request;
  const data = await fetchBusinessData({
    url: 'https://project.supabase.co', anonKey: 'public-key', accessToken: 'user-token', source: 'wanjia', history: true,
    fetchImpl: async (url) => {
      request = String(url);
      return new Response(JSON.stringify({
        meta: { mode: 'read_only', fetchedAt: '2026-08-08T09:00:00.000Z' },
        wanjia: {
          summary: {}, records: [],
          history: {
            availability: { state: 'validated', source: 'local_sqlite', earliestDate: '2026-08-07', latestDate: '2026-08-08', batchCount: 2 },
            rows: [{ businessDate: '2026-08-08', merchantId: 'merchant-1', sourceKind: 'period_snapshot' }],
          },
        },
      }), { status: 200 });
    },
  });

  assert.equal(request, 'https://project.supabase.co/functions/v1/zos-business-data?source=wanjia&history=1');
  assert.equal(data.history.availability.batchCount, 2);
  assert.equal(data.history.rows[0].sourceKind, 'period_snapshot');
});

test('selected refresh returns the normalized v1.3 operating contract', async () => {
  const data = await fetchBusinessData({
    url: 'https://project.supabase.co', anonKey: 'public-key', accessToken: 'user-token', source: 'huahuo',
    fetchImpl: async () => new Response(JSON.stringify({
      huahuo: {
        summary: { receivedAmount: 12000 },
        records: { source: 'huahuo', mode: 'read_only', records: [{ id: 'project-1' }] },
        health: { recordCount: 1, lastSuccessAt: '2026-08-02T01:00:00.000Z', durationMs: 20, safeCode: null },
        contractVersion: '1.3',
      },
      meta: { mode: 'read_only', fetchedAt: '2026-08-02T01:00:00.000Z', contractVersion: '1.3' },
    }), { status: 200 }),
  });

  assert.deepEqual(data, {
    source: 'huahuo', mode: 'read_only', summary: { receivedAmount: 12000 }, records: [{ id: 'project-1' }],
    health: { recordCount: 1, lastSuccessAt: '2026-08-02T01:00:00.000Z', durationMs: 20, safeCode: null },
    contractVersion: '1.3', fetchedAt: '2026-08-02T01:00:00.000Z',
  });
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

test('reports a safe Feishu field diagnosis when a configured field no longer exists', async () => {
  await assert.rejects(
    fetchBusinessData({
      url: 'https://project.supabase.co', anonKey: 'public-key', accessToken: 'user-token',
      fetchImpl: async () => new Response(JSON.stringify({
        error: 'source_read_failed', reason: 'feishu_field_mismatch', missing_fields: ['支付GMV'],
      }), { status: 502 }),
    }),
    /Feishu table field configuration does not match: 支付GMV/i,
  );
});

test('Wanjia schema discovery uses owner diagnostics without exposing auth material', async () => {
  const calls = [];
  const fetchImpl = async (url, options) => {
    calls.push({ url: String(url), headers: options.headers });
    const parsed = new URL(url);
    if (parsed.searchParams.get('diagnostic') === 'wanjia_tables') {
      return new Response(JSON.stringify({ source: 'wanjia', kind: 'table_names', names: ['01.00 商家主档', '01.04.04｜林客每日汇总'] }), { status: 200 });
    }
    return new Response(JSON.stringify({ source: 'wanjia', kind: 'field_names', table_name: parsed.searchParams.get('table_name'), names: ['商家名称', '数据日期'] }), { status: 200 });
  };
  const result = await fetchWanjiaSchema({ url: 'https://example.supabase.co', anonKey: 'anon', accessToken: 'token', fetchImpl });
  assert.equal(result.tables.length, 2);
  assert.deepEqual(result.tables[1].fields, ['商家名称', '数据日期']);
  assert.equal(calls.length, 3);
  assert.ok(calls.every((call) => call.headers.Authorization === 'Bearer token'));
  assert.equal(JSON.stringify(result).includes('token'), false);
});
