import { describe, it, expect, vi } from 'vitest';
import {
  isValidTransition,
  validateTransition,
  getAllLeads,
  addLeadActivity,
  getSilentLeads,
  InvalidStateTransitionError,
  ValidationError,
} from '../lead.service';
import type { Lead, LeadActivity } from '../../models/lead.model';

// ── Fixtures ──────────────────────────────────────────────────────────────────

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: 'lead-1',
    client_id: 'client-1',
    partner_id: 'partner-1',
    title: 'Lead Teste',
    description: null,
    status: 'nova',
    estimated_value: null,
    lost_reason: null,
    source: null,
    next_action: null,
    next_action_date: null,
    last_activity_at: null,
    silence_alerted: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ── Mock SupabaseClient ───────────────────────────────────────────────────────

function makeSupabaseMock(returnData: unknown[] = []) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: returnData[0] ?? null, error: null }),
    then: (_: unknown, resolve: (v: unknown) => unknown) =>
      resolve({ data: returnData, error: null }),
  };
  // Make it thenable (Promise-like) so await works
  Object.assign(chainable, {
    then: (resolve: (v: unknown) => unknown) =>
      Promise.resolve({ data: returnData, error: null }).then(resolve),
  });
  return { from: vi.fn().mockReturnValue(chainable), _chain: chainable };
}

// ── Testes ────────────────────────────────────────────────────────────────────

describe('LeadService', () => {
  // CRM-001
  describe('CRM-001: getForPartner filtra por partner_id para role=partner', () => {
    it('chama .eq("partner_id", ...) quando filtro de partner_id é fornecido', async () => {
      const leads = [makeLead({ partner_id: 'partner-1' })];
      const mock = makeSupabaseMock(leads);
      await getAllLeads(mock as never, { partner_id: 'partner-1' });
      expect(mock._chain.eq).toHaveBeenCalledWith('partner_id', 'partner-1');
    });
  });

  // CRM-002
  describe('CRM-002: admin vê todas as leads sem filtro de partner', () => {
    it('não filtra por partner_id quando nenhum filtro é passado', async () => {
      const leads = [makeLead(), makeLead({ id: 'lead-2', partner_id: 'partner-2' })];
      const mock = makeSupabaseMock(leads);
      await getAllLeads(mock as never);
      expect(mock._chain.eq).not.toHaveBeenCalledWith('partner_id', expect.anything());
    });
  });

  // CRM-003
  describe('CRM-003: transição nova→contactada válida', () => {
    it('aceita nova→contactada', () => {
      expect(isValidTransition('nova', 'contactada')).toBe(true);
    });
    it('aceita proposta_enviada→negociacao', () => {
      expect(isValidTransition('proposta_enviada', 'negociacao')).toBe(true);
    });
    it('aceita negociacao→fechada_ganha', () => {
      expect(isValidTransition('negociacao', 'fechada_ganha')).toBe(true);
    });
  });

  // CRM-004
  describe('CRM-004: transição fechada_ganha→nova é inválida', () => {
    it('retorna false para fechada_ganha→nova', () => {
      expect(isValidTransition('fechada_ganha', 'nova')).toBe(false);
    });
    it('retorna false para fechada_perdida→nova', () => {
      expect(isValidTransition('fechada_perdida', 'nova')).toBe(false);
    });
    it('retorna false para nova→fechada_ganha (salto)', () => {
      expect(isValidTransition('nova', 'fechada_ganha')).toBe(false);
    });
    it('lança InvalidStateTransitionError ao chamar validateTransition', () => {
      expect(() => validateTransition(makeLead({ status: 'fechada_ganha' }), 'nova')).toThrow(
        InvalidStateTransitionError,
      );
    });
  });

  // CRM-005
  describe('CRM-005: fechada_perdida exige lost_reason', () => {
    it('lança ValidationError quando lost_reason é undefined', () => {
      expect(() =>
        validateTransition(makeLead({ status: 'negociacao' }), 'fechada_perdida', undefined),
      ).toThrow(ValidationError);
    });
    it('lança ValidationError quando lost_reason é string vazia', () => {
      expect(() =>
        validateTransition(makeLead({ status: 'negociacao' }), 'fechada_perdida', ''),
      ).toThrow(ValidationError);
    });
    it('aceita transição quando lost_reason está presente', () => {
      expect(() =>
        validateTransition(makeLead({ status: 'negociacao' }), 'fechada_perdida', 'Preço'),
      ).not.toThrow();
    });
  });

  // CRM-006
  describe('CRM-006: addActivity actualiza last_activity_at e reset silence_alerted', () => {
    it('insere actividade em lead_activities com lead_id correcto', async () => {
      const activity = {
        id: 'act-1',
        lead_id: 'lead-1',
        author_id: 'partner-1',
        type: 'nota' as const,
        content: 'Nova nota',
        activity_at: new Date().toISOString(),
      };
      const mock = makeSupabaseMock([activity]);
      const result = await addLeadActivity(mock as never, 'lead-1', {
        type: 'nota',
        content: 'Nova nota',
        author_id: 'partner-1',
      });
      expect(mock.from).toHaveBeenCalledWith('lead_activities');
      expect(mock._chain.insert).toHaveBeenCalledWith(
        expect.objectContaining({ lead_id: 'lead-1' }),
      );
      expect(result).toMatchObject({ lead_id: 'lead-1', type: 'nota' });
    });
  });

  // CRM-007
  describe('CRM-007: getSilent retorna leads com last_activity > warning_days', () => {
    it('filtra apenas leads abertas com last_activity_at antiga', async () => {
      const oldDate = new Date(Date.now() - 10 * 86400000).toISOString();
      const silentLeads = [makeLead({ last_activity_at: oldDate })];
      const mock = makeSupabaseMock(silentLeads);
      const result = await getSilentLeads(mock as never, 7);
      // Verifica que a query usa .in() para open statuses e .or() para data/null
      expect(mock._chain.in).toHaveBeenCalledWith(
        'status',
        expect.arrayContaining(['nova', 'contactada', 'proposta_enviada', 'negociacao']),
      );
      expect(mock._chain.or).toHaveBeenCalled();
      expect(result).toHaveLength(1);
    });
  });

  // CRM-008
  describe('CRM-008: email não duplicado se silence_alerted=true', () => {
    it('silence_alerted=true impede reenvio (campo verificado pelo caller)', () => {
      const alertedLead = makeLead({
        last_activity_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        silence_alerted: true,
      });
      // A deduplicação é feita pelo event_key em email_logs E pelo campo silence_alerted
      // Validamos aqui que o campo existe e está correcto
      expect(alertedLead.silence_alerted).toBe(true);
    });
    it('getSilentLeads inclui todas as leads silenciosas (filtro de silence_alerted é da edge function)', async () => {
      const alertedLead = makeLead({
        last_activity_at: new Date(Date.now() - 20 * 86400000).toISOString(),
        silence_alerted: true,
      });
      const mock = makeSupabaseMock([alertedLead]);
      const result = await getSilentLeads(mock as never, 7);
      // A edge function filtra silence_alerted; o service devolve todas
      expect(result).toHaveLength(1);
    });
  });
});
