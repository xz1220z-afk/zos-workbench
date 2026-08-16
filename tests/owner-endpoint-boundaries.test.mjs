import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const endpoints = [
  'zos-business-data',
  'zos-feishu-approval-preview',
  'zos-feishu-approval-execute',
  'zos-ai-assistant',
  'zos-ai-realtime-session',
];

for (const endpoint of endpoints) {
  test(`${endpoint} requires the configured owner before protected work`, async () => {
    const source = await readFile(
      new URL(`../supabase/functions/${endpoint}/index.ts`, import.meta.url),
      'utf8',
    );

    assert.match(source, /import\s*\{[^}]*requireOwnerUser[^}]*\}\s*from\s*['"]\.\.\/_shared\/auth\.ts['"]/s);
    assert.match(source, /await requireOwnerUser\(req\)/);
    assert.doesNotMatch(source, /await requireUser\(req\)/);
    assert.match(source, /error instanceof AuthError[^\n]*error\.code/);
    assert.match(source, /error instanceof AuthError[^\n]*error\.status/);
  });
}

test('approval endpoints preserve preview and exact readback controls behind the owner boundary', async () => {
  const preview = await readFile(
    new URL('../supabase/functions/zos-feishu-approval-preview/index.ts', import.meta.url),
    'utf8',
  );
  const execute = await readFile(
    new URL('../supabase/functions/zos-feishu-approval-execute/index.ts', import.meta.url),
    'utf8',
  );

  assert.match(preview, /10 \* 60 \* 1000/);
  assert.match(preview, /stableSnapshotHash/);
  assert.doesNotMatch(preview, /updateRecord/);
  assert.match(execute, /\.eq\('status', 'previewed'\)/);
  assert.match(execute, /\.eq\('user_id', user\.id\)/);
  assert.match(execute, /executeApproval/);
  assert.match(execute, /readRecord/);
  assert.match(execute, /updateRecord/);
});
