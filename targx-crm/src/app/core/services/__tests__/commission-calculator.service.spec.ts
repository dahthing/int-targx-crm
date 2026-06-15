import { describe, it, expect, beforeEach } from 'vitest';
import { CommissionCalculatorService } from '../commission-calculator.service';
import { CommissionTier } from '../../models/commission.model';

const standardTiers: CommissionTier[] = [
  { id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0,      volume_to: 100000, rate_percent: 15, label: 'Escalão Base' },
  { id: '2', plan_id: 'p1', tier_order: 2, volume_from: 100000, volume_to: null,   rate_percent: 20, label: 'Escalão Sénior' },
];

const threeTiers: CommissionTier[] = [
  { id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0,      volume_to: 50000,  rate_percent: 10, label: 'T1' },
  { id: '2', plan_id: 'p1', tier_order: 2, volume_from: 50000,  volume_to: 150000, rate_percent: 15, label: 'T2' },
  { id: '3', plan_id: 'p1', tier_order: 3, volume_from: 150000, volume_to: null,   rate_percent: 20, label: 'T3' },
];

describe('CommissionCalculatorService', () => {
  let service: CommissionCalculatorService;

  beforeEach(() => {
    service = new CommissionCalculatorService();
  });

  // COM-001: taxa base no primeiro escalão — tranche integralmente dentro do tier 1
  it('COM-001: calcula comissão na taxa base quando volume está no primeiro escalão', () => {
    const result = service.calculateForTranche({
      trancheAmount: 10000,
      previousVolumeInYear: 0,
      tiers: standardTiers,
    });
    expect(result.commissionAmount).toBe(1500); // 10000 × 15%
    expect(result.newVolumeTotal).toBe(10000);
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(15);
    expect(result.breakdown[0].portion).toBe(10000);
  });

  // COM-002: tranche atravessa escalão — 95k acumulado + tranche de 10k → porção em cada tier
  it('COM-002: tranche que atravessa escalão calcula porção em cada tier correctamente', () => {
    const result = service.calculateForTranche({
      trancheAmount: 10000,
      previousVolumeInYear: 95000,
      tiers: standardTiers,
    });
    // 5000 em tier1 @15% = 750; 5000 em tier2 @20% = 1000; total = 1750
    expect(result.commissionAmount).toBe(1750);
    expect(result.breakdown).toHaveLength(2);
    expect(result.breakdown[0].portion).toBe(5000);
    expect(result.breakdown[0].amount).toBe(750);
    expect(result.breakdown[1].portion).toBe(5000);
    expect(result.breakdown[1].amount).toBe(1000);
  });

  // COM-003: volume já acima do tier1 → 100% na taxa do tier2
  it('COM-003: quando volume já está acima do tier1 aplica taxa superior completa', () => {
    const result = service.calculateForTranche({
      trancheAmount: 10000,
      previousVolumeInYear: 110000,
      tiers: standardTiers,
    });
    expect(result.commissionAmount).toBe(2000); // 10000 × 20%
    expect(result.breakdown).toHaveLength(1);
    expect(result.breakdown[0].rate).toBe(20);
  });

  // COM-004: plano de 1 escalão sem limite superior
  it('COM-004: plano de 1 escalão (sem volume_to) calcula correctamente', () => {
    const singleTier: CommissionTier[] = [
      { id: '1', plan_id: 'p1', tier_order: 1, volume_from: 0, volume_to: null, rate_percent: 12, label: 'Flat' },
    ];
    const result = service.calculateForTranche({
      trancheAmount: 50000,
      previousVolumeInYear: 0,
      tiers: singleTier,
    });
    expect(result.commissionAmount).toBe(6000); // 50000 × 12%
  });

  // COM-005: três escalões — tranche atravessa todos
  it('COM-005: tranche que atravessa três escalões distribui correctamente', () => {
    // previousVolume = 40000, tranche = 120000
    // T1: 50000-40000=10000 @10% = 1000
    // T2: 100000 @15% = 15000
    // T3: 10000 @20% = 2000
    const result = service.calculateForTranche({
      trancheAmount: 120000,
      previousVolumeInYear: 40000,
      tiers: threeTiers,
    });
    expect(result.commissionAmount).toBe(18000);
    expect(result.breakdown).toHaveLength(3);
  });

  // COM-006: tranche zero → comissão zero
  it('COM-006: tranche de zero retorna comissão zero', () => {
    const result = service.calculateForTranche({
      trancheAmount: 0,
      previousVolumeInYear: 0,
      tiers: standardTiers,
    });
    expect(result.commissionAmount).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });

  // COM-007: tranche negativa → lança erro
  it('COM-007: tranche negativa lança erro', () => {
    expect(() =>
      service.calculateForTranche({
        trancheAmount: -1000,
        previousVolumeInYear: 0,
        tiers: standardTiers,
      })
    ).toThrow();
  });

  // COM-008: plano activo na data da tranche — este teste é sobre selecção do plano
  // (lógica de selecção do plano activo é da Edge Function; o calculator recebe os tiers já filtrados)
  it('COM-008: usa os tiers fornecidos independentemente de datas (filtro é responsabilidade do caller)', () => {
    const result = service.calculateForTranche({
      trancheAmount: 5000,
      previousVolumeInYear: 0,
      tiers: standardTiers,
    });
    expect(result.commissionAmount).toBeGreaterThan(0);
  });

  // COM-009: só conta volume do ano civil corrente — responsabilidade do AccumulatedVolumeService
  it('COM-009: o calculator aceita o volume fornecido sem filtrar por ano (filtro é responsabilidade do caller)', () => {
    const result = service.calculateForTranche({
      trancheAmount: 10000,
      previousVolumeInYear: 90000,
      tiers: standardTiers,
    });
    // 10000 dentro do tier1 (10000+90000=100000 = fim do tier1)
    expect(result.commissionAmount).toBe(1500);
    expect(result.newVolumeTotal).toBe(100000);
  });

  // COM-010: tranches não recebidas excluídas — responsabilidade do AccumulatedVolumeService
  it('COM-010: previousVolumeInYear de zero quando não há tranches recebidas', () => {
    const result = service.calculateForTranche({
      trancheAmount: 10000,
      previousVolumeInYear: 0,
      tiers: standardTiers,
    });
    expect(result.commissionAmount).toBe(1500);
  });

  // COM-011: Janeiro sem histórico → previousVolume = 0
  it('COM-011: em Janeiro com previousVolumeInYear=0 calcula a partir do zero', () => {
    const result = service.calculateForTranche({
      trancheAmount: 20000,
      previousVolumeInYear: 0,
      tiers: standardTiers,
    });
    expect(result.commissionAmount).toBe(3000); // 20000 × 15%
    expect(result.newVolumeTotal).toBe(20000);
  });

  // Extra: verifica newVolumeTotal
  it('calcula newVolumeTotal correctamente', () => {
    const result = service.calculateForTranche({
      trancheAmount: 15000,
      previousVolumeInYear: 50000,
      tiers: standardTiers,
    });
    expect(result.newVolumeTotal).toBe(65000);
  });

  // Extra: breakdown deve ter apenas tiers com porção > 0
  it('breakdown não inclui tiers com porção zero', () => {
    const result = service.calculateForTranche({
      trancheAmount: 5000,
      previousVolumeInYear: 0,
      tiers: standardTiers,
    });
    expect(result.breakdown.every(b => b.portion > 0)).toBe(true);
  });
});
