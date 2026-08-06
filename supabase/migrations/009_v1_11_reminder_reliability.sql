alter table public.zos_push_subscriptions
  add column if not exists last_test_at timestamptz;

create or replace function public.replace_zos_reminder_schedule(p_user_id uuid, p_jobs jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_count integer := jsonb_array_length(coalesce(p_jobs, '[]'::jsonb));
begin
  if p_user_id is null or jsonb_typeof(coalesce(p_jobs, '[]'::jsonb)) <> 'array' then
    raise exception 'schedule_invalid';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));

  update public.zos_reminder_jobs
    set status = 'skipped'
    where user_id = p_user_id and status = 'pending';

  insert into public.zos_reminder_jobs (
    user_id, dedupe_key, entity_type, entity_id, scheduled_at,
    title, body, privacy, status
  )
  select
    p_user_id, job.dedupe_key, job.entity_type, job.entity_id, job.scheduled_at,
    job.title, job.body, job.privacy, 'pending'
  from jsonb_to_recordset(coalesce(p_jobs, '[]'::jsonb)) as job(
    dedupe_key text, entity_type text, entity_id text, scheduled_at timestamptz,
    title text, body text, privacy text, status text
  )
  on conflict (user_id, dedupe_key) do update set
    entity_type = excluded.entity_type,
    entity_id = excluded.entity_id,
    scheduled_at = excluded.scheduled_at,
    title = excluded.title,
    body = excluded.body,
    privacy = excluded.privacy,
    status = 'pending',
    sent_at = null;

  return requested_count;
end;
$$;

create or replace function public.claim_zos_reminder_test(p_user_id uuid, p_subscription_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed_id uuid;
begin
  update public.zos_push_subscriptions
    set last_test_at = now()
    where id = p_subscription_id
      and user_id = p_user_id
      and enabled = true
      and (last_test_at is null or last_test_at <= now() - interval '60 seconds')
    returning id into claimed_id;
  return claimed_id is not null;
end;
$$;

revoke all on function public.replace_zos_reminder_schedule(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.claim_zos_reminder_test(uuid, uuid) from public, anon, authenticated;
grant execute on function public.replace_zos_reminder_schedule(uuid, jsonb) to service_role;
grant execute on function public.claim_zos_reminder_test(uuid, uuid) to service_role;
