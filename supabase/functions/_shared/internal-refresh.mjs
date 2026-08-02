export class InternalRefreshError extends Error {
  constructor(code, status) {
    super(code);
    this.code = code;
    this.status = status;
  }
}

function constantTimeEqual(left, right) {
  const a = new TextEncoder().encode(String(left || ''));
  const b = new TextEncoder().encode(String(right || ''));
  const length = Math.max(a.length, b.length);
  let mismatch = a.length ^ b.length;
  for (let index = 0; index < length; index += 1) {
    mismatch |= (a[index] || 0) ^ (b[index] || 0);
  }
  return mismatch === 0;
}

export function authorizeInternalRefresh({ providedSecret, expectedSecret, ownerId } = {}) {
  if (!expectedSecret || !ownerId) throw new InternalRefreshError('service_not_configured', 503);
  if (!providedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
    throw new InternalRefreshError('forbidden', 403);
  }
  return String(ownerId);
}

export function buildBusinessCacheRows(ownerId, payload, nowMs = Date.now()) {
  if (!ownerId) throw new Error('ownerId is required');
  if (payload?.meta?.mode !== 'read_only') throw new Error('business payload must be read_only');
  const sources = ['wanjia', 'huahuo', 'projects'];
  for (const source of sources) {
    if (!payload?.[source] || typeof payload[source] !== 'object') throw new Error(`${source} payload is required`);
  }
  const fetchedAt = new Date(nowMs).toISOString();
  const expiresAt = new Date(nowMs + 30 * 60_000).toISOString();
  return sources.map((source) => ({
    user_id: String(ownerId),
    source,
    payload: { ...structuredClone(payload[source]), mode: 'read_only' },
    fetched_at: fetchedAt,
    expires_at: expiresAt,
  }));
}
