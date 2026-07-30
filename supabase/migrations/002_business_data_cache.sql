create table if not exists public.zos_business_cache (
  user_id uuid not null references auth.users(id) on delete cascade,
  source text not null check (source in ('wanjia', 'huahuo', 'brain')),
  payload jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  primary key (user_id, source)
);

alter table public.zos_business_cache enable row level security;

create policy "users read own business cache"
on public.zos_business_cache
for select
using (auth.uid() = user_id);
