export interface PdfQuoteData {
  id: string;
  version: number;
  client_name: string;
  created_at: string;
  internal_notes: string | null;
  phases: Array<{
    name: string;
    items: Array<{ name: string; optional: boolean; subtotal: number }>;
  }>;
  total_before_tax: number;
  total_with_tax: number;
  discount_amount: number | null;
  risk_adjustment: number | null;
}

/**
 * Formats a number as EUR currency string.
 */
function formatCurrency(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

/**
 * Builds the HTML string for a PDF quote.
 * - Contains client_name, creation date, and version number.
 * - Optional items marked with "(Opcional)" and excluded from main total.
 * - internal_notes are NEVER included in the output.
 */
export function buildPdfHtml(data: PdfQuoteData): string {
  const createdDate = new Date(data.created_at).toLocaleDateString('pt-PT');

  const mandatoryTotal = data.phases.reduce((sum, phase) => {
    return (
      sum +
      phase.items
        .filter((item) => !item.optional)
        .reduce((s, item) => s + item.subtotal, 0)
    );
  }, 0);

  const phasesHtml = data.phases
    .map((phase) => {
      const itemsHtml = phase.items
        .map((item) => {
          const label = item.optional ? `${item.name} (Opcional)` : item.name;
          return `<tr class="item${item.optional ? ' optional' : ''}">
          <td>${label}</td>
          <td class="amount">${formatCurrency(item.subtotal)}</td>
        </tr>`;
        })
        .join('\n');

      return `<section class="phase">
    <h3>${phase.name}</h3>
    <table class="items">
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>
  </section>`;
    })
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Proposta ${data.version} — ${data.client_name}</title>
  <style>
    body { font-family: Inter, sans-serif; color: #1a202c; }
    h1 { font-size: 24px; }
    .meta { color: #718096; font-size: 14px; }
    .phase { margin-bottom: 24px; }
    .items { width: 100%; border-collapse: collapse; }
    .items td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .amount { text-align: right; }
    .optional { color: #718096; font-style: italic; }
    .totals { margin-top: 32px; text-align: right; }
    .footer { margin-top: 48px; font-size: 12px; color: #a0aec0; }
  </style>
</head>
<body>
  <header>
    <h1>Proposta Comercial v${data.version}</h1>
    <div class="meta">
      <p>Cliente: <strong>${data.client_name}</strong></p>
      <p>Data: ${createdDate}</p>
      <p>Versão: ${data.version}</p>
    </div>
  </header>

  <main>
    ${phasesHtml}

    <div class="totals">
      <p>Total (sem IVA): <strong>${formatCurrency(mandatoryTotal)}</strong></p>
      ${data.discount_amount ? `<p>Desconto: -${formatCurrency(data.discount_amount)}</p>` : ''}
      ${data.risk_adjustment ? `<p>Ajuste de risco: ${formatCurrency(data.risk_adjustment)}</p>` : ''}
      <p>Total com IVA: <strong>${formatCurrency(data.total_with_tax)}</strong></p>
    </div>
  </main>

  <footer class="footer">
    <p>Esta proposta é válida por 30 dias a partir da data de emissão.</p>
  </footer>
</body>
</html>`;
}

/**
 * Returns the predictable storage path for a quote PDF.
 * Pattern: quotes/{quote_id}/v{version}.pdf
 */
export function buildPdfPath(quoteId: string, version: number): string {
  return `quotes/${quoteId}/v${version}.pdf`;
}

// ── Commission Statement (PDF-006) ────────────────────────────────────────────

export interface CommissionStatementData {
  partnerName: string;
  period: string;
  rows: Array<{
    project: string;
    client: string;
    tranche: string;
    amount: number;
    rate: number;
    commission: number;
  }>;
  volumeTotal: number;
  commissionTotal: number;
  bonusTotal: number;
}

/**
 * Builds HTML for a commission statement PDF.
 * Contains header (partnerName, period), detailed table (all rows), and totals row.
 */
export function buildCommissionStatementHtml(data: CommissionStatementData): string {
  const fmt = (v: number) =>
    v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });

  const rowsHtml = data.rows
    .map(
      (row) => `<tr>
      <td>${row.project}</td>
      <td>${row.client}</td>
      <td>${row.tranche}</td>
      <td class="amount">${fmt(row.amount)}</td>
      <td class="amount">${(row.rate * 100).toFixed(1)}%</td>
      <td class="amount">${fmt(row.commission)}</td>
    </tr>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt">
<head>
  <meta charset="UTF-8">
  <title>Extracto de Comissões — ${data.partnerName} — ${data.period}</title>
  <style>
    body { font-family: Inter, sans-serif; color: #1a202c; }
    h1 { font-size: 22px; }
    .meta { color: #718096; font-size: 14px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; text-align: left; }
    th { background: #f7fafc; font-weight: 600; }
    .amount { text-align: right; }
    .totals-row { font-weight: 700; background: #edf2f7; }
    .footer { margin-top: 48px; font-size: 12px; color: #a0aec0; }
  </style>
</head>
<body>
  <header>
    <h1>Extracto de Comissões</h1>
    <div class="meta">
      <p>Parceiro: <strong>${data.partnerName}</strong></p>
      <p>Período: ${data.period}</p>
    </div>
  </header>
  <main>
    <table>
      <thead>
        <tr>
          <th>Projecto</th>
          <th>Cliente</th>
          <th>Tranche</th>
          <th class="amount">Valor</th>
          <th class="amount">Taxa</th>
          <th class="amount">Comissão</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
        <tr class="totals-row">
          <td colspan="3">Totais</td>
          <td class="amount">${fmt(data.volumeTotal)}</td>
          <td class="amount">—</td>
          <td class="amount">${fmt(data.commissionTotal)}</td>
        </tr>
      </tbody>
    </table>
    ${data.bonusTotal > 0 ? `<p style="margin-top:16px">Bónus: <strong>${fmt(data.bonusTotal)}</strong></p>` : ''}
  </main>
  <footer class="footer">
    <p>Documento gerado automaticamente pelo TargX CRM.</p>
  </footer>
</body>
</html>`;
}

/**
 * Checks if a signed URL needs to be refreshed.
 * Returns true if the URL expires within bufferMinutes (default 30).
 * Returns true conservatively if no expiry param is found.
 */
export function needsSignedUrlRefresh(pdfUrl: string, bufferMinutes = 30): boolean {
  try {
    const url = new URL(pdfUrl);
    const expires = url.searchParams.get('expires');
    if (!expires) return true;

    const expiresAt = new Date(Number(expires) * 1000); // Unix timestamp
    const threshold = new Date(Date.now() + bufferMinutes * 60 * 1000);
    return expiresAt < threshold;
  } catch {
    return true;
  }
}
