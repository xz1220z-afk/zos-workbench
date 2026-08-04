create table if not exists public.zos_push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  endpoint_hash text not null,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (user_id, endpoint_hash)
);

create table if not exists public.zos_reminder_jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  dedupe_key text not null,
  entity_type text not null,
  entity_id text not null,
  scheduled_at timestamptz not null,
  title text not null,
  body text not null default '',
  privacy text not null default 'work' check (privacy in ('work', 'private')),
  status text not null default 'pending' check (status in ('pending', 'sent', 'skipped')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (user_id, dedupe_key)
);

create table if not exists public.zos_notification_deliveries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reminder_job_id uuid not null references public.zos_reminder_jobs(id) on delete cascade,
  dedupe_key text not null,
  subscription_id uuid references public.zos_push_subscriptions(id) on delete set null,
  state text not null check (state in ('sent', 'failed', 'expired')),
  safe_code text,
  created_at timestamptz not null default now(),
  unique (user_id, dedupe_key)
);

alter table public.zos_push_subscriptions enable row level security;
alter table public.zos_reminder_jobs enable row level security;
alter table public.zos_notification_deliveries enable row level security;

revoke all on public.zos_push_subscriptions from anon, authenticated;
revoke all on public.zos_reminder_jobs from anon, authenticated;
revoke all on public.zos_notification_deliveries from anon, authenticated;

create index if not exists zos_reminder_jobs_due_idx
  on public.zos_reminder_jobs (status, scheduled_at);

create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_zos_reminder_dispatch()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  dispatch_url text;
  dispatch_secret text;
begin
  select decrypted_secret into dispatch_url from vault.decrypted_secrets
  where name = 'zos_reminder_dispatch_url' limit 1;
  select decrypted_secret into dispatch_secret from vault.decrypted_secrets
  where name = 'zos_reminder_dispatch_secret' limit 1;
  if dispatch_url is null or dispatch_secret is null then return; end if;
  perform net.http_post(
    url := dispatch_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-zos-cron-secret', dispatch_secret),
    body := jsonb_build_object('action', 'dispatch', 'requested_at', now()),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.invoke_zos_reminder_dispatch() from public, anon, authenticated;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'zos-reminder-dispatch-1m' limit 1;
  if existing_job is not null then perform cron.unschedule(existing_job); end if;
end;
$$;

select cron.schedule('zos-reminder-dispatch-1m', '* * * * *',
  $job$select public.invoke_zos_reminder_dispatch();$job$);
