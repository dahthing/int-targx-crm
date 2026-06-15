-- TargX CRM — Row Level Security
-- Políticas conforme PRD secção 32

-- Helper: verifica o papel do utilizador actual
create or replace function auth_role()
returns text language sql stable as $$
  select role from profiles where id = auth.uid()
$$;

-- ─────────────────────────────────────────────
-- profiles
-- ─────────────────────────────────────────────
alter table profiles enable row level security;

create policy "profiles: utilizador vê o seu próprio perfil"
  on profiles for select using (id = auth.uid());

create policy "profiles: admin vê todos"
  on profiles for select using (auth_role() = 'admin');

create policy "profiles: admin actualiza qualquer perfil"
  on profiles for update using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- global_settings
-- ─────────────────────────────────────────────
alter table global_settings enable row level security;

create policy "global_settings: leitura autenticada"
  on global_settings for select using (auth.role() = 'authenticated');

create policy "global_settings: escrita apenas admin"
  on global_settings for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- clients
-- ─────────────────────────────────────────────
alter table clients enable row level security;

create policy "clients: todos os autenticados vêem"
  on clients for select using (auth.role() = 'authenticated');

create policy "clients: partner e admin criam"
  on clients for insert with check (auth_role() in ('admin','partner'));

create policy "clients: admin actualiza"
  on clients for update using (auth_role() in ('admin','partner'));

-- ─────────────────────────────────────────────
-- leads
-- ─────────────────────────────────────────────
alter table leads enable row level security;

create policy "leads: partner vê as suas"
  on leads for select using (
    partner_id = auth.uid() or auth_role() in ('admin','tech')
  );

create policy "leads: partner e admin criam"
  on leads for insert with check (
    auth_role() in ('admin','partner')
  );

create policy "leads: partner actualiza as suas; admin todas"
  on leads for update using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

-- ─────────────────────────────────────────────
-- lead_activities
-- ─────────────────────────────────────────────
alter table lead_activities enable row level security;

create policy "lead_activities: acesso via lead"
  on lead_activities for select using (
    exists (
      select 1 from leads
      where leads.id = lead_activities.lead_id
        and (leads.partner_id = auth.uid() or auth_role() in ('admin','tech'))
    )
  );

create policy "lead_activities: inserir se tem acesso à lead"
  on lead_activities for insert with check (
    exists (
      select 1 from leads
      where leads.id = lead_activities.lead_id
        and (leads.partner_id = auth.uid() or auth_role() in ('admin','tech'))
    )
  );

-- ─────────────────────────────────────────────
-- partner_targets
-- ─────────────────────────────────────────────
alter table partner_targets enable row level security;

create policy "partner_targets: partner vê as suas"
  on partner_targets for select using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

create policy "partner_targets: admin cria e actualiza"
  on partner_targets for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- project_types, scoping_questions, rate_profiles,
-- catalog_items, quote_templates, risk_multipliers
-- — leitura autenticada, escrita apenas admin
-- ─────────────────────────────────────────────
alter table project_types       enable row level security;
alter table scoping_questions   enable row level security;
alter table rate_profiles       enable row level security;
alter table catalog_items       enable row level security;
alter table quote_templates     enable row level security;
alter table risk_multipliers    enable row level security;

create policy "project_types: leitura autenticada"
  on project_types for select using (auth.role() = 'authenticated');
create policy "project_types: escrita admin"
  on project_types for all using (auth_role() = 'admin');

create policy "scoping_questions: leitura autenticada"
  on scoping_questions for select using (auth.role() = 'authenticated');
create policy "scoping_questions: escrita admin"
  on scoping_questions for all using (auth_role() = 'admin');

create policy "rate_profiles: leitura autenticada"
  on rate_profiles for select using (auth.role() = 'authenticated');
create policy "rate_profiles: escrita admin"
  on rate_profiles for all using (auth_role() = 'admin');

create policy "catalog_items: leitura autenticada"
  on catalog_items for select using (auth.role() = 'authenticated');
create policy "catalog_items: escrita admin e partner"
  on catalog_items for all using (auth_role() in ('admin','partner'));

create policy "quote_templates: leitura autenticada"
  on quote_templates for select using (auth.role() = 'authenticated');
create policy "quote_templates: escrita admin e partner"
  on quote_templates for all using (auth_role() in ('admin','partner'));

create policy "risk_multipliers: leitura autenticada"
  on risk_multipliers for select using (auth.role() = 'authenticated');
create policy "risk_multipliers: escrita admin"
  on risk_multipliers for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- quotes
-- ─────────────────────────────────────────────
alter table quotes enable row level security;

create policy "quotes: partner vê as suas"
  on quotes for select using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

create policy "quotes: partner e admin criam"
  on quotes for insert with check (
    auth_role() in ('admin','partner')
  );

create policy "quotes: partner actualiza as suas (se rascunho/em_revisao); admin tudo"
  on quotes for update using (
    auth_role() = 'admin'
    or (partner_id = auth.uid() and status in ('rascunho','em_revisao'))
  );

-- ─────────────────────────────────────────────
-- quote_audit_log — insert via trigger apenas
-- ─────────────────────────────────────────────
alter table quote_audit_log enable row level security;

create policy "quote_audit_log: admin lê"
  on quote_audit_log for select using (auth_role() = 'admin');

-- Sem políticas de insert/update/delete para utilizadores — apenas via trigger

-- ─────────────────────────────────────────────
-- quote_phases, quote_items, quote_status_history
-- ─────────────────────────────────────────────
alter table quote_phases         enable row level security;
alter table quote_items          enable row level security;
alter table quote_status_history enable row level security;

create policy "quote_phases: acesso via quote"
  on quote_phases for select using (
    exists (
      select 1 from quotes q
      where q.id = quote_phases.quote_id
        and (q.partner_id = auth.uid() or auth_role() = 'admin')
    )
  );

create policy "quote_phases: inserir/actualizar via quote"
  on quote_phases for all using (
    exists (
      select 1 from quotes q
      where q.id = quote_phases.quote_id
        and (q.partner_id = auth.uid() or auth_role() = 'admin')
    )
  );

create policy "quote_items: acesso via fase"
  on quote_items for select using (
    exists (
      select 1 from quote_phases qp
      join quotes q on q.id = qp.quote_id
      where qp.id = quote_items.phase_id
        and (q.partner_id = auth.uid() or auth_role() = 'admin')
    )
  );

create policy "quote_items: inserir/actualizar via fase"
  on quote_items for all using (
    exists (
      select 1 from quote_phases qp
      join quotes q on q.id = qp.quote_id
      where qp.id = quote_items.phase_id
        and (q.partner_id = auth.uid() or auth_role() = 'admin')
    )
  );

create policy "quote_status_history: acesso via quote"
  on quote_status_history for select using (
    exists (
      select 1 from quotes q
      where q.id = quote_status_history.quote_id
        and (q.partner_id = auth.uid() or auth_role() = 'admin')
    )
  );

-- ─────────────────────────────────────────────
-- projects
-- ─────────────────────────────────────────────
alter table projects enable row level security;

create policy "projects: partner vê os seus (read-only)"
  on projects for select using (
    partner_id = auth.uid() or auth_role() in ('admin','tech')
  );

create policy "projects: admin e tech actualizam"
  on projects for update using (auth_role() in ('admin','tech'));

create policy "projects: admin cria"
  on projects for insert with check (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- project_tranches — update apenas admin e tech
-- ─────────────────────────────────────────────
alter table project_tranches enable row level security;

create policy "project_tranches: todos autenticados lêem"
  on project_tranches for select using (
    exists (
      select 1 from projects p
      where p.id = project_tranches.project_id
        and (p.partner_id = auth.uid() or auth_role() in ('admin','tech'))
    )
  );

create policy "project_tranches: apenas admin e tech actualizam"
  on project_tranches for update using (auth_role() in ('admin','tech'));

create policy "project_tranches: admin cria"
  on project_tranches for insert with check (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- project_hours_log — update apenas admin e tech
-- ─────────────────────────────────────────────
alter table project_hours_log enable row level security;

create policy "project_hours_log: admin e tech lêem"
  on project_hours_log for select using (auth_role() in ('admin','tech'));

create policy "project_hours_log: admin e tech inserem"
  on project_hours_log for insert with check (auth_role() in ('admin','tech'));

create policy "project_hours_log: apenas admin e tech actualizam"
  on project_hours_log for update using (auth_role() in ('admin','tech'));

-- ─────────────────────────────────────────────
-- commission_plans, commission_tiers, commission_bonuses
-- ─────────────────────────────────────────────
alter table commission_plans   enable row level security;
alter table commission_tiers   enable row level security;
alter table commission_bonuses enable row level security;

create policy "commission_plans: leitura autenticada"
  on commission_plans for select using (auth.role() = 'authenticated');
create policy "commission_plans: escrita admin"
  on commission_plans for all using (auth_role() = 'admin');

create policy "commission_tiers: leitura autenticada"
  on commission_tiers for select using (auth.role() = 'authenticated');
create policy "commission_tiers: escrita admin"
  on commission_tiers for all using (auth_role() = 'admin');

create policy "commission_bonuses: leitura autenticada"
  on commission_bonuses for select using (auth.role() = 'authenticated');
create policy "commission_bonuses: escrita admin"
  on commission_bonuses for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- partner_plans
-- ─────────────────────────────────────────────
alter table partner_plans enable row level security;

create policy "partner_plans: partner vê o seu"
  on partner_plans for select using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

create policy "partner_plans: admin gere"
  on partner_plans for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- commissions
-- ─────────────────────────────────────────────
alter table commissions enable row level security;

create policy "commissions: partner vê as suas"
  on commissions for select using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

-- Insert/update apenas via Edge Function (service role)

-- ─────────────────────────────────────────────
-- annual_bonuses
-- ─────────────────────────────────────────────
alter table annual_bonuses enable row level security;

create policy "annual_bonuses: partner vê os seus"
  on annual_bonuses for select using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

-- ─────────────────────────────────────────────
-- annual_snapshots
-- ─────────────────────────────────────────────
alter table annual_snapshots enable row level security;

create policy "annual_snapshots: partner vê os seus"
  on annual_snapshots for select using (
    partner_id = auth.uid() or auth_role() = 'admin'
  );

-- ─────────────────────────────────────────────
-- objection_playbook — leitura partner; escrita admin
-- ─────────────────────────────────────────────
alter table objection_playbook enable row level security;

create policy "objection_playbook: leitura autenticada"
  on objection_playbook for select using (auth.role() = 'authenticated');

create policy "objection_playbook: escrita apenas admin"
  on objection_playbook for all using (auth_role() = 'admin');

-- ─────────────────────────────────────────────
-- email_logs
-- ─────────────────────────────────────────────
alter table email_logs enable row level security;

create policy "email_logs: apenas admin lê"
  on email_logs for select using (auth_role() = 'admin');
