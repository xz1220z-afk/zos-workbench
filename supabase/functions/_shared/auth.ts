import { createClient } from 'npm:@supabase/supabase-js@2';

export class AuthError extends Error {
  constructor(readonly code: 'authentication_required' | 'authentication_invalid' | 'service_not_configured', readonly status: number) {
    super(code);
  }
}

function configuredPublishableKey() {
  const legacyKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (legacyKey) return legacyKey;
  const rawKeys = Deno.env.get('SUPABASE_PUBLISHABLE_KEYS');
  if (!rawKeys) return null;
  try {
    const keys = JSON.parse(rawKeys);
    if (typeof keys?.default === 'string') return keys.default;
    return Object.values(keys || {}).find((value) => typeof value === 'string') as string | undefined || null;
  } catch {
    return null;
  }
}

export async function requireUser(req: Request) {
  const authorization = req.headers.get('Authorization') || '';
  const token = authorization.replace(/^Bearer\s+/i, '');
  if (!token) throw new AuthError('authentication_required', 401);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const publishableKey = configuredPublishableKey();
  if (!supabaseUrl || !publishableKey) throw new AuthError('service_not_configured', 503);

  const supabase = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) throw new AuthError('authentication_invalid', 401);
  return { user: data.user, token };
}
