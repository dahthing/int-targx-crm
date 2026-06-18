import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { Project, ProjectStatus } from '../../../core/models/project.model';

interface StatusOption {
  label: string;
  value: ProjectStatus | null;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TableModule, SelectModule, InputTextModule, ToastModule],
  providers: [MessageService],
  styles: [`
    .projects-page { padding:24px; }
    .projects-header { margin-bottom:24px; display:flex; align-items:center; justify-content:space-between; }
    .projects-filters { display:flex; gap:16px; flex-wrap:wrap; align-items:flex-end; margin-bottom:16px; }
    .col-title { font-weight:500; color:var(--tx-gray-800); }
    .col-meta { color:var(--tx-gray-500); }
    .col-amount { text-align:right; font-variant-numeric:tabular-nums; font-weight:600; }
    .col-date { color:var(--tx-gray-400); font-size:0.8125rem; }
    .tx-badge-gray   { background:var(--tx-gray-100); color:var(--tx-gray-700); }
    .tx-badge-teal   { background:#CCFBF1; color:#0F766E; }
    .tx-badge-gold   { background:#FEF9C3; color:#854D0E; }
    .tx-badge-green  { background:#DCFCE7; color:#15803D; }
    .drawer-overlay { position:fixed; inset:0; z-index:40; background:rgba(0,0,0,0.4); }
    .drawer { position:fixed; top:0; right:0; height:100%; width:420px; z-index:50; display:flex; flex-direction:column; background:#fff; box-shadow:-4px 0 24px rgba(0,0,0,0.15); }
    .drawer-header { display:flex; align-items:center; justify-content:space-between; padding:20px 24px; border-bottom:1px solid var(--tx-gray-200); }
    .drawer-title { font-size:1rem; font-weight:600; color:var(--tx-gray-900); }
    .drawer-body { flex:1; padding:24px; display:flex; flex-direction:column; gap:16px; overflow-y:auto; }
    .drawer-footer { padding:20px 24px; border-top:1px solid var(--tx-gray-200); display:flex; gap:12px; }
    .drawer-footer button { flex:1; }
  `],
  template: `
    <p-toast />
    <div class="projects-page">
      <div class="projects-header">
        <h1 class="page-title">Projectos</h1>
        <button class="tx-btn-primary" (click)="openNew()">
          <i class="pi pi-plus"></i>Novo projecto
        </button>
      </div>
      <div class="tx-card">
        <div class="projects-filters">
          <input
            type="text"
            class="tx-input"
            placeholder="Pesquisar projecto..."
            [(ngModel)]="searchTerm"
            style="width:240px"
          />
          <p-select
            [options]="statusOptions"
            [(ngModel)]="selectedStatus"
            optionLabel="label"
            optionValue="value"
            placeholder="Filtrar por estado"
            styleClass="tx-input"
            style="width:200px"
            (onChange)="onStatusChange()"
          />
        </div>

        <p-table
          [value]="filtered()"
          styleClass="tx-table"
          [loading]="loading()"
          [paginator]="true"
          [rows]="20"
          [rowHover]="true"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Projecto</th>
              <th>Estado</th>
              <th style="text-align:right">Valor</th>
              <th>Data início</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-project>
            <tr style="cursor:pointer" (click)="goTo(project)">
              <td><span class="col-title">{{ project.title }}</span></td>
              <td>
                <span class="tx-badge" [class]="'tx-badge ' + statusClass(project.status)">
                  {{ statusLabel(project.status) }}
                </span>
              </td>
              <td class="col-amount">{{ formatCurrency(project.contract_value) }}</td>
              <td class="col-date">{{ formatDate(project.contract_date) }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="4">
                <div class="empty-state">Nenhum projecto encontrado.</div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <!-- New Project Drawer -->
    @if (showNewDrawer()) {
      <div class="drawer-overlay" (click)="closeNew()"></div>
      <div class="drawer">
        <div class="drawer-header">
          <span class="drawer-title">Novo Projecto</span>
          <button class="tx-btn-ghost" (click)="closeNew()" aria-label="Fechar"><i class="pi pi-times"></i></button>
        </div>
        <div class="drawer-body">
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="proj-title">Título *</label>
            <input id="proj-title" type="text" class="tx-input" [(ngModel)]="newForm.title" placeholder="Nome do projecto" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="proj-client">Cliente *</label>
            <select id="proj-client" class="tx-input" [(ngModel)]="newForm.client_id">
              <option value="">Seleccionar cliente…</option>
              @for (c of clients(); track c.id) {
                <option [value]="c.id">{{ c.name }}</option>
              }
            </select>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="proj-value">Valor contrato (€) *</label>
            <input id="proj-value" type="number" class="tx-input" [(ngModel)]="newForm.contract_value" min="0" step="100" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="proj-date">Data contrato *</label>
            <input id="proj-date" type="date" class="tx-input" [(ngModel)]="newForm.contract_date" />
          </div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <label class="tx-form-label" for="proj-desc">Descrição</label>
            <textarea id="proj-desc" class="tx-input" [(ngModel)]="newForm.description" rows="3" placeholder="Opcional"></textarea>
          </div>
        </div>
        <div class="drawer-footer">
          <button class="tx-btn-secondary" (click)="closeNew()">Cancelar</button>
          <button class="tx-btn-primary" (click)="saveNew()" [disabled]="saving() || !newForm.title || !newForm.client_id || !newForm.contract_value || !newForm.contract_date">
            @if (saving()) { <i class="pi pi-spin pi-spinner" style="margin-right:6px"></i> }
            Criar projecto
          </button>
        </div>
      </div>
    }
  `,
})
export class ProjectListComponent implements OnInit {
  readonly #projectService = inject(ProjectService);
  readonly #authService = inject(AuthService);
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly projects = signal<Project[]>([]);
  readonly clients = signal<{ id: string; name: string }[]>([]);
  readonly showNewDrawer = signal(false);

  newForm = { title: '', client_id: '', contract_value: 0, contract_date: new Date().toISOString().split('T')[0], description: '' };

  searchTerm = '';
  selectedStatus: ProjectStatus | null = null;

  readonly statusOptions: StatusOption[] = [
    { label: 'Todos os estados', value: null },
    { label: 'Em Curso', value: 'em_curso' },
    { label: 'Concluído', value: 'concluido' },
    { label: 'Cancelado', value: 'cancelado' },
  ];

  readonly filtered = computed(() => {
    const q = this.searchTerm.toLowerCase().trim();
    if (!q) return this.projects();
    return this.projects().filter(p => p.title.toLowerCase().includes(q));
  });

  ngOnInit(): void {
    this.#load();
    void this.#loadClients();
  }

  async #loadClients(): Promise<void> {
    const { data } = await this.#supabase.from('clients').select('id, name').order('name');
    this.clients.set((data ?? []) as { id: string; name: string }[]);
  }

  openNew(): void {
    this.newForm = { title: '', client_id: '', contract_value: 0, contract_date: new Date().toISOString().split('T')[0], description: '' };
    this.showNewDrawer.set(true);
  }

  closeNew(): void { this.showNewDrawer.set(false); }

  async saveNew(): Promise<void> {
    const profile = this.#authService.currentProfile();
    if (!profile) return;
    this.saving.set(true);
    try {
      await this.#projectService.create({
        title: this.newForm.title,
        client_id: this.newForm.client_id,
        partner_id: profile.id,
        contract_value: this.newForm.contract_value,
        contract_date: this.newForm.contract_date,
        description: this.newForm.description || undefined,
        created_by: profile.id,
      });
      this.#messageService.add({ severity: 'success', summary: 'Projecto criado' });
      this.closeNew();
      this.#load();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro ao criar projecto' });
    } finally {
      this.saving.set(false);
    }
  }

  onStatusChange(): void {
    this.#load();
  }

  #load(): void {
    this.loading.set(true);
    const filters = this.selectedStatus ? { status: this.selectedStatus } : undefined;
    this.#projectService
      .getAll(filters)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
      next: (list) => {
        this.projects.set(list);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected goTo(project: Project): void {
    void this.#router.navigate(['/projects', project.id]);
  }

  protected statusLabel(status: string): string {
    const LABELS: Record<string, string> = {
      em_curso: 'Em Curso',
      pausado: 'Pausado',
      concluido: 'Concluído',
      cancelado: 'Cancelado',
    };
    return LABELS[status] ?? status;
  }

  protected statusClass(status: string): string {
    const MAP: Record<string, string> = {
      em_curso: 'tx-badge-teal',
      pausado: 'tx-badge-gold',
      concluido: 'tx-badge-green',
      cancelado: 'tx-badge-red',
    };
    return MAP[status] ?? 'tx-badge-gray';
  }

  protected formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' }).format(new Date(dateStr));
  }
}
