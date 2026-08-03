import { createClient } from 'npm:@supabase/supabase-js@2';
import { readBusinessSources } from '../_shared/business-data.ts';
import { FeishuRequestError, safeFeishuCode } from '../_shared/feishu.ts';
import { IntelligenceConfigurationError, readIntelligenceSource } from '../_shared/intelligence-data.ts';
import { ExternalIntelligenceError, readAihotSource } from '../_shared/external-intelligence.mjs';
import {
  InternalRefreshError,
  authorizeInternalRefresh,
  buildBusinessCacheRows,
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

  try {
    const payload = await readBusinessSources('all');
    const rows = buildBusinessCacheRows(ownerId, payload, Date.now());
    const { error } = await supabase.from('zos_business_cache').upsert(rows, { onConflict: 'user_id,source' });
    if (error) throw new Error('cache_write_failed');
    counts = Object.fromEntries(rows.map((row) => [row.source,
      row.payload.health?.recordCount ?? row.payload.projects?.length ?? row.payload.records?.records?.length ?? 0]));
    succeeded.push(...rows.map((row) => row.source));
  } catch (error) {
    failures.business = error instanceof FeishuRequestError ? safeFeishuCode(error) : 'business_refresh_failed';
  }

  const intelligenceRows: Record<string, unknown>[] = [];
  try {
    intelligenceRows.push(...await readIntelligenceSource());
    succeeded.push('intelligence_feishu');
  } catch (error) {
    if (error instanceof IntelligenceConfigurationError) failures.intelligence_feishu = error.code;
    else failures.intelligence_feishu = error instanceof FeishuRequestError ? safeFeishuCode(error) : 'intelligence_refresh_failed';
  }
  try {
    intelligenceRows.push(...await readAihotSource({ now: new Date().toISOString(), limit: 50 }));
    succeeded.push('intelligence_aihot');
  } catch (error) {
    failures.intelligence_aihot = error instanceof ExternalIntelligenceError ? error.code : 'external_intelligence_failed';
  }
  const uniqueIntelligence = [...new Map(intelligenceRows.map((item) => [String(item.external_id || ''), item])).values()]
    .filter((item) => item.external_id);
  try {
    const rows = uniqueIntelligence.map((item) => ({ ...item, user_id: ownerId }));
    if (rows.length) {
      const { error } = await supabase.from('zos_intelligence_items').upsert(rows, { onConflict: 'user_id,external_id' });
      if (error) throw new Error('intelligence_cache_write_failed');
    }
    counts.intelligence = rows.length;
    if (succeeded.some((source) => source.startsWith('intelligence_'))) succeeded.push('intelligence');
  } catch {
    failures.intelligence_cache = 'intelligence_cache_write_failed';
  }

  const durationMs = Date.now() - startedAt;
  console.log(JSON.stringify({ event: 'zos_automatic_refresh_complete', sources: succeeded, failures, counts, durationMs }));
  if (!succeeded.length) return response({ error: 'refresh_failed', failures }, 502);
  return response({ ok: !Object.keys(failures).length, sources: succeeded, failures, counts, refreshedAt: new Date().toISOString() });
});
