import { Injectable, inject } from '@angular/core';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import { buildGanttData, adjustPhaseStart } from './gantt.functions';
import type { GanttPhase } from './gantt.functions';

export type { GanttPhase } from './gantt.functions';

@Injectable({ providedIn: 'root' })
export class GanttService {
  readonly #supabase = inject(SUPABASE_CLIENT);

  async getProjectGantt(projectId: string): Promise<GanttPhase[]> {
    // 1. Fetch project (contract_date, quote_id, daily_capacity_hours)
    const { data: project, error: projectError } = await this.#supabase
      .from('projects')
      .select('contract_date, quote_id, daily_capacity_hours')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      throw new Error(`Projecto não encontrado: ${projectError?.message ?? projectId}`);
    }

    const contractDate = project['contract_date'] as string | null;
    const quoteId = project['quote_id'] as string | null;
    const dailyCapacityHours = (project['daily_capacity_hours'] as number | null) ?? 8;

    if (!contractDate) {
      throw new Error('Projecto sem data de contrato definida');
    }

    if (!quoteId) {
      throw new Error('Projecto sem orçamento associado');
    }

    // 2. Fetch quote phases ordered by phase_order with total hours
    const { data: phases, error: phasesError } = await this.#supabase
      .from('quote_phases')
      .select('id, name, total_hours')
      .eq('quote_id', quoteId)
      .order('phase_order');

    if (phasesError) {
      throw new Error(`Falha ao carregar fases: ${phasesError.message}`);
    }

    const phasesData = (phases ?? []) as Array<{
      id: string;
      name: string;
      total_hours: number;
    }>;

    // 3. Build gantt data
    return buildGanttData(phasesData, new Date(contractDate), dailyCapacityHours);
  }

  async updatePhaseStart(
    projectId: string,
    phaseId: string,
    newStartDate: Date,
  ): Promise<GanttPhase[]> {
    // 1. Get current gantt
    const currentGantt = await this.getProjectGantt(projectId);

    // 2. Adjust the target phase and cascade
    const updatedGantt = adjustPhaseStart(currentGantt, phaseId, newStartDate, 8);

    // 3. Persist updated dates to supabase quote_phases
    for (const phase of updatedGantt) {
      const { error } = await this.#supabase
        .from('quote_phases')
        .update({
          start_date: phase.start_date.toISOString(),
          end_date: phase.end_date.toISOString(),
          duration_days: phase.duration_days,
        })
        .eq('id', phase.id);

      if (error) {
        console.error(`[GanttService] Failed to update phase ${phase.id}:`, error.message);
      }
    }

    return updatedGantt;
  }
}
