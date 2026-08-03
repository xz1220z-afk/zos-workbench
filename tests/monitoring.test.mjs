import test from 'node:test';
import assert from 'node:assert/strict';

import { createMonitoringClient, sanitizeAuditEvent } from '../src/app/monitoring.mjs';

test('audit sanitizer removes nested credentials and business bodies', () => {
  const safe = sanitizeAuditEvent({
    eventType: 'refresh',
    token: 'secret',
    rawResponse: { customer: '甲方' },
    safeCode: 'feishu_timeout',
    durationMs: 120,
  });
  assert.deepEqual(safe, {
    eventType: 'refresh',
    source: null,
    result: 'failed',
    safeCode: 'feishu_timeout',
    durationMs: 120,
    recordCount: null,
    approvalId: null,
    clientVersion: '1.8.1',
  });
});

test('monitoring client sends only the safe owner-scoped audit row', async () => {
  const requests = [];
  const client = createMonitoringClient({
    url: 'https://example.supabase.co',
    anonKey: 'anon-key',
    userId: 'user-1',
    getAccessToken: async () => 'user-token',
    fetchImpl: async (url, init) => {
      requests.push({ url, init });
      return { ok: true, status: 201, text: async () => '[]' };
    },
  });

  await client.record({
    eventType: 'refresh',
    source: 'wanjia',
    result: 'success',
    recordCount: 3,
    token: 'must-not-leak',
    rawResponse: { fields: ['secret business body'] },
  });

  assert.equal(requests.length, 1);
  assert.match(requests[0].url, /\/functions\/v1\/zos-monitor$/);
  assert.equal(requests[0].init.headers.Authorization, 'Bearer user-token');
  assert.deepEqual(JSON.parse(requests[0].init.body), {
    eventType: 'refresh',
    source: 'wanjia',
    result: 'success',
    safeCode: null,
    durationMs: null,
    recordCount: 3,
    approvalId: null,
    clientVersion: '1.8.1',
  });
  assert.equal(requests[0].init.body.includes('must-not-leak'), false);
  assert.equal(requests[0].init.body.includes('business body'), false);
});

test('monitoring failures stay safe and do not expose an upstream response body', async () => {
  const client = createMonitoringClient({
    url: 'https://example.supabase.co',
    anonKey: 'anon-key',
    userId: 'user-1',
    getAccessToken: async () => 'user-token',
    fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'sensitive response' }),
  });
  await assert.rejects(() => client.record({ eventType: 'refresh' }), /monitoring request failed \(500\)/);
});
