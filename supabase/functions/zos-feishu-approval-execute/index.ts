import { executeApproval } from '../_shared/approval-execution.mjs';
import { AuthError, requireOwnerUser } from '../_shared/auth.ts';
import { createServiceClient, writeSafeAudit } from '../_shared/database.ts';
import {
  FEISHU_TARGETS,
  getTenantAccessToken,
  listFieldNames,
  readRecord,
  stableSnapshotHash,
  updateRecord,
} from '../_shared/feishu.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};
const REQUEST_KEYS = new Set(['approvalId']);
const SAFE_CODES = new Set([
  'approval_expired',
  'approval_already_used',
  'source_changed',
  'field_unavailable',
  'feishu_write_failed',
  'feishu_readback_failed',
]);

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function validRequest(body: unknown): body is { approvalId: string } {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Object.keys(body).some((key) => !REQUEST_KEYS.has(key))) return false;
  const approvalId = (body as Record<string, unknown>).approvalId;
  return Object.keys(body).length === 1 && typeof approvalId === 'string' && /^[0-9a-f-]{36}$/i.test(approvalId);
}

function targetFor(source: string) {
  if (source === 'wanjia') return FEISHU_TARGETS.wanjia.merchant;
  if (source === 'huahuo') return FEISHU_TARGETS.huahuo.project;
  return null;
}

async function markFailed(database: ReturnType<typeof createServiceClient>, approvalId: string, safeCode: string) {
  await database.from('zos_feishu_approvals').update({
    status: safeCode === 'approval_expired' ? 'expired' : 'failed',
    safe_code: safeCode,
    updated_at: new Date().toISOString(),
  }).eq('id', approvalId).eq('status', 'executing');
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  let user;
  try { ({ user } = await requireOwnerUser(req)); }
  catch (error) {
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_required' }, 401);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return response({ error: 'invalid_request' }, 400); }
  if (!validRequest(body)) return response({ error: 'invalid_request' }, 400);

  const database = createServiceClient();
  const startedAt = Date.now();
  const claimedAt = new Date().toISOString();
  const { data: approval, error: claimError } = await database
    .from('zos_feishu_approvals')
    .update({ status: 'executing', updated_at: claimedAt })
    .eq('id', body.approvalId)
    .eq('user_id', user.id)
    .eq('status', 'previewed')
    .gt('expires_at', new Date().toISOString())
    .select('id,user_id,source,source_record_id,action,field_name,before_value,after_value,snapshot_hash,expires_at,status')
    .maybeSingle();

  if (claimError || !approval) {
    const { data: existing } = await database.from('zos_feishu_approvals')
      .select('status,expires_at').eq('id', body.approvalId).eq('user_id', user.id).maybeSingle();
    const safeCode = existing?.expires_at && new Date(existing.expires_at).getTime() <= Date.now()
      ? 'approval_expired'
      : 'approval_already_used';
    return response({ error: 'approval_not_executable', safeCode }, 409);
  }

  const target = targetFor(approval.source);
  if (!target) {
    await markFailed(database, approval.id, 'field_unavailable');
    return response({ error: 'execute_failed', safeCode: 'field_unavailable' }, 422);
  }

  let outcome;
  try {
    const token = await getTenantAccessToken();
    const availableFields = await listFieldNames(token, target);
    if (!availableFields.includes(approval.field_name)) {
      outcome = { status: 'failed', verified: false, safeCode: 'field_unavailable' };
    } else {
      const currentRecord = await readRecord(token, target, approval.source_record_id);
      outcome = await executeApproval({
        approval: {
          fieldName: approval.field_name,
          before: approval.before_value,
          after: approval.after_value,
          snapshotHash: approval.snapshot_hash,
        },
        currentRecord: { fields: currentRecord.fields, sourceUpdatedAt: currentRecord.last_modified_time || null },
        computeSnapshotHash: async () => stableSnapshotHash({
          source: approval.source,
          recordId: approval.source_record_id,
          fieldName: approval.field_name,
          before: currentRecord.fields?.[approval.field_name] ?? null,
          sourceUpdatedAt: currentRecord.last_modified_time || null,
        }),
        updateRecord: (_fieldName: string, value: unknown) => updateRecord(
          token, target, approval.source_record_id, approval.field_name, value,
        ),
        readRecord: () => readRecord(token, target, approval.source_record_id),
      });
    }
  } catch {
    outcome = { status: 'failed', verified: false, safeCode: 'feishu_write_failed' };
  }

  if (!outcome.verified) {
    const safeCode = SAFE_CODES.has(outcome.safeCode) ? outcome.safeCode : 'feishu_write_failed';
    await markFailed(database, approval.id, safeCode);
    try {
      await writeSafeAudit(database, {
        userId: user.id, eventType: 'feishu_approval_execute', source: approval.source,
        result: 'failed', safeCode, durationMs: Date.now() - startedAt, approvalId: approval.id,
      });
    } catch { /* Execution result stays safe even if audit storage is unavailable. */ }
    return response({ error: 'execute_failed', safeCode, verified: false }, safeCode === 'source_changed' ? 409 : 502);
  }

  const executedAt = new Date().toISOString();
  const { error: finishError } = await database.from('zos_feishu_approvals').update({
    status: 'executed',
    executed_at: executedAt,
    updated_at: executedAt,
    safe_code: null,
    readback: outcome.readback,
  }).eq('id', approval.id).eq('user_id', user.id).eq('status', 'executing');
  if (finishError) return response({ error: 'execute_failed', safeCode: 'feishu_readback_failed', verified: false }, 502);

  await writeSafeAudit(database, {
    userId: user.id, eventType: 'feishu_approval_execute', source: approval.source,
    result: 'success', durationMs: Date.now() - startedAt, approvalId: approval.id,
  });
  return response({
    approvalId: approval.id,
    status: 'executed',
    fieldName: approval.field_name,
    before: approval.before_value,
    after: approval.after_value,
    verified: true,
    executedAt,
  });
});
