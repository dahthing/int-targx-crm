import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ── Types ────────────────────────────────────────────────────────────────────

interface CommissionTier {
  id: string;
  plan_id: string;
  tier_order: number;
  volume_from: number;
  volume_to: number | null;
  rate_percent: number;
  label: string | null;
}

interface CommissionBonus {
  id: string;
  plan_id: string;
  threshold: number;
  bonus_amount: number;
  description: string | null;
}

interface BreakdownItem {
  tierLabel: string | null;
  portion: number;
  rate: number;
  amount: number;
}

// ── Commission calculation (inlined from commission-calculator.service.ts) ──

function calculateForTranche(params: {
  trancheAmount: number;
  previousVolumeInYear: number;
  tiers: CommissionTier[];
}): { commissionAmount: number; breakdown: BreakdownItem[]; newVolumeTotal: number } {
  const { trancheAmount, previousVolumeInYear, tiers } = params;

  if (trancheAmount <= 0) {
    return { commissionAmount: 0, breakdown: [], newVolumeTotal: previousVolumeInYear };
  }

  const sorted = [...tiers].sort((a, b) => a.tier_order - b.tier_order);
  const breakdown: BreakdownItem[] = [];
  let remaining = trancheAmount;
  let cumulativeVolume = previousVolumeInYear;
  let totalCommission = 0;

  for (const tier of sorted) {
    if (remaining <= 0) break;

    const tierFrom = tier.volume_from;
    const tierTo = tier.volume_to ?? Infinity;

    if (cumulativeVolume >= tierTo) continue;

    const availableInTier = tierTo - Math.max(cumulativeVolume, tierFrom);
    if (availableInTier <= 0) continue;

    const portionInTier = Math.min(remaining, availableInTier);
    const commission = portionInTier * (tier.rate_percent / 100);

    breakdown.push({
      tierLabel: tier.label,
      portion: portionInTier,
      rate: tier.rate_percent / 100,
      amount: commission,
    });

    totalCommission += commission;
    cumulativeVolume += portionInTier;
    remaining -= portionInTier;
  }

  // Any remaining portion beyond all tiers — use last tier's rate
  if (remaining > 0 && sorted.length > 0) {
    const lastTier = sorted[sorted.length - 1];
    const commission = remaining * (lastTier.rate_percent / 100);
    breakdown.push({
      tierLabel: lastTier.label,
      portion: remaining,
      rate: lastTier.rate_percent / 100,
      amount: commission,
    });
    totalCommission += commission;
    cumulativeVolume += remaining;
  }

  return {
    commissionAmount: Math.round(totalCommission * 100) / 100,
    breakdown,
    newVolumeTotal: cumulativeVolume,
  };
}

// ── Handler ──────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
  try {
    const { projectId, trancheId } = await req.json() as {
      projectId?: string;
      trancheId?: string;
    };

    if (!projectId) {
      return new Response(JSON.stringify({ error: 'projectId is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    // 1. Fetch project to get partner_id
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('id, partner_id, contract_date')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return new Response(JSON.stringify({ error: `Project not found: ${projectError?.message}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (!project.partner_id) {
      return new Response(JSON.stringify({ message: 'No partner_id — skipping commission' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 2. If trancheId provided, process single tranche; otherwise process all received tranches
    const trancheFilter = trancheId
      ? supabase.from('project_tranches').select('*').eq('id', trancheId).eq('project_id', projectId)
      : supabase.from('project_tranches').select('*').eq('project_id', projectId).eq('received', true);

    const { data: tranches, error: trancheError } = await trancheFilter;
    if (trancheError) throw new Error(`Tranches fetch: ${trancheError.message}`);
    if (!tranches || tranches.length === 0) {
      return new Response(JSON.stringify({ message: 'No tranches to process' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 3. Fetch partner plan
    const { data: partnerPlan, error: planError } = await supabase
      .from('partner_plans')
      .select('plan_id')
      .eq('partner_id', project.partner_id)
      .is('active_to', null)
      .single();

    if (planError || !partnerPlan) {
      return new Response(JSON.stringify({ error: `No active plan for partner: ${planError?.message}` }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // 4. Fetch commission tiers
    const { data: tiers, error: tiersError } = await supabase
      .from('commission_tiers')
      .select('*')
      .eq('plan_id', partnerPlan.plan_id)
      .order('tier_order');

    if (tiersError) throw new Error(`Tiers fetch: ${tiersError.message}`);

    // 5. Fetch commission bonuses
    const { data: bonuses, error: bonusesError } = await supabase
      .from('commission_bonuses')
      .select('*')
      .eq('plan_id', partnerPlan.plan_id)
      .order('threshold');

    if (bonusesError) throw new Error(`Bonuses fetch: ${bonusesError.message}`);

    const year = new Date(project.contract_date).getFullYear();
    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    // 6. Process each tranche
    const results: Array<{ trancheId: string; commissionId: string; commissionAmount: number }> = [];

    for (const tranche of tranches) {
      // Skip if commission already exists for this tranche
      const { data: existing } = await supabase
        .from('commissions')
        .select('id')
        .eq('tranche_id', tranche.id)
        .single();

      if (existing) {
        results.push({ trancheId: tranche.id, commissionId: existing.id, commissionAmount: 0 });
        continue;
      }

      // Get volume before this tranche
      const { data: prevVolumeRows } = await supabase
        .from('project_tranches')
        .select('amount, projects!inner(partner_id, contract_date)')
        .eq('received', true)
        .eq('projects.partner_id', project.partner_id)
        .gte('received_date', yearStart)
        .lt('received_date', yearEnd)
        .neq('id', tranche.id);

      const previousVolume = (prevVolumeRows ?? []).reduce(
        (sum: number, row: { amount: number }) => sum + (row.amount ?? 0),
        0,
      );

      // Calculate commission
      const result = calculateForTranche({
        trancheAmount: tranche.amount,
        previousVolumeInYear: previousVolume,
        tiers: tiers as CommissionTier[],
      });

      // Find applicable tier label for rate
      const ratePercent = result.breakdown[0]?.rate != null
        ? result.breakdown[0].rate * 100
        : 0;
      const tierLabel = result.breakdown[0]?.tierLabel ?? null;

      // Insert commission
      const { data: commission, error: insertError } = await supabase
        .from('commissions')
        .insert({
          tranche_id: tranche.id,
          partner_id: project.partner_id,
          project_id: projectId,
          year,
          tranche_amount: tranche.amount,
          rate_percent: ratePercent,
          commission_amount: result.commissionAmount,
          tier_label: tierLabel,
        })
        .select('id')
        .single();

      if (insertError) throw new Error(`Insert commission: ${insertError.message}`);

      // 7. Check bonus thresholds
      const newVolumeTotal = result.newVolumeTotal;
      const bonusList = (bonuses ?? []) as CommissionBonus[];

      for (const bonus of bonusList) {
        if (previousVolume < bonus.threshold && newVolumeTotal >= bonus.threshold) {
          // Newly crossed this threshold — insert annual_bonus if not already present
          const { data: existingBonus } = await supabase
            .from('annual_bonuses')
            .select('id')
            .eq('partner_id', project.partner_id)
            .eq('year', year)
            .eq('threshold', bonus.threshold)
            .single();

          if (!existingBonus) {
            await supabase.from('annual_bonuses').insert({
              partner_id: project.partner_id,
              year,
              volume_total: newVolumeTotal,
              threshold: bonus.threshold,
              bonus_amount: bonus.bonus_amount,
              paid: false,
              paid_date: null,
            });
          }
        }
      }

      results.push({
        trancheId: tranche.id,
        commissionId: (commission as { id: string }).id,
        commissionAmount: result.commissionAmount,
      });
    }

    return new Response(JSON.stringify({ results }), {
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
