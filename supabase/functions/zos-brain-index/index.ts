import { createClient } from 'npm:@supabase/supabase-js@2';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

const MAX_INDEX_BYTES = 2 * 1024 * 1024;
const MAX_NOTES = 10_000;
const REQUIRED_NOTE_KEYS = ['path', 'title', 'tags', 'mtime', 'folder', 'reviewStatus'];
const FORBIDDEN_NOTE_KEYS = ['content', 'body', 'text', 'markdown'];

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function configuredPublishableKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyKey) return legacyKey;
  const rawKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!rawKeys) return null;
  try {
    const keys = JSON.parse(rawKeys);
    if (typeof keys?.default === 'string') return keys.default;
    const firstKey = Object.values(keys || {}).find((value) => typeof value === 'string');
    return typeof firstKey === 'string' ? firstKey : null;
  } catch {
    return null;
  }
}

function validateMetadataIndex(index: unknown) {
  if (!index || typeof index !== 'object') throw new Error('invalid_metadata_index');
  const value = index as Record<string, unknown>;
  if (value.mode !== 'read_only') throw new Error('metadata_index_must_be_read_only');
  if (value.source !== 'brain') throw new Error('metadata_index_source_must_be_brain');
  if (!Array.isArray(value.notes) || value.notes.length > MAX_NOTES) throw new Error('invalid_notes');
  for (const note of value.notes) {
    if (!note || typeof note !== 'object') throw new Error('invalid_note');
    const record = note as Record<string, unknown>;
    for (const key of REQUIRED_NOTE_KEYS) if (!(key in record)) throw new Error('note_missing_required_metadata');
    for (const key of FORBIDDEN_NOTE_KEYS) if (key in record) throw new Error('note_content_is_forbidden');
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);
  const url = Deno.env.get('SUPABASE_URL');
  const publishableKey = configuredPublishableKey();
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !publishableKey || !serviceRoleKey) return response({ error: 'service_not_configured' }, 500);

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return response({ error: 'authentication_required' }, 401);
  const authClient = createClient(url, publishableKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  if (userError || !userData.user) return response({ error: 'authentication_required' }, 401);

  const raw = await req.text();
  if (new TextEncoder().encode(raw).byteLength > MAX_INDEX_BYTES) return response({ error: 'metadata_index_too_large' }, 413);
  let payload: unknown;
  try { payload = JSON.parse(raw); } catch { return response({ error: 'invalid_json' }, 400); }
  try { validateMetadataIndex(payload); } catch (error) {
    return response({ error: error instanceof Error ? error.message : 'invalid_metadata_index' }, 400);
  }

  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const admin = createClient(url, serviceRoleKey);
  const { error: writeError } = await admin.from('zos_business_cache').upsert({
    user_id: userData.user.id,
    source: 'brain',
    payload,
    fetched_at: new Date().toISOString(),
    expires_at: expiresAt,
  }, { onConflict: 'user_id,source' });
  if (writeError) return response({ error: 'cache_write_failed' }, 500);
  return response({ source: 'brain', mode: 'read_only', state: 'uploaded', expiresAt });
});
