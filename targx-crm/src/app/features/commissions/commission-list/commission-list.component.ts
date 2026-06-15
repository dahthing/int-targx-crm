import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DropdownModule } from 'primeng/dropdown';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import { ExcelExportService } from '../../../core/services/excel-export.service';
import {
  CommissionService,
  CommissionWithContext,
  CommissionListFilters,
  CommissionSummary,
} from '../../../core/services/commission.service';

const MONTHS: Array<{ label: string; value: number }> = [
  { label: 'Janeiro', value: 1 }, { label: 'Fevereiro', value: 2 },
  { label: 'Março', value: 3 }, { label: 'Abril', value: 4 },
  { label: 'Maio', value: 5 }, { label: 'Junho', value: 6 },
  { label: 'Julho', value: 7 }, { label: 'Agosto', value: 8 },
  { label: 'Setembro', value: 9 }, { label: 'Outubro', value: 10 },
  { label: 'Novembro', value: 11 }, { label: 'Dezembro', value: 12 },
];

function formatEur(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT');
}

@Component({
  selector: 'app-commission-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [TableModule, ButtonModule, DropdownModule, FormsModule, ToastModule],
  template: `
    <p-toast />

    <div class="p-6">
      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-h2" style="color: var(--text-primary)">Comissões</h1>
      </div>

      <!-- KPI Summary -->
      @if (summary(); as s) {
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px">
          <div class="tx-kpi-card">
            <div class="tx-kpi-label">Volume Total</div>
            <div class="tx-kpi-value">{{ formatEur(s.volumeTotal) }}</div>
          </div>
          <div class="tx-kpi-card accent">
            <div class="tx-kpi-label">Comissão Total</div>
            <div class="tx-kpi-value">{{ formatEur(s.commissionTotal) }}</div>
          </div>
          <div class="tx-kpi-card gold">
            <div class="tx-kpi-label">Bónus</div>
            <div class="tx-kpi-value">{{ formatEur(s.bonusTotal) }}</div>
          </div>
          <div class="tx-kpi-card">
            <div class="tx-kpi-label">Taxa Actual</div>
            <div class="tx-kpi-value">{{ formatPct(s.currentTierRate) }}</div>
            @if (s.nextTierThreshold !== null) {
              <div class="tx-kpi-hint">Próximo: {{ formatEur(s.nextTierThreshold) }}</div>
            } @else {
              <div class="tx-kpi-hint" style="color: var(--tx-gold)">Patamar máximo</div>
            }
          </div>
        </div>
      }

      <!-- Filters -->
      <div class="tx-card" style="margin-bottom: 24px">
        <div class="flex gap-4 flex-wrap" style="padding: 16px">
          <div>
            <label class="tx-form-label">Ano</label>
            <p-dropdown
              [options]="yearOptions"
              [(ngModel)]="selectedYear"
              optionLabel="label"
              optionValue="value"
              (onChange)="applyFilters()"
              styleClass="tx-input"
            />
          </div>

          <div>
            <label class="tx-form-label">Mês</label>
            <p-dropdown
              [options]="monthOptions"
              [(ngModel)]="selectedMonth"
              optionLabel="label"
              optionValue="value"
              placeholder="Todos"
              [showClear]="true"
              (onChange)="applyFilters()"
              styleClass="tx-input"
            />
          </div>

          <div class="flex items-end gap-2">
            <button
              class="tx-btn-ghost"
              [disabled]="commissions().length === 0"
              (click)="exportCsv()"
              aria-label="Exportar CSV"
            >
              <i class="pi pi-file-excel" style="margin-right: 6px"></i>
              Exportar CSV
            </button>
            @if (canGeneratePdf()) {
              <button
                class="tx-btn-secondary"
                [disabled]="generatingPdf()"
                (click)="generatePdf()"
              >
                @if (generatingPdf()) {
                  <i class="pi pi-spin pi-spinner" style="margin-right: 6px"></i>
                } @else {
                  <i class="pi pi-download" style="margin-right: 6px"></i>
                }
                Gerar extracto PDF
              </button>
            }
          </div>
        </div>
      </div>

      <!-- Commission Table -->
      <div class="tx-card">
        <div class="tx-table">
          <p-table
            [value]="commissions()"
            [loading]="loading()"
            [rows]="25"
            [paginator]="true"
            [rowHover]="true"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
                @if (isAdmin()) {
                  <th>Parceiro</th>
                }
                <th>Projecto</th>
                <th>Cliente</th>
                <th>Tranche</th>
                <th style="text-align: right">Valor</th>
                <th style="text-align: right">Taxa</th>
                <th style="text-align: right">Comissão</th>
                <th>Data</th>
                <th>Patamar</th>
              </tr>
            </ng-template>

            <ng-template pTemplate="body" let-row>
              <tr>
                @if (isAdmin()) {
                  <td>
                    <span style="font-weight: 500; color: var(--text-primary)">
                      {{ row.partner_name ?? '—' }}
                    </span>
                  </td>
                }
                <td>{{ row.project_title ?? '—' }}</td>
                <td>{{ row.client_name ?? '—' }}</td>
                <td>{{ row.tranche_description ?? '—' }}</td>
                <td style="text-align: right; font-family: var(--font-mono)">
                  {{ formatEur(row.tranche_amount) }}
                </td>
                <td style="text-align: right; font-family: var(--font-mono)">
                  {{ formatPct(row.rate_percent / 100) }}
                </td>
                <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: var(--tx-teal-600)">
                  {{ formatEur(row.commission_amount) }}
                </td>
                <td style="color: var(--text-secondary)">{{ formatDate(row.created_at) }}</td>
                <td>
                  @if (row.tier_label) {
                    <span class="tx-badge">{{ row.tier_label }}</span>
                  } @else {
                    <span style="color: var(--text-muted)">—</span>
                  }
                </td>
              </tr>
            </ng-template>

            <ng-template pTemplate="emptymessage">
              <tr>
                <td [colSpan]="isAdmin() ? 9 : 8" style="text-align: center; padding: 32px; color: var(--text-muted)">
                  Sem comissões para os filtros seleccionados.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </div>
    </div>
  `,
})
export class CommissionListComponent implements OnInit {
  readonly #commissionService = inject(CommissionService);
  readonly #authService = inject(AuthService);
  readonly #messageService = inject(MessageService);
  readonly #destroyRef = inject(DestroyRef);
  readonly #excelExport = inject(ExcelExportService);

  readonly commissions = signal<CommissionWithContext[]>([]);
  readonly loading = signal(false);
  readonly generatingPdf = signal(false);
  readonly summary = signal<CommissionSummary | null>(null);

  readonly isAdmin = computed(() => this.#authService.role() === 'admin');

  // Filters state
  selectedYear: number = new Date().getFullYear();
  selectedMonth: number | null = null;

  readonly yearOptions = Array.from({ length: 4 }, (_, i) => {
    const y = new Date().getFullYear() - i;
    return { label: String(y), value: y };
  });

  readonly monthOptions: Array<{ label: string; value: number | null }> = [
    { label: 'Todos', value: null },
    ...MONTHS,
  ];

  readonly canGeneratePdf = computed(() => {
    const profile = this.#authService.currentProfile();
    return !!profile?.id && !!this.selectedYear && !!this.selectedMonth;
  });

  readonly formatEur = formatEur;
  readonly formatPct = formatPct;
  readonly formatDate = formatDate;

  ngOnInit(): void {
    this.applyFilters();
  }

  applyFilters(): void {
    const profile = this.#authService.currentProfile();
    const partnerId = this.isAdmin() ? undefined : profile?.id;

    const filters: CommissionListFilters = {
      partnerId,
      year: this.selectedYear,
      month: this.selectedMonth ?? undefined,
    };

    this.loading.set(true);

    from(this.#commissionService.listCommissions(filters))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) => {
          this.commissions.set(data);
          this.loading.set(false);
        },
        error: (err: Error) => {
          this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
          this.loading.set(false);
        },
      });

    if (profile?.id) {
      const effectivePartnerId = this.isAdmin() ? undefined : profile.id;
      if (effectivePartnerId) {
        from(this.#commissionService.getAnnualSummary(effectivePartnerId, this.selectedYear))
          .pipe(takeUntilDestroyed(this.#destroyRef))
          .subscribe({
            next: (s) => this.summary.set(s),
            error: () => this.summary.set(null),
          });
      }
    }
  }

  exportCsv(): void {
    const year = this.selectedYear ?? new Date().getFullYear();
    const month = this.selectedMonth ? String(this.selectedMonth).padStart(2, '0') : 'todos';
    this.#excelExport.exportCommissions(this.commissions(), `comissoes_${year}_${month}`);
  }

  generatePdf(): void {
    const profile = this.#authService.currentProfile();
    if (!profile?.id || !this.selectedMonth || !this.selectedYear) return;

    const month = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}`;
    this.generatingPdf.set(true);

    from(this.#commissionService.generateStatementPdf(profile.id, month))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (url) => {
          this.generatingPdf.set(false);
          window.open(url, '_blank');
        },
        error: (err: Error) => {
          this.generatingPdf.set(false);
          this.#messageService.add({ severity: 'error', summary: 'Erro ao gerar PDF', detail: err.message });
        },
      });
  }
}
