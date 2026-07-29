function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl, path) {
  return new URL(path, `${baseUrl.replace(/\/$/, '')}/`).toString();
}

async function parseResponse(response) {
  if (!response.ok) throw new Error(`Supabase request failed (${response.status})`);
  const body = await response.text();
  return body ? JSON.parse(body) : [];
}

export function createSupabaseTransport({ url, anonKey, getAccessToken = async () => anonKey, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(fetchImpl, 'fetchImpl');
  async function authHeaders() {
    const accessToken = await getAccessToken();
    required(accessToken, 'accessToken');
    return { apikey: anonKey, Authorization: `Bearer ${accessToken}` };
  }

  return {
    async pull(userId) {
      required(userId, 'userId');
      const requestUrl = new URL(endpoint(url, '/rest/v1/zos_records'));
      requestUrl.searchParams.set('user_id', `eq.${userId}`);
      requestUrl.searchParams.set('select', '*');
      const response = await fetchImpl(requestUrl.toString(), { headers: await authHeaders() });
      return parseResponse(response);
    },

    async upsert(rows) {
      if (!Array.isArray(rows) || rows.length === 0) return [];
      const requestUrl = new URL(endpoint(url, '/rest/v1/zos_records'));
      requestUrl.searchParams.set('on_conflict', 'user_id,entity_type,record_id');
      const response = await fetchImpl(requestUrl.toString(), {
        method: 'POST',
        headers: { ...(await authHeaders()), 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify(rows),
      });
      return parseResponse(response);
    },
  };
}
