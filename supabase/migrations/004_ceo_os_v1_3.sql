-- ZOS CEO OS v1.3 private operating data.

alter table public.zos_records
  drop constraint if exists zos_records_entity_type_check;

alter table public.zos_records
  add constraint zos_records_entity_type_check
  check (entity_type in ('tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets'));

create table if not exists public.zos_business_snapshots (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('wanjia', 'huahuo')),
  metric_key text not null check (char_length(metric_key) between 1 and 120),
  metric_value numeric not null,
  source_updated_at timestamptz,
  captured_on date not null,
  contract_version text not null default '1.3',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zos_business_snapshots_owner_metric_day_unique
    unique (user_id, source, metric_key, captured_on)
);

create index if not exists zos_business_snapshots_owner_day_idx
  on public.zos_business_snapshots (user_id, captured_on desc, source);

alter table public.zos_business_snapshots enable row level security;

drop policy if exists "zos owner reads business snapshots" on public.zos_business_snapshots;
create policy "zos owner reads business snapshots"
  on public.zos_business_snapshots for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "zos owner inserts business snapshots" on public.zos_business_snapshots;
create policy "zos owner inserts business snapshots"
  on public.zos_business_snapshots for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner updates business snapshots" on public.zos_business_snapshots;
create policy "zos owner updates business snapshots"
  on public.zos_business_snapshots for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner deletes business snapshots" on public.zos_business_snapshots;
create policy "zos owner deletes business snapshots"
  on public.zos_business_snapshots for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.zos_source_health (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('wanjia', 'huahuo', 'projects', 'brain', 'sync', 'feishu_write')),
  state text not null check (state in ('synced', 'stale', 'pending', 'confirm', 'conflict', 'failed')),
  last_success_at timestamptz,
  last_attempt_at timestamptz,
  record_count integer check (record_count is null or record_count >= 0),
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  contract_version text,
  safe_code text,
  updated_at timestamptz not null default now(),
  primary key (user_id, source)
);

alter table public.zos_source_health enable row level security;

drop policy if exists "zos owner reads source health" on public.zos_source_health;
create policy "zos owner reads source health"
  on public.zos_source_health for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "zos owner inserts source health" on public.zos_source_health;
create policy "zos owner inserts source health"
  on public.zos_source_health for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner updates source health" on public.zos_source_health;
create policy "zos owner updates source health"
  on public.zos_source_health for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner deletes source health" on public.zos_source_health;
create policy "zos owner deletes source health"
  on public.zos_source_health for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.zos_feishu_approvals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('wanjia', 'huahuo')),
  source_record_id text not null check (char_length(source_record_id) between 1 and 255),
  action text not null check (action in ('set_owner', 'set_status', 'set_next_action', 'set_due_date', 'set_review_status')),
  field_name text not null check (char_length(field_name) between 1 and 120),
  before_value jsonb not null,
  after_value jsonb not null,
  snapshot_hash text not null check (char_length(snapshot_hash) = 64),
  status text not null check (status in ('previewed', 'executing', 'executed', 'rejected', 'expired', 'failed')),
  expires_at timestamptz not null,
  executed_at timestamptz,
  safe_code text,
  readback jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint zos_feishu_approvals_owner_id_snapshot_unique
    unique (user_id, id, snapshot_hash)
);

create index if not exists zos_feishu_approvals_owner_status_idx
  on public.zos_feishu_approvals (user_id, status, created_at desc);

alter table public.zos_feishu_approvals enable row level security;

drop policy if exists "zos owner reads feishu approvals" on public.zos_feishu_approvals;
create policy "zos owner reads feishu approvals"
  on public.zos_feishu_approvals for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "zos owner inserts feishu approvals" on public.zos_feishu_approvals;
create policy "zos owner inserts feishu approvals"
  on public.zos_feishu_approvals for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner updates feishu approvals" on public.zos_feishu_approvals;
create policy "zos owner updates feishu approvals"
  on public.zos_feishu_approvals for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner deletes feishu approvals" on public.zos_feishu_approvals;
create policy "zos owner deletes feishu approvals"
  on public.zos_feishu_approvals for delete to authenticated
  using ((select auth.uid()) = user_id);

create table if not exists public.zos_audit_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  source text,
  result text not null check (result in ('success', 'failed', 'blocked', 'previewed')),
  safe_code text,
  duration_ms integer check (duration_ms is null or duration_ms >= 0),
  record_count integer check (record_count is null or record_count >= 0),
  approval_id uuid references public.zos_feishu_approvals(id) on delete set null,
  client_version text,
  created_at timestamptz not null default now()
);

create index if not exists zos_audit_events_owner_created_idx
  on public.zos_audit_events (user_id, created_at desc);

alter table public.zos_audit_events enable row level security;

drop policy if exists "zos owner reads audit events" on public.zos_audit_events;
create policy "zos owner reads audit events"
  on public.zos_audit_events for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "zos owner inserts audit events" on public.zos_audit_events;
create policy "zos owner inserts audit events"
  on public.zos_audit_events for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner deletes old audit events" on public.zos_audit_events;
create policy "zos owner deletes old audit events"
  on public.zos_audit_events for delete to authenticated
  using ((select auth.uid()) = user_id and created_at < now() - interval '90 days');

comment on table public.zos_business_snapshots is 'Private daily aggregate metrics for confirmed CEO targets.';
comment on table public.zos_source_health is 'Private safe source health without upstream response data.';
comment on table public.zos_feishu_approvals is 'Single-use, owner-approved Feishu field changes with readback evidence.';
comment on table public.zos_audit_events is 'Sanitized operational events retained for at most 90 days.';
