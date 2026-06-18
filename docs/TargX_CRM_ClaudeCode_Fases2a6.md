# TargX CRM — Prompt Sequencial Completo
# Fases 2 a 6 — Execução Contínua

---

## INSTRUÇÕES DE EXECUÇÃO

Este documento contém as Fases 2 a 6 do TargX CRM em sequência. Executa cada fase completamente antes de avançar para a seguinte. Cada fase tem critérios de conclusão explícitos — só avança quando todos estiverem verificados.

Os documentos de referência obrigatórios são:
- `TargX_CRM_PRD_Master.md` (v2.0) — fonte de verdade para toda a lógica de negócio e schema
- `TargX_CRM_DesignSystem.md` (v1.0) — fonte de verdade para todo o visual
- `TargX_CRM_ClaudeCode_Fase1.md` — contexto do que foi construído na Fase 1

**Regra absoluta:** nunca inventas, nunca simplificas, nunca adicionas funcionalidades não especificadas. Se algo não está no PRD, não existe.

---

# FASE 2 — CRM e Dashboards
## Semanas 3–4

### O que construir

#### 2.1 Módulo Clientes

**`ClientService`** (`src/app/core/services/client.service.ts`):
```typescript
getAll(): Observable<Client[]>
getById(id: string): Observable<Client>
create(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client>
update(id: string, data: Partial<Client>): Promise<Client>
search(query: string): Observable<Client[]>
```

**Feature `clients/`:**
- `client-list`: tabela com colunas nome, sector, email, telefone, data de criação. Filtro de pesquisa por nome/NIF. Botão "Novo cliente".
- `client-detail`: ficha do cliente com tabs: Informação, Leads, Projectos, Orçamentos. Cada tab mostra apenas os registos associados a esse cliente.
- `client-form`: formulário de criação/edição em drawer lateral (não página separada).

Usar `p-table` do PrimeNG com `.tx-table` CSS class. Usar `p-drawer` para o formulário.

#### 2.2 Módulo Leads

**`LeadService`** (`src/app/core/services/lead.service.ts`):
```typescript
getAll(filters?: LeadFilters): Observable<Lead[]>
getById(id: string): Observable<Lead & { activities: LeadActivity[] }>
create(data: CreateLeadDto): Promise<Lead>
update(id: string, data: Partial<Lead>): Promise<Lead>
transition(id: string, newStatus: LeadStatus, notes?: string): Promise<Lead>
addActivity(leadId: string, activity: CreateActivityDto): Promise<LeadActivity>
getForPartner(partnerId: string): Observable<Lead[]>
getSilent(warningDays: number, alertDays: number): Observable<Lead[]>
```

Implementar máquina de estados conforme PRD secção 13:
- Transições válidas definidas como mapa estático
- `fechada_perdida` exige `lost_reason` (lança `ValidationError` se null)
- Transições inválidas lançam `InvalidStateTransitionError`

**Feature `leads/`:**

`lead-list`: vista kanban em 5 colunas (estados não terminais). Cada card mostra: título, cliente, valor estimado, badge de estado, data de próxima acção, ícone de silêncio (vermelho se > alert_days, âmbar se > warning_days). Drag-and-drop entre colunas usando `p-orderlist` ou `cdkDrag`. Botão "Nova lead".

`lead-detail`: página completa com:
- Header: título, cliente, parceiro, badge de estado, botões de transição de estado disponíveis
- Sidebar direita: valor estimado, fonte, próxima acção + data
- Tab "Actividades": linha do tempo de actividades com form inline para adicionar nova
- Tab "Orçamentos": lista de orçamentos associados
- Alerta de silêncio se aplicável (componente `tx-silence-warning`)
- Painel lateral "Objecções" (drawer que abre com botão — lista do `objection_playbook` pesquisável)

`lead-form`: drawer de criação rápida com campos obrigatórios apenas.

#### 2.3 Alertas de silêncio

Criar Edge Function `check-lead-silence` (cron diário 08:00):

```typescript
// supabase/functions/check-lead-silence/index.ts
// 1. Carregar todas as leads não fechadas
// 2. Comparar last_activity_at com thresholds de global_settings
// 3. Para leads > alert_days e silence_alerted=false:
//    a. Enviar email tipo 'lead_silence_alert' ao parceiro e admin
//    b. Actualizar silence_alerted=true
//    c. Registar em email_logs com event_key='silence_{lead_id}_{YYYY_MM}'
// 4. Reset silence_alerted=false quando nova actividade é adicionada
//    (via trigger DB em lead_activities INSERT)
```

Criar trigger DB:
```sql
-- supabase/migrations/004_lead_triggers.sql
-- Trigger 1: actualizar leads.last_activity_at em INSERT em lead_activities
-- Trigger 2: reset leads.silence_alerted=false em INSERT em lead_activities
```

#### 2.4 Repositório de objecções

**Feature `knowledge/objection-playbook/`:**
- Lista de objecções agrupadas por categoria
- Pesquisa por texto livre (client-side filtering)
- Admin pode criar/editar/desactivar
- Partner vê apenas (read-only)

Componente `objection-panel` (drawer): usado no `lead-detail`, abre à direita com pesquisa e lista de objecções relevantes.

#### 2.5 Dashboards

**`DashboardService`** (`src/app/core/services/dashboard.service.ts`):

Implementar todos os métodos com os cálculos do PRD secção 23 e 24:

```typescript
getPartnerSummary(partnerId: string, year: number): Observable<PartnerSummary>
getAdminOverview(year: number): Observable<AdminOverview>
getPipelineSummary(): Observable<PipelineSummary>
getEstimationAccuracy(): Observable<EstimationAccuracy[]>

// PartnerSummary shape:
interface PartnerSummary {
  volume_ano: number;
  commission_ano: number;
  tier_actual: CommissionTier;
  tier_rate: number;
  next_tier_threshold: number | null;
  volume_to_next_tier: number | null;
  next_tier_rate: number | null;
  progress_pct_tier: number;
  bonus_status: BonusStatus[];
  volume_trimestre: number;
  target_trimestre: number | null;
  progress_pct_target: number | null;
  pipeline_value: number;
  leads_abertas: number;
  leads_sem_actividade: number;
}

// BonusStatus shape:
interface BonusStatus {
  threshold: number;
  bonus_amount: number;
  achieved: boolean;
  volume_remaining: number | null;
}
```

**Feature `dashboard/partner-dashboard/`:**

Layout conforme PRD secção 8.1 do Design System:

```
Linha 1: 4 KPI cards (volume_ano, commission_ano, leads_abertas, meta trimestral)
Linha 2: TierProgressComponent (largura total)
Linha 3: 2 colunas — PipelineByStatus | BonusTracker
```

Componente `TierProgressComponent` conforme Design System secção 7.3 (elemento de assinatura):
- Barra gradiente azul→teal que vira azul→ouro quando `progress_pct > 80`
- Animação spring na transição de largura
- Mostra taxa actual, taxa seguinte, valor em falta

Componente `BonusTrackerComponent`:
- Lista de bónus do plano
- Cada bónus: threshold, valor, estado (atingido/pendente), progress bar
- Bónus atingidos com ícone de check verde e valor em ouro

**Feature `dashboard/admin-dashboard/`:**

```
Linha 1: 4 KPI cards (volume_total_ano, comissao_total_ano, leads_abertas, taxa_conversao)
Linha 2: Pipeline por estado (bar chart horizontal com p-chart)
Linha 3: 2 colunas — Leads em silêncio | Parceiros overview
Linha 4: Tempo médio por estado (tabela simples)
```

#### 2.6 Metas trimestrais

**Feature `settings/partner-targets/`:**
- Apenas admin acede
- Grid com parceiros nas linhas, trimestres nas colunas
- Edição inline de valores
- Gravar via `partner_targets` table

#### 2.7 Testes unitários (escrever antes de implementar)

Ficheiro `src/app/core/services/__tests__/lead.service.spec.ts`:

Implementar **CRM-001 a CRM-008** conforme PRD secção 29:

```typescript
describe('LeadService', () => {
  // CRM-001: getForPartner filtra por partner_id=auth.uid() para role=partner
  // CRM-002: getAll sem filtro para role=admin
  // CRM-003: transição nova→contactada aceite
  // CRM-004: transição fechada_ganha→nova lança InvalidStateTransitionError
  // CRM-005: transition para fechada_perdida sem lost_reason lança ValidationError
  // CRM-006: addActivity actualiza last_activity_at e reset silence_alerted
  // CRM-007: getSilent retorna leads com last_activity > warning_days
  // CRM-008: email não duplicado se silence_alerted=true (event_key único)
});
```

Ficheiro `src/app/core/services/__tests__/dashboard.service.spec.ts`:

Implementar **DSH-001 a DSH-010**:

```typescript
describe('DashboardService', () => {
  // DSH-001: getPartnerSummary retorna todos os campos calculados
  // DSH-002: progress_pct_tier correcto (60k de 100k → 60%)
  // DSH-003: volume_to_next_tier correcto
  // DSH-004: bonus_status[] para cada bónus do plano
  // DSH-005: progress_pct_target vs meta trimestral
  // DSH-006: pipeline_value e leads_sem_actividade
  // DSH-007: getAdminOverview agrega todos os parceiros
  // DSH-008: partner a chamar getAdminOverview lança ForbiddenError
  // DSH-009: getEstimationAccuracy por tipo de projecto
  // DSH-010: getPipelineSummary agrupado por estado com value_total
});
```

### Critérios de conclusão da Fase 2

- [ ] `npm run test` passa a verde com CRM-001 a CRM-008 e DSH-001 a DSH-010
- [ ] Kanban de leads com drag-and-drop funcional entre colunas
- [ ] Transições de estado com validação (lost_reason obrigatório)
- [ ] `last_activity_at` actualizado via trigger DB
- [ ] Dashboard do parceiro com `TierProgressComponent` animado
- [ ] Dashboard admin com overview de parceiros
- [ ] Painel de objecções acessível no detalhe de lead
- [ ] RLS verificada: partner não vê leads de outro partner
- [ ] Sem `any` no TypeScript

**Quando todos os critérios estiverem verificados, avança imediatamente para a Fase 3.**

---

# FASE 3 — TIQS: Motores e Builder
## Semanas 5–7

### O que construir

#### 3.1 Serviços de lógica pura TIQS (escrever testes primeiro)

Antes de qualquer implementação, criar os ficheiros de teste:

`src/app/core/services/__tests__/scoping-engine.service.spec.ts` — **TIQS-001 a TIQS-006**
`src/app/core/services/__tests__/risk-engine.service.spec.ts` — **TIQS-007 a TIQS-015**
`src/app/core/services/__tests__/quote-calculator.service.spec.ts` — **TIQS-016 a TIQS-022**
`src/app/core/services/__tests__/margin-validator.service.spec.ts` — **TIQS-023 a TIQS-026**
`src/app/core/services/__tests__/catalog.service.spec.ts` — **CAT-001 a CAT-004**
`src/app/core/services/__tests__/quote-template.service.spec.ts` — **TIQS-054 a TIQS-056**

Verificar que todos os testes falham (red). Depois implementar.

**`ScopingEngineService`:**
```typescript
// Avalia scoping_answers contra scoping_questions.activates_modules
// Retorna: módulos a activar (slugs de catalog_items)
evaluateAnswers(answers: ScopingAnswers, questions: ScopingQuestion[]): string[]

// Cria fases e itens a partir dos módulos activados
// Faz snapshot de hourly_rate do rate_profile no momento
buildPhasesFromModules(modules: CatalogItem[], rateProfiles: RateProfile[]): QuotePhaseDto[]

// Valida que todas as perguntas required têm resposta
validateCompleteness(answers: ScopingAnswers, questions: ScopingQuestion[]): ValidationResult
```

**`RiskEngineService`:**
```typescript
// Avalia triggers de risco nas respostas
detectRisks(answers: ScopingAnswers, questions: ScopingQuestion[], multipliers: RiskMultiplier[]): DetectedRisk[]

// Calcula produto dos multiplicadores activos
calculateTotalMultiplier(risks: DetectedRisk[]): number  // nunca < 1.0

// Verifica se existe risco bloqueante
hasBlockingRisk(risks: DetectedRisk[]): boolean
```

**`QuoteCalculatorService`:**
```typescript
calculateItemSubtotal(item: QuoteItem): number
calculatePhaseTotal(items: QuoteItem[], includeOptional?: boolean): number
calculateQuoteTotals(phases: QuotePhase[], discount_pct: number, risk_multiplier: number, minimum_price: number, tax_rate: number): QuoteTotals

// QuoteTotals shape:
interface QuoteTotals {
  subtotal_base: number;
  risk_adjustment: number;
  subtotal_with_risk: number;
  discount_amount: number;
  total_before_tax: number;
  total_with_tax: number;
  total_hours: number;
}
```

**`MarginValidatorService`:**
```typescript
calculateMargin(totals: QuoteTotals, items: QuoteItem[], fixed_cost_proxy_pct: number): MarginResult

interface MarginResult {
  custo_interno: number;
  margin_value: number;
  margin_pct: number;
  is_valid: boolean;
  minimum_margin_pct: number;
}
```

**`CatalogService`:**
```typescript
search(query: string, projectTypeSlug?: string): Observable<CatalogItem[]>
saveAsNew(item: Partial<CatalogItem>): Promise<CatalogItem>
incrementUsage(itemId: string): Promise<void>
```

**`QuoteTemplateService`:**
```typescript
createFromQuote(quoteId: string, name: string, description?: string): Promise<QuoteTemplate>
loadTemplate(templateId: string): Promise<{ phases: QuotePhaseDto[] }>
incrementUsage(templateId: string): Promise<void>
```

#### 3.2 Wizard de scoping

**Feature `quotes/quote-wizard/`** com 4 steps usando `p-stepper`:

**Step 1 — `step-project-type`:**
Grid de cards visuais (2×3), um por `project_type`. Cada card: ícone, nome, descrição curta. Selecção muda o estado do wizard. Botão "Continuar".

**Step 2 — `step-scoping`:**
Formulário dinâmico gerado a partir de `scoping_questions` do tipo seleccionado. Renderizar input correcto por `question_type`:
- `single_choice` → `p-selectbutton`
- `multi_select` → `p-multiselect`
- `numeric` → `p-inputnumber`
- `complexity_scale` → `p-slider` (1–5) com labels
- `risk_indicator` → `p-togglebutton`
- `text` → `p-textarea` (não impacta preço, marcado como "Nota opcional")

Chamada a `ScopingEngineService.validateCompleteness()` ao tentar avançar.

**Step 3 — `step-modules`:**
Lista de módulos activados pelas respostas (não editável) + lista de módulos opcionais disponíveis para o tipo de projecto (seleccionáveis). Para cada módulo: nome, descrição, horas estimadas, valor. Total actualizado em tempo real à medida que o parceiro selecciona/remove módulos opcionais.

**Step 4 — `step-review`:**
Resumo completo:
- Respostas do scoping (read-only)
- Riscos detectados com badges por categoria (técnico, timeline, cliente, scope)
- Multiplicador total aplicado
- Breakdown financeiro: base → risco → desconto → total
- Margem calculada com indicador de cor
- Botão "Criar orçamento" → chama `ScopingEngineService.buildPhasesFromModules()` e navega para o builder com as fases pré-preenchidas

#### 3.3 Builder manual de orçamento

**Feature `quotes/quote-builder/`:**

Layout em duas colunas:
- Coluna principal (70%): lista de fases com itens
- Sidebar direita (30%): totais fixos + risk panel + margin indicator

**Fases:**
- Drag-and-drop para reordenar (`cdkDrag`)
- Botão "Adicionar fase" no final
- Cada fase: nome editável inline, descrição opcional, botão de collapse, botão de eliminar (com confirmação)

**Itens dentro de cada fase:**
- Drag-and-drop dentro da fase
- Botão "Adicionar item" abre drawer `item-editor`
- Botão "Pesquisar catálogo" abre modal `catalog-picker`
- Cada item na lista: nome, tipo (badge hourly/fixed), horas ou valor, subtotal, checkbox opcional, botões editar/eliminar

**`item-editor` (drawer):**
Campos: nome, descrição, `pricing_type` (toggle), horas + rate_profile OU unit_value, quantidade, opcional. Subtotal calculado em tempo real. Botão "Guardar no catálogo" (chama `CatalogService.saveAsNew()`).

**`catalog-picker` (modal):**
Pesquisa com debounce 300ms. Filtro por categoria. Lista ordenada por `usage_count` desc. Selecção fecha modal e adiciona item ao builder com defaults editáveis.

**`risk-panel` (drawer):**
Lista de riscos detectados pelo wizard (ou vazia se orçamento criado manualmente). Admin pode adicionar/remover riscos manualmente. Multiplicador total mostrado em destaque. Se `has_blocking_risk=true`, badge vermelho "Bloqueado" com botão de override (apenas admin).

**`margin-indicator`:**
Componente fixo na sidebar com:
- Margem actual (percentagem grande)
- Cor: verde >30%, âmbar 25–30%, vermelho <25%
- Texto: "Margem mínima: 25%" com a configuração actual
- Se abaixo do mínimo: aviso "Não é possível submeter com esta margem"

**Sidebar de totais:**
- Subtotal base
- Ajuste de risco (+ valor)
- Desconto (input de percentagem, apenas admin)
- Total sem IVA (destaque)
- IVA 23%
- Total com IVA
- Botões: "Guardar rascunho" | "Submeter para revisão"

**Lógica de guardar:**
Todos os cálculos correm client-side em tempo real. O save persiste no Supabase. `quote_audit_log` é criado via trigger DB para alterações a campos financeiros.

#### 3.4 Gestão de orçamentos

**Feature `quotes/quote-list/`:**
Tabela com colunas: título, cliente, parceiro, estado (badge), valor, data, acções. Filtro por estado e parceiro (admin). RLS garante que partner vê apenas os seus.

**Feature `quotes/quote-preview/`:**
Vista HTML fiel ao PDF que será gerado. Não usa componentes de edição. Botão "Gerar PDF" (apenas admin, fase 4).

**Feature `quotes/quote-versions/`:**
Lista de versões com `version`, `created_at`, `status`. Botão "Criar nova versão" (apenas em orçamentos aceites ou rejeitados). Botão "Comparar" abre vista side-by-side de dois orçamentos (diff de fases/itens/totais).

#### 3.5 Settings de configuração

**Feature `settings/project-types/`:** CRUD de tipos de projecto.
**Feature `settings/scoping-questions/`:** CRUD de perguntas por tipo, com drag-and-drop para `sort_order`.
**Feature `settings/risk-multipliers/`:** CRUD de multiplicadores com campo de multiplicador validado (>= 1.0).
**Feature `settings/rate-profiles/`:** CRUD de tarifas horárias.
**Feature `settings/catalog/`:** Lista de itens do catálogo com filtros, toggle de activo/inactivo.

### Critérios de conclusão da Fase 3

- [ ] `npm run test` passa a verde com TIQS-001 a TIQS-026, TIQS-054 a TIQS-056, CAT-001 a CAT-004
- [ ] Wizard de scoping completo com 4 steps e validação
- [ ] Builder com drag-and-drop de fases e itens
- [ ] Cálculos em tempo real na sidebar
- [ ] `risk-panel` com override admin funcional
- [ ] `margin-indicator` com cores correctas
- [ ] `catalog-picker` com pesquisa e ordenação por usage_count
- [ ] `quote_audit_log` criado via trigger para alterações financeiras
- [ ] RLS verificada: partner não vê orçamentos de outro partner
- [ ] Sem `any` no TypeScript

**Quando todos os critérios estiverem verificados, avança imediatamente para a Fase 4.**

---

# FASE 4 — Aprovação, PDF e Portal do Cliente
## Semanas 8–10

### O que construir

#### 4.1 Serviços de estado (testes primeiro)

`src/app/core/services/__tests__/quote-state.service.spec.ts` — **TIQS-027 a TIQS-036**
`src/app/core/services/__tests__/gantt.service.spec.ts` — **TIQS-037 a TIQS-040**
`src/app/core/services/__tests__/client-portal.service.spec.ts` — **TIQS-041 a TIQS-047**

**`QuoteStateService`:**
```typescript
// Máquina de estados com transições válidas (PRD secção 3 do TIQS)
transition(quoteId: string, newStatus: QuoteStatus, options?: TransitionOptions): Promise<Quote>

// TransitionOptions:
interface TransitionOptions {
  notes?: string;                // obrigatório ao devolver
  adminRiskOverride?: boolean;   // para override de risco bloqueante
  adminRiskNotes?: string;       // obrigatório com override
  discountReason?: string;       // obrigatório com margem abaixo do mínimo
}
```

Regras:
- Partner: apenas `rascunho → em_revisao`
- Admin: todas as restantes
- Devolução exige `notes`
- Override de risco exige `adminRiskNotes`
- Submissão com margem baixa exige `discountReason` (admin) ou bloqueia (partner)
- Registo automático em `quote_status_history`

**`GanttService`:**
```typescript
buildGanttData(phases: QuotePhase[], startDate: Date, dailyCapacityHours: number): GanttData
adjustPhase(ganttData: GanttData, phaseId: string, newStartDate: Date): GanttData
calculateWorkingDays(startDate: Date, durationDays: number): Date  // exclui fins-de-semana
```

#### 4.2 Vista de revisão admin

**Feature `quotes/quote-review/`:**

Acesso apenas admin. Mostra:
- Dados do orçamento (read-only para admin excepto override fields)
- Risk panel com capacidade de override (com campo de notas obrigatório)
- Margin indicator com campo de justificação se abaixo do mínimo
- Breakdown financeiro completo com audit log das últimas 5 alterações
- Botões de acção: "Devolver" (abre modal com campo de notas) | "Aprovar"
- Histórico de estados (`quote_status_history`)

#### 4.3 Gantt interactivo

**Feature `quotes/gantt/` (com `@defer`):**

Usar `@defer (on viewport)` para carregar apenas quando necessário.

Componente com:
- Barra de Gantt por fase com datas calculadas pelo `GanttService`
- Drag das barras para ajustar datas (desloca fases seguintes automaticamente)
- Input de `gantt_start_date` no topo
- Fins-de-semana marcados com fundo cinzento claro
- Data de hoje marcada com linha vertical

Implementar com SVG nativo ou `@dhtmlx/gantt` (free tier). Não usar bibliotecas pagas.

Guardar `gantt_data` e `gantt_start_date` em `quotes` via save manual (não auto-save).

#### 4.4 Edge Function: geração de PDF

`supabase/functions/generate-quote-pdf/index.ts`:

```typescript
// Input: { quote_id: string }
// 1. Carregar orçamento completo com fases, itens, riscos, totais, cliente, parceiro
// 2. Renderizar template HTML com branding TargX (cores e tipografia do Design System)
// 3. Gerar PDF via Puppeteer
// 4. Guardar em Storage: quotes/{quote_id}/v{version}.pdf
// 5. Actualizar quotes.pdf_url
// 6. Retornar URL assinada (válida 7 dias)
```

Template HTML do PDF deve incluir:
- Logo TargX no header
- Nome do cliente, data, número do orçamento, versão
- Tabela de fases e itens (itens opcionais marcados com "(Opcional)")
- Itens opcionais **não somam** no total principal
- Breakdown financeiro: subtotal, risco, desconto, total s/IVA, IVA, total c/IVA
- `internal_notes` **ausentes** do PDF
- Footer com `quote_pdf_footer` de `global_settings`
- Validade da proposta
- Espaço para assinatura

#### 4.5 Edge Function: envio ao cliente

`supabase/functions/send-quote-to-client/index.ts`:

```typescript
// Input: { quote_id: string }
// 1. Verificar que quote.status = 'aprovado_interno'
// 2. Gerar client_accept_token (UUID v4)
// 3. Definir token_expires_at = valid_until
// 4. Gerar URL assinada do PDF (7 dias)
// 5. Enviar email 'quote_to_client' via Resend com PDF + link portal
// 6. Actualizar status para 'enviado_cliente', sent_at=now()
// 7. Registar em email_logs
```

#### 4.6 Portal do cliente (rota pública)

**Feature `client-portal/`** — rota `/client/quotes/:token`, sem auth, sem sidebar.

`supabase/functions/handle-client-portal-open/index.ts`:
```typescript
// Chamado quando o cliente acede ao portal
// 1. Validar token e TTL
// 2. Se portal_open_count = 0: registar portal_opened_at, enviar notificação
// 3. Incrementar portal_open_count
// 4. Retornar dados do orçamento para o portal
```

**`portal.component.ts`:** layout de duas colunas:
- Coluna esquerda (60%): PDF embed + detalhes da proposta
- Coluna direita (40%): Gantt (read-only, com opção de arrastar desactivada) + painel de aceitação

**`portal-acceptance/`:**
- Lista de itens opcionais com toggle (aceitar/recusar cada um)
- Total actualizado em tempo real conforme opcionais são seleccionados
- Botão "Aceitar proposta" → abre modal de confirmação com total final
- Botão "Recusar proposta" → abre modal com campo de motivo obrigatório

`supabase/functions/handle-client-response/index.ts`:
```typescript
// POST { token, action: 'accept'|'reject', rejection_reason?, accepted_optionals: string[] }
// 1. Validar token e TTL (expirado → 410)
// 2. Actualizar optional_accepted nos quote_items seleccionados
// 3. Actualizar quote.status e accepted_at/rejected_at
// 4. Se aceite: chamar convert-quote-to-project
// 5. Enviar notificações a admin e parceiro
// 6. Registar em email_logs
```

#### 4.7 Tracking de abertura do portal

No componente `quote-detail` (detalhe do orçamento para admin/partner):
- Mostrar "Portal aberto X vezes" com data da primeira abertura
- Se `portal_open_count > 0`: badge "Cliente visualizou" em verde
- Se `portal_open_count = 0` e `sent_at` há mais de 3 dias: badge "Não aberto" em âmbar

#### 4.8 Alerta de expiração

`supabase/functions/check-quote-expirations/index.ts` (cron diário 08:00):
```typescript
// Para cada quote em 'enviado_cliente' com valid_until = hoje + 3 dias:
//   Enviar email 'quote_expiring' ao admin
//   Registar em email_logs com event_key='expiry_{quote_id}' (não duplicar)
```

#### 4.9 Testes PDF

`src/app/core/services/__tests__/pdf-generator.service.spec.ts` — **PDF-001 a PDF-005**

### Critérios de conclusão da Fase 4

- [ ] `npm run test` passa a verde com TIQS-027 a TIQS-047, TIQS-037 a TIQS-040, PDF-001 a PDF-005
- [ ] Revisão admin com override de risco e histórico de estados
- [ ] PDF gerado e guardado no Storage
- [ ] Email ao cliente com PDF e link
- [ ] Portal público acessível via token
- [ ] Portal expirado retorna 410
- [ ] Aceitação e rejeição funcionais com notificações
- [ ] Tracking de abertura (portal_open_count e portal_opened_at)
- [ ] Gantt com drag funcional e exclusão de fins-de-semana
- [ ] Sem `any` no TypeScript

**Quando todos os critérios estiverem verificados, avança imediatamente para a Fase 5.**

---

# FASE 5 — Conversão, Comissões Ponta a Ponta e Emails
## Semanas 11–12

### O que construir

#### 5.1 Serviços de conversão (testes primeiro)

`src/app/core/services/__tests__/quote-conversion.service.spec.ts` — **TIQS-048 a TIQS-053**
`src/app/core/services/__tests__/email.service.spec.ts` — **EML-001 a EML-009**
`src/app/core/services/__tests__/pdf-generator.service.spec.ts` — adicionar **PDF-006**

**`QuoteConversionService`:**
```typescript
convert(quoteId: string): Promise<Project>
// Idempotente: se projecto já existe, retorna existente
// Lógica conforme PRD secção 21:
// 1. contract_value = total_before_tax + opcionais aceites
// 2. estimated_hours = snapshot do total de horas do orçamento
// 3. Criar project
// 4. Criar tranches via parseTranches(payment_terms, contract_value)
// 5. lead.status → fechada_ganha
// 6. Incrementar usage_count de catalog_items e quote_templates
// 7. Dados de scoping e riscos imutáveis (verificar que não foram alterados)

parseTranches(paymentTerms: string, contractValue: number): CreateTrancheDto[]
// ex: '40% adjudicação, 30% entrega, 30% fecho'
// → [{ description: 'adjudicação', amount: 4000 }, ...]
```

#### 5.2 Edge Function: comissões ponta a ponta

Verificar e completar `supabase/functions/calculate-commission/index.ts` (criada na Fase 1):

```typescript
// Trigger: DB webhook em project_tranches quando received muda para true
// 1. Carregar parceiro, plano activo (partner_plans com active_from/to), tranches do ano
// 2. Chamar lógica de CommissionCalculatorService (replicada no servidor)
// 3. Inserir em commissions
// 4. Chamar BonusCalculatorService — verificar limiares
// 5. Criar annual_bonuses se necessário (idempotente via constraint unique)
// 6. Se bónus criado: enviar email 'bonus_reached' a admin e parceiro
// 7. Se volume > 90% de qualquer limiar não atingido: enviar 'bonus_near'
// 8. Enviar 'commission_paid' ao parceiro
// 9. Registar em email_logs (deduplicação por event_key)
```

`supabase/functions/remove-commission/index.ts`:
```typescript
// Trigger: DB webhook em project_tranches quando received muda para false
// 1. Encontrar comissão associada à tranche
// 2. Eliminar de commissions
// 3. Verificar se annual_bonuses precisam de ser revertidos
//    (se volume cai abaixo de threshold, marcar bónus como não atingido)
```

#### 5.3 Módulo de projectos completo

**Feature `projects/`:**

`project-list`: tabela com colunas: título, cliente, parceiro, valor, estado (badge), data, horas estimadas vs reais. Filtro por estado. Botão "Novo projecto" (criação manual, sem orçamento — para projectos directos).

`project-detail`: página com:
- Header: título, cliente, parceiro, estado, contract_value
- Tab "Tranches": lista de tranches com checkbox "Recebida" (apenas admin/tech). Ao marcar: actualiza `received`, `received_date`. Edge Function calcula comissão automaticamente.
- Tab "Horas": `hours-log` com lista de registos + form para adicionar (apenas tech/admin). Total de horas reais vs estimadas.
- Tab "Orçamento origem": link e preview se veio de conversão.
- Tab "Comissões": lista de comissões geradas por este projecto.

**`tranche-list`:** componente reutilizável com:
- Cada tranche: descrição, valor, `due_date`, checkbox recebida, `received_date` se recebida, badge `commission_paid`
- Soma de tranches vs contract_value com aviso se excede em >1%
- Botão "Adicionar tranche" (admin/tech)

#### 5.4 Módulo de comissões completo

**Feature `commissions/`:**

`commission-timeline`: lista cronológica de comissões do parceiro (ou todas para admin). Colunas: data, projecto, cliente, tranche, valor, taxa, comissão. Filtro por ano. Total no rodapé. Exportar para Excel (usar `xlsx` library).

`bonus-tracker`: vista standalone das metas e bónus anuais. Para cada bónus do plano: progress bar, estado, data de atingimento se já atingido.

`commission-statement`: página para geração de extracto PDF. Filtros: parceiro (admin), ano, mês. Botão "Gerar extracto" chama Edge Function `generate-commission-statement`.

#### 5.5 Edge Function: extracto de comissões

`supabase/functions/generate-commission-statement/index.ts`:
```typescript
// Input: { partner_id, year, month? }
// 1. Carregar comissões do período
// 2. Renderizar HTML: header parceiro, tabela detalhada, totais, bónus
// 3. Gerar PDF via Puppeteer
// 4. Guardar em Storage: commissions/{partner_id}/{year}/{month_or_annual}.pdf
// 5. Retornar URL assinada
```

#### 5.6 Emails e crons completos

Completar todos os templates Resend e Edge Functions de email:

`supabase/functions/send-monthly-digest/index.ts` (cron 1º dia 08:00):
```typescript
// Para cada parceiro activo:
// 1. Calcular volume e comissão do mês anterior
// 2. Calcular acumulados do ano
// 3. Identificar patamar actual e próximo limiar
// 4. Gerar extracto PDF do mês
// 5. Enviar 'monthly_digest' com extracto em anexo
// 6. Registar em email_logs com event_key='digest_{partner_id}_{YYYY_MM}'
```

Templates Resend a criar (HTML responsivo, branding TargX):
- `commission_paid`: "Recebeste uma comissão de X€ pelo projecto Y"
- `bonus_near`: "Estás a X€ do bónus de Y€"
- `bonus_reached`: "Atingiste o bónus de X€!"
- `monthly_digest`: resumo mensal com tabela + extracto em anexo
- `annual_summary`: resumo anual completo
- `lead_assigned`: "Foi-te atribuída uma nova lead: X"
- `lead_silence_alert`: "A lead X está sem actividade há Y dias"
- `quote_submitted`: "Novo orçamento para revisão: X"
- `quote_returned`: "O orçamento X foi devolvido: [nota]"
- `quote_approved`: "O orçamento X foi aprovado"
- `quote_to_client`: email ao cliente com PDF + link portal
- `quote_portal_opened`: "O cliente abriu a proposta X"
- `quote_accepted`: "O cliente aceitou a proposta X"
- `quote_rejected`: "O cliente recusou a proposta X: [motivo]"
- `quote_expiring`: "A proposta X expira em 3 dias"

Todos os emails:
- Logo TargX no header
- Footer com contactos
- Deduplicação garantida via `event_key` em `email_logs`
- Erro do Resend registado sem lançar excepção (EML-004)

#### 5.7 Reset anual

`supabase/functions/annual-reset/index.ts` (cron 1 Jan 00:01):
```typescript
// 1. Verificar que não foi executado este ano (via annual_snapshots)
// 2. Para cada parceiro: criar annual_snapshot com volume, comissão, bónus
// 3. Enviar email 'annual_summary' a cada parceiro
// 4. Enviar email de overview global ao admin
```

### Critérios de conclusão da Fase 5

- [ ] `npm run test` passa a verde com TIQS-048 a TIQS-053, EML-001 a EML-009, PDF-006
- [ ] Conversão quote→projecto→tranches funcional e idempotente
- [ ] Marcar tranche como recebida dispara comissão automaticamente
- [ ] Desmarcar tranche remove comissão
- [ ] Bónus criados automaticamente ao cruzar limiares (sem duplicar)
- [ ] Todos os emails enviados e registados com event_key
- [ ] Extracto de comissões em PDF gerado correctamente
- [ ] `commission-timeline` com export Excel
- [ ] Crons registados no Supabase (monthly_digest, annual_reset, check-lead-silence, check-quote-expirations)
- [ ] Sem `any` no TypeScript

**Quando todos os critérios estiverem verificados, avança imediatamente para a Fase 6.**

---

# FASE 6 — Horas Reais, Settings Completos e Polimento
## Semanas 13–14

### O que construir

#### 6.1 Horas reais e calibração

**Feature `projects/hours-log/`:**
- Form para registar horas: data, horas, descrição (apenas tech/admin)
- Lista de registos com total acumulado
- Comparação visual: barra horizontal com estimado vs real
- Ao concluir projecto: campo `actual_hours` actualizado automaticamente com soma de `project_hours_log`

**Dashboard admin — secção estimação:**

Completar `DashboardService.getEstimationAccuracy()` (DSH-009):
```typescript
// Agrega para projectos concluídos com actual_hours preenchidas:
// { project_type, avg_estimated, avg_actual, avg_deviation_pct, count }
// Ordenado por avg_deviation_pct desc (tipos mais subestimados primeiro)
```

Vista no dashboard admin: tabela com tipo de projecto, horas médias estimadas, horas médias reais, desvio percentual. Coluna de desvio colorida: verde <10%, âmbar 10–25%, vermelho >25%.

Nota de contexto visível no dashboard: "Estes dados alimentam a calibração do wizard. Actualiza os `base_hours` nos settings com base nos desvios."

#### 6.2 Settings globais completos

**Feature `settings/global/`:**
Formulário com todos os campos de `global_settings`:
- `minimum_margin_pct` (number input, %)
- `minimum_project_price` (currency input)
- `default_valid_days` (number input)
- `default_payment_terms` (text input com preview de parsing)
- `fixed_item_cost_proxy_pct` (number input, %)
- `tax_rate_pct` (number input, %)
- `daily_capacity_hours` (number input)
- `lead_silence_warning_days` (number input)
- `lead_silence_alert_days` (number input)
- `portal_open_tracking` (toggle)

Preview em tempo real do efeito das alterações (ex: "Com esta margem mínima, um projecto de 10.000€ precisa de custo máximo de X€").

**Feature `settings/commission-plans/`:**
CRUD completo:
- Lista de planos
- Detalhe: editar nome/descrição, gerir tiers (adicionar/remover escalões), gerir bónus
- Atribuição de parceiro a plano (via `partner_plans`) com datas de início/fim

#### 6.3 Gestão de parceiros

**Feature `settings/partners/`** (apenas admin):
- Lista de utilizadores com role=partner
- Activar/desactivar parceiro (`profiles.active`)
- Ver plano activo e datas
- Link para dashboard do parceiro (admin pode ver dashboard de qualquer parceiro)
- Link para comissões do parceiro

#### 6.4 Export Excel de comissões

Na `commission-timeline`, botão "Exportar Excel":
```typescript
// Usar biblioteca xlsx (já no package.json do Angular)
import * as XLSX from 'xlsx';

// Exportar: data, projecto, cliente, tranche, valor, taxa, comissão
// Linha de totais no final
// Nome do ficheiro: comissoes_{partner_name}_{year}.xlsx
```

#### 6.5 Auditoria e logs

**Feature `settings/audit/`** (apenas admin):
- Tabela de `quote_audit_log`: orçamento, campo, valor anterior, novo valor, utilizador, data
- Filtros por orçamento, utilizador, data
- Tabela de `email_logs`: tipo, destinatário, estado, data
- Sem edição (apenas leitura)

#### 6.6 Verificação final de acessibilidade e performance

Para cada página:
- Focus ring visível em todos os elementos interactivos (outline teal)
- Contraste WCAG AA verificado
- `aria-label` em todos os ícones interactivos
- `@defer` confirmado no Gantt e gráficos do dashboard
- Lazy loading verificado nas rotas de features

#### 6.7 Testes de integração end-to-end (opcional mas recomendado)

Cenário principal a testar manualmente:
1. Admin cria parceiro e atribui plano Standard Partner
2. Parceiro cria lead, adiciona actividade
3. Parceiro cria orçamento via wizard (tipo: ecommerce)
4. Parceiro submete para revisão
5. Admin aprova, gera PDF, envia ao cliente
6. Simular acesso ao portal com token
7. Cliente aceita proposta
8. Verificar projecto criado com tranches correctas
9. Admin marca primeira tranche como recebida
10. Verificar comissão calculada correctamente (15% sobre valor)
11. Verificar email commission_paid enviado
12. Verificar dashboard do parceiro actualizado

### Critérios de conclusão da Fase 6 (e do projecto)

- [ ] `npm run test` passa a verde com todos os 116 testes
- [ ] Registo de horas reais funcional
- [ ] Dashboard admin com análise estimado vs real
- [ ] Settings globais editáveis com efeito imediato
- [ ] Settings de commission plans com CRUD completo de tiers e bónus
- [ ] Export Excel de comissões funcional
- [ ] Audit log acessível ao admin
- [ ] Todos os `@defer` verificados
- [ ] Zero `any` em todo o código (`tsc --strict` sem erros)
- [ ] Cenário E2E manual executado com sucesso

---

## REFERÊNCIA FINAL

Documentos de referência para toda a execução:
- `TargX_CRM_PRD_Master.md` v2.0 — lógica de negócio, schema, testes
- `TargX_CRM_DesignSystem.md` v1.0 — paleta, tipografia, componentes
- `TargX_CRM_ClaudeCode_Fase1.md` — contexto da Fase 1

Variáveis de ambiente (`.env.local`):
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

---

*TargX CRM — Prompt Sequencial Fases 2–6 — Junho 2026*
