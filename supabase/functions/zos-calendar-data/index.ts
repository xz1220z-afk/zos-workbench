import { AuthError, requireUser } from '../_shared/auth.ts';
import { getTenantAccessToken } from '../_shared/feishu.ts';
import {
  calendarIdsFromList,
  normalizeFeishuCalendarEvents,
  primaryCalendarId,
  userIdForEmail,
  userIdForName,
} from '../_shared/feishu-calendar.mjs';
import { parseIcsCalendar } from '../_shared/ics-calendar.mjs';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

async function feishuJson(url: string, token: string, stage: string, init: RequestInit = {}) {
  const upstream = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...(init.headers || {}),
    },
    signal: AbortSignal.timeout(12_000),
  });
  let payload: Record<string, unknown> | null = null;
  try { payload = await upstream.json(); } catch { /* safe failure below */ }
  if (!upstream.ok || payload?.code !== 0) {
    const status = upstream.status === 401 ? 401 : upstream.status === 403 ? 403 : 502;
    throw Object.assign(new Error('feishu_calendar_failed'), {
      status,
      stage,
      upstreamCode: typeof payload?.code === 'number' ? payload.code : null,
    });
  }
  return payload?.data as Record<string, unknown> || {};
}

async function readFeishuCalendar(email: string) {
  const token = await getTenantAccessToken();
  let userId: string | null = null;
  let calendarIds: string[] = [];
  if (email) {
    const userData = await feishuJson(
      'https://open.feishu.cn/open-apis/contact/v3/users/batch_get_id?user_id_type=open_id',
      token,
      'resolve_owner_email',
      { method: 'POST', body: JSON.stringify({ emails: [email] }) },
    );
    userId = userIdForEmail(userData, email);
  }
  if (!userId) {
    const listed = await feishuJson(
      'https://open.feishu.cn/open-apis/calendar/v4/calendars?page_size=500',
      token,
      'list_app_calendars',
    );
    calendarIds = calendarIdsFromList(listed);
  }
  if (!userId && !calendarIds.length) {
    const ownerName = Deno.env.get('FEISHU_OWNER_NAME') || '';
    if (ownerName) {
      const query = new URLSearchParams({
        department_id: '0', department_id_type: 'department_id', user_id_type: 'open_id', page_size: '100',
      });
      const directory = await feishuJson(
        `https://open.feishu.cn/open-apis/contact/v3/users/find_by_department?${query}`,
        token,
        'resolve_owner_directory',
      );
      userId = userIdForName(directory, ownerName);
    }
  }
  if (userId) {
    const primaryData = await feishuJson(
      'https://open.feishu.cn/open-apis/calendar/v4/calendars/primarys?user_id_type=open_id',
      token,
      'resolve_primary_calendar',
      { method: 'POST', body: JSON.stringify({ user_ids: [userId] }) },
    );
    const primaryId = primaryCalendarId(primaryData, userId);
    if (primaryId) calendarIds = [primaryId];
  }
  if (!calendarIds.length) return {
    state: 'pending_configuration', source: 'feishu', items: [],
    reason: userId ? 'calendar_primary_not_found' : 'calendar_owner_not_found',
  };

  const startTime = Math.floor(Date.now() / 1000) - 30 * 86400;
  const endTime = Math.floor(Date.now() / 1000) + 180 * 86400;
  const items: unknown[] = [];
  for (const calendarId of calendarIds.slice(0, 10)) {
    let pageToken = '';
    for (let page = 0; page < 5; page += 1) {
      const query = new URLSearchParams({
        start_time: String(startTime), end_time: String(endTime), page_size: '500', user_id_type: 'open_id',
      });
      if (pageToken) query.set('page_token', pageToken);
      const data = await feishuJson(
        `https://open.feishu.cn/open-apis/calendar/v4/calendars/${encodeURIComponent(calendarId)}/events?${query}`,
        token,
        'read_events',
      );
      if (Array.isArray(data.items)) items.push(...data.items);
      if (!data.has_more || typeof data.page_token !== 'string' || !data.page_token) break;
      pageToken = data.page_token;
    }
  }
  return {
    state: 'synced', source: 'feishu', items: normalizeFeishuCalendarEvents(items).slice(0, 500),
    fetchedAt: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);
  let user: Awaited<ReturnType<typeof requireUser>>['user'];
  try { ({ user } = await requireUser(req)); } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  const configuredUrl = Deno.env.get('EXTERNAL_CALENDAR_ICS_URL');
  if (!configuredUrl) {
    try {
      return response(await readFeishuCalendar(user.email || ''));
    } catch (error) {
      const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 502;
      if (status === 401) return response({ error: 'calendar_feishu_auth_failed' }, 502);
      const stage = error && typeof error === 'object' && 'stage' in error && typeof error.stage === 'string' ? error.stage : 'unknown';
      const upstreamCode = error && typeof error === 'object' && 'upstreamCode' in error && Number.isInteger(error.upstreamCode) ? error.upstreamCode : null;
      return response({
        error: status === 403 ? 'calendar_feishu_permission_denied' : 'calendar_feishu_failed_stage',
        stage,
        upstream_code: upstreamCode,
      }, 502);
    }
  }
  let url: URL;
  try { url = new URL(configuredUrl); } catch { return response({ error: 'calendar_configuration_invalid' }, 503); }
  if (!['https:', 'http:'].includes(url.protocol)) return response({ error: 'calendar_configuration_invalid' }, 503);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(12_000), redirect: 'follow' });
    if (!upstream.ok) return response({ error: 'calendar_read_failed' }, 502);
    const body = await upstream.text();
    if (body.length > 1_000_000) return response({ error: 'calendar_too_large' }, 413);
    return response({ state: 'synced', source: 'ics', items: parseIcsCalendar(body).slice(0, 500), fetchedAt: new Date().toISOString() });
  } catch {
    return response({ error: 'calendar_read_failed' }, 502);
  }
});
