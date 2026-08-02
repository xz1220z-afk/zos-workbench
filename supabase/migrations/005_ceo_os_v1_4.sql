-- ZOS CEO OS v1.4 private intelligence and cross-domain sync contract.

alter table public.zos_records
  drop constraint if exists zos_records_entity_type_check;

alter table public.zos_records
  add constraint zos_records_entity_type_check
  check (entity_type in (
    'tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets',
    'intelligence', 'calendar', 'life'
  ));

create table if not exists public.zos_intelligence_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  external_id text not null check (char_length(external_id) between 1 and 255),
  title text not null check (char_length(title) between 1 and 500),
  source_name text not null check (char_length(source_name) between 1 and 160),
  source_url text,
  published_at timestamptz,
  captured_at timestamptz not null,
  credibility text not null check (credibility in ('high', 'medium', 'low')),
  score numeric check (score is null or (score >= 0 and score <= 100)),
  relevant_companies text[] not null default '{}',
  tags text[] not null default '{}',
  fact_summary text not null check (char_length(fact_summary) between 1 and 4000),
  impact_analysis text,
  suggested_action text,
  status text not null default 'candidate' check (status in ('candidate', 'read', 'actioned', 'ignored', 'knowledge_pending')),
  source_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, external_id)
);

create index if not exists zos_intelligence_owner_time_idx
  on public.zos_intelligence_items (user_id, published_at desc, score desc);

alter table public.zos_intelligence_items enable row level security;

drop policy if exists "zos owner reads intelligence" on public.zos_intelligence_items;
create policy "zos owner reads intelligence" on public.zos_intelligence_items
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "zos owner inserts intelligence" on public.zos_intelligence_items;
create policy "zos owner inserts intelligence" on public.zos_intelligence_items
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner updates intelligence" on public.zos_intelligence_items;
create policy "zos owner updates intelligence" on public.zos_intelligence_items
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner deletes intelligence" on public.zos_intelligence_items;
create policy "zos owner deletes intelligence" on public.zos_intelligence_items
  for delete to authenticated using ((select auth.uid()) = user_id);

comment on table public.zos_intelligence_items is
  'Private reviewed intelligence summaries. Raw article bodies and credentials are forbidden.';

