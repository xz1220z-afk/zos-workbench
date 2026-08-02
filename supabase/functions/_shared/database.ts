import { createClient } from 'npm:@supabase/supabase-js@2';

export function createServiceClient() {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceKey) throw new Error('service_not_configured');
  return createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function writeSafeAudit(database: ReturnType<typeof createServiceClient>, event: {
  userId: string;
  eventType: string;
  source?: string | null;
  result: 'success' | 'failed' | 'blocked' | 'previewed';
  safeCode?: string | null;
  durationMs?: number | null;
  recordCount?: number | null;
  approvalId?: string | null;
}) {
  const { error } = await database.from('zos_audit_events').insert({
    user_id: event.userId,
    event_type: event.eventType,
    source: event.source || null,
    result: event.result,
    safe_code: event.safeCode || null,
    duration_ms: Number.isInteger(event.durationMs) ? event.durationMs : null,
    record_count: Number.isInteger(event.recordCount) ? event.recordCount : null,
    approval_id: event.approvalId || null,
    client_version: '1.3.0',
  });
  if (error) throw new Error('audit_write_failed');
}
