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
import { LeadService } from '../../../core/services/lead.service';
import { ExcelExportService } from '../../../core/services/excel-export.service';
import { Lead, LeadStatus } from '../../../core/models/lead.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { SilenceWarningComponent } from '../../../shared/components/silence-warning/silence-warning.component';
import { LeadFormComponent } from '../lead-form/lead-form.component';

const OPEN_STATUSES: LeadStatus[] = ['nova', 'contactada', 'proposta_enviada', 'negociacao'];

const COLUMN_LABELS: Record<LeadStatus, string> = {
  nova: 'Nova',
  contactada: 'Contactada',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechada_ganha: 'Ganha',
  fechada_perdida: 'Perdida',
};

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

@Component({
  selector: 'app-lead-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SlicePipe, ButtonModule, StatusBadgeComponent, SilenceWarningComponent, LeadFormComponent],
  template: `
    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-h2 text-tx-gray-900">Leads</h1>
        <div class="flex items-center gap-2">
          <button class="tx-btn-ghost" [disabled]="leads().length === 0" (click)="exportCsv()" aria-label="Exportar CSV">
            <i class="pi pi-file-excel" style="margin-right: 6px"></i>
            Exportar CSV
          </button>
          <button class="tx-btn-primary" (click)="showForm.set(true)">
            + Nova lead
          </button>
        </div>
      </div>

      <!-- Kanban board -->
      <div class="kanban-board flex gap-4 overflow-x-auto pb-4">
        @for (col of columns(); track col.status) {
          <div class="kanban-column flex-shrink-0 w-72 flex flex-col">
            <!-- Column header -->
            <div class="flex items-center gap-2 mb-3 px-1">
              <app-status-badge [status]="col.status" type="lead" />
              <span class="text-sm text-tx-gray-500 font-medium">{{ col.leads.length }}</span>
            </div>

            <!-- Cards -->
            <div class="flex flex-col gap-3 overflow-y-auto max-h-[calc(100vh-200px)]">
              @for (lead of col.leads; track lead.id) {
                <div
                  class="tx-card p-4 cursor-pointer hover:shadow-md transition-shadow"
                  (click)="openLead(lead.id)"
                  (keydown.enter)="openLead(lead.id)"
                  tabindex="0"
                  role="button"
                  [attr.aria-label]="'Abrir lead ' + lead.title"
                >
                  <div class="flex items-start justify-between gap-2 mb-2">
                    <p class="text-sm font-semibold text-tx-gray-900 leading-tight">{{ lead.title }}</p>
                    @if (daysSince(lead.last_activity_at) > 14) {
                      <span class="text-base" aria-label="Alerta de silêncio">🔴</span>
                    } @else if (daysSince(lead.last_activity_at) > 7) {
                      <span class="text-base" aria-label="Aviso de silêncio">🟡</span>
                    }
                  </div>

                  @if (lead.client_id) {
                    <p class="text-xs text-tx-gray-500 mb-2">{{ lead.client_id }}</p>
                  }

                  <div class="flex items-center justify-between mt-2">
                    <span class="text-sm font-mono text-tx-teal-600 font-semibold">
                      {{ formatCurrency(lead.estimated_value) }}
                    </span>
                    @if (lead.next_action_date) {
                      <span class="text-xs text-tx-gray-400">
                        {{ lead.next_action_date | slice:0:10 }}
                      </span>
                    }
                  </div>
                </div>
              } @empty {
                <div class="tx-card p-4 text-center text-sm text-tx-gray-400 border-dashed">
                  Sem leads
                </div>
              }
            </div>
          </div>
        }
      </div>
    </div>

    <!-- Lead form drawer -->
    <app-lead-form
      [(visible)]="showForm"
      (leadCreated)="onLeadCreated()"
    />
  `,
})
export class LeadListComponent implements OnInit {
  private readonly leadService = inject(LeadService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);
  private readonly excelExport = inject(ExcelExportService);

  protected readonly showForm = signal(false);
  private readonly leads = signal<Lead[]>([]);

  protected readonly columns = computed(() =>
    OPEN_STATUSES.map(status => ({
      status,
      label: COLUMN_LABELS[status],
      leads: this.leads().filter(l => l.status === status),
    }))
  );

  protected readonly daysSince = daysSince;
  protected readonly formatCurrency = formatCurrency;

  ngOnInit(): void {
    this.loadLeads();
  }

  private loadLeads(): void {
    this.leadService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: leads => this.leads.set(leads),
    });
  }

  protected openLead(id: string): void {
    this.router.navigate(['/leads', id]);
  }

  protected onLeadCreated(): void {
    this.showForm.set(false);
    this.loadLeads();
  }

  protected exportCsv(): void {
    this.excelExport.exportLeads(this.leads(), `leads_${new Date().toISOString().split('T')[0]}`);
  }
}
