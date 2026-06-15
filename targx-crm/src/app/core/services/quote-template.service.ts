import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import type { Quote, QuotePhase, QuoteItem, QuoteTemplate } from '../models/quote.model';
import {
  buildTemplateFromQuote,
  loadTemplatePhases,
  checkTemplateCompatibility,
} from './quote-template.functions';
import type { QuotePhaseDto } from './scoping-engine.functions';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

export { buildTemplateFromQuote, loadTemplatePhases, checkTemplateCompatibility } from './quote-template.functions';

@Injectable({ providedIn: 'root' })
export class QuoteTemplateService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  buildTemplateFromQuote(
    quote: Quote,
    phases: QuotePhase[],
    items: QuoteItem[]
  ): { phases_data: unknown } {
    return buildTemplateFromQuote(quote, phases, items);
  }

  loadTemplatePhases(template: QuoteTemplate): QuotePhaseDto[] {
    return loadTemplatePhases(template);
  }

  checkTemplateCompatibility(
    template: QuoteTemplate,
    projectTypeId: string
  ): { compatible: boolean; warning?: string } {
    return checkTemplateCompatibility(template, projectTypeId);
  }

  loadTemplate(id: string): Observable<QuoteTemplate> {
    return from(
      this.#supabase
        .from('quote_templates')
        .select('*')
        .eq('id', id)
        .single()
        .then(({ data }) => data as QuoteTemplate)
    );
  }

  saveTemplate(template: Partial<QuoteTemplate>): Observable<QuoteTemplate> {
    return from(
      this.#supabase
        .from('quote_templates')
        .upsert(template)
        .select()
        .single()
        .then(({ data }) => data as QuoteTemplate)
    );
  }
}
