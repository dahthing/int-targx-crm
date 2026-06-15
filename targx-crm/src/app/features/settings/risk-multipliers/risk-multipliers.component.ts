import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { RiskMultiplier } from '../../../core/models/quote.model';

type RiskCategory = 'tecnico' | 'timeline' | 'cliente' | 'scope';
type RiskForm = Omit<RiskMultiplier, 'id' | 'created_at'>;

const emptyForm = (): RiskForm => ({
  key: '',
  name: '',
  description: null,
  category: 'tecnico',
  multiplier: 1.0,
  is_blocking: false,
  active: true,
});

const CATEGORIES: { label: string; value: RiskCategory }[] = [
  { label: 'Técnico', value: 'tecnico' },
  { label: 'Timeline', value: 'timeline' },
  { label: 'Cliente', value: 'cliente' },
  { label: 'Scope', value: 'scope' },
];

@Component({
  selector: 'app-risk-multipliers',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ToastModule, SelectModule],
  template: `
    <p-toast />
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Multiplicadores de risco</h1>
          <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">Configurar factores de risco que afectam o preço final.</p>
        </div>
        <button class="tx-btn-primary" (click)="openDrawer(null)">
          <i class="pi pi-plus mr-2"></i>Novo risco
        </button>
      </div>

      @if (loading()) {
        <div class="tx-card p-8 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-xl"></i>
        </div>
      }

      @if (!loading()) {
        <div class="tx-card overflow-hidden">
          <table class="tx-table w-full">
            <thead>
              <tr>
                <th class="text-left pl-4">Nome</th>
                <th class="text-left">Chave</th>
                <th class="text-left">Categoria</th>
                <th class="text-right">Multiplicador</th>
                <th class="text-center">Bloqueante</th>
                <th class="text-center">Activo</th>
                <th class="w-20"></th>
              </tr>
            </thead>
            <tbody>
              @for (rm of riskMultipliers(); track rm.id) {
                <tr class="border-t border-[var(--tx-gray-200)] hover:bg-[var(--tx-gray-050)]">
                  <td class="pl-4 py-3">
                    <span class="font-medium text-[var(--tx-gray-950)]">{{ rm.name }}</span>
                    @if (rm.description) {
                      <p class="text-body-sm text-[var(--tx-gray-400)] mt-0.5">{{ rm.description }}</p>
                    }
                  </td>
                  <td class="py-3 font-mono text-body-sm text-[var(--tx-gray-600)]">{{ rm.key }}</td>
                  <td class="py-3">
                    <span class="tx-badge" [ngClass]="categoryClass(rm.category)">{{ categoryLabel(rm.category) }}</span>
                  </td>
                  <td class="py-3 text-right font-mono font-semibold" [ngClass]="rm.multiplier > 1.2 ? 'text-[var(--tx-danger)]' : 'text-[var(--tx-gray-950)]'">
                    ×{{ rm.multiplier.toFixed(2) }}
                  </td>
                  <td class="py-3 text-center">
                    @if (rm.is_blocking) {
                      <span class="tx-badge tx-badge-red">Sim</span>
                    } @else {
                      <span class="text-[var(--tx-gray-400)] text-body-sm">Não</span>
                    }
                  </td>
                  <td class="py-3 text-center">
                    <button
                      class="w-10 h-6 rounded-full transition-colors relative"
                      [class]="rm.active ? 'bg-[var(--tx-teal-500)]' : 'bg-[var(--tx-gray-200)]'"
                      (click)="toggleActive(rm)"
                      [attr.aria-label]="rm.active ? 'Desactivar' : 'Activar'"
                    >
                      <span class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all" [class]="rm.active ? 'left-5' : 'left-1'"></span>
                    </button>
                  </td>
                  <td class="py-3 pr-3">
                    <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="openDrawer(rm)">
                      <i class="pi pi-pencil text-xs"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (riskMultipliers().length === 0) {
            <div class="p-8 text-center text-[var(--tx-gray-400)]">Sem multiplicadores de risco.</div>
          }
        </div>
      }
    </div>

    <!-- Drawer -->
    @if (showDrawer()) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-black/30" (click)="closeDrawer()"></div>
        <div class="relative bg-white w-full max-w-md shadow-xl flex flex-col h-full z-10">
          <div class="flex items-center justify-between p-5 border-b border-[var(--tx-gray-200)]">
            <h2 class="text-body font-semibold text-[var(--tx-gray-950)]">
              {{ editingId() ? 'Editar risco' : 'Novo multiplicador de risco' }}
            </h2>
            <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="closeDrawer()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="tx-form-label" for="rm-name">Nome</label>
              <input id="rm-name" class="tx-input w-full mt-1" [(ngModel)]="form().name" placeholder="Ex: Integração legacy" />
            </div>
            <div>
              <label class="tx-form-label" for="rm-key">Chave</label>
              <input id="rm-key" class="tx-input w-full mt-1 font-mono" [(ngModel)]="form().key" placeholder="legacy_integration" />
            </div>
            <div>
              <label class="tx-form-label" for="rm-desc">Descrição</label>
              <textarea id="rm-desc" class="tx-input w-full mt-1 h-20 resize-none" [(ngModel)]="form().description"></textarea>
            </div>
            <div>
              <label class="tx-form-label">Categoria</label>
              <p-select
                [options]="categories"
                [(ngModel)]="form().category"
                optionLabel="label"
                optionValue="value"
                styleClass="w-full mt-1"
              />
            </div>
            <div>
              <label class="tx-form-label" for="rm-mult">Multiplicador (mín. 1.0)</label>
              <input id="rm-mult" type="number" class="tx-input w-full mt-1 font-mono" [(ngModel)]="form().multiplier" min="1.0" step="0.05" />
              @if (form().multiplier < 1.0) {
                <p class="tx-field-error mt-1">O multiplicador deve ser ≥ 1.0</p>
              }
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="rm-blocking" [(ngModel)]="form().is_blocking" />
              <label for="rm-blocking" class="tx-form-label mb-0 cursor-pointer">Bloqueante (impede submissão)</label>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="rm-active" [(ngModel)]="form().active" />
              <label for="rm-active" class="tx-form-label mb-0 cursor-pointer">Activo</label>
            </div>
          </div>

          <div class="p-5 border-t border-[var(--tx-gray-200)] flex justify-end gap-2">
            <button class="tx-btn-secondary" (click)="closeDrawer()">Cancelar</button>
            <button class="tx-btn-primary" (click)="save()" [disabled]="saving() || form().multiplier < 1.0">
              @if (saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
              Guardar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class RiskMultipliersComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly categories = CATEGORIES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly riskMultipliers = signal<RiskMultiplier[]>([]);
  readonly showDrawer = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<RiskForm>(emptyForm());

  async ngOnInit(): Promise<void> { await this.#load(); }

  openDrawer(rm: RiskMultiplier | null): void {
    this.editingId.set(rm?.id ?? null);
    this.form.set(rm ? { key: rm.key, name: rm.name, description: rm.description, category: rm.category, multiplier: rm.multiplier, is_blocking: rm.is_blocking, active: rm.active } : emptyForm());
    this.showDrawer.set(true);
  }

  closeDrawer(): void { this.showDrawer.set(false); }

  async save(): Promise<void> {
    const data = this.form();
    if (data.multiplier < 1.0) return;
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) await this.#supabase.from('risk_multipliers').update(data).eq('id', id);
      else await this.#supabase.from('risk_multipliers').insert(data);
      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Multiplicador guardado.' });
      this.closeDrawer();
      await this.#load();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao guardar.' });
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(rm: RiskMultiplier): Promise<void> {
    await this.#supabase.from('risk_multipliers').update({ active: !rm.active }).eq('id', rm.id);
    await this.#load();
  }

  categoryLabel(cat: RiskCategory): string {
    return CATEGORIES.find(c => c.value === cat)?.label ?? cat;
  }

  categoryClass(cat: RiskCategory): string {
    const map: Record<RiskCategory, string> = {
      tecnico: 'tx-badge-blue', timeline: 'tx-badge-gold',
      cliente: 'tx-badge-teal', scope: 'tx-badge-gray',
    };
    return map[cat] ?? '';
  }

  async #load(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.#supabase.from('risk_multipliers').select('*').order('name');
    this.riskMultipliers.set((data ?? []) as RiskMultiplier[]);
    this.loading.set(false);
  }
}
