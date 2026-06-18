import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { DecimalPipe } from '@angular/common';
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
  imports: [FormsModule, ToastModule, DecimalPipe],
  providers: [MessageService],
  styles: [`
    .plans-page { padding:24px; }
    .plans-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .plans-list { display:flex; flex-direction:column; gap:16px; }
    .plan-header { display:flex; align-items:center; justify-content:space-between; }
    .plan-header-left { display:flex; align-items:center; gap:10px; }
    .plan-expand-btn { width:24px; height:24px; display:flex; align-items:center; justify-content:center; border:none; background:none; cursor:pointer; color:var(--tx-gray-400); padding:0; transition:transform 0.15s ease; }
    .plan-expand-btn.open { transform:rotate(90deg); }
    .plan-body { margin-top:16px; padding-left:34px; }
    .section-row { display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; }
    .section-title { font-size:0.875rem; font-weight:600; color:var(--tx-gray-700); }
    .drawer-overlay { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,0.4); }
    .drawer { position:fixed; top:0; right:0; height:100%; width:384px; z-index:50; display:flex; flex-direction:column; background:#fff; box-shadow:-4px 0 24px rgba(0,0,0,0.15); }
    .drawer-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--tx-gray-200); }
    .drawer-title { font-size:1rem; font-weight:600; color:var(--tx-gray-900); }
    .drawer-body { flex:1; padding:24px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
    .drawer-footer { padding:20px 24px; border-top:1px solid var(--tx-gray-200); display:flex; gap:12px; }
    .drawer-footer button { flex:1; }
    .form-field { display:flex; flex-direction:column; gap:6px; }
    .badge-active { background:var(--tx-teal-100); color:var(--tx-teal-700); }
    .badge-inactive { background:var(--tx-gray-100); color:var(--tx-gray-600); }
  `],
  template: `
    <p-toast />

    <div style="padding:24px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:24px">
        <div>
          <h1 class="page-title">Planos de Comissão</h1>
          <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">Gerir planos, tiers e bónus anuais.</p>
        </div>
        <button class="tx-btn-primary" (click)="openNewPlan()">
          <i class="pi pi-plus"></i>Novo plano
        </button>
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
        <div style="display:flex;flex-direction:column;gap:16px">
          @for (plan of plans(); track plan.id) {
            <div class="tx-card">
              <div style="display:flex;align-items:center;justify-content:space-between">
                <div style="display:flex;align-items:center;gap:10px">
                  <button
                    class="plan-expand-btn"
                    [class.open]="plan.expanded"
                    (click)="toggleExpand(plan)"
                    [attr.aria-label]="plan.expanded ? 'Recolher' : 'Expandir'"
                  >
                    <i class="pi pi-chevron-right" style="font-size:0.75rem"></i>
                  </button>
                  <h2 style="font-size:1rem;font-weight:600;color:var(--tx-gray-900)">{{ plan.name }}</h2>
                  @if (plan.active) {
                    <span class="tx-badge" style="background:var(--tx-teal-100);color:var(--tx-teal-700)">Activo</span>
                  } @else {
                    <span class="tx-badge" style="background:var(--tx-gray-100);color:var(--tx-gray-600)">Inactivo</span>
                  }
                </div>
              </div>

              @if (plan.expanded) {
                <div style="margin-top:16px;padding-left:34px">
                  <div style="margin-bottom:20px">
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                      <span style="font-size:0.875rem;font-weight:600;color:var(--tx-gray-700)">Tiers de volume</span>
                      <button class="tx-btn-ghost" style="font-size:0.8125rem" (click)="openAddTier(plan)">
                        <i class="pi pi-plus"></i>Adicionar tier
                      </button>
                    </div>
                    @if (plan.tiers.length === 0) {
                      <p style="font-size:0.8125rem;color:var(--tx-gray-400)">Sem tiers definidos.</p>
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

                  <div>
                    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
                      <span style="font-size:0.875rem;font-weight:600;color:var(--tx-gray-700)">Bónus anuais</span>
                      <button class="tx-btn-ghost" style="font-size:0.8125rem" (click)="openAddBonus(plan)">
                        <i class="pi pi-plus"></i>Adicionar bónus
                      </button>
                    </div>
                    @if (plan.bonuses.length === 0) {
                      <p style="font-size:0.8125rem;color:var(--tx-gray-400)">Sem bónus definidos.</p>
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
      <div class="drawer-overlay" (click)="closePlanDrawer()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Novo Plano</span>
          <button class="tx-btn-ghost" (click)="closePlanDrawer()" aria-label="Fechar"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="plan-name">Nome do plano *</label>
            <input id="plan-name" type="text" class="tx-input" [(ngModel)]="newPlanName" placeholder="Ex: Plano Standard 2026" />
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <input type="checkbox" id="plan-active" [(ngModel)]="newPlanActive" style="width:16px;height:16px" />
            <label for="plan-active" class="tx-form-label" style="cursor:pointer;margin:0">Activo</label>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closePlanDrawer()">Cancelar</button>
          <button class="tx-btn-primary" (click)="savePlan()" [disabled]="!newPlanName.trim() || saving()">Criar</button>
        </div>
      </div>
    }

    <!-- Drawer: Add Tier -->
    @if (showTierDrawer()) {
      <div class="drawer-overlay" (click)="closeTierDrawer()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Adicionar Tier</span>
          <button class="tx-btn-ghost" (click)="closeTierDrawer()" aria-label="Fechar"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="tier-label">Label</label>
            <input id="tier-label" type="text" class="tx-input" [(ngModel)]="tierForm.label" placeholder="Ex: Bronze" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="tier-from">De (€) *</label>
            <input id="tier-from" type="number" class="tx-input" [(ngModel)]="tierForm.volume_from" min="0" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="tier-to">Até (€) — deixar vazio para ilimitado</label>
            <input id="tier-to" type="number" class="tx-input" [(ngModel)]="tierForm.volume_to" min="0" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="tier-rate">Taxa (%) *</label>
            <input id="tier-rate" type="number" class="tx-input" [(ngModel)]="tierForm.rate_percent" min="0" max="100" step="0.1" />
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closeTierDrawer()">Cancelar</button>
          <button class="tx-btn-primary" (click)="saveTier()" [disabled]="saving()">Guardar</button>
        </div>
      </div>
    }

    <!-- Drawer: Add Bonus -->
    @if (showBonusDrawer()) {
      <div class="drawer-overlay" (click)="closeBonusDrawer()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Adicionar Bónus</span>
          <button class="tx-btn-ghost" (click)="closeBonusDrawer()" aria-label="Fechar"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="bonus-threshold">Threshold (€) *</label>
            <input id="bonus-threshold" type="number" class="tx-input" [(ngModel)]="bonusForm.threshold" min="0" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="bonus-amount">Valor bónus (€) *</label>
            <input id="bonus-amount" type="number" class="tx-input" [(ngModel)]="bonusForm.bonus_amount" min="0" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="bonus-desc">Descrição</label>
            <input id="bonus-desc" type="text" class="tx-input" [(ngModel)]="bonusForm.description" placeholder="Opcional" />
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closeBonusDrawer()">Cancelar</button>
          <button class="tx-btn-primary" (click)="saveBonus()" [disabled]="saving()">Guardar</button>
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
    if (!confirm(`Eliminar bónus de ${bonus.bonus_amount}€?`)) return;

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
