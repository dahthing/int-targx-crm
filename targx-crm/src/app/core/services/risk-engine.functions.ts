import type { ScopingQuestion, RiskMultiplier } from '../models/quote.model';
import type { ScopingAnswers } from './scoping-engine.functions';

export interface DetectedRisk {
  key: string;
  multiplier: number;
  is_blocking: boolean;
  name: string;
}

export class RiskMultiplierError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RiskMultiplierError';
  }
}

export class RiskOverrideError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RiskOverrideError';
  }
}

export function detectRisks(
  answers: ScopingAnswers,
  questions: ScopingQuestion[],
  multipliers: RiskMultiplier[]
): DetectedRisk[] {
  const detected: DetectedRisk[] = [];

  for (const question of questions) {
    if (!question.triggers_risk) continue;

    const trigger = question.triggers_risk as {
      condition: string;
      value: number;
      risk_key: string;
    };

    const answer = answers[question.key];
    if (answer === undefined || answer === null) continue;

    let conditionMet = false;

    if (trigger.condition === 'gte') {
      conditionMet = Number(answer) >= (trigger.value as number);
    } else if (trigger.condition === 'lte') {
      conditionMet = Number(answer) <= (trigger.value as number);
    } else if (trigger.condition === 'eq') {
      conditionMet = String(answer) === String(trigger.value);
    } else if (trigger.condition === 'neq') {
      conditionMet = String(answer) !== String(trigger.value);
    }

    if (!conditionMet) continue;

    const multiplier = multipliers.find(m => m.key === trigger.risk_key);
    if (!multiplier) continue;

    detected.push({
      key: multiplier.key,
      multiplier: multiplier.multiplier,
      is_blocking: multiplier.is_blocking,
      name: multiplier.name,
    });
  }

  return detected;
}

export function calculateTotalMultiplier(risks: DetectedRisk[]): number {
  if (risks.length === 0) return 1.0;

  return risks.reduce((acc, risk) => {
    if (risk.multiplier < 1.0) {
      throw new RiskMultiplierError(
        `Risk multiplier must be >= 1.0, got ${risk.multiplier} for risk "${risk.key}"`
      );
    }
    return acc * risk.multiplier;
  }, 1.0);
}

export function hasBlockingRisk(risks: DetectedRisk[]): boolean {
  return risks.some(r => r.is_blocking);
}

export function validateRiskOverride(
  override: boolean,
  notes: string | undefined
): void {
  if (!override) return;

  if (!notes || notes.trim() === '') {
    throw new RiskOverrideError(
      'Risk override requires justification notes to be provided.'
    );
  }
}
