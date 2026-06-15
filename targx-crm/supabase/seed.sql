-- TargX CRM — Seed Inicial
-- Dados: global_settings, commission_plans, rate_profiles, project_types

-- ─────────────────────────────────────────────
-- global_settings (PRD secção 5.2)
-- ─────────────────────────────────────────────
insert into global_settings (key, value) values
  ('minimum_margin_pct',         '25'),
  ('minimum_project_price',      '1000'),
  ('default_valid_days',         '30'),
  ('default_payment_terms',      '40% adjudicação, 30% entrega, 30% fecho'),
  ('fixed_item_cost_proxy_pct',  '60'),
  ('tax_rate_pct',               '23'),
  ('daily_capacity_hours',       '8'),
  ('lead_silence_warning_days',  '7'),
  ('lead_silence_alert_days',    '14'),
  ('portal_open_tracking',       'true')
on conflict (key) do update set value = excluded.value;

-- ─────────────────────────────────────────────
-- commission_plans — Standard Partner
-- ─────────────────────────────────────────────
with plan as (
  insert into commission_plans (id, name, description)
  values (
    '00000000-0000-0000-0000-000000000001',
    'Standard Partner',
    'Plano base para parceiros comerciais TargX'
  )
  on conflict do nothing
  returning id
)
insert into commission_tiers (plan_id, tier_order, volume_from, volume_to, rate_percent, label)
select
  p.id, t.tier_order, t.volume_from, t.volume_to, t.rate_percent, t.label
from plan p,
(values
  (1,         0, 100000::numeric, 15::numeric, 'Escalão Base'),
  (2, 100000,        null,        20::numeric, 'Escalão Sénior')
) as t(tier_order, volume_from, volume_to, rate_percent, label)
on conflict do nothing;

-- commission_bonuses
insert into commission_bonuses (plan_id, threshold, bonus_amount, description)
select '00000000-0000-0000-0000-000000000001', t.threshold, t.bonus_amount, t.description
from (values
  (150000::numeric, 3000::numeric,  'Bónus de volume 150.000 €'),
  (250000::numeric, 7500::numeric,  'Bónus de volume 250.000 €')
) as t(threshold, bonus_amount, description)
on conflict do nothing;

-- ─────────────────────────────────────────────
-- rate_profiles
-- ─────────────────────────────────────────────
insert into rate_profiles (name, hourly_rate) values
  ('Júnior',      45),
  ('Sénior',      75),
  ('Arquitecto',  95),
  ('Designer',    60),
  ('DevOps',      70)
on conflict do nothing;

-- ─────────────────────────────────────────────
-- project_types (5 tipos do PRD)
-- ─────────────────────────────────────────────
insert into project_types (name, slug, description, base_hours, base_price, minimum_price, sort_order) values
  ('E-commerce',              'ecommerce',               'Loja online com catálogo, pagamentos e gestão de encomendas',                160, 8000,  3000, 1),
  ('Website Institucional',   'website_institucional',   'Site institucional com CMS, multi-idioma e formulários de contacto',          80, 4000,  1500, 2),
  ('Software à Medida',       'software_medida',         'Aplicação web personalizada com requisitos específicos do cliente',          240, 15000, 5000, 3),
  ('SaaS',                    'saas',                    'Plataforma SaaS multi-tenant com subscriptions e painel de administração',   320, 25000, 8000, 4),
  ('Integração/Automação',    'integracao_automacao',    'Integração entre sistemas, APIs, automação de processos e ETL',               80, 4000,  2000, 5)
on conflict (slug) do update
  set name = excluded.name,
      description = excluded.description;
