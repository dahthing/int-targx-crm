import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
  signal,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CheckboxModule } from 'primeng/checkbox';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { evaluateAnswers } from '../../../core/services/scoping-engine.functions';
import type { ProjectType, ScopingQuestion, CatalogItem, RateProfile } from '../../../core/models/quote.model';
import type { ScopingAnswers } from '../../../core/services/scoping-engine.functions';

@Component({
  selector: 'app-step-modules',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, CheckboxModule],
  template: `
    <div class="p-6">
      <h2 class="text-h3 mb-2">Módulos e opcionais</h2>
      <p class="text-[var(--tx-gray-500)] mb-6">Módulos activados pelo perfil do projecto e opcionais disponíveis.</p>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <i class="pi pi-spin pi-spinner text-3xl text-[var(--tx-teal-500)]"></i>
        </div>
      } @else {
        <div class="flex flex-col gap-6">
          @if (activatedModules().length > 0) {
            <div>
              <h3 class="font-semibold text-[var(--tx-gray-700)] mb-3">Módulos incluídos</h3>
              <div class="flex flex-wrap gap-2">
                @for (mod of activatedModules(); track mod.id) {
                  <span class="tx-badge tx-badge-teal flex items-center gap-1">
                    <i class="pi pi-check-circle text-xs"></i>
                    {{ mod.name }}
                  </span>
                }
              </div>
            </div>
          }

          @if (optionalItems().length > 0) {
            <div>
              <h3 class="font-semibold text-[var(--tx-gray-700)] mb-3">Opcionais disponíveis</h3>
              <div class="flex flex-col gap-3">
                @for (item of optionalItems(); track item.id) {
                  <div class="flex items-center justify-between p-3 rounded-lg border border-[var(--tx-gray-200)]">
                    <div class="flex items-center gap-3">
                      <p-checkbox
                        [(ngModel)]="selectedOptionals"
                        [value]="item.id"
                        (onChange)="onOptionalToggle()"
                        [binary]="false"
                      />
                      <div>
                        <span class="font-medium text-[var(--tx-gray-800)]">{{ item.name }}</span>
                        @if (item.description) {
                          <p class="text-sm text-[var(--tx-gray-400)]">{{ item.description }}</p>
                        }
                      </div>
                    </div>
                    <span class="font-mono text-sm text-[var(--tx-gray-600)]">
                      {{ itemValue(item) }}
                    </span>
                  </div>
                }
              </div>
            </div>
          }

          <div class="tx-card p-4 bg-[var(--tx-gray-050)]">
            <div class="flex justify-between items-center">
              <span class="font-semibold text-[var(--tx-gray-700)]">Total estimado (base)</span>
              <span class="font-mono text-lg font-bold text-[var(--tx-teal-700)]">
                {{ formatCurrency(estimatedTotal()) }}
              </span>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class StepModulesComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);

  readonly projectType = input.required<ProjectType>();
  readonly answers = input.required<ScopingAnswers>();
  readonly questions = input.required<ScopingQuestion[]>();
  readonly rateProfiles = input<RateProfile[]>([]);
  readonly selectionChanged = output<{ activated: CatalogItem[]; optionals: CatalogItem[] }>();

  readonly allCatalogItems = signal<CatalogItem[]>([]);
  readonly loading = signal(true);
  selectedOptionals: string[] = [];

  readonly activatedModules = computed(() => {
    const activatedSlugs = evaluateAnswers(this.answers(), this.questions());
    return this.allCatalogItems().filter(item =>
      item.slug && activatedSlugs.includes(item.slug)
    );
  });

  readonly optionalItems = computed(() =>
    this.allCatalogItems().filter(item =>
      !item.slug || !this.activatedModules().some(m => m.id === item.id)
    )
  );

  readonly estimatedTotal = computed(() => {
    const calcItem = (item: CatalogItem): number => {
      if (item.pricing_type === 'hourly') {
        const rate = this.#resolveRate(item.default_rate_profile_id);
        return (item.default_hours ?? 0) * rate;
      }
      return item.default_value ?? 0;
    };

    const base = this.activatedModules().reduce((acc, item) => acc + calcItem(item), 0);
    const optionals = this.optionalItems()
      .filter(item => this.selectedOptionals.includes(item.id))
      .reduce((acc, item) => acc + calcItem(item), 0);

    return base + optionals;
  });

  #resolveRate(profileId: string | null): number {
    if (!profileId) return 75;
    const profile = this.rateProfiles().find(rp => rp.id === profileId);
    return profile?.hourly_rate ?? 75;
  }

  ngOnInit(): void {
    this.#supabase
      .from('catalog_items')
      .select('*')
      .eq('active', true)
      .then(({ data }) => {
        this.allCatalogItems.set((data ?? []) as CatalogItem[]);
        this.loading.set(false);
        this.#emitSelection();
      });
  }

  onOptionalToggle(): void {
    this.#emitSelection();
  }

  #emitSelection(): void {
    const selectedOptionalItems = this.optionalItems().filter(item =>
      this.selectedOptionals.includes(item.id)
    );
    this.selectionChanged.emit({
      activated: this.activatedModules(),
      optionals: selectedOptionalItems,
    });
  }

  itemValue(item: CatalogItem): string {
    if (item.pricing_type === 'hourly' && item.default_hours) {
      return `${item.default_hours}h`;
    }
    if (item.default_value) {
      return this.formatCurrency(item.default_value);
    }
    return '—';
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
