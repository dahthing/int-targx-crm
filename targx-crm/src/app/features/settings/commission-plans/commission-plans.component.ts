import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type {
  CommissionPlan,
  CommissionTier,
  CommissionBonus,
} from '../../../core/models/commission.model';

interface PlanWithDetails extends CommissionPlan {
  active: boolean;
  tiers: CommissionTier[];
  bonuses: CommissionBonus[];
  expanded: boolean;
}

@Component({
  selector: 'app-commission-plans',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2" style="color: var(--tx-gray-950)">Planos de Comissão</h1>
          <p class="text-body-sm mt-1" style="color: var(--text-secondary)">Gerir planos, tiers e bónus anuais.</p>
        </div>
        <button class="tx-btn-primary" (click)="openNewPlan()">+ Novo plano</button>
      </div>

      @if (loading()) {
        <div class="tx-card py-12 text-center">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else if (plans().length === 0) {
        <div class="tx-card py-12 text-center" style="color: var(--text-muted)">
          Nenhum plano criado ainda.
        </div>
      } @else {
        <div class="flex flex-col gap-4">
          @for (plan of plans(); track plan.id) {
            <div class="tx-card">
              <!-- Plan header -->
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-3">
                  <button
                    class="w-6 h-6 flex items-center justify-center transition-transform"
                    [class.rotate-90]="plan.expanded"
                    (click)="toggleExpand(plan)"
                    [attr.aria-label]="plan.expanded ? 'Recolher' : 'Expandir'"
                  >
                    <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
                    </svg>
                  </button>
                  <h2 class="text-h3">{{ plan.name }}</h2>
                  @if (plan.active) {
                    <span class="tx-badge" style="background: var(--tx-teal-100); color: var(--tx-teal-700)">Activo</span>
                  } @else {
                    <span class="tx-badge" style="background: var(--tx-gray-100); color: var(--tx-gray-600)">Inactivo</span>
                  }
                </div>
              </div>

              @if (plan.expanded) {
                <div class="mt-4 pl-9">
                  <!-- Tiers -->
                  <div class="mb-4">
                    <div class="flex items-center justify-between mb-2">
                      <h3 class="text-body font-semibold" style="color: var(--tx-gray-700)">Tiers de volume</h3>
                      <button class="tx-btn-ghost text-sm" (click)="openAddTier(plan)">+ Adicionar tier</button>
                    </div>
                    @if (plan.tiers.length === 0) {
                      <p class="text-body-sm" style="color: var(--text-muted)">Sem tiers definidos.</p>
                    } @else {
                      <table class="tx-table w-full text-sm">
                        <thead>
                          <tr>
                            <th>Label</th>
                            <th class="text-right">De (€)</th>
                            <th class="text-right">Até (€)</th>
                            <th class="text-right">Taxa (%)</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (tier of plan.tiers; track tier.id) {
                            <tr>
                              <td>{{ tier.label ?? '—' }}</td>
                              <td class="text-right font-mono">{{ tier.volume_from | number:'1.0-0' }}</td>
                              <td class="text-right font-mono">{{ tier.volume_to !== null ? (tier.volume_to | number:'1.0-0') : '∞' }}</td>
                              <td class="text-right font-mono font-semibold" style="color: var(--tx-teal-600)">{{ tier.rate_percent }}%</td>
                              <td class="text-right">
                                <button
                                  class="tx-btn-ghost text-sm"
                                  style="color: var(--tx-danger)"
                                  (click)="deleteTier(plan, tier)"
                                  aria-label="Eliminar tier"
                                >
                                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    }
                  </div>

                  <!-- Bonuses -->
                  <div>
                    <div class="flex items-center justify-between mb-2">
                      <h3 class="text-body font-semibold" style="color: var(--tx-gray-700)">Bónus anuais</h3>
                      <button class="tx-btn-ghost text-sm" (click)="openAddBonus(plan)">+ Adicionar bónus</button>
                    </div>
                    @if (plan.bonuses.length === 0) {
                      <p class="text-body-sm" style="color: var(--text-muted)">Sem bónus definidos.</p>
                    } @else {
                      <table class="tx-table w-full text-sm">
                        <thead>
                          <tr>
                            <th class="text-right">Threshold (€)</th>
                            <th class="text-right">Bónus (€)</th>
                            <th>Descrição</th>
                            <th></th>
                          </tr>
                        </thead>
                        <tbody>
                          @for (bonus of plan.bonuses; track bonus.id) {
                            <tr>
                              <td class="text-right font-mono">{{ bonus.threshold | number:'1.0-0' }}</td>
                              <td class="text-right font-mono font-semibold" style="color: var(--tx-gold)">{{ bonus.bonus_amount | number:'1.0-0' }}</td>
                              <td style="color: var(--text-secondary)">{{ bonus.description ?? '—' }}</td>
                              <td class="text-right">
                                <button
                                  class="tx-btn-ghost text-sm"
                                  style="color: var(--tx-danger)"
                                  (click)="deleteBonus(plan, bonus)"
                                  aria-label="Eliminar bónus"
                                >
                                  <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          }
                        </tbody>
                      </table>
                    }
                  </div>
                </div>
              }
            </div>
          }
        </div>
      }
    </div>

    <!-- Drawer: New Plan -->
    @if (showPlanDrawer()) {
      <div class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.4)" (click)="closePlanDrawer()"></div>
      <div class="fixed top-0 right-0 h-full w-96 z-50 flex flex-col"
           style="background: var(--surface-card); box-shadow: -4px 0 24px rgba(0,0,0,0.15)">
        <div class="flex items-center justify-between p-6 border-b" style="border-color: var(--tx-gray-200)">
          <h3 class="text-h3">Novo Plano</h3>
          <button class="tx-btn-ghost p-1" (click)="closePlanDrawer()" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 p-6 flex flex-col gap-4">
          <div class="tx-field">
            <label class="tx-form-label" for="plan-name">Nome do plano *</label>
            <input id="plan-name" type="text" class="tx-input" [(ngModel)]="newPlanName" placeholder="Ex: Plano Standard 2026" />
          </div>
          <div class="flex items-center gap-3">
            <input type="checkbox" id="plan-active" [(ngModel)]="newPlanActive" class="w-4 h-4" />
            <label for="plan-active" class="tx-form-label cursor-pointer">Activo</label>
          </div>
        </div>
        <div class="p-6 border-t flex gap-3" style="border-color: var(--tx-gray-200)">
          <button class="tx-btn-secondary flex-1" (click)="closePlanDrawer()">Cancelar</button>
          <button class="tx-btn-primary flex-1" (click)="savePlan()" [disabled]="!newPlanName.trim() || saving()">Criar</button>
        </div>
      </div>
    }

    <!-- Drawer: Add Tier -->
    @if (showTierDrawer()) {
      <div class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.4)" (click)="closeTierDrawer()"></div>
      <div class="fixed top-0 right-0 h-full w-96 z-50 flex flex-col"
           style="background: var(--surface-card); box-shadow: -4px 0 24px rgba(0,0,0,0.15)">
        <div class="flex items-center justify-between p-6 border-b" style="border-color: var(--tx-gray-200)">
          <h3 class="text-h3">Adicionar Tier</h3>
          <button class="tx-btn-ghost p-1" (click)="closeTierDrawer()" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 p-6 flex flex-col gap-4">
          <div class="tx-field">
            <label class="tx-form-label" for="tier-label">Label</label>
            <input id="tier-label" type="text" class="tx-input" [(ngModel)]="tierForm.label" placeholder="Ex: Bronze" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label" for="tier-from">De (€) *</label>
            <input id="tier-from" type="number" class="tx-input" [(ngModel)]="tierForm.volume_from" min="0" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label" for="tier-to">Até (€) — deixar vazio para ilimitado</label>
            <input id="tier-to" type="number" class="tx-input" [(ngModel)]="tierForm.volume_to" min="0" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label" for="tier-rate">Taxa (%) *</label>
            <input id="tier-rate" type="number" class="tx-input" [(ngModel)]="tierForm.rate_percent" min="0" max="100" step="0.1" />
          </div>
        </div>
        <div class="p-6 border-t flex gap-3" style="border-color: var(--tx-gray-200)">
          <button class="tx-btn-secondary flex-1" (click)="closeTierDrawer()">Cancelar</button>
          <button class="tx-btn-primary flex-1" (click)="saveTier()" [disabled]="saving()">Guardar</button>
        </div>
      </div>
    }

    <!-- Drawer: Add Bonus -->
    @if (showBonusDrawer()) {
      <div class="fixed inset-0 z-40" style="background: rgba(0,0,0,0.4)" (click)="closeBonusDrawer()"></div>
      <div class="fixed top-0 right-0 h-full w-96 z-50 flex flex-col"
           style="background: var(--surface-card); box-shadow: -4px 0 24px rgba(0,0,0,0.15)">
        <div class="flex items-center justify-between p-6 border-b" style="border-color: var(--tx-gray-200)">
          <h3 class="text-h3">Adicionar Bónus</h3>
          <button class="tx-btn-ghost p-1" (click)="closeBonusDrawer()" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>
        <div class="flex-1 p-6 flex flex-col gap-4">
          <div class="tx-field">
            <label class="tx-form-label" for="bonus-threshold">Threshold (€) *</label>
            <input id="bonus-threshold" type="number" class="tx-input" [(ngModel)]="bonusForm.threshold" min="0" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label" for="bonus-amount">Valor bónus (€) *</label>
            <input id="bonus-amount" type="number" class="tx-input" [(ngModel)]="bonusForm.bonus_amount" min="0" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label" for="bonus-desc">Descrição</label>
            <input id="bonus-desc" type="text" class="tx-input" [(ngModel)]="bonusForm.description" placeholder="Opcional" />
          </div>
        </div>
        <div class="p-6 border-t flex gap-3" style="border-color: var(--tx-gray-200)">
          <button class="tx-btn-secondary flex-1" (click)="closeBonusDrawer()">Cancelar</button>
          <button class="tx-btn-primary flex-1" (click)="saveBonus()" [disabled]="saving()">Guardar</button>
        </div>
      </div>
    }
  `,
})
export class CommissionPlansComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly plans = signal<PlanWithDetails[]>([]);

  readonly showPlanDrawer = signal(false);
  readonly showTierDrawer = signal(false);
  readonly showBonusDrawer = signal(false);

  newPlanName = '';
  newPlanActive = true;

  tierForm = { label: '', volume_from: 0, volume_to: null as number | null, rate_percent: 0 };
  bonusForm = { threshold: 0, bonus_amount: 0, description: '' };

  #activePlanId: string | null = null;

  ngOnInit(): void {
    void this.#load();
  }

  async #load(): Promise<void> {
    const { data: planData, error: planErr } = await this.#supabase
      .from('commission_plans')
      .select('*')
      .order('created_at', { ascending: true });

    if (planErr) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: planErr.message });
      this.loading.set(false);
      return;
    }

    const { data: tierData } = await this.#supabase
      .from('commission_tiers')
      .select('*')
      .order('tier_order', { ascending: true });

    const { data: bonusData } = await this.#supabase
      .from('commission_bonuses')
      .select('*')
      .order('threshold', { ascending: true });

    const plans: PlanWithDetails[] = (planData ?? []).map((p: Record<string, unknown>) => ({
      id: p['id'] as string,
      name: p['name'] as string,
      description: (p['description'] as string | null) ?? null,
      active: (p['active'] as boolean) ?? false,
      created_at: p['created_at'] as string,
      tiers: ((tierData ?? []) as CommissionTier[]).filter(t => t.plan_id === p['id']),
      bonuses: ((bonusData ?? []) as CommissionBonus[]).filter(b => b.plan_id === p['id']),
      expanded: false,
    }));

    this.plans.set(plans);
    this.loading.set(false);
  }

  toggleExpand(plan: PlanWithDetails): void {
    this.plans.update(list =>
      list.map(p => p.id === plan.id ? { ...p, expanded: !p.expanded } : p)
    );
  }

  openNewPlan(): void {
    this.newPlanName = '';
    this.newPlanActive = true;
    this.showPlanDrawer.set(true);
  }

  closePlanDrawer(): void { this.showPlanDrawer.set(false); }

  async savePlan(): Promise<void> {
    if (!this.newPlanName.trim()) return;
    this.saving.set(true);

    const { error } = await this.#supabase
      .from('commission_plans')
      .insert({ name: this.newPlanName.trim(), active: this.newPlanActive });

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      this.#messageService.add({ severity: 'success', summary: 'Criado', detail: 'Plano criado com sucesso.' });
      this.closePlanDrawer();
      await this.#load();
    }
    this.saving.set(false);
  }

  openAddTier(plan: PlanWithDetails): void {
    this.#activePlanId = plan.id;
    const lastTier = plan.tiers[plan.tiers.length - 1];
    this.tierForm = {
      label: '',
      volume_from: lastTier?.volume_to ?? 0,
      volume_to: null,
      rate_percent: 0,
    };
    this.showTierDrawer.set(true);
  }

  closeTierDrawer(): void { this.showTierDrawer.set(false); }

  async saveTier(): Promise<void> {
    if (!this.#activePlanId) return;
    this.saving.set(true);

    const plan = this.plans().find(p => p.id === this.#activePlanId);
    const tierOrder = (plan?.tiers.length ?? 0) + 1;

    const { error } = await this.#supabase
      .from('commission_tiers')
      .insert({
        plan_id: this.#activePlanId,
        tier_order: tierOrder,
        volume_from: this.tierForm.volume_from,
        volume_to: this.tierForm.volume_to,
        rate_percent: this.tierForm.rate_percent,
        label: this.tierForm.label || null,
      });

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      this.#messageService.add({ severity: 'success', summary: 'Adicionado', detail: 'Tier criado.' });
      this.closeTierDrawer();
      await this.#load();
    }
    this.saving.set(false);
  }

  async deleteTier(plan: PlanWithDetails, tier: CommissionTier): Promise<void> {
    if (!confirm(`Eliminar tier "${tier.label ?? tier.rate_percent + '%'}"?`)) return;

    const { error } = await this.#supabase
      .from('commission_tiers')
      .delete()
      .eq('id', tier.id);

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      await this.#load();
    }
  }

  openAddBonus(plan: PlanWithDetails): void {
    this.#activePlanId = plan.id;
    this.bonusForm = { threshold: 0, bonus_amount: 0, description: '' };
    this.showBonusDrawer.set(true);
  }

  closeBonusDrawer(): void { this.showBonusDrawer.set(false); }

  async saveBonus(): Promise<void> {
    if (!this.#activePlanId) return;
    this.saving.set(true);

    const { error } = await this.#supabase
      .from('commission_bonuses')
      .insert({
        plan_id: this.#activePlanId,
        threshold: this.bonusForm.threshold,
        bonus_amount: this.bonusForm.bonus_amount,
        description: this.bonusForm.description || null,
      });

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      this.#messageService.add({ severity: 'success', summary: 'Adicionado', detail: 'Bónus criado.' });
      this.closeBonusDrawer();
      await this.#load();
    }
    this.saving.set(false);
  }

  async deleteBonus(plan: PlanWithDetails, bonus: CommissionBonus): Promise<void> {
    if (!confirm(`Eliminar bónus de €${bonus.bonus_amount}?`)) return;

    const { error } = await this.#supabase
      .from('commission_bonuses')
      .delete()
      .eq('id', bonus.id);

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      await this.#load();
    }
  }
}
