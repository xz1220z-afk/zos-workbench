import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const sql = await readFile(new URL('../supabase/migrations/004_ceo_os_v1_3.sql', import.meta.url), 'utf8');

test('v1.3 extends private sync to decisions and confirmed targets', () => {
  assert.match(sql, /drop constraint if exists zos_records_entity_type_check/i);
  assert.match(sql, /'decisions'/i);
  assert.match(sql, /'targets'/i);
});

test('v1.3 tables are private and owner scoped', () => {
  for (const table of ['zos_business_snapshots', 'zos_source_health', 'zos_feishu_approvals', 'zos_audit_events']) {
    assert.match(sql, new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    assert.match(sql, new RegExp(`on public\\.${table}[\\s\\S]*auth\\.uid\\(\\)[\\s\\S]*user_id`, 'i'));
  }
  assert.doesNotMatch(sql, /to anon/i);
});

test('metric snapshots and source health are idempotent per owner and observation', () => {
  assert.match(sql, /unique \(user_id, source, metric_key, captured_on\)/i);
  assert.match(sql, /primary key \(user_id, source\)/i);
});

test('approval rows expire, prevent replay, and retain safe readback evidence', () => {
  assert.match(sql, /snapshot_hash text not null/i);
  assert.match(sql, /expires_at timestamptz not null/i);
  assert.match(sql, /status text not null check \(status in \('previewed', 'executing', 'executed', 'rejected', 'expired', 'failed'\)\)/i);
  assert.match(sql, /unique \(user_id, id, snapshot_hash\)/i);
  assert.match(sql, /readback jsonb/i);
});

test('audit events contain only the documented safe operational columns', () => {
  const audit = sql.match(/create table if not exists public\.zos_audit_events \(([\s\S]*?)\n\);/i)?.[1] || '';
  for (const column of ['event_type', 'source', 'result', 'safe_code', 'duration_ms', 'record_count', 'approval_id', 'client_version', 'created_at']) {
    assert.match(audit, new RegExp(`\\b${column}\\b`, 'i'));
  }
  assert.doesNotMatch(audit, /token|secret|raw_response|body|content|contract_text/i);
});

test('approvals and audit events are mutated only by trusted Edge Functions', () => {
  for (const table of ['zos_feishu_approvals', 'zos_audit_events']) {
    assert.doesNotMatch(
      sql,
      new RegExp(`create policy[^;]+on public\\.${table} for (insert|update|delete)`, 'i'),
      `${table} must not expose client mutation policies`,
    );
  }
  assert.match(sql, /trusted Edge Functions using the service role/i);
});
