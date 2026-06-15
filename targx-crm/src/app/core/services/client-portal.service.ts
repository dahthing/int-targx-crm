import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import {
  validateToken,
  buildAcceptanceUpdate,
  buildRejectionUpdate,
  buildPortalOpenUpdate,
  TokenInvalidError,
  TokenExpiredError,
} from './client-portal.functions';
import type { Quote } from '../models/quote.model';
import type { Client } from '../models/client.model';

export { TokenInvalidError, TokenExpiredError } from './client-portal.functions';

@Injectable({ providedIn: 'root' })
export class ClientPortalService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async getQuoteByToken(token: string): Promise<{ quote: Quote; client: Client }> {
    // 1. Fetch quote by portal token, include client
    const { data, error } = await this.#supabase
      .from('quotes')
      .select('*, clients(*)')
      .eq('client_accept_token', token)
      .single();

    if (error || !data) {
      throw new TokenInvalidError();
    }

    const quote = data as Quote & { clients: Client };

    // 2. Validate token (throws if invalid or expired)
    validateToken(token, quote.token_expires_at);

    // 3. Build portal open update
    const openUpdate = buildPortalOpenUpdate(quote.portal_open_count ?? 0);

    // 4. Update quotes table with portal open fields
    const portalUpdate: Record<string, unknown> = {
      portal_open_count: openUpdate.portal_open_count,
    };
    if (openUpdate.portal_opened_at) {
      portalUpdate['portal_opened_at'] = openUpdate.portal_opened_at;
    }

    const { error: updateError } = await this.#supabase
      .from('quotes')
      .update(portalUpdate)
      .eq('id', quote.id);

    if (updateError) {
      console.error('[ClientPortalService] Failed to update portal_open_count:', updateError.message);
    }

    // 5. Notify partner/admin on first open
    if (openUpdate.should_notify) {
      const { error: fnError } = await this.#supabase.functions.invoke(
        'handle-client-portal-open',
        { body: { quoteId: quote.id } },
      );
      if (fnError) {
        console.error('[ClientPortalService] Failed to invoke handle-client-portal-open:', fnError.message);
      }
    }

    const client = (data as Record<string, unknown>)['clients'] as Client;
    return { quote, client };
  }

  async acceptQuote(token: string, acceptedOptionalIds: string[]): Promise<void> {
    // 1. Fetch and validate quote
    const { quote } = await this.getQuoteByToken(token);

    // 2. Build acceptance update
    const acceptanceUpdate = buildAcceptanceUpdate(acceptedOptionalIds);

    // 3. Update quote
    const { error: updateError } = await this.#supabase
      .from('quotes')
      .update(acceptanceUpdate)
      .eq('id', quote.id);

    if (updateError) {
      throw new Error(`Falha ao registar aceitação: ${updateError.message}`);
    }

    // Mark accepted optionals
    if (acceptedOptionalIds.length > 0) {
      const { error: optionalsError } = await this.#supabase
        .from('quote_items')
        .update({ optional_accepted: true })
        .in('id', acceptedOptionalIds);

      if (optionalsError) {
        console.error('[ClientPortalService] Failed to update optional items:', optionalsError.message);
      }
    }

    // 4. Call edge function handle-client-response
    const { error: fnError } = await this.#supabase.functions.invoke(
      'handle-client-response',
      { body: { quoteId: quote.id, action: 'aceite' } },
    );

    if (fnError) {
      console.error('[ClientPortalService] Failed to invoke handle-client-response:', fnError.message);
    }
  }

  async rejectQuote(token: string, reason: string): Promise<void> {
    // 1. Fetch and validate quote
    const { quote } = await this.getQuoteByToken(token);

    // 2. Build rejection update (throws if reason is empty)
    const rejectionUpdate = buildRejectionUpdate(reason);

    // 3. Update quote
    const { error: updateError } = await this.#supabase
      .from('quotes')
      .update(rejectionUpdate)
      .eq('id', quote.id);

    if (updateError) {
      throw new Error(`Falha ao registar rejeição: ${updateError.message}`);
    }

    // 4. Call edge function handle-client-response
    const { error: fnError } = await this.#supabase.functions.invoke(
      'handle-client-response',
      { body: { quoteId: quote.id, action: 'rejeitado' } },
    );

    if (fnError) {
      console.error('[ClientPortalService] Failed to invoke handle-client-response:', fnError.message);
    }
  }
}
