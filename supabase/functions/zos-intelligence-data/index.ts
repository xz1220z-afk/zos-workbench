import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthError, requireUser } from '../_shared/auth.ts';
import { FeishuRequestError, safeFeishuCode } from '../_shared/feishu.ts';
import { IntelligenceConfigurationError, readIntelligenceSource } from '../_shared/intelligence-data.ts';
import { ExternalIntelligenceError, readAihotSource } from '../_shared/external-intelligence.mjs';
import { chunkIntelligenceRows, prepareIntelligenceRows } from '../_shared/intelligence-cache.mjs';

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

  let identity;
  try { identity = await requireUser(req); }
  catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return response({ error: 'service_not_configured' }, 503);
  const supabase = createClient(url, serviceRole);
  let refreshState = 'cached';
  const sourceHealth: Record<string, { state: string; count: number; safeCode: string | null }> = {
    intelligence_feishu: { state: 'cached', count: 0, safeCode: null },
    intelligence_aihot: { state: 'cached', count: 0, safeCode: null },
    intelligence_cache: { state: 'cached', count: 0, safeCode: null },
  };

  if (new URL(req.url).searchParams.get('refresh')) {
    const sourceBatches: Record<string, Record<string, unknown>[]> = {
      intelligence_feishu: [],
      intelligence_aihot: [],
    };
    const sourceFailures: string[] = [];
    try {
      const sourceRows = await readIntelligenceSource();
      sourceBatches.intelligence_feishu = sourceRows;
      sourceHealth.intelligence_feishu = { state: 'synced', count: sourceRows.length, safeCode: null };
    }
    catch (error) {
      const safeCode = error instanceof IntelligenceConfigurationError
        ? error.code
        : (error instanceof FeishuRequestError ? safeFeishuCode(error) : 'intelligence_refresh_failed');
      sourceFailures.push(safeCode);
      sourceHealth.intelligence_feishu = { state: 'failed', count: 0, safeCode };
    }
    try {
      const sourceRows = await readAihotSource({ now: new Date().toISOString(), limit: 50 });
      sourceBatches.intelligence_aihot = sourceRows;
      sourceHealth.intelligence_aihot = { state: 'synced', count: sourceRows.length, safeCode: null };
    }
    catch (error) {
      const safeCode = error instanceof ExternalIntelligenceError ? error.code : 'external_intelligence_failed';
      sourceFailures.push(safeCode);
      sourceHealth.intelligence_aihot = { state: 'failed', count: 0, safeCode };
    }
    const incomingIds = [...new Set(Object.values(sourceBatches).flat()
      .map((item) => String(item.external_id || '')).filter(Boolean))];
    let currentStatuses: Record<string, unknown>[] = [];
    let cacheCount = 0;
    let cacheFailures = 0;
    if (incomingIds.length) {
      const { data: statuses, error: statusError } = await supabase.from('zos_intelligence_items')
        .select('external_id,status').eq('user_id', identity.user.id).in('external_id', incomingIds);
      if (statusError) {
        sourceFailures.push('intelligence_cache_status_read_failed');
        sourceHealth.intelligence_cache = { state: 'failed', count: 0, safeCode: 'intelligence_cache_status_read_failed' };
      } else {
        currentStatuses = statuses || [];
        for (const [source, sourceRows] of Object.entries(sourceBatches)) {
          const prepared = prepareIntelligenceRows(identity.user.id, sourceRows, currentStatuses);
          let sourceFailed = false;
          for (const chunk of chunkIntelligenceRows(prepared, 50)) {
            const { error } = await supabase.from('zos_intelligence_items').upsert(chunk, { onConflict: 'user_id,external_id' });
            if (error) { sourceFailed = true; break; }
            cacheCount += chunk.length;
          }
          if (sourceFailed) {
            cacheFailures += 1;
            const safeCode = `${source}_cache_write_failed`;
            sourceFailures.push(safeCode);
            sourceHealth[source] = { state: 'failed', count: 0, safeCode };
          }
        }
        sourceHealth.intelligence_cache = {
          state: cacheFailures ? (cacheCount ? 'partial' : 'failed') : 'synced',
          count: cacheCount,
          safeCode: cacheFailures ? 'intelligence_cache_write_failed' : null,
        };
      }
    } else {
      sourceHealth.intelligence_cache = { state: 'synced', count: 0, safeCode: null };
    }
    refreshState = sourceFailures.length ? (cacheCount ? 'partial' : sourceFailures[0]) : 'synced';
  }

  const { data, error } = await supabase.from('zos_intelligence_items')
    .select('external_id,title,source_name,source_url,published_at,captured_at,credibility,score,relevant_companies,tags,fact_summary,impact_analysis,suggested_action,status,source_updated_at')
    .eq('user_id', identity.user.id).neq('status', 'ignored')
    .order('score', { ascending: false }).order('published_at', { ascending: false }).limit(100);
  if (error) return response({ error: 'intelligence_read_failed' }, 502);
  return response({
    items: data || [], state: refreshState, sources: sourceHealth,
    mode: 'private_summary_cache', fetchedAt: new Date().toISOString(),
  });
});
