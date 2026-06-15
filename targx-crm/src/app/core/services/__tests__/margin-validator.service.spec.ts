import { describe, it, expect } from 'vitest';
import type { QuoteItem } from '../../models/quote.model';
import { calculateMargin } from '../margin-validator.functions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeItem = (overrides: Partial<QuoteItem>): QuoteItem => ({
  id: 'i1',
  phase_id: 'ph1',
  catalog_item_id: null,
  name: 'Item',
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

// ── TIQS-023 a TIQS-026 ────────────────────────────────────────────────────────

describe('MarginValidator', () => {
  // TIQS-023: margem calculada com mix de itens (proxy 60% para fixed)
  describe('TIQS-023: margem calculada com mix de itens hourly e fixed', () => {
    it('custo = Σ(hours × hourly_rate) + Σ(unit_value × proxy_pct/100)', () => {
      // item hourly: 10h × 75€ = 750 → custo = 750
      // item fixed: unit_value=500 → custo_interno = 500 × 60% = 300
      // custo_total = 1050
      // total_before_tax = 2000
      // margin = (2000 - 1050) / 2000 × 100 = 47.5%
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 10, hourly_rate: 75, unit_value: null, quantity: 1 }),
        makeItem({ id: 'i2', pricing_type: 'fixed', hours: null, hourly_rate: null, unit_value: 500, quantity: 1 }),
      ];
      const result = calculateMargin(2000, items, 60);
      expect(result.custo_interno).toBeCloseTo(1050, 2);
      expect(result.margin_pct).toBeCloseTo(47.5, 1);
    });

    it('calcula correctamente com quantity > 1', () => {
      // item fixed: unit_value=100, quantity=4 → custo = 400 × 60% = 240
      // total_before_tax = 1000
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'fixed', hours: null, hourly_rate: null, unit_value: 100, quantity: 4 }),
      ];
      const result = calculateMargin(1000, items, 60);
      expect(result.custo_interno).toBeCloseTo(240, 2);
      expect(result.margin_pct).toBeCloseTo(76, 1);
    });
  });

  // TIQS-024: abaixo do mínimo (25%) bloqueia submissão
  describe('TIQS-024: margem abaixo de 25% → is_valid=false', () => {
    it('is_valid=false quando margem calculada é inferior ao mínimo', () => {
      // custo alto → margem baixa
      // hourly: 100h × 100€ = 10000 de custo; total_before_tax = 10500
      // margin = (10500 - 10000) / 10500 × 100 ≈ 4.76% < 25%
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 100, hourly_rate: 100, quantity: 1 }),
      ];
      const result = calculateMargin(10500, items, 60);
      expect(result.is_valid).toBe(false);
      expect(result.margin_pct).toBeLessThan(25);
    });

    it('is_valid=true quando margem calculada está acima do mínimo', () => {
      // hourly: 10h × 50€ = 500 de custo; total_before_tax = 2000
      // margin = (2000 - 500) / 2000 × 100 = 75%
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 10, hourly_rate: 50, quantity: 1 }),
      ];
      const result = calculateMargin(2000, items, 60);
      expect(result.is_valid).toBe(true);
      expect(result.margin_pct).toBeGreaterThanOrEqual(25);
    });

    it('minimum_margin_pct retornado é 25', () => {
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 10, hourly_rate: 75, quantity: 1 }),
      ];
      const result = calculateMargin(1000, items, 60);
      expect(result.minimum_margin_pct).toBe(25);
    });
  });

  // TIQS-025: margem calculada depois de risco e desconto (usa total_before_tax final)
  describe('TIQS-025: margem usa total_before_tax (já com risco e desconto aplicados)', () => {
    it('margem é calculada sobre o total_before_tax final, não o subtotal_base', () => {
      // total_before_tax = 8000 (após desconto e risco)
      // custo: 10h × 50€ = 500
      // margin = (8000 - 500) / 8000 × 100 = 93.75%
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 10, hourly_rate: 50, quantity: 1 }),
      ];
      const result = calculateMargin(8000, items, 60);
      expect(result.margin_pct).toBeCloseTo(93.75, 1);
    });
  });

  // TIQS-026: admin pode fazer override com justificação
  describe('TIQS-026: calculateMargin retorna resultado independente do override', () => {
    it('calculateMargin devolve sempre o resultado — override é responsabilidade do caller', () => {
      // O override não afecta o cálculo de margem — apenas permite prosseguir mesmo com is_valid=false
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 100, hourly_rate: 100, quantity: 1 }),
      ];
      const result = calculateMargin(10500, items, 60);
      // A função retorna sempre os dados calculados
      expect(result).toHaveProperty('custo_interno');
      expect(result).toHaveProperty('margin_value');
      expect(result).toHaveProperty('margin_pct');
      expect(result).toHaveProperty('is_valid');
      expect(result).toHaveProperty('minimum_margin_pct');
      // is_valid pode ser false sem lançar erro — o override é feito externamente
      expect(result.is_valid).toBe(false);
    });

    it('margin_value = total_before_tax - custo_interno', () => {
      const items: QuoteItem[] = [
        makeItem({ id: 'i1', pricing_type: 'hourly', hours: 10, hourly_rate: 75, quantity: 1 }),
      ];
      // custo = 10 × 75 = 750; total_before_tax = 2000; margin_value = 1250
      const result = calculateMargin(2000, items, 60);
      expect(result.margin_value).toBeCloseTo(1250, 2);
    });
  });
});
