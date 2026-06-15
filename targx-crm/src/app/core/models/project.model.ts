export type ProjectStatus = 'em_curso' | 'concluido' | 'cancelado';

export interface Project {
  id: string;
  quote_id: string | null;
  lead_id: string | null;
  client_id: string;
  partner_id: string | null;
  title: string;
  description: string | null;
  contract_value: number;
  contract_date: string;
  status: ProjectStatus;
  estimated_hours: number | null;
  actual_hours: number | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectTranche {
  id: string;
  project_id: string;
  description: string;
  amount: number;
  due_date: string | null;
  received: boolean;
  received_date: string | null;
  commission_paid: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProjectHoursLog {
  id: string;
  project_id: string;
  user_id: string;
  logged_date: string;
  description: string;
  hours: number;
  created_at: string;
}

export interface NewHoursEntry {
  logged_date: string;
  description: string;
  hours: number;
  user_id: string;
}
