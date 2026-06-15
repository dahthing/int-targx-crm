import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { ProjectType, ScopingQuestion, QuestionType } from '../../../core/models/quote.model';

type QuestionForm = Omit<ScopingQuestion, 'id' | 'created_at'>;

const QUESTION_TYPES: { label: string; value: QuestionType }[] = [
  { label: 'Escolha única', value: 'single_choice' },
  { label: 'Multi-selecção', value: 'multi_select' },
  { label: 'Numérico', value: 'numeric' },
  { label: 'Escala de complexidade', value: 'complexity_scale' },
  { label: 'Indicador de risco', value: 'risk_indicator' },
  { label: 'Texto', value: 'text' },
];

const emptyForm = (projectTypeId: string): QuestionForm => ({
  project_type_id: projectTypeId,
  key: '',
  label: '',
  description: null,
  question_type: 'single_choice',
  options: null,
  impacts_price: false,
  activates_modules: null,
  triggers_risk: null,
  sort_order: 1,
  required: true,
});

@Component({
  selector: 'app-scoping-questions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ToastModule, SelectModule],
  template: `
    <p-toast />
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Perguntas de scoping</h1>
          <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">Configurar questionário de levantamento por tipo de projecto.</p>
        </div>
        <button class="tx-btn-primary" (click)="openDrawer(null)" [disabled]="!selectedTypeId()">
          <i class="pi pi-plus mr-2"></i>Nova pergunta
        </button>
      </div>

      <!-- Project type selector -->
      <div class="mb-6">
        <label class="tx-form-label block mb-1">Tipo de projecto</label>
        <p-select
          [options]="projectTypes()"
          [(ngModel)]="selectedTypeId"
          optionLabel="name"
          optionValue="id"
          placeholder="Seleccionar tipo de projecto"
          styleClass="w-80"
          (onChange)="onTypeChange()"
        />
      </div>

      @if (loading()) {
        <div class="tx-card p-8 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-xl"></i>
        </div>
      }

      @if (!loading() && selectedTypeId()) {
        <div class="tx-card overflow-hidden">
          <table class="tx-table w-full">
            <thead>
              <tr>
                <th class="text-left pl-4 w-12">Ord.</th>
                <th class="text-left">Pergunta</th>
                <th class="text-left">Tipo</th>
                <th class="text-center">Afecta preço</th>
                <th class="text-center">Obrigatória</th>
                <th class="w-28"></th>
              </tr>
            </thead>
            <tbody>
              @for (q of questions(); track q.id) {
                <tr class="border-t border-[var(--tx-gray-200)] hover:bg-[var(--tx-gray-050)]">
                  <td class="pl-4 py-3 text-center font-mono text-body-sm text-[var(--tx-gray-400)]">{{ q.sort_order }}</td>
                  <td class="py-3">
                    <p class="font-medium text-[var(--tx-gray-950)]">{{ q.label }}</p>
                    <p class="text-body-sm font-mono text-[var(--tx-gray-400)] mt-0.5">{{ q.key }}</p>
                    @if (q.description) {
                      <p class="text-body-sm text-[var(--tx-gray-400)] mt-0.5">{{ q.description }}</p>
                    }
                  </td>
                  <td class="py-3">
                    <span class="tx-badge tx-badge-blue text-body-sm">{{ questionTypeLabel(q.question_type) }}</span>
                  </td>
                  <td class="py-3 text-center">
                    @if (q.impacts_price) { <i class="pi pi-check text-[var(--tx-teal-500)]"></i> }
                    @else { <span class="text-[var(--tx-gray-200)]">—</span> }
                  </td>
                  <td class="py-3 text-center">
                    @if (q.required) { <i class="pi pi-check text-[var(--tx-teal-500)]"></i> }
                    @else { <span class="text-[var(--tx-gray-200)]">—</span> }
                  </td>
                  <td class="py-3 pr-3">
                    <div class="flex justify-end gap-1">
                      <button class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center" (click)="moveQuestion(q, -1)" [disabled]="q.sort_order === 1" aria-label="Mover para cima">
                        <i class="pi pi-chevron-up text-xs"></i>
                      </button>
                      <button class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center" (click)="moveQuestion(q, 1)" [disabled]="q.sort_order === questions().length" aria-label="Mover para baixo">
                        <i class="pi pi-chevron-down text-xs"></i>
                      </button>
                      <button class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center" (click)="openDrawer(q)">
                        <i class="pi pi-pencil text-xs"></i>
                      </button>
                      <button class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center text-[var(--tx-danger)]" (click)="deleteQuestion(q)">
                        <i class="pi pi-trash text-xs"></i>
                      </button>
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (questions().length === 0) {
            <div class="p-8 text-center text-[var(--tx-gray-400)]">Sem perguntas para este tipo de projecto.</div>
          }
        </div>
      }

      @if (!selectedTypeId() && !loading()) {
        <div class="tx-card p-10 text-center text-[var(--tx-gray-400)]">
          Seleccione um tipo de projecto para gerir as perguntas.
        </div>
      }
    </div>

    <!-- Drawer -->
    @if (showDrawer()) {
      <div class="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
        <div class="fixed inset-0 bg-black/30" (click)="closeDrawer()"></div>
        <div class="relative bg-white w-full max-w-lg shadow-xl flex flex-col h-full z-10">
          <div class="flex items-center justify-between p-5 border-b border-[var(--tx-gray-200)]">
            <h2 class="text-body font-semibold">{{ editingId() ? 'Editar pergunta' : 'Nova pergunta' }}</h2>
            <button class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center" (click)="closeDrawer()">
              <i class="pi pi-times"></i>
            </button>
          </div>

          <div class="flex-1 overflow-y-auto p-5 space-y-4">
            <div>
              <label class="tx-form-label" for="sq-label">Pergunta</label>
              <input id="sq-label" class="tx-input w-full mt-1" [(ngModel)]="form().label" placeholder="Ex: Quantas páginas?" />
            </div>
            <div>
              <label class="tx-form-label" for="sq-key">Chave</label>
              <input id="sq-key" class="tx-input w-full mt-1 font-mono" [(ngModel)]="form().key" placeholder="num_pages" />
            </div>
            <div>
              <label class="tx-form-label" for="sq-desc">Descrição</label>
              <textarea id="sq-desc" class="tx-input w-full mt-1 h-16 resize-none" [(ngModel)]="form().description"></textarea>
            </div>
            <div>
              <label class="tx-form-label">Tipo de pergunta</label>
              <p-select [options]="questionTypes" [(ngModel)]="form().question_type" optionLabel="label" optionValue="value" styleClass="w-full mt-1" />
            </div>
            <div>
              <label class="tx-form-label" for="sq-order">Ordem</label>
              <input id="sq-order" type="number" class="tx-input w-full mt-1" [(ngModel)]="form().sort_order" min="1" />
            </div>
            <div>
              <label class="tx-form-label" for="sq-options">Opções (JSON)</label>
              <textarea
                id="sq-options"
                class="tx-input w-full mt-1 h-24 resize-none font-mono text-body-sm"
                [(ngModel)]="optionsJson"
                placeholder='{"values": ["sim", "não"]}'
              ></textarea>
            </div>
            <div class="flex gap-4">
              <div class="flex items-center gap-2">
                <input type="checkbox" id="sq-price" [(ngModel)]="form().impacts_price" />
                <label for="sq-price" class="tx-form-label mb-0 cursor-pointer">Afecta preço</label>
              </div>
              <div class="flex items-center gap-2">
                <input type="checkbox" id="sq-required" [(ngModel)]="form().required" />
                <label for="sq-required" class="tx-form-label mb-0 cursor-pointer">Obrigatória</label>
              </div>
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
export class ScopingQuestionsComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly questionTypes = QUESTION_TYPES;
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly projectTypes = signal<ProjectType[]>([]);
  readonly questions = signal<ScopingQuestion[]>([]);
  readonly showDrawer = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly form = signal<QuestionForm>(emptyForm(''));
  selectedTypeId = signal<string>('');
  optionsJson = '';

  async ngOnInit(): Promise<void> {
    const { data } = await this.#supabase.from('project_types').select('*').order('sort_order');
    this.projectTypes.set((data ?? []) as ProjectType[]);
  }

  async onTypeChange(): Promise<void> {
    if (!this.selectedTypeId()) return;
    this.loading.set(true);
    const { data } = await this.#supabase.from('scoping_questions').select('*').eq('project_type_id', this.selectedTypeId()).order('sort_order');
    this.questions.set((data ?? []) as ScopingQuestion[]);
    this.loading.set(false);
  }

  openDrawer(q: ScopingQuestion | null): void {
    this.editingId.set(q?.id ?? null);
    this.form.set(q ? { project_type_id: q.project_type_id, key: q.key, label: q.label, description: q.description, question_type: q.question_type, options: q.options, impacts_price: q.impacts_price, activates_modules: q.activates_modules, triggers_risk: q.triggers_risk, sort_order: q.sort_order, required: q.required } : emptyForm(this.selectedTypeId()));
    this.optionsJson = q?.options ? JSON.stringify(q.options, null, 2) : '';
    this.showDrawer.set(true);
  }

  closeDrawer(): void { this.showDrawer.set(false); }

  async save(): Promise<void> {
    const data = { ...this.form() };
    if (!data.label || !data.key) {
      this.#messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'Pergunta e chave são obrigatórias.' });
      return;
    }
    try {
      data.options = this.optionsJson ? JSON.parse(this.optionsJson) : null;
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'JSON das opções inválido.' });
      return;
    }
    this.saving.set(true);
    try {
      const id = this.editingId();
      if (id) await this.#supabase.from('scoping_questions').update(data).eq('id', id);
      else await this.#supabase.from('scoping_questions').insert(data);
      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Pergunta guardada.' });
      this.closeDrawer();
      await this.onTypeChange();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao guardar.' });
    } finally {
      this.saving.set(false);
    }
  }

  async moveQuestion(q: ScopingQuestion, direction: -1 | 1): Promise<void> {
    const list = [...this.questions()];
    const idx = list.findIndex(x => x.id === q.id);
    const newIdx = idx + direction;
    if (newIdx < 0 || newIdx >= list.length) return;
    const swapWith = list[newIdx];
    await Promise.all([
      this.#supabase.from('scoping_questions').update({ sort_order: swapWith.sort_order }).eq('id', q.id),
      this.#supabase.from('scoping_questions').update({ sort_order: q.sort_order }).eq('id', swapWith.id),
    ]);
    await this.onTypeChange();
  }

  async deleteQuestion(q: ScopingQuestion): Promise<void> {
    await this.#supabase.from('scoping_questions').delete().eq('id', q.id);
    await this.onTypeChange();
  }

  questionTypeLabel(type: QuestionType): string {
    return QUESTION_TYPES.find(t => t.value === type)?.label ?? type;
  }
}
