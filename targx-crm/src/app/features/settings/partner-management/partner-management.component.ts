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
  template: `
    <p-toast />

    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2" style="color: var(--tx-gray-950)">Gestão de Parceiros</h1>
          <p class="text-body-sm mt-1" style="color: var(--text-secondary)">Parceiros registados, planos activos e métricas.</p>
        </div>
        <button class="tx-btn-primary" (click)="openInvite()">+ Convidar parceiro</button>
      </div>

      @if (loading()) {
        <div class="tx-card py-12 text-center">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else if (partners().length === 0) {
        <div class="tx-card py-12 text-center" style="color: var(--text-muted)">
          Nenhum parceiro encontrado.
        </div>
      } @else {
        <div class="tx-card overflow-hidden">
          <table class="tx-table w-full">
            <thead>
              <tr>
                <th>Parceiro</th>
                <th>Plano activo</th>
                <th class="text-right">Leads</th>
                <th class="text-right">Volume YTD</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (partner of partners(); track partner.id) {
                <tr>
                  <td>
                    <p class="font-semibold" style="color: var(--tx-gray-900)">{{ partner.full_name }}</p>
                    <p class="text-body-sm" style="color: var(--text-muted)">{{ partner.email }}</p>
                  </td>
                  <td>
                    @if (partner.plan_name) {
                      <div>
                        <span class="tx-badge" style="background: var(--tx-teal-100); color: var(--tx-teal-700)">
                          {{ partner.plan_name }}
                        </span>
                        @if (partner.active_from) {
                          <p class="text-body-sm mt-1" style="color: var(--text-muted)">desde {{ formatDate(partner.active_from) }}</p>
                        }
                      </div>
                    } @else {
                      <span style="color: var(--text-muted)">Sem plano</span>
                    }
                  </td>
                  <td class="text-right font-mono">{{ partner.leads_count }}</td>
                  <td class="text-right font-mono font-semibold" style="color: var(--tx-teal-600)">
                    {{ formatCurrency(partner.volume_ytd) }}
                  </td>
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-2">
                      <button
                        class="tx-btn-secondary text-sm px-3 py-1.5"
                        (click)="openChangePlan(partner)"
                        aria-label="Mudar plano"
                      >
                        Mudar plano
                      </button>
                      <button
                        class="tx-btn-ghost text-sm px-3 py-1.5"
                        (click)="viewCommissions(partner)"
                        aria-label="Ver comissões"
                      >
                        Comissões
                      </button>
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
      <div class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.4)" (click)="closeInvite()"></div>
      <div class="fixed top-0 right-0 h-full w-96 z-50 flex flex-col"
           style="background: var(--surface-card); box-shadow: -4px 0 24px rgba(0,0,0,0.15)">
        <div class="flex items-center justify-between p-6 border-b" style="border-color: var(--tx-gray-200)">
          <h3 class="text-h3">Convidar Parceiro</h3>
          <button class="tx-btn-ghost p-1" (click)="closeInvite()" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 p-6 flex flex-col gap-4">
          <div class="tx-field">
            <label class="tx-form-label" for="invite-email">Email *</label>
            <input id="invite-email" type="email" class="tx-input" [(ngModel)]="inviteEmail" placeholder="parceiro@empresa.com" />
          </div>
        </div>
        <div class="p-6 border-t flex gap-3" style="border-color: var(--tx-gray-200)">
          <button class="tx-btn-secondary flex-1" (click)="closeInvite()">Cancelar</button>
          <button class="tx-btn-primary flex-1" (click)="sendInvite()" [disabled]="!inviteEmail.trim() || saving()">
            @if (saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
            Enviar convite
          </button>
        </div>
      </div>
    }

    <!-- Change Plan Drawer -->
    @if (showChangePlanDrawer()) {
      <div class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.4)" (click)="closeChangePlan()"></div>
      <div class="fixed top-0 right-0 h-full w-96 z-50 flex flex-col"
           style="background: var(--surface-card); box-shadow: -4px 0 24px rgba(0,0,0,0.15)">
        <div class="flex items-center justify-between p-6 border-b" style="border-color: var(--tx-gray-200)">
          <h3 class="text-h3">Mudar Plano</h3>
          <button class="tx-btn-ghost p-1" (click)="closeChangePlan()" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 p-6 flex flex-col gap-4">
          <p class="text-body" style="color: var(--text-secondary)">
            Parceiro: <strong>{{ selectedPartner()?.full_name }}</strong>
          </p>
          <div class="tx-field">
            <label class="tx-form-label" for="change-plan">Plano *</label>
            <select id="change-plan" class="tx-input" [(ngModel)]="changePlanId">
              <option value="">Seleccionar plano…</option>
              @for (plan of availablePlans(); track plan.id) {
                <option [value]="plan.id">{{ plan.name }}</option>
              }
            </select>
          </div>
          <div class="tx-field">
            <label class="tx-form-label" for="change-from">Activo a partir de *</label>
            <input id="change-from" type="date" class="tx-input" [(ngModel)]="changeActiveFrom" />
          </div>
        </div>
        <div class="p-6 border-t flex gap-3" style="border-color: var(--tx-gray-200)">
          <button class="tx-btn-secondary flex-1" (click)="closeChangePlan()">Cancelar</button>
          <button class="tx-btn-primary flex-1" (click)="savePlanChange()" [disabled]="!changePlanId || saving()">
            @if (saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
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
    const tranches = (tranchesResult.data ?? []) as Array<{ projects: { partner_id: string } | null; amount: number }>;
    const partnerPlans = (partnerPlansResult.data ?? []) as Array<{ partner_id: string; plan_id: string; active_from: string }>;
    const plans = (plansResult.data ?? []) as Array<CommissionPlan & { active?: boolean }>;

    const currentYear = new Date().getFullYear();

    const rows: PartnerRow[] = profiles.map(p => {
      const pp = partnerPlans.find(x => x.partner_id === p.id);
      const plan = pp ? plans.find(pl => pl.id === pp.plan_id) : null;
      const leadsCount = leads.filter(l => l.partner_id === p.id).length;
      const volumeYtd = tranches
        .filter(t => t.projects?.partner_id === p.id)
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
