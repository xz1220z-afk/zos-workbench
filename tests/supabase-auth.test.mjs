import assert from 'node:assert/strict';
import test from 'node:test';
import { createSupabaseAuth, magicLinkFragment } from '../src/supabase-auth.mjs';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('magicLinkFragment extracts only the fragment from a pasted Supabase login URL', () => {
  const fragment = magicLinkFragment('https://example.github.io/zos-workbench/#access_token=access-from-link&refresh_token=refresh-from-link&token_type=bearer');

  assert.equal(fragment, '#access_token=access-from-link&refresh_token=refresh-from-link&token_type=bearer');
});

test('requestOtp sends only the email to Supabase Auth', async () => {
  const calls = [];
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    fetchImpl: async (url, options) => { calls.push({ url, options }); return jsonResponse({}); },
  });

  await auth.requestOtp('ceo@example.com');

  assert.match(calls[0].url, /\/auth\/v1\/otp$/);
  assert.equal(calls[0].options.headers.apikey, 'public-anon-key');
  assert.deepEqual(JSON.parse(calls[0].options.body), { email: 'ceo@example.com', create_user: true });
});

test('verifyOtp returns only the session material needed for private sync', async () => {
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    fetchImpl: async () => jsonResponse({ access_token: 'access-1', refresh_token: 'refresh-1', user: { id: 'user-1' } }),
  });

  const session = await auth.verifyOtp('ceo@example.com', '123456');

  assert.deepEqual(session, { accessToken: 'access-1', refreshToken: 'refresh-1', userId: 'user-1' });
});

test('verifyOtp rejects incomplete authentication responses', async () => {
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    fetchImpl: async () => jsonResponse({ user: { id: 'user-1' } }),
  });

  await assert.rejects(() => auth.verifyOtp('ceo@example.com', '123456'), /missing access token/i);
});

test('refreshSession exchanges a refresh token for a new private sync session', async () => {
  const calls = [];
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ access_token: 'access-2', refresh_token: 'refresh-2', user: { id: 'user-2' } });
    },
  });

  const session = await auth.refreshSession('refresh-1');

  assert.deepEqual(session, { accessToken: 'access-2', refreshToken: 'refresh-2', userId: 'user-2' });
  assert.match(calls[0].url, /\/auth\/v1\/token\?grant_type=refresh_token$/);
  assert.deepEqual(JSON.parse(calls[0].options.body), { refresh_token: 'refresh-1' });
});

test('consumeMagicLink turns a Supabase email-link fragment into a private sync session', async () => {
  const calls = [];
  const auth = createSupabaseAuth({
    url: 'https://project.supabase.co', anonKey: 'public-anon-key',
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ id: 'user-from-link' });
    },
  });

  const session = await auth.consumeMagicLink('#access_token=access-from-link&refresh_token=refresh-from-link&token_type=bearer');

  assert.deepEqual(session, { accessToken: 'access-from-link', refreshToken: 'refresh-from-link', userId: 'user-from-link' });
  assert.match(calls[0].url, /\/auth\/v1\/user$/);
  assert.equal(calls[0].options.headers.Authorization, 'Bearer access-from-link');
});
