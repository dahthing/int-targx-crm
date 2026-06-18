-- ============================================================
-- seed_catalog.sql
-- Scoping questions, catalog items e risk multipliers
-- Executar DEPOIS de seed.sql (depende de project_types e rate_profiles)
-- ============================================================

-- ─────────────────────────────────────────────
-- RISK MULTIPLIERS
-- ─────────────────────────────────────────────
insert into risk_multipliers (key, name, description, category, multiplier, is_blocking) values
  ('prazo_agressivo',      'Prazo agressivo',         'Entrega em menos de 4 semanas para projecto complexo',       'timeline', 1.25, false),
  ('integracao_legado',    'Integração legado',        'Integração com sistemas antigos sem API documentada',         'tecnico',  1.35, false),
  ('requisitos_vagos',     'Requisitos vagos',         'Cliente não tem especificação clara no arranque',             'scope',    1.20, false),
  ('cliente_sem_tech',     'Cliente sem tech interno', 'Cliente sem equipa técnica para validação e feedback',        'cliente',  1.15, false),
  ('multilingue_complexo', 'Multi-idioma avançado',    'Mais de 3 idiomas com conteúdo dinâmico',                    'scope',    1.10, false),
  ('gdpr_compliance',      'GDPR / compliance legal',  'Requisitos legais específicos (GDPR, PCI-DSS, etc.)',         'tecnico',  1.20, false),
  ('equipa_distribuida',   'Equipa distribuída',       'Equipa em múltiplos fusos horários sem overlap diário',       'cliente',  1.10, false),
  ('sem_design',           'Sem design aprovado',      'Projecto inicia sem mockups ou design system definido',       'scope',    1.15, false),
  ('tecnologia_nova',      'Tecnologia experimental',  'Stack tecnológico sem histórico de produção na empresa',      'tecnico',  1.40, true),
  ('orcamento_indefinido', 'Orçamento indefinido',     'Cliente não tem orçamento definido — risco de scope creep',  'cliente',  1.30, true)
on conflict (key) do nothing;

-- ─────────────────────────────────────────────
-- CATALOG ITEMS
-- referencia rate_profiles por nome via subquery
-- ─────────────────────────────────────────────

-- Frontend / UI
insert into catalog_items (slug, name, description, category, pricing_type, default_hours, default_rate_profile_id, applicable_project_types) values
  ('design_ui',            'Design UI/UX',               'Wireframes, protótipos e design system em Figma',          'Design',    'hourly', 24,  (select id from rate_profiles where name = 'Designer'   limit 1), '["ecommerce","website_institucional","software_medida","saas"]'),
  ('frontend_base',        'Frontend base',              'Setup framework, routing, layout e componentes base',      'Frontend',  'hourly', 40,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["ecommerce","website_institucional","software_medida","saas","integracao_automacao"]'),
  ('responsive_mobile',    'Responsive / Mobile',        'Adaptação completa para dispositivos móveis',              'Frontend',  'hourly', 16,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["ecommerce","website_institucional","software_medida","saas"]'),
  ('cms_integracao',       'Integração CMS',             'Integração com headless CMS (Strapi, Contentful, etc.)',   'Frontend',  'hourly', 24,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["website_institucional","ecommerce"]'),
  ('multilingue',          'Multi-idioma (i18n)',         'Suporte a múltiplos idiomas com conteúdo dinâmico',        'Frontend',  'hourly', 20,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["website_institucional","ecommerce","saas"]'),

-- Backend / API
  ('backend_api',          'Backend API REST',           'API REST com autenticação, CRUD e lógica de negócio',      'Backend',   'hourly', 60,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["software_medida","saas","ecommerce","integracao_automacao"]'),
  ('autenticacao',         'Autenticação & Autorização', 'Login, roles, sessões e recuperação de password',          'Backend',   'hourly', 16,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["software_medida","saas","ecommerce"]'),
  ('pagamentos',           'Módulo de Pagamentos',       'Integração Stripe/MB WAY, checkout e webhooks',            'Backend',   'hourly', 32,  (select id from rate_profiles where name = 'Arquitecto'  limit 1), '["ecommerce","saas"]'),
  ('catalogo_produtos',    'Catálogo de Produtos',       'Gestão de produtos, variantes, stock e preços',             'Backend',   'hourly', 40,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["ecommerce"]'),
  ('gestao_encomendas',    'Gestão de Encomendas',       'Fluxo de encomendas, estados, notificações e histórico',   'Backend',   'hourly', 32,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["ecommerce"]'),
  ('subscricoes',          'Subscriptions / Billing',    'Planos de subscrição, ciclos de faturação e upgrades',      'Backend',   'hourly', 40,  (select id from rate_profiles where name = 'Arquitecto'  limit 1), '["saas"]'),
  ('multitenancy',         'Multi-tenancy',              'Isolamento de dados por organização/tenant',               'Backend',   'hourly', 48,  (select id from rate_profiles where name = 'Arquitecto'  limit 1), '["saas"]'),
  ('painel_admin',         'Painel de Administração',    'Backoffice para gestão de utilizadores, conteúdo e config', 'Backend',  'hourly', 32,  (select id from rate_profiles where name = 'Sénior'     limit 1), '["software_medida","saas","ecommerce"]'),

-- Infraestrutura / DevOps
  ('devops_ci_cd',         'CI/CD & Deploy',             'Pipeline de integração contínua e deploy automatizado',    'DevOps',    'hourly', 16,  (select id from rate_profiles where name = 'DevOps'     limit 1), '["software_medida","saas","integracao_automacao"]'),
  ('infra_cloud',          'Infraestrutura Cloud',       'Configuração de cloud (AWS/GCP/Azure), scaling e monit.',  'DevOps',    'hourly', 24,  (select id from rate_profiles where name = 'DevOps'     limit 1), '["saas","software_medida"]'),

-- Integrações
  ('integracao_erp',       'Integração ERP/CRM',         'Integração com ERP ou CRM existente via API ou ETL',       'Integração','hourly', 40,  (select id from rate_profiles where name = 'Arquitecto'  limit 1), '["software_medida","integracao_automacao"]'),
  ('integracao_email',     'Email transaccional',        'Setup Resend/SendGrid, templates e tracking',               'Integração','hourly', 8,   (select id from rate_profiles where name = 'Sénior'     limit 1), '["software_medida","saas","ecommerce","integracao_automacao"]'),
  ('webhooks',             'Webhooks & Event Bus',       'Sistema de eventos/webhooks para integrações externas',     'Integração','hourly', 20,  (select id from rate_profiles where name = 'Arquitecto'  limit 1), '["integracao_automacao","saas"]'),

-- Serviços fixos
  ('seo_tecnico',          'SEO Técnico',                'Meta tags, sitemap, robots.txt, schema.org e performance',  'Marketing', 'fixed',  null, null, '["website_institucional","ecommerce"]'),
  ('testes_qa',            'Testes & QA',                'Testes manuais, automatizados e relatório de bugs',         'Qualidade', 'hourly', 16,  (select id from rate_profiles where name = 'Júnior'    limit 1), '["software_medida","saas","ecommerce","website_institucional"]'),
  ('documentacao',         'Documentação técnica',       'Documentação de API, arquitectura e manual de utilizador',  'Qualidade', 'hourly', 8,   (select id from rate_profiles where name = 'Júnior'    limit 1), '["software_medida","saas","integracao_automacao"]'),
  ('formacao',             'Formação',                   'Sessão de formação para equipa do cliente (4h)',             'Suporte',   'fixed',  null, null, '["software_medida","saas","ecommerce","website_institucional"]')
on conflict (slug) do nothing;

-- set default_value for fixed items
update catalog_items set default_value = 500  where slug = 'seo_tecnico';
update catalog_items set default_value = 800  where slug = 'formacao';

-- ─────────────────────────────────────────────
-- SCOPING QUESTIONS — E-commerce
-- ─────────────────────────────────────────────
insert into scoping_questions (project_type_id, key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
select
  pt.id,
  q.key, q.label, q.description, q.question_type::question_type,
  q.options::jsonb, q.impacts_price, q.activates_modules::jsonb, q.triggers_risk::jsonb,
  q.sort_order, q.required
from project_types pt,
(values
  -- key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required
  ('ecom_tipo_catalogo',   'Dimensão do catálogo',          'Número estimado de produtos na loja',
   'numeric', '{"min":1,"max":10000}', true, null, null, 1, true),

  ('ecom_pagamentos',      'Métodos de pagamento',          'Quais métodos de pagamento são necessários?',
   'multi_select', '{"choices":["Cartão de crédito (Stripe)","MB WAY","Transferência bancária","PayPal","Multibanco"]}',
   true, '{"Cartão de crédito (Stripe)":["pagamentos"],"MB WAY":["pagamentos"]}', null, 2, true),

  ('ecom_gestao_encomendas','Gestão de encomendas',         'Necessita de fluxo completo de gestão de encomendas?',
   'single_choice', '{"choices":["Sim, completo","Apenas notificações por email","Não necessário"]}',
   true, '{"Sim, completo":["gestao_encomendas"]}', null, 3, true),

  ('ecom_integracao_erp',  'Integração com sistema existente','Existe ERP, ERP ou software de gestão para integrar?',
   'single_choice', '{"choices":["Sim","Não"]}',
   true, '{"Sim":["integracao_erp"]}',
   '{"condition":"eq","value":"Sim","risk_key":"integracao_legado"}', 4, true),

  ('ecom_multilingue',     'Número de idiomas',             'Quantos idiomas precisa a loja?',
   'numeric', '{"min":1,"max":10}', true,
   null,
   '{"condition":"gte","value":3,"risk_key":"multilingue_complexo"}', 5, true),

  ('ecom_prazo_semanas',   'Prazo de entrega (semanas)',    'Quantas semanas tem disponíveis para o projecto?',
   'numeric', '{"min":1,"max":52}', true, null,
   '{"condition":"lte","value":4,"risk_key":"prazo_agressivo"}', 6, true),

  ('ecom_design',          'Estado do design',              'Tem design aprovado ou é necessário criar de raiz?',
   'single_choice', '{"choices":["Tenho design aprovado","Necessito de design completo","Tenho referências/inspiração"]}',
   true, '{"Necessito de design completo":["design_ui"],"Tenho referências/inspiração":["design_ui"]}',
   '{"condition":"neq","value":"Tenho design aprovado","risk_key":"sem_design"}', 7, true),

  ('ecom_seo',             'SEO técnico',                   'Necessita de optimização SEO técnica?',
   'single_choice', '{"choices":["Sim","Não"]}',
   false, '{"Sim":["seo_tecnico"]}', null, 8, false)

) as q(key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
where pt.slug = 'ecommerce'
on conflict (project_type_id, key) do nothing;

-- ─────────────────────────────────────────────
-- SCOPING QUESTIONS — Website Institucional
-- ─────────────────────────────────────────────
insert into scoping_questions (project_type_id, key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
select
  pt.id,
  q.key, q.label, q.description, q.question_type::question_type,
  q.options::jsonb, q.impacts_price, q.activates_modules::jsonb, q.triggers_risk::jsonb,
  q.sort_order, q.required
from project_types pt,
(values
  ('web_paginas',          'Número de páginas',             'Quantas páginas distintas terá o site?',
   'numeric', '{"min":1,"max":100}', true, null, null, 1, true),

  ('web_cms',              'Gestão de conteúdo (CMS)',      'Necessita de CMS para gerir o conteúdo sem programador?',
   'single_choice', '{"choices":["Sim, obrigatório","Não necessário"]}',
   true, '{"Sim, obrigatório":["cms_integracao"]}', null, 2, true),

  ('web_multilingue',      'Número de idiomas',             'Quantos idiomas terá o site?',
   'numeric', '{"min":1,"max":10}', true, null,
   '{"condition":"gte","value":3,"risk_key":"multilingue_complexo"}', 3, true),

  ('web_design',           'Estado do design',              'Tem design aprovado ou é necessário criar?',
   'single_choice', '{"choices":["Tenho design aprovado","Necessito de design completo","Tenho referências/inspiração"]}',
   true, '{"Necessito de design completo":["design_ui"],"Tenho referências/inspiração":["design_ui"]}',
   null, 4, true),

  ('web_seo',              'SEO técnico',                   'Necessita de optimização SEO técnica?',
   'single_choice', '{"choices":["Sim","Não"]}',
   false, '{"Sim":["seo_tecnico"]}', null, 5, false),

  ('web_formularios',      'Formulários e integrações',     'Que integrações são necessárias?',
   'multi_select', '{"choices":["Formulário de contacto","Newsletter (Mailchimp/etc.)","Chat ao vivo","Nenhuma"]}',
   false, null, null, 6, false),

  ('web_prazo_semanas',    'Prazo de entrega (semanas)',    'Quantas semanas tem disponíveis?',
   'numeric', '{"min":1,"max":52}', true, null,
   '{"condition":"lte","value":4,"risk_key":"prazo_agressivo"}', 7, true)

) as q(key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
where pt.slug = 'website_institucional'
on conflict (project_type_id, key) do nothing;

-- ─────────────────────────────────────────────
-- SCOPING QUESTIONS — Software à Medida
-- ─────────────────────────────────────────────
insert into scoping_questions (project_type_id, key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
select
  pt.id,
  q.key, q.label, q.description, q.question_type::question_type,
  q.options::jsonb, q.impacts_price, q.activates_modules::jsonb, q.triggers_risk::jsonb,
  q.sort_order, q.required
from project_types pt,
(values
  ('sw_tipo_utilizadores',  'Tipos de utilizadores',         'Quantos papéis distintos terá a aplicação?',
   'numeric', '{"min":1,"max":20}', true, null, null, 1, true),

  ('sw_autenticacao',       'Autenticação',                  'Que método de autenticação é necessário?',
   'single_choice', '{"choices":["Email/password","SSO (Google, Azure AD)","Autenticação de 2 factores","Sem autenticação"]}',
   true, '{"Email/password":["autenticacao"],"SSO (Google, Azure AD)":["autenticacao"],"Autenticação de 2 factores":["autenticacao"]}',
   null, 2, true),

  ('sw_integracao_existente','Integração com sistemas',      'Existe algum sistema legado para integrar?',
   'single_choice', '{"choices":["Sim, com API disponível","Sim, sem API (base de dados directa)","Não"]}',
   true, '{"Sim, com API disponível":["integracao_erp"],"Sim, sem API (base de dados directa)":["integracao_erp"]}',
   '{"condition":"gte","value":1,"risk_key":"integracao_legado"}', 3, true),

  ('sw_compliance',         'Requisitos legais',             'Existem requisitos de compliance (GDPR, PCI, etc.)?',
   'single_choice', '{"choices":["Sim","Não"]}',
   true, null,
   '{"condition":"eq","value":"Sim","risk_key":"gdpr_compliance"}', 4, true),

  ('sw_tech_cliente',       'Equipa técnica do cliente',     'O cliente tem equipa técnica interna para validação?',
   'single_choice', '{"choices":["Sim","Não"]}',
   false, null,
   '{"condition":"eq","value":"Não","risk_key":"cliente_sem_tech"}', 5, true),

  ('sw_prazo_semanas',      'Prazo de entrega (semanas)',    'Quantas semanas tem disponíveis?',
   'numeric', '{"min":1,"max":52}', true, null,
   '{"condition":"lte","value":4,"risk_key":"prazo_agressivo"}', 6, true),

  ('sw_deploy',             'Deploy e infraestrutura',       'Necessita de setup de infraestrutura cloud?',
   'single_choice', '{"choices":["Sim, cloud gerida pela TargX","Sim, cloud do cliente","Não (servidor existente)"]}',
   true, '{"Sim, cloud gerida pela TargX":["infra_cloud","devops_ci_cd"]}', null, 7, true),

  ('sw_formacao',           'Formação ao cliente',           'Necessita de sessão de formação para equipa do cliente?',
   'single_choice', '{"choices":["Sim","Não"]}',
   false, '{"Sim":["formacao"]}', null, 8, false)

) as q(key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
where pt.slug = 'software_medida'
on conflict (project_type_id, key) do nothing;

-- ─────────────────────────────────────────────
-- SCOPING QUESTIONS — SaaS
-- ─────────────────────────────────────────────
insert into scoping_questions (project_type_id, key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
select
  pt.id,
  q.key, q.label, q.description, q.question_type::question_type,
  q.options::jsonb, q.impacts_price, q.activates_modules::jsonb, q.triggers_risk::jsonb,
  q.sort_order, q.required
from project_types pt,
(values
  ('saas_tenants',          'Modelo de multi-tenancy',       'Como é feito o isolamento de dados entre clientes?',
   'single_choice', '{"choices":["Tenant por schema (mais seguro)","Tenant por campo (mais simples)","Aplicação single-tenant"]}',
   true, '{"Tenant por schema (mais seguro)":["multitenancy"],"Tenant por campo (mais simples)":["multitenancy"]}',
   null, 1, true),

  ('saas_billing',          'Modelo de subscrição',          'Que modelo de faturação terá a plataforma?',
   'single_choice', '{"choices":["Mensal/anual com planos","Pay-per-use / créditos","Sem subscrição (licença)"]}',
   true, '{"Mensal/anual com planos":["subscricoes","pagamentos"],"Pay-per-use / créditos":["subscricoes","pagamentos"]}',
   null, 2, true),

  ('saas_painel_admin',     'Painel de administração',       'Necessita de backoffice para gestão da plataforma?',
   'single_choice', '{"choices":["Sim, completo","Apenas métricas básicas","Não"]}',
   true, '{"Sim, completo":["painel_admin"]}', null, 3, true),

  ('saas_autenticacao',     'Autenticação',                  'Método de autenticação para os utilizadores finais?',
   'multi_select', '{"choices":["Email/password","Google SSO","Microsoft SSO","Magic link"]}',
   true, '{"Email/password":["autenticacao"],"Google SSO":["autenticacao"],"Microsoft SSO":["autenticacao"],"Magic link":["autenticacao"]}',
   null, 4, true),

  ('saas_tech_stack',       'Stack tecnológico',             'Há alguma restrição de tecnologia imposta pelo cliente?',
   'single_choice', '{"choices":["Sem restrições (TargX decide)","Stack específico do cliente","Stack experimental/novo"]}',
   true, null,
   '{"condition":"eq","value":"Stack experimental/novo","risk_key":"tecnologia_nova"}', 5, true),

  ('saas_ci_cd',            'CI/CD e monitorização',         'Necessita de pipeline de CI/CD e monitorização?',
   'single_choice', '{"choices":["Sim, completo","Apenas deploy automatizado","Não"]}',
   true, '{"Sim, completo":["devops_ci_cd","infra_cloud"]}', null, 6, true),

  ('saas_prazo_semanas',    'Prazo de entrega (semanas)',    'Quantas semanas tem disponíveis?',
   'numeric', '{"min":1,"max":52}', true, null,
   '{"condition":"lte","value":4,"risk_key":"prazo_agressivo"}', 7, true)

) as q(key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
where pt.slug = 'saas'
on conflict (project_type_id, key) do nothing;

-- ─────────────────────────────────────────────
-- SCOPING QUESTIONS — Integração/Automação
-- ─────────────────────────────────────────────
insert into scoping_questions (project_type_id, key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
select
  pt.id,
  q.key, q.label, q.description, q.question_type::question_type,
  q.options::jsonb, q.impacts_price, q.activates_modules::jsonb, q.triggers_risk::jsonb,
  q.sort_order, q.required
from project_types pt,
(values
  ('int_sistemas',          'Sistemas a integrar',           'Quantos sistemas distintos serão integrados?',
   'numeric', '{"min":1,"max":20}', true, null,
   '{"condition":"gte","value":3,"risk_key":"integracao_legado"}', 1, true),

  ('int_api_disponivel',    'APIs disponíveis',              'Os sistemas têm APIs documentadas e disponíveis?',
   'single_choice', '{"choices":["Sim, todos têm API REST","Alguns têm API, outros não","Nenhum tem API"]}',
   true, '{"Sim, todos têm API REST":["webhooks"],"Alguns têm API, outros não":["integracao_erp","webhooks"],"Nenhum tem API":["integracao_erp"]}',
   '{"condition":"neq","value":"Sim, todos têm API REST","risk_key":"integracao_legado"}', 2, true),

  ('int_volume_dados',      'Volume de dados',               'Qual o volume de dados a processar por dia?',
   'single_choice', '{"choices":["Baixo (< 10k registos/dia)","Médio (10k–1M registos/dia)","Alto (> 1M registos/dia)"]}',
   true, null, null, 3, true),

  ('int_tempo_real',        'Tempo real vs batch',           'O processamento precisa de ser em tempo real?',
   'single_choice', '{"choices":["Sim, tempo real (< 1s)","Quase real (< 1 min)","Batch periódico (horas)"]}',
   true, '{"Sim, tempo real (< 1s)":["webhooks"],"Quase real (< 1 min)":["webhooks"]}',
   null, 4, true),

  ('int_monitoring',        'Monitorização e alertas',       'Necessita de monitorização e alertas de falha?',
   'single_choice', '{"choices":["Sim, completo","Apenas logs","Não"]}',
   true, '{"Sim, completo":["devops_ci_cd"]}', null, 5, false),

  ('int_email',             'Notificações por email',        'Necessita de notificações por email transaccional?',
   'single_choice', '{"choices":["Sim","Não"]}',
   false, '{"Sim":["integracao_email"]}', null, 6, false),

  ('int_prazo_semanas',     'Prazo de entrega (semanas)',    'Quantas semanas tem disponíveis?',
   'numeric', '{"min":1,"max":52}', true, null,
   '{"condition":"lte","value":4,"risk_key":"prazo_agressivo"}', 7, true)

) as q(key, label, description, question_type, options, impacts_price, activates_modules, triggers_risk, sort_order, required)
where pt.slug = 'integracao_automacao'
on conflict (project_type_id, key) do nothing;
