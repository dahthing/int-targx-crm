import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { AuthService } from './auth.service';
import {
  validateQuoteTransition,
  buildNewVersion,
  detectActiveVersionConflict,
  buildAuditEntry,
  ForbiddenError,
  ValidationError,
  QuoteLockedError,
  InvalidQuoteTransitionError,
  MarginTooLowError,
} from './quote-state.functions';
import type { Quote, QuoteStatus } from '../models/quote.model';

export {
  ForbiddenError,
  ValidationError,
  QuoteLockedError,
  InvalidQuoteTransitionError,
  MarginTooLowError,
} from './quote-state.functions';

@Injectable({ providedIn: 'root' })
export class QuoteStateService {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #auth = inject(AuthService);

  async transition(
    quoteId: string,
    newStatus: QuoteStatus,
    options?: { notes?: string; overrideRisk?: boolean },
  ): Promise<Quote> {
    // 1. Fetch quote
    const { data: quote, error: fetchError } = await this.#supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (fetchError || !quote) {
      throw new Error(`Orçamento não encontrado: ${fetchError?.message ?? quoteId}`);
    }

    const role = this.#auth.role();
    if (!role) throw new ForbiddenError('Utilizador não autenticado');

    const currentUserId = this.#auth.currentUser()?.id;
    if (!currentUserId) throw new ForbiddenError('Utilizador não autenticado');

    // 2. Validate transition (includes margin check when transitioning to em_revisao)
    validateQuoteTransition(quote as Quote, newStatus, {
      role,
      notes: options?.notes,
      currentMarginPct: (quote as Quote).calculated_margin_pct ?? undefined,
      minimumMarginPct: (quote as Quote).minimum_margin_pct ?? undefined,
    });

    const now = new Date().toISOString();

    // 3. Build update payload
    const updatePayload: Record<string, unknown> = {
      status: newStatus,
      updated_at: now,
    };

    if (newStatus === 'enviado_cliente') {
      updatePayload['client_accept_token'] = crypto.randomUUID();
      updatePayload['token_expires_at'] = new Date(
        Date.now() + 30 * 24 * 60 * 60 * 1000,
      ).toISOString();
      updatePayload['sent_at'] = now;
    }

    if (newStatus === 'aceite') {
      updatePayload['accepted_at'] = now;
    }

    if (newStatus === 'rejeitado') {
      updatePayload['rejected_at'] = now;
      if (options?.notes) {
        updatePayload['rejection_reason'] = options.notes;
      }
    }

    // 4. Update quote
    const { data: updatedQuote, error: updateError } = await this.#supabase
      .from('quotes')
      .update(updatePayload)
      .eq('id', quoteId)
      .select()
      .single();

    if (updateError || !updatedQuote) {
      throw new Error(`Falha ao actualizar orçamento: ${updateError?.message}`);
    }

    // 5. Insert status history
    const { error: historyError } = await this.#supabase
      .from('quote_status_history')
      .insert({
        quote_id: quoteId,
        from_status: (quote as Quote).status,
        to_status: newStatus,
        changed_by: currentUserId,
        notes: options?.notes ?? null,
        changed_at: now,
      });

    if (historyError) {
      console.error('[QuoteStateService] Failed to insert status history:', historyError.message);
    }

    // 6. Insert audit entry for status change
    const auditEntry = buildAuditEntry('status', (quote as Quote).status, newStatus, currentUserId);
    const { error: auditError } = await this.#supabase
      .from('quote_audit_logs')
      .insert({
        quote_id: quoteId,
        changed_by: auditEntry.changed_by,
        field: auditEntry.field,
        old_value: auditEntry.old_value,
        new_value: auditEntry.new_value,
        changed_at: now,
      });

    if (auditError) {
      console.error('[QuoteStateService] Failed to insert audit log:', auditError.message);
    }

    return updatedQuote as Quote;
  }

  async createVersion(quoteId: string): Promise<Quote> {
    // 1. Fetch parent quote with phases and items
    const { data: parentQuote, error: fetchError } = await this.#supabase
      .from('quotes')
      .select('*')
      .eq('id', quoteId)
      .single();

    if (fetchError || !parentQuote) {
      throw new Error(`Orçamento não encontrado: ${fetchError?.message ?? quoteId}`);
    }

    const parent = parentQuote as Quote;

    // 2. Build new version diff
    const versionDiff = buildNewVersion(parent);

    // 3. Check for active version conflict on same lead
    if (parent.lead_id) {
      const { data: siblingQuotes } = await this.#supabase
        .from('quotes')
        .select('status, lead_id')
        .eq('lead_id', parent.lead_id)
        .neq('id', quoteId);

      const hasConflict = detectActiveVersionConflict(
        (siblingQuotes ?? []) as Array<{ status: QuoteStatus; lead_id: string | null }>,
        parent.lead_id,
      );

      if (hasConflict) {
        throw new ValidationError(
          'Já existe uma versão activa deste orçamento. Feche-a antes de criar uma nova versão.',
        );
      }
    }

    // 4. Insert new quote row
    const { data: newQuote, error: insertError } = await this.#supabase
      .from('quotes')
      .insert({
        ...parent,
        id: undefined, // let DB generate new id
        status: versionDiff.status,
        version: versionDiff.version,
        parent_quote_id: versionDiff.parent_quote_id,
        pdf_url: null,
        portal_opened_at: null,
        portal_open_count: 0,
        client_accept_token: null,
        token_expires_at: null,
        sent_at: null,
        accepted_at: null,
        rejected_at: null,
        rejection_reason: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError || !newQuote) {
      throw new Error(`Falha ao criar nova versão: ${insertError?.message}`);
    }

    const newQuoteTyped = newQuote as Quote;

    // 5. Copy phases and items from parent
    const { data: parentPhases } = await this.#supabase
      .from('quote_phases')
      .select('*, quote_items(*)')
      .eq('quote_id', quoteId)
      .order('phase_order');

    if (parentPhases && parentPhases.length > 0) {
      for (const phase of parentPhases) {
        const items = (phase as Record<string, unknown>)['quote_items'] as Array<Record<string, unknown>> | undefined;

        const { data: newPhase, error: phaseError } = await this.#supabase
          .from('quote_phases')
          .insert({
            quote_id: newQuoteTyped.id,
            name: phase.name,
            description: phase.description,
            phase_order: phase.phase_order,
            duration_days: phase.duration_days,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (phaseError || !newPhase) {
          console.error('[QuoteStateService] Failed to copy phase:', phaseError?.message);
          continue;
        }

        if (items && items.length > 0) {
          const newItems = items.map((item) => ({
            phase_id: (newPhase as Record<string, unknown>)['id'],
            catalog_item_id: item['catalog_item_id'],
            name: item['name'],
            description: item['description'],
            pricing_type: item['pricing_type'],
            hours: item['hours'],
            rate_profile_id: item['rate_profile_id'],
            hourly_rate: item['hourly_rate'],
            unit_value: item['unit_value'],
            quantity: item['quantity'],
            item_order: item['item_order'],
            optional: item['optional'],
            optional_accepted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }));

          const { error: itemsError } = await this.#supabase
            .from('quote_items')
            .insert(newItems);

          if (itemsError) {
            console.error('[QuoteStateService] Failed to copy items:', itemsError.message);
          }
        }
      }
    }

    return newQuoteTyped;
  }
}
