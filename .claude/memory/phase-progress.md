---
name: phase-progress
description: Estado actual de cada fase de implementação do TargX CRM
metadata:
  type: project
---

# Estado das Fases — TargX CRM

**Data de início do projecto:** Junho 2026  
**Fase activa:** Fase 1 — EM CURSO (critérios locais ✅ — aguarda Supabase)

---

## Fase 1 — Fundação (Sem. 1–2)

**Estado:** EM CURSO — critérios de código concluídos, falta integração Supabase

### Checklist de critérios de conclusão
- [x] `npm run test` passa COM-001 a COM-022 — **28/28 ✅ (Node 20)**
- [ ] `supabase db push` aplica migrations sem erros — aguarda credenciais
- [ ] `supabase db seed` popula dados iniciais — aguarda credenciais
- [ ] Login funciona para 3 papéis (admin, partner, tech) — aguarda Supabase
- [ ] RLS: partner não lê leads de outro partner — aguarda Supabase
- [ ] Trigger audit log activo para campos financeiros — aguarda Supabase
- [x] `tsc --strict` sem erros, zero `any` — **✅**

### Tarefas
- [x] Setup Angular 21
- [x] Instalar dependências
- [x] Configurar Vitest em `vite.config.ts`
- [x] Criar `src/styles/tokens.css`
- [x] Criar `src/styles/primeng-theme.ts`
- [x] Criar `tailwind.config.js`
- [x] Criar `supabase/migrations/001_initial_schema.sql`
- [x] Criar `supabase/migrations/002_audit_trigger.sql`
- [x] Criar `supabase/migrations/003_rls.sql`
- [x] Criar `supabase/seed.sql`
- [x] Criar modelos TypeScript em `src/app/core/models/`
- [x] Criar `AuthService` com signals
- [x] Criar `AuthGuard` e `RoleGuard`
- [x] Criar página de login (DS-compliant)
- [x] Escrever e passar testes COM-001 a COM-022
- [x] Implementar `CommissionCalculatorService`
- [x] Implementar `BonusCalculatorService`
- [x] Implementar `ProjectTrancheService`
- [x] Implementar `AccumulatedVolumeService`
- [x] Criar stubs para todas as rotas lazy-loaded
- [x] Corrigir `app.ts` para shell com router-outlet
- [x] `npm run test` → vitest run (Node 20 obrigatório)

### Nota crítica
**Node.js:** O projecto requer Node 20+. Com Node 10 (default do nvm), vitest falha.
Antes de `npm run test`, executar: `nvm use 20`

---

## Fase 2 — CRM e Dashboards (Sem. 3–4)
**Estado:** Pendente — aguarda conclusão da Fase 1

## Fase 3 — TIQS (Sem. 5–7)
**Estado:** Pendente

## Fase 4 — Aprovação, PDF, Portal (Sem. 8–10)
**Estado:** Pendente

## Fase 5 — Conversão, Comissões, Emails (Sem. 11–12)
**Estado:** Pendente

## Fase 6 — Horas reais, Polimento (Sem. 13–14)
**Estado:** Pendente

**Why:** Plano de 14 semanas definido no PRD secção 35. Spec Driven Development — testes antes de implementação.  
**How to apply:** Actualizar este ficheiro após cada tarefa concluída. Verificar aqui no início de cada sessão.
