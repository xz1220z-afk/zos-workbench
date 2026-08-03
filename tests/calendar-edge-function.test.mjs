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
  assert.match(source, /searchParams\.get\('start'\)/);
  assert.match(source, /searchParams\.get\('end'\)/);
  assert.match(source, /MAX_RANGE_DAYS/);
  assert.match(source, /range_invalid/);
  assert.match(source, /itemEnd > range\.start\.getTime\(\) && itemStart < range\.end\.getTime\(\)/);
  assert.match(source, /\.\.\/_shared\/ics-calendar\.mjs/);
  assert.doesNotMatch(source, /\.\.\/\.\.\/\.\.\/src\//);
  assert.doesNotMatch(source, /response\(\{[^}]*configuredUrl|response\(\{[^}]*url:\s*url/);
  assert.match(config, /\[functions\.zos-calendar-data\][\s\S]*verify_jwt\s*=\s*true/);
});

test('calendar endpoint falls back to the signed-in owner Feishu calendar without exposing identity data', async () => {
  const source = await readFile(new URL('../supabase/functions/zos-calendar-data/index.ts', import.meta.url), 'utf8');
  assert.match(source, /user\.email/);
  assert.match(source, /contact\/v3\/users\/batch_get_id/);
  assert.match(source, /contact\/v3\/users\/find_by_department/);
  assert.match(source, /list_app_calendars/);
  assert.match(source, /FEISHU_OWNER_NAME/);
  assert.match(source, /calendar\/v4\/calendars\/primarys/);
  assert.match(source, /calendar\/v4\/calendars\/\$\{encodeURIComponent\(calendarId\)\}\/events/);
  assert.match(source, /normalizeFeishuCalendarEvents/);
  assert.doesNotMatch(source, /response\(\{[^}]*email/);
  assert.doesNotMatch(source, /description\s*:/);
  assert.match(source, /calendar_feishu_failed_stage/);
  assert.match(source, /upstream_code/);
});
