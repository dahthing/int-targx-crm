import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { inject, Injectable, InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SupabaseClient');

export function createSupabaseClient(): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.supabaseAnonKey);
}

@Injectable({ providedIn: 'root' })
export class SupabaseService {
  readonly #client = inject(SUPABASE_CLIENT);

  get client(): SupabaseClient {
    return this.#client;
  }
}
