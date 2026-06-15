import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req: Request) => {
  try {
    const { trancheId } = await req.json() as { trancheId?: string };

    if (!trancheId) {
      return new Response(JSON.stringify({ error: 'trancheId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fetch commission for this tranche (to get partner_id + year before deleting)
    const { data: commission, error: fetchError } = await supabase
      .from('commissions')
      .select('id, partner_id, year, tranche_amount')
      .eq('tranche_id', trancheId)
      .single();

    if (fetchError || !commission) {
      return new Response(JSON.stringify({ message: 'No commission found for tranche — nothing to remove' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const { partner_id, year } = commission as { id: string; partner_id: string; year: number; tranche_amount: number };

    // 2. Delete commission record
    const { error: deleteError } = await supabase
      .from('commissions')
      .delete()
      .eq('tranche_id', trancheId);

    if (deleteError) throw new Error(`Delete commission: ${deleteError.message}`);

    // 3. Re-evaluate annual_bonuses for this partner/year
    // Get current total volume after deletion
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    const { data: volumeRows } = await supabase
      .from('project_tranches')
      .select('amount, projects!inner(partner_id, contract_date)')
      .eq('received', true)
      .eq('projects.partner_id', partner_id)
      .gte('received_date', yearStart)
      .lt('received_date', yearEnd);

    const currentVolume = (volumeRows ?? []).reduce(
      (sum: number, row: { amount: number }) => sum + (row.amount ?? 0),
      0,
    );

    // Fetch partner plan → bonuses
    const { data: partnerPlan } = await supabase
      .from('partner_plans')
      .select('plan_id')
      .eq('partner_id', partner_id)
      .is('active_to', null)
      .single();

    if (partnerPlan) {
      const { data: bonuses } = await supabase
        .from('commission_bonuses')
        .select('threshold')
        .eq('plan_id', (partnerPlan as { plan_id: string }).plan_id);

      // Remove any annual_bonuses whose threshold is no longer reached
      for (const bonus of (bonuses ?? []) as Array<{ threshold: number }>) {
        if (currentVolume < bonus.threshold) {
          await supabase
            .from('annual_bonuses')
            .delete()
            .eq('partner_id', partner_id)
            .eq('year', year)
            .eq('threshold', bonus.threshold)
            .eq('paid', false); // Never delete already-paid bonuses
        }
      }
    }

    return new Response(JSON.stringify({ removed: true, partner_id, year }), {
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
