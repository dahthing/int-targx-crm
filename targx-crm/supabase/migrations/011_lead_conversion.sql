-- Add pending_conversion fields to leads
alter table leads
  add column if not exists pending_conversion boolean not null default false,
  add column if not exists pending_conversion_note text;

-- Index for dashboard alert query
create index if not exists idx_leads_pending_conversion
  on leads (pending_conversion)
  where pending_conversion = true;
