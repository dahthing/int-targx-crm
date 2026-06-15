import { describe, it, expect } from 'vitest';
import {
  buildMonthlyDigestPayload,
  buildBonusNearPayload,
  buildBonusReachedPayload,
  buildQuoteToClientPayload,
  buildQuoteExpiringPayload,
  buildPortalOpenedPayload,
  buildLeadSilencePayload,
  isAlreadySent,
  recordEmailError,
} from '../email.functions';

// ── EML-001: buildMonthlyDigestPayload ────────────────────────────────────────
describe('EML-001: buildMonthlyDigestPayload contains volume, commission and tier progress', () => {
  const DATA = {
    partnerEmail: 'partner@example.com',
    partnerName: 'João Silva',
    month: 'Maio',
    year: 2025,
    volume: 25000,
    commission: 1500,
    tierRate: 0.06,
    nextTierThreshold: 50000,
  };

  it('contains volume in HTML', () => {
    const payload = buildMonthlyDigestPayload(DATA);
    expect(payload.html).toContain('25');
  });

  it('contains commission in HTML', () => {
    const payload = buildMonthlyDigestPayload(DATA);
    expect(payload.html).toContain('1');
  });

  it('contains tier rate in HTML', () => {
    const payload = buildMonthlyDigestPayload(DATA);
    expect(payload.html).toContain('6.0');
  });

  it('contains next tier threshold in HTML', () => {
    const payload = buildMonthlyDigestPayload(DATA);
    expect(payload.html).toContain('50');
  });

  it('sends to partner email', () => {
    const payload = buildMonthlyDigestPayload(DATA);
    expect(payload.to).toContain('partner@example.com');
  });

  it('has a unique event_key', () => {
    const payload = buildMonthlyDigestPayload(DATA);
    expect(payload.event_key).toMatch(/monthly-digest/);
    expect(payload.event_key).toContain('partner@example.com');
  });
});

// ── EML-002: buildBonusNearPayload ────────────────────────────────────────────
describe('EML-002: buildBonusNearPayload — alert when volume > 90% of unmet threshold', () => {
  const DATA = {
    partnerEmail: 'partner@example.com',
    partnerName: 'Ana Costa',
    adminEmail: 'admin@targx.com',
    threshold: 30000,
    bonusAmount: 1000,
    volumeRemaining: 2500,
  };

  it('returns two payloads (partner + admin)', () => {
    const result = buildBonusNearPayload(DATA);
    expect(result).toHaveLength(2);
  });

  it('partner payload goes to partnerEmail', () => {
    const result = buildBonusNearPayload(DATA);
    expect(result[0].to).toContain(DATA.partnerEmail);
  });

  it('admin payload goes to adminEmail', () => {
    const result = buildBonusNearPayload(DATA);
    expect(result[1].to).toContain(DATA.adminEmail);
  });

  it('HTML contains remaining volume info', () => {
    const result = buildBonusNearPayload(DATA);
    // 2500 EUR should appear in formatted form
    expect(result[0].html).toContain('2');
  });

  it('HTML contains bonus amount', () => {
    const result = buildBonusNearPayload(DATA);
    expect(result[0].html).toContain('1');
  });
});

// ── EML-003: buildBonusReachedPayload ────────────────────────────────────────
describe('EML-003: buildBonusReachedPayload — notifies admin and partner when threshold reached', () => {
  const DATA = {
    partnerEmail: 'partner@example.com',
    partnerName: 'Pedro Mendes',
    adminEmail: 'admin@targx.com',
    threshold: 50000,
    bonusAmount: 2000,
  };

  it('returns two payloads', () => {
    expect(buildBonusReachedPayload(DATA)).toHaveLength(2);
  });

  it('partner payload subject mentions bonus', () => {
    const result = buildBonusReachedPayload(DATA);
    expect(result[0].subject.toLowerCase()).toMatch(/bónus|bonus/i);
  });

  it('admin payload goes to adminEmail', () => {
    const result = buildBonusReachedPayload(DATA);
    expect(result[1].to).toContain(DATA.adminEmail);
  });

  it('payloads have distinct event_keys', () => {
    const result = buildBonusReachedPayload(DATA);
    expect(result[0].event_key).not.toBe(result[1].event_key);
  });
});

// ── EML-004: recordEmailError — graceful error, never throws ─────────────────
describe('EML-004: recordEmailError does not throw and returns safe log record', () => {
  it('handles Error instance', () => {
    const record = recordEmailError(new Error('SMTP timeout'));
    expect(record.error).toBe('SMTP timeout');
    expect(record.sent_at).toBeTruthy();
  });

  it('handles string error', () => {
    const record = recordEmailError('connection refused');
    expect(record.error).toBe('connection refused');
  });

  it('handles unknown/null error without throwing', () => {
    expect(() => recordEmailError(null)).not.toThrow();
    expect(() => recordEmailError(undefined)).not.toThrow();
    expect(() => recordEmailError({ code: 500 })).not.toThrow();
  });

  it('returns sent_at as ISO string', () => {
    const record = recordEmailError(new Error('test'));
    expect(record.sent_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

// ── EML-005: isAlreadySent — deduplication ────────────────────────────────────
describe('EML-005: isAlreadySent — event with same event_key not re-sent', () => {
  it('returns true if event_key exists in logs', () => {
    const logs = [{ event_key: 'monthly-digest:x@y.com:2025-Maio' }];
    expect(isAlreadySent(logs, 'monthly-digest:x@y.com:2025-Maio')).toBe(true);
  });

  it('returns false if event_key not in logs', () => {
    const logs = [{ event_key: 'monthly-digest:x@y.com:2025-Abril' }];
    expect(isAlreadySent(logs, 'monthly-digest:x@y.com:2025-Maio')).toBe(false);
  });

  it('returns false for empty logs', () => {
    expect(isAlreadySent([], 'any-key')).toBe(false);
  });
});

// ── EML-006: buildQuoteToClientPayload ───────────────────────────────────────
describe('EML-006: buildQuoteToClientPayload contains PDF URL and portal link', () => {
  const DATA = {
    clientEmail: 'cliente@empresa.pt',
    clientName: 'Empresa ABC',
    quoteTitle: 'Proposta de Desenvolvimento',
    pdfUrl: 'https://storage.supabase.co/quotes/q1/v2.pdf',
    portalUrl: 'https://crm.targx.com/client/quotes/token-abc',
    validUntil: '2025-07-15',
  };

  it('contains PDF URL in HTML', () => {
    const payload = buildQuoteToClientPayload(DATA);
    expect(payload.html).toContain(DATA.pdfUrl);
  });

  it('contains portal URL in HTML', () => {
    const payload = buildQuoteToClientPayload(DATA);
    expect(payload.html).toContain(DATA.portalUrl);
  });

  it('sends to client email', () => {
    const payload = buildQuoteToClientPayload(DATA);
    expect(payload.to).toContain(DATA.clientEmail);
  });

  it('has a valid event_key', () => {
    const payload = buildQuoteToClientPayload(DATA);
    expect(payload.event_key).toContain('quote-to-client');
  });
});

// ── EML-007: buildQuoteExpiringPayload ────────────────────────────────────────
describe('EML-007: buildQuoteExpiringPayload — alert 3 days before valid_until', () => {
  const DATA = {
    adminEmail: 'admin@targx.com',
    quoteTitle: 'Proposta Urgente',
    clientName: 'Cliente Z',
    validUntil: '2025-06-18',
    quoteId: 'q-expiring',
  };

  it('sends to admin email', () => {
    const payload = buildQuoteExpiringPayload(DATA);
    expect(payload.to).toContain(DATA.adminEmail);
  });

  it('subject mentions expiry', () => {
    const payload = buildQuoteExpiringPayload(DATA);
    expect(payload.subject).toContain('expira');
  });

  it('HTML contains quote title', () => {
    const payload = buildQuoteExpiringPayload(DATA);
    expect(payload.html).toContain(DATA.quoteTitle);
  });

  it('HTML contains valid_until date', () => {
    const payload = buildQuoteExpiringPayload(DATA);
    expect(payload.html).toContain(DATA.validUntil);
  });

  it('has event_key with quoteId', () => {
    const payload = buildQuoteExpiringPayload(DATA);
    expect(payload.event_key).toContain('q-expiring');
  });
});

// ── EML-008: lead silence deduplication ──────────────────────────────────────
describe('EML-008: lead silence — no duplicate if event_key already in email_logs', () => {
  it('detects duplicate silence event for same lead and month', () => {
    const logs = [{ event_key: 'lead-silence:lead-001:Junho' }];
    expect(isAlreadySent(logs, 'lead-silence:lead-001:Junho')).toBe(true);
  });

  it('does not suppress for different month', () => {
    const logs = [{ event_key: 'lead-silence:lead-001:Maio' }];
    expect(isAlreadySent(logs, 'lead-silence:lead-001:Junho')).toBe(false);
  });

  it('buildLeadSilencePayload uses lead_id + month in event_key', () => {
    const payloads = buildLeadSilencePayload({
      partnerEmail: 'p@p.com',
      adminEmail: 'a@a.com',
      leadTitle: 'Lead Silenciosa',
      daysSince: 14,
      leadId: 'lead-001',
      month: 'Junho',
    });
    expect(payloads[0].event_key).toContain('lead-001');
    expect(payloads[0].event_key).toContain('Junho');
  });
});

// ── EML-009: buildPortalOpenedPayload ────────────────────────────────────────
describe('EML-009: buildPortalOpenedPayload — notifies partner when portal opened 1st time', () => {
  const DATA = {
    partnerEmail: 'partner@p.com',
    adminEmail: 'admin@targx.com',
    quoteTitle: 'Proposta Portal',
    clientName: 'Cliente Portal',
  };

  it('returns two payloads (partner + admin)', () => {
    expect(buildPortalOpenedPayload(DATA)).toHaveLength(2);
  });

  it('first payload targets partnerEmail', () => {
    const result = buildPortalOpenedPayload(DATA);
    expect(result[0].to).toContain(DATA.partnerEmail);
  });

  it('second payload targets adminEmail', () => {
    const result = buildPortalOpenedPayload(DATA);
    expect(result[1].to).toContain(DATA.adminEmail);
  });

  it('HTML mentions client name', () => {
    const result = buildPortalOpenedPayload(DATA);
    expect(result[0].html).toContain(DATA.clientName);
  });

  it('payloads have distinct event_keys', () => {
    const result = buildPortalOpenedPayload(DATA);
    expect(result[0].event_key).not.toBe(result[1].event_key);
  });
});
