import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { InputTextModule } from 'primeng/inputtext';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Project, ProjectStatus } from '../../../core/models/project.model';

interface StatusOption {
  label: string;
  value: ProjectStatus | null;
}

@Component({
  selector: 'app-project-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, TableModule, SelectModule, InputTextModule],
  template: `
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header">
          <div class="flex items-center justify-between flex-wrap gap-4 mb-4">
            <h1 class="text-h2">Projectos</h1>
          </div>
          <div class="flex gap-4 flex-wrap mb-4">
            <input
              type="text"
              class="tx-input"
              placeholder="Pesquisar projecto..."
              [(ngModel)]="searchTerm"
              style="width: 240px"
            />
            <p-select
              [options]="statusOptions"
              [(ngModel)]="selectedStatus"
              optionLabel="label"
              optionValue="value"
              placeholder="Filtrar por estado"
              styleClass="w-48"
              (onChange)="onStatusChange()"
            />
          </div>
        </div>

        <p-table
          [value]="filtered()"
          styleClass="tx-table"
          [loading]="loading()"
          [paginator]="true"
          [rows]="20"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Projecto</th>
              <th>Cliente</th>
              @if (isAdmin()) {
                <th>Parceiro</th>
              }
              <th class="text-right">Valor</th>
              <th>Estado</th>
              <th>Data início</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-project>
            <tr
              class="cursor-pointer"
              style="transition: background var(--transition-base)"
              (click)="goTo(project)"
            >
              <td class="font-medium" style="color: var(--text-primary)">{{ project.title }}</td>
              <td style="color: var(--text-secondary)">{{ project.client_id }}</td>
              @if (isAdmin()) {
                <td style="color: var(--text-secondary)">{{ project.partner_id ?? '—' }}</td>
              }
              <td class="text-right font-mono">{{ formatCurrency(project.contract_value) }}</td>
              <td>
                <span class="tx-badge" [ngClass]="project.status">{{ statusLabel(project.status) }}</span>
              </td>
              <td style="color: var(--text-muted)">{{ formatDate(project.contract_date) }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td [attr.colspan]="isAdmin() ? 6 : 5" class="text-center py-8" style="color: var(--text-muted)">
                Nenhum projecto encontrado.
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
})
export class ProjectListComponent implements OnInit {
  readonly #projectService = inject(ProjectService);
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #destroyRef = takeUntilDestroyed();

  readonly loading = signal(true);
  readonly projects = signal<Project[]>([]);
  readonly isAdmin = computed(() => this.#auth.role() === 'admin');

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
  }

  onStatusChange(): void {
    this.#load();
  }

  #load(): void {
    this.loading.set(true);
    const filters = this.selectedStatus ? { status: this.selectedStatus } : undefined;
    this.#projectService.getAll(filters).pipe(this.#destroyRef).subscribe({
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

  protected formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected formatDate(dateStr: string | null | undefined): string {
    if (!dateStr) return '—';
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short' }).format(new Date(dateStr));
  }
}
