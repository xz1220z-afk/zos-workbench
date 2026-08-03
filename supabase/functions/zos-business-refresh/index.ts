import { createClient } from 'npm:@supabase/supabase-js@2';
import { readBusinessSources } from '../_shared/business-data.ts';
import { FeishuRequestError, safeFeishuCode } from '../_shared/feishu.ts';
import { IntelligenceConfigurationError, readIntelligenceSource } from '../_shared/intelligence-data.ts';
import { ExternalIntelligenceError, readAihotSource } from '../_shared/external-intelligence.mjs';
import { chunkIntelligenceRows, prepareIntelligenceRows } from '../_shared/intelligence-cache.mjs';
import {
  InternalRefreshError,
  authorizeInternalRefresh,
  buildBusinessCacheRow,
} from '../_shared/internal-refresh.mjs';

const HEADERS = { 'Content-Type': 'application/json; charset=utf-8' };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: HEADERS });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  let ownerId: string;
  try {
    ownerId = authorizeInternalRefresh({
      providedSecret: req.headers.get('x-zos-cron-secret'),
      expectedSecret: Deno.env.get('ZOS_CRON_SECRET'),
      ownerId: Deno.env.get('ZOS_OWNER_USER_ID'),
    });
  } catch (error) {
    if (error instanceof InternalRefreshError) return response({ error: error.code }, error.status);
    return response({ error: 'forbidden' }, 403);
  }

  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRole) return response({ error: 'service_not_configured' }, 503);
  const startedAt = Date.now();
  const supabase = createClient(url, serviceRole);
  const succeeded: string[] = [];
  const failures: Record<string, string> = {};
  let counts: Record<string, number> = {};

  for (const source of ['wanjia', 'huahuo', 'lingli', 'projects'] as const) {
    try {
      const payload = await readBusinessSources(source);
      const row = buildBusinessCacheRow(ownerId, source, payload, Date.now());
      const { error } = await supabase.from('zos_business_cache').upsert(row, { onConflict: 'user_id,source' });
      if (error) throw new Error('cache_write_failed');
      counts[source] = row.payload.health?.recordCount
        ?? row.payload.projects?.length
        ?? row.payload.records?.records?.length
        ?? 0;
      succeeded.push(source);
    } catch (error) {
      failures[source] = error instanceof FeishuRequestError ? safeFeishuCode(error) : 'business_refresh_failed';
    }
  }

  const intelligenceBatches: Record<string, Record<string, unknown>[]> = {
    intelligence_feishu: [],
    intelligence_aihot: [],
  };
  try {
    intelligenceBatches.intelligence_feishu = await readIntelligenceSource();
    succeeded.push('intelligence_feishu');
  } catch (error) {
    if (error instanceof IntelligenceConfigurationError) failures.intelligence_feishu = error.code;
    else failures.intelligence_feishu = error instanceof FeishuRequestError ? safeFeishuCode(error) : 'intelligence_refresh_failed';
  }
  try {
    intelligenceBatches.intelligence_aihot = await readAihotSource({ now: new Date().toISOString(), limit: 50 });
    succeeded.push('intelligence_aihot');
  } catch (error) {
    failures.intelligence_aihot = error instanceof ExternalIntelligenceError ? error.code : 'external_intelligence_failed';
  }
  const incomingIds = [...new Set(Object.values(intelligenceBatches).flat()
    .map((item) => String(item.external_id || '')).filter(Boolean))];
  let persistedIntelligence = 0;
  if (incomingIds.length) {
    const { data: currentStatuses, error: statusError } = await supabase.from('zos_intelligence_items')
      .select('external_id,status').eq('user_id', ownerId).in('external_id', incomingIds);
    if (statusError) {
      failures.intelligence_cache = 'intelligence_cache_status_read_failed';
    } else {
      for (const [source, sourceRows] of Object.entries(intelligenceBatches)) {
        const rows = prepareIntelligenceRows(ownerId, sourceRows, currentStatuses || []);
        let sourceFailed = false;
        for (const chunk of chunkIntelligenceRows(rows, 50)) {
          const { error } = await supabase.from('zos_intelligence_items').upsert(chunk, { onConflict: 'user_id,external_id' });
          if (error) { sourceFailed = true; break; }
          persistedIntelligence += chunk.length;
        }
        if (sourceFailed) failures[`${source}_cache`] = 'intelligence_cache_write_failed';
      }
    }
  }
  counts.intelligence = persistedIntelligence;
  if (persistedIntelligence) succeeded.push('intelligence');

  const durationMs = Date.now() - startedAt;
  console.log(JSON.stringify({ event: 'zos_automatic_refresh_complete', sources: succeeded, failures, counts, durationMs }));
  if (!succeeded.length) return response({ error: 'refresh_failed', failures }, 502);
  return response({ ok: !Object.keys(failures).length, sources: succeeded, failures, counts, refreshedAt: new Date().toISOString() });
});
