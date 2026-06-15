import { describe, it, expect, beforeEach } from 'vitest';
import { BonusCalculatorService } from '../bonus-calculator.service';
import { CommissionBonus, AnnualBonus, BonusToCreate } from '../../models/commission.model';

const standardBonuses: CommissionBonus[] = [
  { id: 'b1', plan_id: 'p1', threshold: 150000, bonus_amount: 3000,  description: 'Bónus 150k' },
  { id: 'b2', plan_id: 'p1', threshold: 250000, bonus_amount: 7500,  description: 'Bónus 250k' },
];

describe('BonusCalculatorService', () => {
  let service: BonusCalculatorService;

  beforeEach(() => {
    service = new BonusCalculatorService();
  });

  // COM-012: abaixo do limiar → sem bónus
  it('COM-012: não cria bónus quando volume não atinge nenhum limiar', () => {
    const result = service.checkBonusThresholds({
      previousVolume: 100000,
      newVolume: 140000,
      bonuses: standardBonuses,
      existingBonuses: [],
    });
    expect(result).toHaveLength(0);
  });

  // COM-013: 150k limiar → bónus de 3.000
  it('COM-013: cria bónus de 3.000 quando volume atinge 150k', () => {
    const result = service.checkBonusThresholds({
      previousVolume: 140000,
      newVolume: 155000,
      bonuses: standardBonuses,
      existingBonuses: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].threshold).toBe(150000);
    expect(result[0].bonus_amount).toBe(3000);
  });

  // COM-014: não duplica bónus já existente
  it('COM-014: não cria bónus se já existe para o mesmo limiar no ano', () => {
    const existingBonus: AnnualBonus = {
      id: 'ab1',
      partner_id: 'p1',
      year: 2026,
      volume_total: 155000,
      threshold: 150000,
      bonus_amount: 3000,
      paid: false,
      paid_date: null,
      created_at: '2026-06-01',
    };

    const result = service.checkBonusThresholds({
      previousVolume: 140000,
      newVolume: 160000,
      bonuses: standardBonuses,
      existingBonuses: [existingBonus],
    });
    expect(result).toHaveLength(0);
  });

  // COM-015: 250k limiar → bónus de 7.500
  it('COM-015: cria bónus de 7.500 quando volume atinge 250k', () => {
    const result = service.checkBonusThresholds({
      previousVolume: 240000,
      newVolume: 260000,
      bonuses: standardBonuses,
      existingBonuses: [],
    });
    expect(result).toHaveLength(1);
    expect(result[0].threshold).toBe(250000);
    expect(result[0].bonus_amount).toBe(7500);
  });

  // COM-016: dois bónus no mesmo ano — quando uma tranche atravessa ambos os limiares
  it('COM-016: cria dois bónus quando uma tranche atravessa ambos os limiares', () => {
    const result = service.checkBonusThresholds({
      previousVolume: 140000,
      newVolume: 260000,
      bonuses: standardBonuses,
      existingBonuses: [],
    });
    expect(result).toHaveLength(2);
    const thresholds = result.map((b: BonusToCreate) => b.threshold);
    expect(thresholds).toContain(150000);
    expect(thresholds).toContain(250000);
  });

  // COM-017: reset anual — no novo ano não há existingBonuses do ano anterior
  it('COM-017: reset anual — novo ano começa sem bónus existentes, permite criar novamente', () => {
    // Simula: ano anterior tinha bónus, mas existingBonuses está vazio (novo ano)
    const result = service.checkBonusThresholds({
      previousVolume: 140000,
      newVolume: 155000,
      bonuses: standardBonuses,
      existingBonuses: [], // novo ano, sem bónus ainda
    });
    expect(result).toHaveLength(1);
    expect(result[0].threshold).toBe(150000);
  });

  // Extra: quando previousVolume já está acima do limiar e newVolume também → não duplica
  it('quando previousVolume já estava acima do limiar não cria bónus novo', () => {
    const existingBonus: AnnualBonus = {
      id: 'ab1',
      partner_id: 'p1',
      year: 2026,
      volume_total: 155000,
      threshold: 150000,
      bonus_amount: 3000,
      paid: false,
      paid_date: null,
      created_at: '2026-06-01',
    };

    const result = service.checkBonusThresholds({
      previousVolume: 155000,
      newVolume: 165000,
      bonuses: standardBonuses,
      existingBonuses: [existingBonus],
    });
    expect(result).toHaveLength(0);
  });
});
