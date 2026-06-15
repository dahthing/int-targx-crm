import { describe, it, expect } from 'vitest';
import type { ScopingQuestion, RiskMultiplier } from '../../models/quote.model';
import {
  detectRisks,
  calculateTotalMultiplier,
  hasBlockingRisk,
  validateRiskOverride,
} from '../risk-engine.functions';

// ── Types ──────────────────────────────────────────────────────────────────────

type ScopingAnswers = Record<string, unknown>;

interface DetectedRisk {
  key: string;
  multiplier: number;
  is_blocking: boolean;
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeQuestion = (overrides: Partial<ScopingQuestion>): ScopingQuestion => ({
  id: 'q1',
  project_type_id: 'pt1',
  key: 'integrations_count',
  label: 'Quantas integrações?',
  description: null,
  question_type: 'numeric',
  options: null,
  impacts_price: true,
  activates_modules: null,
  triggers_risk: null,
  sort_order: 1,
  required: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeRiskMultiplier = (overrides: Partial<RiskMultiplier>): RiskMultiplier => ({
  id: 'rm1',
  key: 'high_complexity',
  name: 'Alta Complexidade',
  description: null,
  category: 'tecnico',
  multiplier: 1.15,
  is_blocking: false,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ── TIQS-007 a TIQS-015 ────────────────────────────────────────────────────────

describe('RiskEngine', () => {
  // TIQS-007: detecção gte satisfeita quando valor >= threshold
  describe('TIQS-007: detecção gte satisfeita quando valor >= threshold', () => {
    it('detecta risco quando valor numérico >= threshold configurado', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'integrations_count',
          triggers_risk: { condition: 'gte', value: 3, risk_key: 'high_complexity' },
        }),
      ];
      const multipliers: RiskMultiplier[] = [
        makeRiskMultiplier({ key: 'high_complexity', multiplier: 1.15 }),
      ];
      const answers: ScopingAnswers = { integrations_count: 5 };
      const risks = detectRisks(answers, questions, multipliers);
      expect(risks).toHaveLength(1);
      expect(risks[0].key).toBe('high_complexity');
    });

    it('detecta risco exactamente no threshold (valor == threshold)', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'integrations_count',
          triggers_risk: { condition: 'gte', value: 3, risk_key: 'high_complexity' },
        }),
      ];
      const multipliers: RiskMultiplier[] = [
        makeRiskMultiplier({ key: 'high_complexity' }),
      ];
      const answers: ScopingAnswers = { integrations_count: 3 };
      const risks = detectRisks(answers, questions, multipliers);
      expect(risks).toHaveLength(1);
    });
  });

  // TIQS-008: detecção gte não satisfeita quando valor < threshold
  describe('TIQS-008: detecção gte NÃO satisfeita quando valor < threshold', () => {
    it('não detecta risco quando valor numérico < threshold', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'integrations_count',
          triggers_risk: { condition: 'gte', value: 3, risk_key: 'high_complexity' },
        }),
      ];
      const multipliers: RiskMultiplier[] = [
        makeRiskMultiplier({ key: 'high_complexity' }),
      ];
      const answers: ScopingAnswers = { integrations_count: 2 };
      const risks = detectRisks(answers, questions, multipliers);
      expect(risks).toHaveLength(0);
    });
  });

  // TIQS-009: total multiplier = produto dos activos (1.15 × 1.10 = 1.265)
  describe('TIQS-009: total multiplier é o produto de todos os riscos detectados', () => {
    it('calcula produto: 1.15 × 1.10 = 1.265', () => {
      const risks: DetectedRisk[] = [
        { key: 'high_complexity', multiplier: 1.15, is_blocking: false },
        { key: 'tight_deadline', multiplier: 1.10, is_blocking: false },
      ];
      const total = calculateTotalMultiplier(risks);
      expect(total).toBeCloseTo(1.265, 3);
    });

    it('retorna 1.0 quando não há riscos', () => {
      expect(calculateTotalMultiplier([])).toBe(1.0);
    });

    it('retorna o próprio multiplier quando há apenas um risco', () => {
      const risks: DetectedRisk[] = [
        { key: 'high_complexity', multiplier: 1.20, is_blocking: false },
      ];
      expect(calculateTotalMultiplier(risks)).toBeCloseTo(1.20, 3);
    });
  });

  // TIQS-010: multiplier < 1.0 lança erro
  describe('TIQS-010: multiplier < 1.0 lança erro', () => {
    it('lança erro quando um dos multiplicadores é menor que 1.0', () => {
      const risks: DetectedRisk[] = [
        { key: 'discount_risk', multiplier: 0.9, is_blocking: false },
      ];
      expect(() => calculateTotalMultiplier(risks)).toThrow();
    });
  });

  // TIQS-011: risco bloqueante impede submissão (hasBlockingRisk=true)
  describe('TIQS-011: risco bloqueante detectado → hasBlockingRisk=true', () => {
    it('retorna true quando existe pelo menos um risco bloqueante', () => {
      const risks: DetectedRisk[] = [
        { key: 'high_complexity', multiplier: 1.15, is_blocking: false },
        { key: 'legal_risk', multiplier: 1.30, is_blocking: true },
      ];
      expect(hasBlockingRisk(risks)).toBe(true);
    });

    it('retorna false quando nenhum risco é bloqueante', () => {
      const risks: DetectedRisk[] = [
        { key: 'high_complexity', multiplier: 1.15, is_blocking: false },
      ];
      expect(hasBlockingRisk(risks)).toBe(false);
    });

    it('retorna false com array vazio', () => {
      expect(hasBlockingRisk([])).toBe(false);
    });
  });

  // TIQS-012: override sem notas lança erro
  describe('TIQS-012: override de risco sem notas lança erro', () => {
    it('lança erro quando override=true e notes é undefined', () => {
      expect(() => validateRiskOverride(true, undefined)).toThrow();
    });

    it('lança erro quando override=true e notes é string vazia', () => {
      expect(() => validateRiskOverride(true, '')).toThrow();
    });

    it('lança erro quando override=true e notes é string só de espaços', () => {
      expect(() => validateRiskOverride(true, '   ')).toThrow();
    });
  });

  // TIQS-013: override com notas aceite
  describe('TIQS-013: override com notas aceite sem lançar erro', () => {
    it('não lança erro quando override=true e notes está preenchido', () => {
      expect(() =>
        validateRiskOverride(true, 'Cliente aprovou o risco em reunião de 2026-06-10')
      ).not.toThrow();
    });

    it('não lança erro quando override=false (sem notas necessárias)', () => {
      expect(() => validateRiskOverride(false, undefined)).not.toThrow();
    });
  });

  // TIQS-014: subtotal_with_risk = subtotal_base × risk_multiplier_total
  describe('TIQS-014: cálculo de subtotal_with_risk e risk_adjustment', () => {
    it('subtotal_with_risk = subtotal_base × multiplier_total', () => {
      const subtotalBase = 10000;
      const multiplierTotal = calculateTotalMultiplier([
        { key: 'high_complexity', multiplier: 1.15, is_blocking: false },
      ]);
      const subtotalWithRisk = subtotalBase * multiplierTotal;
      const riskAdjustment = subtotalWithRisk - subtotalBase;
      expect(subtotalWithRisk).toBeCloseTo(11500, 2);
      expect(riskAdjustment).toBeCloseTo(1500, 2);
    });

    it('risk_adjustment = diferença entre subtotal_with_risk e subtotal_base', () => {
      const subtotalBase = 5000;
      const multiplier = 1.10;
      const subtotalWithRisk = subtotalBase * multiplier;
      expect(subtotalWithRisk - subtotalBase).toBeCloseTo(500, 2);
    });
  });

  // TIQS-015: sem riscos, multiplier_total = 1.0
  describe('TIQS-015: sem riscos detectados, multiplier_total = 1.0', () => {
    it('retorna 1.0 exactamente quando array de riscos está vazio', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'integrations_count',
          triggers_risk: { condition: 'gte', value: 3, risk_key: 'high_complexity' },
        }),
      ];
      const multipliers: RiskMultiplier[] = [
        makeRiskMultiplier({ key: 'high_complexity' }),
      ];
      const answers: ScopingAnswers = { integrations_count: 1 }; // abaixo do threshold
      const risks = detectRisks(answers, questions, multipliers);
      expect(calculateTotalMultiplier(risks)).toBe(1.0);
    });
  });
});
