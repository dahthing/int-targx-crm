import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import type { Client } from '../models/client.model';
import { SupabaseService } from '../supabase/supabase.client';

@Injectable({ providedIn: 'root' })
export class ClientService {
  private readonly supabaseService = inject(SupabaseService);

  private get supabase() {
    return this.supabaseService.client;
  }

  getAll(): Observable<Client[]> {
    return from(this._getAll());
  }

  private async _getAll(): Promise<Client[]> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Client[];
  }

  getById(id: string): Observable<Client> {
    return from(this._getById(id));
  }

  private async _getById(id: string): Promise<Client> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    return data as Client;
  }

  async create(data: Omit<Client, 'id' | 'created_at' | 'updated_at'>): Promise<Client> {
    const { data: created, error } = await this.supabase
      .from('clients')
      .insert(data)
      .select()
      .single();
    if (error) throw error;
    return created as Client;
  }

  async update(id: string, data: Partial<Client>): Promise<Client> {
    const { data: updated, error } = await this.supabase
      .from('clients')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Client;
  }

  search(query: string): Observable<Client[]> {
    return from(this._search(query));
  }

  private async _search(query: string): Promise<Client[]> {
    const { data, error } = await this.supabase
      .from('clients')
      .select('*')
      .or(`name.ilike.%${query}%,nif.ilike.%${query}%`)
      .order('name', { ascending: true });
    if (error) throw error;
    return (data ?? []) as Client[];
  }
}
