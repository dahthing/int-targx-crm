import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface GlobalSetting {
  key: string;
  value: string;
}

interface Lead {
  id: string;
  title: string;
  last_activity_at: string | null;
  silence_alerted: boolean;
  partner_id: string;
  status: string;
}

interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysSince(dateStr: string | null): number {
  if (!dateStr) return Infinity;
  const ms = Date.now() - new Date(dateStr).getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}_${String(now.getMonth() + 1).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (_req: Request): Promise<Response> => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const resendApiKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@targx.com';

  // -------------------------------------------------------------------------
  // 1. Load global settings
  // -------------------------------------------------------------------------
  const { data: settingsData, error: settingsError } = await supabase
    .from('global_settings')
    .select('key, value')
    .in('key', ['lead_silence_warning_days', 'lead_silence_alert_days']);

  if (settingsError) {
    console.error('[check-lead-silence] Failed to load global_settings:', settingsError.message);
    return new Response(JSON.stringify({ error: 'Failed to load settings' }), { status: 500 });
  }

  const settingsMap: Record<string, number> = {};
  for (const row of (settingsData as GlobalSetting[]) ?? []) {
    settingsMap[row.key] = Number(row.value);
  }

  const warningDays = settingsMap['lead_silence_warning_days'] ?? 14;
  const alertDays = settingsMap['lead_silence_alert_days'] ?? 21;

  // -------------------------------------------------------------------------
  // 2. Load non-closed leads
  // -------------------------------------------------------------------------
  const { data: leadsData, error: leadsError } = await supabase
    .from('leads')
    .select('id, title, last_activity_at, silence_alerted, partner_id, status')
    .not('status', 'in', '("closed_won","closed_lost")');

  if (leadsError) {
    console.error('[check-lead-silence] Failed to load leads:', leadsError.message);
    return new Response(JSON.stringify({ error: 'Failed to load leads' }), { status: 500 });
  }

  const leads = (leadsData as Lead[]) ?? [];
  if (leads.length === 0) {
    console.log('[check-lead-silence] No active leads found. Nothing to do.');
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  // -------------------------------------------------------------------------
  // 3. Load all relevant profiles (partners + admins)
  // -------------------------------------------------------------------------
  const partnerIds = [...new Set(leads.map(l => l.partner_id))];

  const { data: partnersData } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .in('id', partnerIds);

  const { data: adminsData } = await supabase
    .from('profiles')
    .select('id, email, full_name, role')
    .eq('role', 'admin')
    .eq('active', true);

  const partnerMap: Record<string, Profile> = {};
  for (const p of (partnersData as Profile[]) ?? []) {
    partnerMap[p.id] = p;
  }
  const adminEmails: string[] = ((adminsData as Profile[]) ?? []).map(a => a.email);

  // -------------------------------------------------------------------------
  // 4. Process each lead
  // -------------------------------------------------------------------------
  let emailsSent = 0;
  let errorsCount = 0;
  const yearMonth = currentYearMonth();

  for (const lead of leads) {
    const age = daysSince(lead.last_activity_at);

    if (age > alertDays && !lead.silence_alerted) {
      // -----------------------------------------------------------------------
      // Send alert email to partner + admins
      // -----------------------------------------------------------------------
      const partner = partnerMap[lead.partner_id];
      const recipients: string[] = [];
      if (partner?.email) recipients.push(partner.email);
      for (const adminEmail of adminEmails) {
        if (!recipients.includes(adminEmail)) recipients.push(adminEmail);
      }

      const eventKey = `silence_${lead.id}_${yearMonth}`;

      // Check deduplication — skip if already logged this month
      const { data: existingLog } = await supabase
        .from('email_logs')
        .select('id')
        .eq('event_key', eventKey)
        .maybeSingle();

      if (existingLog) {
        // Already sent this month — mark alerted without resending
        await supabase
          .from('leads')
          .update({ silence_alerted: true })
          .eq('id', lead.id);
        continue;
      }

      // Send email via Resend
      for (const recipient of recipients) {
        try {
          if (!resendApiKey) {
            console.warn('[check-lead-silence] RESEND_API_KEY not set — skipping email to', recipient);
            continue;
          }

          const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              from: fromEmail,
              to: [recipient],
              subject: `Lead sem actividade: ${lead.title}`,
              html: `
                <div style="font-family: Inter, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
                  <h2 style="color: #0F2044; margin-bottom: 8px;">Lead sem actividade</h2>
                  <p style="color: #4B5563;">
                    A lead <strong>${lead.title}</strong> está sem actividade há <strong>${age} dias</strong>.
                  </p>
                  <p style="color: #4B5563; margin-top: 16px;">
                    Por favor, actualiza o estado desta lead ou regista um novo contacto.
                  </p>
                  <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                  <p style="color: #9CA3AF; font-size: 12px;">
                    TargX CRM — Alerta automático
                  </p>
                </div>
              `,
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            console.error(`[check-lead-silence] Resend error for ${recipient}:`, body);
            errorsCount++;
          } else {
            emailsSent++;
          }
        } catch (emailErr) {
          // Log but don't throw — email failure must not crash the cron
          console.error('[check-lead-silence] Email send failed:', emailErr);
          errorsCount++;
        }
      }

      // Update silence_alerted flag
      const { error: updateError } = await supabase
        .from('leads')
        .update({ silence_alerted: true })
        .eq('id', lead.id);

      if (updateError) {
        console.error('[check-lead-silence] Failed to update silence_alerted for lead', lead.id, updateError.message);
      }

      // Log to email_logs for deduplication
      const { error: logError } = await supabase.from('email_logs').insert({
        event_key: eventKey,
        email_type: 'lead_silence_alert',
        lead_id: lead.id,
        sent_at: new Date().toISOString(),
      });

      if (logError) {
        console.error('[check-lead-silence] Failed to insert email_log for lead', lead.id, logError.message);
      }
    }
    // Note: leads in warning zone (warningDays < age <= alertDays) are intentionally not
    // emailed — they are surfaced via the dashboard silence indicators.
    // We don't need to update any flag here; the dashboard queries last_activity_at directly.
    else if (age > warningDays && age <= alertDays) {
      // Dashboard handles display — no action needed from this cron
    }
  }

  console.log(
    `[check-lead-silence] Done. leads=${leads.length} emailsSent=${emailsSent} errors=${errorsCount}`,
  );

  return new Response(
    JSON.stringify({ processed: leads.length, emailsSent, errors: errorsCount }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  );
});
