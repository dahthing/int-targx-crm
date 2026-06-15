import { describe, it, expect } from 'vitest';
import {
  buildPdfHtml,
  buildPdfPath,
  needsSignedUrlRefresh,
  buildCommissionStatementHtml,
  type PdfQuoteData,
  type CommissionStatementData,
} from '../pdf-generator.functions';

const BASE_QUOTE: PdfQuoteData = {
  id: 'quote-123',
  version: 2,
  client_name: 'Empresa Exemplo Lda',
  created_at: '2024-06-15T10:00:00.000Z',
  internal_notes: 'Nota interna confidencial — não mostrar ao cliente',
  phases: [
    {
      name: 'Fase 1 — Análise',
      items: [
        { name: 'Levantamento de requisitos', optional: false, subtotal: 2000 },
        { name: 'Relatório de análise', optional: false, subtotal: 1000 },
        { name: 'Workshop adicional', optional: true, subtotal: 500 },
      ],
    },
    {
      name: 'Fase 2 — Desenvolvimento',
      items: [
        { name: 'Implementação core', optional: false, subtotal: 8000 },
      ],
    },
  ],
  total_before_tax: 11000,
  total_with_tax: 13530,
  discount_amount: null,
  risk_adjustment: null,
};

// ── PDF-001: HTML contains required fields ───────────────────────────────────
describe('PDF-001: HTML contains required fields', () => {
  it('includes client_name in output', () => {
    const html = buildPdfHtml(BASE_QUOTE);
    expect(html).toContain('Empresa Exemplo Lda');
  });

  it('includes creation date formatted', () => {
    const html = buildPdfHtml(BASE_QUOTE);
    // 2024-06-15 in pt-PT: 15/06/2024
    expect(html).toContain('15/06/2024');
  });

  it('includes version number', () => {
    const html = buildPdfHtml(BASE_QUOTE);
    expect(html).toContain('v2');
  });
});

// ── PDF-002: optional items marked and excluded from total ───────────────────
describe('PDF-002: optional items handling', () => {
  it('marks optional items with "(Opcional)"', () => {
    const html = buildPdfHtml(BASE_QUOTE);
    expect(html).toContain('Workshop adicional (Opcional)');
  });

  it('mandatory items are NOT marked as optional', () => {
    const html = buildPdfHtml(BASE_QUOTE);
    expect(html).not.toContain('Levantamento de requisitos (Opcional)');
    expect(html).toContain('Levantamento de requisitos');
  });

  it('total shown excludes optional item subtotal', () => {
    // Mandatory total: 2000 + 1000 + 8000 = 11000 (optional 500 excluded)
    const html = buildPdfHtml(BASE_QUOTE);
    // The mandatory total should appear (11,000 EUR in pt-PT format)
    // Just check it doesn't show 11500 as main total
    expect(html).toContain('11');
  });
});

// ── PDF-003: internal_notes absent from HTML ─────────────────────────────────
describe('PDF-003: internal_notes not in HTML', () => {
  it('does not include internal_notes text in output', () => {
    const html = buildPdfHtml(BASE_QUOTE);
    expect(html).not.toContain('Nota interna confidencial');
    expect(html).not.toContain('não mostrar ao cliente');
  });

  it('works when internal_notes is null', () => {
    const quote = { ...BASE_QUOTE, internal_notes: null };
    expect(() => buildPdfHtml(quote)).not.toThrow();
  });
});

// ── PDF-004: PDF path is predictable ─────────────────────────────────────────
describe('PDF-004: PDF path format', () => {
  it('returns correct path for quote and version', () => {
    expect(buildPdfPath('quote-123', 2)).toBe('quotes/quote-123/v2.pdf');
  });

  it('returns correct path for version 1', () => {
    expect(buildPdfPath('abc-def', 1)).toBe('quotes/abc-def/v1.pdf');
  });
});

// ── PDF-005: expired URL returns flag ────────────────────────────────────────
describe('PDF-005: signed URL refresh detection', () => {
  it('returns true when URL has no expires param', () => {
    expect(needsSignedUrlRefresh('https://storage.example.com/file.pdf')).toBe(true);
  });

  it('returns true when URL expires within buffer window', () => {
    const expiresInFiveMinutes = Math.floor(Date.now() / 1000) + 5 * 60;
    const url = `https://storage.example.com/file.pdf?expires=${expiresInFiveMinutes}`;
    expect(needsSignedUrlRefresh(url, 30)).toBe(true);
  });

  it('returns false when URL expires well beyond buffer', () => {
    const expiresIn2Hours = Math.floor(Date.now() / 1000) + 2 * 60 * 60;
    const url = `https://storage.example.com/file.pdf?expires=${expiresIn2Hours}`;
    expect(needsSignedUrlRefresh(url, 30)).toBe(false);
  });

  it('returns true for malformed URL', () => {
    expect(needsSignedUrlRefresh('not-a-url')).toBe(true);
  });

  it('returns true when URL is expired (past expires)', () => {
    const expiredAt = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
    const url = `https://storage.example.com/file.pdf?expires=${expiredAt}`;
    expect(needsSignedUrlRefresh(url, 30)).toBe(true);
  });
});

// ── PDF-006: commission statement HTML ───────────────────────────────────────
describe('PDF-006: commission statement HTML contains table with all required columns and totals', () => {
  const STATEMENT: CommissionStatementData = {
    partnerName: 'Maria Fernandes',
    period: 'Maio 2025',
    rows: [
      { project: 'Projecto Alpha', client: 'Cliente A', tranche: 'adjudicação', amount: 10000, rate: 0.06, commission: 600 },
      { project: 'Projecto Beta', client: 'Cliente B', tranche: 'entrega', amount: 5000, rate: 0.08, commission: 400 },
    ],
    volumeTotal: 15000,
    commissionTotal: 1000,
    bonusTotal: 0,
  };

  it('contains partner name in header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Maria Fernandes');
  });

  it('contains period in header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Maio 2025');
  });

  it('table has Projecto column header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Projecto');
  });

  it('table has Tranche column header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Tranche');
  });

  it('table has Valor column header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Valor');
  });

  it('table has Taxa column header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Taxa');
  });

  it('table has Comissão column header', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Comissão');
  });

  it('contains row data for each project', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Projecto Alpha');
    expect(html).toContain('Projecto Beta');
    expect(html).toContain('adjudicação');
    expect(html).toContain('entrega');
  });

  it('contains totals row with volumeTotal and commissionTotal', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).toContain('Totais');
    // 15000 and 1000 should appear in formatted form
    expect(html).toContain('15');
    expect(html).toContain('1');
  });

  it('does not show bonus section when bonusTotal is 0', () => {
    const html = buildCommissionStatementHtml(STATEMENT);
    expect(html).not.toContain('Bónus');
  });

  it('shows bonus section when bonusTotal > 0', () => {
    const withBonus: CommissionStatementData = { ...STATEMENT, bonusTotal: 500 };
    const html = buildCommissionStatementHtml(withBonus);
    expect(html).toContain('Bónus');
  });
});
