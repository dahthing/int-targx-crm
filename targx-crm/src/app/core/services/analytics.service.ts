import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

export interface EstimationAccuracy {
  project_type_name: string;
  avg_estimated: number;
  avg_actual: number;
  avg_deviation_pct: number;
  count: number;
}

export interface MonthlyVolume {
  month: number;
  volume: number;
  commission: number;
}

export interface FunnelStage {
  status: string;
  count: number;
  conversion_rate_to_next: number | null;
}

export interface QuoteStats {
  sent: number;
  accepted: number;
  rejected: number;
  acceptance_rate: number;
  avg_value: number;
  avg_time_to_decision_days: number | null;
}

export interface ClientVolume {
  client_name: string;
  project_count: number;
  total_volume: number;
  total_commission: number;
}

export interface PartnerAnnualReport {
  volume: number;
  commission: number;
  bonuses: number;
  projects_count: number;
  leads_closed: number;
  avg_project_value: number;
}

@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  getEstimationAccuracy(): Observable<EstimationAccuracy[]> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('projects')
          .select('estimated_hours, actual_hours, quotes(project_types(name))')
          .eq('status', 'concluido')
          .not('actual_hours', 'is', null)
          .not('estimated_hours', 'is', null);
        if (error) throw error;

        const byType = new Map<string, { estimated: number[]; actual: number[] }>();
        for (const p of data ?? []) {
          const typeName = (p as Record<string, unknown> & { quotes?: { project_types?: { name?: string } } })
            .quotes?.project_types?.name ?? 'Sem tipo';
          if (!byType.has(typeName)) byType.set(typeName, { estimated: [], actual: [] });
          byType.get(typeName)!.estimated.push(p.estimated_hours as number);
          byType.get(typeName)!.actual.push(p.actual_hours as number);
        }

        return Array.from(byType.entries()).map(([name, vals]) => {
          const avgEst = vals.estimated.reduce((s, v) => s + v, 0) / vals.estimated.length;
          const avgAct = vals.actual.reduce((s, v) => s + v, 0) / vals.actual.length;
          return {
            project_type_name: name,
            avg_estimated: Math.round(avgEst),
            avg_actual: Math.round(avgAct),
            avg_deviation_pct: Math.round(((avgAct - avgEst) / avgEst) * 100),
            count: vals.estimated.length,
          };
        }).sort((a, b) => Math.abs(b.avg_deviation_pct) - Math.abs(a.avg_deviation_pct));
      })()
    );
  }

  getVolumeTimeline(year: number): Observable<MonthlyVolume[]> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('project_tranches')
          .select('amount, received_date, commissions(commission_amount)')
          .eq('received', true)
          .gte('received_date', `${year}-01-01`)
          .lt('received_date', `${year + 1}-01-01`);
        if (error) throw error;

        const months: MonthlyVolume[] = Array.from({ length: 12 }, (_, i) => ({
          month: i + 1,
          volume: 0,
          commission: 0,
        }));

        for (const t of data ?? []) {
          const month = new Date(t.received_date as string).getMonth();
          months[month].volume += t.amount as number;
          const comm = (t as Record<string, unknown> & { commissions?: { commission_amount?: number }[] })
            .commissions?.[0]?.commission_amount ?? 0;
          months[month].commission += comm;
        }

        return months;
      })()
    );
  }

  getConversionFunnel(): Observable<FunnelStage[]> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('leads')
          .select('status');
        if (error) throw error;

        const order = ['nova', 'contactada', 'negociacao', 'proposta_enviada', 'fechada_ganha', 'fechada_perdida'];
        const counts = new Map<string, number>();
        for (const lead of data ?? []) counts.set(lead.status, (counts.get(lead.status) ?? 0) + 1);

        return order.map((status, i) => {
          const count = counts.get(status) ?? 0;
          const nextStatus = order[i + 1];
          const nextCount = nextStatus ? (counts.get(nextStatus) ?? 0) : null;
          return {
            status,
            count,
            conversion_rate_to_next: nextCount !== null && count > 0
              ? Math.round((nextCount / count) * 100)
              : null,
          };
        });
      })()
    );
  }

  getQuoteStats(year: number): Observable<QuoteStats> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('quotes')
          .select('status, total_before_tax, sent_at, updated_at')
          .gte('created_at', `${year}-01-01`)
          .lt('created_at', `${year + 1}-01-01`);
        if (error) throw error;

        const quotes = data ?? [];
        const sent = quotes.filter(q => q.status !== 'rascunho').length;
        const accepted = quotes.filter(q => q.status === 'aceite').length;
        const rejected = quotes.filter(q => q.status === 'rejeitado').length;
        const values = quotes.map(q => q.total_before_tax as number).filter(Boolean);
        const avgValue = values.length ? values.reduce((s, v) => s + v, 0) / values.length : 0;

        return {
          sent,
          accepted,
          rejected,
          acceptance_rate: sent > 0 ? Math.round((accepted / sent) * 100) : 0,
          avg_value: Math.round(avgValue),
          avg_time_to_decision_days: null,
        };
      })()
    );
  }

  getTopClients(year: number, limit = 10): Observable<ClientVolume[]> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('project_tranches')
          .select('amount, projects(title, clients(name), commissions(commission_amount))')
          .eq('received', true)
          .gte('received_date', `${year}-01-01`)
          .lt('received_date', `${year + 1}-01-01`);
        if (error) throw error;

        type Row = {
          amount: number;
          projects?: {
            clients?: { name?: string };
            commissions?: { commission_amount?: number }[];
          };
        };

        const byClient = new Map<string, ClientVolume>();
        for (const t of (data ?? []) as Row[]) {
          const name = t.projects?.clients?.name ?? 'Desconhecido';
          if (!byClient.has(name)) {
            byClient.set(name, { client_name: name, project_count: 0, total_volume: 0, total_commission: 0 });
          }
          const entry = byClient.get(name)!;
          entry.total_volume += t.amount;
          entry.total_commission += t.projects?.commissions?.[0]?.commission_amount ?? 0;
          entry.project_count++;
        }

        return Array.from(byClient.values())
          .sort((a, b) => b.total_volume - a.total_volume)
          .slice(0, limit);
      })()
    );
  }

  getPartnerAnnualReport(partnerId: string, year: number): Observable<PartnerAnnualReport> {
    return from(
      (async () => {
        const [tranchesRes, bonusesRes, leadsRes] = await Promise.all([
          this.#supabase
            .from('commissions')
            .select('tranche_amount, commission_amount')
            .eq('partner_id', partnerId)
            .eq('year', year),
          this.#supabase
            .from('annual_bonuses')
            .select('bonus_amount')
            .eq('partner_id', partnerId)
            .eq('year', year),
          this.#supabase
            .from('leads')
            .select('id')
            .eq('partner_id', partnerId)
            .eq('status', 'fechada_ganha'),
        ]);

        const tranches = tranchesRes.data ?? [];
        const volume = tranches.reduce((s, t) => s + (t.tranche_amount as number), 0);
        const commission = tranches.reduce((s, t) => s + (t.commission_amount as number), 0);
        const bonuses = (bonusesRes.data ?? []).reduce((s, b) => s + (b.bonus_amount as number), 0);
        const projectCount = tranches.length;

        return {
          volume,
          commission,
          bonuses,
          projects_count: projectCount,
          leads_closed: leadsRes.data?.length ?? 0,
          avg_project_value: projectCount > 0 ? Math.round(volume / projectCount) : 0,
        };
      })()
    );
  }
}
