import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import type { Project, ProjectTranche, ProjectStatus, ProjectHoursLog, NewHoursEntry } from '../models/project.model';
import type { QuotePhase } from '../models/quote.model';

export interface ProjectWithDetails extends Project {
  phases: QuotePhase[];
  tranches: ProjectTranche[];
}

@Injectable({ providedIn: 'root' })
export class ProjectService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  getAll(filters?: { partner_id?: string; status?: ProjectStatus }): Observable<Project[]> {
    return from(
      (async () => {
        let query = this.#supabase
          .from('projects')
          .select('*')
          .order('created_at', { ascending: false });

        if (filters?.partner_id) query = query.eq('partner_id', filters.partner_id);
        if (filters?.status) query = query.eq('status', filters.status);

        const { data, error } = await query;
        if (error) throw error;
        return (data ?? []) as Project[];
      })()
    );
  }

  getById(id: string): Observable<ProjectWithDetails> {
    return from(
      (async () => {
        const { data: project, error: pErr } = await this.#supabase
          .from('projects')
          .select('*')
          .eq('id', id)
          .single();
        if (pErr) throw pErr;

        const phases: QuotePhase[] = [];
        if (project['quote_id']) {
          const { data: phaseData } = await this.#supabase
            .from('quote_phases')
            .select('*')
            .eq('quote_id', project['quote_id'])
            .order('phase_order', { ascending: true });
          phases.push(...((phaseData ?? []) as QuotePhase[]));
        }

        const { data: trancheData } = await this.#supabase
          .from('project_tranches')
          .select('*')
          .eq('project_id', id)
          .order('created_at', { ascending: true });

        return {
          ...(project as Project),
          phases,
          tranches: (trancheData ?? []) as ProjectTranche[],
        } as ProjectWithDetails;
      })()
    );
  }

  updateTranche(id: string, received: boolean, receivedDate: string | null): Observable<ProjectTranche> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('project_tranches')
          .update({
            received,
            received_date: received ? receivedDate : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as ProjectTranche;
      })()
    );
  }

  getHoursLog(projectId: string): Observable<ProjectHoursLog[]> {
    return from(
      (async () => {
        const { data, error } = await this.#supabase
          .from('project_hours_log')
          .select('*')
          .eq('project_id', projectId)
          .order('logged_date', { ascending: false });
        if (error) throw error;
        return (data ?? []) as ProjectHoursLog[];
      })()
    );
  }

  addHoursEntry(projectId: string, entry: NewHoursEntry): Observable<void> {
    return from(
      (async () => {
        const { error: insertErr } = await this.#supabase
          .from('project_hours_log')
          .insert({ project_id: projectId, ...entry });
        if (insertErr) throw insertErr;

        // Recalculate actual_hours from sum
        const { data: sumData, error: sumErr } = await this.#supabase
          .from('project_hours_log')
          .select('hours')
          .eq('project_id', projectId);
        if (sumErr) throw sumErr;

        const totalHours = (sumData ?? []).reduce(
          (acc: number, row: { hours: number }) => acc + Number(row.hours),
          0
        );

        const { error: updateErr } = await this.#supabase
          .from('projects')
          .update({ actual_hours: totalHours, updated_at: new Date().toISOString() })
          .eq('id', projectId);
        if (updateErr) throw updateErr;
      })()
    );
  }
}
