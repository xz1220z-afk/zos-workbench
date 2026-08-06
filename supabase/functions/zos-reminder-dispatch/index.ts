import { createClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';
import { AuthError, requireUser } from '../_shared/auth.ts';
import { normalizeScheduledJobs, safeNotificationPayload, selectSingleSubscription } from '../_shared/reminder-dispatch.mjs';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-zos-cron-secret',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('service_not_configured');
  return createClient(url, key);
}

async function endpointHash(endpoint: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(endpoint));
  return Array.from(new Uint8Array(bytes), (value) => value.toString(16).padStart(2, '0')).join('');
}

function validSubscription(value: Record<string, unknown>) {
  const endpoint = String(value?.endpoint || '');
  const keys = value?.keys && typeof value.keys === 'object' ? value.keys as Record<string, unknown> : {};
  if (!endpoint.startsWith('https://') || endpoint.length > 2048) throw new Error('subscription_invalid');
  const p256dh = String(keys.p256dh || '');
  const auth = String(keys.auth || '');
  if (!p256dh || !auth || p256dh.length > 512 || auth.length > 512) throw new Error('subscription_invalid');
  return { endpoint, p256dh, auth };
}

async function manageSubscription(req: Request) {
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try { ({ user } = await requireUser(req)); } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }
  const body = await req.json().catch(() => ({})) as Record<string, unknown>;
  const action = String(body.action || 'status');
  const supabase = serviceClient();
  if (action === 'status') {
    const publicKey = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const { data } = await supabase.from('zos_push_subscriptions').select('enabled,last_seen_at')
      .eq('user_id', user.id).eq('enabled', true).order('last_seen_at', { ascending: false }).limit(1).maybeSingle();
    return response({ state: data ? 'enabled' : publicKey ? 'permission_required' : 'pending_configuration', publicKey });
  }
  if (action === 'schedule') {
    const { data: subscription } = await supabase.from('zos_push_subscriptions').select('id')
      .eq('user_id', user.id).eq('enabled', true).limit(1).maybeSingle();
    if (!subscription) return response({ state: 'permission_required', scheduled: 0 });
    const jobs = normalizeScheduledJobs(body.jobs, { userId: user.id });
    const { error: writeError } = await supabase.rpc('replace_zos_reminder_schedule', {
      p_user_id: user.id, p_jobs: jobs,
    });
    if (writeError) return response({ error: 'reminder_write_failed' }, 502);
    return response({ state: 'enabled', scheduled: jobs.length });
  }
  if (action === 'test') {
    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || '';
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || '';
    const vapidContact = Deno.env.get('VAPID_CONTACT') || '';
    if (!vapidPublic || !vapidPrivate || !vapidContact) return response({ error: 'push_not_configured' }, 503);
    const { data: subscriptions } = await supabase.from('zos_push_subscriptions').select('*')
      .eq('user_id', user.id).eq('enabled', true);
    const subscription = selectSingleSubscription(subscriptions || []);
    if (!subscription) return response({ state: 'permission_required' }, 409);
    const { data: claimed, error: claimError } = await supabase.rpc('claim_zos_reminder_test', {
      p_user_id: user.id, p_subscription_id: subscription.id,
    });
    if (claimError) return response({ error: 'test_rate_limit_failed' }, 502);
    if (!claimed) return response({ error: 'test_rate_limited', retryAfterSeconds: 60 }, 429);
    webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify({
        title: 'ZOS 提醒测试', body: '提醒链路工作正常', tag: `zos-test-${user.id}`, url: './#health',
      }), { TTL: 300 });
      return response({ state: 'sent' });
    } catch (sendError) {
      const statusCode = Number(sendError && typeof sendError === 'object' && 'statusCode' in sendError ? sendError.statusCode : 0);
      if ([404, 410].includes(statusCode)) {
        await supabase.from('zos_push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
      }
      return response({ error: 'test_notification_failed' }, 502);
    }
  }
  const raw = body.subscription && typeof body.subscription === 'object'
    ? body.subscription as Record<string, unknown> : {};
  let subscription;
  try { subscription = validSubscription(raw); } catch { return response({ error: 'subscription_invalid' }, 400); }
  const hash = await endpointHash(subscription.endpoint);
  if (action === 'unsubscribe') {
    const { error } = await supabase.from('zos_push_subscriptions').update({ enabled: false, last_seen_at: new Date().toISOString() })
      .eq('user_id', user.id).eq('endpoint_hash', hash);
    return error ? response({ error: 'subscription_write_failed' }, 502) : response({ state: 'disabled' });
  }
  if (action !== 'subscribe') return response({ error: 'action_invalid' }, 400);
  const { error } = await supabase.from('zos_push_subscriptions').upsert({
    user_id: user.id, endpoint_hash: hash, ...subscription, enabled: true, last_seen_at: new Date().toISOString(),
  }, { onConflict: 'user_id,endpoint_hash' });
  return error ? response({ error: 'subscription_write_failed' }, 502) : response({ state: 'enabled' });
}

async function dispatch(req: Request) {
  const expected = Deno.env.get('ZOS_REMINDER_CRON_SECRET') || '';
  const provided = req.headers.get('x-zos-cron-secret') || '';
  if (!expected || provided !== expected) return response({ error: 'forbidden' }, 403);
  const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') || '';
  const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') || '';
  const vapidContact = Deno.env.get('VAPID_CONTACT') || '';
  if (!vapidPublic || !vapidPrivate || !vapidContact) return response({ error: 'push_not_configured' }, 503);
  webpush.setVapidDetails(vapidContact, vapidPublic, vapidPrivate);
  const supabase = serviceClient();
  const { data: jobs, error } = await supabase.from('zos_reminder_jobs').select('*')
    .eq('status', 'pending').lte('scheduled_at', new Date().toISOString()).order('scheduled_at').limit(100);
  if (error) return response({ error: 'reminder_read_failed' }, 502);
  let sent = 0;
  for (const job of jobs || []) {
    const { data: delivered } = await supabase.from('zos_notification_deliveries').select('id')
      .eq('user_id', job.user_id).eq('dedupe_key', job.dedupe_key).maybeSingle();
    if (delivered) {
      await supabase.from('zos_reminder_jobs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', job.id);
      continue;
    }
    const { data: subscriptions } = await supabase.from('zos_push_subscriptions').select('*')
      .eq('user_id', job.user_id).eq('enabled', true);
    const subscription = selectSingleSubscription(subscriptions || []);
    if (!subscription) continue;
    try {
      await webpush.sendNotification({
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      }, JSON.stringify(safeNotificationPayload(job)), { TTL: 3600 });
      await supabase.from('zos_notification_deliveries').upsert({
        user_id: job.user_id, reminder_job_id: job.id, dedupe_key: job.dedupe_key,
        subscription_id: subscription.id, state: 'sent', safe_code: null,
      }, { onConflict: 'user_id,dedupe_key' });
      await supabase.from('zos_reminder_jobs').update({ status: 'sent', sent_at: new Date().toISOString() }).eq('id', job.id);
      sent += 1;
    } catch (sendError) {
      const statusCode = Number(sendError && typeof sendError === 'object' && 'statusCode' in sendError ? sendError.statusCode : 0);
      if ([404, 410].includes(statusCode)) {
        await supabase.from('zos_push_subscriptions').update({ enabled: false }).eq('id', subscription.id);
      }
    }
  }
  return response({ ok: true, sent, processed: (jobs || []).length });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  if (req.headers.get('x-zos-cron-secret')) return dispatch(req);
  return manageSubscription(req);
});
