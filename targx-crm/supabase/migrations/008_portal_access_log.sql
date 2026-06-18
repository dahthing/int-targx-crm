-- 008_portal_access_log.sql

create table portal_access_log (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id),
  accessed_at timestamptz not null default now(),
  ip_address  text,
  user_agent  text,
  action      text not null check (action in ('open','accept','reject','optional_toggle')),
  metadata    jsonb
);

alter table portal_access_log enable row level security;

create policy "admin_reads_portal_log"
  on portal_access_log for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
