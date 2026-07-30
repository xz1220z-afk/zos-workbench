-- V1.1: add the 'projects' source to the business data cache so the
-- ZOS Project Center can store a read-only metadata index alongside the
-- existing wanjia / huahuo / brain sources.
--
-- The PWA only ever SELECTs from this table (see src/project-data.mjs),
-- and the cached payload is asserted read_only before it is trusted.

alter table public.zos_business_cache
  drop constraint if exists zos_business_cache_source_check;

alter table public.zos_business_cache
  add constraint zos_business_cache_source_check
  check (source in ('wanjia', 'huahuo', 'brain', 'projects'));

-- Speed up the per-source SELECT used by the read-only cache clients.
create index if not exists zos_business_cache_source_idx
  on public.zos_business_cache (user_id, source);
