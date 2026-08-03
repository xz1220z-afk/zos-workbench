import { AuthError, requireUser } from '../_shared/auth.ts';
import {
  FeishuRequestError,
  getTenantAccessToken,
  listFieldNames,
  listTables,
  safeFeishuCode,
  safeFeishuDiagnostic,
} from '../_shared/feishu.ts';
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

  const searchParams = new URL(req.url).searchParams;
  const requestedSource = searchParams.get('source') || 'all';
  const diagnostic = searchParams.get('diagnostic');
  if (!['all', 'wanjia', 'huahuo', 'lingli', 'projects'].includes(requestedSource)) {
    return response({ error: 'invalid_source' }, 400);
  }

  let identity;
  try {
    identity = await requireUser(req);
  } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  if (diagnostic) {
    if (!['lingli_tables', 'lingli_fields'].includes(diagnostic)) return response({ error: 'invalid_diagnostic' }, 400);
    const ownerId = Deno.env.get('ZOS_OWNER_USER_ID');
    if (!ownerId || identity.user.id !== ownerId) return response({ error: 'forbidden' }, 403);
    const appToken = Deno.env.get('LINGLI_APP_TOKEN');
    if (!appToken) return response({ error: 'feishu_configuration_missing' }, 503);
    try {
      const token = await getTenantAccessToken();
      const tables = await listTables(token, appToken);
      if (diagnostic === 'lingli_tables') {
        return response({ source: 'lingli', kind: 'table_names', count: tables.length, names: tables.map((table) => table.name) });
      }
      const tableName = searchParams.get('table_name') || '';
      const table = tables.find((item) => item.name === tableName);
      if (!table) return response({ error: 'table_not_found' }, 404);
      const fields = await listFieldNames(token, { appToken, tableId: table.tableId });
      return response({ source: 'lingli', kind: 'field_names', table_name: table.name, count: fields.length, names: fields });
    } catch (error) {
      const detail = safeFeishuDiagnostic(error);
      return response({ error: 'diagnostic_failed', ...detail }, 502);
    }
  }

  try {
    const sources = requestedSource === 'all' ? ['wanjia', 'huahuo', 'lingli', 'projects'] : [requestedSource];
    const { data, error } = await identity.supabase.from('zos_business_cache')
      .select('source,payload,fetched_at,expires_at')
      .in('source', sources);
    if (!error) {
      const cached = buildCachedBusinessPayload(data, requestedSource);
      if (cached) return response(cached);
    }
  } catch { /* A cache miss or unavailable cache safely falls back to live read-only Feishu. */ }

  try {
    return response(await readBusinessSources(requestedSource as 'all' | 'wanjia' | 'huahuo' | 'lingli' | 'projects'));
  } catch (error) {
    const reason = safeFeishuCode(error);
    const diagnostic = safeFeishuDiagnostic(error);
    console.error(JSON.stringify({ event: 'zos_business_data_failed', reason, stage: diagnostic.stage, upstreamCode: diagnostic.upstream_code }));
    const missingFields = error instanceof FeishuRequestError ? error.missingFields : [];
    return response({
      error: 'source_read_failed',
      reason,
      stage: diagnostic.stage,
      upstream_code: diagnostic.upstream_code,
      missing_fields: missingFields,
      missing_resources: diagnostic.missing_resources,
    }, 502);
  }
});
