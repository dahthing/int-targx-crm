import { Injectable } from '@angular/core';
import type { QuoteItem } from '../models/quote.model';
import { calculateMargin } from './margin-validator.functions';
import type { MarginResult } from './margin-validator.functions';

export type { MarginResult } from './margin-validator.functions';

@Injectable({ providedIn: 'root' })
export class MarginValidatorService {
  calculateMargin(
    totalBeforeTax: number,
    items: QuoteItem[],
    fixedCostProxyPct: number,
    minimumMarginPct: number = 25
  ): MarginResult {
    return calculateMargin(totalBeforeTax, items, fixedCostProxyPct, minimumMarginPct);
  }
}
