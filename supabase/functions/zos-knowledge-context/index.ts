import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthError, requireUser } from '../_shared/auth.ts';
import { normalizeKnowledgeContextIndex } from '../_shared/knowledge-context-contract.mjs';

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json; charset=utf-8' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

function serviceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) throw new Error('service_not_configured');
  return createClient(url, key);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  let identity;
  try { identity = await requireUser(req); }
  catch (error) { return reply({ error: error instanceof AuthError ? error.code : 'authentication_invalid' }, error instanceof AuthError ? error.status : 401); }
  let supabase;
  try { supabase = serviceClient(); } catch { return reply({ error: 'service_not_configured' }, 503); }
  if (req.method === 'GET') {
    const { data, error } = await supabase.from('zos_knowledge_context').select('chunk_id,updated_at,imported_at').eq('user_id', identity.user.id).eq('enabled', true).order('updated_at', { ascending: false }).limit(1);
    if (error) return reply({ error: 'knowledge_context_status_failed' }, 502);
    const { count, error: countError } = await supabase.from('zos_knowledge_context').select('*', { count: 'exact', head: true }).eq('user_id', identity.user.id).eq('enabled', true);
    if (countError) return reply({ error: 'knowledge_context_status_failed' }, 502);
    return reply({ state: count ? 'ready' : 'empty', count: count || 0, latestAt: data?.[0]?.updated_at || data?.[0]?.imported_at || null });
  }
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  let raw;
  try { raw = await req.json(); } catch { return reply({ error: 'knowledge_payload_invalid' }, 400); }
  let index;
  try { index = normalizeKnowledgeContextIndex(raw); } catch (error) { return reply({ error: error instanceof Error ? error.message : 'knowledge_payload_invalid' }, 400); }
  const rows = index.chunks.map((item) => ({
    user_id: identity.user.id, chunk_id: item.chunkId, title: item.title, source_ref: item.sourceRef, scope: item.scope,
    tags: item.tags, excerpt: item.excerpt, content_hash: item.contentHash, updated_at: item.updatedAt, imported_at: new Date().toISOString(), enabled: true,
  }));
  const { error } = await supabase.from('zos_knowledge_context').upsert(rows, { onConflict: 'user_id,chunk_id' });
  if (error) return reply({ error: 'knowledge_context_write_failed' }, 502);
  return reply({ state: 'indexed', count: rows.length, mode: 'approved_excerpt_index' });
});
