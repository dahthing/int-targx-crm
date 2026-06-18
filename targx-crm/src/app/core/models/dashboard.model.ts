import type { CommissionTier } from './commission.model';

export interface BonusStatus {
  threshold: number;
  bonus_amount: number;
  achieved: boolean;
  volume_remaining: number | null;
}

export interface PartnerSummary {
  volume_ano: number;
  commission_ano: number;
  tier_actual: CommissionTier;
  tier_rate: number;
  next_tier_threshold: number | null;
  volume_to_next_tier: number | null;
  next_tier_rate: number | null;
  progress_pct_tier: number;
  bonus_status: BonusStatus[];
  volume_trimestre: number;
  target_trimestre: number | null;
  progress_pct_target: number | null;
  pipeline_value: number;
  leads_abertas: number;
  leads_sem_actividade: number;
}

export interface PipelineGroup {
  status: string;
  count: number;
  value_total: number;
  leads?: { id: string; title: string; client_name?: string | null }[];
}

export interface PartnerOverviewItem {
  partner_id: string;
  volume: number;
  commission: number;
  leads_abertas: number;
}

export interface AdminOverview {
  volume_total: number;
  commission_total: number;
  leads_abertas_total: number;
  partners: PartnerOverviewItem[];
}

export interface EstimationAccuracyItem {
  project_type: string;
  avg_estimated: number;
  avg_actual: number;
  avg_deviation_pct: number;
  count: number;
}

export interface PipelineSummary {
  groups: PipelineGroup[];
  tempo_medio_dias: Record<string, number>;
  taxa_conversao: Record<string, number>;
}
