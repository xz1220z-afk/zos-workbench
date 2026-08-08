-- User-authorized, short knowledge excerpts only. This table never stores a Vault mirror.
create table if not exists public.zos_knowledge_context (
  user_id uuid not null references auth.users(id) on delete cascade,
  chunk_id text not null check (char_length(chunk_id) <= 160),
  title text not null check (char_length(title) <= 180),
  source_ref text not null check (char_length(source_ref) <= 280),
  scope text not null default 'general' check (scope in ('general', 'work', 'life', 'learning')),
  tags jsonb not null default '[]'::jsonb,
  excerpt text not null check (char_length(excerpt) <= 1400),
  content_hash text not null check (char_length(content_hash) <= 160),
  updated_at timestamptz,
  imported_at timestamptz not null default now(),
  enabled boolean not null default true,
  primary key (user_id, chunk_id)
);

alter table public.zos_knowledge_context enable row level security;

drop policy if exists "zos_knowledge_context_owner_select" on public.zos_knowledge_context;
create policy "zos_knowledge_context_owner_select" on public.zos_knowledge_context for select using (auth.uid() = user_id);
drop policy if exists "zos_knowledge_context_owner_insert" on public.zos_knowledge_context;
create policy "zos_knowledge_context_owner_insert" on public.zos_knowledge_context for insert with check (auth.uid() = user_id);
drop policy if exists "zos_knowledge_context_owner_update" on public.zos_knowledge_context;
create policy "zos_knowledge_context_owner_update" on public.zos_knowledge_context for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "zos_knowledge_context_owner_delete" on public.zos_knowledge_context;
create policy "zos_knowledge_context_owner_delete" on public.zos_knowledge_context for delete using (auth.uid() = user_id);

create index if not exists zos_knowledge_context_owner_scope_updated_idx
  on public.zos_knowledge_context (user_id, scope, updated_at desc);
