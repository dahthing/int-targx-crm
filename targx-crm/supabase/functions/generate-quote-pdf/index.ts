import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { renderTemplate, buildTemplateData } from './renderer.ts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuoteRow {
  id: string;
  version: number;
  title: string;
  description: string | null;
  created_at: string;
  internal_notes: string | null;
  total_before_tax: number | null;
  total_with_tax: number | null;
  discount_amount: number | null;
  risk_adjustment: number | null;
  payment_terms: string | null;
  valid_until: string | null;
  client_id: string;
  partner_id: string;
}

interface ClientRow {
  id: string;
  name: string;
  email?: string;
  company?: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
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

function buildPdfPath(quoteId: string, version: number): string {
  return `quotes/${quoteId}/v${version}.pdf`;
}

// Load template HTML from adjacent file (Deno reads relative to function dir)
async function loadTemplate(): Promise<string> {
  const url = new URL('./template.html', import.meta.url);
  return await Deno.readTextFile(url);
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
      .select('id, name, email, company')
      .eq('id', quote.client_id)
      .single();

    if (clientError || !clientData) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    const client = clientData as ClientRow;

    // 3. Fetch partner profile
    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', quote.partner_id)
      .single();

    const partner: ProfileRow = partnerData ?? {
      id: quote.partner_id,
      full_name: 'TargX',
      email: 'hello@targx.pt',
      role: 'partner',
    };

    // 4. Fetch phases with items
    const { data: phasesData, error: phasesError } = await supabase
      .from('quote_phases')
      .select('id, name, phase_order, quote_items(name, optional, hours, hourly_rate, unit_value, quantity, pricing_type)')
      .eq('quote_id', quoteId)
      .order('phase_order');

    if (phasesError) {
      return new Response(JSON.stringify({ error: 'Failed to fetch phases' }), { status: 500 });
    }

    const phases = (phasesData ?? []) as PhaseRow[];

    // 5. Build HTML from template
    const templateHtml = await loadTemplate();
    const templateData = buildTemplateData(quote as QuoteRow, client, partner, phases);
    const htmlContent = renderTemplate(templateHtml, templateData);

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
