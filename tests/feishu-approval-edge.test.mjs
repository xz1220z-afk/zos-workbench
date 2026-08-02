import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const previewPath = new URL('../supabase/functions/zos-feishu-approval-preview/index.ts', import.meta.url);
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
