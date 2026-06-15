export class TokenInvalidError extends Error {
  constructor() {
    super('Token inválido');
    this.name = 'TokenInvalidError';
  }
}

export class TokenExpiredError extends Error {
  constructor() {
    super('Proposta expirada');
    this.name = 'TokenExpiredError';
  }
}

export class ValidationError extends Error {
  constructor(msg = 'Validation failed') {
    super(msg);
    this.name = 'ValidationError';
  }
}

/**
 * Validates a portal access token.
 * Throws TokenInvalidError if token is null/undefined.
 * Throws TokenExpiredError if validUntil is in the past.
 */
export function validateToken(
  token: string | null | undefined,
  validUntil: string | null,
): void {
  if (!token) {
    throw new TokenInvalidError();
  }
  if (validUntil && new Date(validUntil) < new Date()) {
    throw new TokenExpiredError();
  }
}

export interface AcceptanceUpdate {
  status: 'aceite';
  accepted_at: string;
  should_convert: true;
}

/**
 * Builds the DB update payload when a client accepts a quote.
 * Always sets should_convert = true to trigger the conversion flow.
 */
export function buildAcceptanceUpdate(acceptedOptionals: string[]): AcceptanceUpdate {
  void acceptedOptionals; // reserved for optional items tracking
  return {
    status: 'aceite',
    accepted_at: new Date().toISOString(),
    should_convert: true,
  };
}

export interface RejectionUpdate {
  status: 'rejeitado';
  rejected_at: string;
  rejection_reason: string;
}

/**
 * Builds the DB update payload when a client rejects a quote.
 * Throws ValidationError if reason is empty.
 */
export function buildRejectionUpdate(reason: string | undefined): RejectionUpdate {
  if (!reason || reason.trim().length === 0) {
    throw new ValidationError('Motivo de rejeição é obrigatório');
  }
  return {
    status: 'rejeitado',
    rejected_at: new Date().toISOString(),
    rejection_reason: reason.trim(),
  };
}

export interface PortalOpenUpdate {
  portal_open_count: number;
  portal_opened_at: string | null;
  should_notify: boolean;
}

/**
 * Builds the DB update payload for a portal open event.
 * Notifies partner+admin only on first open (currentCount === 0).
 * Sets portal_opened_at only on first open.
 */
export function buildPortalOpenUpdate(currentCount: number): PortalOpenUpdate {
  const isFirstOpen = currentCount === 0;
  return {
    portal_open_count: currentCount + 1,
    portal_opened_at: isFirstOpen ? new Date().toISOString() : null,
    should_notify: isFirstOpen,
  };
}
