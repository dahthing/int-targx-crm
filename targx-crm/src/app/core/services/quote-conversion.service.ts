import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import {
  parseTranches,
  calculateContractValue,
  calculateEstimatedHours,
  buildConversionPayload,
  isAlreadyConverted,
  QuoteItemForConversion,
  QuoteItemForHours,
} from './quote-conversion.functions';

interface QuoteRow {
  id: string;
  client_id: string;
  partner_id: string | null;
  lead_id: string | null;
  title: string;
  total_before_tax: number | null;
  payment_terms: string | null;
  quote_template_id: string | null;
}

interface QuoteItemRow extends QuoteItemForConversion, QuoteItemForHours {
  catalog_item_id: string | null;
}

@Injectable({ providedIn: 'root' })
export class QuoteConversionService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async convertToProject(quoteId: string): Promise<{ projectId: string }> {
    // 1. Check idempotency — return existing project if already converted
    const { data: existingProjects, error: existingError } = await this.#supabase
      .from('projects')
      .select('id, quote_id')
      .eq('quote_id', quoteId);

    if (existingError) throw new Error(`convertToProject: ${existingError.message}`);

    if (isAlreadyConverted(existingProjects ?? [], quoteId)) {
      const existing = existingProjects!.find((p) => p.quote_id === quoteId)!;
      return { projectId: existing.id };
    }

    // 2. Fetch quote
    const { data: quote, error: quoteError } = await this.#supabase
      .from('quotes')
      .select('id, client_id, partner_id, lead_id, title, total_before_tax, payment_terms, quote_template_id')
      .eq('id', quoteId)
      .single();

    if (quoteError) throw new Error(`convertToProject (quote fetch): ${quoteError.message}`);
    const q = quote as QuoteRow;

    // 3. Fetch quote items
    const { data: items, error: itemsError } = await this.#supabase
      .from('quote_items')
      .select(
        'optional, optional_accepted, unit_value, hours, hourly_rate, quantity, pricing_type, catalog_item_id',
      )
      .eq('quote_id', quoteId);

    if (itemsError) throw new Error(`convertToProject (items fetch): ${itemsError.message}`);
    const quoteItems = (items ?? []) as QuoteItemRow[];

    // 4. Calculate values
    const contractValue = calculateContractValue(q.total_before_tax ?? 0, quoteItems);
    const estimatedHours = calculateEstimatedHours(quoteItems);
    const payload = buildConversionPayload(q, contractValue, estimatedHours);

    // 5. Insert project
    const { data: project, error: projectError } = await this.#supabase
      .from('projects')
      .insert(payload)
      .select('id')
      .single();

    if (projectError) throw new Error(`convertToProject (insert project): ${projectError.message}`);
    const projectId = (project as { id: string }).id;

    // 6. Parse and insert tranches
    const paymentTerms = q.payment_terms ?? '100% fecho';
    const tranches = parseTranches(paymentTerms, contractValue);

    if (tranches.length > 0) {
      const trancheRows = tranches.map((t) => ({ ...t, project_id: projectId }));
      const { error: trancheError } = await this.#supabase
        .from('project_tranches')
        .insert(trancheRows);

      if (trancheError) throw new Error(`convertToProject (insert tranches): ${trancheError.message}`);
    }

    // 7. Update lead status → 'fechada_ganha'
    if (q.lead_id) {
      await this.#supabase
        .from('leads')
        .update({ status: 'fechada_ganha', updated_at: new Date().toISOString() })
        .eq('id', q.lead_id);
    }

    // 8. Increment usage_count on catalog_items
    const catalogItemIds = quoteItems
      .filter((i) => i.catalog_item_id != null)
      .map((i) => i.catalog_item_id as string);

    for (const catalogId of catalogItemIds) {
      await this.#supabase.rpc('increment_catalog_item_usage', { item_id: catalogId });
    }

    // 9. Increment usage_count on quote_template
    if (q.quote_template_id) {
      await this.#supabase.rpc('increment_template_usage', { template_id: q.quote_template_id });
    }

    // 10. Trigger commission calculation via edge function
    const { error: commissionError } = await this.#supabase.functions.invoke(
      'calculate-commission',
      { body: { projectId } },
    );

    if (commissionError) {
      // Non-fatal: log but don't throw — project is already created
      console.warn('calculate-commission edge function failed:', commissionError.message);
    }

    return { projectId };
  }
}
