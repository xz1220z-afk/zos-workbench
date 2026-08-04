import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

import {
  normalizeScheduledJobs,
  safeNotificationPayload,
  selectSingleSubscription,
} from '../supabase/functions/_shared/reminder-dispatch.mjs';
import { createPushClient, enablePushNotifications, pushCapabilityState } from '../src/app/push-notifications.mjs';

test('private reminders never expose their title in a push payload', () => {
  assert.deepEqual(safeNotificationPayload({
    dedupe_key: 'owner:calendar:1', title: '私人约会', privacy: 'private', entity_type: 'calendar',
  }), {
    title: 'ZOS 提醒', body: '个人安排', tag: 'owner:calendar:1', url: './#calendar',
  });
});

test('server normalizes authenticated schedules and never trusts a client owner id', () => {
  const jobs = normalizeScheduledJobs([
    {
      dedupeKey: 'fake-owner:task:1:explicit:2026-08-10T01:00:00.000Z', ownerId: 'fake-owner',
      entityType: 'task', entityId: '1', scheduledAt: '2026-08-10T01:00:00.000Z',
      title: '核对回款', body: '今日需确认回款', privacy: 'work',
    },
    {
      dedupeKey: 'fake-owner:calendar:private:before_30m:2026-08-10T02:00:00.000Z',
      entityType: 'calendar', entityId: 'private', scheduledAt: '2026-08-10T02:00:00.000Z',
      title: '私人标题', body: '私人正文', privacy: 'private',
    },
  ], { userId: 'real-owner', now: '2026-08-04T00:00:00.000Z' });
  assert.equal(jobs.length, 2);
  assert.ok(jobs.every((item) => item.user_id === 'real-owner'));
  assert.equal(jobs[1].title, '个人安排');
  assert.equal(jobs[1].body, '个人安排');
});

test('one owner reminder chooses only the newest enabled device subscription', () => {
  const selected = selectSingleSubscription([
    { id: 'old', endpoint: 'https://push.example/old', enabled: true, last_seen_at: '2026-08-03T08:00:00Z' },
    { id: 'disabled', endpoint: 'https://push.example/disabled', enabled: false, last_seen_at: '2026-08-04T09:00:00Z' },
    { id: 'new', endpoint: 'https://push.example/new', enabled: true, last_seen_at: '2026-08-04T08:00:00Z' },
  ]);
  assert.equal(selected.id, 'new');
});

test('notification storage is owner-isolated and the dispatcher is cron-secret protected', async () => {
  const migration = await readFile(new URL('../supabase/migrations/008_v1_9_notifications.sql', import.meta.url), 'utf8');
  const edge = await readFile(new URL('../supabase/functions/zos-reminder-dispatch/index.ts', import.meta.url), 'utf8');
  const config = await readFile(new URL('../supabase/config.toml', import.meta.url), 'utf8');

  for (const table of ['zos_push_subscriptions', 'zos_reminder_jobs', 'zos_notification_deliveries']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
  }
  assert.match(migration, /unique \(user_id, dedupe_key\)/);
  assert.match(edge, /x-zos-cron-secret/);
  assert.match(edge, /ZOS_REMINDER_CRON_SECRET/);
  assert.match(edge, /requireUser\(req\)/);
  assert.match(edge, /safeNotificationPayload/);
  assert.match(edge, /selectSingleSubscription/);
  assert.match(edge, /action === 'schedule'/);
  assert.match(edge, /normalizeScheduledJobs/);
  assert.match(edge, /zos_reminder_jobs/);
  assert.doesNotMatch(edge, /console\.log\([^\n]*(?:endpoint|p256dh|auth)/i);
  assert.match(config, /\[functions\.zos-reminder-dispatch\][\s\S]*verify_jwt\s*=\s*false/);
});

test('push capability stays explicit and never requests permission before the user action', async () => {
  let permissionRequests = 0;
  const environment = { Notification: { permission: 'default', requestPermission: async () => { permissionRequests += 1; return 'denied'; } } };
  assert.equal(pushCapabilityState(environment), 'permission_required');
  assert.equal(permissionRequests, 0);
  assert.deepEqual(await enablePushNotifications({ environment, publicKey: 'AQID' }), { state: 'denied' });
  assert.equal(permissionRequests, 1);
});

test('granted push registration is sent only through the authenticated subscription callback', async () => {
  const sent = [];
  const subscription = { toJSON: () => ({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } }) };
  const environment = {
    Notification: { permission: 'granted' },
    navigator: { serviceWorker: { ready: Promise.resolve({ pushManager: {
      getSubscription: async () => null,
      subscribe: async (options) => { assert.equal(options.userVisibleOnly, true); return subscription; },
    } }) } },
  };
  assert.deepEqual(await enablePushNotifications({
    environment, publicKey: 'AQID', registerSubscription: async (value) => sent.push(value),
  }), { state: 'enabled' });
  assert.deepEqual(sent, [subscription.toJSON()]);
});

test('service worker displays safe push payloads and opens only same-origin routes', async () => {
  const serviceWorker = await readFile(new URL('../sw.js', import.meta.url), 'utf8');
  assert.match(serviceWorker, /addEventListener\('push'/);
  assert.match(serviceWorker, /showNotification/);
  assert.match(serviceWorker, /addEventListener\('notificationclick'/);
  assert.match(serviceWorker, /new URL\(requestedUrl, self\.registration\.scope\)/);
  assert.match(serviceWorker, /targetUrl\.origin === scopeUrl\.origin/);
});

test('push client uses the protected function and never reads subscription tables directly', async () => {
  const requests = [];
  const client = createPushClient({
    url: 'https://project.supabase.co', anonKey: 'anon', accessToken: 'jwt',
    fetchImpl: async (url, init) => {
      requests.push({ url: String(url), init });
      const action = JSON.parse(init?.body || '{}').action;
      return new Response(JSON.stringify(action === 'status' ? { state: 'permission_required', publicKey: 'AQID' } : { state: 'enabled' }), {
        status: 200, headers: { 'Content-Type': 'application/json' },
      });
    },
  });
  assert.equal((await client.status()).state, 'permission_required');
  assert.equal((await client.register({ endpoint: 'https://push.example/1', keys: { p256dh: 'p', auth: 'a' } })).state, 'enabled');
  assert.equal((await client.schedule([{ dedupeKey: 'job-1' }])).state, 'enabled');
  assert.ok(requests.every((item) => item.url.endsWith('/functions/v1/zos-reminder-dispatch')));
  assert.ok(requests.every((item) => item.init.headers.Authorization === 'Bearer jwt'));
});
