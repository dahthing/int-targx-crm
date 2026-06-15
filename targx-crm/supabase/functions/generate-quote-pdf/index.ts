import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Types (inlined — cannot import from Angular)
// ---------------------------------------------------------------------------

interface QuotePhase {
  name: string;
  items: Array<{ name: string; optional: boolean; subtotal: number }>;
}

interface QuoteData {
  id: string;
  version: number;
  client_name: string;
  created_at: string;
  internal_notes: string | null;
  phases: QuotePhase[];
  total_before_tax: number;
  total_with_tax: number;
  discount_amount: number | null;
  risk_adjustment: number | null;
}

interface QuoteRow {
  id: string;
  version: number;
  created_at: string;
  internal_notes: string | null;
  total_before_tax: number | null;
  total_with_tax: number | null;
  discount_amount: number | null;
  risk_adjustment: number | null;
  client_id: string;
}

interface ClientRow {
  id: string;
  name: string;
}

interface PhaseRow {
  id: string;
  name: string;
  phase_order: number;
  quote_items: Array<{
    name: string;
    optional: boolean;
    hours: number | null;
    hourly_rate: number | null;
    unit_value: number | null;
    quantity: number;
    pricing_type: string;
  }>;
}

// ---------------------------------------------------------------------------
// HTML builder (inlined from pdf-generator.functions.ts)
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function buildPdfHtml(data: QuoteData): string {
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
    body { font-family: Inter, sans-serif; color: #1a202c; margin: 40px; }
    h1 { font-size: 24px; color: #0F2044; }
    .meta { color: #718096; font-size: 14px; margin-bottom: 32px; }
    .phase { margin-bottom: 24px; }
    h3 { color: #0F2044; font-size: 16px; border-bottom: 2px solid #0D9488; padding-bottom: 4px; }
    .items { width: 100%; border-collapse: collapse; }
    .items td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .amount { text-align: right; font-family: 'JetBrains Mono', monospace; }
    .optional { color: #718096; font-style: italic; }
    .totals { margin-top: 32px; text-align: right; border-top: 2px solid #0F2044; padding-top: 16px; }
    .totals p { margin: 4px 0; }
    .footer { margin-top: 48px; font-size: 12px; color: #a0aec0; border-top: 1px solid #e2e8f0; padding-top: 16px; }
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
      <p><strong>Total com IVA: ${formatCurrency(data.total_with_tax)}</strong></p>
    </div>
  </main>

  <footer class="footer">
    <p>Esta proposta é válida por 30 dias a partir da data de emissão.</p>
    <p>TargX CRM — gerado automaticamente</p>
  </footer>
</body>
</html>`;
}

function buildPdfPath(quoteId: string, version: number): string {
  return `quotes/${quoteId}/v${version}.pdf`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  try {
    const { quoteId } = await req.json() as { quoteId: string };

    if (!quoteId) {
      return new Response(JSON.stringify({ error: 'quoteId is required' }), { status: 400 });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fetch quote
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('id, version, created_at, internal_notes, total_before_tax, total_with_tax, discount_amount, risk_adjustment, client_id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quoteData) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 });
    }

    const quote = quoteData as QuoteRow;

    // 2. Fetch client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', quote.client_id)
      .single();

    if (clientError || !clientData) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    const client = clientData as ClientRow;

    // 3. Fetch phases with items
    const { data: phasesData, error: phasesError } = await supabase
      .from('quote_phases')
      .select('id, name, phase_order, quote_items(name, optional, hours, hourly_rate, unit_value, quantity, pricing_type)')
      .eq('quote_id', quoteId)
      .order('phase_order');

    if (phasesError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch phases' }), { status: 500 });
    }

    const phases: QuotePhase[] = ((phasesData ?? []) as PhaseRow[]).map((phase) => ({
      name: phase.name,
      items: phase.quote_items.map((item) => {
        let subtotal = 0;
        if (item.pricing_type === 'hourly') {
          subtotal = (item.hours ?? 0) * (item.hourly_rate ?? 0) * (item.quantity ?? 1);
        } else {
          subtotal = (item.unit_value ?? 0) * (item.quantity ?? 1);
        }
        return {
          name: item.name,
          optional: item.optional,
          subtotal,
        };
      }),
    }));

    // 4. Build HTML
    const htmlContent = buildPdfHtml({
      id: quote.id,
      version: quote.version,
      client_name: client.name,
      created_at: quote.created_at,
      internal_notes: quote.internal_notes,
      phases,
      total_before_tax: quote.total_before_tax ?? 0,
      total_with_tax: quote.total_with_tax ?? 0,
      discount_amount: quote.discount_amount,
      risk_adjustment: quote.risk_adjustment,
    });

    // 5. Generate PDF via Puppeteer
    // Deno-compatible Puppeteer import
    const { default: puppeteer } = await import('https://deno.land/x/puppeteer@16.2.0/mod.ts');

    const browser = await puppeteer.launch({
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
      executablePath: Deno.env.get('PUPPETEER_EXECUTABLE_PATH') ?? undefined,
    });

    const page = await browser.newPage();
    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });
    const pdfBuffer = await page.pdf({
      format: 'A4',
      margin: { top: '40px', right: '40px', bottom: '40px', left: '40px' },
      printBackground: true,
    });

    await browser.close();

    // 6. Upload to Supabase storage
    const storagePath = buildPdfPath(quote.id, quote.version);
    const { error: uploadError } = await supabase.storage
      .from('quotes')
      .upload(storagePath, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      console.error('[generate-quote-pdf] Upload error:', uploadError.message);
      return new Response(JSON.stringify({ error: 'Failed to upload PDF' }), { status: 500 });
    }

    // 7. Get signed URL (1 year expiry)
    const { data: signedData, error: signedError } = await supabase.storage
      .from('quotes')
      .createSignedUrl(storagePath, 365 * 24 * 60 * 60);

    if (signedError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: 'Failed to create signed URL' }), { status: 500 });
    }

    // 8. Update quote.pdf_url
    const { error: updateError } = await supabase
      .from('quotes')
      .update({
        pdf_url: signedData.signedUrl,
        updated_at: new Date().toISOString(),
      })
      .eq('id', quoteId);

    if (updateError) {
      console.error('[generate-quote-pdf] Failed to update pdf_url:', updateError.message);
    }

    return new Response(
      JSON.stringify({ pdfUrl: signedData.signedUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[generate-quote-pdf] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
