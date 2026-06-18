-- 009_roi_benchmarks.sql

create table roi_benchmarks (
  id                       uuid primary key default gen_random_uuid(),
  project_type_id          uuid not null references project_types(id),
  label                    text not null,
  description              text,
  investment_range_min     numeric(12,2) not null,
  investment_range_max     numeric(12,2) not null,
  avg_payback_months       numeric(5,1) not null,
  avg_revenue_increase_pct numeric(5,1),
  avg_cost_reduction_pct   numeric(5,1),
  sample_size              int not null default 0,
  active                   boolean not null default true,
  created_by               uuid references profiles(id),
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

alter table roi_benchmarks enable row level security;

create policy "admin_manages_roi_benchmarks"
  on roi_benchmarks for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));

create policy "public_reads_active_benchmarks"
  on roi_benchmarks for select
  using (active = true);

-- Seed inicial
insert into roi_benchmarks (project_type_id, label, investment_range_min, investment_range_max, avg_payback_months, avg_revenue_increase_pct, avg_cost_reduction_pct, sample_size)
select pt.id, 'eCommerce Farmácia', 8000, 20000, 8.0, 35.0, 20.0, 3
from project_types pt where pt.slug = 'ecommerce';

insert into roi_benchmarks (project_type_id, label, investment_range_min, investment_range_max, avg_payback_months, avg_revenue_increase_pct, avg_cost_reduction_pct, sample_size)
select pt.id, 'eCommerce Retalho Multiloja', 25000, 60000, 12.0, 45.0, 15.0, 1
from project_types pt where pt.slug = 'ecommerce';

insert into roi_benchmarks (project_type_id, label, investment_range_min, investment_range_max, avg_payback_months, avg_revenue_increase_pct, avg_cost_reduction_pct, sample_size)
select pt.id, 'Software de Gestão B2B', 15000, 40000, 10.0, null, 30.0, 2
from project_types pt where pt.slug = 'software_medida';

insert into roi_benchmarks (project_type_id, label, investment_range_min, investment_range_max, avg_payback_months, avg_revenue_increase_pct, avg_cost_reduction_pct, sample_size)
select pt.id, 'Integração ERP + eCommerce', 8000, 25000, 6.0, 25.0, 35.0, 3
from project_types pt where pt.slug = 'integracao_automacao';
