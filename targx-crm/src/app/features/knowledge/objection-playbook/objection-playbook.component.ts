import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { ObjectionPlaybook, ObjectionCategory } from '../../../core/models/knowledge.model';

const CATEGORY_LABELS: Record<ObjectionCategory, string> = {
  preco: 'Preço',
  prazo: 'Prazo',
  tecnologia: 'Tecnologia',
  concorrencia: 'Concorrência',
  outro: 'Outro',
};

const CATEGORIES: ObjectionCategory[] = ['preco', 'prazo', 'tecnologia', 'concorrencia', 'outro'];

@Component({
  selector: 'app-objection-playbook',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToastModule],
  providers: [MessageService],
  styles: [`
    .page-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .filter-bar { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:24px; align-items:center; }
    .objection-grid { display:flex; flex-direction:column; gap:12px; }
    .objection-card { background:#fff; border:1px solid var(--tx-gray-200); border-radius:12px; padding:20px; }
    .objection-card-header { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
    .objection-question { font-weight:600; color:var(--tx-gray-900); font-size:0.9375rem; margin:0; }
    .objection-response { color:var(--tx-gray-600); font-size:0.875rem; margin-top:8px; line-height:1.5; }
    .objection-actions { display:flex; gap:6px; flex-shrink:0; }
    .cat-badge { display:inline-block; padding:2px 10px; border-radius:20px; font-size:0.75rem; font-weight:500; background:var(--tx-teal-050,#e6faf7); color:var(--tx-teal-700,#0d7d6e); border:1px solid var(--tx-teal-200,#a3e4dc); }
    .empty-state { text-align:center; padding:48px 24px; color:var(--tx-gray-400); }
    .drawer-overlay { position:fixed; inset:0; background:rgba(0,0,0,0.3); z-index:1000; }
    .drawer { position:fixed; top:0; right:0; height:100%; width:520px; background:#fff; box-shadow:-4px 0 24px rgba(0,0,0,0.12); z-index:1001; display:flex; flex-direction:column; }
    .drawer-header { padding:24px; border-bottom:1px solid var(--tx-gray-200); display:flex; align-items:center; justify-content:space-between; }
    .drawer-body { flex:1; overflow-y:auto; padding:24px; display:flex; flex-direction:column; gap:16px; }
    .drawer-footer { padding:16px 24px; border-top:1px solid var(--tx-gray-200); display:flex; gap:12px; justify-content:flex-end; }
    .field { display:flex; flex-direction:column; gap:6px; }
    .field-group { display:flex; flex-direction:column; gap:16px; }
  `],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="page-header">
        <h1 class="page-title">Playbook de Objecções</h1>
        <button class="tx-btn-primary" (click)="openNew()">
          <i class="pi pi-plus" style="margin-right:8px"></i>Nova objecção
        </button>
      </div>

      <!-- Filters -->
      <div class="filter-bar">
        <button
          [class]="'tx-btn-ghost' + (filterCategory() === null ? ' active' : '')"
          [style]="filterCategory() === null ? 'background:var(--tx-teal-600);color:#fff;' : ''"
          (click)="filterCategory.set(null)"
        >Todas</button>
        @for (cat of categories; track cat) {
          <button
            [class]="'tx-btn-ghost'"
            [style]="filterCategory() === cat ? 'background:var(--tx-teal-600);color:#fff;' : ''"
            (click)="filterCategory.set(cat)"
          >{{ categoryLabel(cat) }}</button>
        }
        <input
          class="tx-input"
          [(ngModel)]="searchQuery"
          placeholder="Pesquisar..."
          style="margin-left:auto;max-width:240px;"
        />
      </div>

      @if (loading()) {
        <div class="empty-state">A carregar...</div>
      } @else if (filtered().length === 0) {
        <div class="empty-state">
          <i class="pi pi-book" style="font-size:2rem;display:block;margin-bottom:12px"></i>
          Nenhuma objecção encontrada.
        </div>
      } @else {
        <div class="objection-grid">
          @for (item of filtered(); track item.id) {
            <div class="objection-card">
              <div class="objection-card-header">
                <div style="flex:1">
                  <span class="cat-badge">{{ categoryLabel(item.category) }}</span>
                  <p class="objection-question" style="margin-top:8px">{{ item.objection }}</p>
                  <p class="objection-response">{{ item.response }}</p>
                  @if (item.context) {
                    <p style="font-size:0.8125rem;color:var(--tx-gray-400);margin-top:6px;font-style:italic">{{ item.context }}</p>
                  }
                  @if (item.tags?.length) {
                    <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:8px">
                      @for (tag of item.tags!; track tag) {
                        <span style="background:var(--tx-gray-100);border-radius:4px;padding:2px 8px;font-size:0.75rem;color:var(--tx-gray-600)">{{ tag }}</span>
                      }
                    </div>
                  }
                </div>
                <div class="objection-actions">
                  <button class="tx-btn-ghost" (click)="openEdit(item)" title="Editar">
                    <i class="pi pi-pencil"></i>
                  </button>
                  <button class="tx-btn-ghost" (click)="deleteItem(item)" title="Eliminar" style="color:var(--tx-red,#e53e3e)">
                    <i class="pi pi-trash"></i>
                  </button>
                </div>
              </div>
            </div>
          }
        </div>
      }
    </div>

    <!-- Drawer -->
    @if (showDrawer()) {
      <div class="drawer-overlay" (click)="closeDrawer()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <h2 style="margin:0;font-size:1.125rem;font-weight:600">{{ editingId() ? 'Editar objecção' : 'Nova objecção' }}</h2>
          <button class="tx-btn-ghost" (click)="closeDrawer()"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <div class="field-group">
            <div class="field">
              <label class="tx-form-label">Categoria *</label>
              <select class="tx-input" [(ngModel)]="form.category">
                @for (cat of categories; track cat) {
                  <option [value]="cat">{{ categoryLabel(cat) }}</option>
                }
              </select>
            </div>
            <div class="field">
              <label class="tx-form-label">Objecção *</label>
              <textarea class="tx-input" [(ngModel)]="form.objection" rows="2" placeholder="Ex: O vosso preço é muito alto..."></textarea>
            </div>
            <div class="field">
              <label class="tx-form-label">Resposta *</label>
              <textarea class="tx-input" [(ngModel)]="form.response" rows="4" placeholder="Como responder a esta objecção..."></textarea>
            </div>
            <div class="field">
              <label class="tx-form-label">Contexto</label>
              <textarea class="tx-input" [(ngModel)]="form.context" rows="2" placeholder="Contexto adicional (opcional)"></textarea>
            </div>
            <div class="field">
              <label class="tx-form-label">Tags (separadas por vírgula)</label>
              <input class="tx-input" [(ngModel)]="form.tagsRaw" placeholder="Ex: preço, valor, ROI" />
            </div>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closeDrawer()">Cancelar</button>
          <button class="tx-btn-primary" [disabled]="saving()" (click)="save()">
            {{ saving() ? 'A guardar...' : 'Guardar' }}
          </button>
        </div>
      </div>
    }
  `,
})
export class ObjectionPlaybookComponent implements OnInit {
  readonly #sb = inject(SUPABASE_CLIENT);
  readonly #msg = inject(MessageService);

  readonly categories = CATEGORIES;

  objections = signal<ObjectionPlaybook[]>([]);
  loading = signal(true);
  saving = signal(false);
  showDrawer = signal(false);
  editingId = signal<string | null>(null);
  filterCategory = signal<ObjectionCategory | null>(null);
  searchQuery = '';

  form = {
    category: 'preco' as ObjectionCategory,
    objection: '',
    response: '',
    context: '',
    tagsRaw: '',
  };

  filtered = computed(() => {
    const cat = this.filterCategory();
    const q = this.searchQuery.toLowerCase();
    return this.objections().filter(o => {
      if (cat && o.category !== cat) return false;
      if (q && !o.objection.toLowerCase().includes(q) && !o.response.toLowerCase().includes(q)) return false;
      return true;
    });
  });

  categoryLabel(cat: ObjectionCategory) { return CATEGORY_LABELS[cat]; }

  async ngOnInit() {
    await this.load();
  }

  async load() {
    this.loading.set(true);
    const { data } = await this.#sb.from('objection_playbook').select('*').order('category').order('created_at');
    this.objections.set((data as ObjectionPlaybook[]) ?? []);
    this.loading.set(false);
  }

  openNew() {
    this.editingId.set(null);
    this.form = { category: 'preco', objection: '', response: '', context: '', tagsRaw: '' };
    this.showDrawer.set(true);
  }

  openEdit(item: ObjectionPlaybook) {
    this.editingId.set(item.id);
    this.form = {
      category: item.category,
      objection: item.objection,
      response: item.response,
      context: item.context ?? '',
      tagsRaw: (item.tags ?? []).join(', '),
    };
    this.showDrawer.set(true);
  }

  closeDrawer() { this.showDrawer.set(false); }

  async save() {
    if (!this.form.objection.trim() || !this.form.response.trim()) {
      this.#msg.add({ severity: 'warn', summary: 'Campos obrigatórios', detail: 'Preencha objecção e resposta.' });
      return;
    }
    this.saving.set(true);
    const tags = this.form.tagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    const payload = {
      category: this.form.category,
      objection: this.form.objection.trim(),
      response: this.form.response.trim(),
      context: this.form.context.trim() || null,
      tags: tags.length ? tags : null,
    };
    const id = this.editingId();
    if (id) {
      await this.#sb.from('objection_playbook').update(payload).eq('id', id);
    } else {
      await this.#sb.from('objection_playbook').insert(payload);
    }
    this.saving.set(false);
    this.showDrawer.set(false);
    this.#msg.add({ severity: 'success', summary: 'Guardado', detail: 'Objecção guardada com sucesso.' });
    await this.load();
  }

  async deleteItem(item: ObjectionPlaybook) {
    if (!confirm(`Eliminar objecção "${item.objection.slice(0, 50)}..."?`)) return;
    await this.#sb.from('objection_playbook').delete().eq('id', item.id);
    this.#msg.add({ severity: 'success', summary: 'Eliminado', detail: 'Objecção eliminada.' });
    await this.load();
  }
}
