import { AuthError, requireUser } from '../_shared/auth.ts';
import { FeishuRequestError, safeFeishuCode } from '../_shared/feishu.ts';
import { readBusinessSources } from '../_shared/business-data.ts';
import { buildCachedBusinessPayload } from '../_shared/business-cache.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);

  const requestedSource = new URL(req.url).searchParams.get('source') || 'all';
  if (!['all', 'wanjia', 'huahuo', 'projects'].includes(requestedSource)) {
    return response({ error: 'invalid_source' }, 400);
  }

  let identity;
  try {
    identity = await requireUser(req);
  } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  try {
    const sources = requestedSource === 'all' ? ['wanjia', 'huahuo', 'projects'] : [requestedSource];
    const { data, error } = await identity.supabase.from('zos_business_cache')
      .select('source,payload,fetched_at,expires_at')
      .in('source', sources);
    if (!error) {
      const cached = buildCachedBusinessPayload(data, requestedSource);
      if (cached) return response(cached);
    }
  } catch { /* A cache miss or unavailable cache safely falls back to live read-only Feishu. */ }

  try {
    return response(await readBusinessSources(requestedSource as 'all' | 'wanjia' | 'huahuo' | 'projects'));
  } catch (error) {
    const reason = safeFeishuCode(error);
    console.error(JSON.stringify({ event: 'zos_business_data_failed', reason }));
    const missingFields = error instanceof FeishuRequestError ? error.missingFields : [];
    return response({ error: 'source_read_failed', reason, missing_fields: missingFields }, 502);
  }
});
