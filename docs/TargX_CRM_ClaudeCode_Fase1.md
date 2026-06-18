# TargX CRM — Prompt de Arranque Claude Code
# Fase 1: Fundação — Schema, Auth, Motor de Comissões

---

## CONTEXTO DO PROJECTO

Estás a construir o **TargX CRM**, uma aplicação Angular 21 + Supabase para gestão do ciclo comercial completo de uma software house portuguesa. A aplicação corre em `crm.targx.com`, servidor próprio.

A abordagem é **Spec Driven Development**: todos os testes unitários são escritos e aprovados **antes** de qualquer implementação de funcionalidades.

O documento de referência é o **TargX CRM PRD Master v2.0**. Toda a decisão de arquitectura, schema e lógica de negócio está definida nesse documento. Não inventas, não simplificas, não adicionas — segues o PRD.

---

## STACK OBRIGATÓRIA

- **Frontend:** Angular 21, standalone components, signals, `inject()`, control flow nativo (`@if`, `@for`, `@defer`), zoneless
- **Backend/DB:** Supabase (PostgreSQL, Auth, Storage, Edge Functions, Row Level Security)
- **Emails:** Resend
- **PDF:** Puppeteer via Supabase Edge Function (fase posterior)
- **Testes:** Vitest para serviços de lógica pura
- **Styling:** Tailwind CSS
- **Linguagem do código:** Inglês (campos DB, variáveis, funções, ficheiros)
- **Linguagem da UI:** Português de Portugal

---

## O QUE CONSTRUIR NA FASE 1

### 1. Setup do projecto Angular 21

```bash
ng new targx-crm --standalone --routing --style=scss --skip-tests=false
```

Instalar dependências:
```bash
npm install @supabase/supabase-js
npm install -D vitest @vitest/coverage-v8
npm install tailwindcss @tailwindcss/forms
```

Configurar Vitest em `vite.config.ts` para testes unitários dos serviços de lógica pura.

Estrutura de pastas conforme o PRD (secção 30):
```
src/app/
├── core/
│   ├── models/
│   ├── services/
│   ├── guards/
│   └── supabase/
├── features/
└── shared/
```

### 2. Schema completo Supabase

Criar ficheiro `supabase/migrations/001_initial_schema.sql` com **todas** as tabelas do PRD (secções 5 a 12), pela ordem exacta de dependências:

```
profiles → global_settings → clients → leads → lead_activities →
partner_targets → project_types → scoping_questions → rate_profiles →
catalog_items → quote_templates → risk_multipliers → quotes →
quote_audit_log → quote_phases → quote_items → quote_status_history →
projects → project_tranches → project_hours_log →
commission_plans → commission_tiers → commission_bonuses →
partner_plans → commissions → annual_bonuses → annual_snapshots →
objection_playbook → email_logs
```

Incluir todos os tipos ENUM antes das tabelas que os usam.

### 3. Trigger de audit log

Criar trigger PostgreSQL que regista em `quote_audit_log` sempre que um destes campos muda em `quotes`:
- `total_before_tax`
- `discount_pct`
- `risk_multiplier_total`
- `calculated_margin_pct`
- `status`

```sql
-- Ficheiro: supabase/migrations/002_audit_trigger.sql
create or replace function fn_quote_audit_log()
returns trigger language plpgsql as $$
-- implementar aqui
$$;
```

### 4. Seeds iniciais

Criar `supabase/seed.sql` com:

```sql
-- global_settings (todos os valores do PRD secção 5.2)
-- commission_plans: 'Standard Partner'
-- commission_tiers: 0–100000@15%, 100001–null@20%, label em PT
-- commission_bonuses: threshold 150000→3000, threshold 250000→7500
-- rate_profiles: Júnior (45€/h), Sénior (75€/h), Arquitecto (95€/h), Designer (60€/h), DevOps (70€/h)
-- project_types: os 5 tipos do PRD com slugs correctos
```

### 5. Row Level Security

Criar `supabase/migrations/003_rls.sql` com as políticas do PRD (secção 32):

- `leads`: partner vê apenas `partner_id = auth.uid()`; admin e tech vêem tudo.
- `quotes`: partner vê apenas `partner_id = auth.uid()`; admin vê tudo.
- `commissions` e `annual_bonuses`: partner vê apenas as suas; admin vê tudo.
- `quote_audit_log`: insert via trigger apenas (sem update, sem delete por ninguém).
- `project_tranches` e `project_hours_log`: update apenas admin e tech.
- `objection_playbook`: leitura autenticada; escrita apenas admin.
- `global_settings`, `commission_plans`, `commission_tiers`, `commission_bonuses`, `rate_profiles`, `project_types`: leitura autenticada; escrita apenas admin.

### 6. Auth e guards Angular

Criar `AuthService` com:
- `signIn(email, password)` via Supabase Auth
- `signOut()`
- `currentUser$`: signal com `User | null`
- `currentProfile$`: signal com `Profile | null` (carregado de `profiles`)
- `role$`: signal com `'admin' | 'partner' | 'tech' | null`

Criar `AuthGuard` e `RoleGuard`:
```typescript
// RoleGuard aceita array de papéis permitidos
// ex: canActivate: [() => inject(RoleGuard).canActivate(['admin', 'tech'])]
```

Criar página de login simples (`/login`) com formulário email + password.

### 7. Modelos TypeScript

Criar um ficheiro por entidade em `src/app/core/models/`, gerados a partir do schema. Usar tipos estritos sem `any`.

Exemplos obrigatórios:
```typescript
// profile.model.ts
export interface Profile { id: string; full_name: string; email: string; role: 'admin' | 'partner' | 'tech'; active: boolean; created_at: string; }

// commission.model.ts
export interface CommissionTier { id: string; plan_id: string; tier_order: number; volume_from: number; volume_to: number | null; rate_percent: number; label: string | null; }

// lead.model.ts
export type LeadStatus = 'nova' | 'contactada' | 'proposta_enviada' | 'negociacao' | 'fechada_ganha' | 'fechada_perdida';
```

### 8. Serviços de lógica pura (sem HTTP, testáveis isoladamente)

#### 8.1 `CommissionCalculatorService`

Implementar o método central:

```typescript
calculateForTranche(params: {
  trancheAmount: number;
  previousVolumeInYear: number;
  tiers: CommissionTier[];
}): CommissionResult
```

Onde `CommissionResult` contém:
- `commissionAmount`: valor total da comissão
- `breakdown`: array de `{ tierLabel, portion, rate, amount }`
- `newVolumeTotal`: volume acumulado após esta tranche

Lógica conforme PRD secção 22:
```
para cada tier (ordenado por tier_order):
  sobreposição = intervalo da tranche ∩ intervalo do tier
  comissão += sobreposição × rate_percent / 100
```

#### 8.2 `BonusCalculatorService`

```typescript
checkBonusThresholds(params: {
  previousVolume: number;
  newVolume: number;
  bonuses: CommissionBonus[];
  existingBonuses: AnnualBonus[];  // já criados este ano
}): BonusToCreate[]
```

Retorna lista de bónus a criar (limiares cruzados que ainda não existem).

#### 8.3 `AccumulatedVolumeService`

```typescript
getAccumulatedVolume(params: {
  partnerId: string;
  year: number;
  excludeTrancheId?: string;  // para recalcular após desmarcar
}): Promise<number>
```

### 9. Testes unitários — escrever ANTES de implementar

Criar `src/app/core/services/__tests__/` com os seguintes ficheiros de teste, **implementando todos os casos de teste do PRD secção 29 (COM-001 a COM-022)**:

#### `commission-calculator.service.spec.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { CommissionCalculatorService } from '../commission-calculator.service';

// Plano de teste standard:
const standardTiers: CommissionTier[] = [
  { id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0, volume_to: 100000, rate_percent: 15, label: 'Base' },
  { id: '2', plan_id: 'p1', tier_order: 2, volume_from: 100000, volume_to: null, rate_percent: 20, label: 'Sénior' },
];

describe('CommissionCalculatorService', () => {
  // COM-001 a COM-011 — implementar todos
});
```

#### `bonus-calculator.service.spec.ts`
```typescript
// COM-012 a COM-017
```

#### `project-tranche.service.spec.ts`
```typescript
// COM-018 a COM-022
// Nota: métodos que acedem ao Supabase devem usar mock do SupabaseClient
```

**Os testes têm de passar a verde antes de continuar para a Fase 2.**

---

## ESTRUTURA DE FICHEIROS ESPERADA NO FIM DA FASE 1

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
│       │   ├── models/
│       │   │   ├── profile.model.ts
│       │   │   ├── client.model.ts
│       │   │   ├── lead.model.ts
│       │   │   ├── quote.model.ts
│       │   │   ├── project.model.ts
│       │   │   ├── commission.model.ts
│       │   │   └── email.model.ts
│       │   ├── services/
│       │   │   ├── auth.service.ts
│       │   │   ├── commission-calculator.service.ts
│       │   │   ├── bonus-calculator.service.ts
│       │   │   ├── accumulated-volume.service.ts
│       │   │   └── __tests__/
│       │   │       ├── commission-calculator.service.spec.ts
│       │   │       ├── bonus-calculator.service.spec.ts
│       │   │       └── project-tranche.service.spec.ts
│       │   ├── guards/
│       │   │   ├── auth.guard.ts
│       │   │   └── role.guard.ts
│       │   └── supabase/
│       │       ├── supabase.client.ts
│       │       └── database.types.ts
│       ├── features/
│       │   └── auth/
│       │       └── login/
│       │           └── login.component.ts
│       └── app.routes.ts
├── .env.local          (não commitar — apenas exemplo)
├── .env.example
└── vite.config.ts
```

---

## CONVENÇÕES OBRIGATÓRIAS

### Código
- Todos os ficheiros em inglês (nomes, variáveis, comentários de código).
- Texto de UI em português de Portugal.
- Sem `any`. Tipos estritos em todo o lado.
- Signals para estado reactivo; sem BehaviorSubject.
- `inject()` em vez de injecção por construtor.
- Standalone components em tudo.

### Git
- Commits por feature atómica com mensagem descritiva em inglês.
- `main` protegida. Trabalho em branches por fase.

### Supabase
- Nunca aceder com `service_role_key` no cliente Angular. Apenas no servidor (Edge Functions).
- RLS activa em todas as tabelas desde o início.
- Toda a lógica de cálculo de comissões vive em Edge Functions ou serviços server-side, nunca no cliente.

### Testes
- Vitest para lógica pura (sem DOM, sem HTTP).
- Serviços com dependências Supabase usam mock do cliente.
- `npm run test` tem de passar a verde antes de qualquer PR para main.

---

## VARIÁVEIS DE AMBIENTE

Criar `.env.example`:
```env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@targx.com
APP_URL=https://crm.targx.com
CLIENT_PORTAL_BASE_URL=https://crm.targx.com/client/quotes
PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser
```

---

## CRITÉRIOS DE CONCLUSÃO DA FASE 1

A Fase 1 está concluída quando:

1. `npm run test` passa a verde com todos os testes COM-001 a COM-022.
2. `supabase db push` aplica as migrations sem erros.
3. `supabase db seed` popula os dados iniciais correctamente.
4. Login funciona para os três papéis (admin, partner, tech).
5. RLS verificada: utilizador partner não consegue ler leads de outro partner.
6. Trigger de audit log cria registo quando `total_before_tax` muda.
7. Nenhum `any` no TypeScript (`tsc --strict` sem erros).

Só depois de todos os critérios verificados se avança para a Fase 2.

---

## REFERÊNCIA

PRD completo: `TargX_CRM_PRD_Master.md` (v2.0, Junho 2026)

Secções mais relevantes para a Fase 1:
- Secção 5: `profiles` e `global_settings`
- Secções 6–12: schema completo
- Secção 22: lógica do motor de comissões
- Secção 23: lógica de bónus
- Secção 29 (COM-001 a COM-022): testes obrigatórios
- Secção 30: estrutura Angular
- Secção 32: políticas RLS
- Secção 37: variáveis de ambiente
- Secção 38: decisões de arquitectura

---

*Prompt gerado para Claude Code — TargX CRM Fase 1 — Junho 2026*
