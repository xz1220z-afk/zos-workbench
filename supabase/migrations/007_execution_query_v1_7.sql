-- ZOS CEO OS v1.7 private execution entities.
-- All records remain owner-scoped under the existing authenticated RLS contract.

alter table public.zos_records
  drop constraint if exists zos_records_entity_type_check;

alter table public.zos_records
  add constraint zos_records_entity_type_check
  check (entity_type in (
    'tasks', 'inbox', 'projects', 'commands', 'decisions', 'targets',
    'intelligence', 'calendar', 'life', 'focus_sessions', 'countdowns'
  ));

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
  'Private owner-only ZOS v1.7 records including tasks, focus sessions and countdowns.';
