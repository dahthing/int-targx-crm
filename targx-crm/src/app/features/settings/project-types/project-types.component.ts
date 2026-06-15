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
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { ProjectType } from '../../../core/models/quote.model';

type ProjectTypeForm = Omit<ProjectType, 'id' | 'created_at'>;

const emptyForm = (): ProjectTypeForm => ({
  name: '',
  slug: '',
  description: null,
  icon: null,
  base_hours: 0,
  base_price: 0,
  minimum_price: 0,
  active: true,
  sort_order: 1,
});

@Component({
  selector: 'app-project-types',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ToastModule],
  template: `
    <p-toast />
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Tipos de projecto</h1>
          <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">Configurar categorias de projecto e valores base.</p>
        </div>
        <button class="tx-btn-primary" (click)="openDrawer(null)">
          <i class="pi pi-plus mr-2"></i>Novo tipo
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
                <th class="text-left">Slug</th>
                <th class="text-right">Horas base</th>
                <th class="text-right">Preço base</th>
                <th class="text-right">Preço mínimo</th>
                <th class="text-center">Activo</th>
                <th class="w-20"></th>
              </tr>
            </thead>
            <tbody>
              @for (pt of projectTypes(); track pt.id) {
                <tr class="border-t border-[var(--tx-gray-200)] hover:bg-[var(--tx-gray-050)]">
                  <td class="pl-4 py-3">
                    <span class="font-medium text-[var(--tx-gray-950)]">{{ pt.name }}</span>
                    @if (pt.description) {
                      <p class="text-body-sm text-[var(--tx-gray-400)] mt-0.5">{{ pt.description }}</p>
                    }
                  </td>
                  <td class="py-3 font-mono text-body-sm text-[var(--tx-gray-600)]">{{ pt.slug }}</td>
                  <td class="py-3 text-right font-mono">{{ pt.base_hours }}</td>
                  <td class="py-3 text-right font-mono">{{ formatCurrency(pt.base_price) }}</td>
                  <td class="py-3 text-right font-mono">{{ formatCurrency(pt.minimum_price) }}</td>
                  <td class="py-3 text-center">
                    <button
                      class="w-10 h-6 rounded-full transition-colors relative"
                      [class]="pt.active ? 'bg-[var(--tx-teal-500)]' : 'bg-[var(--tx-gray-200)]'"
                      (click)="toggleActive(pt)"
                      [attr.aria-label]="pt.active ? 'Desactivar' : 'Activar'"
                    >
                      <span
                        class="absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all"
                        [class]="pt.active ? 'left-5' : 'left-1'"
                      ></span>
                    </button>
                  </td>
                  <td class="py-3 pr-3">
                    <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="openDrawer(pt)">
                      <i class="pi pi-pencil text-xs"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (projectTypes().length === 0) {
            <div class="p-8 text-center text-[var(--tx-gray-400)]">Sem tipos de projecto.</div>
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
              {{ editingId() ? 'Editar tipo' : 'Novo tipo de projecto' }}
            </h2>
            <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="closeDrawer()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="tx-form-label" for="pt-name">Nome</label>
              <input id="pt-name" class="tx-input w-full mt-1" [(ngModel)]="form().name" placeholder="Ex: Website institucional" />
            </div>
            <div>
              <label class="tx-form-label" for="pt-slug">Slug</label>
              <input id="pt-slug" class="tx-input w-full mt-1 font-mono" [(ngModel)]="form().slug" placeholder="website-institucional" />
            </div>
            <div>
              <label class="tx-form-label" for="pt-desc">Descrição</label>
              <textarea id="pt-desc" class="tx-input w-full mt-1 h-20 resize-none" [(ngModel)]="form().description" placeholder="Descrição opcional"></textarea>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="tx-form-label" for="pt-hours">Horas base</label>
                <input id="pt-hours" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().base_hours" min="0" />
              </div>
              <div>
                <label class="tx-form-label" for="pt-order">Ordem</label>
                <input id="pt-order" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().sort_order" min="1" />
              </div>
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="tx-form-label" for="pt-base-price">Preço base (€)</label>
                <input id="pt-base-price" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().base_price" min="0" />
              </div>
              <div>
                <label class="tx-form-label" for="pt-min-price">Preço mínimo (€)</label>
                <input id="pt-min-price" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().minimum_price" min="0" />
              </div>
            </div>
            <div class="flex items-center gap-2">
              <input type="checkbox" id="pt-active" [(ngModel)]="form().active" />
              <label for="pt-active" class="tx-form-label mb-0 cursor-pointer">Activo</label>
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
export class ProjectTypesComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly projectTypes = signal<ProjectType[]>([]);
  readonly showDrawer = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<ProjectTypeForm>(emptyForm());

  async ngOnInit(): Promise<void> {
    await this.#load();
  }

  openDrawer(pt: ProjectType | null): void {
    this.editingId.set(pt?.id ?? null);
    this.form.set(pt ? { name: pt.name, slug: pt.slug, description: pt.description, icon: pt.icon, base_hours: pt.base_hours, base_price: pt.base_price, minimum_price: pt.minimum_price, active: pt.active, sort_order: pt.sort_order } : emptyForm());
    this.showDrawer.set(true);
  }

  closeDrawer(): void {
    this.showDrawer.set(false);
  }

  async save(): Promise<void> {
    const data = this.form();
    if (!data.name || !data.slug) {
      this.#messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Nome e slug são obrigatórios.' });
      return;
    }
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) {
        await this.#supabase.from('project_types').update(data).eq('id', id);
      } else {
        await this.#supabase.from('project_types').insert(data);
      }
      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Tipo de projecto guardado.' });
      this.closeDrawer();
      await this.#load();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao guardar.' });
    } finally {
      this.saving.set(false);
    }
  }

  async toggleActive(pt: ProjectType): Promise<void> {
    await this.#supabase.from('project_types').update({ active: !pt.active }).eq('id', pt.id);
    await this.#load();
  }

  async #load(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.#supabase.from('project_types').select('*').order('sort_order');
    this.projectTypes.set((data ?? []) as ProjectType[]);
    this.loading.set(false);
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
