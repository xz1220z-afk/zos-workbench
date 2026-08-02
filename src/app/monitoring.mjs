const DEFAULT_CLIENT_VERSION = '1.3.0';

function safeText(value) {
  const text = String(value ?? '').trim();
  return text || null;
}

function safeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null;
}

function required(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

export function sanitizeAuditEvent(event = {}, options = {}) {
  const safeCode = safeText(event.safeCode);
  const explicitResult = ['success', 'failed'].includes(event.result) ? event.result : null;
  return {
    eventType: safeText(event.eventType) || 'unknown',
    source: safeText(event.source),
    result: explicitResult || (safeCode ? 'failed' : 'failed'),
    safeCode,
    durationMs: safeNumber(event.durationMs),
    recordCount: Number.isInteger(event.recordCount) && event.recordCount >= 0 ? event.recordCount : null,
    approvalId: safeText(event.approvalId),
    clientVersion: safeText(options.clientVersion || event.clientVersion) || DEFAULT_CLIENT_VERSION,
  };
}

export function createMonitoringClient({
  url,
  anonKey,
  userId,
  getAccessToken = async () => anonKey,
  fetchImpl = fetch,
  clientVersion = DEFAULT_CLIENT_VERSION,
} = {}) {
  required(url, 'url');
  required(anonKey, 'anonKey');
  required(userId, 'userId');
  required(fetchImpl, 'fetchImpl');
  const endpoint = new URL('/rest/v1/zos_audit_events', `${String(url).replace(/\/$/, '')}/`).toString();

  return {
    async record(event) {
      const token = required(await getAccessToken(), 'accessToken');
      const safe = sanitizeAuditEvent(event, { clientVersion });
      const body = {
        user_id: userId,
        event_type: safe.eventType,
        source: safe.source,
        result: safe.result,
        safe_code: safe.safeCode,
        duration_ms: safe.durationMs,
        record_count: safe.recordCount,
        approval_id: safe.approvalId,
        client_version: safe.clientVersion,
      };
      const response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify(body),
      });
      if (!response.ok) throw new Error(`monitoring request failed (${response.status})`);
      return safe;
    },
  };
}
