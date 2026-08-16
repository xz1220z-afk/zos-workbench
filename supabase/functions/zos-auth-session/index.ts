import { AuthError, requireOwnerUser } from '../_shared/auth.ts';

const HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: HEADERS });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: HEADERS });
  if (req.method !== 'GET') return reply({ error: 'method_not_allowed' }, 405);
  try {
    await requireOwnerUser(req);
    return reply({ state: 'authorized' });
  } catch (error) {
    return reply(
      { error: error instanceof AuthError ? error.code : 'authentication_invalid' },
      error instanceof AuthError ? error.status : 401,
    );
  }
});
