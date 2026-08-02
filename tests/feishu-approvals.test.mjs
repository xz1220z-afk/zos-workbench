import test from 'node:test';
import assert from 'node:assert/strict';

import { createFeishuApprovalClient } from '../src/app/feishu-approvals.mjs';

function response(status, body) {
  return { ok: status >= 200 && status < 300, status, async json() { return body; } };
}

test('preview sends only the approved proposal shape with the current user token', async () => {
  const calls = [];
  const client = createFeishuApprovalClient({
    url: 'https://project.supabase.co', anonKey: 'anon-key',
    getAccessToken: async () => 'user-token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { approvalId: 'approval-1', status: 'previewed' });
    },
  });

  await client.preview({
    source: 'wanjia', recordId: 'rec-1', action: 'set_status', value: '已完成',
    appToken: 'must-not-send', tableId: 'must-not-send', fieldName: 'must-not-send', patch: { x: 1 },
  });

  assert.match(calls[0].url, /\/functions\/v1\/zos-feishu-approval-preview$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    source: 'wanjia', recordId: 'rec-1', action: 'set_status', value: '已完成',
  });
  assert.equal(calls[0].options.headers.Authorization, 'Bearer user-token');
  assert.equal(calls[0].options.headers.apikey, 'anon-key');
});

test('execute sends only approvalId and never accepts a client patch', async () => {
  const calls = [];
  const client = createFeishuApprovalClient({
    url: 'https://project.supabase.co', anonKey: 'anon-key', getAccessToken: () => 'token',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return response(200, { approvalId: 'approval-1', status: 'executed', verified: true });
    },
  });

  const result = await client.execute('approval-1', { patch: { 状态: '伪造' } });
  assert.deepEqual(JSON.parse(calls[0].options.body), { approvalId: 'approval-1' });
  assert.equal(result.verified, true);
  assert.match(calls[0].url, /\/functions\/v1\/zos-feishu-approval-execute$/);
});

test('server failures expose documented safe codes without raw upstream details', async () => {
  const client = createFeishuApprovalClient({
    url: 'https://project.supabase.co', anonKey: 'anon-key', getAccessToken: () => 'token',
    fetchImpl: async () => response(409, {
      safeCode: 'source_changed', error: 'raw feishu body must not escape', upstream: { token: 'secret' },
    }),
  });

  await assert.rejects(
    () => client.execute('approval-1'),
    (error) => error.safeCode === 'source_changed' && !String(error.message).includes('feishu body'),
  );
});

test('unknown failures collapse to approval_request_failed', async () => {
  const client = createFeishuApprovalClient({
    url: 'https://project.supabase.co', anonKey: 'anon-key', getAccessToken: () => 'token',
    fetchImpl: async () => response(500, { safeCode: 'untrusted_internal_detail' }),
  });

  await assert.rejects(
    () => client.preview({ source: 'huahuo', recordId: 'rec-2', action: 'set_owner', value: '朱帅' }),
    (error) => error.safeCode === 'approval_request_failed',
  );
});
