import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
  signal,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { ProjectType } from '../../../core/models/quote.model';

@Component({
  selector: 'app-step-project-type',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="p-6">
      <h2 class="text-h3 mb-2">Tipo de projecto</h2>
      <p class="text-[var(--tx-gray-500)] mb-6">Seleccione o tipo de projecto para este orçamento.</p>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <i class="pi pi-spin pi-spinner text-3xl text-[var(--tx-teal-500)]"></i>
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3">
          @for (pt of projectTypes(); track pt.id) {
            <div
              class="tx-card cursor-pointer transition-all duration-150 p-5 flex flex-col gap-3"
              [style.border]="selected()?.id === pt.id ? '2px solid var(--tx-teal-500)' : '1px solid var(--tx-gray-200)'"
              (click)="select(pt)"
            >
              <div class="flex items-center gap-3">
                <i [class]="'pi ' + (pt.icon ?? 'pi-briefcase') + ' text-2xl text-[var(--tx-teal-500)]'"></i>
                <span class="font-semibold text-[var(--tx-gray-900)]">{{ pt.name }}</span>
              </div>
              @if (pt.description) {
                <p class="text-sm text-[var(--tx-gray-500)]">{{ pt.description }}</p>
              }
              <div class="text-xs text-[var(--tx-gray-400)] font-mono">
                Base: {{ formatCurrency(pt.base_price) }}
              </div>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class StepProjectTypeComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);

  readonly selected = input<ProjectType | null>(null);
  readonly projectTypeSelected = output<ProjectType>();

  readonly projectTypes = signal<ProjectType[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.#supabase
      .from('project_types')
      .select('*')
      .eq('active', true)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        this.projectTypes.set((data ?? []) as ProjectType[]);
        this.loading.set(false);
      });
  }

  select(pt: ProjectType): void {
    this.projectTypeSelected.emit(pt);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
