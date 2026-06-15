import { describe, it, expect } from 'vitest';
import type { Quote, QuotePhase, QuoteItem, QuoteTemplate } from '../../models/quote.model';
import {
  buildTemplateFromQuote,
  loadTemplatePhases,
  checkTemplateCompatibility,
} from '../quote-template.functions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeQuote = (overrides: Partial<Quote> = {}): Quote => ({
  id: 'q1',
  lead_id: null,
  client_id: 'c1',
  partner_id: 'p1',
  project_type_id: 'pt_ecommerce',
  template_id: null,
  title: 'Projecto E-Commerce',
  description: null,
  status: 'rascunho',
  version: 1,
  parent_quote_id: null,
  scoping_answers: null,
  scoping_completed: false,
  detected_risks: null,
  risk_multiplier_total: 1.0,
  has_blocking_risk: false,
  admin_risk_override: false,
  admin_risk_notes: null,
  subtotal_base: null,
  risk_adjustment: null,
  subtotal_with_risk: null,
  discount_pct: 0,
  discount_reason: null,
  discount_amount: null,
  total_before_tax: null,
  total_with_tax: null,
  minimum_margin_pct: null,
  calculated_margin_pct: null,
  payment_terms: null,
  valid_until: null,
  internal_notes: null,
  rejection_reason: null,
  client_accept_token: null,
  token_expires_at: null,
  pdf_url: null,
  portal_opened_at: null,
  portal_open_count: 0,
  gantt_start_date: null,
  gantt_data: null,
  sent_at: null,
  accepted_at: null,
  rejected_at: null,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makePhase = (overrides: Partial<QuotePhase>): QuotePhase => ({
  id: 'ph1',
  quote_id: 'q1',
  name: 'Fase 1 — Setup',
  description: null,
  phase_order: 1,
  duration_days: 5,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeItem = (overrides: Partial<QuoteItem>): QuoteItem => ({
  id: 'i1',
  phase_id: 'ph1',
  catalog_item_id: null,
  name: 'SSL Certificate',
  description: null,
  pricing_type: 'fixed',
  hours: null,
  rate_profile_id: null,
  hourly_rate: null,
  unit_value: 150,
  quantity: 1,
  item_order: 1,
  optional: false,
  optional_accepted: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeTemplate = (overrides: Partial<QuoteTemplate>): QuoteTemplate => ({
  id: 'tpl1',
  name: 'Template E-Commerce',
  description: null,
  project_type_id: 'pt_ecommerce',
  phases_data: {},
  usage_count: 3,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ── TIQS-054 a TIQS-056 ────────────────────────────────────────────────────────

describe('QuoteTemplate', () => {
  // TIQS-054: criar template a partir de orçamento copia fases e itens correctamente
  describe('TIQS-054: buildTemplateFromQuote copia fases e itens correctamente', () => {
    it('resultado contém phases_data com estrutura de fases e itens', () => {
      const quote = makeQuote();
      const phases: QuotePhase[] = [
        makePhase({ id: 'ph1', name: 'Fase 1 — Setup', phase_order: 1 }),
        makePhase({ id: 'ph2', name: 'Fase 2 — Desenvolvimento', phase_order: 2 }),
      ];
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', phase_id: 'ph1', name: 'SSL Certificate', item_order: 1 }),
        makeItem({ id: 'i2', phase_id: 'ph2', name: 'Página Home', item_order: 1, pricing_type: 'hourly', hours: 16, hourly_rate: 75, unit_value: null }),
      ];
      const template = buildTemplateFromQuote(quote, phases, items);
      expect(template).toHaveProperty('phases_data');
      expect(template.phases_data).toBeTruthy();
    });

    it('copia o número correcto de fases para o template', () => {
      const quote = makeQuote();
      const phases: QuotePhase[] = [
        makePhase({ id: 'ph1', phase_order: 1 }),
        makePhase({ id: 'ph2', name: 'Fase 2', phase_order: 2 }),
      ];
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', phase_id: 'ph1' }),
      ];
      const template = buildTemplateFromQuote(quote, phases, items);
      // phases_data deve conter representação das fases
      const data = template.phases_data as { phases?: unknown[] };
      expect(Array.isArray(data.phases)).toBe(true);
      expect((data.phases as unknown[]).length).toBe(2);
    });

    it('cada fase no template inclui os seus itens', () => {
      const quote = makeQuote();
      const phases: QuotePhase[] = [makePhase({ id: 'ph1' })];
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', phase_id: 'ph1', name: 'Item A' }),
        makeItem({ id: 'i2', phase_id: 'ph1', name: 'Item B', item_order: 2 }),
      ];
      const template = buildTemplateFromQuote(quote, phases, items);
      const data = template.phases_data as { phases?: Array<{ items?: unknown[] }> };
      const firstPhase = data.phases?.[0];
      expect(Array.isArray(firstPhase?.items)).toBe(true);
      expect((firstPhase?.items as unknown[]).length).toBe(2);
    });
  });

  // TIQS-055: carregar template pré-preenche builder
  describe('TIQS-055: loadTemplatePhases retorna fases e itens para pré-preenchimento', () => {
    it('retorna array de fases com os itens', () => {
      const phasesData = {
        phases: [
          {
            name: 'Fase 1 — Setup',
            phase_order: 1,
            duration_days: 5,
            items: [
              { name: 'SSL Certificate', pricing_type: 'fixed', unit_value: 150, quantity: 1, optional: false },
            ],
          },
        ],
      };
      const template = makeTemplate({ phases_data: phasesData });
      const phases = loadTemplatePhases(template);
      expect(phases).toHaveLength(1);
      expect(phases[0].name).toBe('Fase 1 — Setup');
    });

    it('cada fase carregada contém os seus itens', () => {
      const phasesData = {
        phases: [
          {
            name: 'Fase 1',
            phase_order: 1,
            duration_days: null,
            items: [
              { name: 'Item A', pricing_type: 'hourly', hours: 8, hourly_rate: 75, quantity: 1, optional: false },
              { name: 'Item B', pricing_type: 'fixed', unit_value: 200, quantity: 1, optional: true },
            ],
          },
        ],
      };
      const template = makeTemplate({ phases_data: phasesData });
      const phases = loadTemplatePhases(template);
      expect(phases[0].items).toHaveLength(2);
    });

    it('retorna array vazio quando phases_data não tem fases', () => {
      const template = makeTemplate({ phases_data: { phases: [] } });
      const phases = loadTemplatePhases(template);
      expect(phases).toHaveLength(0);
    });
  });

  // TIQS-056: template com project_type incompatível emite aviso (não lança erro)
  describe('TIQS-056: template incompatível emite aviso sem lançar erro', () => {
    it('retorna compatible=false com warning quando project_type não coincide', () => {
      const template = makeTemplate({ project_type_id: 'pt_ecommerce' });
      const result = checkTemplateCompatibility(template, 'pt_website_institucional');
      expect(result.compatible).toBe(false);
      expect(result.warning).toBeTruthy();
      expect(typeof result.warning).toBe('string');
    });

    it('NÃO lança erro quando incompatível — apenas aviso', () => {
      const template = makeTemplate({ project_type_id: 'pt_ecommerce' });
      expect(() => checkTemplateCompatibility(template, 'pt_outro')).not.toThrow();
    });

    it('retorna compatible=true quando project_type coincide', () => {
      const template = makeTemplate({ project_type_id: 'pt_ecommerce' });
      const result = checkTemplateCompatibility(template, 'pt_ecommerce');
      expect(result.compatible).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    it('retorna compatible=true quando template não tem project_type (genérico)', () => {
      const template = makeTemplate({ project_type_id: null });
      const result = checkTemplateCompatibility(template, 'pt_ecommerce');
      expect(result.compatible).toBe(true);
    });
  });
});
