import { createClient } from 'npm:@supabase/supabase-js@2';
import { AuthError, requireOwnerUser } from '../_shared/auth.ts';
import { buildAssistantInstructions, normalizeAssistantRequest, selectKnowledgeContext } from '../_shared/ai-assistant-contract.mjs';
import { safeOpenAiUpstreamCode } from '../_shared/openai-upstream-errors.mjs';

const HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Content-Type': 'application/json; charset=utf-8' };
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

async function safetyIdentifier(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

function outputText(body: any) {
  if (typeof body?.output_text === 'string' && body.output_text.trim()) return body.output_text.trim();
  const text = (body?.output || []).flatMap((item: any) => item?.content || []).find((part: any) => typeof part?.text === 'string')?.text;
  return typeof text === 'string' ? text.trim() : '';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method !== 'POST') return reply({ error: 'method_not_allowed' }, 405);
  let identity;
  try { identity = await requireOwnerUser(req); }
  catch (error) { return reply({ error: error instanceof AuthError ? error.code : 'authentication_invalid' }, error instanceof AuthError ? error.status : 401); }
  let request;
  try { request = normalizeAssistantRequest(await req.json()); } catch (error) { return reply({ error: error instanceof Error ? error.message : 'assistant_request_invalid' }, 400); }
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRole = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  if (!url || !serviceRole) return reply({ error: 'service_not_configured' }, 503);
  if (!openAiKey) return reply({ error: 'ai_not_configured' }, 503);
  const supabase = createClient(url, serviceRole);
  const { data, error } = await supabase.from('zos_knowledge_context').select('title,source_ref,scope,tags,excerpt,updated_at').eq('user_id', identity.user.id).eq('enabled', true).limit(200);
  if (error) return reply({ error: 'knowledge_context_read_failed' }, 502);
  const knowledge = selectKnowledgeContext(request.question, data || []);
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('ZOS_OPENAI_MODEL') || 'gpt-5-mini',
      instructions: buildAssistantInstructions(request, knowledge), input: request.question,
      max_output_tokens: 1200, safety_identifier: await safetyIdentifier(identity.user.id),
    }),
  });
  if (!response.ok) {
    const safeCode = await safeOpenAiUpstreamCode(response);
    console.error('openai_upstream_error', { status: response.status, code: safeCode });
    return reply({ error: safeCode }, 502);
  }
  const answer = outputText(await response.json());
  if (!answer) return reply({ error: 'ai_response_invalid' }, 502);
  return reply({ state: 'answered', answer, knowledgeState: knowledge.length ? 'matched_approved_excerpt' : 'general_only', sources: knowledge.map((item) => ({ title: item.title, sourceRef: item.sourceRef, scope: item.scope })) });
});
