const SAFE_UPSTREAM_CODES = new Set([
  'invalid_api_key', 'insufficient_quota', 'rate_limit_exceeded', 'model_not_found', 'access_denied',
]);

export function classifyOpenAiUpstreamError(status, upstreamCode = '') {
  const code = SAFE_UPSTREAM_CODES.has(String(upstreamCode || '')) ? String(upstreamCode) : '';
  if (Number(status) === 401 || code === 'invalid_api_key') return 'ai_key_invalid';
  if (Number(status) === 403 || code === 'access_denied') return 'ai_access_denied';
  if (Number(status) === 404 || code === 'model_not_found') return 'ai_model_unavailable';
  if (Number(status) === 429 && code === 'insufficient_quota') return 'ai_quota_exhausted';
  if (Number(status) === 429) return 'ai_rate_limited';
  return 'ai_upstream_failed';
}

export async function safeOpenAiUpstreamCode(response) {
  let upstreamCode = '';
  try {
    const body = await response.clone().json();
    upstreamCode = String(body?.error?.code || '');
  } catch { /* Invalid upstream bodies remain a generic safe failure. */ }
  return classifyOpenAiUpstreamError(response?.status, upstreamCode);
}
