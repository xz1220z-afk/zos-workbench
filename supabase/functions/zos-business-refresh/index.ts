import { createClient } from 'npm:@supabase/supabase-js@2';
import { readBusinessSources } from '../_shared/business-data.ts';
import { FeishuRequestError, safeFeishuCode } from '../_shared/feishu.ts';
import { IntelligenceConfigurationError, readIntelligenceSource } from '../_shared/intelligence-data.ts';
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

  try {
    const intelligence = await readIntelligenceSource();
    const rows = intelligence.map((item) => ({ ...item, user_id: ownerId }));
    if (rows.length) {
      const { error } = await supabase.from('zos_intelligence_items').upsert(rows, { onConflict: 'user_id,external_id' });
      if (error) throw new Error('intelligence_cache_write_failed');
    }
    counts.intelligence = rows.length;
    succeeded.push('intelligence');
  } catch (error) {
    if (error instanceof IntelligenceConfigurationError) failures.intelligence = error.code;
    else failures.intelligence = error instanceof FeishuRequestError ? safeFeishuCode(error) : 'intelligence_refresh_failed';
  }

  const durationMs = Date.now() - startedAt;
  console.log(JSON.stringify({ event: 'zos_automatic_refresh_complete', sources: succeeded, failures, counts, durationMs }));
  if (!succeeded.length) return response({ error: 'refresh_failed', failures }, 502);
  return response({ ok: !Object.keys(failures).length, sources: succeeded, failures, counts, refreshedAt: new Date().toISOString() });
});
