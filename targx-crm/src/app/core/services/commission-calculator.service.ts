import { Injectable } from '@angular/core';
import {
  CommissionTier,
  CommissionResult,
  CommissionBreakdownItem,
} from '../models/commission.model';

interface CalculateParams {
  trancheAmount: number;
  previousVolumeInYear: number;
  tiers: CommissionTier[];
}

@Injectable({ providedIn: 'root' })
export class CommissionCalculatorService {
  calculateForTranche(params: CalculateParams): CommissionResult {
    const { trancheAmount, previousVolumeInYear, tiers } = params;

    if (trancheAmount < 0) {
      throw new Error('trancheAmount não pode ser negativo');
    }

    if (trancheAmount === 0) {
      return { commissionAmount: 0, breakdown: [], newVolumeTotal: previousVolumeInYear };
    }

    const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);
    const breakdown: CommissionBreakdownItem[] = [];

    let remaining = trancheAmount;
    let currentVolume = previousVolumeInYear;

    for (const tier of sorted) {
      if (remaining <= 0) break;

      const tierStart = tier.volume_from;
      const tierEnd = tier.volume_to ?? Infinity;

      // Volume já passou este tier — avança
      if (currentVolume >= tierEnd) continue;

      // Porção do tier disponível a partir da posição actual
      const tierAvailable = tierEnd - Math.max(currentVolume, tierStart);
      const portion = Math.min(remaining, tierAvailable);

      if (portion <= 0) continue;

      const amount = this.#round(portion * tier.rate_percent / 100);

      breakdown.push({
        tierLabel: tier.label,
        portion,
        rate: tier.rate_percent,
        amount,
      });

      remaining -= portion;
      currentVolume += portion;
    }

    const commissionAmount = this.#round(breakdown.reduce((sum, b) => sum + b.amount, 0));

    return {
      commissionAmount,
      breakdown,
      newVolumeTotal: previousVolumeInYear + trancheAmount,
    };
  }

  #round(value: number): number {
    return Math.round(value * 100) / 100;
  }
}
