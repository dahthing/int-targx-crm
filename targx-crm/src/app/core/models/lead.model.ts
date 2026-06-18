export type LeadStatus =
  | 'nova'
  | 'contactada'
  | 'proposta_enviada'
  | 'negociacao'
  | 'fechada_ganha'
  | 'fechada_perdida';

export type ActivityType = 'nota' | 'chamada' | 'reuniao' | 'email' | 'proposta';

export interface Lead {
  id: string;
  client_id: string | null;
  client_name?: string | null;  // joined from clients.name
  partner_id: string;
  title: string;
  description: string | null;
  status: LeadStatus;
  estimated_value: number | null;
  lost_reason: string | null;
  source: string | null;
  next_action: string | null;
  next_action_date: string | null;
  last_activity_at: string | null;
  silence_alerted: boolean;
  pending_conversion: boolean;
  pending_conversion_note: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadActivity {
  id: string;
  lead_id: string;
  author_id: string;
  type: ActivityType;
  content: string;
  activity_at: string;
}

export interface PartnerTarget {
  id: string;
  partner_id: string;
  year: number;
  quarter: number;
  target_volume: number;
  created_by: string | null;
  created_at: string;
}
