// Cron: Jan 1 at 00:05
// Creates annual_snapshots for all partners — historical data is preserved

import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (_req: Request) => {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // Snapshot is for the year that just ended
    const now = new Date();
    const year = now.getFullYear() - 1;
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    // 1. Get all active partners
    const { data: partners, error: partnersError } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'partner')
      .eq('active', true);

    if (partnersError) throw new Error(`Partners fetch: ${partnersError.message}`);

    const results: Array<{ partnerId: string; status: string; error?: string }> = [];

    for (const partner of partners ?? []) {
      const p = partner as { id: string };

      try {
        // Check if snapshot already exists
        const { data: existing } = await supabase
          .from('annual_snapshots')
          .select('id')
          .eq('partner_id', p.id)
          .eq('year', year)
          .single();

        if (existing) {
          results.push({ partnerId: p.id, status: 'already_exists' });
          continue;
        }

        // 2. Fetch total volume (received tranches in year)
        const { data: trancheRows } = await supabase
          .from('project_tranches')
          .select('amount, projects!inner(partner_id, contract_date)')
          .eq('received', true)
          .eq('projects.partner_id', p.id)
          .gte('received_date', yearStart)
          .lt('received_date', yearEnd);

        const volumeTotal = (trancheRows ?? []).reduce(
          (sum: number, r: { amount: number }) => sum + r.amount,
          0,
        );

        // 3. Fetch total commissions in year
        const { data: commRows } = await supabase
          .from('commissions')
          .select('commission_amount')
          .eq('partner_id', p.id)
          .eq('year', year);

        const commissionTotal = (commRows ?? []).reduce(
          (sum: number, c: { commission_amount: number }) => sum + c.commission_amount,
          0,
        );

        // 4. Fetch bonuses in year
        const { data: bonusRows } = await supabase
          .from('annual_bonuses')
          .select('bonus_amount')
          .eq('partner_id', p.id)
          .eq('year', year);

        const bonusesTotal = (bonusRows ?? []).reduce(
          (sum: number, b: { bonus_amount: number }) => sum + b.bonus_amount,
          0,
        );

        // 5. Count distinct projects
        const { data: projectRows } = await supabase
          .from('commissions')
          .select('project_id')
          .eq('partner_id', p.id)
          .eq('year', year);

        const projectsCount = new Set(
          (projectRows ?? []).map((r: { project_id: string }) => r.project_id),
        ).size;

        // 6. Insert snapshot
        const { error: insertError } = await supabase.from('annual_snapshots').insert({
          partner_id: p.id,
          year,
          volume_total: volumeTotal,
          commission_total: commissionTotal,
          bonuses_total: bonusesTotal,
          projects_count: projectsCount,
        });

        if (insertError) throw new Error(`Insert snapshot: ${insertError.message}`);

        results.push({ partnerId: p.id, status: 'created' });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({ partnerId: p.id, status: 'error', error: message });
      }
    }

    return new Response(JSON.stringify({ year, processed: results.length, results }), {
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
