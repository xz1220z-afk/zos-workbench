import { AuthError, requireUser } from '../_shared/auth.ts';
import { parseIcsCalendar } from '../../../src/app/ics-calendar.mjs';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);
  try { await requireUser(req); } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  const configuredUrl = Deno.env.get('EXTERNAL_CALENDAR_ICS_URL');
  if (!configuredUrl) return response({ state: 'pending_configuration', items: [] });
  let url: URL;
  try { url = new URL(configuredUrl); } catch { return response({ error: 'calendar_configuration_invalid' }, 503); }
  if (!['https:', 'http:'].includes(url.protocol)) return response({ error: 'calendar_configuration_invalid' }, 503);

  try {
    const upstream = await fetch(url, { signal: AbortSignal.timeout(12_000), redirect: 'follow' });
    if (!upstream.ok) return response({ error: 'calendar_read_failed' }, 502);
    const body = await upstream.text();
    if (body.length > 1_000_000) return response({ error: 'calendar_too_large' }, 413);
    return response({ state: 'synced', items: parseIcsCalendar(body).slice(0, 500), fetchedAt: new Date().toISOString() });
  } catch {
    return response({ error: 'calendar_read_failed' }, 502);
  }
});
