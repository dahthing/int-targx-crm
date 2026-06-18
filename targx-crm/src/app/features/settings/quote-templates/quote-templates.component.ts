import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';

interface QuoteTemplate {
  id: string;
  name: string;
  description: string | null;
  project_type_id: string | null;
  project_type_name?: string;
  usage_count: number;
  created_at: string;
}

interface ProjectType {
  id: string;
  name: string;
}

@Component({
  selector: 'app-quote-templates',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ToastModule, DialogModule],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="page-title">Templates de Orçamento</h1>
          <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">Estruturas reutilizáveis para criar orçamentos mais rapidamente.</p>
        </div>
        <button class="tx-btn-primary" (click)="openCreate()">
          <i class="pi pi-plus mr-2"></i>Novo template
        </button>
      </div>

      @if (loading()) {
        <div class="tx-card p-12 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-2xl"></i>
        </div>
      } @else if (templates().length === 0) {
        <div class="tx-card p-12 text-center">
          <i class="pi pi-file text-[var(--tx-gray-300)] text-4xl mb-3"></i>
          <p class="text-body text-[var(--tx-gray-500)]">Sem templates. Crie o primeiro.</p>
        </div>
      } @else {
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          @for (tpl of templates(); track tpl.id) {
            <div class="tx-card p-5 flex flex-col gap-3">
              <div class="flex items-start justify-between gap-2">
                <div class="flex-1 min-w-0">
                  <h3 class="text-body font-semibold text-[var(--tx-gray-950)] truncate">{{ tpl.name }}</h3>
                  @if (tpl.description) {
                    <p class="text-body-sm text-[var(--tx-gray-500)] mt-0.5 line-clamp-2">{{ tpl.description }}</p>
                  }
                </div>
                <div class="flex gap-1 shrink-0">
                  <button
                    class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center"
                    (click)="openEdit(tpl)"
                    [attr.aria-label]="'Editar ' + tpl.name"
                  ><i class="pi pi-pencil text-xs"></i></button>
                  <button
                    class="tx-btn-ghost w-7 h-7 p-0 flex items-center justify-center text-[var(--tx-danger)]"
                    (click)="deleteTemplate(tpl)"
                    [attr.aria-label]="'Apagar ' + tpl.name"
                  ><i class="pi pi-trash text-xs"></i></button>
                </div>
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                @if (tpl.project_type_name) {
                  <span class="tx-badge tx-badge-blue">{{ tpl.project_type_name }}</span>
                } @else {
                  <span class="tx-badge tx-badge-gray">Genérico</span>
                }
                <span class="text-body-sm text-[var(--tx-gray-400)]">
                  <i class="pi pi-refresh mr-1"></i>{{ tpl.usage_count }} utilizações
                </span>
              </div>

              <div class="text-body-sm text-[var(--tx-gray-400)] border-t border-[var(--tx-gray-100)] pt-2">
                Criado {{ formatDate(tpl.created_at) }}
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Create/Edit dialog -->
    <p-dialog
      [(visible)]="showDialog"
      [modal]="true"
      [style]="{ width: '480px' }"
      [header]="editingId ? 'Editar template' : 'Novo template'"
      [closable]="true"
      (onHide)="resetForm()"
    >
      <div class="space-y-4 p-2">
        <div>
          <label class="tx-form-label" for="tpl-name">Nome *</label>
          <input id="tpl-name" class="tx-input w-full mt-1" [(ngModel)]="form.name" placeholder="Ex: Loja E-commerce Base" />
        </div>
        <div>
          <label class="tx-form-label" for="tpl-desc">Descrição</label>
          <textarea id="tpl-desc" class="tx-input w-full mt-1" rows="2" [(ngModel)]="form.description"
            placeholder="Breve descrição do template..."></textarea>
        </div>
        <div>
          <label class="tx-form-label" for="tpl-type">Tipo de projecto</label>
          <select id="tpl-type" class="tx-input w-full mt-1" [(ngModel)]="form.project_type_id">
            <option [ngValue]="null">Genérico (todos os tipos)</option>
            @for (pt of projectTypes(); track pt.id) {
              <option [value]="pt.id">{{ pt.name }}</option>
            }
          </select>
        </div>
      </div>
      <div class="flex justify-end gap-2 mt-4 pt-4 border-t border-[var(--tx-gray-200)]">
        <button class="tx-btn-secondary" (click)="showDialog = false">Cancelar</button>
        <button class="tx-btn-primary" (click)="save()" [disabled]="!form.name.trim() || saving()">
          @if (saving()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
          {{ editingId ? 'Guardar' : 'Criar' }}
        </button>
      </div>
    </p-dialog>
  `,
})
export class QuoteTemplatesComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly templates = signal<QuoteTemplate[]>([]);
  readonly projectTypes = signal<ProjectType[]>([]);

  showDialog = false;
  editingId: string | null = null;
  form = { name: '', description: '', project_type_id: null as string | null };

  async ngOnInit(): Promise<void> {
    await Promise.all([this.#loadTemplates(), this.#loadProjectTypes()]);
  }

  async #loadTemplates(): Promise<void> {
    this.loading.set(true);
    try {
      const { data } = await this.#supabase
        .from('quote_templates')
        .select('*, project_types(name)')
        .order('created_at', { ascending: false });

      this.templates.set((data ?? []).map((t: Record<string, unknown>) => ({
        id: t['id'] as string,
        name: t['name'] as string,
        description: t['description'] as string | null,
        project_type_id: t['project_type_id'] as string | null,
        project_type_name: (t['project_types'] as { name: string } | null)?.name,
        usage_count: (t['usage_count'] as number) ?? 0,
        created_at: t['created_at'] as string,
      })));
    } finally {
      this.loading.set(false);
    }
  }

  async #loadProjectTypes(): Promise<void> {
    const { data } = await this.#supabase.from('project_types').select('id, name').eq('active', true).order('name');
    this.projectTypes.set((data ?? []) as ProjectType[]);
  }

  openCreate(): void {
    this.editingId = null;
    this.resetForm();
    this.showDialog = true;
  }

  openEdit(tpl: QuoteTemplate): void {
    this.editingId = tpl.id;
    this.form = { name: tpl.name, description: tpl.description ?? '', project_type_id: tpl.project_type_id };
    this.showDialog = true;
  }

  resetForm(): void {
    this.form = { name: '', description: '', project_type_id: null };
  }

  async save(): Promise<void> {
    if (!this.form.name.trim()) return;
    this.saving.set(true);
    try {
      const payload = {
        name: this.form.name.trim(),
        description: this.form.description.trim() || null,
        project_type_id: this.form.project_type_id || null,
      };
      if (this.editingId) {
        await this.#supabase.from('quote_templates').update(payload).eq('id', this.editingId);
        this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Template actualizado.' });
      } else {
        await this.#supabase.from('quote_templates').insert({ ...payload, usage_count: 0 });
        this.#messageService.add({ severity: 'success', summary: 'Criado', detail: 'Template criado com sucesso.' });
      }
      this.showDialog = false;
      await this.#loadTemplates();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível guardar.' });
    } finally {
      this.saving.set(false);
    }
  }

  async deleteTemplate(tpl: QuoteTemplate): Promise<void> {
    if (!confirm(`Apagar template "${tpl.name}"?`)) return;
    try {
      await this.#supabase.from('quote_templates').delete().eq('id', tpl.id);
      this.templates.update(list => list.filter(t => t.id !== tpl.id));
      this.#messageService.add({ severity: 'success', summary: 'Apagado', detail: 'Template removido.' });
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível apagar.' });
    }
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
  }
}
