import { describe, it, expect } from 'vitest';
import {
  validateQuoteTransition,
  buildNewVersion,
  detectActiveVersionConflict,
  buildAuditEntry,
  isValidQuoteTransition,
  ForbiddenError,
  ValidationError,
  QuoteLockedError,
  InvalidQuoteTransitionError,
  MarginTooLowError,
  type QuoteStatus,
} from '../quote-state.functions';

// ── TIQS-027: rascunho→em_revisao creates a status history record ─────────────
describe('TIQS-027: rascunho→em_revisao transition', () => {
  it('is a valid transition and produces audit entry', () => {
    const quote = { status: 'rascunho' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'em_revisao', { role: 'partner' }),
    ).not.toThrow();

    const entry = buildAuditEntry('status', 'rascunho', 'em_revisao', 'user-1');
    expect(entry.field).toBe('status');
    expect(entry.old_value).toBe('rascunho');
    expect(entry.new_value).toBe('em_revisao');
    expect(entry.changed_by).toBe('user-1');
  });
});

// ── TIQS-028: partner cannot approve ─────────────────────────────────────────
describe('TIQS-028: partner cannot approve', () => {
  it('throws ForbiddenError when partner tries to approve', () => {
    const quote = { status: 'em_revisao' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'aprovado_interno', { role: 'partner' }),
    ).toThrow(ForbiddenError);
  });

  it('allows admin to approve', () => {
    const quote = { status: 'em_revisao' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'aprovado_interno', { role: 'admin' }),
    ).not.toThrow();
  });
});

// ── TIQS-029: return (em_revisao→rascunho) requires notes ────────────────────
describe('TIQS-029: return requires notes', () => {
  it('throws ValidationError when returning without notes', () => {
    const quote = { status: 'em_revisao' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'rascunho', { role: 'admin' }),
    ).toThrow(ValidationError);
  });

  it('throws ValidationError when notes is empty string', () => {
    const quote = { status: 'em_revisao' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'rascunho', { role: 'admin', notes: '   ' }),
    ).toThrow(ValidationError);
  });
});

// ── TIQS-030: return with notes is accepted ───────────────────────────────────
describe('TIQS-030: return with notes accepted', () => {
  it('does not throw when returning with notes', () => {
    const quote = { status: 'em_revisao' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'rascunho', {
        role: 'admin',
        notes: 'Precisa de revisão nos preços',
      }),
    ).not.toThrow();
  });
});

// ── TIQS-031: accepted quote is not editable ─────────────────────────────────
describe('TIQS-031: accepted quote locked', () => {
  it('throws QuoteLockedError when trying to transition from aceite', () => {
    const quote = { status: 'aceite' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'rascunho', { role: 'admin' }),
    ).toThrow(QuoteLockedError);
  });
});

// ── TIQS-032: invalid transition throws with states in error ─────────────────
describe('TIQS-032: invalid transition error contains states', () => {
  it('throws InvalidQuoteTransitionError with from/to info', () => {
    const quote = { status: 'rascunho' as QuoteStatus };
    let caught: InvalidQuoteTransitionError | undefined;
    try {
      validateQuoteTransition(quote, 'aceite', { role: 'admin' });
    } catch (e) {
      caught = e as InvalidQuoteTransitionError;
    }
    expect(caught).toBeInstanceOf(InvalidQuoteTransitionError);
    expect(caught?.message).toContain('rascunho');
    expect(caught?.message).toContain('aceite');
    expect(caught?.from).toBe('rascunho');
    expect(caught?.to).toBe('aceite');
  });
});

// ── TIQS-033: margin below minimum blocks partner submission ─────────────────
describe('TIQS-033: margin too low blocks partner submission', () => {
  it('throws MarginTooLowError when partner submits below minimum margin', () => {
    const quote = { status: 'rascunho' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'em_revisao', {
        role: 'partner',
        currentMarginPct: 10,
        minimumMarginPct: 20,
      }),
    ).toThrow(MarginTooLowError);
  });

  it('allows submission when margin meets minimum', () => {
    const quote = { status: 'rascunho' as QuoteStatus };
    expect(() =>
      validateQuoteTransition(quote, 'em_revisao', {
        role: 'partner',
        currentMarginPct: 25,
        minimumMarginPct: 20,
      }),
    ).not.toThrow();
  });
});

// ── TIQS-034: new version has version+1, parent_quote_id, status=rascunho ───
describe('TIQS-034: new version diff', () => {
  it('returns version+1, parent_quote_id and status=rascunho', () => {
    const quote = { id: 'quote-abc', version: 2, status: 'aceite' as QuoteStatus };
    const diff = buildNewVersion(quote);
    expect(diff.version).toBe(3);
    expect(diff.parent_quote_id).toBe('quote-abc');
    expect(diff.status).toBe('rascunho');
  });
});

// ── TIQS-035: only one active version per lead ───────────────────────────────
describe('TIQS-035: detect active version conflict', () => {
  it('returns true when there is already a non-terminal quote for the lead', () => {
    const quotes = [
      { status: 'em_revisao' as QuoteStatus, lead_id: 'lead-1' },
      { status: 'aceite' as QuoteStatus, lead_id: 'lead-2' },
    ];
    expect(detectActiveVersionConflict(quotes, 'lead-1')).toBe(true);
  });

  it('returns false when the existing quote is terminal', () => {
    const quotes = [
      { status: 'rejeitado' as QuoteStatus, lead_id: 'lead-1' },
    ];
    expect(detectActiveVersionConflict(quotes, 'lead-1')).toBe(false);
  });

  it('returns false when no quote exists for the lead', () => {
    const quotes = [
      { status: 'rascunho' as QuoteStatus, lead_id: 'lead-2' },
    ];
    expect(detectActiveVersionConflict(quotes, 'lead-1')).toBe(false);
  });
});

// ── TIQS-036: audit_log created for financial change ────────────────────────
describe('TIQS-036: audit entry for financial change', () => {
  it('builds a correct audit entry with field, old, new, user', () => {
    const entry = buildAuditEntry('total_before_tax', 10000, 12500, 'admin-42');
    expect(entry.field).toBe('total_before_tax');
    expect(entry.old_value).toBe('10000');
    expect(entry.new_value).toBe('12500');
    expect(entry.changed_by).toBe('admin-42');
  });

  it('handles null old value', () => {
    const entry = buildAuditEntry('discount_amount', null, 500, 'user-1');
    expect(entry.old_value).toBeNull();
    expect(entry.new_value).toBe('500');
  });
});
