# TargX CRM — PRD Master

**Versão:** 2.0  
**Data:** Junho 2026  
**URL:** crm.targx.com  
**Stack:** Angular 21 · Supabase (PostgreSQL, Auth, Storage, Edge Functions) · Resend · Puppeteer  
**Hosting:** Servidor próprio TargX  
**Abordagem:** Spec Driven Development — todos os testes definidos antes da implementação

Este documento é a fonte única de verdade da aplicação TargX CRM.

---

# PARTE I — VISÃO GERAL

## 1. O que é

Uma única aplicação interna que gere todo o ciclo comercial da TargX, do primeiro contacto à comissão paga:

```
Lead → Orçamento (TIQS) → Aprovação → Portal Cliente → Projecto → Tranches → Comissões → Bónus
```

## 2. Módulos

| # | Módulo | Função |
|---|---|---|
| 1 | CRM | Clientes, leads, pipeline, actividades, alertas de silêncio |
| 2 | TIQS | Wizard de scoping, motor de risco, builder, propostas PDF, portal do cliente, Gantt |
| 3 | Projectos | Gestão pós-venda, tranches, recebimentos, horas reais |
| 4 | Comissões | Escalões por parceiro, bónus, reset anual, extractos PDF |
| 5 | Dashboards | Partner dashboard com KPIs e metas; admin dashboard com saúde do pipeline |
| 6 | Conhecimento | Repositório de objecções e respostas comerciais |
| 7 | Configuração | Tipos de projecto, perguntas, riscos, tarifas, planos, settings |

## 3. Utilizadores e papéis

| Papel | Quem | Acesso |
|---|---|---|
| `admin` | Rui | Tudo |
| `partner` | Parceiros comerciais (ex. Urbano) | Os seus dados: leads, orçamentos, comissões, dashboard pessoal |
| `tech` | Luís / equipa técnica | Projectos, tranches, horas reais |

## 4. Fluxo completo de negócio

1. Parceiro cria lead (ou admin atribui com notificação).
2. Parceiro qualifica e cria orçamento via wizard TIQS.
3. Wizard pré-preenche fases/itens; motor de risco calcula multiplicadores.
4. Parceiro ajusta no builder; sistema valida margem mínima.
5. Submete para revisão; admin valida, ajusta, aprova.
6. PDF gerado; enviado ao cliente com link para portal.
7. Cliente vê proposta + Gantt; aceita ou rejeita.
8. Aceitação cria projecto automaticamente com tranches por payment_terms.
9. Tech/admin marca tranches como recebidas; regista horas reais.
10. Cada tranche recebida dispara cálculo de comissão (Edge Function).
11. Sistema verifica limiares de bónus; emails automáticos.
12. Dashboard do parceiro actualiza KPIs em tempo real.
13. Cron mensal envia resumo e extracto de comissões.
14. Reset anual a 1 de Janeiro; snapshots preservados.

---

# PARTE II — SCHEMA DE BASE DE DADOS UNIFICADO

Todos os campos e código em inglês. Texto de UI e documentos em português.

## 5. Identidade e configuração

### 5.1 `profiles`
```sql
create table profiles (
  id            uuid primary key references auth.users(id),
  full_name     text not null,
  email         text not null,
  role          text not null check (role in ('admin','partner','tech')),
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
```

### 5.2 `global_settings`
```sql
create table global_settings (
  key         text primary key,
  value       text not null,
  updated_by  uuid references profiles(id),
  updated_at  timestamptz not null default now()
);
-- minimum_margin_pct:           '25'
-- minimum_project_price:        '1000'
-- default_valid_days:           '30'
-- default_payment_terms:        '40% adjudicação, 30% entrega, 30% fecho'
-- fixed_item_cost_proxy_pct:    '60'
-- tax_rate_pct:                 '23'
-- daily_capacity_hours:         '8'
-- lead_silence_warning_days:    '7'
-- lead_silence_alert_days:      '14'
-- portal_open_tracking:         'true'
```

## 6. Módulo CRM

### 6.1 `clients`
```sql
create table clients (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  nif          text,
  sector       text,
  website      text,
  email        text,
  phone        text,
  address      text,
  notes        text,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
```

### 6.2 `leads`
```sql
create type lead_status as enum (
  'nova','contactada','proposta_enviada','negociacao',
  'fechada_ganha','fechada_perdida'
);

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
  last_activity_at  timestamptz,      -- actualizado em cada lead_activity
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
```

**Máquina de estados:** `nova→contactada→proposta_enviada→negociacao→fechada_*`. Estados fechados são terminais. `fechada_perdida` exige `lost_reason`.

### 6.3 `partner_targets`
Metas de volume trimestrais definidas pelo admin por parceiro.

```sql
create table partner_targets (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references profiles(id),
  year        int not null,
  quarter     int not null check (quarter between 1 and 4),
  target_volume numeric(12,2) not null,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  constraint unique_target unique (partner_id, year, quarter)
);
```

## 7. Módulo TIQS — configuração

### 7.1 `project_types`
```sql
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
-- ecommerce, website_institucional, software_medida, saas, integracao_automacao
```

### 7.2 `scoping_questions`
```sql
create type question_type as enum (
  'single_choice','multi_select','numeric','complexity_scale','risk_indicator','text'
);

create table scoping_questions (
  id                uuid primary key default gen_random_uuid(),
  project_type_id   uuid not null references project_types(id),
  key               text not null,
  label             text not null,
  description       text,
  question_type     question_type not null,
  options           jsonb,
  impacts_price     boolean not null default true,
  activates_modules jsonb,    -- { "option_value": ["catalog_item_slug"] }
  triggers_risk     jsonb,    -- { "condition": "gte", "value": 3, "risk_key": "..." }
  sort_order        int not null default 0,
  required          boolean not null default true,
  created_at        timestamptz not null default now(),
  constraint unique_question_key unique (project_type_id, key)
);
```

### 7.3 `rate_profiles`
```sql
create table rate_profiles (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,   -- Júnior, Sénior, Arquitecto, Designer, DevOps
  hourly_rate   numeric(8,2) not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);
```

### 7.4 `catalog_items`
```sql
create type item_pricing_type as enum ('hourly','fixed');

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
```

### 7.5 `quote_templates`
Orçamentos completos guardados como templates reutilizáveis.

```sql
create table quote_templates (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  description     text,
  project_type_id uuid references project_types(id),
  phases_data     jsonb not null,   -- snapshot de fases e itens
  usage_count     int not null default 0,
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### 7.6 `risk_multipliers`
```sql
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
```

## 8. Módulo TIQS — orçamentos

### 8.1 `quotes`
```sql
create type quote_status as enum (
  'rascunho','em_revisao','aprovado_interno','enviado_cliente','aceite','rejeitado'
);

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
```

### 8.2 `quote_audit_log`
Registo imutável de alterações a campos financeiros.

```sql
create table quote_audit_log (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  changed_by  uuid not null references profiles(id),
  field       text not null,
  old_value   text,
  new_value   text,
  changed_at  timestamptz not null default now()
);
-- Campos auditados: total_before_tax, discount_pct, risk_multiplier_total,
--                   calculated_margin_pct, status
```

### 8.3 `quote_phases`
```sql
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
```

### 8.4 `quote_items`
```sql
create table quote_items (
  id                uuid primary key default gen_random_uuid(),
  phase_id          uuid not null references quote_phases(id) on delete cascade,
  catalog_item_id   uuid references catalog_items(id),
  name              text not null,
  description       text,
  pricing_type      item_pricing_type not null,
  hours             numeric(8,2),
  rate_profile_id   uuid references rate_profiles(id),
  hourly_rate       numeric(8,2),     -- snapshot no momento de criação
  unit_value        numeric(10,2),
  quantity          numeric(8,2) not null default 1,
  item_order        int not null,
  optional          boolean not null default false,
  optional_accepted boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint unique_item_order unique (phase_id, item_order)
);
```

### 8.5 `quote_status_history`
```sql
create table quote_status_history (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id) on delete cascade,
  from_status quote_status,
  to_status   quote_status not null,
  changed_by  uuid references profiles(id),
  notes       text,
  changed_at  timestamptz not null default now()
);
```

## 9. Módulo Projectos

### 9.1 `projects`
```sql
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
  estimated_hours numeric(8,2),       -- do orçamento (snapshot)
  actual_hours    numeric(8,2),       -- registadas pela tech após entrega
  created_by      uuid references profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
```

### 9.2 `project_tranches`
```sql
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
```

### 9.3 `project_hours_log`
Registo de horas reais por projecto (para calibrar estimativas futuras).

```sql
create table project_hours_log (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects(id) on delete cascade,
  logged_by   uuid not null references profiles(id),
  hours       numeric(6,2) not null,
  description text,
  logged_at   date not null default current_date,
  created_at  timestamptz not null default now()
);
```

## 10. Módulo Comissões

### 10.1 `commission_plans` / `commission_tiers` / `commission_bonuses`
```sql
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
  volume_to    numeric(12,2),          -- null = sem limite
  rate_percent numeric(5,2) not null,
  label        text,                   -- ex: 'Escalão Base', 'Escalão Sénior'
  constraint unique_tier_order unique (plan_id, tier_order)
);

create table commission_bonuses (
  id           uuid primary key default gen_random_uuid(),
  plan_id      uuid not null references commission_plans(id),
  threshold    numeric(12,2) not null,
  bonus_amount numeric(12,2) not null,
  description  text
);
-- Plano "Standard Partner": 0–100k@15%, 100k+@20%, bónus 150k→3.000, 250k→7.500
```

### 10.2 `partner_plans`
```sql
create table partner_plans (
  id          uuid primary key default gen_random_uuid(),
  partner_id  uuid not null references profiles(id),
  plan_id     uuid not null references commission_plans(id),
  active_from date not null,
  active_to   date,
  constraint unique_active_plan unique (partner_id, active_from)
);
```

### 10.3 `commissions`
```sql
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
```

### 10.4 `annual_bonuses`
```sql
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
```

### 10.5 `annual_snapshots`
```sql
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
```

## 11. Módulo Conhecimento

### 11.1 `objection_playbook`
```sql
create table objection_playbook (
  id          uuid primary key default gen_random_uuid(),
  category    text not null,   -- 'preco', 'prazo', 'tecnologia', 'concorrencia', 'outro'
  objection   text not null,   -- ex: 'O vosso preço é mais caro que a concorrência'
  response    text not null,   -- resposta recomendada pela TargX
  context     text,            -- quando usar esta resposta
  tags        text[],
  active      boolean not null default true,
  created_by  uuid references profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
```

## 12. Emails

### 12.1 `email_logs`
```sql
create table email_logs (
  id         uuid primary key default gen_random_uuid(),
  recipient  text not null,
  type       text not null,
  subject    text not null,
  event_key  text unique,     -- deduplicação: 'monthly_2026_06_partnerX'
  sent_at    timestamptz not null default now(),
  resend_id  text,
  error      text
);
```

---

# PARTE III — LÓGICA DE NEGÓCIO

## 13. Alertas de lead em silêncio

Cron diário verifica leads não fechadas com `last_activity_at` desactualizado:

- `> lead_silence_warning_days` (default 7): aviso no dashboard do parceiro.
- `> lead_silence_alert_days` (default 14): email ao parceiro + admin. `silence_alerted = true` para não duplicar.
- Reset de `silence_alerted` quando nova actividade é registada.

## 14. Tracking do portal do cliente

Quando o cliente abre o link do portal:
1. Edge Function regista `portal_opened_at` (primeira abertura) e incrementa `portal_open_count`.
2. Se `portal_open_count = 1`, envia notificação ao admin e parceiro: "O cliente abriu a proposta".
3. Parceiro vê no detalhe do orçamento: data de abertura e número de visitas.

## 15. Motor de scoping → pré-preenchimento

1. Wizard responde `scoping_answers` por `project_type`.
2. `activates_modules` mapeia respostas a slugs de `catalog_items`.
3. Itens criados com snapshot de tarifa (`hourly_rate` copiado de `rate_profiles`).
4. Parceiro ajusta livremente no builder.
5. Alternativa ao wizard: carregar `quote_template` existente.

## 16. Motor de risco

```
risk_multiplier_total = Π(multiplier de cada risco activo)   -- produto
subtotal_with_risk    = subtotal_base × risk_multiplier_total
risk_adjustment       = subtotal_with_risk − subtotal_base
```

Multiplicadores nunca < 1.0 (constraint DB). Risco `is_blocking` impede submissão; admin faz override com notas obrigatórias.

## 17. Cálculo financeiro

```
item hourly:       subtotal = hours × hourly_rate × quantity
item fixed:        subtotal = unit_value × quantity
subtotal_base    = Σ itens não opcionais
subtotal_with_risk = subtotal_base × risk_multiplier_total
discount_amount  = subtotal_with_risk × discount_pct / 100
total_before_tax = max(subtotal_with_risk − discount_amount, minimum_project_price)
total_with_tax   = total_before_tax × (1 + tax_rate_pct / 100)
```

Qualquer alteração a campo financeiro gera registo em `quote_audit_log`.

## 18. Validação de margem

```
custo = Σ(hours × hourly_rate) + Σ(unit_value × fixed_cost_proxy_pct/100)
margin_pct = (total_before_tax − custo) / total_before_tax × 100
margin_pct < minimum_margin_pct → bloqueia submissão
admin pode override com discount_reason obrigatório
```

## 19. Gantt

- `duration_days` = horas da fase ÷ daily_capacity_hours (excluindo fins-de-semana).
- Fases encadeadas desde `gantt_start_date`.
- Arrastar fase desloca as seguintes automaticamente.
- Visível e ajustável no portal do cliente.

## 20. Portal do cliente

- URL pública `/client/quotes/{token}`, sem login.
- Token TTL = `valid_until`. Expirado → 410.
- Cliente vê PDF, Gantt, aceita opcionais, aceita ou rejeita (motivo obrigatório).
- Cada abertura registada em `portal_open_count`.

## 21. Conversão orçamento → projecto

1. `contract_value` = `total_before_tax` + opcionais aceites.
2. `estimated_hours` copiado do total de horas do orçamento (snapshot).
3. Tranches criadas por parsing de `payment_terms`.
4. `lead.status` → `fechada_ganha`.
5. `usage_count` de itens e templates incrementado.
6. Idempotente. Dados de scoping e risco imutáveis.

## 22. Motor de comissões

Webhook quando `received = true`:

```
volume_acumulado = Σ tranches recebidas do parceiro no ano civil
para cada tier do plano activo (partner_plans, active_from/to):
  porção no tier = sobreposição entre tranche e intervalo do tier
  comissão += porção × rate_percent / 100
```

Desmarcar tranche remove comissão associada.

Após cálculo: verificar limiares de bónus → criar `annual_bonuses` (idempotente) → notificar.

## 23. Dashboard do parceiro — KPIs calculados

Vista em tempo real com:

```
volume_ano            = Σ tranches recebidas no ano civil corrente
commission_ano        = Σ commissions.commission_amount no ano
tier_actual           = tier onde volume_ano se encontra
tier_rate             = taxa actual (%)
next_tier_threshold   = volume_to do tier actual
volume_to_next_tier   = next_tier_threshold − volume_ano
next_tier_rate        = taxa do próximo tier
progress_pct_tier     = volume_ano / next_tier_threshold × 100

bonus_status[]        = para cada bonus do plano:
  { threshold, bonus_amount, achieved, volume_remaining }

volume_trimestre      = Σ tranches recebidas no trimestre corrente
target_trimestre      = partner_targets para (ano, trimestre)
progress_pct_target   = volume_trimestre / target_trimestre × 100

pipeline_value        = Σ estimated_value de leads não fechadas
leads_abertas         = count leads não fechadas
leads_sem_actividade  = count leads com last_activity_at > warning_days
```

## 24. Dashboard admin — saúde do pipeline

```
por_estado[]      = { status, count, value_total } para todas as leads
tempo_medio[]     = tempo médio em dias por estado (para detectar bloqueios)
taxa_conversao[]  = fechadas_ganha / total_fechadas por parceiro
leads_silencio    = leads com last_activity_at > alert_days
estimado_vs_real  = Σ estimated_hours vs actual_hours por tipo de projecto
margem_media      = média de calculated_margin_pct por tipo
```

## 25. Horas reais e calibração de estimativas

Após conclusão de projecto, tech regista horas em `project_hours_log`. Dashboard admin mostra:
- Estimado vs real por tipo de projecto (agrega `estimated_hours` vs `Σ project_hours_log.hours`).
- Desvio percentual médio por tipo.
- Admin usa esta informação para ajustar `base_hours` em `project_types` e `default_hours` em `catalog_items`.

## 26. Extracto de comissões (PDF)

Gerado mensalmente via cron e disponível a pedido:
- Cabeçalho: nome do parceiro, período, plano activo.
- Tabela: projecto, cliente, tranche, valor, taxa, comissão.
- Totais: volume do período, comissão total, bónus (se aplicável).
- Guardado em Storage: `commissions/{partner_id}/{year}/{month}.pdf`.

## 27. Repositório de objecções

- Pesquisável por categoria e texto livre.
- Acessível ao parceiro durante uma negociação.
- Admin mantém e actualiza com base em experiência real.
- Integrado no detalhe da lead como painel lateral.

## 28. Reset anual (1 de Janeiro)

1. Criar `annual_snapshots` para cada parceiro.
2. Enviar email de resumo anual (volume, comissão, bónus) a cada parceiro.
3. Enviar email de overview global ao admin.
4. Volume calculado sempre por ano civil — o reset é implícito no filtro por `year`.

---

# PARTE IV — TESTES UNITÁRIOS

Total: **116 testes** em 16 suites, todos definidos antes de qualquer implementação.

## 29. Suites

### CRM-001 a CRM-008 `LeadService`
- CRM-001: partner só vê as suas leads; CRM-002: admin vê todas.
- CRM-003: nova→contactada válida; CRM-004: fechada_ganha→nova inválida.
- CRM-005: fechada_perdida exige lost_reason.
- CRM-006: actividade actualiza last_activity_at e reset silence_alerted.
- CRM-007: lead com last_activity > warning_days marcada no dashboard.
- CRM-008: lead com last_activity > alert_days dispara email (não duplica se silence_alerted=true).

### TIQS-001 a TIQS-006 `ScopingEngineService`
- TIQS-001/002: módulo activado/não activado por condição.
- TIQS-003: pré-preenchimento com snapshot de tarifa.
- TIQS-004: text não impacta preço.
- TIQS-005: wizard incompleto bloqueia com lista de faltas.
- TIQS-006: multi_select activa múltiplos módulos.

### TIQS-007 a TIQS-015 `RiskEngineService`
- TIQS-007/008: detecção gte satisfeita/não satisfeita.
- TIQS-009: total = produto (1.15×1.10=1.265).
- TIQS-010: multiplier < 1.0 lança erro.
- TIQS-011: bloqueante impede submissão.
- TIQS-012/013: override exige notas; com notas aceite.
- TIQS-014: subtotal_with_risk e risk_adjustment correctos.
- TIQS-015: sem riscos, multiplier_total = 1.0.

### TIQS-016 a TIQS-022 `QuoteCalculatorService`
- TIQS-016/017: hourly e fixed correctos.
- TIQS-018: desconto sobre subtotal_with_risk.
- TIQS-019: IVA 23%.
- TIQS-020: piso minimum_project_price.
- TIQS-021/022: opcional fora/dentro do total por estado.

### TIQS-023 a TIQS-026 `MarginValidatorService`
- TIQS-023: margem com mix (proxy 60% fixed).
- TIQS-024: abaixo do mínimo bloqueia.
- TIQS-025: calculada após risco e desconto.
- TIQS-026: override admin com justificação.

### TIQS-027 a TIQS-036 `QuoteStateService`
- TIQS-027: rascunho→em_revisao com history.
- TIQS-028: partner não aprova (Forbidden).
- TIQS-029/030: devolução exige nota; com nota aceite.
- TIQS-031: aceite não editável.
- TIQS-032: transição inválida com estados no erro.
- TIQS-033: margem baixa bloqueia submissão.
- TIQS-034: nova versão em rascunho com cópia integral e parent_quote_id.
- TIQS-035: apenas uma versão activa por lead.
- TIQS-036: audit_log criado para cada alteração financeira (campo, old, new, user).

### TIQS-037 a TIQS-040 `GanttService`
- TIQS-037: duration = horas ÷ capacidade.
- TIQS-038: encadeamento desde start_date.
- TIQS-039: arrastar desloca seguintes.
- TIQS-040: exclusão de fins-de-semana.

### TIQS-041 a TIQS-047 `ClientPortalService`
- TIQS-041: token inválido → 401; TIQS-042: expirado → 410.
- TIQS-043: aceitação actualiza status e accepted_at.
- TIQS-044: rejeição exige motivo.
- TIQS-045: aceitar opcionais antes da aceitação.
- TIQS-046: aceitação dispara conversão.
- TIQS-047: primeira abertura regista portal_opened_at e notifica parceiro/admin.

### TIQS-048 a TIQS-053 `QuoteConversionService`
- TIQS-048: contract_value = total + opcionais aceites.
- TIQS-049: estimated_hours copiado como snapshot.
- TIQS-050: tranches por payment_terms (40/30/30 de 10k → 4k/3k/3k).
- TIQS-051: lead→fechada_ganha.
- TIQS-052: usage_count de itens e templates incrementado.
- TIQS-053: idempotência e dados de scoping imutáveis.

### TIQS-054 a TIQS-056 `QuoteTemplateService`
- TIQS-054: criar template a partir de orçamento existente copia fases e itens.
- TIQS-055: carregar template pré-preenche builder e incrementa usage_count.
- TIQS-056: template com project_type incompatível lança aviso (não bloqueia).

### COM-001 a COM-011 `CommissionCalculatorService`
- COM-001: taxa base no primeiro escalão.
- COM-002: tranche atravessa escalão (95k+10k → 750+1.000=1.750).
- COM-003: volume já acima → 100% taxa superior.
- COM-004/005: plano de 1 escalão; três escalões.
- COM-006/007: zero → 0; negativa → erro.
- COM-008: plano activo na data da tranche (active_from/to).
- COM-009: só ano civil corrente; COM-010: não recebidas excluídas.
- COM-011: Janeiro sem histórico → 0.

### COM-012 a COM-017 `BonusCalculatorService`
- COM-012: abaixo limiar → sem bónus.
- COM-013/014/015: 150k→3k; não duplica; 250k→7.5k.
- COM-016: dois bónus no mesmo ano.
- COM-017: reset anual correcto.

### COM-018 a COM-022 `ProjectTrancheService`
- COM-018: received actualiza campos.
- COM-019: dispara cálculo.
- COM-020: desmarcar remove comissão.
- COM-021: Σ tranches não excede contract_value em >1%.
- COM-022: projecto concluído quando todas recebidas.

### DSH-001 a DSH-010 `DashboardService`
- DSH-001: getPartnerSummary com todos os campos calculados.
- DSH-002: progress_pct_tier correcto (60k de 100k → 60%).
- DSH-003: volume_to_next_tier correcto.
- DSH-004: bonus_status[] para cada bónus do plano.
- DSH-005: progress_pct_target vs meta trimestral.
- DSH-006: pipeline_value e leads_sem_actividade.
- DSH-007: admin overview agrega todos os parceiros.
- DSH-008: partner a pedir admin overview → Forbidden.
- DSH-009: estimado_vs_real por tipo de projecto.
- DSH-010: leads agrupadas por estado com value_total.

### CAT-001 a CAT-004 `CatalogService`
- CAT-001: pesquisa case-insensitive.
- CAT-002: filtro por project_type.
- CAT-003: ordenação por usage_count desc.
- CAT-004: guardar ad-hoc preserva pricing_type.

### EML-001 a EML-009 `EmailService`
- EML-001: resumo mensal com volume, comissão, progresso.
- EML-002: alerta bónus próximo (>90% do limiar).
- EML-003: bónus atingido notifica admin e parceiro.
- EML-004: erro Resend registado sem excepção.
- EML-005: deduplicação por event_key.
- EML-006: email ao cliente com PDF e link do portal.
- EML-007: alerta expiração 3 dias antes.
- EML-008: silêncio de lead não duplica se silence_alerted=true.
- EML-009: portal aberto pela primeira vez notifica parceiro.

### PDF-001 a PDF-006 `PdfGeneratorService`
- PDF-001: conteúdo obrigatório presente (cliente, data, versão).
- PDF-002: opcionais marcados visualmente e fora do total.
- PDF-003: internal_notes ausentes.
- PDF-004: path previsível quotes/{id}/v{version}.pdf.
- PDF-005: URL expirada regenera assinatura.
- PDF-006: extracto de comissões contém tabela detalhada e totais.

---

# PARTE V — ARQUITECTURA DA APLICAÇÃO

## 30. Estrutura Angular

```
src/app/
├── core/
│   ├── models/
│   ├── services/           -- 16 serviços de lógica pura (sem HTTP)
│   ├── guards/             -- auth.guard, role.guard
│   └── supabase/           -- cliente, helpers, types gerados
├── features/
│   ├── dashboard/
│   │   ├── partner-dashboard/    -- KPIs, metas, patamar, bónus
│   │   └── admin-dashboard/      -- pipeline, saúde, estimativas
│   ├── clients/
│   ├── leads/
│   │   └── objection-panel/      -- painel lateral de objecções
│   ├── quotes/
│   │   ├── quote-wizard/         -- 4 steps: type, scoping, modules, review
│   │   ├── quote-builder/        -- builder manual, drag&drop
│   │   │   ├── risk-panel/
│   │   │   └── margin-indicator/
│   │   ├── quote-review/         -- admin: override risco e margem
│   │   ├── quote-preview/        -- fiel ao PDF
│   │   ├── quote-versions/       -- comparação lado a lado
│   │   └── gantt/                -- @defer
│   ├── client-portal/            -- rota pública /client/quotes/:token
│   │   ├── portal-proposal/
│   │   ├── portal-gantt/
│   │   └── portal-acceptance/
│   ├── projects/
│   │   ├── project-list/
│   │   ├── project-detail/
│   │   ├── tranche-list/
│   │   └── hours-log/
│   ├── commissions/
│   │   ├── commission-timeline/
│   │   ├── bonus-tracker/
│   │   └── commission-statement/ -- extracto PDF
│   ├── knowledge/
│   │   └── objection-playbook/
│   └── settings/
│       ├── project-types/
│       ├── scoping-questions/
│       ├── risk-multipliers/
│       ├── rate-profiles/
│       ├── catalog/
│       ├── quote-templates/
│       ├── commission-plans/
│       ├── partner-targets/
│       └── global/
└── shared/
    ├── components/
    │   ├── status-badge/
    │   ├── progress-bar/
    │   ├── currency-display/
    │   ├── confirm-dialog/
    │   └── silence-warning/
    └── pipes/
        ├── currencyPt
        ├── leadStatusLabel
        └── quoteStatusLabel
```

## 31. Rotas

| Rota | Papéis |
|---|---|
| `/dashboard` | todos (vista por papel) |
| `/clients`, `/clients/:id` | todos |
| `/leads`, `/leads/:id` | partner (próprias), admin/tech (todas) |
| `/quotes`, `/quotes/new`, `/quotes/:id/build`, `/quotes/:id/preview`, `/quotes/:id/versions` | partner, admin |
| `/quotes/:id/review` | admin |
| `/client/quotes/:token` | público |
| `/projects`, `/projects/:id` | admin, tech; partner (próprios, read-only) |
| `/commissions` | partner (próprias), admin (todas) |
| `/knowledge/objections` | partner, admin |
| `/settings/**` | admin |

## 32. RLS (princípios)

- `leads`, `quotes`, `commissions`, `annual_bonuses`: partner vê `partner_id = auth.uid()`.
- `project_tranches`, `project_hours_log`: update apenas admin e tech.
- `quote_audit_log`: insert via trigger, sem update/delete.
- `objection_playbook`: leitura partner; escrita admin.
- Portal do cliente: acesso via Edge Function com service role (token validado server-side).

## 33. Edge Functions

| Função | Trigger | Responsabilidade |
|---|---|---|
| `calculate-commission` | DB webhook tranche received=true | Escalões, comissões, bónus, emails |
| `remove-commission` | DB webhook tranche received=false | Remove comissão |
| `generate-quote-pdf` | HTTP admin | Puppeteer → Storage |
| `generate-commission-statement` | HTTP ou cron | Extracto PDF por parceiro/período |
| `send-quote-to-client` | HTTP admin | Token, email, status |
| `handle-client-portal-open` | HTTP portal | Tracking de abertura, notificação |
| `handle-client-response` | HTTP portal | Aceite/rejeição, conversão |
| `convert-quote-to-project` | Interna | Conversão idempotente |
| `send-monthly-digest` | Cron 1º dia 08:00 | Resumos + extractos por parceiro |
| `annual-reset` | Cron 1 Jan 00:01 | Snapshots + resumos anuais |
| `check-lead-silence` | Cron diário 08:00 | Alertas de silêncio |
| `check-quote-expirations` | Cron diário 08:00 | Alertas de expiração |

## 34. Templates de email (Resend, from hello@targx.com)

CRM: `lead_assigned`, `lead_silence_warning`, `lead_silence_alert`.
Comissões: `commission_paid`, `bonus_near`, `bonus_reached`, `monthly_digest`, `commission_statement`, `annual_summary`.
TIQS: `quote_submitted`, `quote_returned`, `quote_approved`, `quote_sent`, `quote_to_client`, `quote_portal_opened`, `quote_accepted`, `quote_rejected`, `quote_expiring`.

Todos com deduplicação por `event_key` em `email_logs`.

---

# PARTE VI — PLANO DE IMPLEMENTAÇÃO

## 35. Fases (14 semanas)

### Fase 1 — Fundação (Sem. 1–2)
Setup Angular 21 + Supabase; schema completo + RLS + triggers de audit; auth 3 papéis; seeds (plano Standard Partner, 5 project_types, rate_profiles, settings).
**Testes prioritários:** COM-001 a COM-022 (motor de comissões — o módulo onde um bug custa dinheiro).

### Fase 2 — CRM e dashboards (Sem. 3–4)
Clientes, leads, actividades, kanban de pipeline, alertas de silêncio, repositório de objecções.
Dashboard do parceiro (KPIs, metas, patamar, bónus) e dashboard admin (saúde do pipeline).
**Testes:** CRM-001 a CRM-008, DSH-001 a DSH-010.

### Fase 3 — TIQS motores e builder (Sem. 5–7)
Wizard (4 steps), builder com drag&drop, risk panel, margin indicator, catálogo, templates.
**Testes:** TIQS-001 a TIQS-036, TIQS-054 a TIQS-056, CAT-001 a CAT-004.

### Fase 4 — Aprovação, PDF e portal (Sem. 8–10)
Review admin com overrides, versionamento, comparação, PDF Puppeteer, envio ao cliente, portal público com Gantt, tracking de abertura.
**Testes:** TIQS-037 a TIQS-047, PDF-001 a PDF-005.

### Fase 5 — Conversão, comissões ponta a ponta e emails (Sem. 11–12)
Conversão quote→projecto→tranches→comissões, extractos PDF, todos os emails e crons.
**Testes:** TIQS-048 a TIQS-053, EML-001 a EML-009, PDF-006.

### Fase 6 — Horas reais, polimento e settings (Sem. 13–14)
Registo de horas reais, analytics estimado vs real, settings completos em UI, export Excel, auditoria.
**Testes:** DSH-009 (estimado vs real).

## 36. Pré-requisito não técnico (crítico — antes da Fase 3)

Sessão de 2 horas (Rui + Luís) para mapear por tipo de projecto:
- Perguntas de scoping com condições e módulos activados.
- Multiplicadores de risco com categorias e valores.
- 10–15 itens de catálogo iniciais (setup PrestaShop, integração Sifarma, integração PHC, módulo Angular, setup Supabase, migração de dados, multi-idioma, pagamentos, etc.).
- Valores base (`base_hours`) por tipo de projecto.

**Entregável:** ficheiro `seed.sql` completo.

## 37. Variáveis de ambiente

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_STORAGE_BUCKET_QUOTES=quotes
SUPABASE_STORAGE_BUCKET_COMMISSIONS=commissions
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@targx.com
APP_URL=https://crm.targx.com
CLIENT_PORTAL_BASE_URL=https://crm.targx.com/client/quotes
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

## 38. Decisões de arquitectura

| Decisão | Escolha | Razão |
|---|---|---|
| Uma aplicação | Módulos Angular + Supabase | Schema partilhado, sem duplicação |
| Comissões server-side | Edge Function + webhook | Inviolável, auditável |
| Audit trail | Trigger DB + tabela imutável | Sem dependência de código client |
| Admin de regras | Páginas Angular | Sem Strapi, sem serviço extra |
| Tracking portal | Edge Function com service role | RLS preservado, sem acesso anónimo directo |
| IA de similaridade | Adiada (pós fase 6) | Sem dados históricos suficientes |
| Vector DB | Adiada | Idem |
| Portal cliente | Rota pública + token | Sem app separada |
| PDF | Puppeteer Edge Function | Controlo HTML/CSS total |
| Custo fixed | Proxy 60% configurável | Sem sistema de imputação de horas ainda |
| Gantt | @defer + lib JS | Performance, sem dependência crítica |

---

*TargX CRM PRD Master v2.0 — documento interno — Junho 2026*
