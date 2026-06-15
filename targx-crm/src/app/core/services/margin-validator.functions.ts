import type { QuoteItem } from '../models/quote.model';

export interface MarginResult {
  custo_interno: number;
  margin_value: number;
  margin_pct: number;
  is_valid: boolean;
  minimum_margin_pct: number;
}

function isItemIncluded(item: QuoteItem): boolean {
  return !item.optional || item.optional_accepted;
}

export function calculateMargin(
  totalBeforeTax: number,
  items: QuoteItem[],
  fixedCostProxyPct: number,
  minimumMarginPct: number = 25
): MarginResult {
  const includedItems = items.filter(isItemIncluded);

  const custo_interno = includedItems.reduce((acc, item) => {
    if (item.pricing_type === 'hourly') {
      return acc + (item.hours ?? 0) * (item.hourly_rate ?? 0);
    }
    return acc + (item.unit_value ?? 0) * item.quantity * (fixedCostProxyPct / 100);
  }, 0);

  const margin_value = totalBeforeTax - custo_interno;
  const margin_pct = totalBeforeTax > 0 ? (margin_value / totalBeforeTax) * 100 : 0;
  const is_valid = margin_pct >= minimumMarginPct;

  return {
    custo_interno,
    margin_value,
    margin_pct,
    is_valid,
    minimum_margin_pct: minimumMarginPct,
  };
}
