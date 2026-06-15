import { Injectable } from '@angular/core';
import {
  CommissionBonus,
  AnnualBonus,
  BonusToCreate,
} from '../models/commission.model';

interface CheckBonusParams {
  previousVolume: number;
  newVolume: number;
  bonuses: CommissionBonus[];
  existingBonuses: AnnualBonus[];
}

@Injectable({ providedIn: 'root' })
export class BonusCalculatorService {
  checkBonusThresholds(params: CheckBonusParams): BonusToCreate[] {
    const { previousVolume, newVolume, bonuses, existingBonuses } = params;

    const existingThresholds = new Set(existingBonuses.map(b => b.threshold));
    const result: BonusToCreate[] = [];

    for (const bonus of bonuses) {
      // Limiar cruzado nesta tranche: previousVolume < threshold <= newVolume
      const crossed = previousVolume < bonus.threshold && newVolume >= bonus.threshold;
      if (crossed && !existingThresholds.has(bonus.threshold)) {
        result.push({
          threshold: bonus.threshold,
          bonus_amount: bonus.bonus_amount,
          description: bonus.description,
        });
      }
    }

    return result;
  }
}
