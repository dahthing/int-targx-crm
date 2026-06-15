---
name: conventions
description: Padrões e convenções adoptados durante o desenvolvimento do TargX CRM
metadata:
  type: project
---

# Convenções — TargX CRM

Convenções descobertas ou confirmadas durante o desenvolvimento, além das já documentadas no CLAUDE.md.

---

## Convenções base (do PRD + Fase 1)

- Código em inglês; UI em português de Portugal.
- `inject()` em vez de injecção por construtor.
- Signals para estado reactivo; sem `BehaviorSubject`.
- Standalone components; sem `NgModule`.
- `tsc --strict`; zero `any`.
- Vitest para testes de lógica pura (sem DOM, sem HTTP).
- Mocks do `SupabaseClient` em testes que dependem de DB.
- Commits por feature atómica, mensagem em inglês.
- `main` protegida; trabalho em branches por fase.

---

<!-- Adicionar aqui convenções adicionais descobertas durante o desenvolvimento -->
