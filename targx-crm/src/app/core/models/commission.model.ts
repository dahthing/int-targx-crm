export interface CommissionPlan {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface CommissionTier {
  id: string;
  plan_id: string;
  tier_order: number;
  volume_from: number;
  volume_to: number | null;
  rate_percent: number;
  label: string | null;
}

export interface CommissionBonus {
  id: string;
  plan_id: string;
  threshold: number;
  bonus_amount: number;
  description: string | null;
}

export interface PartnerPlan {
  id: string;
  partner_id: string;
  plan_id: string;
  active_from: string;
  active_to: string | null;
}

export interface Commission {
  id: string;
  tranche_id: string;
  partner_id: string;
  project_id: string;
  year: number;
  tranche_amount: number;
  rate_percent: number;
  commission_amount: number;
  tier_label: string | null;
  created_at: string;
}

export interface AnnualBonus {
  id: string;
  partner_id: string;
  year: number;
  volume_total: number;
  threshold: number;
  bonus_amount: number;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface AnnualSnapshot {
  id: string;
  partner_id: string;
  year: number;
  volume_total: number;
  commission_total: number;
  bonuses_total: number;
  projects_count: number;
  created_at: string;
}

/* ── Resultados de cálculo (não persistidos) ── */

export interface CommissionBreakdownItem {
  tierLabel: string | null;
  portion: number;
  rate: number;
  amount: number;
}

export interface CommissionResult {
  commissionAmount: number;
  breakdown: CommissionBreakdownItem[];
  newVolumeTotal: number;
}

export interface BonusToCreate {
  threshold: number;
  bonus_amount: number;
  description: string | null;
}
