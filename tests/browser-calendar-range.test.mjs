import test from 'node:test';
import assert from 'node:assert/strict';

import { createBrowserOperatingRuntime } from '../src/app/browser-runtime.mjs';

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return structuredClone(body); },
  };
}

function signedInStorage() {
  const values = new Map([
    ['zos_supabase_session', JSON.stringify({ userId: 'user-1', accessToken: 'access-token' })],
    ['zos_supabase_config', JSON.stringify({ url: 'https://example.supabase.co', anonKey: 'anon' })],
  ]);
  return {
    getItem: (key) => values.get(key) || null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

test('browser runtime sends encoded calendar range boundaries', async () => {
  const store = {
    load: () => ({ collections: { tasks: [], decisions: [], targets: [], inbox: [] }, tombstones: [] }),
    loadBaseRevisions: () => ({}), saveBaseRevisions() {}, replaceSnapshot() {},
  };
  const urls = [];
  const runtime = await createBrowserOperatingRuntime({
    storage: signedInStorage(), store, deviceId: 'd1',
    fetchImpl: async (url) => {
      urls.push(String(url));
      return String(url).includes('zos-calendar-data')
        ? jsonResponse({ items: [], state: 'synced', range: { start: 'x', end: 'y' } })
        : jsonResponse([]);
    },
  });
  const result = await runtime.loadExternalCalendar({
    start: '2026-08-03T00:00:00+08:00', end: '2026-08-10T00:00:00+08:00',
  });
  assert.match(urls.at(-1), /start=2026-08-03T00%3A00%3A00%2B08%3A00/);
  assert.match(urls.at(-1), /end=2026-08-10T00%3A00%3A00%2B08%3A00/);
  assert.deepEqual(result.range, { start: 'x', end: 'y' });
});

test('browser runtime preserves only safe calendar permission diagnostics', async () => {
  const store = {
    load: () => ({ collections: { tasks: [], decisions: [], targets: [], inbox: [] }, tombstones: [] }),
    loadBaseRevisions: () => ({}), saveBaseRevisions() {}, replaceSnapshot() {},
  };
  const runtime = await createBrowserOperatingRuntime({
    storage: signedInStorage(), store, deviceId: 'd1',
    fetchImpl: async (url) => String(url).includes('zos-calendar-data')
      ? jsonResponse({ error: 'calendar_feishu_permission_denied', secret: 'must-not-surface' }, 502)
      : jsonResponse([]),
  });
  await assert.rejects(runtime.loadExternalCalendar({
    start: '2026-08-03T00:00:00+08:00', end: '2026-08-10T00:00:00+08:00',
  }), /calendar_feishu_permission_denied/);
});
