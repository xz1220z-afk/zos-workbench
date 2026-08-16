export const AUTH_STORAGE_KEYS = Object.freeze({
  session: 'zos_supabase_session',
  email: 'zos_login_email',
  lease: 'zos_owner_device_lease',
});

const OFFLINE_LEASE_MS = 24 * 60 * 60 * 1000;
const SAFE_BLOCK_CODES = new Set([
  'authorization_forbidden',
  'authentication_invalid',
  'authentication_required',
  'service_not_configured',
]);

function parseStored(storage, key) {
  try {
    const value = storage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch {
    return null;
  }
}

function validSession(value) {
  return value
    && typeof value.accessToken === 'string'
    && typeof value.refreshToken === 'string'
    && typeof value.userId === 'string';
}

function safeRemove(storage, key) {
  try { storage.removeItem(key); } catch { /* Local storage can be unavailable. */ }
}

function safeWrite(storage, key, value) {
  try { storage.setItem(key, value); } catch { /* Auth still works for this tab. */ }
}

function errorCode(error, fallback = 'authentication_invalid') {
  return SAFE_BLOCK_CODES.has(error?.code) ? error.code : fallback;
}

export function createAuthGate({
  auth,
  verifyOwner,
  storage,
  deviceId,
  now = () => new Date(),
  isOnline = () => true,
  onSignOut = async () => {},
  onRemoveDevice = async () => {},
} = {}) {
  if (!auth || typeof verifyOwner !== 'function' || !storage || !deviceId) {
    throw new Error('auth_gate_configuration_invalid');
  }

  const listeners = new Set();
  let currentSession = null;
  let state = {
    status: 'checking',
    reason: 'startup',
    rememberedEmail: storage.getItem(AUTH_STORAGE_KEYS.email) || '',
    userId: null,
    offlineReadOnly: false,
  };

  function publish(status, details = {}) {
    state = {
      status,
      reason: details.reason || '',
      rememberedEmail: storage.getItem(AUTH_STORAGE_KEYS.email) || '',
      userId: details.userId || null,
      offlineReadOnly: Boolean(details.offlineReadOnly),
    };
    for (const listener of listeners) listener({ ...state });
    return { ...state };
  }

  function clearVerifiedSession() {
    currentSession = null;
    safeRemove(storage, AUTH_STORAGE_KEYS.session);
    safeRemove(storage, AUTH_STORAGE_KEYS.lease);
  }

  async function authorize(session, { email, rememberEmail = false } = {}) {
    try {
      const result = await verifyOwner(session.accessToken);
      if (!result || result.state !== 'authorized') throw new Error('owner_session_contract_invalid');
    } catch (error) {
      clearVerifiedSession();
      return publish('blocked', { reason: errorCode(error) });
    }

    currentSession = { ...session };
    safeWrite(storage, AUTH_STORAGE_KEYS.session, JSON.stringify(currentSession));
    safeWrite(storage, AUTH_STORAGE_KEYS.lease, JSON.stringify({
      userId: session.userId,
      deviceId,
      verifiedAt: now().toISOString(),
    }));
    if (email) {
      if (rememberEmail) safeWrite(storage, AUTH_STORAGE_KEYS.email, email);
      else safeRemove(storage, AUTH_STORAGE_KEYS.email);
    }
    return publish('authorized', { userId: session.userId });
  }

  return {
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },

    getState() { return { ...state }; },
    getSession() { return currentSession ? { ...currentSession } : null; },

    async bootstrap() {
      publish('checking', { reason: 'startup' });
      const saved = parseStored(storage, AUTH_STORAGE_KEYS.session);
      if (!validSession(saved)) {
        clearVerifiedSession();
        return publish('signed_out', { reason: 'session_missing' });
      }

      if (!isOnline()) {
        const lease = parseStored(storage, AUTH_STORAGE_KEYS.lease);
        const verifiedAt = Date.parse(lease?.verifiedAt || '');
        const age = now().getTime() - verifiedAt;
        if (
          lease?.userId === saved.userId
          && lease?.deviceId === deviceId
          && Number.isFinite(age)
          && age >= 0
          && age <= OFFLINE_LEASE_MS
        ) {
          currentSession = { ...saved };
          return publish('authorized', { userId: saved.userId, offlineReadOnly: true });
        }
        clearVerifiedSession();
        return publish('blocked', { reason: 'offline_verification_required' });
      }

      try {
        const refreshed = await auth.refreshSession(saved.refreshToken);
        if (!validSession(refreshed)) throw new Error('session_refresh_invalid');
        return await authorize(refreshed);
      } catch {
        clearVerifiedSession();
        return publish('signed_out', { reason: 'session_expired' });
      }
    },

    async signInWithPassword(email, password, rememberEmail = false) {
      publish('authenticating');
      try {
        const session = await auth.signInWithPassword(email, password);
        return await authorize(session, { email, rememberEmail });
      } catch (error) {
        clearVerifiedSession();
        return publish('blocked', { reason: errorCode(error) });
      }
    },

    async requestOtp(email) {
      publish('authenticating');
      try {
        await auth.requestOtp(email);
        return publish('signed_out', { reason: 'otp_sent' });
      } catch {
        return publish('blocked', { reason: 'authentication_invalid' });
      }
    },

    async verifyOtp(email, token, rememberEmail = false) {
      publish('authenticating');
      try {
        const session = await auth.verifyOtp(email, token);
        return await authorize(session, { email, rememberEmail });
      } catch (error) {
        clearVerifiedSession();
        return publish('blocked', { reason: errorCode(error) });
      }
    },

    async signOut() {
      clearVerifiedSession();
      await onSignOut();
      return publish('signed_out', { reason: 'signed_out' });
    },

    async removeDevice() {
      clearVerifiedSession();
      safeRemove(storage, AUTH_STORAGE_KEYS.email);
      await onRemoveDevice();
      return publish('signed_out', { reason: 'device_removed' });
    },
  };
}
