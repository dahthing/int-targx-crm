import { Injectable, inject } from '@angular/core';
import { from, Observable } from 'rxjs';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Lead, LeadActivity, LeadStatus } from '../models/lead.model';
import { SupabaseService } from '../supabase/supabase.client';

// ── Erros de domínio ──────────────────────────────────────────────────────────

export class InvalidStateTransitionError extends Error {
  constructor(fromStatus: LeadStatus, toStatus: LeadStatus) {
    super(`Transição inválida: ${fromStatus} → ${toStatus}`);
    this.name = 'InvalidStateTransitionError';
  }
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

// ── Máquina de estados ────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  nova: ['contactada'],
  contactada: ['proposta_enviada', 'fechada_perdida'],
  proposta_enviada: ['negociacao', 'fechada_perdida'],
  negociacao: ['fechada_ganha', 'fechada_perdida'],
  fechada_ganha: [],
  fechada_perdida: [],
};

export function isValidTransition(fromStatus: LeadStatus, toStatus: LeadStatus): boolean {
  return VALID_TRANSITIONS[fromStatus]?.includes(toStatus) ?? false;
}

export function validateTransition(
  lead: Lead,
  newStatus: LeadStatus,
  lostReason?: string,
): void {
  if (!isValidTransition(lead.status, newStatus)) {
    throw new InvalidStateTransitionError(lead.status, newStatus);
  }
  if (newStatus === 'fechada_perdida' && !lostReason) {
    throw new ValidationError('lost_reason é obrigatório para fechada_perdida');
  }
}

// ── DTOs ──────────────────────────────────────────────────────────────────────

export interface CreateLeadDto {
  client_id?: string;
  partner_id: string;
  title: string;
  description?: string;
  estimated_value?: number;
  source?: string;
  next_action?: string;
  next_action_date?: string;
}

export interface CreateActivityDto {
  type: LeadActivity['type'];
  content: string;
  author_id: string;
}

export interface LeadFilters {
  partner_id?: string;
  status?: LeadStatus | LeadStatus[];
}

// ── Funções puras testáveis (sem Angular DI) ──────────────────────────────────

export async function getAllLeads(
  client: SupabaseClient,
  filters?: LeadFilters,
): Promise<Lead[]> {
  let query = client.from('leads').select('*, clients(name)');
  if (filters?.partner_id) {
    query = query.eq('partner_id', filters.partner_id) as typeof query;
  }
  if (filters?.status) {
    const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
    query = query.in('status', statuses) as typeof query;
  }
  const { data, error } = await query;
  if (error) throw error;
  return ((data ?? []) as Array<Lead & { clients?: { name: string } | null }>).map(row => ({
    ...row,
    client_name: (row.clients as { name: string } | null)?.name ?? null,
  })) as Lead[];
}

export async function addLeadActivity(
  client: SupabaseClient,
  leadId: string,
  activity: CreateActivityDto,
): Promise<LeadActivity> {
  const { data, error } = await client
    .from('lead_activities')
    .insert({ lead_id: leadId, ...activity })
    .select()
    .single();
  if (error) throw error;
  // DB trigger actualiza leads.last_activity_at e reset silence_alerted
  return data as LeadActivity;
}

export async function getSilentLeads(
  client: SupabaseClient,
  warningDays: number,
): Promise<Lead[]> {
  const warningDate = new Date(Date.now() - warningDays * 86400000).toISOString();
  const openStatuses: LeadStatus[] = ['nova', 'contactada', 'proposta_enviada', 'negociacao'];
  const { data, error } = await client
    .from('leads')
    .select('*')
    .in('status', openStatuses)
    .or(`last_activity_at.lt.${warningDate},last_activity_at.is.null`);
  if (error) throw error;
  return (data ?? []) as Lead[];
}

// ── Serviço Angular (usa as funções puras acima) ──────────────────────────────

@Injectable({ providedIn: 'root' })
export class LeadService {
  private readonly supabaseService = inject(SupabaseService);

  private get db(): SupabaseClient {
    return this.supabaseService.client;
  }

  getAll(filters?: LeadFilters): Observable<Lead[]> {
    return from(getAllLeads(this.db, filters));
  }

  getById(id: string): Observable<Lead & { activities: LeadActivity[] }> {
    return from(this._getById(id));
  }

  private async _getById(id: string): Promise<Lead & { activities: LeadActivity[] }> {
    const [leadRes, activitiesRes] = await Promise.all([
      this.db.from('leads').select('*').eq('id', id).single(),
      this.db
        .from('lead_activities')
        .select('*')
        .eq('lead_id', id)
        .order('activity_at', { ascending: false }),
    ]);
    if (leadRes.error) throw leadRes.error;
    return {
      ...(leadRes.data as Lead),
      activities: (activitiesRes.data ?? []) as LeadActivity[],
    };
  }

  async create(data: CreateLeadDto): Promise<Lead> {
    const { data: created, error } = await this.db
      .from('leads')
      .insert({ ...data, status: 'nova' })
      .select()
      .single();
    if (error) throw error;
    return created as Lead;
  }

  async update(id: string, data: Partial<Lead>): Promise<Lead> {
    const { data: updated, error } = await this.db
      .from('leads')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return updated as Lead;
  }

  async transition(id: string, newStatus: LeadStatus, lostReason?: string): Promise<Lead> {
    const lead = await this._getById(id);
    validateTransition(lead, newStatus, lostReason);
    return this.update(id, {
      status: newStatus,
      ...(lostReason ? { lost_reason: lostReason } : {}),
    });
  }

  addActivity(leadId: string, activity: CreateActivityDto): Promise<LeadActivity> {
    return addLeadActivity(this.db, leadId, activity);
  }

  getForPartner(partnerId: string): Promise<Lead[]> {
    return getAllLeads(this.db, { partner_id: partnerId });
  }

  getSilent(warningDays: number): Promise<Lead[]> {
    return getSilentLeads(this.db, warningDays);
  }
}
