# TargX CRM — Design System

**Versão:** 1.0  
**Data:** Junho 2026  
**Stack:** PrimeNG 17 + Tema Aura + Tailwind CSS 3 + Angular 21  
**Aplicação:** crm.targx.com

Este documento é a referência visual única para o Claude Code e qualquer outro agente ou developer que trabalhe no TargX CRM. Todas as decisões de cor, tipografia, espaçamento e componentes são derivadas daqui. Nada é inventado durante o desenvolvimento.

---

## 1. Identidade visual

O TargX CRM é uma ferramenta de trabalho profissional usada por pessoas que tomam decisões comerciais com consequências financeiras reais. O design reflecte isso: limpo, preciso, denso onde tem de ser, sem decoração desnecessária.

A paleta é derivada da identidade TargX: azul escuro como base, teal como acento de acção, branco para superfícies, com uma camada de cinzentos frios para hierarquia. O resultado é um produto que parece interno e próprio, não um template SaaS genérico.

**Elemento de assinatura:** os indicadores de progresso de comissão e patamar usam uma barra gradiente de teal para azul escuro com o valor numérico sobrepostos em tipografia tabular. É o momento mais característico da aplicação e o que o Urbano vai ver todos os dias.

---

## 2. Paleta de cores

### 2.1 Cores primitivas (tokens base)

```css
/* Azuis TargX */
--tx-blue-950: #0A1628;   /* fundo sidebar, elementos de máximo contraste */
--tx-blue-900: #0F2044;   /* superfície escura secundária */
--tx-blue-800: #1A3260;   /* bordas em contexto escuro, estados hover escuros */
--tx-blue-700: #1E4080;   /* menos usado — transição */
--tx-blue-600: #2451A3;   /* links, acções secundárias */
--tx-blue-500: #3B6FD4;   /* acento interactivo em fundo escuro */
--tx-blue-100: #D6E4FF;   /* background informativo claro */
--tx-blue-050: #EEF4FF;   /* background de linha alternada, chips */

/* Teal TargX (acento de acção) */
--tx-teal-600: #00917A;   /* hover do CTA principal */
--tx-teal-500: #00B899;   /* CTA principal, badges activos, progresso */
--tx-teal-400: #33C9AE;   /* ícones em fundo escuro */
--tx-teal-100: #CCEDE9;   /* background de badge sucesso */
--tx-teal-050: #E8F8F6;   /* background de linha de sucesso */

/* Neutros */
--tx-gray-950: #0D0F12;   /* texto de máximo contraste */
--tx-gray-800: #1F2533;   /* texto primário */
--tx-gray-600: #4B5563;   /* texto secundário */
--tx-gray-400: #9CA3AF;   /* placeholder, texto desactivado */
--tx-gray-200: #E5E7EB;   /* bordas subtis */
--tx-gray-100: #F3F4F6;   /* background de hover, linha zebra */
--tx-gray-050: #F9FAFB;   /* background de página */
--tx-white:    #FFFFFF;   /* superfície de cards e painéis */

/* Semânticos */
--tx-success:  #059669;   /* verde — pago, recebido, fechado ganho */
--tx-warning:  #D97706;   /* âmbar — pendente, atenção, prazo próximo */
--tx-danger:   #DC2626;   /* vermelho — erro, bloqueado, perdido */
--tx-info:     #2563EB;   /* azul — informativo, nota */

/* Ouro — bónus e milestones */
--tx-gold:     #F59E0B;
--tx-gold-bg:  #FEF3C7;
```

### 2.2 Tokens semânticos (usar estes no código, não os primitivos directamente)

```css
/* Backgrounds */
--bg-page:        var(--tx-gray-050);
--bg-surface:     var(--tx-white);
--bg-surface-2:   var(--tx-gray-100);
--bg-sidebar:     var(--tx-blue-950);
--bg-sidebar-item-hover: var(--tx-blue-800);
--bg-sidebar-item-active: var(--tx-blue-700);

/* Texto */
--text-primary:   var(--tx-gray-800);
--text-secondary: var(--tx-gray-600);
--text-muted:     var(--tx-gray-400);
--text-on-dark:   var(--tx-white);
--text-on-dark-muted: rgba(255,255,255,0.6);

/* Bordas */
--border-subtle:  var(--tx-gray-200);
--border-default: var(--tx-gray-200);
--border-strong:  var(--tx-gray-400);

/* Acções */
--action-primary:       var(--tx-teal-500);
--action-primary-hover: var(--tx-teal-600);
--action-secondary:     var(--tx-blue-600);
```

---

## 3. Tipografia

### 3.1 Famílias

```
Display / Headings:  Inter (weight 600–700, letter-spacing -0.02em)
Body / UI:           Inter (weight 400–500)
Dados / Tabular:     Inter com font-variant-numeric: tabular-nums
Código / Mono:       JetBrains Mono (apenas para valores técnicos, IDs)
```

Inter é a escolha certa para um CRM: legibilidade máxima em tamanhos pequenos, números tabulares nativos, sem personalidade excessiva que distraia do conteúdo. A distinção entre display e body é feita por peso e tamanho, não por família diferente.

### 3.2 Escala tipográfica

```css
/* Headings */
--text-h1: 1.875rem / 2.25rem  weight: 700  tracking: -0.02em   /* título de página */
--text-h2: 1.5rem   / 1.875rem weight: 600  tracking: -0.015em  /* secção principal */
--text-h3: 1.25rem  / 1.5rem   weight: 600  tracking: -0.01em   /* subsecção */
--text-h4: 1rem     / 1.5rem   weight: 600  tracking: 0         /* card title */

/* Body */
--text-body-lg: 1rem     / 1.75rem weight: 400   /* texto principal */
--text-body:    0.875rem / 1.5rem  weight: 400   /* texto de UI padrão */
--text-body-sm: 0.8125rem/ 1.25rem weight: 400   /* texto secundário, labels */

/* UI específico */
--text-label:   0.75rem  / 1rem    weight: 500  tracking: 0.05em  uppercase: true
--text-badge:   0.6875rem/ 1rem    weight: 600
--text-kpi:     2rem     / 1       weight: 700  tracking: -0.03em  tabular: true
--text-kpi-lg:  3rem     / 1       weight: 700  tracking: -0.04em  tabular: true
--text-mono:    0.8125rem/ 1.5rem  JetBrains Mono
```

---

## 4. Espaçamento e layout

### 4.1 Grid base

```
Escala: 4px (0.25rem)
Sidebar: 256px (fixa, collapsível para 64px em mobile)
Content area: fluid, max-width 1440px
Padding de página: 24px (desktop), 16px (mobile)
Gap entre cards: 16px
Gap entre secções: 32px
```

### 4.2 Bordas e sombras

```css
--radius-sm:  4px
--radius-md:  8px
--radius-lg:  12px
--radius-xl:  16px
--radius-full: 9999px   /* badges, avatares */

--shadow-sm:  0 1px 2px rgba(0,0,0,0.05)
--shadow-md:  0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04)
--shadow-lg:  0 10px 15px -3px rgba(0,0,0,0.08), 0 4px 6px -2px rgba(0,0,0,0.04)
--shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)
```

---

## 5. Configuração PrimeNG + Tailwind

### 5.1 `tailwind.config.js`

```javascript
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        'tx-blue': {
          950: '#0A1628', 900: '#0F2044', 800: '#1A3260',
          700: '#1E4080', 600: '#2451A3', 500: '#3B6FD4',
          100: '#D6E4FF', 50:  '#EEF4FF',
        },
        'tx-teal': {
          600: '#00917A', 500: '#00B899', 400: '#33C9AE',
          100: '#CCEDE9', 50:  '#E8F8F6',
        },
        'tx-gold': { DEFAULT: '#F59E0B', bg: '#FEF3C7' },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'kpi':    ['2rem',   { lineHeight: '1',      fontWeight: '700', letterSpacing: '-0.03em' }],
        'kpi-lg': ['3rem',   { lineHeight: '1',      fontWeight: '700', letterSpacing: '-0.04em' }],
        'label':  ['0.75rem',{ lineHeight: '1rem',   fontWeight: '500', letterSpacing: '0.05em' }],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [require('@tailwindcss/forms')],
};
```

### 5.2 Tema PrimeNG Aura customizado

Criar `src/styles/primeng-theme.ts`:

```typescript
import { definePreset } from '@primeng/themes';
import Aura from '@primeng/themes/aura';

export const TargXTheme = definePreset(Aura, {
  semantic: {
    primary: {
      50:  '#E8F8F6',
      100: '#CCEDE9',
      200: '#99DBD3',
      300: '#66C9BD',
      400: '#33C9AE',
      500: '#00B899',    // tx-teal-500 — cor primária
      600: '#00917A',
      700: '#006B5C',
      800: '#00483E',
      900: '#002420',
      950: '#00120F',
    },
    colorScheme: {
      light: {
        surface: {
          0:   '#FFFFFF',
          50:  '#F9FAFB',
          100: '#F3F4F6',
          200: '#E5E7EB',
          300: '#D1D5DB',
          400: '#9CA3AF',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2533',
          900: '#111827',
          950: '#0D0F12',
        },
      },
    },
  },
  components: {
    button: {
      borderRadius: '8px',
      paddingX: '16px',
      paddingY: '8px',
      fontWeight: '500',
    },
    card: {
      borderRadius: '12px',
      shadow: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
    },
    inputtext: {
      borderRadius: '8px',
    },
    datatable: {
      headerBg: '#F9FAFB',
      headerBorderColor: '#E5E7EB',
      rowBorderColor: '#F3F4F6',
    },
  },
});
```

Registar em `app.config.ts`:

```typescript
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { providePrimeNG } from 'primeng/config';
import { TargXTheme } from './styles/primeng-theme';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAnimationsAsync(),
    providePrimeNG({
      theme: { preset: TargXTheme, options: { darkModeSelector: '.dark' } },
    }),
  ],
};
```

---

## 6. Layout da aplicação

### 6.1 Estrutura geral

```
┌─────────────────────────────────────────────────────┐
│  SIDEBAR (256px, bg: tx-blue-950)                   │
│  ┌──────────────────┐  ┌──────────────────────────┐ │
│  │ Logo TargX       │  │ TOPBAR (64px, bg: white)  │ │
│  │                  │  │ breadcrumb | search | user │ │
│  │ Nav items        │  ├──────────────────────────┤ │
│  │ • Dashboard      │  │                          │ │
│  │ • Clientes       │  │  PAGE CONTENT            │ │
│  │ • Leads          │  │  padding: 24px           │ │
│  │ • Orçamentos     │  │  bg: tx-gray-050         │ │
│  │ • Projectos      │  │                          │ │
│  │ • Comissões      │  │                          │ │
│  │ • Conhecimento   │  │                          │ │
│  │                  │  │                          │ │
│  │ ─────────────── │  │                          │ │
│  │ Settings         │  │                          │ │
│  │ ─────────────── │  │                          │ │
│  │ [Avatar] Urbano  │  │                          │ │
│  └──────────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────┘
```

### 6.2 Sidebar

```css
/* Sidebar container */
background: var(--tx-blue-950);
width: 256px;
padding: 0;
border-right: 1px solid rgba(255,255,255,0.06);

/* Logo area */
height: 64px;
padding: 0 20px;
border-bottom: 1px solid rgba(255,255,255,0.08);

/* Nav item */
height: 40px;
padding: 0 12px;
border-radius: 8px;
margin: 2px 8px;
color: rgba(255,255,255,0.65);
font-size: 0.875rem;
font-weight: 500;

/* Nav item: hover */
background: rgba(255,255,255,0.06);
color: rgba(255,255,255,0.9);

/* Nav item: active */
background: var(--tx-teal-500);
color: white;

/* Nav section label */
font-size: 0.6875rem;
font-weight: 600;
letter-spacing: 0.08em;
text-transform: uppercase;
color: rgba(255,255,255,0.35);
padding: 16px 20px 4px;
```

### 6.3 Topbar

```css
background: white;
height: 64px;
border-bottom: 1px solid var(--tx-gray-200);
padding: 0 24px;
display: flex;
align-items: center;
gap: 16px;
```

---

## 7. Componentes

### 7.1 Cards

```html
<!-- Card padrão -->
<p-card styleClass="tx-card">
  ...
</p-card>
```

```css
.tx-card {
  background: white;
  border-radius: 12px;
  border: 1px solid var(--tx-gray-200);
  box-shadow: var(--shadow-card);
  padding: 20px;
}

.tx-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--tx-gray-100);
}
```

### 7.2 KPI Cards (dashboard do parceiro)

```html
<div class="tx-kpi-card">
  <span class="tx-kpi-label">Volume do ano</span>
  <span class="tx-kpi-value">47.500 €</span>
  <span class="tx-kpi-sub">+12.300 € este mês</span>
</div>
```

```css
.tx-kpi-card {
  background: white;
  border-radius: 12px;
  border: 1px solid var(--tx-gray-200);
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.tx-kpi-label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--tx-gray-600);
}

.tx-kpi-value {
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
  color: var(--tx-gray-800);
  line-height: 1;
  margin: 4px 0;
}

.tx-kpi-sub {
  font-size: 0.8125rem;
  color: var(--tx-gray-400);
}

/* Variante: destaque teal */
.tx-kpi-card.accent {
  border-color: var(--tx-teal-100);
  background: var(--tx-teal-050);
}
.tx-kpi-card.accent .tx-kpi-value {
  color: var(--tx-teal-600);
}

/* Variante: bónus/gold */
.tx-kpi-card.gold {
  border-color: var(--tx-gold-bg);
  background: #FFFBEB;
}
.tx-kpi-card.gold .tx-kpi-value {
  color: var(--tx-gold);
}
```

### 7.3 Barra de progresso de patamar (elemento de assinatura)

Este é o componente mais característico da aplicação. Aparece no dashboard do parceiro e mostra o progresso até ao próximo escalão de comissão.

```html
<!-- tx-tier-progress.component.html -->
<div class="tier-progress-wrap">
  <div class="tier-header">
    <div>
      <span class="tier-label">Escalão actual</span>
      <span class="tier-rate">{{ currentRate }}%</span>
    </div>
    <div class="tier-next" *ngIf="nextTier">
      <span>Próximo: {{ nextTier.rate }}%</span>
      <span class="tier-remaining">faltam {{ remaining | currency:'EUR' }}</span>
    </div>
  </div>

  <div class="tier-bar-track">
    <div
      class="tier-bar-fill"
      [style.width.%]="progressPct"
      [class.near-threshold]="progressPct > 80">
    </div>
    <span class="tier-bar-label">{{ progressPct | number:'1.0-0' }}%</span>
  </div>

  <div class="tier-scale">
    <span>{{ currentTier.volumeFrom | currency:'EUR':'symbol':'1.0-0' }}</span>
    <span>{{ currentTier.volumeTo | currency:'EUR':'symbol':'1.0-0' }}</span>
  </div>
</div>
```

```css
.tier-progress-wrap {
  padding: 20px 24px;
  background: white;
  border-radius: 12px;
  border: 1px solid var(--tx-gray-200);
}

.tier-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.tier-label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--tx-gray-400);
  display: block;
}

.tier-rate {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--tx-teal-500);
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  display: block;
}

.tier-remaining {
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--tx-gray-600);
}

.tier-bar-track {
  position: relative;
  height: 10px;
  background: var(--tx-gray-100);
  border-radius: 9999px;
  overflow: hidden;
}

.tier-bar-fill {
  height: 100%;
  border-radius: 9999px;
  background: linear-gradient(90deg, var(--tx-blue-500) 0%, var(--tx-teal-500) 100%);
  transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.tier-bar-fill.near-threshold {
  background: linear-gradient(90deg, var(--tx-teal-600) 0%, var(--tx-gold) 100%);
}

.tier-bar-label {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 0.6875rem;
  font-weight: 700;
  color: var(--tx-gray-600);
  font-variant-numeric: tabular-nums;
}

.tier-scale {
  display: flex;
  justify-content: space-between;
  margin-top: 6px;
  font-size: 0.75rem;
  color: var(--tx-gray-400);
  font-variant-numeric: tabular-nums;
}
```

### 7.4 Badges de estado

```typescript
// status-badge.component.ts
export type LeadStatus = 'nova' | 'contactada' | 'proposta_enviada' |
                         'negociacao' | 'fechada_ganha' | 'fechada_perdida';

export type QuoteStatus = 'rascunho' | 'em_revisao' | 'aprovado_interno' |
                          'enviado_cliente' | 'aceite' | 'rejeitado';
```

```css
.tx-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 600;
  line-height: 1.5;
  white-space: nowrap;
}

/* Lead status */
.tx-badge.nova              { background: var(--tx-gray-100);   color: var(--tx-gray-600); }
.tx-badge.contactada        { background: var(--tx-blue-50);    color: var(--tx-blue-600); }
.tx-badge.proposta_enviada  { background: #EEF2FF;              color: #4338CA; }
.tx-badge.negociacao        { background: var(--tx-gold-bg);    color: #92400E; }
.tx-badge.fechada_ganha     { background: #DCFCE7;              color: #15803D; }
.tx-badge.fechada_perdida   { background: #FEE2E2;              color: #B91C1C; }

/* Quote status */
.tx-badge.rascunho          { background: var(--tx-gray-100);   color: var(--tx-gray-600); }
.tx-badge.em_revisao        { background: var(--tx-gold-bg);    color: #92400E; }
.tx-badge.aprovado_interno  { background: var(--tx-teal-100);   color: var(--tx-teal-600); }
.tx-badge.enviado_cliente   { background: var(--tx-blue-100);   color: var(--tx-blue-600); }
.tx-badge.aceite            { background: #DCFCE7;              color: #15803D; }
.tx-badge.rejeitado         { background: #FEE2E2;              color: #B91C1C; }

/* Project / tranche */
.tx-badge.recebido          { background: #DCFCE7;              color: #15803D; }
.tx-badge.pendente          { background: var(--tx-gray-100);   color: var(--tx-gray-600); }
.tx-badge.em_curso          { background: var(--tx-teal-050);   color: var(--tx-teal-600); }
.tx-badge.concluido         { background: #DCFCE7;              color: #15803D; }
.tx-badge.cancelado         { background: #FEE2E2;              color: #B91C1C; }
```

### 7.5 Botões

```css
/* Primário — acção principal da página */
.tx-btn-primary {
  background: var(--tx-teal-500);
  color: white;
  border: none;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
  cursor: pointer;
  transition: background 0.15s;
}
.tx-btn-primary:hover { background: var(--tx-teal-600); }

/* Secundário — acção secundária */
.tx-btn-secondary {
  background: white;
  color: var(--tx-gray-700);
  border: 1px solid var(--tx-gray-200);
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
}
.tx-btn-secondary:hover { background: var(--tx-gray-050); }

/* Danger — acções destrutivas */
.tx-btn-danger {
  background: #FEE2E2;
  color: #B91C1C;
  border: 1px solid #FECACA;
  border-radius: 8px;
  padding: 8px 16px;
  font-size: 0.875rem;
  font-weight: 500;
}
.tx-btn-danger:hover { background: #FECACA; }

/* Ghost — acções terciárias, tabelas */
.tx-btn-ghost {
  background: transparent;
  color: var(--tx-gray-600);
  border: none;
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 0.875rem;
}
.tx-btn-ghost:hover { background: var(--tx-gray-100); }
```

### 7.6 Tabelas (PrimeNG DataTable)

```css
/* Override PrimeNG DataTable para estilo TargX */
.tx-table .p-datatable-header {
  background: white;
  border-bottom: 1px solid var(--tx-gray-200);
  padding: 12px 16px;
}

.tx-table .p-datatable-thead > tr > th {
  background: var(--tx-gray-050);
  color: var(--tx-gray-600);
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  padding: 10px 16px;
  border-bottom: 1px solid var(--tx-gray-200);
}

.tx-table .p-datatable-tbody > tr > td {
  padding: 12px 16px;
  font-size: 0.875rem;
  color: var(--tx-gray-800);
  border-bottom: 1px solid var(--tx-gray-100);
  vertical-align: middle;
}

.tx-table .p-datatable-tbody > tr:hover > td {
  background: var(--tx-gray-050);
}

/* Valores monetários em tabela — sempre alinhados à direita e tabulares */
.tx-table td.col-amount {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 500;
}

/* Coluna de acções */
.tx-table td.col-actions {
  text-align: right;
  white-space: nowrap;
}
```

### 7.7 Formulários

```css
/* Label */
.tx-form-label {
  display: block;
  font-size: 0.8125rem;
  font-weight: 500;
  color: var(--tx-gray-700);
  margin-bottom: 4px;
}

/* Campo de texto */
.tx-input {
  width: 100%;
  border: 1px solid var(--tx-gray-200);
  border-radius: 8px;
  padding: 8px 12px;
  font-size: 0.875rem;
  color: var(--tx-gray-800);
  background: white;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.tx-input:focus {
  outline: none;
  border-color: var(--tx-teal-500);
  box-shadow: 0 0 0 3px rgba(0, 184, 153, 0.12);
}
.tx-input.error {
  border-color: var(--tx-danger);
}

/* Mensagem de erro */
.tx-field-error {
  font-size: 0.75rem;
  color: var(--tx-danger);
  margin-top: 4px;
}

/* Hint */
.tx-field-hint {
  font-size: 0.75rem;
  color: var(--tx-gray-400);
  margin-top: 4px;
}
```

### 7.8 Indicador de margem (TIQS builder)

```css
.margin-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 500;
}

.margin-indicator.ok {
  background: #DCFCE7;
  color: #15803D;
}

.margin-indicator.warning {
  background: var(--tx-gold-bg);
  color: #92400E;
}

.margin-indicator.danger {
  background: #FEE2E2;
  color: #B91C1C;
}

.margin-indicator .margin-value {
  font-size: 1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
```

### 7.9 Alerta de silêncio de lead

```css
.tx-silence-warning {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 0.8125rem;
}

.tx-silence-warning.level-1 {   /* 7 dias */
  background: var(--tx-gold-bg);
  color: #92400E;
  border-left: 3px solid var(--tx-gold);
}

.tx-silence-warning.level-2 {   /* 14 dias */
  background: #FEE2E2;
  color: #B91C1C;
  border-left: 3px solid var(--tx-danger);
}
```

---

## 8. Padrões de UI por módulo

### 8.1 Dashboard do parceiro

Layout em grid de 4 colunas para KPIs, seguido de barra de progresso de patamar em largura total, depois grid de 2 colunas para pipeline e bónus.

```
┌─────────┬─────────┬─────────┬─────────┐
│ Volume  │ Comissão│ Leads   │ Meta Q  │
│ do ano  │ do ano  │ abertas │ Atual   │
└─────────┴─────────┴─────────┴─────────┘
┌─────────────────────────────────────────┐
│ Progresso de patamar (barra gradiente)  │
└─────────────────────────────────────────┘
┌───────────────────┬─────────────────────┐
│ Pipeline          │ Bónus               │
│ (leads por estado │ (limiares e estado) │
│ com valores)      │                     │
└───────────────────┴─────────────────────┘
```

### 8.2 Lista de leads (kanban)

5 colunas em scroll horizontal, uma por estado não terminal. Cards com: cliente, valor estimado, data de próxima acção, badge de silêncio se aplicável.

### 8.3 Builder de orçamento

Sidebar direita com totais fixos (subtotal, risco, desconto, total, margem) enquanto o utilizador edita as fases. Risk panel como drawer que abre sobre o conteúdo.

### 8.4 Portal do cliente

Página sem sidebar. Logo TargX no topo. Layout de duas colunas: proposta à esquerda, acções e Gantt à direita. Fundo branco, sem acesso à navegação interna.

---

## 9. Ícones

Usar **PrimeIcons** (incluído com PrimeNG) para ícones de UI padrão e **Heroicons** (outline) via SVG inline para ícones de navegação e acções onde o PrimeIcons não tem o adequado.

Tamanhos padrão:
- Ícones de navegação sidebar: 18px
- Ícones de botão: 16px
- Ícones de badge/inline: 12px
- Ícones de KPI card: 20px (cor: tx-teal-500 ou tx-gray-400)

---

## 10. Animações e transições

```css
/* Transições padrão */
--transition-fast:   0.1s ease;
--transition-base:   0.15s ease;
--transition-slow:   0.3s ease;
--transition-spring: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);  /* usado na barra de progresso */

/* Respeitar prefers-reduced-motion */
@media (prefers-reduced-motion: reduce) {
  *, ::before, ::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Usar `@defer` em Angular 21 para o componente Gantt e gráficos — carregam apenas quando entram no viewport.

---

## 11. Acessibilidade

- Contraste mínimo WCAG AA em todos os textos (verificar com ferramenta ao implementar).
- Focus ring visível em todos os elementos interactivos: `outline: 2px solid var(--tx-teal-500); outline-offset: 2px`.
- Todos os ícones com `aria-label` ou `aria-hidden="true"` se decorativos.
- Formulários com `for` / `id` correctos entre label e input.
- Tabelas com `scope` em headers.

---

## 12. Variáveis CSS globais (src/styles/tokens.css)

```css
:root {
  /* Primitivas */
  --tx-blue-950: #0A1628;
  --tx-blue-900: #0F2044;
  --tx-blue-800: #1A3260;
  --tx-blue-700: #1E4080;
  --tx-blue-600: #2451A3;
  --tx-blue-500: #3B6FD4;
  --tx-blue-100: #D6E4FF;
  --tx-blue-050: #EEF4FF;
  --tx-teal-600: #00917A;
  --tx-teal-500: #00B899;
  --tx-teal-400: #33C9AE;
  --tx-teal-100: #CCEDE9;
  --tx-teal-050: #E8F8F6;
  --tx-gray-950: #0D0F12;
  --tx-gray-800: #1F2533;
  --tx-gray-600: #4B5563;
  --tx-gray-400: #9CA3AF;
  --tx-gray-200: #E5E7EB;
  --tx-gray-100: #F3F4F6;
  --tx-gray-050: #F9FAFB;
  --tx-white:    #FFFFFF;
  --tx-success:  #059669;
  --tx-warning:  #D97706;
  --tx-danger:   #DC2626;
  --tx-info:     #2563EB;
  --tx-gold:     #F59E0B;
  --tx-gold-bg:  #FEF3C7;

  /* Semânticos */
  --bg-page:     var(--tx-gray-050);
  --bg-surface:  var(--tx-white);
  --bg-sidebar:  var(--tx-blue-950);
  --text-primary:   var(--tx-gray-800);
  --text-secondary: var(--tx-gray-600);
  --text-muted:     var(--tx-gray-400);
  --border-subtle:  var(--tx-gray-200);
  --action-primary: var(--tx-teal-500);
  --action-primary-hover: var(--tx-teal-600);

  /* Espaçamento */
  --radius-sm: 4px;
  --radius-md: 8px;
  --radius-lg: 12px;
  --radius-xl: 16px;
  --radius-full: 9999px;
  --shadow-card: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
  --shadow-md:   0 4px 6px -1px rgba(0,0,0,0.07), 0 2px 4px -1px rgba(0,0,0,0.04);

  /* Transições */
  --transition-base:   0.15s ease;
  --transition-spring: 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
```

---

*TargX CRM Design System v1.0 — documento interno — Junho 2026*
