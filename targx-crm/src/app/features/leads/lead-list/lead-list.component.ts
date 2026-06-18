import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SlicePipe } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';
import { DragDropModule, CdkDragDrop, transferArrayItem, CdkDragPlaceholder } from '@angular/cdk/drag-drop';
import { LeadService } from '../../../core/services/lead.service';
import { ProjectService } from '../../../core/services/project.service';
import { ExcelExportService } from '../../../core/services/excel-export.service';
import { Lead, LeadStatus } from '../../../core/models/lead.model';
import type { Project } from '../../../core/models/project.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { LeadFormComponent } from '../lead-form/lead-form.component';

const OPEN_STATUSES: LeadStatus[] = ['nova', 'contactada', 'proposta_enviada', 'negociacao'];

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return '€\u00a0' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-lead-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe, ButtonModule, TabsModule, DragDropModule, CdkDragPlaceholder, StatusBadgeComponent, LeadFormComponent],
  styles: [`
    .leads-page { padding: 24px; }
    .leads-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:16px; }
    .leads-header-actions { display:flex; align-items:center; gap:8px; }
    .kanban-board { display:flex; gap:16px; overflow-x:auto; padding-bottom:16px; align-items:flex-start; }
    .kanban-column { flex-shrink:0; width:272px; display:flex; flex-direction:column; }
    .kanban-col-header { display:flex; align-items:center; gap:8px; margin-bottom:10px; padding:0 4px; }
    .kanban-col-count { font-size:0.75rem; font-weight:600; color:var(--tx-gray-400); background:var(--tx-gray-100); border-radius:var(--radius-full); padding:1px 7px; font-variant-numeric:tabular-nums; }
    .kanban-cards { display:flex; flex-direction:column; gap:10px; overflow-y:auto; max-height:calc(100vh - 260px); padding-bottom:4px; min-height:60px; }
    .lead-card { background:white; border-radius:var(--radius-lg); border:1px solid var(--tx-gray-200); box-shadow:var(--shadow-card); padding:14px 16px; cursor:grab; transition:box-shadow var(--transition-base), border-color var(--transition-base); }
    .lead-card:hover { box-shadow:var(--shadow-md); border-color:var(--tx-teal-100); }
    .lead-card-top { display:flex; align-items:flex-start; justify-content:space-between; gap:8px; margin-bottom:6px; }
    .lead-title { font-size:0.875rem; font-weight:600; color:var(--tx-gray-800); line-height:1.35; margin:0; }
    .lead-client { font-size:0.75rem; color:var(--tx-gray-600); margin:0 0 8px; }
    .lead-footer { display:flex; align-items:center; justify-content:space-between; margin-top:8px; }
    .lead-value { font-size:0.875rem; font-weight:600; color:var(--tx-teal-600); font-variant-numeric:tabular-nums; }
    .lead-date { font-size:0.75rem; color:var(--tx-gray-400); }
    .silence-dot { font-size:0.875rem; flex-shrink:0; }
    .lead-card-empty { background:transparent; border:1px dashed var(--tx-gray-200); border-radius:var(--radius-lg); padding:20px; text-align:center; font-size:0.8125rem; color:var(--tx-gray-400); }
    .silence-badge { display:inline-flex; align-items:center; gap:4px; font-size:0.6875rem; font-weight:600; padding:2px 6px; border-radius:var(--radius-full); margin-top:6px; }
    .silence-badge.warn { background:var(--tx-gold-bg); color:#92400E; }
    .silence-badge.alert { background:#FEE2E2; color:#B91C1C; }
  `],
  template: `
    <div class="leads-page">
      <div class="leads-header">
        <h1 class="page-title">Leads</h1>
        <div class="leads-header-actions">
          <button class="tx-btn-ghost" [disabled]="leads().length === 0" (click)="exportCsv()">
            <i class="pi pi-file-excel" style="margin-right:6px"></i>Exportar CSV
          </button>
          <button class="tx-btn-primary" (click)="showForm.set(true)">
            <i class="pi pi-plus" style="margin-right:6px"></i>Nova lead
          </button>
        </div>
      </div>

      <p-tabs [value]="activeTab()" (valueChange)="onTabChange($event ?? 'pipeline')">
        <p-tablist>
          <p-tab value="pipeline">Pipeline</p-tab>
          <p-tab value="active">
            Clientes Activos
            @if (activeProjects().length > 0) {
              <span style="margin-left:6px;background:var(--tx-teal-500);color:white;font-size:0.6875rem;font-weight:700;border-radius:10px;padding:1px 7px">{{ activeProjects().length }}</span>
            }
          </p-tab>
          <p-tab value="pending">
            Por Converter
            @if (pendingLeads().length > 0) {
              <span style="margin-left:6px;background:var(--tx-gold);color:white;font-size:0.6875rem;font-weight:700;border-radius:10px;padding:1px 7px">{{ pendingLeads().length }}</span>
            }
          </p-tab>
        </p-tablist>

        <p-tabpanels>
          <!-- PIPELINE TAB -->
          <p-tabpanel value="pipeline">
            <div class="kanban-board" cdkDropListGroup style="padding-top:16px">
              @for (col of columns(); track col.status) {
                <div class="kanban-column">
                  <div class="kanban-col-header">
                    <app-status-badge [status]="col.status" type="lead" />
                    <span class="kanban-col-count">{{ col.leads.length }}</span>
                  </div>
                  <div
                    class="kanban-cards"
                    cdkDropList
                    [id]="col.status"
                    [cdkDropListData]="col.leads"
                    [cdkDropListConnectedTo]="connectedLists"
                    (cdkDropListDropped)="onDrop($event)"
                  >
                    @for (lead of col.leads; track lead.id) {
                      <div
                        class="lead-card"
                        cdkDrag
                        [cdkDragData]="lead"
                        (click)="openLead(lead.id)"
                        (keydown.enter)="openLead(lead.id)"
                        tabindex="0"
                        role="button"
                        [attr.aria-label]="'Abrir lead ' + lead.title"
                      >
                        <div *cdkDragPlaceholder class="lead-card" style="opacity:0.3;border:2px dashed var(--tx-teal-300);background:var(--tx-teal-50)"></div>
                        <div class="lead-card-top">
                          <p class="lead-title">{{ lead.title }}</p>
                          @if (daysSince(lead.last_activity_at) > 14) {
                            <span class="silence-dot" title="Sem actividade há mais de 14 dias">🔴</span>
                          } @else if (daysSince(lead.last_activity_at) > 7) {
                            <span class="silence-dot" title="Sem actividade há mais de 7 dias">🟡</span>
                          }
                        </div>
                        @if (lead.client_name) {
                          <p class="lead-client">{{ lead.client_name }}</p>
                        }
                        @if (daysSince(lead.last_activity_at) > 14) {
                          <span class="silence-badge alert">
                            <i class="pi pi-exclamation-triangle"></i>
                            {{ daysSince(lead.last_activity_at) }}d sem actividade
                          </span>
                        } @else if (daysSince(lead.last_activity_at) > 7) {
                          <span class="silence-badge warn">
                            <i class="pi pi-clock"></i>
                            {{ daysSince(lead.last_activity_at) }}d sem actividade
                          </span>
                        }
                        <div class="lead-footer">
                          <span class="lead-value">{{ formatCurrency(lead.estimated_value) }}</span>
                          @if (lead.next_action_date) {
                            <span class="lead-date">{{ lead.next_action_date | slice:0:10 }}</span>
                          }
                        </div>
                      </div>
                    } @empty {
                      <div class="lead-card-empty">Sem leads nesta coluna</div>
                    }
                  </div>
                </div>
              }
            </div>
          </p-tabpanel>

          <!-- CLIENTES ACTIVOS TAB -->
          <p-tabpanel value="active">
            <div style="padding-top:16px">
              @if (activeProjects().length === 0) {
                <div style="text-align:center;padding:48px;color:var(--tx-gray-400)">
                  <i class="pi pi-briefcase" style="font-size:2rem;display:block;margin-bottom:12px"></i>
                  <p>Sem projectos em curso.</p>
                </div>
              } @else {
                <table class="tx-table" style="width:100%">
                  <thead>
                    <tr>
                      <th>Cliente / Projecto</th>
                      <th>Contrato</th>
                      <th>Tranches pagas</th>
                      <th>Pendente</th>
                      <th>Estado</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (p of activeProjects(); track p.id) {
                      <tr>
                        <td>
                          <div style="font-weight:500;font-size:0.875rem">{{ p.title }}</div>
                        </td>
                        <td style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--tx-teal-600)">
                          {{ formatCurrency(p.contract_value) }}
                        </td>
                        <td style="font-size:0.8125rem;color:var(--tx-gray-600)">
                          {{ formatCurrency(p['paid_amount']) }}
                        </td>
                        <td style="font-size:0.8125rem;color:var(--tx-gray-500)">
                          {{ formatCurrency(p.contract_value - p['paid_amount']) }}
                        </td>
                        <td>
                          <span class="tx-badge" style="background:var(--tx-teal-100);color:var(--tx-teal-700)">Em curso</span>
                        </td>
                        <td>
                          <button class="tx-btn-ghost" style="font-size:0.8125rem;padding:4px 10px" (click)="openProject(p.id)">
                            Ver projecto →
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </p-tabpanel>

          <!-- POR CONVERTER TAB -->
          <p-tabpanel value="pending">
            <div style="padding-top:16px">
              @if (pendingLeads().length === 0) {
                <div style="text-align:center;padding:48px;color:var(--tx-gray-400)">
                  <i class="pi pi-check-circle" style="font-size:2rem;display:block;margin-bottom:12px;color:var(--tx-teal-400)"></i>
                  <p>Sem leads ganhas por converter.</p>
                </div>
              } @else {
                <div style="background:var(--tx-gold-bg);border:1px solid var(--tx-gold);border-radius:8px;padding:12px 16px;margin-bottom:16px;display:flex;align-items:center;gap:8px">
                  <i class="pi pi-exclamation-triangle" style="color:var(--tx-gold)"></i>
                  <span style="font-size:0.875rem;color:#92400E">{{ pendingLeads().length }} lead(s) ganha(s) sem projecto criado</span>
                </div>
                <table class="tx-table" style="width:100%">
                  <thead>
                    <tr>
                      <th>Lead</th>
                      <th>Cliente</th>
                      <th>Valor estimado</th>
                      <th>Nota</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (l of pendingLeads(); track l.id) {
                      <tr>
                        <td style="font-weight:500;font-size:0.875rem">{{ l.title }}</td>
                        <td style="font-size:0.8125rem;color:var(--tx-gray-600)">{{ l.client_name ?? '—' }}</td>
                        <td style="font-family:'JetBrains Mono',monospace;font-size:0.875rem;color:var(--tx-teal-600)">{{ formatCurrency(l.estimated_value) }}</td>
                        <td style="font-size:0.8125rem;color:var(--tx-gray-500);max-width:240px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ l.pending_conversion_note ?? '—' }}</td>
                        <td>
                          <button class="tx-btn-primary" style="font-size:0.8125rem;padding:4px 12px" (click)="openLead(l.id)">
                            Converter →
                          </button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              }
            </div>
          </p-tabpanel>
        </p-tabpanels>
      </p-tabs>
    </div>

    <app-lead-form [(visible)]="showForm" (leadCreated)="onLeadCreated()" />
  `,
})
export class LeadListComponent implements OnInit {
  private readonly leadService = inject(LeadService);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly excelExport = inject(ExcelExportService);

  protected readonly showForm = signal(false);
  protected readonly leads = signal<Lead[]>([]);
  protected readonly activeProjects = signal<(Project & { paid_amount: number })[]>([]);
  protected readonly activeTab = signal<'pipeline' | 'active' | 'pending'>('pipeline');

  protected readonly columns = computed(() =>
    OPEN_STATUSES.map(status => ({
      status,
      leads: this.leads().filter(l => l.status === status),
    }))
  );

  protected readonly pendingLeads = computed(() =>
    this.leads().filter(l => l.pending_conversion)
  );

  protected readonly connectedLists = OPEN_STATUSES;
  protected readonly daysSince = daysSince;
  protected readonly formatCurrency = formatCurrency;

  ngOnInit(): void {
    this.loadLeads();
    this.loadActiveProjects();
  }

  private loadLeads(): void {
    this.leadService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: leads => this.leads.set(leads),
    });
  }

  private loadActiveProjects(): void {
    this.projectService.getAll({ status: 'em_curso' })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: projects => {
          // Enrich with paid_amount (sum of received tranches) — loaded lazily per project
          // For list view, use contract_value as proxy; detail has real tranches
          const enriched = projects.map(p => ({
            ...p,
            paid_amount: 0,
          }));
          this.activeProjects.set(enriched);
        },
      });
  }

  protected onTabChange(tab: string | number): void {
    this.activeTab.set(tab as 'pipeline' | 'active' | 'pending');
  }

  protected openLead(id: string): void {
    this.router.navigate(['/leads', id]);
  }

  protected openProject(id: string): void {
    this.router.navigate(['/projects', id]);
  }

  protected onLeadCreated(): void {
    this.showForm.set(false);
    this.loadLeads();
  }

  protected exportCsv(): void {
    this.excelExport.exportLeads(this.leads(), `leads_${new Date().toISOString().split('T')[0]}`);
  }

  protected async onDrop(event: CdkDragDrop<Lead[]>): Promise<void> {
    if (event.previousContainer === event.container) return;

    const lead: Lead = event.item.data;
    const newStatus = event.container.id as LeadStatus;

    // Optimistic update
    this.leads.update(all =>
      all.map(l => l.id === lead.id ? { ...l, status: newStatus } : l)
    );

    // transferArrayItem for visual feedback (already done via signal but CDK expects this)
    transferArrayItem(
      event.previousContainer.data,
      event.container.data,
      event.previousIndex,
      event.currentIndex,
    );

    // Persist to DB
    await this.leadService.update(lead.id, { status: newStatus }).catch(() => {
      // Revert on error
      this.loadLeads();
    });
  }
}

