export interface EmailLog {
  id: string;
  recipient: string;
  type: string;
  subject: string;
  event_key: string | null;
  sent_at: string;
  resend_id: string | null;
  error: string | null;
}
