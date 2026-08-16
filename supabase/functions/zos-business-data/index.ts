import { AuthError, requireOwnerUser } from '../_shared/auth.ts';
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
import { createClient } from 'npm:@supabase/supabase-js@2';
import { buildHistoryPayload, collectHistoryPages } from '../_shared/wanjia-history.mjs';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

async function readWanjiaHistory(
  userId: string,
  searchParams: URLSearchParams,
) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return buildHistoryPayload([], []);
  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const { data: batches, error: batchError } = await supabase
    .from('zos_wanjia_history_batches')
    .select('id,business_date,row_count,source_kind,validated_at')
    .eq('user_id', userId)
    .eq('validation_status', 'validated')
    .order('business_date', { ascending: true });
  if (batchError || !batches?.length) return buildHistoryPayload([], []);

  const batchIds = batches.map((batch: { id: number }) => batch.id);
  const { rows, error: rowError } = await collectHistoryPages((from, to) => supabase
    .from('zos_wanjia_history_rows')
    .select('batch_id,merchant_id,merchant_name,industry,owner,cooperation_type,payment_gmv,redeemed_gmv,refund_gmv,video_payment_gmv,live_payment_gmv,exception')
    .in('batch_id', batchIds)
    .order('batch_id', { ascending: true })
    .order('merchant_id', { ascending: true })
    .range(from, to));
  if (rowError) return buildHistoryPayload([], []);

  const dateByBatch = new Map(batches.map((batch: { id: number; business_date: string; source_kind: string }) => [batch.id, batch]));
  const historyRows = (rows || []).map((row: Record<string, unknown>) => {
    const batch = dateByBatch.get(row.batch_id as number);
    return { ...row, business_date: batch?.business_date, source_kind: batch?.source_kind };
  });
  const from = searchParams.get('from') || undefined;
  return buildHistoryPayload(batches, historyRows, {
    includeRange: Boolean(from || searchParams.get('to')),
    baselinePresent: from ? batches.some((batch: { business_date: string }) => batch.business_date < from) : false,
  });
}

function attachWanjiaHistory(payload: unknown, history: unknown) {
  if (!payload || typeof payload !== 'object') return payload;
  const value = payload as Record<string, unknown>;
  const wanjia = value.wanjia;
  if (!wanjia || typeof wanjia !== 'object') return payload;
  // Keep history within its selected source so existing source-normalisation
  // sees it; a root-level history key would be ignored by the client.
  return { ...value, wanjia: { ...(wanjia as Record<string, unknown>), history } };
}

async function withOptionalHistory(
  payload: unknown,
  requestedSource: string,
  includeHistory: boolean,
  identity: Awaited<ReturnType<typeof requireOwnerUser>>,
  searchParams: URLSearchParams,
) {
  if (!includeHistory || !['all', 'wanjia'].includes(requestedSource)) return payload;
  return attachWanjiaHistory(payload, await readWanjiaHistory(identity.user.id, searchParams));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'GET') return response({ error: 'method_not_allowed' }, 405);

  const searchParams = new URL(req.url).searchParams;
  const requestedSource = searchParams.get('source') || 'all';
  const includeHistory = searchParams.get('history') === '1';
  const diagnostic = searchParams.get('diagnostic');
  if (!['all', 'wanjia', 'huahuo', 'lingli', 'projects'].includes(requestedSource)) {
    return response({ error: 'invalid_source' }, 400);
  }

  let identity;
  try {
    identity = await requireOwnerUser(req);
  } catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  if (diagnostic) {
    if (!['lingli_tables', 'lingli_fields', 'wanjia_tables', 'wanjia_fields'].includes(diagnostic)) return response({ error: 'invalid_diagnostic' }, 400);
    const ownerId = Deno.env.get('ZOS_OWNER_USER_ID');
    if (!ownerId || identity.user.id !== ownerId) return response({ error: 'forbidden' }, 403);
    const source = diagnostic.startsWith('wanjia_') ? 'wanjia' : 'lingli';
    const appToken = source === 'wanjia'
      ? 'AWFUwAbItiI4TjkPMErcpv5Onab'
      : Deno.env.get('LINGLI_APP_TOKEN');
    if (!appToken) return response({ error: 'feishu_configuration_missing' }, 503);
    try {
      const token = await getTenantAccessToken();
      const tables = await listTables(token, appToken);
      if (diagnostic.endsWith('_tables')) {
        return response({ source, kind: 'table_names', count: tables.length, names: tables.map((table) => table.name) });
      }
      const tableName = searchParams.get('table_name') || '';
      const table = tables.find((item) => item.name === tableName);
      if (!table) return response({ error: 'table_not_found' }, 404);
      const fields = await listFieldNames(token, { appToken, tableId: table.tableId });
      return response({ source, kind: 'field_names', table_name: table.name, count: fields.length, names: fields });
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
      if (cached) return response(await withOptionalHistory(cached, requestedSource, includeHistory, identity, searchParams));
    }
  } catch { /* A cache miss or unavailable cache safely falls back to live read-only Feishu. */ }

  try {
    const payload = await readBusinessSources(requestedSource as 'all' | 'wanjia' | 'huahuo' | 'lingli' | 'projects');
    return response(await withOptionalHistory(payload, requestedSource, includeHistory, identity, searchParams));
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
