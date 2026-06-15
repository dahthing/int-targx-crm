import { describe, it, expect } from 'vitest';
import type { QuoteItem, QuotePhase } from '../../models/quote.model';
import {
  calculateItemSubtotal,
  calculateQuoteTotals,
} from '../quote-calculator.functions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makePhase = (overrides: Partial<QuotePhase> = {}): QuotePhase => ({
  id: 'ph1',
  quote_id: 'q1',
  name: 'Fase 1',
  description: null,
  phase_order: 1,
  duration_days: null,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeItem = (overrides: Partial<QuoteItem>): QuoteItem => ({
  id: 'i1',
  phase_id: 'ph1',
  catalog_item_id: null,
  name: 'Item de teste',
  description: null,
  pricing_type: 'hourly',
  hours: 10,
  rate_profile_id: null,
  hourly_rate: 75,
  unit_value: null,
  quantity: 1,
  item_order: 1,
  optional: false,
  optional_accepted: false,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ── TIQS-016 a TIQS-022 ────────────────────────────────────────────────────────

describe('QuoteCalculator', () => {
  // TIQS-016: item hourly: subtotal = hours × hourly_rate × quantity
  describe('TIQS-016: item hourly subtotal = hours × hourly_rate × quantity', () => {
    it('calcula subtotal de item hourly correctamente', () => {
      const item = makeItem({ pricing_type: 'hourly', hours: 10, hourly_rate: 75, quantity: 2 });
      // 10h × 75€ × 2 = 1500
      expect(calculateItemSubtotal(item)).toBe(1500);
    });

    it('subtotal com quantity=1 padrão', () => {
      const item = makeItem({ pricing_type: 'hourly', hours: 8, hourly_rate: 80, quantity: 1 });
      expect(calculateItemSubtotal(item)).toBe(640);
    });
  });

  // TIQS-017: item fixed: subtotal = unit_value × quantity
  describe('TIQS-017: item fixed subtotal = unit_value × quantity', () => {
    it('calcula subtotal de item fixed correctamente', () => {
      const item = makeItem({
        pricing_type: 'fixed',
        hours: null,
        hourly_rate: null,
        unit_value: 500,
        quantity: 3,
      });
      // 500 × 3 = 1500
      expect(calculateItemSubtotal(item)).toBe(1500);
    });

    it('subtotal fixed com quantity=1', () => {
      const item = makeItem({
        pricing_type: 'fixed',
        hours: null,
        hourly_rate: null,
        unit_value: 250,
        quantity: 1,
      });
      expect(calculateItemSubtotal(item)).toBe(250);
    });
  });

  // TIQS-018: desconto aplicado sobre subtotal_with_risk
  describe('TIQS-018: desconto aplicado sobre subtotal_with_risk', () => {
    it('total_before_tax = subtotal_with_risk × (1 - discount_pct/100)', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ pricing_type: 'hourly', hours: 100, hourly_rate: 100, quantity: 1 }),
      ];
      // subtotal_base = 10000; riskMultiplier=1.0 → subtotal_with_risk=10000
      // discount 10% → total_before_tax = 9000
      const totals = calculateQuoteTotals(phases, items, 10, 1.0, 0, 23);
      expect(totals.subtotal_with_risk).toBe(10000);
      expect(totals.discount_amount).toBe(1000);
      expect(totals.total_before_tax).toBe(9000);
    });
  });

  // TIQS-019: IVA 23% aplicado sobre total_before_tax
  describe('TIQS-019: IVA 23% aplicado sobre total_before_tax', () => {
    it('total_with_tax = total_before_tax × 1.23', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ pricing_type: 'fixed', hours: null, hourly_rate: null, unit_value: 1000, quantity: 1 }),
      ];
      const totals = calculateQuoteTotals(phases, items, 0, 1.0, 0, 23);
      expect(totals.total_before_tax).toBe(1000);
      expect(totals.total_with_tax).toBeCloseTo(1230, 2);
    });
  });

  // TIQS-020: total_before_tax não desce abaixo de minimum_project_price
  describe('TIQS-020: total_before_tax não desce abaixo do minimum_project_price', () => {
    it('aplica minimum quando total calculado seria inferior', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ pricing_type: 'fixed', hours: null, hourly_rate: null, unit_value: 100, quantity: 1 }),
      ];
      // subtotal_base=100, após desconto ficaria menor; minimum=500
      const totals = calculateQuoteTotals(phases, items, 50, 1.0, 500, 23);
      expect(totals.total_before_tax).toBe(500);
    });

    it('não afecta quando total calculado está acima do minimum', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ pricing_type: 'fixed', hours: null, hourly_rate: null, unit_value: 2000, quantity: 1 }),
      ];
      const totals = calculateQuoteTotals(phases, items, 0, 1.0, 500, 23);
      expect(totals.total_before_tax).toBe(2000);
    });
  });

  // TIQS-021: item opcional NÃO incluído quando optional=true e optional_accepted=false
  describe('TIQS-021: item opcional NÃO incluído no subtotal quando optional_accepted=false', () => {
    it('item opcional rejeitado não entra no subtotal_base', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ id: 'i1', pricing_type: 'fixed', unit_value: 1000, hours: null, hourly_rate: null, quantity: 1, optional: false, optional_accepted: false }),
        makeItem({ id: 'i2', pricing_type: 'fixed', unit_value: 500, hours: null, hourly_rate: null, quantity: 1, optional: true, optional_accepted: false }),
      ];
      const totals = calculateQuoteTotals(phases, items, 0, 1.0, 0, 23);
      // Só o item obrigatório (1000) entra
      expect(totals.subtotal_base).toBe(1000);
    });
  });

  // TIQS-022: item opcional incluído quando optional_accepted=true
  describe('TIQS-022: item opcional incluído no total quando optional_accepted=true', () => {
    it('item opcional aceite entra no subtotal_base', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ id: 'i1', pricing_type: 'fixed', unit_value: 1000, hours: null, hourly_rate: null, quantity: 1, optional: false, optional_accepted: false }),
        makeItem({ id: 'i2', pricing_type: 'fixed', unit_value: 500, hours: null, hourly_rate: null, quantity: 1, optional: true, optional_accepted: true }),
      ];
      const totals = calculateQuoteTotals(phases, items, 0, 1.0, 0, 23);
      expect(totals.subtotal_base).toBe(1500);
    });
  });

  // Extra: total_hours é soma das horas de itens hourly
  describe('total_hours: soma das horas de todos os itens hourly incluídos', () => {
    it('conta horas de itens hourly não opcionais', () => {
      const phases = [makePhase()];
      const items = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 20, hourly_rate: 75, quantity: 1, optional: false }),
        makeItem({ id: 'i2', pricing_type: 'hourly', hours: 10, hourly_rate: 75, quantity: 1, optional: false }),
      ];
      const totals = calculateQuoteTotals(phases, items, 0, 1.0, 0, 23);
      expect(totals.total_hours).toBe(30);
    });
  });
});
