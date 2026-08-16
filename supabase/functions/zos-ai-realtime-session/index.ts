import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthError, requireOwnerUser } from '../_shared/auth.ts';
import { buildRealtimeSession, normalizeRealtimeVoiceContext } from '../_shared/realtime-voice-contract.mjs';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const JSON_HEADERS = { ...CORS, 'Content-Type': 'application/json; charset=utf-8' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });

async function formText(value: FormDataEntryValue | null) {
  if (typeof value === 'string') return value;
  if (value && typeof value.text === 'function') return value.text();
  return '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  let identity;
  try { identity = await requireOwnerUser(req); }
  catch (error) { return reply({ error: error instanceof AuthError ? error.code : 'authentication_invalid' }, error instanceof AuthError ? error.status : 401); }

  if (!String(req.headers.get('content-type') || '').toLowerCase().startsWith('multipart/form-data')) {
    return reply({ error: 'content_type_invalid' }, 415);
  }

  let sdp = '';
  let context;
  try {
    const form = await req.formData();
    sdp = (await formText(form.get('sdp'))).trim();
    const contextText = (await formText(form.get('context'))).trim() || '{}';
    if (!sdp.startsWith('v=0') || sdp.length > 128_000) throw new Error('sdp_invalid');
    context = normalizeRealtimeVoiceContext(JSON.parse(contextText));
  } catch (error) {
    const safeCode = error instanceof Error && /^(?:sdp_|route_|title_|agent_|knowledge_)/.test(error.message)
      ? error.message : 'realtime_request_invalid';
    return reply({ error: safeCode }, 400);
  }

  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!openAiKey) return reply({ error: 'ai_not_configured' }, 503);
  if (!url || !serviceRole) return reply({ error: 'service_not_configured' }, 503);

  let knowledge: Array<{ title: string; sourceRef: string; excerpt: string }> = [];
  if (context.knowledgeRefs.length) {
    const supabase = createClient(url, serviceRole);
    const { data, error } = await supabase.from('zos_knowledge_context')
      .select('title,source_ref,excerpt')
      .eq('user_id', identity.user.id)
      .eq('enabled', true)
      .in('source_ref', context.knowledgeRefs)
      .limit(6);
    if (error) return reply({ error: 'knowledge_context_read_failed' }, 502);
    knowledge = (data || []).map((item: any) => ({
      title: String(item.title || ''), sourceRef: String(item.source_ref || ''), excerpt: String(item.excerpt || ''),
    }));
  }

  const session = buildRealtimeSession(context, knowledge, {
    model: Deno.env.get('ZOS_OPENAI_REALTIME_MODEL') || 'gpt-realtime',
  });
  const upstreamBody = new FormData();
  upstreamBody.append('sdp', new Blob([sdp], { type: 'application/sdp' }), 'offer.sdp');
  upstreamBody.append('session', new Blob([JSON.stringify(session)], { type: 'application/json' }), 'session.json');

  let upstream;
  try {
    upstream = await fetch('https://api.openai.com/v1/realtime/calls', {
      method: 'POST',
      headers: { Authorization: `Bearer ${openAiKey}` },
      body: upstreamBody,
    });
  } catch {
    return reply({ error: 'ai_upstream_failed' }, 502);
  }
  if (!upstream.ok) return reply({ error: 'ai_upstream_failed' }, 502);
  const answerSdp = (await upstream.text()).trim();
  if (!answerSdp.startsWith('v=0') || answerSdp.length > 128_000) return reply({ error: 'ai_response_invalid' }, 502);
  return new Response(answerSdp, {
    status: 200,
    headers: { ...CORS, 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store' },
  });
});
