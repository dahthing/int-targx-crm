import { Injectable } from '@angular/core';
import type { QuoteItem, QuotePhase } from '../models/quote.model';
import {
  calculateItemSubtotal,
  calculateQuoteTotals,
} from './quote-calculator.functions';
import type { QuoteTotals } from './quote-calculator.functions';

export type { QuoteTotals } from './quote-calculator.functions';

@Injectable({ providedIn: 'root' })
export class QuoteCalculatorService {
  calculateItemSubtotal(item: QuoteItem): number {
    return calculateItemSubtotal(item);
  }

  calculateQuoteTotals(
    phases: QuotePhase[],
    items: QuoteItem[],
    discountPct: number,
    riskMultiplier: number,
    minimumPrice: number,
    taxRatePct: number
  ): QuoteTotals {
    return calculateQuoteTotals(phases, items, discountPct, riskMultiplier, minimumPrice, taxRatePct);
  }
}
