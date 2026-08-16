const SAFE_ERROR_CODES = new Set([
  'authentication_required',
  'authentication_invalid',
  'authorization_forbidden',
  'service_not_configured',
  'owner_session_contract_invalid',
]);

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl) {
  return new URL('/functions/v1/zos-auth-session', `${String(baseUrl).replace(/\/$/, '')}/`).toString();
}

function safeError(code) {
  const normalized = SAFE_ERROR_CODES.has(code) ? code : 'owner_session_failed';
  const error = new Error(normalized);
  error.code = normalized;
  return error;
}

export function createOwnerSessionClient({ url, anonKey, fetchImpl = fetch } = {}) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(fetchImpl, 'fetchImpl');

  return {
    async verify(accessToken) {
      if (!accessToken) throw safeError('authentication_required');
      const response = await fetchImpl(endpoint(url), {
        method: 'GET',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
        },
      });
      let body = {};
      try { body = await response.json(); } catch { body = {}; }
      if (!response.ok) throw safeError(body?.error);
      if (
        !body
        || typeof body !== 'object'
        || Array.isArray(body)
        || Object.keys(body).length !== 1
        || body.state !== 'authorized'
      ) {
        throw safeError('owner_session_contract_invalid');
      }
      return { state: 'authorized' };
    },
  };
}
