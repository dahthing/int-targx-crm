import { Injectable, inject } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';

interface AccumulatedVolumeParams {
  partnerId: string;
  year: number;
  excludeTrancheId?: string;
}

@Injectable({ providedIn: 'root' })
export class AccumulatedVolumeService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async getAccumulatedVolume(params: AccumulatedVolumeParams): Promise<number> {
    return this.#queryVolume(params, this.#supabase);
  }

  async getAccumulatedVolumeWithClient(
    params: AccumulatedVolumeParams,
    client: SupabaseClient,
  ): Promise<number> {
    return this.#queryVolume(params, client);
  }

  async #queryVolume(params: AccumulatedVolumeParams, client: SupabaseClient): Promise<number> {
    const { partnerId, year, excludeTrancheId } = params;

    const yearStart = `${year}-01-01`;
    const yearEnd = `${year + 1}-01-01`;

    let query = client
      .from('project_tranches')
      .select('amount, projects!inner(partner_id, contract_date)')
      .eq('received', true)
      .eq('projects.partner_id', partnerId)
      .gte('received_date', yearStart)
      .lt('received_date', yearEnd);

    if (excludeTrancheId) {
      query = query.neq('id', excludeTrancheId);
    }

    const { data, error } = await query;

    if (error) throw new Error(`AccumulatedVolumeService: ${error.message}`);

    return (data ?? []).reduce((sum: number, row: { amount: number }) => sum + (row.amount ?? 0), 0);
  }
}
