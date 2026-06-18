import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { CommissionPlan } from '../../../core/models/commission.model';

interface PartnerRow {
  id: string;
  full_name: string;
  email: string;
  active: boolean;
  plan_name: string | null;
  plan_id: string | null;
  active_from: string | null;
  leads_count: number;
  volume_ytd: number;
}

@Component({
  selector: 'app-partner-management',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToastModule],
  providers: [MessageService],
  styles: [`
    .drawer-overlay { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,0.4); }
    .drawer { position:fixed; top:0; right:0; height:100%; width:384px; z-index:50; display:flex; flex-direction:column; background:#fff; box-shadow:-4px 0 24px rgba(0,0,0,0.15); }
    .drawer-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--tx-gray-200); }
    .drawer-title { font-size:1rem; font-weight:600; color:var(--tx-gray-900); }
    .drawer-body { flex:1; padding:24px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
    .drawer-footer { padding:20px 24px; border-top:1px solid var(--tx-gray-200); display:flex; gap:12px; }
    .drawer-footer button { flex:1; }
  `],
  template: `
    <p-toast />

    <div style="padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div>
          <h1 class="page-title">Gestão de Parceiros</h1>
          <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">Parceiros registados, planos activos e métricas.</p>
        </div>
        <button class="tx-btn-primary" (click)="openInvite()">
          <i class="pi pi-user-plus"></i>Convidar parceiro
        </button>
      </div>

      @if (loading()) {
        <div class="tx-card" style="padding:48px;text-align:center">
          <i class="pi pi-spin pi-spinner" style="font-size:1.5rem;color:var(--tx-teal-500)"></i>
        </div>
      } @else if (partners().length === 0) {
        <div class="tx-card" style="padding:48px;text-align:center;color:var(--tx-gray-400)">
          Nenhum parceiro encontrado.
        </div>
      } @else {
        <div class="tx-card" style="overflow:hidden">
          <table class="tx-table" style="width:100%">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Plano activo</th>
                <th style="text-align:right">Leads</th>
                <th style="text-align:right">Volume YTD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (partner of partners(); track partner.id) {
                <tr>
                  <td>
                    <p style="font-weight:600;color:var(--tx-gray-900);margin:0">{{ partner.full_name }}</p>
                    <p style="font-size:0.8125rem;color:var(--tx-gray-400);margin:2px 0 0">{{ partner.email }}</p>
                  </td>
                  <td>
                    @if (partner.plan_name) {
                      <span class="tx-badge" style="background:var(--tx-teal-100);color:var(--tx-teal-700)">{{ partner.plan_name }}</span>
                      @if (partner.active_from) {
                        <p style="font-size:0.8125rem;color:var(--tx-gray-400);margin:4px 0 0">desde {{ formatDate(partner.active_from) }}</p>
                      }
                    } @else {
                      <span style="color:var(--tx-gray-400);font-size:0.875rem">Sem plano</span>
                    }
                  </td>
                  <td style="text-align:right;font-family:var(--font-mono)">{{ partner.leads_count }}</td>
                  <td style="text-align:right;font-family:var(--font-mono);font-weight:600;color:var(--tx-teal-600)">
                    {{ formatCurrency(partner.volume_ytd) }}
                  </td>
                  <td style="text-align:right">
                    <div style="display:flex;align-items:center;justify-content:flex-end;gap:8px">
                      <button class="tx-btn-secondary" style="font-size:0.8125rem;padding:6px 12px" (click)="openChangePlan(partner)">Mudar plano</button>
                      <button class="tx-btn-ghost" style="font-size:0.8125rem;padding:6px 12px" (click)="viewCommissions(partner)">Comissões</button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>

    <!-- Invite Drawer -->
    @if (showInviteDrawer()) {
      <div class="drawer-overlay" (click)="closeInvite()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Convidar Parceiro</span>
          <button class="tx-btn-ghost" (click)="closeInvite()" aria-label="Fechar"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="invite-email">Email *</label>
            <input id="invite-email" type="email" class="tx-input" [(ngModel)]="inviteEmail" placeholder="parceiro@empresa.com" />
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closeInvite()">Cancelar</button>
          <button class="tx-btn-primary" (click)="sendInvite()" [disabled]="!inviteEmail.trim() || saving()">
            @if (saving()) { <i class="pi pi-spin pi-spinner" style="margin-right:6px"></i> }
            Enviar convite
          </button>
        </div>
      </div>
    }

    <!-- Change Plan Drawer -->
    @if (showChangePlanDrawer()) {
      <div class="drawer-overlay" (click)="closeChangePlan()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Mudar Plano</span>
          <button class="tx-btn-ghost" (click)="closeChangePlan()" aria-label="Fechar"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <p style="font-size:0.875rem;color:var(--tx-gray-500)">
            Parceiro: <strong style="color:var(--tx-gray-900)">{{ selectedPartner()?.full_name }}</strong>
          </p>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="change-plan">Plano *</label>
            <select id="change-plan" class="tx-input" [(ngModel)]="changePlanId">
              <option value="">Seleccionar plano…</option>
              @for (plan of availablePlans(); track plan.id) {
                <option [value]="plan.id">{{ plan.name }}</option>
              }
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="change-from">Activo a partir de *</label>
            <input id="change-from" type="date" class="tx-input" [(ngModel)]="changeActiveFrom" />
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closeChangePlan()">Cancelar</button>
          <button class="tx-btn-primary" (click)="savePlanChange()" [disabled]="!changePlanId || saving()">
            @if (saving()) { <i class="pi pi-spin pi-spinner" style="margin-right:6px"></i> }
            Guardar
          </button>
        </div>
      </div>
    }
  `,
})
export class PartnerManagementComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly partners = signal<PartnerRow[]>([]);
  readonly availablePlans = signal<CommissionPlan[]>([]);
  readonly selectedPartner = signal<PartnerRow | null>(null);

  readonly showInviteDrawer = signal(false);
  readonly showChangePlanDrawer = signal(false);

  inviteEmail = '';
  changePlanId = '';
  changeActiveFrom = new Date().toISOString().split('T')[0];

  ngOnInit(): void {
    void this.#load();
  }

  async #load(): Promise<void> {
    const [profilesResult, leadsResult, tranchesResult, partnerPlansResult, plansResult] = await Promise.all([
      this.#supabase.from('profiles').select('id, full_name, email, active').eq('role', 'partner'),
      this.#supabase.from('leads').select('partner_id').in('status', ['nova', 'contactada', 'proposta_enviada', 'negociacao']),
      this.#supabase.from('project_tranches').select('projects!inner(partner_id), amount').eq('received', true),
      this.#supabase.from('partner_plans').select('*').is('active_to', null),
      this.#supabase.from('commission_plans').select('*').order('created_at', { ascending: true }),
    ]);

    if (profilesResult.error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: profilesResult.error.message });
      this.loading.set(false);
      return;
    }

    const profiles = (profilesResult.data ?? []) as Array<{ id: string; full_name: string; email: string; active: boolean }>;
    const leads = (leadsResult.data ?? []) as Array<{ partner_id: string }>;
    const tranches = (tranchesResult.data ?? []) as Array<{
      projects: Array<{ partner_id: string }> | null;
      amount: number;
    }>;
    const partnerPlans = (partnerPlansResult.data ?? []) as Array<{ partner_id: string; plan_id: string; active_from: string }>;
    const plans = (plansResult.data ?? []) as Array<CommissionPlan & { active?: boolean }>;

    const rows: PartnerRow[] = profiles.map(p => {
      const pp = partnerPlans.find(x => x.partner_id === p.id);
      const plan = pp ? plans.find(pl => pl.id === pp.plan_id) : null;
      const leadsCount = leads.filter(l => l.partner_id === p.id).length;
      const volumeYtd = tranches
        .filter(t => (t.projects?.[0]?.partner_id ?? null) === p.id)
        .reduce((sum, t) => sum + Number(t.amount), 0);

      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        active: p.active,
        plan_name: plan?.name ?? null,
        plan_id: plan?.id ?? null,
        active_from: pp?.active_from ?? null,
        leads_count: leadsCount,
        volume_ytd: volumeYtd,
      };
    });

    this.partners.set(rows);
    this.availablePlans.set(plans as CommissionPlan[]);
    this.loading.set(false);
  }

  openInvite(): void {
    this.inviteEmail = '';
    this.showInviteDrawer.set(true);
  }

  closeInvite(): void { this.showInviteDrawer.set(false); }

  async sendInvite(): Promise<void> {
    if (!this.inviteEmail.trim()) return;
    this.saving.set(true);

    const { error } = await this.#supabase.auth.admin.inviteUserByEmail(this.inviteEmail.trim(), {
      data: { role: 'partner' },
    });

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      this.#messageService.add({ severity: 'success', summary: 'Convite enviado', detail: `Convite enviado para ${this.inviteEmail}.` });
      this.closeInvite();
    }
    this.saving.set(false);
  }

  openChangePlan(partner: PartnerRow): void {
    this.selectedPartner.set(partner);
    this.changePlanId = partner.plan_id ?? '';
    this.changeActiveFrom = new Date().toISOString().split('T')[0];
    this.showChangePlanDrawer.set(true);
  }

  closeChangePlan(): void { this.showChangePlanDrawer.set(false); }

  async savePlanChange(): Promise<void> {
    const partner = this.selectedPartner();
    if (!partner || !this.changePlanId) return;
    this.saving.set(true);

    // Close existing plan
    if (partner.plan_id) {
      await this.#supabase
        .from('partner_plans')
        .update({ active_to: this.changeActiveFrom })
        .eq('partner_id', partner.id)
        .is('active_to', null);
    }

    // Insert new
    const { error } = await this.#supabase
      .from('partner_plans')
      .insert({
        partner_id: partner.id,
        plan_id: this.changePlanId,
        active_from: this.changeActiveFrom,
      });

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      this.#messageService.add({ severity: 'success', summary: 'Plano actualizado', detail: 'Plano do parceiro alterado.' });
      this.closeChangePlan();
      await this.#load();
    }
    this.saving.set(false);
  }

  viewCommissions(partner: PartnerRow): void {
    const year = new Date().getFullYear();
    void this.#router.navigate(['/commissions', partner.id, year]);
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT');
  }

  protected formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
