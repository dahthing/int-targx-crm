import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Cron: daily 09:00
// Handles near-expiry warnings and automatic expiration of sent quotes

interface QuoteRow {
  id: string;
  title: string;
  version: number;
  valid_until: string | null;
  partner_id: string;
  client_id: string;
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

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT');
}

function daysUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
}

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@targx.com';

  const now = new Date();
  const warningThreshold = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString(); // now + 3 days

  let emailsSent = 0;
  let expiredCount = 0;
  let errors = 0;

  try {
    // ---------------------------------------------------------------------------
    // 1. Fetch quotes expiring within 3 days (warning)
    // ---------------------------------------------------------------------------
    const { data: expiringData, error: expiringError } = await supabase
      .from('quotes')
      .select('id, title, version, valid_until, partner_id, client_id')
      .eq('status', 'enviado_cliente')
      .lte('valid_until', warningThreshold)
      .gt('valid_until', now.toISOString());

    if (expiringError) {
      console.error('[check-quote-expirations] Failed to fetch expiring quotes:', expiringError.message);
      return new Response(JSON.stringify({ error: 'Failed to fetch expiring quotes' }), { status: 500 });
    }

    const expiringQuotes = (expiringData ?? []) as QuoteRow[];

    // Load admin emails
    const { data: adminsData } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .eq('role', 'admin')
      .eq('active', true);

    const adminEmails: string[] = ((adminsData as ProfileRow[]) ?? []).map((a) => a.email).filter(Boolean);

    // Send expiry warning emails
    for (const quote of expiringQuotes) {
      const today = now.toISOString().slice(0, 10);
      const eventKey = `quote_expiring_${quote.id}_${today}`;

      // Deduplication check
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select('id')
        .eq('event_key', eventKey)
        .maybeSingle();

      if (existingLog) continue;

      // Fetch partner
      const { data: partnerData } = await supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('id', quote.partner_id)
        .single();

      const partner = partnerData as ProfileRow | null;

      // Fetch client
      const { data: clientData } = await supabase
        .from('clients')
        .select('id, name')
        .eq('id', quote.client_id)
        .single();

      const client = clientData as ClientRow | null;

      const daysLeft = quote.valid_until ? daysUntil(quote.valid_until) : 0;
      const validUntilStr = quote.valid_until ? formatDate(quote.valid_until) : 'desconhecida';

      const recipients: string[] = [];
      if (partner?.email) recipients.push(partner.email);
      for (const adminEmail of adminEmails) {
        if (!recipients.includes(adminEmail)) recipients.push(adminEmail);
      }

      if (resendApiKey) {
        for (const recipient of recipients) {
          try {
            const emailRes = await fetch('https://api.resend.com/emails', {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${resendApiKey}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                from: fromEmail,
                to: [recipient],
                subject: `Orçamento a expirar em ${daysLeft} dia(s) — ${quote.title} (v${quote.version})`,
                html: `
                  <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                    <h2 style="color: #B45309; margin-bottom: 8px;">Orçamento prestes a expirar</h2>
                    <p style="color: #4B5563;">
                      O orçamento <strong>${quote.title} (v${quote.version})</strong>
                      ${client ? `do cliente <strong>${client.name}</strong>` : ''}
                      expira em <strong>${daysLeft} dia(s)</strong> (${validUntilStr}).
                    </p>
                    <p style="color: #4B5563; margin-top: 16px;">
                      Por favor, acompanhe o cliente e verifique se é necessário renovar a proposta.
                    </p>
                    <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                    <p style="color: #9CA3AF; font-size: 12px;">TargX CRM — Alerta automático</p>
                  </div>
                `,
              }),
            });

            if (!emailRes.ok) {
              const body = await emailRes.text();
              console.error(`[check-quote-expirations] Resend error for ${recipient}:`, body);
              errors++;
            } else {
              emailsSent++;
            }
          } catch (emailErr) {
            console.error('[check-quote-expirations] Email send failed:', emailErr);
            errors++;
          }
        }
      }

      // Log deduplication entry
      const { error: logError } = await supabase.from('email_logs').insert({
        event_key: eventKey,
        email_type: 'quote_expiring_warning',
        quote_id: quote.id,
        sent_at: new Date().toISOString(),
      });

      if (logError) {
        console.error('[check-quote-expirations] Failed to insert email_log:', logError.message);
      }
    }

    // ---------------------------------------------------------------------------
    // 2. Fetch quotes that have already expired — mark as 'expirado'
    // ---------------------------------------------------------------------------
    const { data: expiredData, error: expiredError } = await supabase
      .from('quotes')
      .select('id')
      .eq('status', 'enviado_cliente')
      .lt('valid_until', now.toISOString());

    if (expiredError) {
      console.error('[check-quote-expirations] Failed to fetch expired quotes:', expiredError.message);
    } else if (expiredData && expiredData.length > 0) {
      const expiredIds = (expiredData as Array<{ id: string }>).map((q) => q.id);

      const { error: updateError } = await supabase
        .from('quotes')
        .update({
          status: 'expirado',
          updated_at: new Date().toISOString(),
        })
        .in('id', expiredIds);

      if (updateError) {
        console.error('[check-quote-expirations] Failed to update expired quotes:', updateError.message);
        errors++;
      } else {
        expiredCount = expiredIds.length;
        console.log(`[check-quote-expirations] Marked ${expiredCount} quotes as expirado`);
      }
    }

    console.log(
      `[check-quote-expirations] Done. warnings=${expiringQuotes.length} emailsSent=${emailsSent} expired=${expiredCount} errors=${errors}`,
    );

    return new Response(
      JSON.stringify({
        warnings: expiringQuotes.length,
        emailsSent,
        expired: expiredCount,
        errors,
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    console.error('[check-quote-expirations] Unexpected error:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    );
  }
});
