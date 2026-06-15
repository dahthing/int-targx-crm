import { describe, it, expect } from 'vitest';
import {
  validateToken,
  buildAcceptanceUpdate,
  buildRejectionUpdate,
  buildPortalOpenUpdate,
  TokenInvalidError,
  TokenExpiredError,
  ValidationError,
} from '../client-portal.functions';

// ── TIQS-041: invalid token throws 401 ──────────────────────────────────────
describe('TIQS-041: invalid token throws TokenInvalidError', () => {
  it('throws when token is null', () => {
    expect(() => validateToken(null, null)).toThrow(TokenInvalidError);
  });

  it('throws when token is undefined', () => {
    expect(() => validateToken(undefined, null)).toThrow(TokenInvalidError);
  });

  it('throws when token is empty string', () => {
    expect(() => validateToken('', null)).toThrow(TokenInvalidError);
  });

  it('does not throw when token is valid and no expiry', () => {
    expect(() => validateToken('valid-token-abc', null)).not.toThrow();
  });
});

// ── TIQS-042: expired token throws 410 ───────────────────────────────────────
describe('TIQS-042: expired token throws TokenExpiredError', () => {
  it('throws when validUntil is in the past', () => {
    const past = new Date(Date.now() - 86_400_000).toISOString(); // yesterday
    expect(() => validateToken('valid-token', past)).toThrow(TokenExpiredError);
  });

  it('does not throw when validUntil is in the future', () => {
    const future = new Date(Date.now() + 86_400_000).toISOString(); // tomorrow
    expect(() => validateToken('valid-token', future)).not.toThrow();
  });
});

// ── TIQS-043: acceptance updates status and accepted_at ──────────────────────
describe('TIQS-043: acceptance update', () => {
  it('sets status to aceite and accepted_at to now', () => {
    const before = Date.now();
    const update = buildAcceptanceUpdate([]);
    const after = Date.now();

    expect(update.status).toBe('aceite');
    const acceptedTime = new Date(update.accepted_at).getTime();
    expect(acceptedTime).toBeGreaterThanOrEqual(before);
    expect(acceptedTime).toBeLessThanOrEqual(after);
  });
});

// ── TIQS-044: rejection without reason throws; with reason accepted ───────────
describe('TIQS-044: rejection validation', () => {
  it('throws ValidationError when reason is empty', () => {
    expect(() => buildRejectionUpdate(undefined)).toThrow(ValidationError);
  });

  it('throws ValidationError when reason is empty string', () => {
    expect(() => buildRejectionUpdate('')).toThrow(ValidationError);
  });

  it('throws ValidationError when reason is whitespace only', () => {
    expect(() => buildRejectionUpdate('   ')).toThrow(ValidationError);
  });

  it('returns rejection update when reason is provided', () => {
    const update = buildRejectionUpdate('Preço acima do orçamento');
    expect(update.status).toBe('rejeitado');
    expect(update.rejection_reason).toBe('Preço acima do orçamento');
    expect(update.rejected_at).toBeTruthy();
  });
});

// ── TIQS-045: accepting optional items before final acceptance ────────────────
describe('TIQS-045: accept optional items', () => {
  it('builds acceptance update that includes conversion trigger', () => {
    const update = buildAcceptanceUpdate(['item-1', 'item-2']);
    expect(update.should_convert).toBe(true);
  });
});

// ── TIQS-046: acceptance triggers conversion ─────────────────────────────────
describe('TIQS-046: acceptance returns should_convert flag', () => {
  it('always returns should_convert = true', () => {
    const update = buildAcceptanceUpdate([]);
    expect(update.should_convert).toBe(true);
  });
});

// ── TIQS-047: first open registers portal_opened_at and notifies ─────────────
describe('TIQS-047: portal open tracking', () => {
  it('first open sets portal_opened_at and should_notify=true', () => {
    const before = Date.now();
    const update = buildPortalOpenUpdate(0);
    const after = Date.now();

    expect(update.should_notify).toBe(true);
    expect(update.portal_open_count).toBe(1);
    const openedTime = new Date(update.portal_opened_at!).getTime();
    expect(openedTime).toBeGreaterThanOrEqual(before);
    expect(openedTime).toBeLessThanOrEqual(after);
  });

  it('subsequent opens do not notify and portal_opened_at is null', () => {
    const update = buildPortalOpenUpdate(3);
    expect(update.should_notify).toBe(false);
    expect(update.portal_open_count).toBe(4);
    expect(update.portal_opened_at).toBeNull();
  });
});
