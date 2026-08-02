create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

create or replace function public.invoke_zos_business_refresh()
returns void
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  refresh_url text;
  refresh_secret text;
begin
  select decrypted_secret into refresh_url
  from vault.decrypted_secrets
  where name = 'zos_business_refresh_url'
  limit 1;

  select decrypted_secret into refresh_secret
  from vault.decrypted_secrets
  where name = 'zos_business_refresh_secret'
  limit 1;

  if refresh_url is null or refresh_secret is null then
    return;
  end if;

  perform net.http_post(
    url := refresh_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-zos-cron-secret', refresh_secret
    ),
    body := jsonb_build_object('trigger', 'pg_cron', 'requested_at', now()),
    timeout_milliseconds := 60000
  );
end;
$$;

revoke all on function public.invoke_zos_business_refresh() from public, anon, authenticated;

do $$
declare
  existing_job bigint;
begin
  select jobid into existing_job from cron.job where jobname = 'zos-business-refresh-15m' limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end;
$$;

select cron.schedule(
  'zos-business-refresh-15m',
  '*/15 * * * *',
  $job$select public.invoke_zos_business_refresh();$job$
);
