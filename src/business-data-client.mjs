function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function endpoint(baseUrl, source) {
  const url = new URL('/functions/v1/zos-business-data', `${baseUrl.replace(/\/$/, '')}/`);
  if (source) url.searchParams.set('source', source);
  return url.toString();
}

function diagnosticEndpoint(baseUrl, diagnostic, tableName = '') {
  const url = new URL('/functions/v1/zos-business-data', `${baseUrl.replace(/\/$/, '')}/`);
  url.searchParams.set('diagnostic', diagnostic);
  if (tableName) url.searchParams.set('table_name', tableName);
  return url.toString();
}

async function fetchDiagnostic({ url, anonKey, accessToken, diagnostic, tableName, fetchImpl }) {
  const response = await fetchImpl(diagnosticEndpoint(url, diagnostic, tableName), {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();
  if (!response.ok) throw businessDataError(response.status, body);
  return body ? JSON.parse(body) : {};
}

export async function fetchWanjiaSchema({ url, anonKey, accessToken, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(accessToken, 'accessToken');
  const tablePayload = await fetchDiagnostic({ url, anonKey, accessToken, diagnostic: 'wanjia_tables', fetchImpl });
  const names = Array.isArray(tablePayload.names) ? tablePayload.names.filter((name) => typeof name === 'string') : [];
  const targetPrefixes = ['01.00', '01.03', '01.04.03', '01.04.04', '01.04.05', '04.03', '04.08', '04.09'];
  const targets = names.filter((name) => targetPrefixes.some((prefix) => name.includes(prefix)));
  const tables = await Promise.all(targets.map(async (name) => {
    const fieldPayload = await fetchDiagnostic({ url, anonKey, accessToken, diagnostic: 'wanjia_fields', tableName: name, fetchImpl });
    return { name, fields: Array.isArray(fieldPayload.names) ? fieldPayload.names.filter((field) => typeof field === 'string') : [] };
  }));
  return { source: 'wanjia', mode: 'schema_only', names, tables };
}

function businessDataError(status, body) {
  let payload = {};
  try { payload = body ? JSON.parse(body) : {}; } catch { /* Keep the generic status message. */ }
  const reasons = {
    feishu_configuration_missing: 'Feishu source configuration is missing',
    feishu_auth_failed: 'Feishu application authentication failed',
    feishu_permission_denied: 'Feishu app has no permission for the configured Bitable',
    feishu_resource_not_found: 'Feishu Base or table configuration was not found',
    feishu_field_mismatch: 'Feishu table field configuration does not match',
    feishu_read_failed: 'Feishu data read failed',
    feishu_request_failed: 'Feishu request failed',
  };
  const reason = reasons[payload?.reason];
  const missingFields = Array.isArray(payload?.missing_fields) && payload.missing_fields.length
    ? `: ${payload.missing_fields.join(', ')}`
    : '';
  return new Error(reason ? `Business data request failed (${status}): ${reason}${missingFields}` : `Business data request failed (${status})`);
}

export async function fetchBusinessData({ url, anonKey, accessToken, source, fetchImpl = fetch }) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(accessToken, 'accessToken');

  const response = await fetchImpl(endpoint(url, source), {
    headers: { apikey: anonKey, Authorization: `Bearer ${accessToken}` },
  });
  const body = await response.text();
  if (!response.ok) throw businessDataError(response.status, body);
  const data = body ? JSON.parse(body) : {};
  if (data?.meta?.mode !== 'read_only') throw new Error('Business data response is not read-only');
  if (source) {
    const selected = data?.[source] || {};
    const nestedRecords = selected?.records;
    const records = Array.isArray(nestedRecords)
      ? nestedRecords
      : Array.isArray(nestedRecords?.records)
        ? nestedRecords.records
        : Array.isArray(selected?.projects)
          ? selected.projects
          : [];
    const normalized = {
      source,
      mode: data.meta.mode,
      summary: selected.summary || {},
      records,
      health: selected.health || null,
      contractVersion: selected.contractVersion || data.meta.contractVersion || null,
      fetchedAt: data.meta.fetchedAt || null,
    };
    const history = selected.history || selected.historical || null;
    // Keep the existing read-only contract byte-for-byte stable for every
    // source that does not expose a historical adapter yet.
    if (history) normalized.history = history;
    return normalized;
  }
  return data;
}
