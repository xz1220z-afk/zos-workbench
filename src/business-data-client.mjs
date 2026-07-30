function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl) {
  return new URL('/functions/v1/zos-business-data', `${baseUrl.replace(/\/$/, '')}/`).toString();
}

export async function fetchBusinessData({ url, anonKey, accessToken, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(accessToken, 'accessToken');

  const response = await fetchImpl(endpoint(url), {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();
  if (!response.ok) throw new Error(`Business data request failed (${response.status})`);
  const data = body ? JSON.parse(body) : {};
  if (data?.meta?.mode !== 'read_only') throw new Error('Business data response is not read-only');
  return data;
}
