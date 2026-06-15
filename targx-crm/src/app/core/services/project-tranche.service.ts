import { Injectable } from '@angular/core';
import { SupabaseClient } from '@supabase/supabase-js';
import { ProjectTranche } from '../models/project.model';

@Injectable({ providedIn: 'root' })
export class ProjectTrancheService {
  async markReceived(
    trancheId: string,
    receivedDate: string,
    client: SupabaseClient,
  ): Promise<ProjectTranche> {
    const { data, error } = await client
      .from('project_tranches')
      .update({ received: true, received_date: receivedDate, updated_at: new Date().toISOString() })
      .eq('id', trancheId)
      .select()
      .single();

    if (error) throw new Error(`markReceived: ${error.message}`);
    return data as ProjectTranche;
  }

  async markUnreceived(
    trancheId: string,
    client: SupabaseClient,
  ): Promise<ProjectTranche> {
    const { data, error } = await client
      .from('project_tranches')
      .update({ received: false, received_date: null, updated_at: new Date().toISOString() })
      .eq('id', trancheId)
      .select()
      .single();

    if (error) throw new Error(`markUnreceived: ${error.message}`);
    return data as ProjectTranche;
  }

  validateTrancheTotal(tranches: ProjectTranche[], contractValue: number): boolean {
    if (tranches.length === 0) return true;
    const total = tranches.reduce((sum, t) => sum + t.amount, 0);
    const excess = (total - contractValue) / contractValue;
    return excess <= 0.01;
  }

  isProjectComplete(tranches: ProjectTranche[]): boolean {
    if (tranches.length === 0) return false;
    return tranches.every(t => t.received);
  }
}
