import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import type {
  Commission,
  AnnualBonus,
  AnnualSnapshot,
  CommissionTier,
} from '../models/commission.model';

export interface CommissionWithContext extends Commission {
  project_title?: string;
  client_name?: string;
  tranche_description?: string;
  partner_name?: string;
}

export interface CommissionListFilters {
  partnerId?: string;
  year?: number;
  month?: number;
}

export interface CommissionSummary {
  volumeTotal: number;
  commissionTotal: number;
  bonusTotal: number;
  currentTierRate: number;
  nextTierThreshold: number | null;
}

@Injectable({ providedIn: 'root' })
export class CommissionService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async listCommissions(filters: CommissionListFilters = {}): Promise<CommissionWithContext[]> {
    let query = this.#supabase
      .from('commissions')
      .select(`
        *,
        project_tranches!inner(description, projects!inner(title, clients!inner(name))),
        profiles!commissions_partner_id_fkey(full_name)
      `)
      .order('created_at', { ascending: false });

    if (filters.partnerId) {
      query = query.eq('partner_id', filters.partnerId);
    }

    if (filters.year) {
      query = query.eq('year', filters.year);
    }

    if (filters.month) {
      const year = filters.year ?? new Date().getFullYear();
      const monthStr = String(filters.month).padStart(2, '0');
      const monthStart = `${year}-${monthStr}-01`;
      const nextMonth = filters.month === 12 ? `${year + 1}-01-01` : `${year}-${String(filters.month + 1).padStart(2, '0')}-01`;
      query = query.gte('created_at', monthStart).lt('created_at', nextMonth);
    }

    const { data, error } = await query;
    if (error) throw new Error(`CommissionService.listCommissions: ${error.message}`);

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const tranche = row['project_tranches'] as Record<string, unknown> | null;
      const project = tranche?.['projects'] as Record<string, unknown> | null;
      const client = project?.['clients'] as Record<string, unknown> | null;
      const profile = row['profiles'] as Record<string, unknown> | null;

      return {
        id: row['id'] as string,
        tranche_id: row['tranche_id'] as string,
        partner_id: row['partner_id'] as string,
        project_id: row['project_id'] as string,
        year: row['year'] as number,
        tranche_amount: row['tranche_amount'] as number,
        rate_percent: row['rate_percent'] as number,
        commission_amount: row['commission_amount'] as number,
        tier_label: row['tier_label'] as string | null,
        created_at: row['created_at'] as string,
        tranche_description: tranche?.['description'] as string | undefined,
        project_title: project?.['title'] as string | undefined,
        client_name: client?.['name'] as string | undefined,
        partner_name: profile?.['full_name'] as string | undefined,
      };
    });
  }

  async getAnnualSummary(partnerId: string, year: number): Promise<CommissionSummary> {
    // Volume + commissions
    const { data: commRows, error: commError } = await this.#supabase
      .from('commissions')
      .select('tranche_amount, commission_amount, rate_percent')
      .eq('partner_id', partnerId)
      .eq('year', year);

    if (commError) throw new Error(`CommissionService.getAnnualSummary: ${commError.message}`);

    const volumeTotal = (commRows ?? []).reduce((s, c) => s + c.tranche_amount, 0);
    const commissionTotal = (commRows ?? []).reduce((s, c) => s + c.commission_amount, 0);
    const currentTierRate = ((commRows ?? [])[0]?.rate_percent ?? 0) / 100;

    // Bonuses
    const { data: bonusRows } = await this.#supabase
      .from('annual_bonuses')
      .select('bonus_amount')
      .eq('partner_id', partnerId)
      .eq('year', year);

    const bonusTotal = (bonusRows ?? []).reduce((s, b) => s + b.bonus_amount, 0);

    // Next tier threshold
    const { data: partnerPlan } = await this.#supabase
      .from('partner_plans')
      .select('plan_id')
      .eq('partner_id', partnerId)
      .is('active_to', null)
      .single();

    let nextTierThreshold: number | null = null;

    if (partnerPlan) {
      const { data: tiers } = await this.#supabase
        .from('commission_tiers')
        .select('volume_from')
        .eq('plan_id', (partnerPlan as { plan_id: string }).plan_id)
        .order('tier_order');

      for (const tier of (tiers ?? []) as CommissionTier[]) {
        if (tier.volume_from > volumeTotal) {
          nextTierThreshold = tier.volume_from;
          break;
        }
      }
    }

    return { volumeTotal, commissionTotal, bonusTotal, currentTierRate, nextTierThreshold };
  }

  async getAnnualBonuses(partnerId: string, year: number): Promise<AnnualBonus[]> {
    const { data, error } = await this.#supabase
      .from('annual_bonuses')
      .select('*')
      .eq('partner_id', partnerId)
      .eq('year', year)
      .order('threshold');

    if (error) throw new Error(`CommissionService.getAnnualBonuses: ${error.message}`);
    return (data ?? []) as AnnualBonus[];
  }

  async getMonthlyBreakdown(
    partnerId: string,
    year: number,
  ): Promise<Array<{ month: number; volume: number; commission: number }>> {
    const { data, error } = await this.#supabase
      .from('commissions')
      .select('tranche_amount, commission_amount, created_at')
      .eq('partner_id', partnerId)
      .eq('year', year);

    if (error) throw new Error(`CommissionService.getMonthlyBreakdown: ${error.message}`);

    const monthly: Record<number, { volume: number; commission: number }> = {};

    for (const row of (data ?? []) as Array<{ tranche_amount: number; commission_amount: number; created_at: string }>) {
      const month = new Date(row.created_at).getMonth() + 1;
      if (!monthly[month]) monthly[month] = { volume: 0, commission: 0 };
      monthly[month].volume += row.tranche_amount;
      monthly[month].commission += row.commission_amount;
    }

    return Array.from({ length: 12 }, (_, i) => ({
      month: i + 1,
      volume: monthly[i + 1]?.volume ?? 0,
      commission: monthly[i + 1]?.commission ?? 0,
    }));
  }

  async generateStatementPdf(partnerId: string, month: string): Promise<string> {
    const { data, error } = await this.#supabase.functions.invoke(
      'generate-commission-statement',
      { body: { partnerId, month } },
    );

    if (error) throw new Error(`generateStatementPdf: ${error.message}`);
    const pdfUrl = (data as Record<string, unknown>)?.['pdfUrl'] as string | undefined;
    if (!pdfUrl) throw new Error('Edge Function não retornou pdfUrl');
    return pdfUrl;
  }

  async getAnnualSnapshots(partnerId: string): Promise<AnnualSnapshot[]> {
    const { data, error } = await this.#supabase
      .from('annual_snapshots')
      .select('*')
      .eq('partner_id', partnerId)
      .order('year', { ascending: false });

    if (error) throw new Error(`CommissionService.getAnnualSnapshots: ${error.message}`);
    return (data ?? []) as AnnualSnapshot[];
  }
}
