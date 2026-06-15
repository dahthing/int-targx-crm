-- TargX CRM — Schema Inicial
-- Migração 001: todas as tabelas por ordem de dependências

-- ─────────────────────────────────────────────
-- ENUMs (antes das tabelas que os usam)
-- ─────────────────────────────────────────────

create type lead_status as enum (
  'nova','contactada','proposta_enviada','negociacao',
  'fechada_ganha','fechada_perdida'
);

create type question_type as enum (
  'single_choice','multi_select','numeric','complexity_scale','risk_indicator','text'
);

create type item_pricing_type as enum ('hourly','fixed');

create type quote_status as enum (
  'rascunho','em_revisao','aprovado_interno','enviado_cliente','aceite','rejeitado'
);

-- ─────────────────────────────────────────────
-- 5.1 profiles
-- ─────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id),
  full_name   text not null,
  email       text not null,
  role        text not null check (role in ('admin','partner','tech')),
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 5.2 global_settings
-- ─────────────────────────────────────────────
create table global_settings (
  key         text primary key,
  value       text not null,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 6.1 clients
-- ─────────────────────────────────────────────
create table clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  nif         text,
  sector      text,
  website     text,
  email       text,
  phone       text,
  address     text,
  notes       text,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 6.2 leads + lead_activities
-- ─────────────────────────────────────────────
create table leads (
  id                uuid primary key default gen_random_uuid(),
  client_id         uuid references clients(id),
  partner_id        uuid not null references profiles(id),
  title             text not null,
  description       text,
  status            lead_status not null default 'nova',
  estimated_value   numeric(12,2),
  lost_reason       text,
  source            text,
  next_action       text,
  next_action_date  date,
  last_activity_at  timestamptz,
  silence_alerted   boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table lead_activities (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references leads(id) on delete cascade,
  author_id   uuid not null references profiles(id),
  type        text not null check (type in ('nota','chamada','reuniao','email','proposta')),
  content     text not null,
  activity_at timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 6.3 partner_targets
-- ─────────────────────────────────────────────
create table partner_targets (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references profiles(id),
  year          int not null,
  quarter       int not null check (quarter between 1 and 4),
  target_volume numeric(12,2) not null,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  constraint unique_target unique (partner_id, year, quarter)
);

-- ─────────────────────────────────────────────
-- 7.1 project_types
-- ─────────────────────────────────────────────
create table project_types (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  description   text,
  icon          text,
  base_hours    numeric(8,2) not null default 0,
  base_price    numeric(10,2) not null default 0,
  minimum_price numeric(10,2) not null default 1000,
  active        boolean not null default true,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 7.2 scoping_questions
-- ─────────────────────────────────────────────
create table scoping_questions (
  id                uuid primary key default gen_random_uuid(),
  project_type_id   uuid not null references project_types(id),
  key               text not null,
  label             text not null,
  description       text,
  question_type     question_type not null,
  options           jsonb,
  impacts_price     boolean not null default true,
  activates_modules jsonb,
  triggers_risk     jsonb,
  sort_order        int not null default 0,
  required          boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint unique_question_key unique (project_type_id, key)
);

-- ─────────────────────────────────────────────
-- 7.3 rate_profiles
-- ─────────────────────────────────────────────
create table rate_profiles (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  hourly_rate numeric(8,2) not null,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 7.4 catalog_items
-- ─────────────────────────────────────────────
create table catalog_items (
  id                       uuid primary key default gen_random_uuid(),
  slug                     text unique,
  name                     text not null,
  description              text,
  category                 text,
  pricing_type             item_pricing_type not null,
  default_hours            numeric(8,2),
  default_rate_profile_id  uuid references rate_profiles(id),
  default_value            numeric(10,2),
  applicable_project_types jsonb,
  out_of_scope_notes       text,
  risk_flags               jsonb,
  active                   boolean not null default true,
  usage_count              int not null default 0,
  created_by               uuid references profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 7.5 quote_templates
-- ─────────────────────────────────────────────
create table quote_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  project_type_id uuid references project_types(id),
  phases_data     jsonb not null,
  usage_count     int not null default 0,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 7.6 risk_multipliers
-- ─────────────────────────────────────────────
create table risk_multipliers (
  id          uuid primary key default gen_random_uuid(),
  key         text not null unique,
  name        text not null,
  description text,
  category    text not null check (category in ('tecnico','timeline','cliente','scope')),
  multiplier  numeric(5,3) not null check (multiplier >= 1.0),
  is_blocking boolean not null default false,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 8.1 quotes
-- ─────────────────────────────────────────────
create table quotes (
  id                    uuid primary key default gen_random_uuid(),
  lead_id               uuid references leads(id),
  client_id             uuid not null references clients(id),
  partner_id            uuid not null references profiles(id),
  project_type_id       uuid references project_types(id),
  template_id           uuid references quote_templates(id),
  title                 text not null,
  description           text,
  status                quote_status not null default 'rascunho',
  version               int not null default 1,
  parent_quote_id       uuid references quotes(id),

  -- Scoping
  scoping_answers       jsonb,
  scoping_completed     boolean not null default false,

  -- Risco
  detected_risks        jsonb,
  risk_multiplier_total numeric(6,3) not null default 1.0,
  has_blocking_risk     boolean not null default false,
  admin_risk_override   boolean not null default false,
  admin_risk_notes      text,

  -- Financeiro
  subtotal_base         numeric(12,2),
  risk_adjustment       numeric(12,2),
  subtotal_with_risk    numeric(12,2),
  discount_pct          numeric(5,2) not null default 0,
  discount_reason       text,
  discount_amount       numeric(12,2),
  total_before_tax      numeric(12,2),
  total_with_tax        numeric(12,2),
  minimum_margin_pct    numeric(5,2),
  calculated_margin_pct numeric(5,2),

  -- Proposta
  payment_terms         text,
  valid_until           date,
  internal_notes        text,
  rejection_reason      text,
  client_accept_token   text unique,
  token_expires_at      timestamptz,
  pdf_url               text,

  -- Portal tracking
  portal_opened_at      timestamptz,
  portal_open_count     int not null default 0,

  -- Gantt
  gantt_start_date      date,
  gantt_data            jsonb,

  sent_at               timestamptz,
  accepted_at           timestamptz,
  rejected_at           timestamptz,
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 8.2 quote_audit_log
-- ─────────────────────────────────────────────
create table quote_audit_log (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  changed_by  uuid not null references profiles(id),
  field       text not null,
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 8.3 quote_phases
-- ─────────────────────────────────────────────
create table quote_phases (
  id            uuid primary key default gen_random_uuid(),
  quote_id      uuid not null references quotes(id) on delete cascade,
  name          text not null,
  description   text,
  phase_order   int not null,
  duration_days int,
  created_at    timestamptz not null default now(),
  constraint unique_phase_order unique (quote_id, phase_order)
);

-- ─────────────────────────────────────────────
-- 8.4 quote_items
-- ─────────────────────────────────────────────
create table quote_items (
  id                uuid primary key default gen_random_uuid(),
  phase_id          uuid not null references quote_phases(id) on delete cascade,
  catalog_item_id   uuid references catalog_items(id),
  name              text not null,
  description       text,
  pricing_type      item_pricing_type not null,
  hours             numeric(8,2),
  rate_profile_id   uuid references rate_profiles(id),
  hourly_rate       numeric(8,2),
  unit_value        numeric(10,2),
  quantity          numeric(8,2) not null default 1,
  item_order        int not null,
  optional          boolean not null default false,
  optional_accepted boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint unique_item_order unique (phase_id, item_order)
);

-- ─────────────────────────────────────────────
-- 8.5 quote_status_history
-- ─────────────────────────────────────────────
create table quote_status_history (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  from_status quote_status,
  to_status   quote_status not null,
  changed_by  uuid references profiles(id),
  notes       text,
  changed_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 9.1 projects
-- ─────────────────────────────────────────────
create table projects (
  id              uuid primary key default gen_random_uuid(),
  quote_id        uuid references quotes(id),
  lead_id         uuid references leads(id),
  client_id       uuid not null references clients(id),
  partner_id      uuid references profiles(id),
  title           text not null,
  description     text,
  contract_value  numeric(12,2) not null,
  contract_date   date not null,
  status          text not null default 'em_curso'
                  check (status in ('em_curso','concluido','cancelado')),
  estimated_hours numeric(8,2),
  actual_hours    numeric(8,2),
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 9.2 project_tranches
-- ─────────────────────────────────────────────
create table project_tranches (
  id              uuid primary key default gen_random_uuid(),
  project_id      uuid not null references projects(id) on delete cascade,
  description     text not null,
  amount          numeric(12,2) not null,
  due_date        date,
  received        boolean not null default false,
  received_date   date,
  commission_paid boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 9.3 project_hours_log
-- ─────────────────────────────────────────────
create table project_hours_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  logged_by   uuid not null references profiles(id),
  hours       numeric(6,2) not null,
  description text,
  logged_at   date not null default current_date,
  created_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 10.1 commission_plans / tiers / bonuses
-- ─────────────────────────────────────────────
create table commission_plans (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table commission_tiers (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references commission_plans(id),
  tier_order   int not null,
  volume_from  numeric(12,2) not null,
  volume_to    numeric(12,2),
  rate_percent numeric(5,2) not null,
  label        text,
  constraint unique_tier_order unique (plan_id, tier_order)
);

create table commission_bonuses (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references commission_plans(id),
  threshold    numeric(12,2) not null,
  bonus_amount numeric(12,2) not null,
  description  text
);

-- ─────────────────────────────────────────────
-- 10.2 partner_plans
-- ─────────────────────────────────────────────
create table partner_plans (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references profiles(id),
  plan_id     uuid not null references commission_plans(id),
  active_from date not null,
  active_to   date,
  constraint unique_active_plan unique (partner_id, active_from)
);

-- ─────────────────────────────────────────────
-- 10.3 commissions
-- ─────────────────────────────────────────────
create table commissions (
  id                uuid primary key default gen_random_uuid(),
  tranche_id        uuid not null references project_tranches(id),
  partner_id        uuid not null references profiles(id),
  project_id        uuid not null references projects(id),
  year              int not null,
  tranche_amount    numeric(12,2) not null,
  rate_percent      numeric(5,2) not null,
  commission_amount numeric(12,2) not null,
  tier_label        text,
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 10.4 annual_bonuses
-- ─────────────────────────────────────────────
create table annual_bonuses (
  id           uuid primary key default gen_random_uuid(),
  partner_id   uuid not null references profiles(id),
  year         int not null,
  volume_total numeric(12,2) not null,
  threshold    numeric(12,2) not null,
  bonus_amount numeric(12,2) not null,
  paid         boolean not null default false,
  paid_date    date,
  created_at   timestamptz not null default now(),
  constraint unique_bonus unique (partner_id, year, threshold)
);

-- ─────────────────────────────────────────────
-- 10.5 annual_snapshots
-- ─────────────────────────────────────────────
create table annual_snapshots (
  id               uuid primary key default gen_random_uuid(),
  partner_id       uuid not null references profiles(id),
  year             int not null,
  volume_total     numeric(12,2) not null,
  commission_total numeric(12,2) not null,
  bonuses_total    numeric(12,2) not null,
  projects_count   int not null default 0,
  created_at       timestamptz not null default now(),
  constraint unique_snapshot unique (partner_id, year)
);

-- ─────────────────────────────────────────────
-- 11.1 objection_playbook
-- ─────────────────────────────────────────────
create table objection_playbook (
  id          uuid primary key default gen_random_uuid(),
  category    text not null check (category in ('preco','prazo','tecnologia','concorrencia','outro')),
  objection   text not null,
  response    text not null,
  context     text,
  tags        text[],
  active      boolean not null default true,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ─────────────────────────────────────────────
-- 12.1 email_logs
-- ─────────────────────────────────────────────
create table email_logs (
  id         uuid primary key default gen_random_uuid(),
  recipient  text not null,
  type       text not null,
  subject    text not null,
  event_key  text unique,
  sent_at    timestamptz not null default now(),
  resend_id  text,
  error      text
);

-- ─────────────────────────────────────────────
-- Trigger: actualiza updated_at automaticamente
-- ─────────────────────────────────────────────
create or replace function fn_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_clients_updated_at
  before update on clients
  for each row execute function fn_set_updated_at();

create trigger trg_leads_updated_at
  before update on leads
  for each row execute function fn_set_updated_at();

create trigger trg_catalog_items_updated_at
  before update on catalog_items
  for each row execute function fn_set_updated_at();

create trigger trg_quote_templates_updated_at
  before update on quote_templates
  for each row execute function fn_set_updated_at();

create trigger trg_quotes_updated_at
  before update on quotes
  for each row execute function fn_set_updated_at();

create trigger trg_quote_items_updated_at
  before update on quote_items
  for each row execute function fn_set_updated_at();

create trigger trg_projects_updated_at
  before update on projects
  for each row execute function fn_set_updated_at();

create trigger trg_project_tranches_updated_at
  before update on project_tranches
  for each row execute function fn_set_updated_at();

create trigger trg_objection_playbook_updated_at
  before update on objection_playbook
  for each row execute function fn_set_updated_at();
