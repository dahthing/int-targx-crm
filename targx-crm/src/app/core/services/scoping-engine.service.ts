import { Injectable } from '@angular/core';
import type { ScopingQuestion, CatalogItem, RateProfile } from '../models/quote.model';
import {
  evaluateAnswers,
  validateCompleteness,
  buildPhasesFromModules,
} from './scoping-engine.functions';
import type { ScopingAnswers, QuotePhaseDto } from './scoping-engine.functions';

@Injectable({ providedIn: 'root' })
export class ScopingEngineService {
  evaluateAnswers(answers: ScopingAnswers, questions: ScopingQuestion[]): string[] {
    return evaluateAnswers(answers, questions);
  }

  validateCompleteness(
    answers: ScopingAnswers,
    questions: ScopingQuestion[]
  ): { valid: boolean; missing: string[] } {
    return validateCompleteness(answers, questions);
  }

  buildPhasesFromModules(
    modules: CatalogItem[],
    rateProfiles: RateProfile[]
  ): QuotePhaseDto[] {
    return buildPhasesFromModules(modules, rateProfiles);
  }
}
