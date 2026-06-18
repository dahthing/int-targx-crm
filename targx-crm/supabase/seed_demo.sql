-- TargX CRM — Seed de Demonstração
-- Dados: clientes, leads, projectos para mostrar o sistema com conteúdo real
-- Utiliza o admin profile: f69c0a34-dc01-4bd2-92cf-1161d9357abc

-- ─────────────────────────────────────────────
-- CLIENTES
-- ─────────────────────────────────────────────
insert into clients (id, name, nif, sector, email, phone, website, created_by) values
  ('a1000000-0000-0000-0000-000000000001', 'Construtora Alvarez & Filhos Lda', '501234567', 'Construção', 'geral@alvarez.pt', '+351 21 345 6789', 'https://www.alvarez.pt', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc'),
  ('a1000000-0000-0000-0000-000000000002', 'Iberia Solar Energias Renováveis SA', '509876543', 'Energia', 'info@iberiasolar.pt', '+351 22 456 7890', 'https://www.iberiasolar.pt', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc'),
  ('a1000000-0000-0000-0000-000000000003', 'HotelGroup Premium SL', '512345678', 'Hotelaria', 'projetos@hotelgroup.pt', '+351 21 567 8901', NULL, 'f69c0a34-dc01-4bd2-92cf-1161d9357abc'),
  ('a1000000-0000-0000-0000-000000000004', 'Município de Vila Nova', NULL, 'Setor Público', 'obras@vilanovanew.pt', '+351 252 345 678', NULL, 'f69c0a34-dc01-4bd2-92cf-1161d9357abc'),
  ('a1000000-0000-0000-0000-000000000005', 'TechStart Solutions Unipessoal Lda', '523456789', 'Tecnologia', 'ceo@techstart.pt', '+351 912 345 678', 'https://www.techstart.pt', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- LEADS
-- ─────────────────────────────────────────────
insert into leads (id, client_id, partner_id, title, description, status, estimated_value, source, next_action, next_action_date, last_activity_at) values
  ('b1000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc',
   'Requalificação Sede Alvarez — Fase 2', 'Remodelação completa dos escritórios do piso 2 e 3. Cliente já aprovou orçamento preliminar.', 'proposta_enviada', 185000.00, 'Referência', 'Enviar contrato', now() + interval '3 days', now() - interval '2 days'),
  ('b1000000-0000-0000-0000-000000000002', 'a1000000-0000-0000-0000-000000000002', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc',
   'Instalação Painéis Solares — Complexo Norte', 'Sistema fotovoltaico 500kWp para autoconsumo industrial.', 'negociacao', 320000.00, 'LinkedIn', 'Reunião técnica com engenheiro', now() + interval '5 days', now() - interval '1 day'),
  ('b1000000-0000-0000-0000-000000000003', 'a1000000-0000-0000-0000-000000000003', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc',
   'Remodelação Hotel Beira Rio', 'Renovação de 40 quartos + lobby + restaurante. Abertura prevista para Março.', 'contactada', 240000.00, 'Cold outreach', 'Apresentar portefólio', now() + interval '7 days', now() - interval '10 days'),
  ('b1000000-0000-0000-0000-000000000004', 'a1000000-0000-0000-0000-000000000004', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc',
   'Centro Cultural Municipal — Concurso Público', 'Participação em concurso público para reabilitação do centro cultural histórico.', 'nova', 450000.00, 'Concurso Público', 'Verificar caderno de encargos', now() + interval '14 days', now() - interval '0 days'),
  ('b1000000-0000-0000-0000-000000000005', 'a1000000-0000-0000-0000-000000000005', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc',
   'Fit-out Escritórios TechStart', 'Novo espaço de trabalho para 80 colaboradores em Lisboa. Design moderno.', 'nova', 95000.00, 'Website', 'Visita ao espaço', now() + interval '4 days', now() - interval '3 days'),
  ('b1000000-0000-0000-0000-000000000006', 'a1000000-0000-0000-0000-000000000001', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc',
   'Armazém Logístico Alvarez — Setúbal', 'Construção de armazém 2.000m². Lead quente — cliente confirmou budget.', 'proposta_enviada', 560000.00, 'Existente', 'Follow-up proposta', now() + interval '2 days', now() - interval '5 days')
on conflict (id) do nothing;

-- ─────────────────────────────────────────────
-- ACTIVIDADES de leads
-- ─────────────────────────────────────────────
insert into lead_activities (lead_id, author_id, type, content, activity_at) values
  ('b1000000-0000-0000-0000-000000000001', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'reuniao', 'Reunião com director de operações. Aprovação verbal do âmbito. A aguardar validação formal.', now() - interval '2 days'),
  ('b1000000-0000-0000-0000-000000000001', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'proposta', 'Proposta enviada por email. Valor: 185.000€.', now() - interval '4 days'),
  ('b1000000-0000-0000-0000-000000000002', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'chamada', 'Call com CEO Iberia Solar. Confirmaram interesse. Pedir acesso à planta do complexo.', now() - interval '1 day'),
  ('b1000000-0000-0000-0000-000000000003', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'email', 'Email enviado com portefólio de projetos hoteleiros. Aguarda resposta.', now() - interval '10 days'),
  ('b1000000-0000-0000-0000-000000000005', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'nota', 'Contacto inicial via formulário website. Empresa em crescimento rápido, necessidade urgente.', now() - interval '3 days')
on conflict do nothing;

-- ─────────────────────────────────────────────
-- PROJECTOS com tranches (leads fechadas_ganha simuladas)
-- ─────────────────────────────────────────────
insert into projects (id, lead_id, client_id, partner_id, title, contract_value, contract_date, status, estimated_hours, actual_hours) values
  ('p1000000-0000-0000-0000-000000000001', null, 'a1000000-0000-0000-0000-000000000001', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'Sede Alvarez — Fase 1 (concluído)', 95000, '2026-01-10', 'concluido', 760, 810),
  ('p1000000-0000-0000-0000-000000000002', null, 'a1000000-0000-0000-0000-000000000002', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'Iberia Solar — Instalação Piloto', 45000, '2026-02-15', 'em_curso', 360, 180),
  ('p1000000-0000-0000-0000-000000000003', null, 'a1000000-0000-0000-0000-000000000005', 'f69c0a34-dc01-4bd2-92cf-1161d9357abc', 'TechStart — Fit-out Parcial', 38000, '2026-03-20', 'em_curso', 300, 120)
on conflict (id) do nothing;

insert into project_tranches (project_id, description, amount, due_date, received, received_date) values
  ('p1000000-0000-0000-0000-000000000001', 'Adjudicação 40%', 38000, '2026-01-15', true, '2026-01-17'),
  ('p1000000-0000-0000-0000-000000000001', 'Entrega intermédia 30%', 28500, '2026-03-01', true, '2026-03-04'),
  ('p1000000-0000-0000-0000-000000000001', 'Fecho 30%', 28500, '2026-04-15', true, '2026-04-18'),
  ('p1000000-0000-0000-0000-000000000002', 'Adjudicação 40%', 18000, '2026-02-20', true, '2026-02-22'),
  ('p1000000-0000-0000-0000-000000000002', 'Conclusão fase 1 60%', 27000, '2026-05-01', false, null),
  ('p1000000-0000-0000-0000-000000000003', 'Adjudicação 50%', 19000, '2026-03-25', true, '2026-03-26'),
  ('p1000000-0000-0000-0000-000000000003', 'Entrega final 50%', 19000, '2026-05-15', false, null)
on conflict do nothing;

-- Comissões para as tranches recebidas (15% — escalão base)
insert into commissions (tranche_id, partner_id, project_id, year, tranche_amount, rate_percent, commission_amount, tier_label)
select
  pt.id,
  p.partner_id,
  p.id,
  2026,
  pt.amount,
  15.00,
  round(pt.amount * 0.15, 2),
  'Escalão Base'
from project_tranches pt
join projects p on p.id = pt.project_id
where pt.received = true
  and p.partner_id = 'f69c0a34-dc01-4bd2-92cf-1161d9357abc'
  and p.id like 'p1000000%'
on conflict do nothing;

-- ─────────────────────────────────────────────
-- OBJECÇÕES de demonstração
-- ─────────────────────────────────────────────
insert into objection_playbook (category, objection, response, context, tags) values
  ('preco', 'O vosso preço é mais caro do que a concorrência', 'A TargX entrega soluções integradas com o vosso ERP e sistemas existentes. Uma solução genérica barata exige meses de adaptação e integrações frágeis. O verdadeiro custo é o total incluindo manutenção e tempo da vossa equipa.', 'Usar quando o cliente compara com fornecedores genéricos', ARRAY['preço', 'valor', 'ROI']),
  ('prazo', 'Precisamos disso em 4 semanas', 'Com a nossa metodologia e equipa técnica dedicada, conseguimos entregar fases funcionais rapidamente. Vamos definir um âmbito MVP que respeite o prazo e deixa funcionalidades secundárias para fase 2.', 'Usar quando o prazo é irreal para o âmbito pedido', ARRAY['prazo', 'MVP', 'fases']),
  ('tecnologia', 'Já temos uma solução interna que funciona', 'A questão não é substituir o que funciona, mas ligar os sistemas que já têm com os novos canais digitais. A TargX especializa-se em integrações — complementamos o que já existe.', 'Usar quando o cliente tem sistemas legados e receio de mudança', ARRAY['integração', 'legado', 'complementar']),
  ('concorrencia', 'Já temos uma proposta de outra empresa mais barata', 'Posso mostrar-vos o detalhe do que está incluído na nossa proposta? Frequentemente a diferença de preço reflecte âmbito diferente — nós incluímos integração e suporte pós-lançamento.', 'Usar quando o cliente menciona concorrência sem dar detalhes', ARRAY['concorrência', 'âmbito', 'comparação'])
on conflict do nothing;
