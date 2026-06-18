import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { TabsModule } from 'primeng/tabs';
import { CheckboxModule } from 'primeng/checkbox';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProjectService, ProjectWithDetails } from '../../../core/services/project.service';
import { ProjectGanttComponent } from '../project-gantt/project-gantt.component';
import { HoursLogComponent } from '../hours-log/hours-log.component';
import type { ProjectTranche } from '../../../core/models/project.model';

@Component({
  selector: 'app-project-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    RouterModule,
    TableModule,
    TabsModule,
    CheckboxModule,
    ToastModule,
    ProjectGanttComponent,
    HoursLogComponent,
  ],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="tx-page-content">
      @if (loading()) {
        <div class="tx-card flex items-center justify-center py-16">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else if (error()) {
        <div class="tx-card py-8 text-center" style="color: var(--tx-danger)">{{ error() }}</div>
      } @else if (project()) {
        <!-- Header -->
        <div class="tx-card mb-6">
          <div class="flex items-start justify-between flex-wrap gap-4">
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h1 class="text-h2">{{ project()!.title }}</h1>
                <span class="tx-badge" [ngClass]="project()!.status">{{ statusLabel(project()!.status) }}</span>
              </div>
              <p style="color: var(--text-secondary)">{{ project()!.client_id }}</p>
            </div>
            <div class="text-right">
              <p class="text-sm" style="color: var(--text-muted)">Valor contratado</p>
              <p class="font-mono text-2xl font-semibold" style="color: var(--tx-teal-600)">
                {{ formatCurrency(project()!.contract_value) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Tabs -->
        <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event)">
          <p-tablist>
            <p-tab [value]="0">Fases</p-tab>
            <p-tab [value]="1">Gantt</p-tab>
            <p-tab [value]="2">Tranches</p-tab>
            <p-tab [value]="3">Horas</p-tab>
          </p-tablist>

          <p-tabpanels>
            <!-- Fases -->
            <p-tabpanel [value]="0">
              <div class="tx-card mt-4">
                <h2 class="text-h3 mb-4">Fases do Projecto</h2>
                @if (project()!.phases.length === 0) {
                  <p style="color: var(--text-muted)">Sem fases associadas.</p>
                } @else {
                  <div class="space-y-3">
                    @for (phase of project()!.phases; track phase.id; let i = $index) {
                      <div class="flex items-center justify-between p-4 rounded-lg" style="border: 1px solid var(--border-subtle); background: var(--bg-surface-2)">
                        <div class="flex items-center gap-3">
                          <span
                            class="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                            style="background: var(--tx-teal-500); color: white"
                          >{{ i + 1 }}</span>
                          <div>
                            <p class="font-medium" style="color: var(--text-primary)">{{ phase.name }}</p>
                            @if (phase.description) {
                              <p class="text-sm" style="color: var(--text-secondary)">{{ phase.description }}</p>
                            }
                          </div>
                        </div>
                        <div class="text-right text-sm" style="color: var(--text-muted)">
                          @if (phase.duration_days) {
                            <span>{{ phase.duration_days }} dias</span>
                          }
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </p-tabpanel>

            <!-- Gantt -->
            <p-tabpanel [value]="1">
              <div class="mt-4">
                @defer (when activeTab() === 1) {
                  <app-project-gantt [projectId]="project()!.id" />
                } @placeholder {
                  <div class="tx-card animate-pulse py-16 text-center" style="color: var(--text-muted)">
                    A carregar Gantt...
                  </div>
                }
              </div>
            </p-tabpanel>

            <!-- Tranches -->
            <p-tabpanel [value]="2">
              <div class="tx-card mt-4">
                <h2 class="text-h3 mb-4">Tranches de Pagamento</h2>

                @if (project()!.tranches.length === 0) {
                  <p style="color: var(--text-muted)">Sem tranches definidas.</p>
                } @else {
                  <p-table [value]="tranches()" styleClass="tx-table">
                    <ng-template pTemplate="header">
                      <tr>
                        <th>Descrição</th>
                        <th class="text-right">Valor</th>
                        <th class="text-center">Recebido</th>
                        <th>Data recebimento</th>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="body" let-tranche>
                      <tr>
                        <td>{{ tranche.description }}</td>
                        <td class="text-right font-mono">{{ formatCurrency(tranche.amount) }}</td>
                        <td class="text-center">
                          <p-checkbox
                            [binary]="true"
                            [(ngModel)]="tranche.received"
                            (onChange)="onTrancheToggle(tranche, $event.checked)"
                          />
                        </td>
                        <td>
                          @if (tranche.received) {
                            <input
                              type="date"
                              class="tx-input"
                              [value]="tranche.received_date ?? ''"
                              (change)="onTrancheDate(tranche, $any($event.target).value)"
                            />
                          } @else {
                            <span style="color: var(--text-muted)">—</span>
                          }
                        </td>
                      </tr>
                    </ng-template>
                    <ng-template pTemplate="footer">
                      <tr>
                        <td class="font-semibold" style="color: var(--text-primary)">Total recebido</td>
                        <td class="text-right font-mono font-semibold" style="color: var(--tx-teal-600)">{{ formatCurrency(totalReceived()) }}</td>
                        <td></td>
                        <td></td>
                      </tr>
                    </ng-template>
                  </p-table>
                }
              </div>
            </p-tabpanel>

            <!-- Horas -->
            <p-tabpanel [value]="3">
              @defer (when activeTab() === 3) {
                <app-hours-log
                  [projectId]="project()!.id"
                  [estimatedHours]="project()!.estimated_hours"
                />
              } @placeholder {
                <div class="tx-card mt-4 py-8 text-center" style="color: var(--text-muted)">A carregar…</div>
              }
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }
    </div>
  `,
})
export class ProjectDetailComponent implements OnInit {
  readonly #projectService = inject(ProjectService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);
  readonly #destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly project = signal<ProjectWithDetails | null>(null);
  readonly activeTab = signal(0);
  readonly tranches = signal<ProjectTranche[]>([]);

  readonly totalReceived = computed(() =>
    this.tranches().filter(t => t.received).reduce((sum, t) => sum + t.amount, 0)
  );

  ngOnInit(): void {
    const id = this.#route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('ID inválido.');
      this.loading.set(false);
      return;
    }
    this.#projectService
      .getById(id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
      next: (p) => {
        this.project.set(p);
        this.tranches.set([...p.tranches]);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  onTrancheToggle(tranche: ProjectTranche, checked: boolean): void {
    this.#projectService
      .updateTranche(tranche.id, checked, tranche.received_date)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
      next: (updated) => {
        this.tranches.update(list =>
          list.map(t => t.id === tranche.id ? { ...t, ...updated } : t)
        );
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
      },
    });
  }

  onTrancheDate(tranche: ProjectTranche, date: string): void {
    this.#projectService
      .updateTranche(tranche.id, tranche.received, date)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
      next: (updated) => {
        this.tranches.update(list =>
          list.map(t => t.id === tranche.id ? { ...t, ...updated } : t)
        );
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
      },
    });
  }

  onTabChange(value: string | number | undefined): void {
    const parsed = typeof value === 'number' ? value : Number.parseInt(value ?? '0', 10);
    this.activeTab.set(Number.isFinite(parsed) ? parsed : 0);
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
}
