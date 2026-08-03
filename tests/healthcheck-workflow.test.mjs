import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workflow = await readFile(new URL('../.github/workflows/healthcheck.yml', import.meta.url), 'utf8');

test('production healthcheck compares deployed app and cache versions without a stale release constant', () => {
  assert.match(workflow, /app_version=/);
  assert.match(workflow, /cache_version=/);
  assert.match(workflow, /test "\$app_version" = "\$cache_version"/);
  assert.doesNotMatch(workflow, /zos-workbench-v1\.4\.3/);
});
