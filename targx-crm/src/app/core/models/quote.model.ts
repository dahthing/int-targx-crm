export type QuoteStatus =
  | 'rascunho'
  | 'em_revisao'
  | 'aprovado_interno'
  | 'enviado_cliente'
  | 'aceite'
  | 'rejeitado';

export type ItemPricingType = 'hourly' | 'fixed';

export type QuestionType =
  | 'single_choice'
  | 'multi_select'
  | 'numeric'
  | 'complexity_scale'
  | 'risk_indicator'
  | 'text';

export interface ProjectType {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon: string | null;
  base_hours: number;
  base_price: number;
  minimum_price: number;
  active: boolean;
  sort_order: number;
  created_at: string;
}

export interface ScopingQuestion {
  id: string;
  project_type_id: string;
  key: string;
  label: string;
  description: string | null;
  question_type: QuestionType;
  options: Record<string, unknown> | null;
  impacts_price: boolean;
  activates_modules: Record<string, string[]> | null;
  triggers_risk: Record<string, unknown> | null;
  sort_order: number;
  required: boolean;
  created_at: string;
}

export interface RateProfile {
  id: string;
  name: string;
  hourly_rate: number;
  active: boolean;
  created_at: string;
}

export interface CatalogItem {
  id: string;
  slug: string | null;
  name: string;
  description: string | null;
  category: string | null;
  pricing_type: ItemPricingType;
  default_hours: number | null;
  default_rate_profile_id: string | null;
  default_value: number | null;
  applicable_project_types: string[] | null;
  out_of_scope_notes: string | null;
  risk_flags: Record<string, unknown> | null;
  active: boolean;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  project_type_id: string | null;
  phases_data: Record<string, unknown>;
  usage_count: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface RiskMultiplier {
  id: string;
  key: string;
  name: string;
  description: string | null;
  category: 'tecnico' | 'timeline' | 'cliente' | 'scope';
  multiplier: number;
  is_blocking: boolean;
  active: boolean;
  created_at: string;
}

export interface Quote {
  id: string;
  lead_id: string | null;
  client_id: string;
  partner_id: string;
  project_type_id: string | null;
  template_id: string | null;
  title: string;
  description: string | null;
  status: QuoteStatus;
  version: number;
  parent_quote_id: string | null;
  scoping_answers: Record<string, unknown> | null;
  scoping_completed: boolean;
  detected_risks: Record<string, unknown> | null;
  risk_multiplier_total: number;
  has_blocking_risk: boolean;
  admin_risk_override: boolean;
  admin_risk_notes: string | null;
  subtotal_base: number | null;
  risk_adjustment: number | null;
  subtotal_with_risk: number | null;
  discount_pct: number;
  discount_reason: string | null;
  discount_amount: number | null;
  total_before_tax: number | null;
  total_with_tax: number | null;
  minimum_margin_pct: number | null;
  calculated_margin_pct: number | null;
  payment_terms: string | null;
  valid_until: string | null;
  internal_notes: string | null;
  rejection_reason: string | null;
  client_accept_token: string | null;
  token_expires_at: string | null;
  pdf_url: string | null;
  portal_opened_at: string | null;
  portal_open_count: number;
  gantt_start_date: string | null;
  gantt_data: Record<string, unknown> | null;
  sent_at: string | null;
  accepted_at: string | null;
  rejected_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuoteAuditLog {
  id: string;
  quote_id: string;
  changed_by: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
}

export interface QuotePhase {
  id: string;
  quote_id: string;
  name: string;
  description: string | null;
  phase_order: number;
  duration_days: number | null;
  created_at: string;
}

export interface QuoteItem {
  id: string;
  phase_id: string;
  catalog_item_id: string | null;
  name: string;
  description: string | null;
  pricing_type: ItemPricingType;
  hours: number | null;
  rate_profile_id: string | null;
  hourly_rate: number | null;
  unit_value: number | null;
  quantity: number;
  item_order: number;
  optional: boolean;
  optional_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface QuoteStatusHistory {
  id: string;
  quote_id: string;
  from_status: QuoteStatus | null;
  to_status: QuoteStatus;
  changed_by: string | null;
  notes: string | null;
  changed_at: string;
}
