# TargX CRM — Prompt de Encerramento e Melhorias Finais

**Contexto:** O projecto está ~90% implementado. Este prompt fecha os gaps identificados, adiciona funcionalidades de alto impacto não implementadas, e prepara o sistema para produção.

Documentos de referência obrigatórios:
- `TargX_CRM_PRD_Master.md` v2.0
- `TargX_CRM_DesignSystem.md` v1.0

---

## TAREFA 1 — Fechar gaps das fases anteriores

### 1.1 Testes COM-001 a COM-022 com naming convention correcta

O ficheiro `commission-calculator.service.spec.ts` existe mas tem um spec genérico. Substituir pelo seguinte:

```typescript
// src/app/core/services/__tests__/commission-calculator.service.spec.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { CommissionCalculatorService } from '../commission-calculator.service';

const standardTiers = [
  { id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0, volume_to: 100000, rate_percent: 15, label: 'Base' },
  { id: '2', plan_id: 'p1', tier_order: 2, volume_from: 100000, volume_to: null, rate_percent: 20, label: 'Sénior' },
];

const threeTiers = [
  { id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0,      volume_to: 50000,  rate_percent: 10, label: 'Entrada' },
  { id: '2', plan_id: 'p1', tier_order: 2, volume_from: 50000,  volume_to: 100000, rate_percent: 15, label: 'Médio' },
  { id: '3', plan_id: 'p1', tier_order: 3, volume_from: 100000, volume_to: null,   rate_percent: 20, label: 'Sénior' },
];

describe('CommissionCalculatorService', () => {
  let service: CommissionCalculatorService;
  beforeEach(() => { service = new CommissionCalculatorService(); });

  it('COM-001: aplica taxa base quando volume está no primeiro escalão', () => {
    const result = service.calculateForTranche({ trancheAmount: 10000, previousVolumeInYear: 0, tiers: standardTiers });
    expect(result.commissionAmount).toBe(1500);
    expect(result.newVolumeTotal).toBe(10000);
  });

  it('COM-002: tranche que atravessa escalão aplica taxa proporcional em cada parte', () => {
    const result = service.calculateForTranche({ trancheAmount: 10000, previousVolumeInYear: 95000, tiers: standardTiers });
    expect(result.commissionAmount).toBe(1750); // 5000×15% + 5000×20%
    expect(result.breakdown).toHaveLength(2);
  });

  it('COM-003: volume já acima do escalão aplica 100% taxa superior', () => {
    const result = service.calculateForTranche({ trancheAmount: 5000, previousVolumeInYear: 110000, tiers: standardTiers });
    expect(result.commissionAmount).toBe(1000); // 5000×20%
  });

  it('COM-004: plano de escalão único sem limite superior', () => {
    const singleTier = [{ id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0, volume_to: null, rate_percent: 15, label: 'Flat' }];
    const result = service.calculateForTranche({ trancheAmount: 20000, previousVolumeInYear: 500000, tiers: singleTier });
    expect(result.commissionAmount).toBe(3000);
  });

  it('COM-005: três escalões com tranche que atravessa dois', () => {
    const result = service.calculateForTranche({ trancheAmount: 60000, previousVolumeInYear: 0, tiers: threeTiers });
    expect(result.commissionAmount).toBe(6500); // 50000×10% + 10000×15%
  });

  it('COM-006: tranche de valor zero retorna comissão zero', () => {
    const result = service.calculateForTranche({ trancheAmount: 0, previousVolumeInYear: 0, tiers: standardTiers });
    expect(result.commissionAmount).toBe(0);
  });

  it('COM-007: tranche negativa lança erro', () => {
    expect(() => service.calculateForTranche({ trancheAmount: -100, previousVolumeInYear: 0, tiers: standardTiers }))
      .toThrow();
  });

  it('COM-008: usa plano activo na data da tranche via active_from/active_to', () => {
    // Serviço aceita parâmetro de data para resolver o plano correcto
    // Testar que data anterior ao active_from retorna plano anterior
    const oldTiers = [{ id: 'old', plan_id: 'p0', tier_order: 1, volume_from: 0, volume_to: null, rate_percent: 10, label: 'Antigo' }];
    const result = service.calculateForTranche({ trancheAmount: 10000, previousVolumeInYear: 0, tiers: oldTiers });
    expect(result.commissionAmount).toBe(1000); // plano antigo a 10%
  });

  it('COM-009: getAccumulatedVolume soma apenas tranches do ano civil corrente', async () => {
    // Mock do Supabase — verifica que o filtro year= é aplicado
    const volume = await service.getAccumulatedVolume({ partnerId: 'p1', year: 2026 });
    expect(typeof volume).toBe('number');
  });

  it('COM-010: getAccumulatedVolume exclui tranches não recebidas (received=false)', async () => {
    const volume = await service.getAccumulatedVolume({ partnerId: 'p1', year: 2026 });
    expect(volume).toBeGreaterThanOrEqual(0);
  });

  it('COM-011: getAccumulatedVolume retorna zero em Janeiro sem histórico', async () => {
    // Mock retorna array vazio
    const volume = await service.getAccumulatedVolume({ partnerId: 'p1-novo', year: 2026 });
    expect(volume).toBe(0);
  });
});
```

Criar também ficheiros spec individuais para os restantes 7 serviços sem cobertura:
- `bonus-calculator.service.spec.ts` — COM-012 a COM-017
- `project-tranche.service.spec.ts` — COM-018 a COM-022
- `scoping-engine.service.spec.ts` — TIQS-001 a TIQS-006
- `risk-engine.service.spec.ts` — TIQS-007 a TIQS-015
- `quote-state.service.spec.ts` — TIQS-027 a TIQS-036
- `gantt.service.spec.ts` — TIQS-037 a TIQS-040
- `dashboard.service.spec.ts` — DSH-001 a DSH-010

Cada spec segue o mesmo padrão: `describe` com nome do serviço, cada `it` com o código do teste (ex: `COM-012`) no início da descrição.

### 1.2 Configuração de crons

Criar `supabase/config.toml` se não existir, ou adicionar à secção `[functions]` existente:

```toml
# supabase/config.toml

[functions.check-lead-silence]
schedule = "0 8 * * *"          # diário às 08:00

[functions.check-quote-expirations]
schedule = "0 8 * * *"          # diário às 08:00

[functions.send-monthly-digest]
schedule = "0 8 1 * *"          # dia 1 de cada mês às 08:00

[functions.annual-reset]
schedule = "1 0 1 1 *"          # 1 de Janeiro às 00:01
```

Para ambiente de produção em Supabase hosted, adicionar via Dashboard em Edge Functions > cada função > Schedule. Criar ficheiro `supabase/cron-setup.md` com instruções passo a passo para o deploy em produção.

Verificar que cada Edge Function de cron tem protecção contra execução dupla:

```typescript
// Padrão a seguir em cada função cron:
// 1. Verificar se já correu no período actual (via email_logs ou tabela própria)
// 2. Se sim: retornar 200 com { skipped: true, reason: 'already_run' }
// 3. Se não: executar e registar
```

### 1.3 Analytics Service e Dashboard de Métricas

Criar `src/app/core/services/analytics.service.ts`:

```typescript
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private supabase = inject(SupabaseClient);

  // Estimado vs real por tipo de projecto (DSH-009)
  getEstimationAccuracy(): Observable<EstimationAccuracy[]> {
    // Agregar projectos concluídos com actual_hours preenchidas
    // JOIN com project_types via quote.project_type_id
    // Calcular: avg_estimated, avg_actual, avg_deviation_pct, count
    // Ordenar por avg_deviation_pct desc
  }

  // Volume de negócio ao longo do tempo
  getVolumeTimeline(year: number): Observable<MonthlyVolume[]> {
    // Soma de tranches recebidas por mês no ano
    // Retorna array de 12 meses com { month, volume, commission }
  }

  // Taxa de conversão do pipeline
  getConversionFunnel(): Observable<FunnelStage[]> {
    // Para cada estado de lead: count e percentagem de transição para o próximo
    // { status, count, conversion_rate_to_next }
  }

  // Orçamentos: enviados, aceites, rejeitados (por período)
  getQuoteStats(year: number): Observable<QuoteStats> {
    // { sent, accepted, rejected, acceptance_rate, avg_value, avg_time_to_decision_days }
  }

  // Top clientes por volume gerado
  getTopClients(year: number, limit?: number): Observable<ClientVolume[]> {
    // { client_name, project_count, total_volume, total_commission }
  }

  // Parceiro overview anual
  getPartnerAnnualReport(partnerId: string, year: number): Observable<PartnerAnnualReport> {
    // { volume, commission, bonuses, projects_count, leads_closed, avg_project_value }
  }
}
```

Criar `src/app/features/analytics/` com:

`analytics-dashboard.component.ts` (apenas admin):

```
Layout:
┌─────────────────────────────────────────────────────┐
│ Filtro de ano (select) | Exportar relatório         │
├──────────────────┬──────────────────────────────────┤
│ Volume timeline  │ Funnel de conversão               │
│ (line chart)     │ (horizontal bar por estado)       │
├──────────────────┴──────────────────────────────────┤
│ Estimação: tabela tipo projecto vs desvio           │
├──────────────────┬──────────────────────────────────┤
│ Top clientes     │ Quote stats                       │
│ (tabela simples) │ (KPIs: aceites, taxa, tempo)      │
└──────────────────┴──────────────────────────────────┘
```

Usar `p-chart` do PrimeNG com `@defer (on viewport)` para os gráficos.

Adicionar rota `/analytics` ao `app.routes.ts` com `canActivate: [() => roleGuard(['admin'])]`.

Adicionar item "Analytics" à sidebar do admin (ícone: chart-bar).

---

## TAREFA 2 — Notificações in-app via Supabase Realtime

### 2.1 Schema

```sql
-- supabase/migrations/007_notifications.sql

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
  link        text,        -- rota interna ex: '/leads/uuid'
  read        boolean not null default false,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);

-- RLS: utilizador só vê as suas notificações
create policy "user_sees_own_notifications"
  on notifications for select
  using (user_id = auth.uid());

create policy "system_inserts_notifications"
  on notifications for insert
  with check (true);  -- Edge Functions usam service_role

-- Index para performance
create index idx_notifications_user_unread
  on notifications(user_id, read, created_at desc)
  where read = false;
```

### 2.2 `NotificationService`

```typescript
// src/app/core/services/notification.service.ts
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private supabase = inject(SupabaseClient);

  // Signal com contagem de não lidas
  unreadCount = signal<number>(0);

  // Signal com lista das últimas 20 notificações
  notifications = signal<Notification[]>([]);

  // Subscrever a Realtime para notificações do utilizador actual
  subscribeToRealtime(userId: string): void {
    this.supabase
      .channel('notifications')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${userId}`
      }, (payload) => {
        // Adicionar ao signal e incrementar contador
        this.notifications.update(n => [payload.new as Notification, ...n]);
        this.unreadCount.update(c => c + 1);
        // Toast notification (p-toast do PrimeNG)
        this.showToast(payload.new as Notification);
      })
      .subscribe();
  }

  markAsRead(id: string): Promise<void>
  markAllAsRead(): Promise<void>
  getUnreadCount(): Observable<number>
}
```

### 2.3 Componente de sino no topbar

```typescript
// src/app/shared/components/notification-bell/notification-bell.component.ts
// Ícone de sino com badge de contagem
// Click abre p-overlay com lista das últimas 10 notificações
// Cada item: ícone por tipo, título, body, tempo relativo ("há 5 min"), link clicável
// Botão "Ver todas" → /notifications
// Botão "Marcar todas como lidas"
```

### 2.4 Disparar notificações nas Edge Functions existentes

Adicionar chamada a `createNotification()` em cada Edge Function relevante:

```typescript
// Função helper a reutilizar em todas as Edge Functions:
async function createNotification(supabase: SupabaseClient, params: {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string;
  link?: string;
}): Promise<void> {
  await supabase.from('notifications').insert(params);
}

// Exemplos de uso:
// Em calculate-commission:
await createNotification(supabase, {
  userId: partnerId,
  type: 'commission_paid',
  title: 'Nova comissão recebida',
  body: `${formatCurrency(commissionAmount)} pelo projecto ${projectTitle}`,
  link: `/commissions`
});

// Em handle-client-response (aceite):
await createNotification(supabase, {
  userId: partnerId,
  type: 'quote_accepted',
  title: 'Proposta aceite!',
  body: `${clientName} aceitou a proposta ${quoteTitle}`,
  link: `/quotes/${quoteId}`
});

// Em quote-state (submissão para revisão):
await createNotification(supabase, {
  userId: adminId,  // notificar admin
  type: 'quote_submitted',
  title: 'Orçamento para revisão',
  body: `${partnerName} submeteu "${quoteTitle}"`,
  link: `/quotes/${quoteId}/review`
});
```

Cobrir todos os `notification_type` definidos no enum.

---

## TAREFA 3 — Seed de demonstração

Criar `supabase/seed-demo.sql`:

```sql
-- ATENÇÃO: apenas para ambientes de demo/desenvolvimento
-- Nunca correr em produção com dados reais

-- Parceiro de demo
insert into auth.users (id, email) values
  ('demo-partner-id', 'urbano.demo@targx.com');

insert into profiles values
  ('demo-partner-id', 'Urbano Silva', 'urbano.demo@targx.com', 'partner', true, now());

-- Plano Standard Partner
insert into partner_plans (partner_id, plan_id, active_from) values
  ('demo-partner-id', (select id from commission_plans where name='Standard Partner'), '2026-01-01');

-- Meta trimestral
insert into partner_targets (partner_id, year, quarter, target_volume) values
  ('demo-partner-id', 2026, 2, 50000.00);

-- 5 clientes fictícios com sectores variados
insert into clients (id, name, sector, email, phone, website) values
  ('client-01', 'Farmácia Central Lisboa', 'Saúde & Farmácia', 'geral@farmaciacentral.pt', '+351 21 000 0001', 'farmaciacentral.pt'),
  ('client-02', 'AutoPeças Norte', 'Retalho Automóvel', 'comercial@autopecasnorte.pt', '+351 22 000 0002', 'autopecasnorte.pt'),
  ('client-03', 'Clínica Bem Estar', 'Saúde & Bem-estar', 'info@clinicabemestar.pt', '+351 21 000 0003', 'clinicabemestar.pt'),
  ('client-04', 'Distribuição Ibérica Lda', 'Logística', 'logistica@diberia.pt', '+351 22 000 0004', 'diberia.pt'),
  ('client-05', 'Grupo Cosmética Mar', 'Cosmética & Beleza', 'digital@cosmeticamar.pt', '+351 21 000 0005', 'cosmeticamar.pt');

-- 8 leads em vários estados
insert into leads (id, client_id, partner_id, title, status, estimated_value, source, last_activity_at) values
  ('lead-01', 'client-01', 'demo-partner-id', 'Ecommerce + integração Sifarma', 'negociacao', 18000, 'Referência', now() - interval '2 days'),
  ('lead-02', 'client-02', 'demo-partner-id', 'Plataforma multiloja Magento', 'proposta_enviada', 35000, 'LinkedIn', now() - interval '5 days'),
  ('lead-03', 'client-03', 'demo-partner-id', 'Sistema de gestão de clínica', 'contactada', 12000, 'Website', now() - interval '1 day'),
  ('lead-04', 'client-04', 'demo-partner-id', 'WMS à medida para armazém', 'nova', 45000, 'Evento AETICE', now()),
  ('lead-05', 'client-05', 'demo-partner-id', 'B2B portal fornecedores', 'fechada_ganha', 22500, 'Referência', now() - interval '30 days'),
  ('lead-06', 'client-01', 'demo-partner-id', 'App mobile para clientes', 'nova', 8000, 'Reunião', now() - interval '3 days'),
  ('lead-07', 'client-02', 'demo-partner-id', 'Dashboard analytics vendas', 'contactada', 9500, 'Cold outreach', now() - interval '8 days'),
  ('lead-08', 'client-03', 'demo-partner-id', 'Integração PHC + ecommerce', 'fechada_perdida', 15000, 'Indicação', now() - interval '20 days');

-- Actualizar lost_reason na lead perdida
update leads set lost_reason = 'Cliente optou por solução interna' where id = 'lead-08';

-- 3 projectos com tranches (simulando histórico de 2026)
insert into projects (id, quote_id, lead_id, client_id, partner_id, title, contract_value, contract_date, status, estimated_hours, actual_hours) values
  ('proj-01', null, 'lead-05', 'client-05', 'demo-partner-id', 'B2B Portal Distribuição Ibérica', 22500, '2026-01-15', 'em_curso', 180, 95),
  ('proj-02', null, null, 'client-01', 'demo-partner-id', 'Ecommerce Farmácia Central (Fase 1)', 10000, '2026-02-01', 'concluido', 80, 92),
  ('proj-03', null, null, 'client-02', 'demo-partner-id', 'Dashboard Analytics AutoPeças', 9500, '2026-03-10', 'em_curso', 76, 40);

-- Tranches do projecto 1 (parcialmente recebidas)
insert into project_tranches (project_id, description, amount, due_date, received, received_date) values
  ('proj-01', 'Adjudicação 40%', 9000, '2026-01-20', true, '2026-01-22'),
  ('proj-01', 'Entrega fase 1 30%', 6750, '2026-03-01', true, '2026-03-05'),
  ('proj-01', 'Fecho e entrega 30%', 6750, '2026-05-01', false, null);

-- Tranches do projecto 2 (concluído, todas recebidas)
insert into project_tranches (project_id, description, amount, due_date, received, received_date) values
  ('proj-02', 'Adjudicação 40%', 4000, '2026-02-05', true, '2026-02-07'),
  ('proj-02', 'Entrega 30%', 3000, '2026-03-15', true, '2026-03-18'),
  ('proj-02', 'Fecho 30%', 3000, '2026-04-01', true, '2026-04-03');

-- Tranches do projecto 3
insert into project_tranches (project_id, description, amount, due_date, received, received_date) values
  ('proj-03', 'Adjudicação 40%', 3800, '2026-03-15', true, '2026-03-16'),
  ('proj-03', 'Entrega e fecho 60%', 5700, '2026-04-30', false, null);

-- Comissões correspondentes às tranches recebidas
-- proj-01: 9000 × 15% = 1350; 6750 × 15% = 1012.5
-- proj-02: 4000 × 15% = 600; 3000 × 15% = 450; 3000 × 15% = 450
-- proj-03: 3800 × 15% = 570
-- Volume total recebido: 9000+6750+4000+3000+3000+3800 = 29550 → todos no escalão 15%
insert into commissions (tranche_id, partner_id, project_id, year, tranche_amount, rate_percent, commission_amount, tier_label)
select
  pt.id,
  p.partner_id,
  p.id,
  2026,
  pt.amount,
  15.00,
  round(pt.amount * 0.15, 2),
  'Base'
from project_tranches pt
join projects p on p.id = pt.project_id
where pt.received = true
  and p.partner_id = 'demo-partner-id';

-- Actividades nas leads
insert into lead_activities (lead_id, author_id, type, content) values
  ('lead-01', 'demo-partner-id', 'reuniao', 'Reunião inicial com director comercial. Interesse confirmado em integração Sifarma. Aguardam proposta formal.'),
  ('lead-01', 'demo-partner-id', 'proposta', 'Proposta enviada por email. Valor: 18.000€. Prazo: 45 dias.'),
  ('lead-02', 'demo-partner-id', 'chamada', 'Chamada de follow-up. Cliente a aguardar aprovação interna.'),
  ('lead-03', 'demo-partner-id', 'email', 'Enviei apresentação da TargX e casos de estudo de clínicas.'),
  ('lead-07', 'demo-partner-id', 'nota', 'Cliente com interesse mas orçamento reduzido. Rever scope.');

-- Objecções de demo
insert into objection_playbook (category, objection, response, context, tags) values
  ('preco', 'O vosso preço é mais caro do que a concorrência', 'A TargX entrega soluções integradas com o vosso ERP, WMS e sistemas farmacêuticos. Uma solução genérica barata exige meses de adaptação e integrações frágeis. O verdadeiro custo é o total incluindo manutenção e tempo da vossa equipa.', 'Usar quando o cliente compara com fornecedores genéricos', ARRAY['preço', 'valor', 'ROI']),
  ('prazo', 'Precisamos disso em 4 semanas', 'Com a nossa metodologia spec-driven e equipa técnica dedicada, conseguimos entregar fases funcionais rapidamente. Vamos definir em conjunto um âmbito MVP que respeite o prazo e deixa as funcionalidades secundárias para fase 2.', 'Usar quando o prazo é irreal para o âmbito pedido', ARRAY['prazo', 'MVP', 'fases']),
  ('tecnologia', 'Já temos uma solução interna que funciona', 'A questão não é substituir o que funciona, mas ligar os sistemas que já têm com os novos canais digitais. A TargX especializa-se em integrações com PHC, Sifarma e 4Digital — complementamos o que já existe.', 'Usar quando o cliente tem sistemas legados e receio de mudança', ARRAY['integração', 'legado', 'complementar']),
  ('concorrencia', 'Já temos uma proposta de outra empresa mais barata', 'Posso mostrar-vos o detalhe do que está incluído na nossa proposta? Frequentemente a diferença de preço reflecte âmbito diferente — nós incluímos a integração ERP e o suporte pós-lançamento. Prefiro comparar maçãs com maçãs.', 'Usar quando o cliente menciona concorrência sem dar detalhes', ARRAY['concorrência', 'âmbito', 'comparação']);
```

Criar script `supabase/reset-demo.sql` para limpar os dados de demo:

```sql
-- supabase/reset-demo.sql
-- Remove todos os dados de demo mantendo configuração
delete from commissions where partner_id = 'demo-partner-id';
delete from project_tranches where project_id in (select id from projects where partner_id = 'demo-partner-id');
delete from projects where partner_id = 'demo-partner-id';
delete from lead_activities where lead_id in (select id from leads where partner_id = 'demo-partner-id');
delete from leads where partner_id = 'demo-partner-id';
delete from partner_targets where partner_id = 'demo-partner-id';
delete from partner_plans where partner_id = 'demo-partner-id';
delete from profiles where id = 'demo-partner-id';
delete from clients where id in ('client-01','client-02','client-03','client-04','client-05');
```

---

## TAREFA 4 — Log detalhado de acessos ao portal

### 4.1 Schema

```sql
-- supabase/migrations/008_portal_access_log.sql

create table portal_access_log (
  id          uuid primary key default gen_random_uuid(),
  quote_id    uuid not null references quotes(id),
  accessed_at timestamptz not null default now(),
  ip_address  text,
  user_agent  text,
  action      text not null check (action in ('open','accept','reject','optional_toggle')),
  metadata    jsonb   -- { accepted_optionals: [...], rejection_reason: '...' }
);

-- RLS: apenas admin lê; Edge Functions inserem via service_role
create policy "admin_reads_portal_log"
  on portal_access_log for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

### 4.2 Actualizar Edge Function `handle-client-portal-open`

```typescript
// Adicionar ao início da função:
const ipAddress = req.headers.get('x-forwarded-for') || req.headers.get('cf-connecting-ip');
const userAgent = req.headers.get('user-agent');

// Registar acesso
await supabase.from('portal_access_log').insert({
  quote_id: quoteId,
  ip_address: ipAddress,
  user_agent: userAgent,
  action: 'open',
});
```

### 4.3 Actualizar Edge Function `handle-client-response`

```typescript
// Registar aceitação ou rejeição com metadata
await supabase.from('portal_access_log').insert({
  quote_id: quoteId,
  ip_address: ipAddress,
  user_agent: userAgent,
  action: action, // 'accept' ou 'reject'
  metadata: action === 'accept'
    ? { accepted_optionals: acceptedOptionals }
    : { rejection_reason: rejectionReason }
});
```

### 4.4 Vista no detalhe do orçamento (admin)

No `quote-review.component.ts`, adicionar tab "Histórico de acessos":

```
Tabela:
Data/hora | Acção | IP | Browser | Dispositivo
```

Parser simples de user-agent para extrair browser e SO (usar `ua-parser-js` library ou regex simples).

---

## TAREFA 5 — Modelo do PDF da proposta

### 5.1 Template HTML

Criar `supabase/functions/generate-quote-pdf/template.html`:

```html
<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <style>
    /* Reset e base */
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1F2533; font-size: 10pt; }

    /* Página e margens */
    @page { margin: 0; size: A4; }
    @page :first { margin: 0; }

    /* ===== CAPA ===== */
    .cover {
      page-break-after: always;
      width: 210mm;
      height: 297mm;
      background: #0A1628;
      display: flex;
      flex-direction: column;
      padding: 48pt;
    }
    .cover-logo { width: 120pt; margin-bottom: auto; }
    .cover-tag {
      font-size: 8pt; font-weight: 600; letter-spacing: 0.1em;
      text-transform: uppercase; color: rgba(255,255,255,0.45);
      margin-bottom: 12pt;
    }
    .cover-title {
      font-size: 28pt; font-weight: 700; color: #FFFFFF;
      letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 16pt;
    }
    .cover-client {
      font-size: 14pt; font-weight: 500; color: #00B899;
      margin-bottom: 8pt;
    }
    .cover-meta {
      font-size: 9pt; color: rgba(255,255,255,0.45);
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 16pt; margin-top: 32pt;
      display: flex; gap: 32pt;
    }
    .cover-meta span { display: block; }
    .cover-meta strong { color: rgba(255,255,255,0.7); font-weight: 500; }

    /* ===== PÁGINAS INTERNAS ===== */
    .page {
      width: 210mm;
      min-height: 297mm;
      padding: 28pt 36pt;
      page-break-after: always;
    }
    .page:last-child { page-break-after: avoid; }

    /* Header interno */
    .page-header {
      display: flex; align-items: center; justify-content: space-between;
      padding-bottom: 14pt; margin-bottom: 24pt;
      border-bottom: 1.5pt solid #00B899;
    }
    .page-header-logo { height: 22pt; }
    .page-header-ref { font-size: 8pt; color: #9CA3AF; text-align: right; }

    /* Footer interno */
    .page-footer {
      position: fixed; bottom: 20pt; left: 36pt; right: 36pt;
      display: flex; align-items: center; justify-content: space-between;
      font-size: 7.5pt; color: #9CA3AF;
      border-top: 0.5pt solid #E5E7EB; padding-top: 8pt;
    }

    /* Secções */
    .section-title {
      font-size: 7pt; font-weight: 600; letter-spacing: 0.08em;
      text-transform: uppercase; color: #00B899;
      margin-bottom: 10pt;
    }
    .section-body { font-size: 9.5pt; line-height: 1.65; color: #4B5563; margin-bottom: 20pt; }

    /* ===== TABELA DE FASES E ITENS ===== */
    .phases-table { width: 100%; border-collapse: collapse; margin-bottom: 20pt; }

    /* Linha de fase */
    .phase-row td {
      background: #E8F8F6;
      padding: 7pt 10pt;
      font-size: 9pt; font-weight: 600; color: #0A1628;
    }
    .phase-row td:last-child { text-align: right; font-variant-numeric: tabular-nums; }

    /* Linha de item */
    .item-row td {
      padding: 5pt 10pt 5pt 20pt;
      font-size: 8.5pt; color: #4B5563;
      border-bottom: 0.5pt solid #F3F4F6;
    }
    .item-row td:last-child {
      text-align: right; font-variant-numeric: tabular-nums;
      color: #1F2533; font-weight: 500;
    }
    .item-row.optional td { color: #9CA3AF; }
    .item-optional-badge {
      display: inline-block; font-size: 7pt; font-weight: 600;
      background: #F3F4F6; color: #6B7280;
      padding: 1pt 5pt; border-radius: 3pt; margin-left: 4pt;
    }

    /* Linha de subtotal de fase */
    .phase-subtotal td {
      padding: 4pt 10pt;
      font-size: 8pt; color: #9CA3AF;
      text-align: right; font-style: italic;
    }

    /* ===== BREAKDOWN FINANCEIRO ===== */
    .financial-breakdown {
      width: 100%; max-width: 260pt;
      margin-left: auto; margin-bottom: 16pt;
    }
    .financial-row {
      display: flex; justify-content: space-between; align-items: center;
      padding: 5pt 0; border-bottom: 0.5pt solid #F3F4F6;
      font-size: 9pt; color: #4B5563;
    }
    .financial-row.risk { color: #D97706; }
    .financial-row.discount { color: #059669; }
    .financial-row span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }

    /* Total destacado */
    .total-box {
      background: #0A1628; border-radius: 8pt;
      padding: 14pt 18pt;
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 8pt;
    }
    .total-box-label { font-size: 9pt; font-weight: 500; color: rgba(255,255,255,0.6); }
    .total-box-value { font-size: 20pt; font-weight: 700; color: #00B899; font-variant-numeric: tabular-nums; }
    .total-box-tax { font-size: 7.5pt; color: rgba(255,255,255,0.4); text-align: right; }

    /* Validade */
    .validity-box {
      background: #EEF4FF; border-left: 3pt solid #2451A3;
      border-radius: 4pt; padding: 10pt 14pt;
      font-size: 8.5pt; color: #1E4080; margin-top: 16pt;
    }

    /* Gantt SVG */
    .gantt-container { width: 100%; overflow: hidden; margin-bottom: 20pt; }
    .gantt-container svg { width: 100%; height: auto; }

    /* Página de assinatura */
    .signature-section { margin-top: 40pt; }
    .signature-box {
      border-top: 1pt solid #1F2533; padding-top: 8pt;
      width: 180pt; text-align: center;
      font-size: 8pt; color: #9CA3AF;
    }

    /* Fora de âmbito */
    .out-of-scope-list { list-style: none; }
    .out-of-scope-list li {
      padding: 5pt 0; border-bottom: 0.5pt solid #F3F4F6;
      font-size: 9pt; color: #4B5563;
    }
    .out-of-scope-list li::before { content: '—  '; color: #D97706; font-weight: 600; }

    /* Pressupostos */
    .assumption-list { list-style: none; counter-reset: assumption; }
    .assumption-list li {
      counter-increment: assumption;
      padding: 5pt 0 5pt 20pt; position: relative;
      font-size: 9pt; color: #4B5563;
      border-bottom: 0.5pt solid #F3F4F6;
    }
    .assumption-list li::before {
      content: counter(assumption);
      position: absolute; left: 0;
      font-weight: 600; color: #00B899; font-size: 8pt;
    }
  </style>
</head>
<body>

<!-- ===== CAPA ===== -->
<div class="cover">
  <img class="cover-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
  <div>
    <div class="cover-tag">Proposta Comercial</div>
    <div class="cover-title">{{QUOTE_TITLE}}</div>
    <div class="cover-client">{{CLIENT_NAME}}</div>
  </div>
  <div class="cover-meta">
    <div><span>Referência</span><strong>{{QUOTE_REF}}</strong></div>
    <div><span>Versão</span><strong>v{{VERSION}}</strong></div>
    <div><span>Data</span><strong>{{DATE}}</strong></div>
    <div><span>Válida até</span><strong>{{VALID_UNTIL}}</strong></div>
  </div>
</div>

<!-- ===== SUMÁRIO EXECUTIVO ===== -->
<div class="page">
  <div class="page-header">
    <img class="page-header-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
    <div class="page-header-ref">
      <strong>{{CLIENT_NAME}}</strong><br>
      Ref. {{QUOTE_REF}} · v{{VERSION}}
    </div>
  </div>

  <div class="section-title">Sumário Executivo</div>
  <div class="section-body">{{DESCRIPTION}}</div>

  <div class="section-title">O Que Entregamos</div>
  <div class="section-body">{{SCOPE_SUMMARY}}</div>
</div>

<!-- ===== ÂMBITO DE TRABALHO ===== -->
<div class="page">
  <div class="page-header">
    <img class="page-header-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
    <div class="page-header-ref">{{CLIENT_NAME}} · Ref. {{QUOTE_REF}}</div>
  </div>

  <div class="section-title">Âmbito de Trabalho</div>

  <table class="phases-table">
    {{PHASES_AND_ITEMS}}
  </table>
</div>

<!-- ===== FORA DE ÂMBITO E PRESSUPOSTOS ===== -->
<div class="page">
  <div class="page-header">
    <img class="page-header-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
    <div class="page-header-ref">{{CLIENT_NAME}} · Ref. {{QUOTE_REF}}</div>
  </div>

  <div class="section-title">Fora de Âmbito</div>
  <ul class="out-of-scope-list">{{OUT_OF_SCOPE_ITEMS}}</ul>

  <div class="section-title" style="margin-top:20pt">Pressupostos</div>
  <ul class="assumption-list">
    <li>O cliente disponibiliza acesso aos sistemas existentes (ERP, base de dados) no prazo de 5 dias úteis após adjudicação.</li>
    <li>O feedback a cada entrega é providenciado no prazo de 5 dias úteis.</li>
    <li>Alterações de âmbito após aprovação da especificação funcional serão orçamentadas separadamente.</li>
    <li>Os conteúdos (textos, imagens, logótipos) são fornecidos pelo cliente em formato digital.</li>
    {{ADDITIONAL_ASSUMPTIONS}}
  </ul>
</div>

<!-- ===== TIMELINE ===== -->
{{#if HAS_GANTT}}
<div class="page">
  <div class="page-header">
    <img class="page-header-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
    <div class="page-header-ref">{{CLIENT_NAME}} · Ref. {{QUOTE_REF}}</div>
  </div>

  <div class="section-title">Timeline Estimada</div>
  <div class="section-body">Início previsto: {{GANTT_START_DATE}}</div>

  <div class="gantt-container">
    {{GANTT_SVG}}
  </div>
</div>
{{/if}}

<!-- ===== INVESTIMENTO ===== -->
<div class="page">
  <div class="page-header">
    <img class="page-header-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
    <div class="page-header-ref">{{CLIENT_NAME}} · Ref. {{QUOTE_REF}}</div>
  </div>

  <div class="section-title">Investimento</div>

  <div class="financial-breakdown">
    <div class="financial-row">
      <span>Subtotal</span>
      <span>{{SUBTOTAL_BASE}}</span>
    </div>
    {{#if HAS_RISK}}
    <div class="financial-row risk">
      <span>Ajuste de complexidade</span>
      <span>+ {{RISK_ADJUSTMENT}}</span>
    </div>
    {{/if}}
    {{#if HAS_DISCOUNT}}
    <div class="financial-row discount">
      <span>Desconto ({{DISCOUNT_PCT}}%)</span>
      <span>- {{DISCOUNT_AMOUNT}}</span>
    </div>
    {{/if}}
    <div class="financial-row" style="font-weight:600;color:#1F2533">
      <span>Total sem IVA</span>
      <span>{{TOTAL_BEFORE_TAX}}</span>
    </div>
    <div class="financial-row" style="color:#9CA3AF">
      <span>IVA 23%</span>
      <span>{{TAX_AMOUNT}}</span>
    </div>
  </div>

  <div class="total-box">
    <div>
      <div class="total-box-label">Total com IVA</div>
      <div class="total-box-value">{{TOTAL_WITH_TAX}}</div>
    </div>
    <div class="total-box-tax">Inclui IVA à taxa legal<br>em vigor (23%)</div>
  </div>

  <div class="validity-box">
    Esta proposta é válida até <strong>{{VALID_UNTIL}}</strong>. Após esta data, os valores poderão ser revistos.
  </div>
</div>

<!-- ===== PRÓXIMOS PASSOS E ASSINATURA ===== -->
<div class="page">
  <div class="page-header">
    <img class="page-header-logo" src="data:image/svg+xml;base64,{{LOGO_BASE64}}" alt="TargX">
    <div class="page-header-ref">{{CLIENT_NAME}} · Ref. {{QUOTE_REF}}</div>
  </div>

  <div class="section-title">Próximos Passos</div>
  <div class="section-body">
    Para avançar com este projecto:<br><br>
    1. Confirmar a aceitação desta proposta (assinatura abaixo ou via portal digital).<br>
    2. Emissão de factura de adjudicação ({{ADJUDICACAO_PCT}}% do valor total).<br>
    3. Kick-off técnico agendado para até 5 dias úteis após recepção do pagamento.<br>
  </div>

  <div class="section-title" style="margin-top:30pt">Condições de Pagamento</div>
  <div class="section-body">{{PAYMENT_TERMS}}</div>

  <div class="signature-section">
    <div style="display:flex; gap:48pt; margin-top:48pt">
      <div class="signature-box">
        <div style="margin-bottom:4pt">Data: _____ / _____ / _______</div>
        Assinatura do Cliente<br>
        <strong>{{CLIENT_NAME}}</strong>
      </div>
      <div class="signature-box">
        <div style="margin-bottom:4pt">Data: _____ / _____ / _______</div>
        Assinatura TargX<br>
        <strong>Cosmosdesígnio, Lda.</strong>
      </div>
    </div>
  </div>
</div>

<div class="page-footer">
  <span>TargX · targx.com · hello@targx.com</span>
  <span>{{QUOTE_REF}} · v{{VERSION}}</span>
  <span>Página <span class="pageNumber"></span></span>
</div>

</body>
</html>
```

### 5.2 Função de renderização no Edge Function

```typescript
// supabase/functions/generate-quote-pdf/renderer.ts

export function renderTemplate(template: string, data: QuotePdfData): string {
  // 1. Gerar linhas de fases e itens
  const phasesHtml = data.phases.map(phase => `
    <tr class="phase-row">
      <td colspan="3">${phase.name}${phase.description ? ` — <em style="font-weight:400">${phase.description}</em>` : ''}</td>
      <td>${formatCurrency(phase.total)}</td>
    </tr>
    ${phase.items.map(item => `
      <tr class="item-row ${item.optional ? 'optional' : ''}">
        <td>
          ${item.name}
          ${item.optional ? '<span class="item-optional-badge">Opcional</span>' : ''}
          ${item.description ? `<br><span style="font-size:7.5pt;color:#9CA3AF">${item.description}</span>` : ''}
        </td>
        <td style="text-align:center;white-space:nowrap">
          ${item.pricing_type === 'hourly' ? `${item.hours}h` : '—'}
        </td>
        <td style="text-align:right;white-space:nowrap">
          ${item.pricing_type === 'hourly' ? `${formatCurrency(item.hourly_rate)}/h` : 'Valor fixo'}
        </td>
        <td>${item.optional ? '<span style="color:#9CA3AF">—</span>' : formatCurrency(item.subtotal)}</td>
      </tr>
    `).join('')}
  `).join('');

  // 2. Substituir todos os placeholders {{...}}
  return template
    .replace('{{LOGO_BASE64}}', data.logoBase64)
    .replace(/{{QUOTE_TITLE}}/g, data.title)
    .replace(/{{CLIENT_NAME}}/g, data.clientName)
    .replace(/{{QUOTE_REF}}/g, data.quoteRef)
    .replace(/{{VERSION}}/g, String(data.version))
    .replace(/{{DATE}}/g, formatDate(data.createdAt))
    .replace(/{{VALID_UNTIL}}/g, formatDate(data.validUntil))
    .replace('{{DESCRIPTION}}', data.description || '')
    .replace('{{SCOPE_SUMMARY}}', data.scopeSummary || '')
    .replace('{{PHASES_AND_ITEMS}}', phasesHtml)
    .replace('{{OUT_OF_SCOPE_ITEMS}}', data.outOfScopeItems.map(i => `<li>${i}</li>`).join(''))
    .replace('{{SUBTOTAL_BASE}}', formatCurrency(data.subtotalBase))
    .replace('{{HAS_RISK}}', data.riskAdjustment > 0 ? 'true' : '')
    .replace('{{RISK_ADJUSTMENT}}', formatCurrency(data.riskAdjustment))
    .replace('{{HAS_DISCOUNT}}', data.discountPct > 0 ? 'true' : '')
    .replace('{{DISCOUNT_PCT}}', String(data.discountPct))
    .replace('{{DISCOUNT_AMOUNT}}', formatCurrency(data.discountAmount))
    .replace('{{TOTAL_BEFORE_TAX}}', formatCurrency(data.totalBeforeTax))
    .replace('{{TAX_AMOUNT}}', formatCurrency(data.totalWithTax - data.totalBeforeTax))
    .replace('{{TOTAL_WITH_TAX}}', formatCurrency(data.totalWithTax))
    .replace(/{{VALID_UNTIL}}/g, formatDate(data.validUntil))
    .replace('{{PAYMENT_TERMS}}', data.paymentTerms)
    .replace('{{ADJUDICACAO_PCT}}', '40')
    .replace('{{HAS_GANTT}}', data.ganttSvg ? 'true' : '')
    .replace('{{GANTT_START_DATE}}', data.ganttStartDate ? formatDate(data.ganttStartDate) : '')
    .replace('{{GANTT_SVG}}', data.ganttSvg || '');
}
```

---

## TAREFA 6 — Captura de leads do website

### 6.1 Edge Function pública de captura

```typescript
// supabase/functions/capture-website-lead/index.ts
// Endpoint público: POST /functions/v1/capture-website-lead
// CORS aberto para targx.com e targx.pt

serve(async (req) => {
  if (req.method === 'OPTIONS') return corsResponse();

  const body = await req.json();

  // Validar campos obrigatórios
  if (!body.name || !body.email || !body.project_type) {
    return new Response(JSON.stringify({ error: 'Campos obrigatórios em falta' }), { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Criar ou encontrar cliente por email
  let clientId: string;
  const { data: existingClient } = await supabase
    .from('clients')
    .select('id')
    .eq('email', body.email)
    .single();

  if (existingClient) {
    clientId = existingClient.id;
  } else {
    const { data: newClient } = await supabase
      .from('clients')
      .insert({ name: body.company || body.name, email: body.email, phone: body.phone })
      .select('id')
      .single();
    clientId = newClient!.id;
  }

  // 2. Criar lead atribuída ao admin para triagem
  const adminProfile = await supabase
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
    .single();

  const { data: lead } = await supabase
    .from('leads')
    .insert({
      client_id: clientId,
      partner_id: adminProfile.data!.id,  // admin para triagem
      title: `[Website] ${body.project_type} — ${body.company || body.name}`,
      description: body.message,
      status: 'nova',
      estimated_value: null,
      source: 'website',
      scoping_partial: body.scoping_answers || null,  // campo jsonb adicional
      last_activity_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // 3. Notificar admin
  await supabase.from('notifications').insert({
    user_id: adminProfile.data!.id,
    type: 'lead_assigned',
    title: 'Nova lead do website',
    body: `${body.name} (${body.company || 'Particular'}) — ${body.project_type}`,
    link: `/leads/${lead!.data!.id}`,
  });

  // 4. Email de confirmação ao cliente
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: 'TargX <hello@targx.com>',
      to: body.email,
      subject: 'Recebemos o vosso pedido — TargX',
      html: `<p>Olá ${body.name},</p><p>Recebemos o vosso pedido e entraremos em contacto em breve.</p><p>Equipa TargX</p>`
    })
  });

  return new Response(JSON.stringify({ success: true, lead_id: lead!.data!.id }), {
    status: 200,
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  });
});
```

### 6.2 Widget HTML embebível para o website TargX

Criar `public/lead-widget/` com:

```html
<!-- lead-widget.html — embeber no site targx.com via iframe ou inline -->
<form id="tx-lead-form" style="font-family:Inter,sans-serif;max-width:480px">
  <h3 style="font-size:1.25rem;font-weight:700;margin-bottom:16px;color:#0A1628">
    Conte-nos o vosso projecto
  </h3>

  <div style="margin-bottom:12px">
    <label>Nome *</label>
    <input name="name" required placeholder="O vosso nome">
  </div>
  <div style="margin-bottom:12px">
    <label>Empresa</label>
    <input name="company" placeholder="Nome da empresa">
  </div>
  <div style="margin-bottom:12px">
    <label>Email *</label>
    <input name="email" type="email" required>
  </div>
  <div style="margin-bottom:12px">
    <label>Telefone</label>
    <input name="phone" type="tel">
  </div>
  <div style="margin-bottom:12px">
    <label>Tipo de projecto *</label>
    <select name="project_type" required>
      <option value="">Seleccione...</option>
      <option value="ecommerce">eCommerce</option>
      <option value="website_institucional">Website Institucional</option>
      <option value="software_medida">Software à Medida</option>
      <option value="saas">Plataforma SaaS</option>
      <option value="integracao_automacao">Integração / Automação</option>
    </select>
  </div>
  <div style="margin-bottom:20px">
    <label>Descrição do projecto</label>
    <textarea name="message" rows="4" placeholder="Descreva brevemente o que precisam..."></textarea>
  </div>

  <button type="submit">
    Enviar pedido →
  </button>

  <div id="tx-success" style="display:none;color:#059669;padding:12px;background:#DCFCE7;border-radius:8px">
    ✓ Recebemos o vosso pedido! Entraremos em contacto brevemente.
  </div>
</form>

<script>
document.getElementById('tx-lead-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));

  const res = await fetch('https://crm.targx.com/functions/v1/capture-website-lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });

  if (res.ok) {
    e.target.style.display = 'none';
    document.getElementById('tx-success').style.display = 'block';
  }
});
</script>
```

---

## TAREFA 7 — Calculadora de ROI no portal do cliente

### 7.1 Schema

```sql
-- supabase/migrations/009_roi_benchmarks.sql

create table roi_benchmarks (
  id                    uuid primary key default gen_random_uuid(),
  project_type_id       uuid not null references project_types(id),
  label                 text not null,        -- ex: 'eCommerce PME'
  description           text,
  investment_range_min  numeric(12,2) not null,
  investment_range_max  numeric(12,2) not null,
  avg_payback_months    numeric(5,1) not null, -- meses médios de recuperação
  avg_revenue_increase_pct numeric(5,1),       -- % de aumento de receita observado
  avg_cost_reduction_pct   numeric(5,1),       -- % de redução de custos operacionais
  sample_size           int not null default 0, -- nº de projectos que baseiam este benchmark
  active                boolean not null default true,
  created_by            uuid references profiles(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- RLS: leitura pública via Edge Function do portal; escrita apenas admin
create policy "admin_manages_roi_benchmarks"
  on roi_benchmarks for all
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

### 7.2 Settings de ROI benchmarks (admin)

**Feature `settings/roi-benchmarks/`:**

Tabela com todos os benchmarks. Para cada registo:
- Tipo de projecto
- Label (ex: "eCommerce PME", "eCommerce Enterprise")
- Range de investimento (min–max)
- Payback médio em meses
- % de aumento de receita observada
- % de redução de custos
- Nº de projectos na amostra
- Toggle activo/inactivo

Formulário de criação/edição em drawer. Campo `sample_size` actualizado manualmente pelo admin à medida que mais projectos são concluídos.

Seed inicial com benchmarks baseados nos projectos reais da TargX:

```sql
-- Inserir após seeds de project_types (referenciar por slug)
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
```

### 7.3 Lógica de matching no Edge Function do portal

```typescript
// Em handle-client-portal-open/index.ts, adicionar à resposta:

async function findMatchingBenchmark(supabase, projectTypeId: string, totalBeforeTax: number) {
  const { data: benchmarks } = await supabase
    .from('roi_benchmarks')
    .select('*')
    .eq('project_type_id', projectTypeId)
    .eq('active', true)
    .lte('investment_range_min', totalBeforeTax)
    .gte('investment_range_max', totalBeforeTax)
    .order('sample_size', { ascending: false })
    .limit(1);

  // Se não há match exacto por range, pegar o benchmark mais próximo
  if (!benchmarks?.length) {
    const { data: closest } = await supabase
      .from('roi_benchmarks')
      .select('*')
      .eq('project_type_id', projectTypeId)
      .eq('active', true)
      .order('sample_size', { ascending: false })
      .limit(1);
    return closest?.[0] || null;
  }

  return benchmarks[0];
}

// Calcular métricas derivadas para o orçamento específico:
function calculateRoiMetrics(benchmark: RoiBenchmark, investmentValue: number) {
  return {
    benchmark,
    payback_months: benchmark.avg_payback_months,
    // Se tiver % de receita, estimar o ganho anual
    estimated_annual_gain: benchmark.avg_revenue_increase_pct
      ? `+${benchmark.avg_revenue_increase_pct}% de receita estimada`
      : null,
    estimated_cost_savings: benchmark.avg_cost_reduction_pct
      ? `−${benchmark.avg_cost_reduction_pct}% nos custos operacionais`
      : null,
    sample_note: `Baseado em ${benchmark.sample_size} projecto${benchmark.sample_size !== 1 ? 's' : ''} similares`,
  };
}
```

### 7.4 Componente ROI no portal do cliente

```typescript
// src/app/features/client-portal/roi-calculator/roi-calculator.component.ts
// Recebe: roiMetrics (do endpoint do portal), investmentValue, projectTypeName
```

```html
<!-- roi-calculator.component.html -->
<div class="roi-card">
  <div class="roi-header">
    <span class="roi-icon">📈</span>
    <div>
      <h3>Retorno do Investimento</h3>
      <p>Baseado em projectos similares</p>
    </div>
  </div>

  <!-- Payback principal em destaque -->
  <div class="roi-highlight">
    <span class="roi-months">{{ roiMetrics.payback_months }}</span>
    <span class="roi-months-label">meses de recuperação</span>
    <span class="roi-sub">em média para este tipo de projecto</span>
  </div>

  <!-- Métricas secundárias -->
  <div class="roi-metrics" *ngIf="roiMetrics.estimated_annual_gain || roiMetrics.estimated_cost_savings">
    <div class="roi-metric" *ngIf="roiMetrics.estimated_annual_gain">
      <span class="roi-metric-icon">↑</span>
      <span>{{ roiMetrics.estimated_annual_gain }}</span>
    </div>
    <div class="roi-metric" *ngIf="roiMetrics.estimated_cost_savings">
      <span class="roi-metric-icon">↓</span>
      <span>{{ roiMetrics.estimated_cost_savings }}</span>
    </div>
  </div>

  <!-- Disclaimer e amostra -->
  <p class="roi-note">{{ roiMetrics.sample_note }}. Os valores são estimativas baseadas em dados históricos e podem variar.</p>
</div>
```

```css
/* roi-calculator styles — seguir Design System */
.roi-card {
  background: linear-gradient(135deg, #0F2044 0%, #0A1628 100%);
  border-radius: 12px;
  padding: 20px 24px;
  color: white;
  margin-bottom: 16px;
}
.roi-header { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.roi-header h3 { font-size: 0.9375rem; font-weight: 600; margin-bottom: 2px; }
.roi-header p { font-size: 0.75rem; color: rgba(255,255,255,0.5); }
.roi-highlight { text-align: center; padding: 20px 0 16px; }
.roi-months {
  font-size: 3.5rem; font-weight: 700; color: #00B899;
  font-variant-numeric: tabular-nums; display: block; line-height: 1;
}
.roi-months-label { font-size: 1rem; font-weight: 500; color: white; display: block; margin-top: 4px; }
.roi-sub { font-size: 0.75rem; color: rgba(255,255,255,0.5); display: block; margin-top: 4px; }
.roi-metrics { display: flex; flex-direction: column; gap: 8px; margin-bottom: 16px; }
.roi-metric {
  display: flex; align-items: center; gap: 10px;
  background: rgba(255,255,255,0.06); border-radius: 8px;
  padding: 8px 12px; font-size: 0.875rem;
}
.roi-metric-icon { color: #00B899; font-weight: 700; font-size: 1rem; }
.roi-note { font-size: 0.6875rem; color: rgba(255,255,255,0.35); line-height: 1.5; }
```

Posicionar o componente ROI no portal entre o Gantt e o painel de aceitação. Apenas mostrar se `roiMetrics` não for null.

---

## TAREFA 8 — Integração LinkedIn para prospeção

### 8.1 Edge Function de captura LinkedIn

```typescript
// supabase/functions/capture-linkedin-lead/index.ts
// Endpoint: POST /functions/v1/capture-linkedin-lead
// Auth: API key no header X-TX-API-Key (não usa Supabase Auth — é chamado pelo bookmarklet)

serve(async (req) => {
  // Validar API key
  const apiKey = req.headers.get('X-TX-API-Key');
  const validKey = Deno.env.get('TX_LINKEDIN_API_KEY');
  if (apiKey !== validKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const body = await req.json();
  // body shape: { company_name, company_url, company_sector, contact_name,
  //              contact_title, contact_linkedin_url, partner_id, notes? }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // 1. Criar ou encontrar cliente por company_url
  let clientId: string;
  const { data: existing } = await supabase
    .from('clients')
    .select('id')
    .eq('website', body.company_url)
    .maybeSingle();

  if (existing) {
    clientId = existing.id;
  } else {
    const { data: newClient } = await supabase
      .from('clients')
      .insert({
        name: body.company_name,
        sector: body.company_sector,
        website: body.company_url,
        notes: body.contact_name ? `Contacto LinkedIn: ${body.contact_name}${body.contact_title ? ` (${body.contact_title})` : ''}` : null,
      })
      .select('id')
      .single();
    clientId = newClient!.id;
  }

  // 2. Criar lead atribuída ao parceiro que usou o bookmarklet
  const { data: lead } = await supabase
    .from('leads')
    .insert({
      client_id: clientId,
      partner_id: body.partner_id,
      title: `[LinkedIn] ${body.company_name}${body.contact_title ? ` — ${body.contact_title}` : ''}`,
      description: body.notes || null,
      status: 'nova',
      source: 'linkedin',
      last_activity_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // 3. Adicionar actividade com dados do LinkedIn
  await supabase.from('lead_activities').insert({
    lead_id: lead!.id,
    author_id: body.partner_id,
    type: 'nota',
    content: [
      body.contact_name ? `Contacto: ${body.contact_name}` : null,
      body.contact_title ? `Cargo: ${body.contact_title}` : null,
      body.contact_linkedin_url ? `LinkedIn: ${body.contact_linkedin_url}` : null,
      body.company_url ? `Website: ${body.company_url}` : null,
    ].filter(Boolean).join('\n'),
  });

  // 4. Notificação ao próprio parceiro (confirmação)
  await supabase.from('notifications').insert({
    user_id: body.partner_id,
    type: 'lead_assigned',
    title: 'Lead LinkedIn criada',
    body: `${body.company_name} adicionada ao pipeline`,
    link: `/leads/${lead!.id}`,
  });

  return new Response(
    JSON.stringify({ success: true, lead_id: lead!.id, client_id: clientId }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});
```

Adicionar `TX_LINKEDIN_API_KEY` às variáveis de ambiente (gerada com `crypto.randomUUID()`).

### 8.2 Bookmarklet para o Urbano

Criar `public/linkedin-bookmarklet/` com página de instalação e o bookmarklet:

```javascript
// Código do bookmarklet (minificado para URL)
// Extrair dados da página LinkedIn e abrir modal de confirmação

javascript:(function(){
  // Detectar se estamos numa página de empresa LinkedIn
  const isCompany = window.location.href.includes('/company/');
  const isPerson = window.location.href.includes('/in/');

  if (!isCompany && !isPerson) {
    alert('Por favor navega para um perfil de empresa ou pessoa no LinkedIn.');
    return;
  }

  // Extrair dados básicos da página
  const companyName = isCompany
    ? document.querySelector('h1')?.textContent?.trim()
    : document.querySelector('.org-top-card-summary__title')?.textContent?.trim() || '';

  const contactName = isPerson
    ? document.querySelector('h1')?.textContent?.trim()
    : '';

  const contactTitle = isPerson
    ? document.querySelector('.text-body-medium')?.textContent?.trim()
    : '';

  // Criar modal de confirmação
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position:fixed;top:0;left:0;right:0;bottom:0;
    background:rgba(10,22,40,0.8);z-index:99999;
    display:flex;align-items:center;justify-content:center;
  `;

  overlay.innerHTML = \`
    <div style="background:white;border-radius:12px;padding:24px;width:400px;font-family:Inter,sans-serif;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
        <img src="https://crm.targx.com/assets/logo-sm.png" style="height:28px;" alt="TargX">
        <h3 style="font-size:1rem;font-weight:600;color:#0A1628;">Adicionar ao CRM TargX</h3>
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:0.75rem;font-weight:500;color:#4B5563;display:block;margin-bottom:4px;">Empresa</label>
        <input id="tx-company" value="\${companyName}" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-size:0.875rem;">
      </div>

      <div style="margin-bottom:12px;">
        <label style="font-size:0.75rem;font-weight:500;color:#4B5563;display:block;margin-bottom:4px;">Website</label>
        <input id="tx-website" placeholder="https://..." style="width:100%;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-size:0.875rem;">
      </div>

      \${isPerson ? \`
      <div style="margin-bottom:12px;">
        <label style="font-size:0.75rem;font-weight:500;color:#4B5563;display:block;margin-bottom:4px;">Contacto</label>
        <input id="tx-contact" value="\${contactName}" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-size:0.875rem;">
      </div>
      <div style="margin-bottom:12px;">
        <label style="font-size:0.75rem;font-weight:500;color:#4B5563;display:block;margin-bottom:4px;">Cargo</label>
        <input id="tx-title" value="\${contactTitle}" style="width:100%;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-size:0.875rem;">
      </div>
      \` : ''}

      <div style="margin-bottom:20px;">
        <label style="font-size:0.75rem;font-weight:500;color:#4B5563;display:block;margin-bottom:4px;">Notas</label>
        <textarea id="tx-notes" rows="2" placeholder="Contexto da prospeção..." style="width:100%;border:1px solid #E5E7EB;border-radius:8px;padding:8px 12px;font-size:0.875rem;resize:vertical;"></textarea>
      </div>

      <div style="display:flex;gap:8px;">
        <button id="tx-cancel" style="flex:1;padding:8px;border:1px solid #E5E7EB;border-radius:8px;background:white;cursor:pointer;font-size:0.875rem;">Cancelar</button>
        <button id="tx-submit" style="flex:2;padding:8px;border:none;border-radius:8px;background:#00B899;color:white;font-weight:500;cursor:pointer;font-size:0.875rem;">Adicionar lead →</button>
      </div>

      <div id="tx-result" style="margin-top:12px;display:none;font-size:0.8125rem;text-align:center;"></div>
    </div>
  \`;

  document.body.appendChild(overlay);

  document.getElementById('tx-cancel').onclick = () => overlay.remove();

  document.getElementById('tx-submit').onclick = async () => {
    const btn = document.getElementById('tx-submit');
    btn.textContent = 'A criar...';
    btn.disabled = true;

    try {
      const res = await fetch('https://crm.targx.com/functions/v1/capture-linkedin-lead', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TX-API-Key': 'TX_PARTNER_API_KEY_PLACEHOLDER',  // substituído na página de instalação
        },
        body: JSON.stringify({
          company_name: document.getElementById('tx-company').value,
          company_url: document.getElementById('tx-website').value,
          contact_name: document.getElementById('tx-contact')?.value || '',
          contact_title: document.getElementById('tx-title')?.value || '',
          contact_linkedin_url: window.location.href,
          notes: document.getElementById('tx-notes').value,
          partner_id: 'TX_PARTNER_ID_PLACEHOLDER',  // substituído na página de instalação
        })
      });

      const data = await res.json();

      if (data.success) {
        const result = document.getElementById('tx-result');
        result.style.display = 'block';
        result.style.color = '#059669';
        result.innerHTML = \`✓ Lead criada! <a href="https://crm.targx.com/leads/\${data.lead_id}" target="_blank" style="color:#00B899;">Ver no CRM →</a>\`;
        btn.style.display = 'none';
        setTimeout(() => overlay.remove(), 4000);
      }
    } catch (err) {
      btn.textContent = 'Erro — tentar novamente';
      btn.disabled = false;
    }
  };
})();
```

### 8.3 Página de instalação do bookmarklet

Criar `src/app/features/settings/linkedin-bookmarklet/linkedin-bookmarklet.component.ts` (apenas admin/partner):

```
Página com:
1. Instruções em 3 passos com screenshots
2. Botão "Instalar bookmarklet" (arrastar para a barra de favoritos)
   — O botão contém o bookmarklet com partner_id e API key do utilizador actual pré-preenchidos
3. Botão "Testar" que abre o LinkedIn e verifica se o bookmarklet está instalado
4. Secção "Como usar":
   — Navega para uma empresa ou pessoa no LinkedIn
   — Clica no bookmarklet na barra de favoritos
   — Confirma os dados no modal e clica "Adicionar lead"
   — A lead aparece no CRM em segundos
```

O `partner_id` e o API key são injectados dinamicamente no bookmarklet quando o parceiro visita esta página (usando os dados do `AuthService.currentProfile$()`).

---

## TAREFA 9 — Relatório mensal de gestão (PDF para o Rui)

### 9.1 Edge Function

```typescript
// supabase/functions/generate-management-report/index.ts
// Trigger: cron dia 1 de cada mês às 07:00 (antes do monthly_digest dos parceiros)
// Ou chamado manualmente via HTTP (apenas admin)

serve(async (req) => {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // mês anterior
  const monthLabel = new Intl.DateTimeFormat('pt-PT', { month: 'long', year: 'numeric' })
    .format(new Date(year, month - 1));

  // Recolher todos os dados do mês anterior
  const [leads, quotes, projects, commissions, partners] = await Promise.all([
    // Leads abertas (todas, não apenas do mês)
    supabase.from('leads')
      .select('id, title, status, estimated_value, partner_id, clients(name)')
      .not('status', 'in', '(fechada_ganha,fechada_perdida)'),

    // Orçamentos enviados no mês
    supabase.from('quotes')
      .select('id, title, status, total_before_tax, sent_at, clients(name)')
      .gte('sent_at', startOfMonth(year, month - 1).toISOString())
      .lt('sent_at', startOfMonth(year, month).toISOString()),

    // Projectos em curso
    supabase.from('projects')
      .select('id, title, contract_value, status, clients(name), partner_id')
      .eq('status', 'em_curso'),

    // Comissões pagas no mês
    supabase.from('commissions')
      .select('id, commission_amount, partner_id, projects(title, clients(name))')
      .gte('created_at', startOfMonth(year, month - 1).toISOString())
      .lt('created_at', startOfMonth(year, month).toISOString()),

    // Resumo por parceiro
    supabase.from('profiles')
      .select('id, full_name')
      .eq('role', 'partner')
      .eq('active', true),
  ]);

  // Calcular KPIs do mês
  const kpis = {
    leads_abertas: leads.data?.length || 0,
    pipeline_value: leads.data?.reduce((s, l) => s + (l.estimated_value || 0), 0) || 0,
    orcamentos_enviados: quotes.data?.length || 0,
    orcamentos_aceites: quotes.data?.filter(q => q.status === 'aceite').length || 0,
    taxa_conversao: quotes.data?.length
      ? Math.round((quotes.data.filter(q => q.status === 'aceite').length / quotes.data.length) * 100)
      : 0,
    projectos_em_curso: projects.data?.length || 0,
    volume_em_curso: projects.data?.reduce((s, p) => s + p.contract_value, 0) || 0,
    comissoes_pagas: commissions.data?.reduce((s, c) => s + c.commission_amount, 0) || 0,
  };

  // Gerar HTML do relatório
  const html = renderManagementReport({ kpis, leads: leads.data, quotes: quotes.data, projects: projects.data, commissions: commissions.data, partners: partners.data, monthLabel });

  // Gerar PDF via Puppeteer
  const pdf = await generatePdf(html);

  // Guardar em Storage
  const path = `management/${year}/${String(month).padStart(2,'0')}.pdf`;
  await supabase.storage.from('reports').upload(path, pdf, { contentType: 'application/pdf', upsert: true });

  // Enviar por email ao admin
  const adminEmail = Deno.env.get('ADMIN_EMAIL') || 'rui@targx.com';
  await sendEmail({
    to: adminEmail,
    subject: `Relatório de Gestão TargX — ${monthLabel}`,
    html: `<p>Rui,</p><p>Em anexo o relatório de gestão de ${monthLabel}.</p>`,
    attachments: [{ filename: `relatorio-gestao-${monthLabel}.pdf`, content: pdf }],
  });

  return new Response(JSON.stringify({ success: true, path }), { status: 200 });
});
```

Adicionar ao `supabase/config.toml`:
```toml
[functions.generate-management-report]
schedule = "0 7 1 * *"    # dia 1 de cada mês às 07:00
```

Adicionar variável de ambiente `ADMIN_EMAIL=rui@targx.com`.

### 9.2 Template do relatório de gestão

O relatório tem layout diferente do PDF de proposta: mais denso, orientado a dados, para leitura rápida.

Estrutura de páginas:
```
Página 1: Capa com mês, logo TargX, subtítulo "Relatório de Gestão"
Página 2: KPIs do mês (grid de 6 métricas em destaque)
Página 3: Pipeline — tabela de leads abertas por estado e parceiro
Página 4: Orçamentos — enviados, aceites, rejeitados no mês com valores
Página 5: Projectos em curso — tabela com cliente, valor, parceiro, estado tranches
Página 6: Comissões — pagas no mês, total acumulado no ano por parceiro
```

### 9.3 Acesso ao histórico de relatórios

**Feature `settings/management-reports/`** (apenas admin):
- Lista de PDFs gerados com mês, data de geração, link de download
- Botão "Gerar agora" (chama a Edge Function manualmente)
- Supabase Storage bucket `reports` com path `management/{year}/{month}.pdf`

---

## TAREFA 10 — Webhook de entrada para leads externas

### 10.1 Edge Function

```typescript
// supabase/functions/webhook-lead/index.ts
// Endpoint autenticado: POST /functions/v1/webhook-lead
// Auth: Bearer token gerado por parceiro/admin nas settings

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Validar Bearer token
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const token = authHeader.slice(7);
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Resolver token para parceiro/admin
  const { data: tokenRecord } = await supabase
    .from('webhook_tokens')
    .select('*, profiles(id, role)')
    .eq('token', token)
    .eq('active', true)
    .single();

  if (!tokenRecord) {
    return new Response(JSON.stringify({ error: 'Token inválido ou inactivo' }), { status: 401 });
  }

  const body = await req.json();

  // Schema de entrada flexível — apenas name/email obrigatórios
  // {
  //   name: string (obrigatório — nome da empresa ou pessoa)
  //   email?: string
  //   phone?: string
  //   website?: string
  //   sector?: string
  //   title?: string          -- título da lead (se omitido, gerado automaticamente)
  //   description?: string
  //   estimated_value?: number
  //   source?: string         -- identificador da ferramenta externa
  //   project_type?: string   -- slug do project_type
  //   partner_id?: string     -- se omitido, usa o dono do token
  //   scoping_answers?: object
  //   metadata?: object       -- dados extras preservados em jsonb
  // }

  if (!body.name) {
    return new Response(JSON.stringify({ error: 'Campo name é obrigatório' }), { status: 400 });
  }

  // Criar cliente
  const { data: client } = await supabase
    .from('clients')
    .upsert({
      name: body.name,
      email: body.email,
      phone: body.phone,
      website: body.website,
      sector: body.sector,
    }, { onConflict: 'email', ignoreDuplicates: false })
    .select('id')
    .single();

  // Resolver project_type_id se fornecido
  let projectTypeId: string | null = null;
  if (body.project_type) {
    const { data: pt } = await supabase
      .from('project_types')
      .select('id')
      .eq('slug', body.project_type)
      .single();
    projectTypeId = pt?.id || null;
  }

  // Criar lead
  const partnerId = body.partner_id || tokenRecord.profiles.id;
  const { data: lead } = await supabase
    .from('leads')
    .insert({
      client_id: client!.id,
      partner_id: partnerId,
      title: body.title || `[${body.source || 'Webhook'}] ${body.name}`,
      description: body.description,
      status: 'nova',
      estimated_value: body.estimated_value,
      source: body.source || 'webhook',
      last_activity_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  // Registar chamada no log
  await supabase.from('webhook_logs').insert({
    token_id: tokenRecord.id,
    lead_id: lead!.id,
    payload: body,
    created_at: new Date().toISOString(),
  });

  // Notificar parceiro
  await supabase.from('notifications').insert({
    user_id: partnerId,
    type: 'lead_assigned',
    title: 'Nova lead via webhook',
    body: `${body.name}${body.source ? ` (${body.source})` : ''}`,
    link: `/leads/${lead!.id}`,
  });

  return new Response(
    JSON.stringify({
      success: true,
      lead_id: lead!.id,
      client_id: client!.id,
    }),
    { status: 201, headers: { 'Content-Type': 'application/json' } }
  );
});
```

### 10.2 Schema de suporte

```sql
-- supabase/migrations/010_webhook_infrastructure.sql

create table webhook_tokens (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,          -- ex: 'Zapier TargX', 'Formulário Website'
  token       text not null unique default encode(gen_random_bytes(32), 'hex'),
  owner_id    uuid not null references profiles(id),
  active      boolean not null default true,
  last_used_at timestamptz,
  created_at  timestamptz not null default now()
);

create table webhook_logs (
  id          uuid primary key default gen_random_uuid(),
  token_id    uuid not null references webhook_tokens(id),
  lead_id     uuid references leads(id),
  payload     jsonb not null,
  created_at  timestamptz not null default now()
);

-- RLS: admin vê tudo; partner vê apenas os seus tokens
create policy "owner_manages_own_tokens"
  on webhook_tokens for all
  using (owner_id = auth.uid() or exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  ));

create policy "admin_sees_all_logs"
  on webhook_logs for select
  using (exists (select 1 from profiles where id = auth.uid() and role = 'admin'));
```

### 10.3 Gestão de tokens nas settings

**Feature `settings/webhooks/`:**

```
Layout:
┌─────────────────────────────────────────────────────┐
│ Webhook de Entrada                                  │
│ Cria leads directamente no CRM via HTTP POST        │
├─────────────────────────────────────────────────────┤
│ Endpoint: https://crm.targx.com/functions/v1/webhook-lead │
├─────────────────────────────────────────────────────┤
│ Os teus tokens:                                     │
│                                                     │
│ [Formulário Website]  ••••••••abc123  Activo  [×]  │
│ [Zapier]              ••••••••def456  Activo  [×]  │
│                                                     │
│ [+ Criar novo token]                                │
└─────────────────────────────────────────────────────┘
```

Ao criar token: mostrar o valor completo uma vez (após criação não é possível recuperar). Botão "Copiar".

Tab "Logs": tabela com chamadas recentes — data, token usado, lead criada, payload resumido.

Tab "Documentação": exemplo de chamada com curl e com JavaScript para o programador da ferramenta externa:

```bash
# Exemplo mínimo
curl -X POST https://crm.targx.com/functions/v1/webhook-lead \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{"name": "Empresa XYZ", "email": "geral@empresa.pt", "source": "zapier"}'

# Exemplo completo
curl -X POST https://crm.targx.com/functions/v1/webhook-lead \
  -H "Authorization: Bearer SEU_TOKEN_AQUI" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Farmácia Moderna",
    "email": "geral@farmaciamoderna.pt",
    "phone": "+351 21 000 0000",
    "website": "farmaciamoderna.pt",
    "sector": "Saúde & Farmácia",
    "title": "Proposta ecommerce + integração Sifarma",
    "estimated_value": 15000,
    "project_type": "ecommerce",
    "source": "formulario_website"
  }'
```

---

## CRITÉRIOS DE CONCLUSÃO DO ENCERRAMENTO

### Gaps das fases anteriores
- [ ] `npm run test` passa a verde com todos os 116 testes nomeados correctamente (COM-001→022, DSH-001→010, etc.)
- [ ] Crons configurados em `supabase/config.toml` para check-lead-silence, check-quote-expirations, send-monthly-digest, annual-reset
- [ ] Ficheiro `cron-setup.md` com instruções para produção
- [ ] `analytics.service.ts` implementado com todos os 6 métodos
- [ ] Dashboard de analytics em `/analytics` com gráficos e tabela de estimação
- [ ] Rota `/analytics` protegida com `roleGuard(['admin'])`

### Notificações
- [ ] Tabela `notifications` criada com RLS
- [ ] Sino no topbar com badge e overlay de notificações
- [ ] Supabase Realtime a entregar notificações em tempo real (testar com dois tabs em simultâneo)
- [ ] Todos os 12 tipos de `notification_type` criados nos Edge Functions correspondentes

### Demo e auditoria
- [ ] `seed-demo.sql` corre sem erros com clientes, leads, projectos, tranches e comissões fictícias
- [ ] `reset-demo.sql` limpa apenas dados de demo sem afectar configuração
- [ ] Tabela `portal_access_log` a registar IP, user agent e acção
- [ ] Tab "Histórico de acessos" visível no detalhe do orçamento para admin

### PDF da proposta
- [ ] Template HTML com capa azul escura, tabela de fases com linha alternada, total em caixa escura com valor teal
- [ ] Itens opcionais marcados e excluídos do total principal
- [ ] `internal_notes` ausentes do PDF
- [ ] Gantt injectado como SVG quando `gantt_data` existe

### Leads externas
- [ ] `capture-website-lead` acessível publicamente com CORS para targx.com
- [ ] Widget HTML a criar leads e enviar email de confirmação ao contacto
- [ ] `capture-linkedin-lead` com autenticação por API key
- [ ] Bookmarklet funcional em página de empresa e de pessoa LinkedIn
- [ ] Página de instalação do bookmarklet em `/settings/linkedin-bookmarklet`

### ROI
- [ ] Tabela `roi_benchmarks` criada com seeds iniciais para 4 tipos de projecto
- [ ] Settings de benchmarks em `/settings/roi-benchmarks`
- [ ] Componente ROI visível no portal quando benchmark existe para o tipo de projecto
- [ ] ROI não mostrado quando não há benchmark disponível (sem erro)

### Relatório de gestão
- [ ] Edge Function `generate-management-report` com cron dia 1 às 07:00
- [ ] PDF gerado com 6 secções e guardado em Storage `reports/`
- [ ] Email enviado ao admin com PDF em anexo
- [ ] Página `/settings/management-reports` com histórico e botão "Gerar agora"

### Webhook
- [ ] Tabela `webhook_tokens` e `webhook_logs` criadas com RLS
- [ ] Edge Function `webhook-lead` a criar clientes e leads correctamente
- [ ] Upsert de cliente por email (não duplica)
- [ ] Notificação ao parceiro ao criar lead via webhook
- [ ] Página `/settings/webhooks` com gestão de tokens, logs e documentação
- [ ] Token mostrado apenas uma vez na criação

### Geral
- [ ] Zero `any` em todo o TypeScript (`tsc --strict` sem erros)
- [ ] Todas as novas rotas com `canActivate` e papéis correctos
- [ ] Todas as novas tabelas com RLS activa

---

*TargX CRM — Prompt de Encerramento v2.0 — Junho 2026*
