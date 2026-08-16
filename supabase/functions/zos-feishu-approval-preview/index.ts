import { AuthError, requireOwnerUser } from '../_shared/auth.ts';
import { createServiceClient, writeSafeAudit } from '../_shared/database.ts';
import {
  FEISHU_TARGETS,
  getTenantAccessToken,
  listFieldNames,
  readRecord,
  safeFeishuCode,
  stableSnapshotHash,
} from '../_shared/feishu.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json; charset=utf-8',
};

const REQUEST_KEYS = new Set(['source', 'recordId', 'action', 'value']);
const SOURCE_ACTION_FIELDS = {
  wanjia: {
    set_owner: ['跟进人'],
    set_status: ['合作状态', '当前阶段'],
    set_next_action: ['下一步动作'],
    set_due_date: ['下次跟进日期'],
    set_review_status: ['审核状态'],
  },
  huahuo: {
    set_owner: ['项目负责人', '负责人'],
    set_status: ['项目状态'],
    set_next_action: ['下一步动作'],
    set_due_date: ['计划交付日期'],
    set_review_status: ['客户确认状态', '审核状态'],
  },
} as const;

type Source = keyof typeof SOURCE_ACTION_FIELDS;
type Action = keyof typeof SOURCE_ACTION_FIELDS.wanjia;
type Proposal = { source: Source; recordId: string; action: Action; value: string };

function response(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: CORS_HEADERS });
}

function validProposal(body: unknown): body is Proposal {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  if (Object.keys(body).some((key) => !REQUEST_KEYS.has(key))) return false;
  const proposal = body as Record<string, unknown>;
  return Object.keys(body).length === REQUEST_KEYS.size
    && ['wanjia', 'huahuo'].includes(String(proposal.source))
    && Object.hasOwn(SOURCE_ACTION_FIELDS.wanjia, String(proposal.action))
    && typeof proposal.recordId === 'string' && proposal.recordId.length > 0 && proposal.recordId.length <= 255
    && typeof proposal.value === 'string' && proposal.value.trim().length > 0 && proposal.value.length <= 500;
}

function targetFor(source: Source) {
  return source === 'wanjia' ? FEISHU_TARGETS.wanjia.merchant : FEISHU_TARGETS.huahuo.project;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST') return response({ error: 'method_not_allowed' }, 405);

  let user;
  try {
    ({ user } = await requireOwnerUser(req));
  } catch (error) {
    if (error instanceof AuthError && error.code === 'authentication_required') {
      return response({ error: 'authentication_required' }, 401);
    }
    if (error instanceof AuthError) return response({ error: error.code }, error.status);
    return response({ error: 'authentication_invalid' }, 401);
  }

  let body: unknown;
  try { body = await req.json(); } catch { return response({ error: 'invalid_request' }, 400); }
  if (!validProposal(body)) return response({ error: 'invalid_request' }, 400);

  const startedAt = Date.now();
  const proposal = body;
  const target = targetFor(proposal.source);
  const candidates = SOURCE_ACTION_FIELDS[proposal.source][proposal.action];
  const database = createServiceClient();

  try {
    const token = await getTenantAccessToken();
    const availableFields = await listFieldNames(token, target);
    const fieldName = candidates.find((candidate) => availableFields.includes(candidate));
    if (!fieldName) return response({ error: 'field_unavailable' }, 422);

    const record = await readRecord(token, target, proposal.recordId);
    const before = record.fields?.[fieldName] ?? null;
    const after = proposal.value.trim();
    const sourceUpdatedAt = record.last_modified_time || null;
    const snapshotHash = await stableSnapshotHash({
      source: proposal.source,
      recordId: proposal.recordId,
      fieldName,
      before,
      sourceUpdatedAt,
    });
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const { data, error } = await database.from('zos_feishu_approvals').insert({
      user_id: user.id,
      source: proposal.source,
      source_record_id: proposal.recordId,
      action: proposal.action,
      field_name: fieldName,
      before_value: before,
      after_value: after,
      snapshot_hash: snapshotHash,
      status: 'previewed',
      expires_at: expiresAt,
    }).select('id').single();
    if (error || !data?.id) throw new Error('approval_store_failed');

    await writeSafeAudit(database, {
      userId: user.id,
      eventType: 'feishu_approval_preview',
      source: proposal.source,
      result: 'previewed',
      durationMs: Date.now() - startedAt,
      approvalId: data.id,
    });
    return response({
      approvalId: data.id,
      source: proposal.source,
      recordId: proposal.recordId,
      action: proposal.action,
      fieldName,
      before,
      after,
      snapshotHash,
      expiresAt,
      status: 'previewed',
    });
  } catch (error) {
    const safeCode = safeFeishuCode(error);
    try {
      await writeSafeAudit(database, {
        userId: user.id,
        eventType: 'feishu_approval_preview',
        source: proposal.source,
        result: 'failed',
        safeCode,
        durationMs: Date.now() - startedAt,
      });
    } catch { /* Keep the client response safe even if monitoring is unavailable. */ }
    return response({ error: 'preview_failed', safeCode }, 502);
  }
});
