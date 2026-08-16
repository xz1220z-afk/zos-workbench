import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import {
  OwnerAuthorizationError,
  requireConfiguredOwner,
} from '../supabase/functions/_shared/owner-authorization.mjs';

test('configured owner identity is accepted without changing the identity object', () => {
  const identity = { user: { id: 'owner-user' }, token: 'private-token', supabase: {} };

  assert.equal(requireConfiguredOwner(identity, { ownerId: 'owner-user' }), identity);
});

test('an authenticated non-owner is rejected with a safe 403 error', () => {
  const identity = { user: { id: 'different-user' }, token: 'private-token', supabase: {} };

  assert.throws(
    () => requireConfiguredOwner(identity, { ownerId: 'owner-user' }),
    (error) => {
      assert.ok(error instanceof OwnerAuthorizationError);
      assert.equal(error.code, 'authorization_forbidden');
      assert.equal(error.status, 403);
      assert.doesNotMatch(error.message, /different-user|owner-user|private-token/);
      return true;
    },
  );
});

test('missing owner configuration fails closed as unavailable', () => {
  const identity = { user: { id: 'owner-user' }, token: 'private-token', supabase: {} };

  assert.throws(
    () => requireConfiguredOwner(identity, { ownerId: '' }),
    (error) => {
      assert.ok(error instanceof OwnerAuthorizationError);
      assert.equal(error.code, 'service_not_configured');
      assert.equal(error.status, 503);
      assert.equal(error.message, 'service_not_configured');
      return true;
    },
  );
});

test('shared request auth exposes one owner guard after normal user authentication', async () => {
  const source = await readFile(new URL('../supabase/functions/_shared/auth.ts', import.meta.url), 'utf8');

  assert.match(source, /export async function requireOwnerUser\(req: Request\)/);
  assert.match(source, /await requireUser\(req\)/);
  assert.match(source, /Deno\.env\.get\('ZOS_OWNER_USER_ID'\)/);
  assert.match(source, /requireConfiguredOwner\(/);
  assert.match(source, /authorization_forbidden/);
});
