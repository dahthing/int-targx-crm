import type { ScopingQuestion, CatalogItem, RateProfile } from '../models/quote.model';

export type ScopingAnswers = Record<string, unknown>;

export interface QuoteItemDto {
  name: string;
  description: string | null;
  pricing_type: 'hourly' | 'fixed';
  hours: number | null;
  hourly_rate: number | null;
  unit_value: number | null;
  quantity: number;
  item_order: number;
  optional: boolean;
  catalog_item_id: string | null;
  rate_profile_id: string | null;
}

export interface QuotePhaseDto {
  name: string;
  description: string | null;
  phase_order: number;
  items: QuoteItemDto[];
}

export function evaluateAnswers(
  answers: ScopingAnswers,
  questions: ScopingQuestion[]
): string[] {
  const activated: string[] = [];

  for (const question of questions) {
    if (!question.activates_modules) continue;

    const answer = answers[question.key];

    if (question.question_type === 'multi_select') {
      if (!Array.isArray(answer)) continue;
      for (const val of answer) {
        const slugs = question.activates_modules[String(val)];
        if (slugs) activated.push(...slugs);
      }
    } else {
      if (answer === undefined || answer === null) continue;
      const slugs = question.activates_modules[String(answer)];
      if (slugs) activated.push(...slugs);
    }
  }

  return activated;
}

export function buildPhasesFromModules(
  modules: CatalogItem[],
  rateProfiles: RateProfile[]
): QuotePhaseDto[] {
  const items: QuoteItemDto[] = modules.map((mod, index) => {
    const rateProfile = mod.default_rate_profile_id
      ? rateProfiles.find(rp => rp.id === mod.default_rate_profile_id) ?? null
      : null;

    return {
      name: mod.name,
      description: mod.description,
      pricing_type: mod.pricing_type,
      hours: mod.default_hours,
      hourly_rate: rateProfile?.hourly_rate ?? null,
      unit_value: mod.default_value,
      quantity: 1,
      item_order: index + 1,
      optional: false,
      catalog_item_id: mod.id,
      rate_profile_id: mod.default_rate_profile_id,
    };
  });

  return [
    {
      name: 'Desenvolvimento',
      description: null,
      phase_order: 1,
      items,
    },
  ];
}

export function validateCompleteness(
  answers: ScopingAnswers,
  questions: ScopingQuestion[]
): { valid: boolean; missing: string[] } {
  const missing = questions
    .filter(q => q.required)
    .filter(q => {
      const answer = answers[q.key];
      return answer === undefined || answer === null || answer === '';
    })
    .map(q => q.key);

  return { valid: missing.length === 0, missing };
}
