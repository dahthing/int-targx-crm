# TargX CRM — CLAUDE.md

**Projecto:** TargX CRM  
**URL:** crm.targx.com  
**Stack:** Angular 21 · Supabase · Resend · Puppeteer  
**Abordagem:** Spec Driven Development (testes antes da implementação)

---

## DOCUMENTOS DE REFERÊNCIA (fonte única de verdade)

| Documento | Localização | Uso |
|---|---|---|
| PRD Master v2.0 | `/Users/ruiguedes/Downloads/TargX_CRM_PRD_Master.md` | Arquitectura, schema, lógica de negócio, testes, rotas |
| Design System v1.0 | `/Users/ruiguedes/Downloads/TargX_CRM_DesignSystem.md` | **OBRIGATÓRIO** — cores, tipografia, componentes, layout |
| Fase 1 Prompt | `/Users/ruiguedes/Downloads/TargX_CRM_ClaudeCode_Fase1.md` | Checklist e critérios da Fase 1 |

---

## DESIGN SYSTEM — OBRIGATÓRIO

**O Design System é inviolável.** Qualquer componente Angular criado ou modificado DEVE seguir o Design System v1.0 sem excepções. Isto inclui:

- **Cores:** usar exclusivamente os tokens CSS definidos (`--tx-blue-*`, `--tx-teal-*`, `--tx-gray-*`, `--tx-gold`, semânticos). Nunca hardcodar valores HEX directamente no código — usar sempre as variáveis CSS.
- **Tipografia:** Inter para display/body, JetBrains Mono para valores técnicos. Escala definida no DS.
- **Componentes PrimeNG:** tema Aura customizado (`TargXTheme` em `src/styles/primeng-theme.ts`). Não usar outros temas ou overrides ad-hoc.
- **Classes Tailwind:** apenas as extensões definidas em `tailwind.config.js` do DS. Não inventar classes de cor fora da paleta.
- **Cards:** sempre `.tx-card` com `border-radius: 12px`, `border: 1px solid var(--tx-gray-200)`, `box-shadow: var(--shadow-card)`.
- **Botões:** `.tx-btn-primary` (teal), `.tx-btn-secondary` (branco/cinza), `.tx-btn-danger`, `.tx-btn-ghost`.
- **Badges:** `.tx-badge` com as classes de estado definidas (lead, quote, project/tranche).
- **Tabelas:** classe `.tx-table` sobre PrimeNG DataTable.
- **Formulários:** `.tx-form-label`, `.tx-input`, `.tx-field-error`, `.tx-field-hint`.
- **Layout:** sidebar 256px `tx-blue-950`, topbar 64px branco, page content `tx-gray-050`, padding 24px.
- **Barra de patamar:** componente `tx-tier-progress` conforme especificado — gradiente teal→blue, near-threshold gold.
- **KPI Cards:** `.tx-kpi-card` com variantes `.accent` (teal) e `.gold`.
- **Ícones:** PrimeIcons para UI padrão; Heroicons outline via SVG inline para navegação.
- **Animações:** `--transition-base: 0.15s ease`, `--transition-spring` para barras de progresso. Respeitar `prefers-reduced-motion`.
- **Acessibilidade:** WCAG AA, focus ring `2px solid var(--tx-teal-500) offset 2px`, `aria-label` em ícones.
- **Tokens CSS globais:** carregados de `src/styles/tokens.css` (secção 12 do DS).

---

## STACK OBRIGATÓRIA

```
Frontend:    Angular 21, standalone components, signals, inject(), @if/@for/@defer, zoneless
DB/Auth:     Supabase (PostgreSQL, Auth, Storage, Edge Functions, RLS)
Emails:      Resend (from: hello@targx.com)
PDF:         Puppeteer via Edge Function (Fases 4+)
Testes:      Vitest (serviços de lógica pura, sem DOM)
Styling:     Tailwind CSS 3 + PrimeNG 17 (tema Aura customizado)
Código:      Inglês (campos DB, variáveis, funções, ficheiros)
UI:          Português de Portugal
TypeScript:  Strict mode, sem any
```

---

## CONVENÇÕES DE CÓDIGO

- `inject()` em vez de injecção por construtor.
- Signals para estado reactivo; sem `BehaviorSubject`.
- Standalone components em tudo — sem `NgModule`.
- Tipos estritos — `tsc --strict` sem erros, zero `any`.
- `@defer` para componentes pesados (Gantt, gráficos).
- Nunca `service_role_key` no cliente Angular — apenas em Edge Functions.
- RLS activa em todas as tabelas desde o início.
- Lógica de comissões vive em Edge Functions ou serviços server-side, nunca no cliente.

---

## ESTRUTURA DO PROJECTO

```
targx-crm/
├── supabase/
│   ├── migrations/
│   │   ├── 001_initial_schema.sql
│   │   ├── 002_audit_trigger.sql
│   │   └── 003_rls.sql
│   └── seed.sql
├── src/
│   └── app/
│       ├── core/
│       │   ├── models/          -- um ficheiro por entidade
│       │   ├── services/        -- 16 serviços de lógica pura
│       │   │   └── __tests__/   -- specs Vitest
│       │   ├── guards/          -- auth.guard, role.guard
│       │   └── supabase/        -- cliente, helpers, types gerados
│       ├── features/            -- módulos por domínio (ver PRD secção 30)
│       └── shared/
│           ├── components/      -- status-badge, progress-bar, currency-display, etc.
│           └── pipes/           -- currencyPt, leadStatusLabel, quoteStatusLabel
├── src/styles/
│   ├── tokens.css               -- variáveis CSS globais do Design System
│   └── primeng-theme.ts         -- TargXTheme (Aura customizado)
├── tailwind.config.js           -- extensões da paleta TargX
├── .env.local                   -- nunca commitar
└── .env.example
```

---

## REGRAS DE CONTEXTO E MEMÓRIA

**Regra cardinal:** nunca perder contexto do que está a ser executado.

1. **Antes de qualquer tarefa:** verificar qual a fase activa e o estado actual em `.claude/memory/`.
2. **Após qualquer alteração relevante:** guardar em `.claude/memory/` (bug corrigido, decisão tomada, padrão adoptado, convenção descoberta).
3. **Bugs corrigidos:** registar em `.claude/memory/bugs.md` com causa, ficheiro afectado e solução.
4. **Decisões de arquitectura não previstas no PRD:** registar em `.claude/memory/architecture-decisions.md`.
5. **Desvios do Design System detectados:** registar em `.claude/memory/design-debt.md` para correcção posterior.
6. **Estado da fase actual:** manter `.claude/memory/phase-progress.md` actualizado.
7. **Nunca assumir** que o contexto está guardado — verificar sempre antes de começar.

---

## FASES DE IMPLEMENTAÇÃO

| Fase | Semanas | Conteúdo | Estado |
|---|---|---|---|
| 1 | 1–2 | Fundação: schema, auth, motor de comissões, testes COM-001→022 | A INICIAR |
| 2 | 3–4 | CRM, dashboards, alertas de silêncio, objecções | Pendente |
| 3 | 5–7 | TIQS: wizard, builder, catálogo, templates | Pendente |
| 4 | 8–10 | Aprovação, PDF, portal cliente, Gantt | Pendente |
| 5 | 11–12 | Conversão, comissões ponta a ponta, emails, crons | Pendente |
| 6 | 13–14 | Horas reais, analytics, settings, polimento | Pendente |

---

## CRITÉRIOS DE CONCLUSÃO DA FASE 1

- [ ] `npm run test` passa a verde: COM-001 a COM-022 (22 testes, 3 suites)
- [ ] `supabase db push` aplica migrations sem erros
- [ ] `supabase db seed` popula dados iniciais
- [ ] Login funciona para os 3 papéis (admin, partner, tech)
- [ ] RLS: partner não lê leads de outro partner
- [ ] Trigger audit log cria registo quando `total_before_tax` muda
- [ ] `tsc --strict` sem erros, zero `any`

---

## TESTES OBRIGATÓRIOS (Spec Driven Development)

Testes escritos e aprovados ANTES de qualquer implementação de funcionalidades.

- **Fase 1:** COM-001→022 (motor de comissões — onde um bug custa dinheiro real)
- **Fase 2:** CRM-001→008, DSH-001→010
- **Fase 3:** TIQS-001→036, TIQS-054→056, CAT-001→004
- **Fase 4:** TIQS-037→047, PDF-001→005
- **Fase 5:** TIQS-048→053, EML-001→009, PDF-006
- **Fase 6:** DSH-009

Total: **116 testes** em 16 suites (ver PRD secção 29 para especificação completa).

---

## VARIÁVEIS DE AMBIENTE

```env
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=           # apenas Edge Functions
SUPABASE_STORAGE_BUCKET_QUOTES=quotes
SUPABASE_STORAGE_BUCKET_COMMISSIONS=commissions
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@targx.com
APP_URL=https://crm.targx.com
CLIENT_PORTAL_BASE_URL=https://crm.targx.com/client/quotes
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## DECISÕES DE ARQUITECTURA (PRD secção 38)

| Decisão | Escolha |
|---|---|
| Comissões | Edge Function + webhook (inviolável, auditável) |
| Audit trail | Trigger DB + tabela imutável (sem dependência client) |
| Admin de regras | Páginas Angular (sem Strapi) |
| Tracking portal | Edge Function com service role (RLS preservado) |
| PDF | Puppeteer Edge Function (controlo HTML/CSS total) |
| Custo fixed | Proxy 60% configurável (`fixed_item_cost_proxy_pct`) |
| Gantt | `@defer` + lib JS (performance) |
| Portal cliente | Rota pública + token (sem app separada) |
| IA/Vector DB | Adiada pós Fase 6 |

---

Supabase
m$f!b4-32$c8WmU

resend
re_QoodXNSS_GpvoDCf1Z6SMpnR6Yo8iU4EW

*TargX CRM CLAUDE.md — actualizado Junho 2026*
