import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const previewPath = new URL('../supabase/functions/zos-feishu-approval-preview/index.ts', import.meta.url);
const executePath = new URL('../supabase/functions/zos-feishu-approval-execute/index.ts', import.meta.url);
const configPath = new URL('../supabase/config.toml', import.meta.url);

test('preview endpoint requires authentication and accepts only the proposal shape', async () => {
  const source = await readFile(previewPath, 'utf8');
  assert.match(source, /requireUser\(req\)/);
  assert.match(source, /authentication_required/);
  assert.match(source, /REQUEST_KEYS\s*=\s*new Set\(\['source', 'recordId', 'action', 'value'\]\)/);
  assert.match(source, /Object\.keys\(body\)\.some\(\(key\) => !REQUEST_KEYS\.has\(key\)\)/);
  assert.match(source, /invalid_request/);
  assert.doesNotMatch(source, /body\.(appToken|tableId|fieldName|patch)/,
    'Client-controlled targets and patches must never be read');
});

test('preview resolves only server-side sources, actions and live fields', async () => {
  const source = await readFile(previewPath, 'utf8');
  assert.match(source, /SOURCE_ACTION_FIELDS/);
  for (const action of ['set_owner', 'set_status', 'set_next_action', 'set_due_date', 'set_review_status']) {
    assert.match(source, new RegExp(action));
  }
  assert.match(source, /FEISHU_TARGETS\.wanjia\.merchant/);
  assert.match(source, /FEISHU_TARGETS\.huahuo\.project/);
  assert.match(source, /listFieldNames/);
  assert.match(source, /field_unavailable/);
  assert.match(source, /readRecord/);
});

test('preview stores a ten-minute immutable hash-bound approval without writing Feishu', async () => {
  const source = await readFile(previewPath, 'utf8');
  assert.match(source, /stableSnapshotHash/);
  assert.match(source, /10 \* 60 \* 1000/);
  assert.match(source, /from\('zos_feishu_approvals'\)[\s\S]*insert/);
  assert.match(source, /status:\s*'previewed'/);
  assert.match(source, /snapshot_hash/);
  assert.match(source, /expires_at/);
  assert.doesNotMatch(source, /updateRecord|records\/[^'`]*batch_update|method:\s*['"]PUT['"]/,
    'Preview must never mutate a Feishu record');
});

test('Supabase verifies JWT before running the preview function', async () => {
  const config = await readFile(configPath, 'utf8');
  assert.match(config, /\[functions\.zos-feishu-approval-preview\][\s\S]*?verify_jwt\s*=\s*true/);
});

test('execute rejects source drift without writing', async () => {
  const { executeApproval } = await import('../supabase/functions/_shared/approval-execution.mjs');
  const calls = [];
  const approval = { fieldName: '状态', before: '待处理', after: '已确认', snapshotHash: 'expected' };
  const result = await executeApproval({
    approval,
    currentRecord: { fields: { 状态: '已变化' }, sourceUpdatedAt: 't2' },
    computeSnapshotHash: async () => 'changed',
    updateRecord: async (...args) => calls.push(args),
    readRecord: async () => ({ fields: { 状态: '已确认' } }),
  });
  assert.equal(result.safeCode, 'source_changed');
  assert.equal(calls.length, 0);
});

test('execute reports success only after exact readback', async () => {
  const { executeApproval } = await import('../supabase/functions/_shared/approval-execution.mjs');
  const calls = [];
  const approval = { fieldName: '状态', before: '待处理', after: '已确认', snapshotHash: 'same' };
  const result = await executeApproval({
    approval,
    currentRecord: { fields: { 状态: '待处理' }, sourceUpdatedAt: 't1' },
    computeSnapshotHash: async () => 'same',
    updateRecord: async (...args) => calls.push(args),
    readRecord: async () => ({ fields: { 状态: '已确认' } }),
  });
  assert.equal(calls.length, 1);
  assert.equal(result.verified, true);
  assert.equal(result.status, 'executed');

  const mismatch = await executeApproval({
    approval,
    currentRecord: { fields: { 状态: '待处理' }, sourceUpdatedAt: 't1' },
    computeSnapshotHash: async () => 'same',
    updateRecord: async () => {},
    readRecord: async () => ({ fields: { 状态: '仍待处理' } }),
  });
  assert.equal(mismatch.safeCode, 'feishu_readback_failed');
  assert.equal(mismatch.verified, false);
});

test('execute atomically claims one owner approval and never trusts patch data from the request', async () => {
  const source = await readFile(executePath, 'utf8');
  assert.match(source, /REQUEST_KEYS\s*=\s*new Set\(\['approvalId'\]\)/);
  assert.match(source, /Object\.keys\(body\)\.some\(\(key\) => !REQUEST_KEYS\.has\(key\)\)/);
  assert.match(source, /update\(\{\s*status:\s*'executing'/);
  assert.match(source, /\.eq\('status', 'previewed'\)/);
  assert.match(source, /\.gt\('expires_at', new Date\(\)\.toISOString\(\)\)/);
  assert.match(source, /\.eq\('user_id', user\.id\)/);
  assert.match(source, /\.select\([^)]*\)\s*\.maybeSingle\(\)/);
  assert.doesNotMatch(source, /body\.(before|after|fieldName|source|recordId|patch)/,
    'Execute accepts only the approval identity');
});

test('execute recomputes the source hash, writes one mapped field and verifies readback', async () => {
  const source = await readFile(executePath, 'utf8');
  assert.match(source, /stableSnapshotHash/);
  assert.match(source, /readRecord/);
  assert.match(source, /updateRecord/);
  assert.match(source, /executeApproval/);
  for (const safeCode of ['approval_expired', 'approval_already_used', 'source_changed', 'field_unavailable', 'feishu_write_failed', 'feishu_readback_failed']) {
    assert.match(source, new RegExp(safeCode));
  }
  const config = await readFile(configPath, 'utf8');
  assert.match(config, /\[functions\.zos-feishu-approval-execute\][\s\S]*?verify_jwt\s*=\s*true/);
});
