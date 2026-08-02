function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl) {
  return new URL('/functions/v1/zos-business-data', `${baseUrl.replace(/\/$/, '')}/`).toString();
}

function businessDataError(status, body) {
  let payload = {};
  try { payload = body ? JSON.parse(body) : {}; } catch { /* Keep the generic status message. */ }
  const reasons = {
    feishu_auth_failed: 'Feishu application authentication failed',
    feishu_read_failed: 'Feishu data read failed',
    feishu_request_failed: 'Feishu request failed',
  };
  const reason = reasons[payload?.reason];
  return new Error(reason ? `Business data request failed (${status}): ${reason}` : `Business data request failed (${status})`);
}

export async function fetchBusinessData({ url, anonKey, accessToken, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(accessToken, 'accessToken');

  const response = await fetchImpl(endpoint(url), {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();
  if (!response.ok) throw businessDataError(response.status, body);
  const data = body ? JSON.parse(body) : {};
  if (data?.meta?.mode !== 'read_only') throw new Error('Business data response is not read-only');
  return data;
}
