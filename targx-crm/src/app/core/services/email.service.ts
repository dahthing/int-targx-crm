import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { isAlreadySent, recordEmailError } from './email.functions';

export interface SendEmailPayload {
  to: string[];
  subject: string;
  html: string;
  event_key: string;
  quote_id?: string;
  partner_id?: string;
}

@Injectable({ providedIn: 'root' })
export class EmailService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async send(payload: SendEmailPayload): Promise<void> {
    // 1. Idempotency check via email_logs
    const { data: logs, error: logsError } = await this.#supabase
      .from('email_logs')
      .select('event_key')
      .eq('event_key', payload.event_key)
      .limit(1);

    if (logsError) {
      console.warn('EmailService: failed to check email_logs:', logsError.message);
    }

    if (isAlreadySent(logs ?? [], payload.event_key)) {
      return; // already sent — skip silently
    }

    // 2. Call edge function to keep RESEND_API_KEY server-side
    const { error: sendError } = await this.#supabase.functions.invoke('send-email', {
      body: { to: payload.to, subject: payload.subject, html: payload.html },
    });

    if (sendError) {
      // 3. Record error in email_logs without throwing
      const errorRecord = recordEmailError(sendError);
      await this.#supabase.from('email_logs').insert({
        event_key: payload.event_key,
        quote_id: payload.quote_id ?? null,
        partner_id: payload.partner_id ?? null,
        status: 'error',
        error: errorRecord.error,
        sent_at: errorRecord.sent_at,
      });
      return;
    }

    // 4. Record success
    await this.#supabase.from('email_logs').insert({
      event_key: payload.event_key,
      quote_id: payload.quote_id ?? null,
      partner_id: payload.partner_id ?? null,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }
}
