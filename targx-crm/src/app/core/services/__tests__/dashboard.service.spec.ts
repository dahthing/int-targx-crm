import { describe, it, expect } from 'vitest';
import type { CommissionTier, CommissionBonus } from '../../models/commission.model';
import {
  calculatePartnerSummary,
  calculateBonusStatus,
  calculateTargetProgress,
  calculatePipelineValue,
  countSilentLeads,
  groupLeadsByStatus,
  calculateEstimationAccuracy,
  aggregateAdminOverview,
  guardAdminOnly,
  ForbiddenError,
} from '../dashboard.functions';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const standardTiers: CommissionTier[] = [
  { id: 't1', plan_id: 'p1', tier_order: 1, volume_from: 0, volume_to: 100000, rate_percent: 15, label: 'Base' },
  { id: 't2', plan_id: 'p1', tier_order: 2, volume_from: 100000, volume_to: null, rate_percent: 20, label: 'Sénior' },
];

const standardBonuses: CommissionBonus[] = [
  { id: 'b1', plan_id: 'p1', threshold: 150000, bonus_amount: 3000, description: null },
  { id: 'b2', plan_id: 'p1', threshold: 250000, bonus_amount: 7500, description: null },
];

// ── Testes ────────────────────────────────────────────────────────────────────

describe('DashboardService', () => {
  describe('DSH-001: getPartnerSummary retorna todos os campos calculados', () => {
    it('shape de PartnerSummary contém todos os campos obrigatórios', () => {
      const summary = calculatePartnerSummary({
        volume_ano: 60000,
        commission_ano: 9000,
        tiers: standardTiers,
        bonuses: standardBonuses,
        existingAnnualBonuses: [],
        volume_trimestre: 20000,
        target_trimestre: 40000,
        pipeline_value: 150000,
        leads_abertas: 5,
        leads_sem_actividade: 1,
      });
      expect(summary).toHaveProperty('volume_ano');
      expect(summary).toHaveProperty('commission_ano');
      expect(summary).toHaveProperty('tier_actual');
      expect(summary).toHaveProperty('tier_rate');
      expect(summary).toHaveProperty('next_tier_threshold');
      expect(summary).toHaveProperty('volume_to_next_tier');
      expect(summary).toHaveProperty('next_tier_rate');
      expect(summary).toHaveProperty('progress_pct_tier');
      expect(summary).toHaveProperty('bonus_status');
      expect(summary).toHaveProperty('volume_trimestre');
      expect(summary).toHaveProperty('target_trimestre');
      expect(summary).toHaveProperty('progress_pct_target');
      expect(summary).toHaveProperty('pipeline_value');
      expect(summary).toHaveProperty('leads_abertas');
      expect(summary).toHaveProperty('leads_sem_actividade');
    });
  });

  describe('DSH-002: progress_pct_tier correcto (60k de 100k → 60%)', () => {
    it('calcula 60% quando volume é 60k de 100k', () => {
      const summary = calculatePartnerSummary({
        volume_ano: 60000, commission_ano: 0,
        tiers: standardTiers, bonuses: [], existingAnnualBonuses: [],
        volume_trimestre: 0, target_trimestre: null,
        pipeline_value: 0, leads_abertas: 0, leads_sem_actividade: 0,
      });
      expect(summary.progress_pct_tier).toBe(60);
    });

    it('calcula 0% quando volume é 0', () => {
      const summary = calculatePartnerSummary({
        volume_ano: 0, commission_ano: 0,
        tiers: standardTiers, bonuses: [], existingAnnualBonuses: [],
        volume_trimestre: 0, target_trimestre: null,
        pipeline_value: 0, leads_abertas: 0, leads_sem_actividade: 0,
      });
      expect(summary.progress_pct_tier).toBe(0);
    });

    it('retorna 100% quando no último tier (sem volume_to)', () => {
      const summary = calculatePartnerSummary({
        volume_ano: 150000, commission_ano: 0,
        tiers: standardTiers, bonuses: [], existingAnnualBonuses: [],
        volume_trimestre: 0, target_trimestre: null,
        pipeline_value: 0, leads_abertas: 0, leads_sem_actividade: 0,
      });
      expect(summary.progress_pct_tier).toBe(100);
    });
  });

  describe('DSH-003: volume_to_next_tier correcto', () => {
    it('retorna 40.000 quando volume é 60k e próximo tier é 100k', () => {
      const summary = calculatePartnerSummary({
        volume_ano: 60000, commission_ano: 0,
        tiers: standardTiers, bonuses: [], existingAnnualBonuses: [],
        volume_trimestre: 0, target_trimestre: null,
        pipeline_value: 0, leads_abertas: 0, leads_sem_actividade: 0,
      });
      expect(summary.volume_to_next_tier).toBe(40000);
    });

    it('retorna null quando no último tier (sem volume_to)', () => {
      const summary = calculatePartnerSummary({
        volume_ano: 150000, commission_ano: 0,
        tiers: standardTiers, bonuses: [], existingAnnualBonuses: [],
        volume_trimestre: 0, target_trimestre: null,
        pipeline_value: 0, leads_abertas: 0, leads_sem_actividade: 0,
      });
      expect(summary.volume_to_next_tier).toBeNull();
    });
  });

  describe('DSH-004: bonus_status[] para cada bónus do plano', () => {
    it('devolve status correcto para bónus não atingido', () => {
      const statuses = calculateBonusStatus(80000, standardBonuses, []);
      expect(statuses).toHaveLength(2);
      expect(statuses[0]).toMatchObject({
        threshold: 150000,
        bonus_amount: 3000,
        achieved: false,
        volume_remaining: 70000,
      });
    });

    it('marca bónus como achieved quando volume o atinge', () => {
      const statuses = calculateBonusStatus(160000, standardBonuses, [
        { id: 'ab1', partner_id: 'p1', year: 2026, volume_total: 160000, threshold: 150000, bonus_amount: 3000, paid: false, paid_date: null, created_at: '' },
      ]);
      expect(statuses[0]).toMatchObject({ achieved: true, volume_remaining: null });
      expect(statuses[1]).toMatchObject({ achieved: false });
    });
  });

  describe('DSH-005: progress_pct_target vs meta trimestral', () => {
    it('calcula 50% quando volume_trimestre é metade do target', () => {
      expect(calculateTargetProgress(20000, 40000)).toBe(50);
    });

    it('retorna null quando não existe target trimestral', () => {
      expect(calculateTargetProgress(20000, null)).toBeNull();
    });

    it('limita a 100% quando volume excede o target', () => {
      expect(calculateTargetProgress(50000, 40000)).toBe(100);
    });
  });

  describe('DSH-006: pipeline_value e leads_sem_actividade', () => {
    it('calcula pipeline_value como soma de estimated_value de leads não fechadas', () => {
      const leads = [
        { status: 'nova' as const, estimated_value: 10000 },
        { status: 'contactada' as const, estimated_value: 20000 },
        { status: 'fechada_ganha' as const, estimated_value: 5000 },
        { status: 'nova' as const, estimated_value: null },
      ];
      expect(calculatePipelineValue(leads)).toBe(30000);
    });

    it('conta leads_sem_actividade acima de warning_days', () => {
      const now = Date.now();
      const leads = [
        { last_activity_at: new Date(now - 10 * 86400000).toISOString(), status: 'nova' as const },
        { last_activity_at: new Date(now - 3 * 86400000).toISOString(), status: 'nova' as const },
        { last_activity_at: null, status: 'nova' as const },
      ];
      expect(countSilentLeads(leads, 7)).toBe(2);
    });
  });

  describe('DSH-007: getAdminOverview agrega todos os parceiros', () => {
    it('retorna dados agregados de múltiplos parceiros', () => {
      const overview = aggregateAdminOverview([
        { partner_id: 'p1', volume: 60000, commission: 9000, leads_abertas: 3 },
        { partner_id: 'p2', volume: 120000, commission: 27000, leads_abertas: 5 },
      ]);
      expect(overview.volume_total).toBe(180000);
      expect(overview.commission_total).toBe(36000);
      expect(overview.leads_abertas_total).toBe(8);
    });
  });

  describe('DSH-008: partner a chamar getAdminOverview lança ForbiddenError', () => {
    it('lança ForbiddenError quando role é partner', () => {
      expect(() => guardAdminOnly('partner')).toThrow(ForbiddenError);
    });

    it('não lança quando role é admin', () => {
      expect(() => guardAdminOnly('admin')).not.toThrow();
    });
  });

  describe('DSH-009: getEstimationAccuracy por tipo de projecto', () => {
    it('calcula desvio percentual médio por tipo', () => {
      const accuracy = calculateEstimationAccuracy([
        { project_type: 'ecommerce', estimated_hours: 100, actual_hours: 120 },
        { project_type: 'ecommerce', estimated_hours: 80, actual_hours: 100 },
        { project_type: 'website_institucional', estimated_hours: 50, actual_hours: 55 },
      ]);
      const ecommerce = accuracy.find((a) => a.project_type === 'ecommerce');
      expect(ecommerce).toBeDefined();
      expect(ecommerce!.avg_estimated).toBe(90);
      expect(ecommerce!.avg_actual).toBe(110);
      expect(ecommerce!.avg_deviation_pct).toBeCloseTo(22.22, 1);
      expect(ecommerce!.count).toBe(2);
    });
  });

  describe('DSH-010: getPipelineSummary agrupado por estado com value_total', () => {
    it('agrupa leads por estado e soma estimated_value', () => {
      const groups = groupLeadsByStatus([
        { status: 'nova' as const, estimated_value: 10000 },
        { status: 'nova' as const, estimated_value: 5000 },
        { status: 'contactada' as const, estimated_value: 20000 },
        { status: 'contactada' as const, estimated_value: null },
      ]);
      const nova = groups.find((g) => g.status === 'nova');
      const contactada = groups.find((g) => g.status === 'contactada');
      expect(nova).toMatchObject({ count: 2, value_total: 15000 });
      expect(contactada).toMatchObject({ count: 2, value_total: 20000 });
    });
  });
});
