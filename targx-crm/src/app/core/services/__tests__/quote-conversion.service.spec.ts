import { describe, it, expect } from 'vitest';
import {
  parseTranches,
  calculateContractValue,
  calculateEstimatedHours,
  buildConversionPayload,
  isAlreadyConverted,
  type TrancheDto,
  type QuoteItemForConversion,
  type QuoteItemForHours,
} from '../quote-conversion.functions';

// ── TIQS-048: contract_value includes accepted optional items ─────────────────
describe('TIQS-048: contract_value = total_before_tax + accepted optional items', () => {
  it('adds accepted optional fixed items to totalBeforeTax', () => {
    const items: QuoteItemForConversion[] = [
      { optional: false, optional_accepted: false, unit_value: 1000, hours: null, hourly_rate: null, quantity: 1, pricing_type: 'fixed' },
      { optional: true, optional_accepted: true, unit_value: 500, hours: null, hourly_rate: null, quantity: 1, pricing_type: 'fixed' },
      { optional: true, optional_accepted: false, unit_value: 300, hours: null, hourly_rate: null, quantity: 1, pricing_type: 'fixed' },
    ];
    // totalBeforeTax is the base (mandatory). accepted optional adds 500.
    expect(calculateContractValue(8000, items)).toBe(8500);
  });

  it('adds accepted optional hourly items to totalBeforeTax', () => {
    const items: QuoteItemForConversion[] = [
      { optional: true, optional_accepted: true, unit_value: null, hours: 10, hourly_rate: 80, quantity: 1, pricing_type: 'hourly' },
    ];
    expect(calculateContractValue(5000, items)).toBe(5800);
  });

  it('ignores non-accepted optional items', () => {
    const items: QuoteItemForConversion[] = [
      { optional: true, optional_accepted: false, unit_value: 999, hours: null, hourly_rate: null, quantity: 1, pricing_type: 'fixed' },
    ];
    expect(calculateContractValue(10000, items)).toBe(10000);
  });

  it('returns totalBeforeTax when no optional items', () => {
    expect(calculateContractValue(7500, [])).toBe(7500);
  });
});

// ── TIQS-049: estimated_hours snapshot ───────────────────────────────────────
describe('TIQS-049: estimated_hours is snapshot of hourly items', () => {
  it('sums hours from mandatory hourly items', () => {
    const items: QuoteItemForHours[] = [
      { optional: false, optional_accepted: false, hours: 40, pricing_type: 'hourly' },
      { optional: false, optional_accepted: false, hours: 20, pricing_type: 'hourly' },
    ];
    expect(calculateEstimatedHours(items)).toBe(60);
  });

  it('includes accepted optional hourly items', () => {
    const items: QuoteItemForHours[] = [
      { optional: false, optional_accepted: false, hours: 40, pricing_type: 'hourly' },
      { optional: true, optional_accepted: true, hours: 8, pricing_type: 'hourly' },
    ];
    expect(calculateEstimatedHours(items)).toBe(48);
  });

  it('excludes non-accepted optional hourly items', () => {
    const items: QuoteItemForHours[] = [
      { optional: false, optional_accepted: false, hours: 40, pricing_type: 'hourly' },
      { optional: true, optional_accepted: false, hours: 20, pricing_type: 'hourly' },
    ];
    expect(calculateEstimatedHours(items)).toBe(40);
  });

  it('ignores fixed-price items (no hours)', () => {
    const items: QuoteItemForHours[] = [
      { optional: false, optional_accepted: false, hours: null, pricing_type: 'fixed' },
      { optional: false, optional_accepted: false, hours: 30, pricing_type: 'hourly' },
    ];
    expect(calculateEstimatedHours(items)).toBe(30);
  });
});

// ── TIQS-050: parseTranches ───────────────────────────────────────────────────
describe('TIQS-050: parseTranches splits payment terms into TrancheDto array', () => {
  it('parses "40% adjudicação, 30% entrega, 30% fecho" with 10000', () => {
    const result = parseTranches('40% adjudicação, 30% entrega, 30% fecho', 10000);
    expect(result).toHaveLength(3);
    expect(result[0]).toMatchObject<Partial<TrancheDto>>({ description: 'adjudicação', amount: 4000 });
    expect(result[1]).toMatchObject<Partial<TrancheDto>>({ description: 'entrega', amount: 3000 });
    expect(result[2]).toMatchObject<Partial<TrancheDto>>({ description: 'fecho', amount: 3000 });
  });

  it('sets due_date=null, received=false, commission_paid=false on each tranche', () => {
    const result = parseTranches('50% início, 50% fim', 1000);
    for (const t of result) {
      expect(t.due_date).toBeNull();
      expect(t.received).toBe(false);
      expect(t.commission_paid).toBe(false);
    }
  });

  it('calculates amount correctly with decimal percentages', () => {
    const result = parseTranches('33% a, 33% b, 34% c', 10000);
    expect(result[0].amount).toBe(3300);
    expect(result[1].amount).toBe(3300);
    expect(result[2].amount).toBe(3400);
  });

  it('returns empty array for empty string', () => {
    expect(parseTranches('', 10000)).toHaveLength(0);
  });
});

// ── TIQS-051: lead.status → 'fechada_ganha' ──────────────────────────────────
describe('TIQS-051: buildConversionPayload produces status em_curso and captures lead_id', () => {
  it('sets status to em_curso in the payload', () => {
    const quote = { id: 'q1', client_id: 'c1', partner_id: 'p1', lead_id: 'l1', title: 'Projecto X', total_before_tax: 10000 };
    const payload = buildConversionPayload(quote, 10000, 40);
    expect(payload.status).toBe('em_curso');
  });

  it('captures lead_id from the quote', () => {
    const quote = { id: 'q1', client_id: 'c1', partner_id: null, lead_id: 'lead-abc', title: 'T', total_before_tax: 5000 };
    const payload = buildConversionPayload(quote, 5000, 0);
    expect(payload.lead_id).toBe('lead-abc');
  });

  it('captures all required fields', () => {
    const quote = { id: 'q-99', client_id: 'c-77', partner_id: 'p-33', lead_id: null, title: 'Implementação', total_before_tax: 15000 };
    const payload = buildConversionPayload(quote, 16000, 120);
    expect(payload.quote_id).toBe('q-99');
    expect(payload.client_id).toBe('c-77');
    expect(payload.partner_id).toBe('p-33');
    expect(payload.contract_value).toBe(16000);
    expect(payload.estimated_hours).toBe(120);
    expect(payload.contract_date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

// ── TIQS-052: usage_count increment helper ────────────────────────────────────
describe('TIQS-052: usage_count — isAlreadyConverted false on new quote', () => {
  // Note: incrementing usage_count is a side-effect done in the service layer.
  // The pure function only confirms idempotency check behaviour.
  it('returns false when quote has not been converted yet', () => {
    const projects = [{ quote_id: 'other-quote' }, { quote_id: 'another-quote' }];
    expect(isAlreadyConverted(projects, 'new-quote')).toBe(false);
  });

  it('returns true when the quote is already in the projects list', () => {
    const projects = [{ quote_id: 'q-1' }, { quote_id: 'q-2' }];
    expect(isAlreadyConverted(projects, 'q-2')).toBe(true);
  });
});

// ── TIQS-053: idempotency ─────────────────────────────────────────────────────
describe('TIQS-053: idempotency — isAlreadyConverted prevents duplicate projects', () => {
  it('detects existing conversion to avoid duplicate', () => {
    const existingProjects = [
      { quote_id: 'quote-abc' },
      { quote_id: 'quote-xyz' },
    ];
    expect(isAlreadyConverted(existingProjects, 'quote-abc')).toBe(true);
  });

  it('handles null quote_id entries gracefully', () => {
    const existingProjects = [{ quote_id: null }, { quote_id: 'quote-abc' }];
    expect(isAlreadyConverted(existingProjects, 'quote-abc')).toBe(true);
    expect(isAlreadyConverted(existingProjects, 'quote-xyz')).toBe(false);
  });

  it('returns false for empty projects list', () => {
    expect(isAlreadyConverted([], 'quote-abc')).toBe(false);
  });
});
