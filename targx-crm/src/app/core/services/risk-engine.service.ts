import { Injectable } from '@angular/core';
import type { ScopingQuestion, RiskMultiplier } from '../models/quote.model';
import {
  detectRisks,
  calculateTotalMultiplier,
  hasBlockingRisk,
  validateRiskOverride,
} from './risk-engine.functions';
import type { DetectedRisk } from './risk-engine.functions';
import type { ScopingAnswers } from './scoping-engine.functions';

export type { DetectedRisk } from './risk-engine.functions';
export { RiskMultiplierError, RiskOverrideError } from './risk-engine.functions';

@Injectable({ providedIn: 'root' })
export class RiskEngineService {
  detectRisks(
    answers: ScopingAnswers,
    questions: ScopingQuestion[],
    multipliers: RiskMultiplier[]
  ): DetectedRisk[] {
    return detectRisks(answers, questions, multipliers);
  }

  calculateTotalMultiplier(risks: DetectedRisk[]): number {
    return calculateTotalMultiplier(risks);
  }

  hasBlockingRisk(risks: DetectedRisk[]): boolean {
    return hasBlockingRisk(risks);
  }

  validateRiskOverride(override: boolean, notes: string | undefined): void {
    validateRiskOverride(override, notes);
  }
}
