const SAFE_CODES = new Set([
  'approval_expired', 'approval_already_used', 'source_changed', 'field_unavailable',
  'feishu_write_failed', 'feishu_readback_failed', 'authentication_required',
  'invalid_request', 'approval_not_found',
]);

function required(value, name) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${name} is required`);
  return value.trim();
}

function endpoint(url, path) {
  return new URL(path, `${required(url, 'url').replace(/\/$/, '')}/`).toString();
}

export class FeishuApprovalError extends Error {
  constructor(safeCode, status = 0) {
    super(safeCode);
    this.name = 'FeishuApprovalError';
    this.safeCode = safeCode;
    this.status = status;
  }
}

export function createFeishuApprovalClient(config = {}) {
  const url = required(config.url, 'url');
  const anonKey = required(config.anonKey, 'anonKey');
  const getAccessToken = config.getAccessToken;
  const fetchImpl = config.fetchImpl || globalThis.fetch;
  if (typeof getAccessToken !== 'function') throw new Error('getAccessToken is required');
  if (typeof fetchImpl !== 'function') throw new Error('fetchImpl is required');

  async function post(path, body) {
    const accessToken = required(await getAccessToken(), 'accessToken');
    let response;
    try {
      response = await fetchImpl(endpoint(url, path), {
        method: 'POST',
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });
    } catch {
      throw new FeishuApprovalError('approval_request_failed');
    }
    let payload = {};
    try { payload = await response.json(); } catch { /* safe fallback */ }
    if (!response.ok) {
      const safeCode = SAFE_CODES.has(payload?.safeCode) ? payload.safeCode : 'approval_request_failed';
      throw new FeishuApprovalError(safeCode, response.status);
    }
    return payload;
  }

  return {
    preview(proposal = {}) {
      return post('/functions/v1/zos-feishu-approval-preview', {
        source: proposal.source,
        recordId: proposal.recordId,
        action: proposal.action,
        value: proposal.value,
      });
    },
    execute(approvalId) {
      return post('/functions/v1/zos-feishu-approval-execute', { approvalId });
    },
  };
}
