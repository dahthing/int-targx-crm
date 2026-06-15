import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { buildPdfPath, needsSignedUrlRefresh } from './pdf-generator.functions';

@Injectable({ providedIn: 'root' })
export class PdfGeneratorService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async generateQuotePdf(quoteId: string): Promise<string> {
    // Call edge function generate-quote-pdf
    const { data, error } = await this.#supabase.functions.invoke('generate-quote-pdf', {
      body: { quoteId },
    });

    if (error) {
      throw new Error(`Falha ao gerar PDF: ${error.message}`);
    }

    const pdfUrl = (data as Record<string, unknown>)?.['pdfUrl'] as string | undefined;
    if (!pdfUrl) {
      throw new Error('Edge Function não retornou URL do PDF');
    }

    return pdfUrl;
  }

  async getPdfUrl(quoteId: string, version: number): Promise<string | null> {
    // 1. Fetch stored pdf_url from quotes table
    const { data: quote, error } = await this.#supabase
      .from('quotes')
      .select('pdf_url')
      .eq('id', quoteId)
      .eq('version', version)
      .single();

    if (error || !quote) return null;

    const storedUrl = (quote as Record<string, unknown>)['pdf_url'] as string | null;
    if (!storedUrl) return null;

    // 2. Check if URL needs refresh
    if (!needsSignedUrlRefresh(storedUrl)) {
      return storedUrl;
    }

    // 3. Get fresh signed URL from storage
    const storagePath = buildPdfPath(quoteId, version);
    const { data: signedData, error: signedError } = await this.#supabase.storage
      .from('quotes')
      .createSignedUrl(storagePath, 365 * 24 * 60 * 60); // 1 year in seconds

    if (signedError || !signedData?.signedUrl) {
      console.error('[PdfGeneratorService] Failed to create signed URL:', signedError?.message);
      return storedUrl; // fall back to possibly-expired URL
    }

    // Update stored URL in DB
    const { error: updateError } = await this.#supabase
      .from('quotes')
      .update({ pdf_url: signedData.signedUrl, updated_at: new Date().toISOString() })
      .eq('id', quoteId)
      .eq('version', version);

    if (updateError) {
      console.error('[PdfGeneratorService] Failed to update pdf_url:', updateError.message);
    }

    return signedData.signedUrl;
  }

  async generateCommissionStatement(partnerId: string, month: string): Promise<string> {
    // Call edge function generate-commission-statement
    const { data, error } = await this.#supabase.functions.invoke(
      'generate-commission-statement',
      { body: { partnerId, month } },
    );

    if (error) {
      throw new Error(`Falha ao gerar extracto de comissões: ${error.message}`);
    }

    const pdfUrl = (data as Record<string, unknown>)?.['pdfUrl'] as string | undefined;
    if (!pdfUrl) {
      throw new Error('Edge Function não retornou URL do extracto');
    }

    return pdfUrl;
  }
}
