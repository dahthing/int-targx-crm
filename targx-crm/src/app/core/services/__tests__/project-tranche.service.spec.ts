import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ProjectTrancheService } from '../project-tranche.service';
import { ProjectTranche } from '../../models/project.model';

/* Mock do SupabaseClient */
function makeSupabaseMock(overrides: Record<string, unknown> = {}) {
  const mock = {
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    delete: vi.fn().mockReturnThis(),
    ...overrides,
  };
  return mock;
}

const baseProject = {
  id: 'proj-1',
  contract_value: 10000,
  status: 'em_curso' as const,
  quote_id: null,
  lead_id: null,
  client_id: 'c1',
  partner_id: 'p1',
  title: 'Projecto Teste',
  description: null,
  contract_date: '2026-01-01',
  estimated_hours: null,
  actual_hours: null,
  created_by: null,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

const baseTranche: ProjectTranche = {
  id: 't1',
  project_id: 'proj-1',
  description: 'Tranche adjudicação',
  amount: 4000,
  due_date: null,
  received: false,
  received_date: null,
  commission_paid: false,
  created_at: '2026-01-01',
  updated_at: '2026-01-01',
};

describe('ProjectTrancheService', () => {
  let service: ProjectTrancheService;

  beforeEach(() => {
    service = new ProjectTrancheService();
  });

  // COM-018: markReceived actualiza campos received e received_date
  it('COM-018: markReceived define received=true e received_date', async () => {
    const updatedTranche = { ...baseTranche, received: true, received_date: '2026-06-13' };
    const supabaseMock = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({ data: updatedTranche, error: null }),
    });

    const result = await service.markReceived(baseTranche.id, '2026-06-13', supabaseMock as never);
    expect(result.received).toBe(true);
    expect(result.received_date).toBe('2026-06-13');
  });

  // COM-019: markReceived dispara cálculo de comissão (verifica que a trigger é chamada via webhook Supabase — aqui validamos o return)
  it('COM-019: markReceived retorna tranche actualizada para o caller disparar o cálculo', async () => {
    const updatedTranche = { ...baseTranche, received: true, received_date: '2026-06-13' };
    const supabaseMock = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({ data: updatedTranche, error: null }),
    });

    const result = await service.markReceived(baseTranche.id, '2026-06-13', supabaseMock as never);
    expect(result).toBeDefined();
    expect(result.id).toBe('t1');
  });

  // COM-020: desmarcar tranche define received=false
  it('COM-020: markUnreceived define received=false e recalcula comissão', async () => {
    const updatedTranche = { ...baseTranche, received: false, received_date: null };
    const supabaseMock = makeSupabaseMock({
      single: vi.fn().mockResolvedValue({ data: updatedTranche, error: null }),
    });

    const result = await service.markUnreceived(baseTranche.id, supabaseMock as never);
    expect(result.received).toBe(false);
    expect(result.received_date).toBeNull();
  });

  // COM-021: soma das tranches não excede contract_value em mais de 1%
  it('COM-021: validateTrancheTotal retorna false se soma excede contract_value em >1%', () => {
    const tranches: ProjectTranche[] = [
      { ...baseTranche, id: 't1', amount: 4000 },
      { ...baseTranche, id: 't2', amount: 4000 },
      { ...baseTranche, id: 't3', amount: 3000 }, // total = 11000, contract = 10000 → +10% > 1%
    ];

    const valid = service.validateTrancheTotal(tranches, baseProject.contract_value);
    expect(valid).toBe(false);
  });

  it('COM-021b: validateTrancheTotal retorna true se soma está dentro de 1% do contract_value', () => {
    const tranches: ProjectTranche[] = [
      { ...baseTranche, id: 't1', amount: 4000 },
      { ...baseTranche, id: 't2', amount: 3000 },
      { ...baseTranche, id: 't3', amount: 3000 }, // total = 10000 = exacto
    ];

    const valid = service.validateTrancheTotal(tranches, baseProject.contract_value);
    expect(valid).toBe(true);
  });

  // COM-022: projecto marcado como concluído quando todas as tranches estão recebidas
  it('COM-022: isProjectComplete retorna true quando todas as tranches estão recebidas', () => {
    const tranches: ProjectTranche[] = [
      { ...baseTranche, id: 't1', received: true },
      { ...baseTranche, id: 't2', received: true },
      { ...baseTranche, id: 't3', received: true },
    ];

    const complete = service.isProjectComplete(tranches);
    expect(complete).toBe(true);
  });

  it('COM-022b: isProjectComplete retorna false quando existe tranche por receber', () => {
    const tranches: ProjectTranche[] = [
      { ...baseTranche, id: 't1', received: true },
      { ...baseTranche, id: 't2', received: false },
    ];

    const complete = service.isProjectComplete(tranches);
    expect(complete).toBe(false);
  });

  it('COM-022c: isProjectComplete retorna false quando lista de tranches está vazia', () => {
    const complete = service.isProjectComplete([]);
    expect(complete).toBe(false);
  });
});
