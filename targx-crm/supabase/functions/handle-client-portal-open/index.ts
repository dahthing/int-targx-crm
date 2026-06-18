import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface QuoteRow {
  id: string;
  title: string;
  version: number;
  portal_open_count: number;
  client_id: string;
  partner_id: string;
}

interface ProfileRow {
  id: string;
  full_name: string;
  email: string;
  role: string;
}

interface ClientRow {
  id: string;
  name: string;
}

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

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@targx.com';

    // 1. Fetch quote
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('id, title, version, portal_open_count, client_id, partner_id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quoteData) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 });
    }

    const quote = quoteData as QuoteRow;

    // Always log the access; only send email on first open
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
    const userAgent = req.headers.get('user-agent') ?? null;

    const { error: earlyLogError } = await supabase.from('portal_access_log').insert({
      quote_id: quoteId,
      action: 'open',
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: { open_count: quote.portal_open_count },
    });

    if (earlyLogError) {
      console.error('[handle-client-portal-open] Failed to insert portal_access_log:', earlyLogError.message);
    }

    if (quote.portal_open_count !== 1) {
      return new Response(
        JSON.stringify({ logged: true, skipped_email: true, reason: 'Not first open' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // Check deduplication for email
    const eventKey = `portal_opened_${quoteId}`;
    const { data: existingLog } = await supabase
      .from('email_logs')
      .select('id')
      .eq('event_key', eventKey)
      .maybeSingle();

    if (existingLog) {
      return new Response(
        JSON.stringify({ skipped: true, reason: 'Already notified' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    }

    // 2. Fetch partner and client
    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', quote.partner_id)
      .single();

    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', quote.client_id)
      .single();

    const partner = partnerData as ProfileRow | null;
    const client = clientData as ClientRow | null;

    if (!partner?.email) {
      return new Response(
        JSON.stringify({ error: 'Partner not found or has no email' }),
        { status: 422 },
      );
    }

    // 3. Send notification email to partner
    if (!resendApiKey) {
      console.warn('[handle-client-portal-open] RESEND_API_KEY not set — skipping email');
    } else {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [partner.email],
          subject: `Cliente abriu o orçamento — ${quote.title} (v${quote.version})`,
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
              <h2 style="color: #0F2044; margin-bottom: 8px;">Orçamento aberto pelo cliente</h2>
              <p style="color: #4B5563;">
                O cliente <strong>${client?.name ?? 'desconhecido'}</strong> acabou de abrir o orçamento
                <strong>${quote.title} (v${quote.version})</strong> pela primeira vez.
              </p>
              <p style="color: #4B5563; margin-top: 16px;">
                É um bom momento para entrar em contacto.
              </p>
              <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
              <p style="color: #9CA3AF; font-size: 12px;">TargX CRM — Alerta automático</p>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const body = await emailRes.text();
        console.error('[handle-client-portal-open] Resend error:', body);
      }
    }

    // 4. Insert into email_logs
    const { error: logError } = await supabase.from('email_logs').insert({
      event_key: eventKey,
      email_type: 'portal_opened',
      quote_id: quoteId,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('[handle-client-portal-open] Failed to insert email_log:', logError.message);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[handle-client-portal-open] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
