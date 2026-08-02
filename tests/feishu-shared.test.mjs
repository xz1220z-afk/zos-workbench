import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const auth = await readFile(new URL('../supabase/functions/_shared/auth.ts', import.meta.url), 'utf8');
const feishu = await readFile(new URL('../supabase/functions/_shared/feishu.ts', import.meta.url), 'utf8');

test('shared authentication requires a real Supabase user without service credentials', () => {
  assert.match(auth, /export async function requireUser/);
  assert.match(auth, /auth\.getUser/);
  assert.match(auth, /authentication_required/);
  assert.doesNotMatch(auth, /SERVICE_ROLE|service_role/);
});

test('every shared Feishu request is bounded and errors expose only safe codes', () => {
  assert.match(feishu, /AbortSignal\.timeout\(12_000\)/);
  assert.match(feishu, /export async function getTenantAccessToken/);
  assert.match(feishu, /export async function listFieldNames/);
  assert.match(feishu, /export async function readRecord/);
  assert.match(feishu, /export function safeFeishuCode/);
  assert.doesNotMatch(feishu, /console\.log\([^)]*token|console\.error\([^)]*response/i);
});

test('shared Feishu helpers use server-owned targets and stable snapshot hashes', () => {
  assert.match(feishu, /export const FEISHU_TARGETS/);
  assert.match(feishu, /AWFUwAbItiI4TjkPMErcpv5Onab/);
  assert.match(feishu, /EqzkwDOMEigNflkDoJdcw7FSn4d/);
  assert.match(feishu, /export async function stableSnapshotHash/);
  assert.match(feishu, /SHA-256/);
  assert.match(feishu, /record_id/);
  assert.doesNotMatch(feishu, /app_secret\s*:\s*['"][^'"]+['"]/i, 'No literal Feishu secret may be committed');
});
