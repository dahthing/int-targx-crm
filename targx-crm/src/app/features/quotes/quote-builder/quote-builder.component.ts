import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DialogModule } from 'primeng/dialog';
import { SelectModule } from 'primeng/select';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { QuoteService } from '../../../core/services/quote.service';
import { CatalogService } from '../../../core/services/catalog.service';
import { AuthService } from '../../../core/services/auth.service';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import {
  calculateItemSubtotal,
  calculateQuoteTotals,
} from '../../../core/services/quote-calculator.functions';
import { calculateMargin } from '../../../core/services/margin-validator.functions';
import type {
  Quote,
  QuotePhase,
  QuoteItem,
  QuoteWithPhases,
  CatalogItem,
  RateProfile,
  ItemPricingType,
} from '../../../core/models/quote.model';
import type { QuoteWithPhases as QWP } from '../../../core/services/quote.service';

interface EditableItem {
  id?: string;
  name: string;
  description: string | null;
  pricing_type: ItemPricingType;
  hours: number | null;
  rate_profile_id: string | null;
  hourly_rate: number | null;
  unit_value: number | null;
  quantity: number;
  optional: boolean;
  catalog_item_id: string | null;
}

interface EditablePhase {
  id?: string;
  name: string;
  description: string | null;
  phase_order: number;
  expanded: boolean;
  items: EditableItem[];
}

@Component({
  selector: 'app-quote-builder',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ReactiveFormsModule, DialogModule, SelectModule, ToastModule],
  template: `
    <p-toast />

    <div class="tx-page-content">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          @if (quote()) {
            <h1 class="text-h2 text-[var(--tx-gray-950)]">{{ quote()!.title }}</h1>
            <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">
              v{{ quote()!.version }} ·
              <span class="tx-badge" [ngClass]="statusClass(quote()!.status)">{{ statusLabel(quote()!.status) }}</span>
            </p>
          } @else {
            <div class="h-7 w-48 bg-[var(--tx-gray-200)] rounded animate-pulse"></div>
          }
        </div>
        <div class="flex items-center gap-2">
          <button class="tx-btn-ghost" (click)="navigateBack()" aria-label="Voltar à lista">
            <i class="pi pi-arrow-left mr-2"></i>Voltar
          </button>
          <button class="tx-btn-ghost" (click)="openPreview()" aria-label="Pré-visualizar">
            <i class="pi pi-eye mr-2"></i>Pré-visualizar
          </button>
          <button class="tx-btn-ghost" (click)="openVersions()" aria-label="Versões">
            <i class="pi pi-history mr-2"></i>Versões
          </button>
        </div>
      </div>

      @if (loading()) {
        <div class="tx-card p-12 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-2xl"></i>
        </div>
      }

      @if (!loading() && quote()) {
        <div class="flex gap-6 items-start">
          <!-- Phases column (70%) -->
          <div class="flex-1 min-w-0 space-y-4">
            @for (phase of phases(); track phase.phase_order) {
              <div class="tx-card overflow-hidden">
                <!-- Phase header -->
                <div class="flex items-center gap-3 p-4 border-b border-[var(--tx-gray-200)] bg-[var(--tx-gray-050)]">
                  <button
                    class="w-6 h-6 flex items-center justify-center text-[var(--tx-gray-400)] hover:text-[var(--tx-gray-600)] transition-colors"
                    (click)="togglePhase(phase)"
                    [attr.aria-label]="phase.expanded ? 'Colapsar fase' : 'Expandir fase'"
                  >
                    <i [class]="phase.expanded ? 'pi pi-chevron-down' : 'pi pi-chevron-right'"></i>
                  </button>

                  <input
                    class="tx-input flex-1 font-medium text-[var(--tx-gray-950)]"
                    [(ngModel)]="phase.name"
                    placeholder="Nome da fase"
                    [attr.aria-label]="'Nome da fase ' + phase.phase_order"
                  />

                  <div class="flex items-center gap-1 ml-auto shrink-0">
                    <button
                      class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center"
                      (click)="movePhase(phase, -1)"
                      [disabled]="phase.phase_order === 1"
                      aria-label="Mover fase para cima"
                    >
                      <i class="pi pi-chevron-up text-xs"></i>
                    </button>
                    <button
                      class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center"
                      (click)="movePhase(phase, 1)"
                      [disabled]="phase.phase_order === phases().length"
                      aria-label="Mover fase para baixo"
                    >
                      <i class="pi pi-chevron-down text-xs"></i>
                    </button>
                    <button
                      class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center text-[var(--tx-danger)]"
                      (click)="removePhase(phase)"
                      aria-label="Remover fase"
                    >
                      <i class="pi pi-trash text-xs"></i>
                    </button>
                  </div>
                </div>

                @if (phase.expanded) {
                  <!-- Items table -->
                  @if (phase.items.length > 0) {
                    <table class="tx-table w-full">
                      <thead>
                        <tr>
                          <th class="text-left pl-4">Item</th>
                          <th class="text-center w-24">Tipo</th>
                          <th class="text-right w-28">Horas/Valor</th>
                          <th class="text-right w-24">Subtotal</th>
                          <th class="text-center w-16">Opc.</th>
                          <th class="w-20"></th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (item of phase.items; track item.name + $index) {
                          <tr class="border-t border-[var(--tx-gray-200)] hover:bg-[var(--tx-gray-050)]">
                            <td class="pl-4 py-2">
                              <span class="text-body text-[var(--tx-gray-950)]">{{ item.name }}</span>
                              @if (item.description) {
                                <p class="text-body-sm text-[var(--tx-gray-400)] mt-0.5">{{ item.description }}</p>
                              }
                            </td>
                            <td class="text-center py-2">
                              <span
                                class="tx-badge"
                                [class]="item.pricing_type === 'hourly' ? 'tx-badge-blue' : 'tx-badge-teal'"
                              >{{ item.pricing_type === 'hourly' ? 'Hora' : 'Fixo' }}</span>
                            </td>
                            <td class="text-right py-2 font-mono text-body-sm text-[var(--tx-gray-600)]">
                              @if (item.pricing_type === 'hourly') {
                                {{ item.hours ?? 0 }}h × {{ formatCurrency(item.hourly_rate ?? 0) }}
                              } @else {
                                {{ formatCurrency(item.unit_value ?? 0) }} × {{ item.quantity }}
                              }
                            </td>
                            <td class="text-right py-2 font-mono font-medium text-[var(--tx-gray-950)]">
                              {{ formatCurrency(itemSubtotal(item)) }}
                            </td>
                            <td class="text-center py-2">
                              <input
                                type="checkbox"
                                [(ngModel)]="item.optional"
                                [attr.aria-label]="'Item opcional: ' + item.name"
                                class="cursor-pointer"
                              />
                            </td>
                            <td class="py-2 pr-3">
                              <div class="flex justify-end gap-1">
                                <button
                                  class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center"
                                  (click)="editItem(phase, item)"
                                  [attr.aria-label]="'Editar item ' + item.name"
                                >
                                  <i class="pi pi-pencil text-xs"></i>
                                </button>
                                <button
                                  class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center text-[var(--tx-danger)]"
                                  (click)="removeItem(phase, item)"
                                  [attr.aria-label]="'Remover item ' + item.name"
                                >
                                  <i class="pi pi-trash text-xs"></i>
                                </button>
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  }

                  @if (phase.items.length === 0) {
                    <div class="p-6 text-center text-[var(--tx-gray-400)] text-body-sm">
                      Sem itens. Adicione um item ou pesquise no catálogo.
                    </div>
                  }

                  <!-- Phase actions -->
                  <div class="flex gap-2 p-3 border-t border-[var(--tx-gray-200)]">
                    <button class="tx-btn-ghost text-body-sm" (click)="addItem(phase)">
                      <i class="pi pi-plus mr-1"></i>Adicionar item
                    </button>
                    <button class="tx-btn-ghost text-body-sm" (click)="openCatalog(phase)">
                      <i class="pi pi-book mr-1"></i>Pesquisar catálogo
                    </button>
                  </div>
                }
              </div>
            }

            <!-- Add phase button -->
            <button class="tx-btn-secondary w-full" (click)="addPhase()">
              <i class="pi pi-plus mr-2"></i>Adicionar fase
            </button>
          </div>

          <!-- Sidebar (30%) -->
          <div class="w-80 shrink-0 sticky top-6 space-y-4">
            <!-- Totals card -->
            <div class="tx-card p-5">
              <h3 class="text-body font-semibold text-[var(--tx-gray-950)] mb-4">Resumo financeiro</h3>

              <dl class="space-y-2 text-body-sm">
                <div class="flex justify-between">
                  <dt class="text-[var(--tx-gray-600)]">Subtotal base</dt>
                  <dd class="font-mono font-medium text-[var(--tx-gray-950)]">{{ formatCurrency(totals().subtotal_base) }}</dd>
                </div>
                @if (totals().risk_adjustment > 0) {
                  <div class="flex justify-between">
                    <dt class="text-[var(--tx-gray-600)]">Ajuste de risco</dt>
                    <dd class="font-mono text-[var(--tx-warning)]">+{{ formatCurrency(totals().risk_adjustment) }}</dd>
                  </div>
                }
                @if (discountPct() > 0) {
                  <div class="flex justify-between">
                    <dt class="text-[var(--tx-gray-600)]">Desconto ({{ discountPct() }}%)</dt>
                    <dd class="font-mono text-[var(--tx-danger)]">-{{ formatCurrency(totals().discount_amount) }}</dd>
                  </div>
                }
                <div class="flex justify-between border-t border-[var(--tx-gray-200)] pt-2 mt-2">
                  <dt class="text-[var(--tx-gray-950)] font-medium">Total s/IVA</dt>
                  <dd class="font-mono font-semibold text-[var(--tx-gray-950)]">{{ formatCurrency(totals().total_before_tax) }}</dd>
                </div>
                <div class="flex justify-between text-[var(--tx-gray-400)]">
                  <dt>IVA 23%</dt>
                  <dd class="font-mono">{{ formatCurrency(totals().total_with_tax - totals().total_before_tax) }}</dd>
                </div>
                <div class="flex justify-between border-t border-[var(--tx-gray-200)] pt-2">
                  <dt class="text-[var(--tx-gray-950)] font-semibold">Total c/IVA</dt>
                  <dd class="font-mono font-bold text-[var(--tx-blue-700)]">{{ formatCurrency(totals().total_with_tax) }}</dd>
                </div>
              </dl>

              @if (isAdmin()) {
                <!-- Discount control -->
                <div class="mt-4 pt-4 border-t border-[var(--tx-gray-200)]">
                  <label class="tx-form-label" for="discount-pct">Desconto (%)</label>
                  <input
                    id="discount-pct"
                    type="number"
                    class="tx-input w-full mt-1"
                    [(ngModel)]="discountPctValue"
                    min="0"
                    max="100"
                    step="1"
                    placeholder="0"
                  />
                </div>
              }

              <!-- Margin indicator -->
              <div class="mt-4 pt-4 border-t border-[var(--tx-gray-200)]">
                <div class="flex items-center justify-between mb-1">
                  <span class="text-body-sm text-[var(--tx-gray-600)]">Margem</span>
                  <span class="font-mono text-body-sm font-medium" [ngClass]="marginClass()">
                    {{ margin().margin_pct.toFixed(1) }}%
                  </span>
                </div>
                <div class="h-2 rounded-full bg-[var(--tx-gray-200)] overflow-hidden">
                  <div
                    class="h-full rounded-full transition-all"
                    [style.width.%]="Math.min(margin().margin_pct, 100)"
                    [ngClass]="marginBarClass()"
                  ></div>
                </div>
                <p class="text-body-sm mt-1" [ngClass]="marginClass()">
                  @if (margin().is_valid) { Margem adequada }
                  @else { Margem abaixo do mínimo ({{ margin().minimum_margin_pct }}%) }
                </p>
              </div>
            </div>

            <!-- Actions card -->
            <div class="tx-card p-4 space-y-2">
              <button
                class="tx-btn-secondary w-full"
                (click)="saveDraft()"
                [disabled]="saving()"
              >
                @if (saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
                Guardar rascunho
              </button>
              <button
                class="tx-btn-primary w-full"
                (click)="submitForReview()"
                [disabled]="saving() || !margin().is_valid"
              >
                Submeter para revisão
              </button>
              @if (!margin().is_valid && phases().length > 0) {
                <p class="text-body-sm text-[var(--tx-danger)] text-center">
                  Margem insuficiente — não pode submeter.
                </p>
              }
            </div>
          </div>
        </div>
      }
    </div>

    <!-- Item editor dialog -->
    <p-dialog
      [(visible)]="showItemDialog"
      [modal]="true"
      [style]="{ width: '520px' }"
      header="Item"
      [closable]="true"
    >
      @if (editingItem()) {
        <div class="space-y-4 p-2">
          <div>
            <label class="tx-form-label" for="item-name">Nome</label>
            <input id="item-name" class="tx-input w-full mt-1" [(ngModel)]="editingItem()!.name" placeholder="Nome do item" />
          </div>

          <div>
            <label class="tx-form-label">Tipo de preço</label>
            <div class="flex gap-3 mt-1">
              <button
                class="flex-1 py-2 px-3 rounded-lg border text-body-sm font-medium transition-colors"
                [class]="editingItem()!.pricing_type === 'hourly' ? 'border-[var(--tx-teal-500)] bg-[var(--tx-teal-050)] text-[var(--tx-teal-600)]' : 'border-[var(--tx-gray-200)] text-[var(--tx-gray-600)]'"
                (click)="editingItem()!.pricing_type = 'hourly'"
              >Por hora</button>
              <button
                class="flex-1 py-2 px-3 rounded-lg border text-body-sm font-medium transition-colors"
                [class]="editingItem()!.pricing_type === 'fixed' ? 'border-[var(--tx-teal-500)] bg-[var(--tx-teal-050)] text-[var(--tx-teal-600)]' : 'border-[var(--tx-gray-200)] text-[var(--tx-gray-600)]'"
                (click)="editingItem()!.pricing_type = 'fixed'"
              >Preço fixo</button>
            </div>
          </div>

          @if (editingItem()!.pricing_type === 'hourly') {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="tx-form-label" for="item-hours">Horas</label>
                <input id="item-hours" type="number" class="tx-input w-full mt-1" [(ngModel)]="editingItem()!.hours" min="0" step="0.5" />
              </div>
              <div>
                <label class="tx-form-label" for="item-rate">Taxa/h (€)</label>
                <input id="item-rate" type="number" class="tx-input w-full mt-1" [(ngModel)]="editingItem()!.hourly_rate" min="0" step="1" />
              </div>
            </div>
            <div>
              <label class="tx-form-label">Perfil de taxa</label>
              <p-select
                [options]="rateProfiles()"
                [(ngModel)]="editingItem()!.rate_profile_id"
                optionLabel="name"
                optionValue="id"
                placeholder="Selecionar perfil"
                styleClass="w-full mt-1"
                (onChange)="onRateProfileChange($event)"
              />
            </div>
          } @else {
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="tx-form-label" for="item-value">Valor unitário (€)</label>
                <input id="item-value" type="number" class="tx-input w-full mt-1" [(ngModel)]="editingItem()!.unit_value" min="0" step="10" />
              </div>
              <div>
                <label class="tx-form-label" for="item-qty">Quantidade</label>
                <input id="item-qty" type="number" class="tx-input w-full mt-1" [(ngModel)]="editingItem()!.quantity" min="1" step="1" />
              </div>
            </div>
          }

          <div class="flex items-center gap-2">
            <input type="checkbox" id="item-optional" [(ngModel)]="editingItem()!.optional" />
            <label for="item-optional" class="tx-form-label mb-0 cursor-pointer">Item opcional</label>
          </div>

          <!-- Subtotal preview -->
          <div class="bg-[var(--tx-gray-050)] rounded-lg p-3 flex justify-between items-center">
            <span class="text-body-sm text-[var(--tx-gray-600)]">Subtotal do item</span>
            <span class="font-mono font-semibold text-[var(--tx-gray-950)]">
              {{ formatCurrency(itemSubtotal(editingItem()!)) }}
            </span>
          </div>
        </div>

        <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--tx-gray-200)]">
          <button class="tx-btn-secondary" (click)="showItemDialog = false">Cancelar</button>
          <button class="tx-btn-primary" (click)="saveItem()">Guardar item</button>
        </div>
      }
    </p-dialog>

    <!-- Catalog picker dialog -->
    <p-dialog
      [(visible)]="showCatalogDialog"
      [modal]="true"
      [style]="{ width: '600px' }"
      header="Pesquisar catálogo"
      [closable]="true"
    >
      <div class="space-y-4 p-2">
        <input
          class="tx-input w-full"
          [(ngModel)]="catalogSearch"
          placeholder="Pesquisar itens..."
          (input)="onCatalogSearch()"
          aria-label="Pesquisar catálogo"
        />

        @if (catalogLoading()) {
          <div class="text-center py-4">
            <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)]"></i>
          </div>
        }

        <div class="max-h-80 overflow-y-auto space-y-2">
          @for (item of catalogResults(); track item.id) {
            <div
              class="p-3 rounded-lg border border-[var(--tx-gray-200)] hover:border-[var(--tx-teal-400)] hover:bg-[var(--tx-teal-050)] cursor-pointer transition-colors"
              (click)="addFromCatalog(item)"
              [attr.aria-label]="'Adicionar ' + item.name + ' da fase'"
            >
              <div class="flex items-center justify-between">
                <span class="text-body font-medium text-[var(--tx-gray-950)]">{{ item.name }}</span>
                <span class="tx-badge" [class]="item.pricing_type === 'hourly' ? 'tx-badge-blue' : 'tx-badge-teal'">
                  {{ item.pricing_type === 'hourly' ? 'Hora' : 'Fixo' }}
                </span>
              </div>
              @if (item.description) {
                <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">{{ item.description }}</p>
              }
              <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">
                Usado {{ item.usage_count }}× ·
                @if (item.pricing_type === 'hourly') {
                  {{ item.default_hours ?? 0 }}h
                } @else {
                  {{ formatCurrency(item.default_value ?? 0) }}
                }
              </p>
            </div>
          }
          @if (!catalogLoading() && catalogResults().length === 0) {
            <p class="text-center text-[var(--tx-gray-400)] text-body-sm py-4">Sem resultados.</p>
          }
        </div>
      </div>
    </p-dialog>
  `,
  styles: [`
    :host { display: block; }
  `],
})
export class QuoteBuilderComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #catalogService = inject(CatalogService);
  readonly #authService = inject(AuthService);
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);

  protected readonly Math = Math;

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly quote = signal<QWP | null>(null);
  readonly phases = signal<EditablePhase[]>([]);
  readonly rateProfiles = signal<RateProfile[]>([]);
  readonly isAdmin = computed(() => this.#authService.role() === 'admin');

  // Discount
  discountPctValue = 0;

  readonly discountPct = computed(() => this.discountPctValue);

  // Totals
  readonly totals = computed(() => {
    const q = this.quote();
    const allItems = this.phases().flatMap(p => p.items);
    return calculateQuoteTotals(
      [] as QuotePhase[],
      allItems as unknown as QuoteItem[],
      this.discountPctValue,
      q?.risk_multiplier_total ?? 1,
      q?.project_type_id ? 0 : 0,
      23
    );
  });

  readonly margin = computed(() =>
    calculateMargin(this.totals().total_before_tax, this.phases().flatMap(p => p.items) as unknown as QuoteItem[], 60, 25)
  );

  readonly marginClass = computed(() => {
    const m = this.margin();
    if (m.margin_pct >= 35) return 'text-[var(--tx-success)]';
    if (m.margin_pct >= 25) return 'text-[var(--tx-warning)]';
    return 'text-[var(--tx-danger)]';
  });

  readonly marginBarClass = computed(() => {
    const m = this.margin();
    if (m.margin_pct >= 35) return 'bg-[var(--tx-success)]';
    if (m.margin_pct >= 25) return 'bg-[var(--tx-warning)]';
    return 'bg-[var(--tx-danger)]';
  });

  // Item dialog
  showItemDialog = false;
  readonly editingItem = signal<EditableItem | null>(null);
  editingPhase: EditablePhase | null = null;
  editingItemIndex: number | null = null;

  // Catalog dialog
  showCatalogDialog = false;
  catalogSearch = '';
  readonly catalogLoading = signal(false);
  readonly catalogResults = signal<CatalogItem[]>([]);
  catalogTargetPhase: EditablePhase | null = null;
  private catalogDebounce: ReturnType<typeof setTimeout> | null = null;

  async ngOnInit(): Promise<void> {
    const id = this.#route.snapshot.paramMap.get('id');
    if (!id) {
      this.#router.navigate(['/quotes']);
      return;
    }

    try {
      const [quoteData] = await Promise.all([
        this.#quoteService.getById(id).toPromise(),
        this.#loadRateProfiles(),
      ]);

      if (!quoteData) throw new Error('Quote not found');

      this.quote.set(quoteData);
      this.discountPctValue = quoteData.discount_pct ?? 0;
      this.phases.set(quoteData.phases.map((p, i) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        phase_order: p.phase_order ?? i + 1,
        expanded: true,
        items: p.items.map(item => ({
          id: item.id,
          name: item.name,
          description: item.description,
          pricing_type: item.pricing_type,
          hours: item.hours,
          rate_profile_id: item.rate_profile_id,
          hourly_rate: item.hourly_rate,
          unit_value: item.unit_value,
          quantity: item.quantity,
          optional: item.optional,
          catalog_item_id: item.catalog_item_id,
        })),
      })));
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar o orçamento.' });
    } finally {
      this.loading.set(false);
    }
  }

  togglePhase(phase: EditablePhase): void {
    const list = [...this.phases()];
    const idx = list.indexOf(phase);
    list[idx] = { ...phase, expanded: !phase.expanded };
    this.phases.set(list);
  }

  addPhase(): void {
    const current = this.phases();
    this.phases.set([...current, {
      name: `Fase ${current.length + 1}`,
      description: null,
      phase_order: current.length + 1,
      expanded: true,
      items: [],
    }]);
  }

  removePhase(phase: EditablePhase): void {
    const updated = this.phases()
      .filter(p => p !== phase)
      .map((p, i) => ({ ...p, phase_order: i + 1 }));
    this.phases.set(updated);
  }

  movePhase(phase: EditablePhase, direction: -1 | 1): void {
    const list = [...this.phases()];
    const idx = list.indexOf(phase);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    [list[idx], list[newIdx]] = [list[newIdx], list[idx]];
    this.phases.set(list.map((p, i) => ({ ...p, phase_order: i + 1 })));
  }

  addItem(phase: EditablePhase): void {
    this.editingPhase = phase;
    this.editingItemIndex = null;
    this.editingItem.set({
      name: '',
      description: null,
      pricing_type: 'hourly',
      hours: null,
      rate_profile_id: null,
      hourly_rate: null,
      unit_value: null,
      quantity: 1,
      optional: false,
      catalog_item_id: null,
    });
    this.showItemDialog = true;
  }

  editItem(phase: EditablePhase, item: EditableItem): void {
    this.editingPhase = phase;
    this.editingItemIndex = phase.items.indexOf(item);
    this.editingItem.set({ ...item });
    this.showItemDialog = true;
  }

  removeItem(phase: EditablePhase, item: EditableItem): void {
    const list = this.phases();
    const phaseIdx = list.indexOf(phase);
    const updated = [...list];
    updated[phaseIdx] = {
      ...phase,
      items: phase.items.filter(i => i !== item),
    };
    this.phases.set(updated);
  }

  saveItem(): void {
    const item = this.editingItem();
    if (!item || !this.editingPhase) return;

    const list = [...this.phases()];
    const phaseIdx = list.indexOf(this.editingPhase);
    const items = [...this.editingPhase.items];

    if (this.editingItemIndex !== null) {
      items[this.editingItemIndex] = { ...item };
    } else {
      items.push({ ...item });
    }

    list[phaseIdx] = { ...this.editingPhase, items };
    this.phases.set(list);
    this.showItemDialog = false;
  }

  openCatalog(phase: EditablePhase): void {
    this.catalogTargetPhase = phase;
    this.catalogSearch = '';
    this.catalogResults.set([]);
    this.showCatalogDialog = true;
    this.#searchCatalog('');
  }

  onCatalogSearch(): void {
    if (this.catalogDebounce) clearTimeout(this.catalogDebounce);
    this.catalogDebounce = setTimeout(() => this.#searchCatalog(this.catalogSearch), 300);
  }

  addFromCatalog(item: CatalogItem): void {
    if (!this.catalogTargetPhase) return;

    const newItem: EditableItem = {
      name: item.name,
      description: item.description,
      pricing_type: item.pricing_type,
      hours: item.default_hours,
      rate_profile_id: item.default_rate_profile_id,
      hourly_rate: null,
      unit_value: item.default_value,
      quantity: 1,
      optional: false,
      catalog_item_id: item.id,
    };

    const list = [...this.phases()];
    const phaseIdx = list.indexOf(this.catalogTargetPhase);
    list[phaseIdx] = {
      ...this.catalogTargetPhase,
      items: [...this.catalogTargetPhase.items, newItem],
    };
    this.phases.set(list);
    this.showCatalogDialog = false;
  }

  onRateProfileChange(event: { value: string }): void {
    const profile = this.rateProfiles().find(p => p.id === event.value);
    if (profile && this.editingItem()) {
      this.editingItem.set({ ...this.editingItem()!, hourly_rate: profile.hourly_rate });
    }
  }

  itemSubtotal(item: EditableItem): number {
    return calculateItemSubtotal(item as unknown as QuoteItem);
  }

  async saveDraft(): Promise<void> {
    const q = this.quote();
    if (!q) return;
    this.saving.set(true);
    try {
      const totals = this.totals();
      await this.#quoteService.update(q.id, {
        discount_pct: this.discountPctValue,
        subtotal_base: totals.subtotal_base,
        risk_adjustment: totals.risk_adjustment,
        subtotal_with_risk: totals.subtotal_with_risk,
        total_before_tax: totals.total_before_tax,
        total_with_tax: totals.total_with_tax,
        calculated_margin_pct: this.margin().margin_pct,
      });

      await this.#quoteService.savePhasesAndItems(q.id, this.phases().map(phase => ({
        name: phase.name,
        description: phase.description,
        phase_order: phase.phase_order,
        items: phase.items.map((item, i) => ({
          name: item.name,
          description: item.description,
          pricing_type: item.pricing_type,
          hours: item.hours,
          hourly_rate: item.hourly_rate,
          unit_value: item.unit_value,
          quantity: item.quantity,
          item_order: i + 1,
          optional: item.optional,
          catalog_item_id: item.catalog_item_id,
          rate_profile_id: item.rate_profile_id,
        })),
      })));

      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Rascunho guardado com sucesso.' });
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível guardar.' });
    } finally {
      this.saving.set(false);
    }
  }

  async submitForReview(): Promise<void> {
    if (!this.margin().is_valid) return;
    const q = this.quote();
    if (!q) return;

    this.saving.set(true);
    try {
      await this.saveDraft();
      await this.#quoteService.update(q.id, { status: 'em_revisao' });
      this.#messageService.add({ severity: 'success', summary: 'Submetido', detail: 'Orçamento enviado para revisão.' });
      this.#router.navigate(['/quotes']);
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível submeter.' });
    } finally {
      this.saving.set(false);
    }
  }

  navigateBack(): void {
    this.#router.navigate(['/quotes']);
  }

  openPreview(): void {
    const q = this.quote();
    if (q) this.#router.navigate(['/quotes', q.id, 'preview']);
  }

  openVersions(): void {
    const q = this.quote();
    if (q) this.#router.navigate(['/quotes', q.id, 'versions']);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      rascunho: 'Rascunho', em_revisao: 'Em revisão',
      aprovado_interno: 'Aprovado', enviado_cliente: 'Enviado',
      aceite: 'Aceite', rejeitado: 'Rejeitado',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      rascunho: 'tx-badge-gray', em_revisao: 'tx-badge-blue',
      aprovado_interno: 'tx-badge-teal', enviado_cliente: 'tx-badge-gold',
      aceite: 'tx-badge-green', rejeitado: 'tx-badge-red',
    };
    return map[status] ?? '';
  }

  formatCurrency(value: number | null): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  async #loadRateProfiles(): Promise<void> {
    const { data } = await this.#supabase.from('rate_profiles').select('*').eq('active', true).order('name');
    this.rateProfiles.set((data ?? []) as RateProfile[]);
  }

  #searchCatalog(query: string): void {
    this.catalogLoading.set(true);
    this.#catalogService.searchItems(query).subscribe({
      next: (items) => {
        this.catalogResults.set(items.sort((a, b) => b.usage_count - a.usage_count));
        this.catalogLoading.set(false);
      },
      error: () => this.catalogLoading.set(false),
    });
  }
}
