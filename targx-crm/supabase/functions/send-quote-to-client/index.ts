import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

interface QuoteRow {
  id: string;
  version: number;
  title: string;
  status: string;
  pdf_url: string | null;
  client_accept_token: string | null;
  token_expires_at: string | null;
  client_id: string;
  partner_id: string;
}

interface ClientRow {
  id: string;
  name: string;
  email: string | null;
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
    const portalBaseUrl = Deno.env.get('CLIENT_PORTAL_BASE_URL') ?? 'https://crm.targx.com/client/quotes';

    // 1. Fetch quote + client
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('id, version, title, status, pdf_url, client_accept_token, token_expires_at, client_id, partner_id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quoteData) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 });
    }

    const quote = quoteData as QuoteRow;

    // 2. Validate preconditions
    if (!quote.pdf_url) {
      return new Response(
        JSON.stringify({ error: 'Quote has no PDF — generate PDF first' }),
        { status: 422 },
      );
    }

    if (!quote.client_accept_token) {
      return new Response(
        JSON.stringify({ error: 'Quote has no portal token — transition to enviado_cliente first' }),
        { status: 422 },
      );
    }

    // 3. Fetch client
    const { data: clientData, error: clientError } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('id', quote.client_id)
      .single();

    if (clientError || !clientData) {
      return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 });
    }

    const client = clientData as ClientRow;

    if (!client.email) {
      return new Response(
        JSON.stringify({ error: 'Client has no email address' }),
        { status: 422 },
      );
    }

    const portalUrl = `${portalBaseUrl}/${quote.client_accept_token}`;
    const expiryDate = quote.token_expires_at
      ? new Date(quote.token_expires_at).toLocaleDateString('pt-PT')
      : null;

    // 4. Send email via Resend
    if (!resendApiKey) {
      console.warn('[send-quote-to-client] RESEND_API_KEY not set — skipping email');
    } else {
      const emailRes = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [client.email],
          subject: `Proposta Comercial — ${quote.title} (v${quote.version})`,
          html: `
            <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #ffffff;">
              <div style="background: #0F2044; padding: 24px; border-radius: 8px 8px 0 0;">
                <h1 style="color: #ffffff; margin: 0; font-size: 20px;">Proposta Comercial</h1>
              </div>
              <div style="padding: 24px; border: 1px solid #E5E7EB; border-top: none; border-radius: 0 0 8px 8px;">
                <p style="color: #374151;">Caro(a) <strong>${client.name}</strong>,</p>
                <p style="color: #374151;">
                  Temos o prazer de apresentar a nossa proposta comercial <strong>${quote.title} (v${quote.version})</strong>.
                </p>
                <p style="color: #374151;">Pode consultar e responder à proposta através do link abaixo:</p>
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${portalUrl}" style="background: #0D9488; color: #ffffff; padding: 14px 28px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
                    Ver Proposta
                  </a>
                </div>
                <p style="color: #374151;">Também pode aceder diretamente ao PDF:</p>
                <p style="margin: 8px 0;">
                  <a href="${quote.pdf_url}" style="color: #0D9488;">Descarregar PDF da Proposta</a>
                </p>
                ${expiryDate ? `<p style="color: #9CA3AF; font-size: 13px; margin-top: 24px;">Esta proposta é válida até <strong>${expiryDate}</strong>.</p>` : ''}
                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                <p style="color: #9CA3AF; font-size: 12px;">
                  TargX CRM — Este é um email automático. Para esclarecimentos, contacte o seu gestor de conta.
                </p>
              </div>
            </div>
          `,
        }),
      });

      if (!emailRes.ok) {
        const body = await emailRes.text();
        console.error('[send-quote-to-client] Resend error:', body);
        return new Response(JSON.stringify({ error: 'Failed to send email' }), { status: 500 });
      }
    }

    // 5. Log in email_logs
    const eventKey = `quote_sent_${quoteId}`;
    const { error: logError } = await supabase.from('email_logs').insert({
      event_key: eventKey,
      email_type: 'quote_sent',
      quote_id: quoteId,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('[send-quote-to-client] Failed to insert email_log:', logError.message);
    }

    // 6. Update quote status to 'enviado_cliente' if currently 'aprovado_interno'
    if (quote.status === 'aprovado_interno') {
      const { error: statusError } = await supabase
        .from('quotes')
        .update({
          status: 'enviado_cliente',
          sent_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', quoteId);

      if (statusError) {
        console.error('[send-quote-to-client] Failed to update status:', statusError.message);
      }
    }

    return new Response(
      JSON.stringify({ success: true, portalUrl }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[send-quote-to-client] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
