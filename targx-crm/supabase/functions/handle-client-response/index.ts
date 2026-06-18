import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

type ClientAction = 'aceite' | 'rejeitado';

interface QuoteRow {
  id: string;
  title: string;
  version: number;
  rejection_reason: string | null;
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
    const { quoteId, action } = await req.json() as {
      quoteId: string;
      action: ClientAction;
    };

    if (!quoteId || !action) {
      return new Response(
        JSON.stringify({ error: 'quoteId and action are required' }),
        { status: 400 },
      );
    }

    if (action !== 'aceite' && action !== 'rejeitado') {
      return new Response(
        JSON.stringify({ error: 'action must be "aceite" or "rejeitado"' }),
        { status: 400 },
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@targx.com';

    // 1. Fetch quote + partner + client
    const { data: quoteData, error: quoteError } = await supabase
      .from('quotes')
      .select('id, title, version, rejection_reason, client_id, partner_id')
      .eq('id', quoteId)
      .single();

    if (quoteError || !quoteData) {
      return new Response(JSON.stringify({ error: 'Quote not found' }), { status: 404 });
    }

    const quote = quoteData as QuoteRow;

    const { data: partnerData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('id', quote.partner_id)
      .single();

    const { data: adminsData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'admin')
      .eq('active', true);

    const { data: clientData } = await supabase
      .from('clients')
      .select('id, name')
      .eq('id', quote.client_id)
      .single();

    const partner = partnerData as ProfileRow | null;
    const admins = (adminsData as ProfileRow[]) ?? [];
    const client = clientData as ClientRow | null;

    const isAccepted = action === 'aceite';
    const subjectLabel = isAccepted ? 'ACEITE' : 'REJEITADO';
    const bodyText = isAccepted
      ? `O cliente <strong>${client?.name ?? 'desconhecido'}</strong> aceitou o orçamento <strong>${quote.title} (v${quote.version})</strong>. Por favor, inicie o processo de conversão para projecto.`
      : `O cliente <strong>${client?.name ?? 'desconhecido'}</strong> rejeitou o orçamento <strong>${quote.title} (v${quote.version})</strong>.${quote.rejection_reason ? `<br/><br/>Motivo: <em>${quote.rejection_reason}</em>` : ''}`;

    // 2. Determine recipients: partner + admins if accepted
    const recipients: string[] = [];
    if (partner?.email) recipients.push(partner.email);

    if (isAccepted) {
      for (const admin of admins) {
        if (admin.email && !recipients.includes(admin.email)) {
          recipients.push(admin.email);
        }
      }
    }

    // 3. Send email to each recipient
    if (!resendApiKey) {
      console.warn('[handle-client-response] RESEND_API_KEY not set — skipping emails');
    } else {
      for (const recipient of recipients) {
        const emailRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [recipient],
            subject: `Orçamento ${subjectLabel} — ${quote.title} (v${quote.version})`,
            html: `
              <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                <h2 style="color: ${isAccepted ? '#0D9488' : '#DC2626'}; margin-bottom: 8px;">
                  Orçamento ${subjectLabel}
                </h2>
                <p style="color: #4B5563;">${bodyText}</p>
                <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                <p style="color: #9CA3AF; font-size: 12px;">TargX CRM — Notificação automática</p>
              </div>
            `,
          }),
        });

        if (!emailRes.ok) {
          const body = await emailRes.text();
          console.error(`[handle-client-response] Resend error for ${recipient}:`, body);
        }
      }
    }

    // 4. Insert into portal_access_log
    const ipAddress = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? null;
    const userAgent = req.headers.get('user-agent') ?? null;

    const { error: accessLogError } = await supabase.from('portal_access_log').insert({
      quote_id: quoteId,
      action: action === 'aceite' ? 'accept' : 'reject',
      ip_address: ipAddress,
      user_agent: userAgent,
      metadata: {
        rejection_reason: action === 'rejeitado' ? quote.rejection_reason : null,
        recipients,
      },
    });

    if (accessLogError) {
      console.error('[handle-client-response] Failed to insert portal_access_log:', accessLogError.message);
    }

    // 5. Log in email_logs
    const eventKey = `client_response_${quoteId}`;
    const { error: logError } = await supabase.from('email_logs').insert({
      event_key: eventKey,
      email_type: `quote_${action}`,
      quote_id: quoteId,
      sent_at: new Date().toISOString(),
    });

    if (logError) {
      console.error('[handle-client-response] Failed to insert email_log:', logError.message);
    }

    return new Response(
      JSON.stringify({ success: true, action, recipients }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[handle-client-response] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
