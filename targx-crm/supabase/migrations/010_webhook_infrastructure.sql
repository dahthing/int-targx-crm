-- 010_webhook_infrastructure.sql

create extension if not exists pgcrypto with schema extensions;

create table webhook_tokens (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  token        text not null unique default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  owner_id     uuid not null references profiles(id),
  active       boolean not null default true,
  last_used_at timestamptz,
  created_at   timestamptz not null default now()
);

create table webhook_logs (
  id         uuid primary key default gen_random_uuid(),
  token_id   uuid not null references webhook_tokens(id),
  lead_id    uuid references leads(id),
  payload    jsonb not null,
  created_at timestamptz not null default now()
);

alter table webhook_tokens enable row level security;
alter table webhook_logs enable row level security;

create policy "owner_manages_own_tokens"
  on webhook_tokens for all
  using (owner_id = auth.uid() or exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

create policy "admin_sees_all_logs"
  on webhook_logs for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
