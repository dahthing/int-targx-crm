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
import type { CatalogItem, ItemPricingType } from '../../../core/models/quote.model';

type CatalogForm = Pick<CatalogItem, 'name' | 'description' | 'category' | 'pricing_type' | 'default_hours' | 'default_value' | 'active' | 'applicable_project_types' | 'out_of_scope_notes'>;

const emptyForm = (): CatalogForm => ({
  name: '',
  description: null,
  category: null,
  pricing_type: 'hourly',
  default_hours: null,
  default_value: null,
  active: true,
  applicable_project_types: null,
  out_of_scope_notes: null,
});

const PRICING_TYPES: { label: string; value: ItemPricingType }[] = [
  { label: 'Por hora', value: 'hourly' },
  { label: 'Preço fixo', value: 'fixed' },
];

@Component({
  selector: 'app-catalog-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ToastModule, SelectModule],
  template: `
    <p-toast />
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Catálogo de itens</h1>
          <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">Gerir itens reutilizáveis no construtor de orçamentos.</p>
        </div>
        <button class="tx-btn-primary" (click)="openDrawer(null)">
          <i class="pi pi-plus mr-2"></i>Novo item
        </button>
      </div>

      <!-- Search & filter -->
      <div class="flex gap-3 mb-4">
        <input
          class="tx-input flex-1"
          [(ngModel)]="searchQuery"
          placeholder="Pesquisar por nome..."
          (input)="filterItems()"
          aria-label="Pesquisar catálogo"
        />
        <p-select
          [options]="pricingTypes"
          [(ngModel)]="filterPricingType"
          optionLabel="label"
          optionValue="value"
          placeholder="Tipo de preço"
          styleClass="w-44"
          [showClear]="true"
          (onChange)="filterItems()"
        />
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
                <th class="text-left">Categoria</th>
                <th class="text-center">Tipo</th>
                <th class="text-right">Horas/Valor</th>
                <th class="text-right w-20">Usos</th>
                <th class="text-center">Activo</th>
                <th class="w-20"></th>
              </tr>
            </thead>
            <tbody>
              @for (item of filteredItems(); track item.id) {
                <tr class="border-t border-[var(--tx-gray-200)] hover:bg-[var(--tx-gray-050)]">
                  <td class="pl-4 py-2">
                    <p class="font-medium text-[var(--tx-gray-950)]">{{ item.name }}</p>
                    @if (item.description) {
                      <p class="text-body-sm text-[var(--tx-gray-400)] mt-0.5">{{ item.description }}</p>
                    }
                  </td>
                  <td class="py-2 text-body-sm text-[var(--tx-gray-600)]">{{ item.category ?? '—' }}</td>
                  <td class="py-2 text-center">
                    <span class="tx-badge" [class]="item.pricing_type === 'hourly' ? 'tx-badge-blue' : 'tx-badge-teal'">
                      {{ item.pricing_type === 'hourly' ? 'Hora' : 'Fixo' }}
                    </span>
                  </td>
                  <td class="py-2 text-right font-mono text-body-sm text-[var(--tx-gray-600)]">
                    @if (item.pricing_type === 'hourly') {
                      {{ item.default_hours ?? 0 }}h
                    } @else {
                      {{ formatCurrency(item.default_value ?? 0) }}
                    }
                  </td>
                  <td class="py-2 text-right font-mono text-body-sm text-[var(--tx-gray-400)]">{{ item.usage_count }}</td>
                  <td class="py-2 text-center">
                    <button
                      class="w-10 h-6 rounded-full transition-colors relative"
                      [class]="item.active ? 'bg-[var(--tx-teal-500)]' : 'bg-[var(--tx-gray-200)]'"
                      (click)="toggleActive(item)"
                      [attr.aria-label]="item.active ? 'Desactivar' : 'Activar'"
                    >
                      <span class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all" [class]="item.active ? 'left-5' : 'left-1'"></span>
                    </button>
                  </td>
                  <td class="py-2 pr-3">
                    <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="openDrawer(item)">
                      <i class="pi pi-pencil text-xs"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (filteredItems().length === 0) {
            <div class="p-8 text-center text-[var(--tx-gray-400)]">Sem itens no catálogo.</div>
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
            <h2 class="text-body font-semibold">{{ editingId() ? 'Editar item' : 'Novo item do catálogo' }}</h2>
            <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="closeDrawer()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="tx-form-label" for="cat-name">Nome</label>
              <input id="cat-name" class="tx-input w-full mt-1" [(ngModel)]="form().name" placeholder="Nome do item" />
            </div>
            <div>
              <label class="tx-form-label" for="cat-desc">Descrição</label>
              <textarea id="cat-desc" class="tx-input w-full mt-1 h-16 resize-none" [(ngModel)]="form().description"></textarea>
            </div>
            <div>
              <label class="tx-form-label" for="cat-category">Categoria</label>
              <input id="cat-category" class="tx-input w-full mt-1" [(ngModel)]="form().category" placeholder="Ex: Frontend, Backend, Design" />
            </div>
            <div>
              <label class="tx-form-label">Tipo de preço</label>
              <p-select [options]="pricingTypes" [(ngModel)]="form().pricing_type" optionLabel="label" optionValue="value" styleClass="w-full mt-1" />
            </div>
            @if (form().pricing_type === 'hourly') {
              <div>
                <label class="tx-form-label" for="cat-hours">Horas por defeito</label>
                <input id="cat-hours" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().default_hours" min="0" step="0.5" />
              </div>
            } @else {
              <div>
                <label class="tx-form-label" for="cat-value">Valor por defeito (€)</label>
                <input id="cat-value" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().default_value" min="0" step="50" />
              </div>
            }
            <div>
              <label class="tx-form-label" for="cat-notes">Notas fora de âmbito</label>
              <textarea id="cat-notes" class="tx-input w-full mt-1 h-16 resize-none" [(ngModel)]="form().out_of_scope_notes"></textarea>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="cat-active" [(ngModel)]="form().active" />
              <label for="cat-active" class="tx-form-label mb-0 cursor-pointer">Activo</label>
            </div>
          </div>

          <div class="p-5 border-t border-[var(--tx-gray-200)] flex justify-end gap-2">
            <button class="tx-btn-secondary" (click)="closeDrawer()">Cancelar</button>
            <button class="tx-btn-primary" (click)="save()" [disabled]="saving()">
              @if (saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
              Guardar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CatalogSettingsComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly pricingTypes = PRICING_TYPES;
  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly allItems = signal<CatalogItem[]>([]);
  readonly filteredItems = signal<CatalogItem[]>([]);
  readonly showDrawer = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<CatalogForm>(emptyForm());

  searchQuery = '';
  filterPricingType: ItemPricingType | null = null;

  async ngOnInit(): Promise<void> { await this.#load(); }

  filterItems(): void {
    const q = this.searchQuery.toLowerCase();
    const t = this.filterPricingType;
    this.filteredItems.set(this.allItems().filter(item =>
      (!q || item.name.toLowerCase().includes(q)) &&
      (!t || item.pricing_type === t)
    ));
  }

  openDrawer(item: CatalogItem | null): void {
    this.editingId.set(item?.id ?? null);
    this.form.set(item ? {
      name: item.name,
      description: item.description,
      category: item.category,
      pricing_type: item.pricing_type,
      default_hours: item.default_hours,
      default_value: item.default_value,
      active: item.active,
      applicable_project_types: item.applicable_project_types,
      out_of_scope_notes: item.out_of_scope_notes,
    } : emptyForm());
    this.showDrawer.set(true);
  }

  closeDrawer(): void { this.showDrawer.set(false); }

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name) {
      this.#messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome é obrigatório.' });
      return;
    }
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) await this.#supabase.from('catalog_items').update(data).eq('id', id);
      else await this.#supabase.from('catalog_items').insert({ ...data, usage_count: 0 });
      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Item guardado.' });
      this.closeDrawer();
      await this.#load();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao guardar.' });
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(item: CatalogItem): Promise<void> {
    await this.#supabase.from('catalog_items').update({ active: !item.active }).eq('id', item.id);
    await this.#load();
  }

  async #load(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.#supabase.from('catalog_items').select('*').order('usage_count', { ascending: false });
    const items = (data ?? []) as CatalogItem[];
    this.allItems.set(items);
    this.filteredItems.set(items);
    this.loading.set(false);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
