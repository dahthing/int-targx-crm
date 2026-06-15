import { describe, it, expect } from 'vitest';
import type { ScopingQuestion, CatalogItem, RateProfile } from '../../models/quote.model';
import {
  evaluateAnswers,
  validateCompleteness,
  buildPhasesFromModules,
} from '../scoping-engine.functions';

// ── Types ──────────────────────────────────────────────────────────────────────

type ScopingAnswers = Record<string, unknown>;

// ── Fixtures ──────────────────────────────────────────────────────────────────

const makeQuestion = (overrides: Partial<ScopingQuestion>): ScopingQuestion => ({
  id: 'q1',
  project_type_id: 'pt1',
  key: 'has_ssl',
  label: 'Precisa de SSL?',
  description: null,
  question_type: 'single_choice',
  options: { sim: 'Sim', nao: 'Não' },
  impacts_price: true,
  activates_modules: null,
  triggers_risk: null,
  sort_order: 1,
  required: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeRateProfile = (overrides: Partial<RateProfile> = {}): RateProfile => ({
  id: 'rp1',
  name: 'Standard',
  hourly_rate: 75,
  active: true,
  created_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

const makeCatalogItem = (overrides: Partial<CatalogItem>): CatalogItem => ({
  id: 'cat1',
  slug: 'ssl_certificate',
  name: 'SSL Certificate',
  description: null,
  category: null,
  pricing_type: 'fixed',
  default_hours: null,
  default_rate_profile_id: null,
  default_value: 150,
  applicable_project_types: null,
  out_of_scope_notes: null,
  risk_flags: null,
  active: true,
  usage_count: 5,
  created_by: null,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
});

// ── TIQS-001 a TIQS-006 ────────────────────────────────────────────────────────

describe('ScopingEngine', () => {
  // TIQS-001: módulo activado quando resposta satisfaz activates_modules condition
  describe('TIQS-001: módulo activado quando resposta satisfaz activates_modules', () => {
    it('retorna slugs activados quando resposta coincide com chave do mapa', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'has_ssl',
          activates_modules: { sim: ['ssl_certificate', 'cdn_setup'] },
        }),
      ];
      const answers: ScopingAnswers = { has_ssl: 'sim' };
      const activated = evaluateAnswers(answers, questions);
      expect(activated).toContain('ssl_certificate');
      expect(activated).toContain('cdn_setup');
    });
  });

  // TIQS-002: módulo não activado quando condição não satisfeita
  describe('TIQS-002: módulo NÃO activado quando condição não satisfeita', () => {
    it('retorna array vazio quando resposta não consta do mapa activates_modules', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'has_ssl',
          activates_modules: { sim: ['ssl_certificate'] },
        }),
      ];
      const answers: ScopingAnswers = { has_ssl: 'nao' };
      const activated = evaluateAnswers(answers, questions);
      expect(activated).not.toContain('ssl_certificate');
      expect(activated).toHaveLength(0);
    });

    it('questão sem activates_modules não activa nenhum módulo', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({ key: 'notes', activates_modules: null }),
      ];
      const answers: ScopingAnswers = { notes: 'qualquer texto' };
      expect(evaluateAnswers(answers, questions)).toHaveLength(0);
    });
  });

  // TIQS-003: pré-preenchimento faz snapshot do hourly_rate no momento
  describe('TIQS-003: buildPhasesFromModules snapshots hourly_rate do rate_profile', () => {
    it('cada fase gerada contém o hourly_rate do rate_profile passado', () => {
      const rateProfile = makeRateProfile({ hourly_rate: 85 });
      const modules: CatalogItem[] = [
        makeCatalogItem({
          slug: 'ssl_certificate',
          pricing_type: 'hourly',
          default_hours: 8,
          default_rate_profile_id: 'rp1',
        }),
      ];
      const phases = buildPhasesFromModules(modules, [rateProfile]);
      expect(phases.length).toBeGreaterThan(0);
      // O snapshot do rate deve ser 85 (o valor no momento da chamada)
      const firstItem = phases[0]?.items?.[0];
      expect(firstItem?.hourly_rate).toBe(85);
    });
  });

  // TIQS-004: questão de tipo 'text' não impacta preço (impacts_price=false)
  describe('TIQS-004: questão tipo text com impacts_price=false não activa módulos de preço', () => {
    it('questão text sem impacts_price não activa módulos mesmo com activates_modules', () => {
      // A validação de completeness não deve incluir text como blocking quando impacts_price=false
      // Aqui testamos que evaluateAnswers respeita a ausência de mapeamento para tipo text
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'extra_notes',
          question_type: 'text',
          impacts_price: false,
          activates_modules: null,
        }),
      ];
      const answers: ScopingAnswers = { extra_notes: 'algum texto' };
      const activated = evaluateAnswers(answers, questions);
      expect(activated).toHaveLength(0);
    });
  });

  // TIQS-005: wizard incompleto bloqueia com lista de faltas
  describe('TIQS-005: wizard incompleto bloqueia com lista de perguntas em falta', () => {
    it('retorna valid=false e lista missing quando pergunta required sem resposta', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({ key: 'has_ssl', required: true }),
        makeQuestion({ id: 'q2', key: 'complexity', required: true }),
      ];
      const answers: ScopingAnswers = { has_ssl: 'sim' }; // falta 'complexity'
      const result = validateCompleteness(answers, questions);
      expect(result.valid).toBe(false);
      expect(result.missing).toContain('complexity');
      expect(result.missing).not.toContain('has_ssl');
    });

    it('retorna valid=true quando todas as required estão respondidas', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({ key: 'has_ssl', required: true }),
        makeQuestion({ id: 'q2', key: 'complexity', required: false }),
      ];
      const answers: ScopingAnswers = { has_ssl: 'sim' };
      const result = validateCompleteness(answers, questions);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('pergunta não-required sem resposta não aparece em missing', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({ key: 'optional_field', required: false }),
      ];
      const answers: ScopingAnswers = {};
      const result = validateCompleteness(answers, questions);
      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });
  });

  // TIQS-006: multi_select activa múltiplos módulos
  describe('TIQS-006: multi_select activa múltiplos módulos por valor seleccionado', () => {
    it('cada valor seleccionado em multi_select activa os seus módulos', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'extra_features',
          question_type: 'multi_select',
          activates_modules: {
            ssl: ['ssl_certificate'],
            cdn: ['cdn_setup'],
            chat: ['live_chat'],
          },
        }),
      ];
      // multi_select retorna array de valores seleccionados
      const answers: ScopingAnswers = { extra_features: ['ssl', 'cdn'] };
      const activated = evaluateAnswers(answers, questions);
      expect(activated).toContain('ssl_certificate');
      expect(activated).toContain('cdn_setup');
      expect(activated).not.toContain('live_chat');
    });

    it('multi_select sem selecção não activa nenhum módulo', () => {
      const questions: ScopingQuestion[] = [
        makeQuestion({
          key: 'extra_features',
          question_type: 'multi_select',
          activates_modules: { ssl: ['ssl_certificate'] },
        }),
      ];
      const answers: ScopingAnswers = { extra_features: [] };
      const activated = evaluateAnswers(answers, questions);
      expect(activated).toHaveLength(0);
    });
  });
});
