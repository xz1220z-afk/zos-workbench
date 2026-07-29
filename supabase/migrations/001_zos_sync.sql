-- ZOS single-owner sync foundation
-- Apply in the Supabase SQL Editor for the `zos-workbench` project.
-- This migration deliberately creates no service-role access and no public data.

create table if not exists public.zos_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  entity_type text not null check (entity_type in ('tasks', 'inbox', 'projects', 'commands')),
  record_id text not null check (char_length(record_id) between 1 and 255),
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  revision integer not null default 1 check (revision > 0),
  device_id text not null check (char_length(device_id) between 1 and 255),
  constraint zos_records_owner_entity_record_unique unique (user_id, entity_type, record_id)
);

create index if not exists zos_records_owner_updated_idx
  on public.zos_records (user_id, updated_at desc);

create index if not exists zos_records_owner_entity_updated_idx
  on public.zos_records (user_id, entity_type, updated_at desc);

alter table public.zos_records enable row level security;

drop policy if exists "zos owner can read own records" on public.zos_records;
create policy "zos owner can read own records"
  on public.zos_records for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "zos owner can insert own records" on public.zos_records;
create policy "zos owner can insert own records"
  on public.zos_records for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner can update own records" on public.zos_records;
create policy "zos owner can update own records"
  on public.zos_records for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "zos owner can delete own records" on public.zos_records;
create policy "zos owner can delete own records"
  on public.zos_records for delete to authenticated
  using ((select auth.uid()) = user_id);

comment on table public.zos_records is
  'Private, single-owner ZOS record sync. Soft deletions are retained as tombstones.';
