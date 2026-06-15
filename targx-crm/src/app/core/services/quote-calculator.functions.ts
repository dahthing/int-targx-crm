import type { QuoteItem, QuotePhase } from '../models/quote.model';

export interface QuoteTotals {
  subtotal_base: number;
  risk_adjustment: number;
  subtotal_with_risk: number;
  discount_amount: number;
  total_before_tax: number;
  total_with_tax: number;
  total_hours: number;
}

export function calculateItemSubtotal(item: QuoteItem): number {
  if (item.pricing_type === 'hourly') {
    return (item.hours ?? 0) * (item.hourly_rate ?? 0) * item.quantity;
  }
  return (item.unit_value ?? 0) * item.quantity;
}

function isItemIncluded(item: QuoteItem): boolean {
  return !item.optional || item.optional_accepted;
}

export function calculateQuoteTotals(
  _phases: QuotePhase[],
  items: QuoteItem[],
  discountPct: number,
  riskMultiplier: number,
  minimumPrice: number,
  taxRatePct: number
): QuoteTotals {
  const includedItems = items.filter(isItemIncluded);

  const subtotal_base = includedItems.reduce(
    (acc, item) => acc + calculateItemSubtotal(item),
    0
  );

  const subtotal_with_risk = subtotal_base * riskMultiplier;
  const risk_adjustment = subtotal_with_risk - subtotal_base;
  const discount_amount = subtotal_with_risk * (discountPct / 100);
  const total_before_tax = Math.max(
    subtotal_with_risk - discount_amount,
    minimumPrice
  );
  const total_with_tax = total_before_tax * (1 + taxRatePct / 100);

  const total_hours = includedItems
    .filter(item => item.pricing_type === 'hourly')
    .reduce((acc, item) => acc + (item.hours ?? 0), 0);

  return {
    subtotal_base,
    risk_adjustment,
    subtotal_with_risk,
    discount_amount,
    total_before_tax,
    total_with_tax,
    total_hours,
  };
}
