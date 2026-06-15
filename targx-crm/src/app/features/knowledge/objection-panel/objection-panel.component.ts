import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  model,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { InputTextModule } from 'primeng/inputtext';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { ObjectionPlaybook, ObjectionCategory } from '../../../core/models/knowledge.model';

const CATEGORY_LABELS: Record<ObjectionCategory, string> = {
  preco: 'Preço',
  prazo: 'Prazo',
  tecnologia: 'Tecnologia',
  concorrencia: 'Concorrência',
  outro: 'Outro',
};

const CATEGORY_ORDER: ObjectionCategory[] = ['preco', 'prazo', 'tecnologia', 'concorrencia', 'outro'];

@Component({
  selector: 'app-objection-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerModule, InputTextModule, FormsModule],
  template: `
    <p-drawer
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      header="Playbook de Objecções"
      position="right"
      styleClass="w-[520px]"
    >
      <!-- Search -->
      <div class="mb-4">
        <input
          pInputText
          class="tx-input w-full"
          [(ngModel)]="searchQuery"
          placeholder="Pesquisar objecções..."
          aria-label="Pesquisar objecções"
        />
      </div>

      @if (loading()) {
        <p class="text-sm text-tx-gray-400 text-center py-8">A carregar...</p>
      } @else {
        @for (group of filteredGroups(); track group.category) {
          @if (group.items.length > 0) {
            <div class="mb-6">
              <h3 class="text-sm font-semibold text-tx-gray-600 uppercase tracking-wide mb-3 px-1">
                {{ group.label }}
              </h3>
              <div class="flex flex-col gap-2">
                @for (item of group.items; track item.id) {
                  <details class="tx-card">
                    <summary class="p-4 cursor-pointer text-sm font-medium text-tx-gray-800 hover:text-tx-teal-600 select-none list-none flex items-center justify-between">
                      <span>{{ item.objection }}</span>
                      <svg class="w-4 h-4 text-tx-gray-400 flex-shrink-0 ml-2" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clip-rule="evenodd"/>
                      </svg>
                    </summary>
                    <div class="px-4 pb-4 pt-0 text-sm text-tx-gray-700 border-t border-tx-gray-100 mt-0">
                      <p class="mt-3">{{ item.response }}</p>
                    </div>
                  </details>
                }
              </div>
            </div>
          }
        }

        @if (filteredGroups().every(g => g.items.length === 0)) {
          <p class="text-sm text-tx-gray-400 text-center py-8">Nenhuma objecção encontrada</p>
        }
      }
    </p-drawer>
  `,
})
export class ObjectionPanelComponent implements OnInit {
  private readonly supabase = inject(SUPABASE_CLIENT);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = model<boolean>(false);

  protected readonly objections = signal<ObjectionPlaybook[]>([]);
  protected readonly loading = signal(false);
  protected searchQuery = '';

  protected readonly filteredGroups = computed(() => {
    const q = this.searchQuery.toLowerCase();
    return CATEGORY_ORDER.map(cat => ({
      category: cat,
      label: CATEGORY_LABELS[cat],
      items: this.objections().filter(o =>
        o.category === cat &&
        o.active &&
        (!q || o.objection.toLowerCase().includes(q) || o.response.toLowerCase().includes(q))
      ),
    }));
  });

  ngOnInit(): void {
    this.loading.set(true);
    from(this.supabase
      .from('objection_playbook')
      .select('*')
      .eq('active', true)
      .order('category')
    ).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: ({ data }) => {
        this.objections.set((data ?? []) as ObjectionPlaybook[]);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
