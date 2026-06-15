// Cron: 1st of each month at 08:00
// Sends monthly commission digest email to all active partners

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function fmt(v: number): string {
  return v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function buildMonthlyDigestHtml(data: {
  partnerName: string;
  month: string;
  year: number;
  volume: number;
  commission: number;
  tierRate: number;
  nextTierThreshold: number | null;
}): string {
  const tierPct = (data.tierRate * 100).toFixed(1);
  const nextTierLine = data.nextTierThreshold
    ? `<p>Próximo patamar: ${fmt(data.nextTierThreshold)}</p>`
    : `<p>Atingiste o patamar máximo!</p>`;

  return `<h2>Resumo de ${data.month}/${data.year}</h2>
<p>Olá ${data.partnerName},</p>
<p>Volume: <strong>${fmt(data.volume)}</strong></p>
<p>Comissão: <strong>${fmt(data.commission)}</strong></p>
<p>Taxa de patamar actual: <strong>${tierPct}%</strong></p>
${nextTierLine}`;
}

serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const resendApiKey = Deno.env.get('RESEND_API_KEY')!;
    const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') ?? 'hello@targx.com';

    // Determine last month
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const monthInt = lastMonth.getMonth() + 1;
    const monthStr = String(monthInt).padStart(2, '0');
    const month = `${year}-${monthStr}`;
    const monthStart = `${month}-01`;
    const nextMonthDate = new Date(year, monthInt, 1);
    const nextMonthStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

    // 1. Get all active partners
    const { data: partners, error: partnersError } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('role', 'partner')
      .eq('active', true);

    if (partnersError) throw new Error(`Partners fetch: ${partnersError.message}`);

    const results: Array<{ partnerId: string; status: string; error?: string }> = [];

    for (const partner of partners ?? []) {
      const p = partner as { id: string; full_name: string; email: string };

      try {
        // 2. Fetch last month's commissions
        const { data: commissions } = await supabase
          .from('commissions')
          .select('tranche_amount, commission_amount, rate_percent')
          .eq('partner_id', p.id)
          .gte('created_at', monthStart)
          .lt('created_at', nextMonthStr);

        const volume = (commissions ?? []).reduce(
          (sum: number, c: { tranche_amount: number }) => sum + c.tranche_amount,
          0,
        );
        const commission = (commissions ?? []).reduce(
          (sum: number, c: { commission_amount: number }) => sum + c.commission_amount,
          0,
        );
        const tierRate = (commissions ?? [])[0]
          ? ((commissions![0] as { rate_percent: number }).rate_percent / 100)
          : 0;

        // Fetch partner plan for next tier
        const { data: partnerPlan } = await supabase
          .from('partner_plans')
          .select('plan_id')
          .eq('partner_id', p.id)
          .is('active_to', null)
          .single();

        let nextTierThreshold: number | null = null;

        if (partnerPlan) {
          // Get year-to-date volume
          const yearStart = `${year}-01-01`;
          const yearEnd = `${year + 1}-01-01`;

          const { data: ytdRows } = await supabase
            .from('project_tranches')
            .select('amount, projects!inner(partner_id, contract_date)')
            .eq('received', true)
            .eq('projects.partner_id', p.id)
            .gte('received_date', yearStart)
            .lt('received_date', yearEnd);

          const ytdVolume = (ytdRows ?? []).reduce(
            (sum: number, r: { amount: number }) => sum + r.amount,
            0,
          );

          const { data: tiers } = await supabase
            .from('commission_tiers')
            .select('volume_from, volume_to')
            .eq('plan_id', (partnerPlan as { plan_id: string }).plan_id)
            .order('tier_order');

          for (const tier of (tiers ?? []) as Array<{ volume_from: number; volume_to: number | null }>) {
            if (tier.volume_from > ytdVolume) {
              nextTierThreshold = tier.volume_from;
              break;
            }
          }
        }

        const html = buildMonthlyDigestHtml({
          partnerName: p.full_name,
          month: monthStr,
          year,
          volume,
          commission,
          tierRate,
          nextTierThreshold,
        });

        const eventKey = `monthly-digest:${p.email}:${year}-${monthStr}`;

        // 3. Check idempotency
        const { data: existingLog } = await supabase
          .from('email_logs')
          .select('id')
          .eq('event_key', eventKey)
          .limit(1)
          .single();

        if (existingLog) {
          results.push({ partnerId: p.id, status: 'already_sent' });
          continue;
        }

        // 4. Send via Resend
        const sendRes = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: fromEmail,
            to: [p.email],
            subject: `Resumo ${monthStr}/${year} — TargX CRM`,
            html,
          }),
        });

        if (!sendRes.ok) {
          const errBody = await sendRes.text();
          throw new Error(`Resend error: ${errBody}`);
        }

        // 5. Log success
        await supabase.from('email_logs').insert({
          event_key: eventKey,
          partner_id: p.id,
          status: 'sent',
          sent_at: new Date().toISOString(),
        });

        results.push({ partnerId: p.id, status: 'sent' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabase.from('email_logs').insert({
          event_key: `monthly-digest:${p.email}:${year}-${monthStr}`,
          partner_id: p.id,
          status: 'error',
          error: message,
          sent_at: new Date().toISOString(),
        });
        results.push({ partnerId: p.id, status: 'error', error: message });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, results }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
});
