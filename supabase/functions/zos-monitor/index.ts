import { AuthError, requireUser } from '../_shared/auth.ts';
import { createServiceClient, writeSafeAudit } from '../_shared/database.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};
const REQUEST_KEYS = new Set([
  'eventType', 'source', 'result', 'safeCode', 'durationMs', 'recordCount', 'approvalId', 'clientVersion',
]);
const ALLOWED_RESULTS = new Set(['success', 'failed', 'blocked', 'previewed']);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function safeText(value: unknown, maxLength: number) {
  if (value == null) return null;
  if (typeof value !== 'string') return null;
  const text = value.trim();
  return text && text.length <= maxLength ? text : null;
}

function safeInteger(value: unknown) {
  return Number.isInteger(value) && Number(value) >= 0 ? Number(value) : null;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  let user;
  try { ({ user } = await requireUser(req)); }
  catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_required' }, 401);
  }

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return response({ error: 'invalid_request' }, 400); }
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some((key) => !REQUEST_KEYS.has(key))) {
    return response({ error: 'invalid_request' }, 400);
  }

  const eventType = safeText(body.eventType, 80);
  if (!eventType) return response({ error: 'invalid_request' }, 400);
  const result = ALLOWED_RESULTS.has(String(body.result)) ? String(body.result) : 'failed';
  const database = createServiceClient();
  try {
    await writeSafeAudit(database, {
      userId: user.id,
      eventType,
      source: safeText(body.source, 40),
      result: result as 'success' | 'failed' | 'blocked' | 'previewed',
      safeCode: safeText(body.safeCode, 80),
      durationMs: safeInteger(body.durationMs),
      recordCount: safeInteger(body.recordCount),
      approvalId: safeText(body.approvalId, 64),
    });
    return response({ status: 'recorded' }, 201);
  } catch {
    return response({ error: 'monitoring_unavailable' }, 503);
  }
});
