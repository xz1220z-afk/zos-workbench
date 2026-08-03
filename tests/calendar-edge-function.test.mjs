import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('external calendar endpoint is authenticated, bounded and metadata-only', async () => {
  const source = await readFile(new URL('../supabase/functions/zos-calendar-data/index.ts', import.meta.url), 'utf8');
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');
  assert.match(source, /requireUser\(req\)/);
  assert.match(source, /EXTERNAL_CALENDAR_ICS_URL/);
  assert.match(source, /pending_configuration/);
  assert.match(source, /AbortSignal\.timeout\(12_000\)/);
  assert.match(source, /body\.length > 1_000_000/);
  assert.match(source, /parseIcsCalendar/);
  assert.doesNotMatch(source, /response\(\{[^}]*configuredUrl|response\(\{[^}]*url:\s*url/);
  assert.match(config, /\[functions\.zos-calendar-data\][\s\S]*verify_jwt\s*=\s*true/);
});
