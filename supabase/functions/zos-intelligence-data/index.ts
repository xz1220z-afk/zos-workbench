import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthError, requireUser } from '../_shared/auth.ts';
import { FeishuRequestError, safeFeishuCode } from '../_shared/feishu.ts';
import { IntelligenceConfigurationError, readIntelligenceSource } from '../_shared/intelligence-data.ts';
import { ExternalIntelligenceError, readAihotSource } from '../_shared/external-intelligence.mjs';

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

  if (new URL(req.url).searchParams.get('refresh')) {
    const rows: Record<string, unknown>[] = [];
    const sourceFailures: string[] = [];
    try { rows.push(...await readIntelligenceSource()); }
    catch (error) {
      if (error instanceof IntelligenceConfigurationError) sourceFailures.push(error.code);
      else sourceFailures.push(error instanceof FeishuRequestError ? safeFeishuCode(error) : 'intelligence_refresh_failed');
    }
    try { rows.push(...await readAihotSource({ now: new Date().toISOString(), limit: 50 })); }
    catch (error) {
      sourceFailures.push(error instanceof ExternalIntelligenceError ? error.code : 'external_intelligence_failed');
    }
    const uniqueRows = [...new Map(rows.map((item) => [String(item.external_id || ''), item])).values()]
      .filter((item) => item.external_id)
      .map((item) => ({ ...item, user_id: identity.user.id }));
    if (uniqueRows.length) {
      const { error } = await supabase.from('zos_intelligence_items').upsert(uniqueRows, { onConflict: 'user_id,external_id' });
      if (error) sourceFailures.push('intelligence_cache_write_failed');
    }
    refreshState = sourceFailures.length ? (uniqueRows.length ? 'partial' : sourceFailures[0]) : 'synced';
  }

  const { data, error } = await supabase.from('zos_intelligence_items')
    .select('external_id,title,source_name,source_url,published_at,captured_at,credibility,score,relevant_companies,tags,fact_summary,impact_analysis,suggested_action,status,source_updated_at')
    .eq('user_id', identity.user.id).neq('status', 'ignored')
    .order('score', { ascending: false }).order('published_at', { ascending: false }).limit(100);
  if (error) return response({ error: 'intelligence_read_failed' }, 502);
  return response({ items: data || [], state: refreshState, mode: 'private_summary_cache', fetchedAt: new Date().toISOString() });
});
