import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export const SUPABASE_CLIENT = new InjectionToken<SupabaseClient>('SupabaseClient');

export function createSupabaseClient(): SupabaseClient {
  return createClient(environment.supabaseUrl, environment.supabaseAnonKey);
}
