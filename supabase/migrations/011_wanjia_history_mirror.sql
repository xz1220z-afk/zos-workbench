-- Sanitised Wanjia history mirror. Raw files and source hashes remain outside
-- the application response contract; this stores only validated read fields.
create table if not exists public.zos_wanjia_history_batches (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  source_sha256 text not null check (source_sha256 ~ '^[0-9a-f]{64}$'),
  source_name text not null,
  business_date date not null,
  row_count integer not null check (row_count >= 0),
  source_kind text not null check (source_kind in ('daily_increment', 'period_snapshot')),
  validation_status text not null check (validation_status in ('validated', 'rejected')),
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  unique (user_id, source_sha256)
);

create table if not exists public.zos_wanjia_history_rows (
  batch_id bigint not null references public.zos_wanjia_history_batches(id) on delete cascade,
  merchant_id text not null,
  merchant_name text,
  industry text,
  owner text,
  cooperation_type text,
  payment_gmv numeric,
  redeemed_gmv numeric,
  refund_gmv numeric,
  video_payment_gmv numeric,
  live_payment_gmv numeric,
  exception boolean not null default false,
  primary key (batch_id, merchant_id)
);

create index if not exists zos_wanjia_history_batches_user_date_idx
  on public.zos_wanjia_history_batches (user_id, business_date desc);

alter table public.zos_wanjia_history_batches enable row level security;
alter table public.zos_wanjia_history_rows enable row level security;

create policy "users read own wanjia history batches"
on public.zos_wanjia_history_batches for select to authenticated using (auth.uid() = user_id);
create policy "users insert own wanjia history batches"
on public.zos_wanjia_history_batches for insert to authenticated with check (auth.uid() = user_id);
create policy "users update own wanjia history batches"
on public.zos_wanjia_history_batches for update to authenticated
using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "users read own wanjia history rows"
on public.zos_wanjia_history_rows for select to authenticated using (exists (
  select 1 from public.zos_wanjia_history_batches batch where batch.id = batch_id and batch.user_id = auth.uid()
));
create policy "users insert own wanjia history rows"
on public.zos_wanjia_history_rows for insert to authenticated with check (exists (
  select 1 from public.zos_wanjia_history_batches batch where batch.id = batch_id and batch.user_id = auth.uid()
));
