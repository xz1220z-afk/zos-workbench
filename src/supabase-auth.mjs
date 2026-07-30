function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl, path) {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

async function requestJson(fetchImpl, url, options) {
  const response = await fetchImpl(url, options);
  const body = await response.text();
  if (!response.ok) throw new Error(`Supabase Auth request failed (${response.status})`);
  return body ? JSON.parse(body) : {};
}

export function magicLinkFragment(value) {
  const raw = String(value || '').trim();
  if (raw.startsWith('#')) return raw;
  try {
    return new URL(raw).hash;
  } catch {
    return '';
  }
}

export function createSupabaseAuth({ url, anonKey, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  const headers = { apikey: anonKey, 'Content-Type': 'application/json' };
  function sessionFromResponse(response) {
    const accessToken = required(response.access_token, 'missing access token');
    const refreshToken = required(response.refresh_token, 'missing refresh token');
    const userId = required(response.user?.id, 'missing user id');
    return { accessToken, refreshToken, userId };
  }

  return {
    async requestOtp(email, redirectTo) {
      required(email, 'email');
      const body = { email, create_user: true };
      if (redirectTo) body.email_redirect_to = redirectTo;
      await requestJson(fetchImpl, endpoint(url, '/auth/v1/otp'), {
        method: 'POST', headers, body: JSON.stringify(body),
      });
    },

    async signInWithPassword(email, password) {
      required(email, 'email');
      required(password, 'password');
      const response = await requestJson(fetchImpl, endpoint(url, '/auth/v1/token?grant_type=password'), {
        method: 'POST', headers, body: JSON.stringify({ email, password }),
      });
      return sessionFromResponse(response);
    },

    async verifyOtp(email, token) {
      required(email, 'email');
      required(token, 'token');
      const response = await requestJson(fetchImpl, endpoint(url, '/auth/v1/verify'), {
        method: 'POST', headers, body: JSON.stringify({ type: 'email', email, token }),
      });
      return sessionFromResponse(response);
    },

    async refreshSession(refreshToken) {
      required(refreshToken, 'refreshToken');
      const response = await requestJson(fetchImpl, endpoint(url, '/auth/v1/token?grant_type=refresh_token'), {
        method: 'POST', headers, body: JSON.stringify({ refresh_token: refreshToken }),
      });
      return sessionFromResponse(response);
    },

    async consumeMagicLink(fragment) {
      const params = new URLSearchParams(String(fragment || '').replace(/^#/, ''));
      const accessToken = required(params.get('access_token'), 'missing access token');
      const refreshToken = required(params.get('refresh_token'), 'missing refresh token');
      const user = await requestJson(fetchImpl, endpoint(url, '/auth/v1/user'), {
        headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
      });
      return { accessToken, refreshToken, userId: required(user.id, 'missing user id') };
    },
  };
}
