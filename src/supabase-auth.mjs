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

export function createSupabaseAuth({ url, anonKey, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  const headers = { apikey: anonKey, 'Content-Type': 'application/json' };

  return {
    async requestOtp(email) {
      required(email, 'email');
      await requestJson(fetchImpl, endpoint(url, '/auth/v1/otp'), {
        method: 'POST', headers, body: JSON.stringify({ email, create_user: true }),
      });
    },

    async verifyOtp(email, token) {
      required(email, 'email');
      required(token, 'token');
      const response = await requestJson(fetchImpl, endpoint(url, '/auth/v1/verify'), {
        method: 'POST', headers, body: JSON.stringify({ type: 'email', email, token }),
      });
      const accessToken = required(response.access_token, 'missing access token');
      const refreshToken = required(response.refresh_token, 'missing refresh token');
      const userId = required(response.user?.id, 'missing user id');
      return { accessToken, refreshToken, userId };
    },
  };
}
