export interface TrancheDto {
  description: string;
  amount: number;
  due_date: null;
  received: false;
  commission_paid: false;
}

/**
 * Parses a payment terms string like "40% adjudicação, 30% entrega, 30% fecho"
 * into an array of TrancheDto objects.
 */
export function parseTranches(paymentTerms: string, contractValue: number): TrancheDto[] {
  return paymentTerms
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const match = part.match(/^(\d+(?:\.\d+)?)%\s*(.+)$/);
      if (!match) return null;
      const pct = parseFloat(match[1]);
      const description = match[2].trim();
      const amount = Math.round((contractValue * pct) / 100 * 100) / 100;
      return { description, amount, due_date: null, received: false as const, commission_paid: false as const };
    })
    .filter((t): t is TrancheDto => t !== null);
}

export interface QuoteItemForConversion {
  optional: boolean;
  optional_accepted: boolean;
  unit_value: number | null;
  hours: number | null;
  hourly_rate: number | null;
  quantity: number;
  pricing_type: string;
}

/**
 * Calculates the contract value:
 * totalBeforeTax + sum of accepted optional items.
 */
export function calculateContractValue(
  totalBeforeTax: number,
  items: QuoteItemForConversion[]
): number {
  const optionalSum = items
    .filter((item) => item.optional && item.optional_accepted)
    .reduce((sum, item) => {
      if (item.pricing_type === 'hourly') {
        return sum + (item.hours ?? 0) * (item.hourly_rate ?? 0) * item.quantity;
      }
      return sum + (item.unit_value ?? 0) * item.quantity;
    }, 0);

  return Math.round((totalBeforeTax + optionalSum) * 100) / 100;
}

export interface QuoteItemForHours {
  optional: boolean;
  optional_accepted: boolean;
  hours: number | null;
  pricing_type: string;
}

/**
 * Calculates estimated hours:
 * Sum hours of all non-optional hourly items + accepted optional hourly items.
 */
export function calculateEstimatedHours(items: QuoteItemForHours[]): number {
  return items
    .filter((item) => item.pricing_type === 'hourly')
    .filter((item) => !item.optional || item.optional_accepted)
    .reduce((sum, item) => sum + (item.hours ?? 0), 0);
}

export interface QuoteForConversion {
  id: string;
  client_id: string;
  partner_id: string | null;
  lead_id: string | null;
  title: string;
  total_before_tax: number | null;
}

export interface ConversionPayload {
  quote_id: string;
  client_id: string;
  partner_id: string | null;
  lead_id: string | null;
  title: string;
  contract_value: number;
  contract_date: string;
  estimated_hours: number;
  status: 'em_curso';
}

/**
 * Builds the project creation payload from a quote.
 */
export function buildConversionPayload(
  quote: QuoteForConversion,
  contractValue: number,
  estimatedHours: number
): ConversionPayload {
  return {
    quote_id: quote.id,
    client_id: quote.client_id,
    partner_id: quote.partner_id,
    lead_id: quote.lead_id,
    title: quote.title,
    contract_value: contractValue,
    contract_date: new Date().toISOString().split('T')[0],
    estimated_hours: estimatedHours,
    status: 'em_curso',
  };
}

/**
 * Idempotency check: returns true if a project already exists for this quote.
 */
export function isAlreadyConverted(
  existingProjects: Array<{ quote_id: string | null }>,
  quoteId: string
): boolean {
  return existingProjects.some((p) => p.quote_id === quoteId);
}
