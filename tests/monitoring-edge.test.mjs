import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [source, config] = await Promise.all([
  readFile(new URL('../supabase/functions/zos-monitor/index.ts', import.meta.url), 'utf8'),
  readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8'),
]);

test('monitor endpoint authenticates the user and writes only sanitized events with the service role', () => {
  assert.match(source, /requireUser\(req\)/);
  assert.match(source, /createServiceClient\(\)/);
  assert.match(source, /writeSafeAudit\(/);
  assert.doesNotMatch(source, /body\.userId|body\.user_id/);
  assert.match(source, /ALLOWED_RESULTS/);
});

test('monitor endpoint requires JWT verification', () => {
  assert.match(config, /\[functions\.zos-monitor\][\s\S]*?verify_jwt\s*=\s*true/);
});
