import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import type { CommissionTier, CommissionBonus, AnnualBonus } from '../models/commission.model';
import type {
  PartnerSummary,
  AdminOverview,
  EstimationAccuracyItem,
  PipelineSummary,
  PartnerOverviewItem,
} from '../models/dashboard.model';
import type { LeadStatus } from '../models/lead.model';
import { SupabaseService } from '../supabase/supabase.client';
import { AuthService } from './auth.service';
import {
  guardAdminOnly,
  calculatePartnerSummary,
  calculatePipelineValue,
  countSilentLeads,
  groupLeadsByStatus,
  calculateEstimationAccuracy,
  aggregateAdminOverview,
} from './dashboard.functions';

// Re-export para conveniência
export {
  guardAdminOnly,
  calculatePartnerSummary,
  calculateBonusStatus,
  calculateTargetProgress,
  calculatePipelineValue,
  countSilentLeads,
  groupLeadsByStatus,
  calculateEstimationAccuracy,
  aggregateAdminOverview,
  ForbiddenError,
} from './dashboard.functions';

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly supabaseService = inject(SupabaseService);
  private readonly auth = inject(AuthService);

  private get supabase() {
    return this.supabaseService.client;
  }

  getPartnerSummary(partnerId: string, year: number): Observable<PartnerSummary> {
    return from(this._getPartnerSummary(partnerId, year));
  }

  private async _getPartnerSummary(partnerId: string, year: number): Promise<PartnerSummary> {
    const [commissionsRes, planRes, leadsRes, targetsRes, bonusesRes] = await Promise.all([
      this.supabase
        .from('commissions')
        .select('commission_amount, tranche_amount')
        .eq('partner_id', partnerId)
        .eq('year', year),
      this.supabase
        .from('partner_plans')
        .select('plan_id, commission_plans(commission_tiers(*), commission_bonuses(*))')
        .eq('partner_id', partnerId)
        .lte('active_from', new Date().toISOString().split('T')[0])
        .or(`active_to.is.null,active_to.gte.${new Date().toISOString().split('T')[0]}`)
        .limit(1)
        .single(),
      this.supabase
        .from('leads')
        .select('status, estimated_value, last_activity_at')
        .eq('partner_id', partnerId)
        .not('status', 'in', '(fechada_ganha,fechada_perdida)'),
      this.supabase
        .from('partner_targets')
        .select('target_volume')
        .eq('partner_id', partnerId)
        .eq('year', year)
        .eq('quarter', Math.ceil((new Date().getMonth() + 1) / 3))
        .single(),
      this.supabase
        .from('annual_bonuses')
        .select('*')
        .eq('partner_id', partnerId)
        .eq('year', year),
    ]);

    const commissions = (commissionsRes.data ?? []) as Array<{
      commission_amount: number;
      tranche_amount: number;
    }>;
    const volume_ano = commissions.reduce((s, c) => s + c.tranche_amount, 0);
    const commission_ano = commissions.reduce((s, c) => s + c.commission_amount, 0);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planData = planRes.data as any;
    const tiers: CommissionTier[] = planData?.commission_plans?.commission_tiers ?? [];
    const bonuses: CommissionBonus[] = planData?.commission_plans?.commission_bonuses ?? [];
    const existingAnnualBonuses = (bonusesRes.data ?? []) as AnnualBonus[];

    const openLeads = (leadsRes.data ?? []) as Array<{
      status: LeadStatus;
      estimated_value: number | null;
      last_activity_at: string | null;
    }>;

    const settingsRes = await this.supabase
      .from('global_settings')
      .select('key, value')
      .eq('key', 'lead_silence_warning_days')
      .single();
    const warningDays = parseInt(
      ((settingsRes.data as { key: string; value: string } | null)?.value ?? '7'),
      10,
    );

    const quarterStart = new Date();
    quarterStart.setMonth(Math.floor(quarterStart.getMonth() / 3) * 3, 1);
    quarterStart.setHours(0, 0, 0, 0);
    const tranchesRes = await this.supabase
      .from('project_tranches')
      .select('amount, projects(partner_id)')
      .eq('received', true)
      .gte('received_date', quarterStart.toISOString().split('T')[0]);
    const volume_trimestre = (
      (tranchesRes.data ?? []) as Array<{
        amount: number;
        projects: Array<{ partner_id: string }> | null;
      }>
    )
      .filter((t) => (t.projects?.[0]?.partner_id ?? null) === partnerId)
      .reduce((s, t) => s + t.amount, 0);

    return calculatePartnerSummary({
      volume_ano,
      commission_ano,
      tiers,
      bonuses,
      existingAnnualBonuses,
      volume_trimestre,
      target_trimestre:
        (targetsRes.data as { target_volume: number } | null)?.target_volume ?? null,
      pipeline_value: calculatePipelineValue(openLeads),
      leads_abertas: openLeads.length,
      leads_sem_actividade: countSilentLeads(openLeads, warningDays),
    });
  }

  getAdminOverview(year: number): Observable<AdminOverview> {
    guardAdminOnly(this.auth.role() ?? '');
    return from(this._getAdminOverview(year));
  }

  private async _getAdminOverview(year: number): Promise<AdminOverview> {
    const [commissionsRes, leadsRes] = await Promise.all([
      this.supabase
        .from('commissions')
        .select('partner_id, commission_amount, tranche_amount')
        .eq('year', year),
      this.supabase
        .from('leads')
        .select('partner_id, status, estimated_value')
        .not('status', 'in', '(fechada_ganha,fechada_perdida)'),
    ]);

    const commissions = (commissionsRes.data ?? []) as Array<{
      partner_id: string;
      commission_amount: number;
      tranche_amount: number;
    }>;
    const leads = (leadsRes.data ?? []) as Array<{
      partner_id: string;
      status: LeadStatus;
      estimated_value: number | null;
    }>;

    const partnerIds = [...new Set(commissions.map((c) => c.partner_id))];
    const partnerData: PartnerOverviewItem[] = partnerIds.map((pid) => ({
      partner_id: pid,
      volume: commissions
        .filter((c) => c.partner_id === pid)
        .reduce((s, c) => s + c.tranche_amount, 0),
      commission: commissions
        .filter((c) => c.partner_id === pid)
        .reduce((s, c) => s + c.commission_amount, 0),
      leads_abertas: leads.filter((l) => l.partner_id === pid).length,
    }));

    return aggregateAdminOverview(partnerData);
  }

  getPipelineSummary(): Observable<PipelineSummary> {
    return from(this._getPipelineSummary());
  }

  private async _getPipelineSummary(): Promise<PipelineSummary> {
    const { data } = await this.supabase
      .from('leads')
      .select('id, title, status, estimated_value, clients(name)')
      .in('status', ['nova', 'contactada', 'proposta_enviada', 'negociacao'])
      .order('created_at', { ascending: false });
    const leads = (data ?? []) as unknown as Array<{
      id: string;
      title: string;
      status: LeadStatus;
      estimated_value: number | null;
      clients: { name: string } | null;
    }>;

    const statusOrder = ['nova', 'contactada', 'proposta_enviada', 'negociacao'];
    const grouped = statusOrder.map(status => {
      const inStatus = leads.filter(l => l.status === status);
      return {
        status,
        count: inStatus.length,
        value_total: inStatus.reduce((sum, l) => sum + (l.estimated_value ?? 0), 0),
        leads: inStatus.map(l => ({ id: l.id, title: l.title, client_name: l.clients?.name ?? null })),
      };
    }).filter(g => g.count > 0);

    return {
      groups: grouped,
      tempo_medio_dias: {},
      taxa_conversao: {},
    };
  }

  getEstimationAccuracy(): Observable<EstimationAccuracyItem[]> {
    return from(this._getEstimationAccuracy());
  }

  private async _getEstimationAccuracy(): Promise<EstimationAccuracyItem[]> {
    const { data } = await this.supabase
      .from('projects')
      .select('estimated_hours, actual_hours, project_types(slug)')
      .eq('status', 'concluido')
      .not('actual_hours', 'is', null);
    const projects = (data ?? []) as Array<{
      estimated_hours: number;
      actual_hours: number;
      project_types: Array<{ slug: string }> | null;
    }>;
    return calculateEstimationAccuracy(
      projects.map((p) => ({
        project_type: p.project_types?.[0]?.slug ?? 'desconhecido',
        estimated_hours: p.estimated_hours,
        actual_hours: p.actual_hours,
      })),
    );
  }
}
