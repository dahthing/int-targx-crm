export type NotificationType =
  | 'lead_assigned'
  | 'lead_silence'
  | 'quote_submitted'
  | 'quote_returned'
  | 'quote_approved'
  | 'quote_accepted'
  | 'quote_rejected'
  | 'quote_portal_opened'
  | 'commission_paid'
  | 'bonus_reached'
  | 'bonus_near'
  | 'project_created';

export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  read_at: string | null;
  created_at: string;
}
