-- 007_notifications.sql

create type notification_type as enum (
  'lead_assigned',
  'lead_silence',
  'quote_submitted',
  'quote_returned',
  'quote_approved',
  'quote_accepted',
  'quote_rejected',
  'quote_portal_opened',
  'commission_paid',
  'bonus_reached',
  'bonus_near',
  'project_created'
);

create table notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id),
  type        notification_type not null,
  title       text not null,
  body        text,
  link        text,
  read        boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

alter table notifications enable row level security;

create policy "user_sees_own_notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "system_inserts_notifications"
  on notifications for insert
  with check (true);

create policy "user_updates_own_notifications"
  on notifications for update
  using (user_id = auth.uid());

create index idx_notifications_user_unread
  on notifications(user_id, read, created_at desc)
  where read = false;
