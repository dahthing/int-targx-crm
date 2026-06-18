export type QuoteStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'aprovado_interno'
  | 'enviado_cliente'
  | 'aceite'
  | 'rejeitado';

// ── Error classes ──────────────────────────────────────────────────────────────

export class ForbiddenError extends Error {
  constructor(msg = 'Forbidden') {
    super(msg);
    this.name = 'ForbiddenError';
  }
}

export class ValidationError extends Error {
  constructor(msg = 'Validation failed') {
    super(msg);
    this.name = 'ValidationError';
  }
}

export class QuoteLockedError extends Error {
  constructor(msg = 'Orçamento bloqueado — não é editável') {
    super(msg);
    this.name = 'QuoteLockedError';
  }
}

export class InvalidQuoteTransitionError extends Error {
  constructor(from: QuoteStatus, to: QuoteStatus) {
    super(`Transição inválida: ${from} → ${to}`);
    this.name = 'InvalidQuoteTransitionError';
    this.from = from;
    this.to = to;
  }
  readonly from: QuoteStatus;
  readonly to: QuoteStatus;
}

export class MarginTooLowError extends Error {
  constructor(msg = 'Margem abaixo do mínimo permitido') {
    super(msg);
    this.name = 'MarginTooLowError';
  }
}

// ── Valid transitions ──────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<QuoteStatus, QuoteStatus[]> = {
  rascunho: ['em_revisao'],
  em_revisao: ['aprovado_interno', 'rascunho'],
  aprovado_interno: ['enviado_cliente'],
  enviado_cliente: ['aceite', 'rejeitado'],
  aceite: [],
  rejeitado: ['rascunho'],
};

/** Locked statuses that cannot be transitioned out of (for edit purposes) */
const LOCKED_STATUSES: QuoteStatus[] = ['aceite'];

// ── Pure functions ─────────────────────────────────────────────────────────────

export function isValidQuoteTransition(from: QuoteStatus, to: QuoteStatus): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export interface TransitionOptions {
  role: 'admin' | 'partner' | 'tech';
  notes?: string;
  currentMarginPct?: number;
  minimumMarginPct?: number;
}

export function validateQuoteTransition(
  quote: { status: QuoteStatus },
  newStatus: QuoteStatus,
  options: TransitionOptions,
): void {
  const { status } = quote;
  const { role, notes, currentMarginPct, minimumMarginPct } = options;

  // Locked quote
  if (LOCKED_STATUSES.includes(status)) {
    throw new QuoteLockedError();
  }

  // Invalid transition
  if (!isValidQuoteTransition(status, newStatus)) {
    throw new InvalidQuoteTransitionError(status, newStatus);
  }

  // Only admin can approve
  if (newStatus === 'aprovado_interno' && role !== 'admin') {
    throw new ForbiddenError('Apenas administradores podem aprovar orçamentos');
  }

  // Returning to rascunho requires notes
  if (status === 'em_revisao' && newStatus === 'rascunho') {
    if (!notes || notes.trim().length === 0) {
      throw new ValidationError('Motivo de devolução é obrigatório');
    }
  }

  // Partner submitting with margin below minimum
  if (newStatus === 'em_revisao' && role === 'partner') {
    if (
      currentMarginPct !== undefined &&
      minimumMarginPct !== undefined &&
      currentMarginPct < minimumMarginPct
    ) {
      throw new MarginTooLowError(
        `Margem ${currentMarginPct}% abaixo do mínimo de ${minimumMarginPct}%`,
      );
    }
  }
}

export interface NewVersionDiff {
  version: number;
  parent_quote_id: string;
  status: QuoteStatus;
}

export function buildNewVersion(quote: { id: string; version: number }): NewVersionDiff {
  return {
    version: quote.version + 1,
    parent_quote_id: quote.id,
    status: 'rascunho',
  };
}

const TERMINAL_STATUSES: QuoteStatus[] = ['aceite', 'rejeitado'];

export function detectActiveVersionConflict(
  quotes: Array<{ status: QuoteStatus; lead_id: string | null }>,
  leadId: string,
): boolean {
  return quotes.some(
    (q) => q.lead_id === leadId && !TERMINAL_STATUSES.includes(q.status),
  );
}

export interface AuditEntry {
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string;
}

export function buildAuditEntry(
  field: string,
  oldValue: unknown,
  newValue: unknown,
  userId: string,
): AuditEntry {
  return {
    field,
    old_value: oldValue !== null && oldValue !== undefined ? String(oldValue) : null,
    new_value: newValue !== null && newValue !== undefined ? String(newValue) : null,
    changed_by: userId,
  };
}
