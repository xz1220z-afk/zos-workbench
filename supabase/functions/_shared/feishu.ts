export type FeishuFailureReason =
  | 'feishu_auth_failed'
  | 'feishu_permission_denied'
  | 'feishu_resource_not_found'
  | 'feishu_field_mismatch'
  | 'feishu_read_failed'
  | 'feishu_write_failed'
  | 'feishu_readback_failed'
  | 'feishu_timeout'
  | 'feishu_request_failed';

export type FeishuRecord = {
  record_id?: string;
  created_time?: string;
  last_modified_time?: string;
  fields?: Record<string, unknown>;
};

export type FeishuTarget = { appToken: string; tableId: string };

type FeishuPayload = {
  code?: number;
  tenant_access_token?: unknown;
  data?: { items?: unknown; record?: unknown };
};

export class FeishuRequestError extends Error {
  constructor(readonly reason: FeishuFailureReason, readonly missingFields: string[] = []) {
    super(reason);
  }
}

export const FEISHU_TARGETS = {
  wanjia: {
    merchant: { appToken: 'AWFUwAbItiI4TjkPMErcpv5Onab', tableId: 'tblrI2MjVtlOgpe7' },
  },
  huahuo: {
    project: { appToken: 'EqzkwDOMEigNflkDoJdcw7FSn4d', tableId: 'tblZ2QIcA2ESJx4W' },
    delivery: { appToken: 'EqzkwDOMEigNflkDoJdcw7FSn4d', tableId: 'tbl3FeKyg3Tvrm0j' },
    receipt: { appToken: 'EqzkwDOMEigNflkDoJdcw7FSn4d', tableId: 'tblllwWwvrEFgfJM' },
  },
} as const;

async function feishuFetch(url: string, init: RequestInit = {}) {
  try {
    return await fetch(url, { ...init, signal: AbortSignal.timeout(12_000) });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'TimeoutError') throw new FeishuRequestError('feishu_timeout');
    throw new FeishuRequestError('feishu_request_failed');
  }
}

async function payloadOf(response: Response) {
  try { return await response.json() as FeishuPayload; } catch { return null; }
}

function classify(response: Response, payload: FeishuPayload | null): FeishuFailureReason {
  const code = payload?.code;
  if (code === 1254302 || response.status === 403) return 'feishu_permission_denied';
  if (code === 1254040 || code === 1254041 || response.status === 404) return 'feishu_resource_not_found';
  if (code === 1254024 || code === 1254044 || code === 1254045) return 'feishu_field_mismatch';
  return 'feishu_read_failed';
}

export function safeFeishuCode(error: unknown): FeishuFailureReason {
  return error instanceof FeishuRequestError ? error.reason : 'feishu_request_failed';
}

export async function getTenantAccessToken() {
  const appId = Deno.env.get('FEISHU_APP_ID');
  const appSecret = Deno.env.get('FEISHU_APP_SECRET');
  if (!appId || !appSecret) throw new FeishuRequestError('feishu_auth_failed');
  const response = await feishuFetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const payload = await payloadOf(response);
  if (!response.ok || payload?.code !== 0 || typeof payload.tenant_access_token !== 'string') {
    throw new FeishuRequestError('feishu_auth_failed');
  }
  return payload.tenant_access_token;
}

export async function listFieldNames(token: string, target: FeishuTarget) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${target.appToken}/tables/${target.tableId}/fields?page_size=100`;
  const response = await feishuFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await payloadOf(response);
  const items = payload?.data?.items;
  if (!response.ok || payload?.code !== 0 || !Array.isArray(items)) throw new FeishuRequestError(classify(response, payload));
  return items
    .map((item) => item && typeof item === 'object' ? (item as { field_name?: unknown }).field_name : null)
    .filter((name): name is string => typeof name === 'string');
}

export async function listRecords(token: string, target: FeishuTarget, requestedFields: string[]) {
  const available = await listFieldNames(token, target);
  const fieldNames = requestedFields.filter((name) => available.includes(name));
  if (!fieldNames.length) throw new FeishuRequestError('feishu_field_mismatch', requestedFields);
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${target.appToken}/tables/${target.tableId}/records/search?page_size=500`;
  const response = await feishuFetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({ field_names: fieldNames }),
  });
  const payload = await payloadOf(response);
  if (!response.ok || payload?.code !== 0 || !Array.isArray(payload?.data?.items)) {
    throw new FeishuRequestError(classify(response, payload));
  }
  return payload.data.items as FeishuRecord[];
}

export async function readRecord(token: string, target: FeishuTarget, recordId: string) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${target.appToken}/tables/${target.tableId}/records/${encodeURIComponent(recordId)}`;
  const response = await feishuFetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const payload = await payloadOf(response);
  const record = payload?.data?.record;
  if (!response.ok || payload?.code !== 0 || !record || typeof record !== 'object') {
    throw new FeishuRequestError(classify(response, payload));
  }
  return record as FeishuRecord;
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value as Record<string, unknown>).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = stableValue((value as Record<string, unknown>)[key]);
      return result;
    }, {});
  }
  return value;
}

export async function stableSnapshotHash(input: unknown) {
  const bytes = new TextEncoder().encode(JSON.stringify(stableValue(input)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}
