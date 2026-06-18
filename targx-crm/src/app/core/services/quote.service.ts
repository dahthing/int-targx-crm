import { Injectable, inject } from '@angular/core';
import { from, Observable, map } from 'rxjs';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import type {
  Quote,
  QuotePhase,
  QuoteItem,
  QuoteStatus,
} from '../models/quote.model';
import type { QuotePhaseDto } from './scoping-engine.functions';

export interface CreateQuoteDto {
  lead_id?: string | null;
  client_id: string;
  partner_id: string;
  project_type_id?: string | null;
  template_id?: string | null;
  title: string;
  description?: string | null;
  scoping_answers?: Record<string, unknown> | null;
  scoping_completed?: boolean;
  detected_risks?: Record<string, unknown> | null;
  risk_multiplier_total?: number;
  has_blocking_risk?: boolean;
  subtotal_base?: number | null;
  risk_adjustment?: number | null;
  subtotal_with_risk?: number | null;
  discount_pct?: number;
  total_before_tax?: number | null;
  total_with_tax?: number | null;
  minimum_margin_pct?: number | null;
  calculated_margin_pct?: number | null;
}

export type QuoteWithPhases = Quote & {
  phases: (QuotePhase & { items: QuoteItem[] })[];
};

@Injectable({ providedIn: 'root' })
export class QuoteService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  getAll(filters?: { partner_id?: string; client_id?: string; lead_id?: string; status?: QuoteStatus }): Observable<Quote[]> {
    return from(
      (async () => {
        let query = this.#supabase
          .from('quotes')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.partner_id) {
          query = query.eq('partner_id', filters.partner_id);
        }
        if (filters?.client_id) {
          query = query.eq('client_id', filters.client_id);
        }
        if (filters?.lead_id) {
          query = query.eq('lead_id', filters.lead_id);
        }
        if (filters?.status) {
          query = query.eq('status', filters.status);
        }

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as Quote[];
      })()
    );
  }

  getById(id: string): Observable<QuoteWithPhases> {
    return from(
      (async () => {
        const { data: quote, error: qErr } = await this.#supabase
          .from('quotes')
          .select('*')
          .eq('id', id)
          .single();
        if (qErr) throw qErr;

        const { data: phases, error: pErr } = await this.#supabase
          .from('quote_phases')
          .select('*')
          .eq('quote_id', id)
          .order('phase_order', { ascending: true });
        if (pErr) throw pErr;

        const phaseIds = (phases ?? []).map((p: QuotePhase) => p.id);
        let items: QuoteItem[] = [];
        if (phaseIds.length > 0) {
          const { data: itemsData, error: iErr } = await this.#supabase
            .from('quote_items')
            .select('*')
            .in('phase_id', phaseIds)
            .order('item_order', { ascending: true });
          if (iErr) throw iErr;
          items = (itemsData ?? []) as QuoteItem[];
        }

        const phasesWithItems = (phases ?? [] as QuotePhase[]).map((phase: QuotePhase) => ({
          ...phase,
          items: items.filter((item: QuoteItem) => item.phase_id === phase.id),
        }));

        return { ...(quote as Quote), phases: phasesWithItems } as QuoteWithPhases;
      })()
    );
  }

  async create(data: CreateQuoteDto): Promise<Quote> {
    const { data: quote, error } = await this.#supabase
      .from('quotes')
      .insert({
        ...data,
        status: 'rascunho',
        version: 1,
        discount_pct: data.discount_pct ?? 0,
        risk_multiplier_total: data.risk_multiplier_total ?? 1,
        has_blocking_risk: data.has_blocking_risk ?? false,
        scoping_completed: data.scoping_completed ?? false,
        portal_open_count: 0,
      })
      .select()
      .single();
    if (error) throw error;
    return quote as Quote;
  }

  async update(id: string, data: Partial<Quote>): Promise<Quote> {
    const { data: quote, error } = await this.#supabase
      .from('quotes')
      .update(data)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return quote as Quote;
  }

  async savePhasesAndItems(quoteId: string, phases: QuotePhaseDto[]): Promise<void> {
    // Delete all existing phases (cascades to items via FK or we delete items first)
    const { data: existingPhases } = await this.#supabase
      .from('quote_phases')
      .select('id')
      .eq('quote_id', quoteId);

    if (existingPhases && existingPhases.length > 0) {
      const ids = existingPhases.map((p: { id: string }) => p.id);
      await this.#supabase.from('quote_items').delete().in('phase_id', ids);
      await this.#supabase.from('quote_phases').delete().in('id', ids);
    }

    // Insert phases
    for (const [phaseIndex, phase] of phases.entries()) {
      const { data: insertedPhase, error: pErr } = await this.#supabase
        .from('quote_phases')
        .insert({
          quote_id: quoteId,
          name: phase.name,
          description: phase.description,
          phase_order: phase.phase_order ?? phaseIndex + 1,
        })
        .select()
        .single();
      if (pErr) throw pErr;

      if (phase.items && phase.items.length > 0) {
        const itemsToInsert = phase.items.map((item, itemIndex) => ({
          phase_id: (insertedPhase as QuotePhase).id,
          name: item.name,
          description: item.description,
          pricing_type: item.pricing_type,
          hours: item.hours,
          hourly_rate: item.hourly_rate,
          unit_value: item.unit_value,
          quantity: item.quantity,
          item_order: item.item_order ?? itemIndex + 1,
          optional: item.optional,
          optional_accepted: false,
          catalog_item_id: item.catalog_item_id,
          rate_profile_id: item.rate_profile_id,
        }));

        const { error: iErr } = await this.#supabase
          .from('quote_items')
          .insert(itemsToInsert);
        if (iErr) throw iErr;
      }
    }
  }

  async createVersion(quoteId: string): Promise<Quote> {
    const original = await this.getById(quoteId).toPromise();
    if (!original) throw new Error('Quote not found');

    const newQuote = await this.create({
      lead_id: original.lead_id,
      client_id: original.client_id,
      partner_id: original.partner_id,
      project_type_id: original.project_type_id,
      title: original.title,
      description: original.description,
      scoping_answers: original.scoping_answers,
      scoping_completed: original.scoping_completed,
    });

    await this.update(newQuote.id, {
      version: original.version + 1,
      parent_quote_id: quoteId,
    });

    if (original.phases.length > 0) {
      const phaseDtos: QuotePhaseDto[] = original.phases.map((phase, i) => ({
        name: phase.name,
        description: phase.description,
        phase_order: i + 1,
        items: phase.items.map((item, j) => ({
          name: item.name,
          description: item.description,
          pricing_type: item.pricing_type,
          hours: item.hours,
          hourly_rate: item.hourly_rate,
          unit_value: item.unit_value,
          quantity: item.quantity,
          item_order: j + 1,
          optional: item.optional,
          catalog_item_id: item.catalog_item_id,
          rate_profile_id: item.rate_profile_id,
        })),
      }));
      await this.savePhasesAndItems(newQuote.id, phaseDtos);
    }

    return newQuote;
  }

  getVersions(leadId: string): Observable<Quote[]> {
    return from(
      this.#supabase
        .from('quotes')
        .select('*')
        .eq('lead_id', leadId)
        .order('version', { ascending: true })
        .then(({ data }) => (data ?? []) as Quote[])
    );
  }

  transition(quoteId: string, newStatus: QuoteStatus, notes?: string): Observable<Quote> {
    return from(
      (async () => {
        const { data: quote, error: qErr } = await this.#supabase
          .from('quotes')
          .update({ status: newStatus, updated_at: new Date().toISOString() })
          .eq('id', quoteId)
          .select()
          .single();
        if (qErr) throw qErr;

        await this.#supabase.from('quote_status_history').insert({
          quote_id: quoteId,
          to_status: newStatus,
          notes: notes ?? null,
        });

        return quote as Quote;
      })()
    );
  }

  getStatusHistory(quoteId: string): Observable<import('../models/quote.model').QuoteStatusHistory[]> {
    return from(
      this.#supabase
        .from('quote_status_history')
        .select('*')
        .eq('quote_id', quoteId)
        .order('changed_at', { ascending: false })
        .then(({ data }) => (data ?? []) as import('../models/quote.model').QuoteStatusHistory[])
    );
  }

  applyRiskOverride(quoteId: string, notes: string): Observable<Partial<Quote>> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('quotes')
          .update({ admin_risk_override: true, admin_risk_notes: notes, updated_at: new Date().toISOString() })
          .eq('id', quoteId)
          .select('admin_risk_override, admin_risk_notes')
          .single();
        if (error) throw error;
        return data as Partial<Quote>;
      })()
    );
  }
}
