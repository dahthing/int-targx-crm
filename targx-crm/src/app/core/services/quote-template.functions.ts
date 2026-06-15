import type { Quote, QuotePhase, QuoteItem, QuoteTemplate } from '../models/quote.model';
import type { QuotePhaseDto, QuoteItemDto } from './scoping-engine.functions';

interface PhasesData {
  phases: Array<{
    name: string;
    description: string | null;
    phase_order: number;
    duration_days: number | null;
    items: QuoteItemDto[];
  }>;
}

export function buildTemplateFromQuote(
  _quote: Quote,
  phases: QuotePhase[],
  items: QuoteItem[]
): { phases_data: PhasesData } {
  const phasesData: PhasesData = {
    phases: phases.map(phase => {
      const phaseItems = items
        .filter(item => item.phase_id === phase.id)
        .map((item): QuoteItemDto => ({
          name: item.name,
          description: item.description,
          pricing_type: item.pricing_type,
          hours: item.hours,
          hourly_rate: item.hourly_rate,
          unit_value: item.unit_value,
          quantity: item.quantity,
          item_order: item.item_order,
          optional: item.optional,
          catalog_item_id: item.catalog_item_id,
          rate_profile_id: item.rate_profile_id,
        }));

      return {
        name: phase.name,
        description: phase.description,
        phase_order: phase.phase_order,
        duration_days: phase.duration_days,
        items: phaseItems,
      };
    }),
  };

  return { phases_data: phasesData };
}

export function loadTemplatePhases(template: QuoteTemplate): QuotePhaseDto[] {
  const raw = template.phases_data as Partial<PhasesData>;

  if (!raw.phases || !Array.isArray(raw.phases)) return [];

  return raw.phases.map(phase => ({
    name: phase.name,
    description: phase.description ?? null,
    phase_order: phase.phase_order,
    items: Array.isArray(phase.items) ? phase.items : [],
  }));
}

export function checkTemplateCompatibility(
  template: QuoteTemplate,
  projectTypeId: string
): { compatible: boolean; warning?: string } {
  if (template.project_type_id === null || template.project_type_id === undefined) {
    return { compatible: true };
  }

  if (template.project_type_id === projectTypeId) {
    return { compatible: true };
  }

  return {
    compatible: false,
    warning: `Template "${template.name}" foi criado para o tipo de projecto "${template.project_type_id}" mas está a ser aplicado a "${projectTypeId}". Os itens podem não ser adequados.`,
  };
}
