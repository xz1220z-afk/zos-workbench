import assert from 'node:assert/strict';
import test from 'node:test';
import { AUTH_STORAGE_KEYS, createAuthGate } from '../src/app/auth-gate.mjs';

function createMemoryStorage(seed = {}) {
  const values = new Map(Object.entries(seed));
  const writes = [];
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { writes.push({ key, value: String(value) }); values.set(key, String(value)); },
    removeItem(key) { writes.push({ key, removed: true }); values.delete(key); },
    dump() { return Object.fromEntries(values); },
    writes,
  };
}

function session(userId = 'owner-user', suffix = '1') {
  return { accessToken: `access-${suffix}`, refreshToken: `refresh-${suffix}`, userId };
}

test('bootstrap restores, refreshes and verifies an owner session before authorizing', async () => {
  const storage = createMemoryStorage({
    [AUTH_STORAGE_KEYS.session]: JSON.stringify(session()),
    [AUTH_STORAGE_KEYS.email]: 'owner@example.com',
  });
  const states = [];
  const auth = { refreshSession: async () => session('owner-user', '2') };
  const verified = [];
  const gate = createAuthGate({
    auth,
    verifyOwner: async (accessToken) => { verified.push(accessToken); return { state: 'authorized' }; },
    storage,
    deviceId: 'device-1',
    now: () => new Date('2026-08-16T08:00:00.000Z'),
  });
  gate.subscribe((state) => states.push(state.status));

  const state = await gate.bootstrap();

  assert.equal(state.status, 'authorized');
  assert.equal(state.offlineReadOnly, false);
  assert.equal(state.userId, 'owner-user');
  assert.equal(state.rememberedEmail, 'owner@example.com');
  assert.deepEqual(verified, ['access-2']);
  assert.deepEqual(states, ['checking', 'authorized']);
  assert.deepEqual(gate.getSession(), session('owner-user', '2'));
});

test('no session stays signed out and a rejected owner verification is blocked', async () => {
  const empty = createAuthGate({
    auth: {}, verifyOwner: async () => ({ state: 'authorized' }), storage: createMemoryStorage(),
    deviceId: 'device-1',
  });
  assert.equal((await empty.bootstrap()).status, 'signed_out');

  const storage = createMemoryStorage();
  const rejected = createAuthGate({
    auth: { signInWithPassword: async () => session('not-owner') },
    verifyOwner: async () => { const error = new Error('authorization_forbidden'); error.code = 'authorization_forbidden'; throw error; },
    storage,
    deviceId: 'device-1',
  });
  const state = await rejected.signInWithPassword('other@example.com', 'private-password', true);
  assert.equal(state.status, 'blocked');
  assert.equal(state.reason, 'authorization_forbidden');
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.session), null);
  assert.doesNotMatch(JSON.stringify(storage.writes), /private-password/);
});

test('password sign-in remembers only the selected email and verified session', async () => {
  const storage = createMemoryStorage();
  const gate = createAuthGate({
    auth: { signInWithPassword: async () => session() },
    verifyOwner: async () => ({ state: 'authorized' }),
    storage,
    deviceId: 'device-1',
    now: () => new Date('2026-08-16T08:00:00.000Z'),
  });

  const state = await gate.signInWithPassword('owner@example.com', 'private-password', true);

  assert.equal(state.status, 'authorized');
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.email), 'owner@example.com');
  assert.match(storage.getItem(AUTH_STORAGE_KEYS.session), /access-1/);
  assert.match(storage.getItem(AUTH_STORAGE_KEYS.lease), /device-1/);
  assert.doesNotMatch(JSON.stringify(storage.dump()), /private-password/);
});

test('offline bootstrap fails closed even when this device has a recent owner lease', async () => {
  const savedSession = session();
  const lease = { userId: 'owner-user', deviceId: 'device-1', verifiedAt: '2026-08-16T08:00:00.000Z' };
  const createOffline = (now, deviceId = 'device-1') => createAuthGate({
    auth: {}, verifyOwner: async () => { throw new Error('must not call'); },
    storage: createMemoryStorage({
      [AUTH_STORAGE_KEYS.session]: JSON.stringify(savedSession),
      [AUTH_STORAGE_KEYS.lease]: JSON.stringify(lease),
    }),
    deviceId,
    isOnline: () => false,
    now: () => new Date(now),
  });

  const recent = await createOffline('2026-08-16T09:00:00.000Z').bootstrap();
  assert.equal(recent.status, 'blocked');
  assert.equal(recent.reason, 'offline_verification_required');
  assert.equal(recent.offlineReadOnly, false);

  const expired = await createOffline('2026-08-17T08:00:01.000Z').bootstrap();
  assert.equal(expired.status, 'blocked');
  assert.equal(expired.reason, 'offline_verification_required');

  const wrongDevice = await createOffline('2026-08-16T09:00:00.000Z', 'device-2').bootstrap();
  assert.equal(wrongDevice.status, 'blocked');
});

test('sign out preserves remembered email while remove-device clears every local auth artifact', async () => {
  const storage = createMemoryStorage();
  let signedOut = 0;
  let removed = 0;
  const gate = createAuthGate({
    auth: { signInWithPassword: async () => session() },
    verifyOwner: async () => ({ state: 'authorized' }),
    storage,
    deviceId: 'device-1',
    onSignOut: async () => { signedOut += 1; },
    onRemoveDevice: async () => { removed += 1; },
  });
  await gate.signInWithPassword('owner@example.com', 'private-password', true);

  await gate.signOut();
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.email), 'owner@example.com');
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.session), null);
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.lease), null);
  assert.equal(signedOut, 1);

  await gate.removeDevice();
  assert.equal(storage.getItem(AUTH_STORAGE_KEYS.email), null);
  assert.equal(removed, 1);
});

test('OTP flow stays explicit and verifies through the same owner boundary', async () => {
  const calls = [];
  const gate = createAuthGate({
    auth: {
      requestOtp: async (email) => calls.push(['request', email]),
      verifyOtp: async (email, token) => { calls.push(['verify', email, token]); return session(); },
    },
    verifyOwner: async () => ({ state: 'authorized' }),
    storage: createMemoryStorage(),
    deviceId: 'device-1',
  });

  assert.equal((await gate.requestOtp('owner@example.com')).reason, 'otp_sent');
  assert.equal((await gate.verifyOtp('owner@example.com', '123456', true)).status, 'authorized');
  assert.deepEqual(calls, [['request', 'owner@example.com'], ['verify', 'owner@example.com', '123456']]);
});

test('magic-link compatibility still passes through owner verification before authorization', async () => {
  const calls = [];
  const gate = createAuthGate({
    auth: {
      consumeMagicLink: async (fragment) => { calls.push(fragment); return session(); },
    },
    verifyOwner: async (token) => { calls.push(token); return { state: 'authorized' }; },
    storage: createMemoryStorage(),
    deviceId: 'device-1',
  });

  const state = await gate.consumeMagicLink('#access_token=temporary', 'owner@example.com', true);

  assert.equal(state.status, 'authorized');
  assert.deepEqual(calls, ['#access_token=temporary', 'access-1']);
});
