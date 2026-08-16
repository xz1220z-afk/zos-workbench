-- ZOS v2.11 owner-scoped realtime change signals.
-- Realtime is notification-only: clients still perform the authoritative pull/merge.

alter table public.zos_records enable row level security;

-- Include complete old row identity for update/delete notifications. RLS remains
-- authoritative and the browser additionally filters by the authenticated user_id.
alter table public.zos_records replica identity full;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'zos_records'
  ) then
    alter publication supabase_realtime add table public.zos_records;
  end if;
end
$$;
