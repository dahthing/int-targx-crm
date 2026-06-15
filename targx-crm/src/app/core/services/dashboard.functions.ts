/**
 * Funções puras do DashboardService — sem dependências Angular.
 * Importáveis directamente em testes Vitest.
 */
import type { CommissionTier, CommissionBonus, AnnualBonus } from '../models/commission.model';
import type {
  PartnerSummary,
  BonusStatus,
  AdminOverview,
  PartnerOverviewItem,
  EstimationAccuracyItem,
  PipelineGroup,
} from '../models/dashboard.model';
import type { LeadStatus } from '../models/lead.model';

// ── Erros ─────────────────────────────────────────────────────────────────────

export class ForbiddenError extends Error {
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

// ── Guardas ───────────────────────────────────────────────────────────────────

export function guardAdminOnly(role: string): void {
  if (role !== 'admin') throw new ForbiddenError('Apenas admin pode aceder a este recurso');
}

// ── Cálculos de patamar e bónus ───────────────────────────────────────────────

export function calculateBonusStatus(
  volume: number,
  bonuses: CommissionBonus[],
  existingAnnualBonuses: AnnualBonus[],
): BonusStatus[] {
  return bonuses.map((b) => {
    const achieved =
      volume >= b.threshold ||
      existingAnnualBonuses.some((ab) => ab.threshold === b.threshold);
    return {
      threshold: b.threshold,
      bonus_amount: b.bonus_amount,
      achieved,
      volume_remaining: achieved ? null : b.threshold - volume,
    };
  });
}

export function calculateTargetProgress(
  volumeTrimestre: number,
  targetTrimestre: number | null,
): number | null {
  if (targetTrimestre === null) return null;
  return Math.min((volumeTrimestre / targetTrimestre) * 100, 100);
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

const OPEN_STATUSES: LeadStatus[] = ['nova', 'contactada', 'proposta_enviada', 'negociacao'];

export function calculatePipelineValue(
  leads: Array<{ status: LeadStatus; estimated_value: number | null }>,
): number {
  return leads
    .filter((l) => OPEN_STATUSES.includes(l.status))
    .reduce((sum, l) => sum + (l.estimated_value ?? 0), 0);
}

export function countSilentLeads(
  leads: Array<{ last_activity_at: string | null; status: LeadStatus }>,
  warningDays: number,
): number {
  const cutoff = Date.now() - warningDays * 86400000;
  return leads.filter((l) => {
    if (!OPEN_STATUSES.includes(l.status)) return false;
    if (l.last_activity_at === null) return true;
    return new Date(l.last_activity_at).getTime() < cutoff;
  }).length;
}

export function groupLeadsByStatus(
  leads: Array<{ status: LeadStatus; estimated_value: number | null }>,
): PipelineGroup[] {
  const map = new Map<string, PipelineGroup>();
  for (const lead of leads) {
    const existing = map.get(lead.status);
    if (existing) {
      existing.count += 1;
      existing.value_total += lead.estimated_value ?? 0;
    } else {
      map.set(lead.status, { status: lead.status, count: 1, value_total: lead.estimated_value ?? 0 });
    }
  }
  return Array.from(map.values());
}

// ── Estimativas vs Real ───────────────────────────────────────────────────────

export function calculateEstimationAccuracy(
  projects: Array<{ project_type: string; estimated_hours: number; actual_hours: number }>,
): EstimationAccuracyItem[] {
  const grouped = new Map<string, { estimated: number[]; actual: number[] }>();
  for (const p of projects) {
    const entry = grouped.get(p.project_type) ?? { estimated: [], actual: [] };
    entry.estimated.push(p.estimated_hours);
    entry.actual.push(p.actual_hours);
    grouped.set(p.project_type, entry);
  }
  return Array.from(grouped.entries()).map(([type, data]) => {
    const avg_estimated = data.estimated.reduce((a, b) => a + b, 0) / data.estimated.length;
    const avg_actual = data.actual.reduce((a, b) => a + b, 0) / data.actual.length;
    const avg_deviation_pct = ((avg_actual - avg_estimated) / avg_estimated) * 100;
    return { project_type: type, avg_estimated, avg_actual, avg_deviation_pct, count: data.estimated.length };
  });
}

// ── Admin Overview ────────────────────────────────────────────────────────────

export function aggregateAdminOverview(partnerData: PartnerOverviewItem[]): AdminOverview {
  return {
    volume_total: partnerData.reduce((s, p) => s + p.volume, 0),
    commission_total: partnerData.reduce((s, p) => s + p.commission, 0),
    leads_abertas_total: partnerData.reduce((s, p) => s + p.leads_abertas, 0),
    partners: partnerData,
  };
}

// ── Partner Summary ───────────────────────────────────────────────────────────

interface PartnerSummaryInput {
  volume_ano: number;
  commission_ano: number;
  tiers: CommissionTier[];
  bonuses: CommissionBonus[];
  existingAnnualBonuses: AnnualBonus[];
  volume_trimestre: number;
  target_trimestre: number | null;
  pipeline_value: number;
  leads_abertas: number;
  leads_sem_actividade: number;
}

export function calculatePartnerSummary(input: PartnerSummaryInput): PartnerSummary {
  const sorted = [...input.tiers].sort((a, b) => a.tier_order - b.tier_order);
  const tier_actual =
    sorted.find(
      (t) =>
        input.volume_ano >= t.volume_from &&
        (t.volume_to === null || input.volume_ano < t.volume_to),
    ) ?? sorted[0]!;

  const tierIndex = sorted.indexOf(tier_actual);
  const nextTier = tierIndex + 1 < sorted.length ? sorted[tierIndex + 1] : null;

  const progress_pct_tier =
    tier_actual.volume_to === null
      ? 100
      : Math.min((input.volume_ano / tier_actual.volume_to) * 100, 100);

  return {
    volume_ano: input.volume_ano,
    commission_ano: input.commission_ano,
    tier_actual,
    tier_rate: tier_actual.rate_percent,
    next_tier_threshold: nextTier ? nextTier.volume_from : null,
    volume_to_next_tier:
      tier_actual.volume_to !== null ? tier_actual.volume_to - input.volume_ano : null,
    next_tier_rate: nextTier ? nextTier.rate_percent : null,
    progress_pct_tier,
    bonus_status: calculateBonusStatus(input.volume_ano, input.bonuses, input.existingAnnualBonuses),
    volume_trimestre: input.volume_trimestre,
    target_trimestre: input.target_trimestre,
    progress_pct_target: calculateTargetProgress(input.volume_trimestre, input.target_trimestre),
    pipeline_value: input.pipeline_value,
    leads_abertas: input.leads_abertas,
    leads_sem_actividade: input.leads_sem_actividade,
  };
}
