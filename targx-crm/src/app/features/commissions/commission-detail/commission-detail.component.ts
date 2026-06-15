import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { from } from 'rxjs';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import {
  CommissionService,
  CommissionWithContext,
  CommissionSummary,
} from '../../../core/services/commission.service';
import type { AnnualBonus } from '../../../core/models/commission.model';

function formatEur(value: number): string {
  return value.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' });
}

function formatPct(rate: number): string {
  return (rate * 100).toFixed(1) + '%';
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('pt-PT');
}

const MONTH_NAMES = [
  'Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun',
  'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez',
];

@Component({
  selector: 'app-commission-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [TableModule, ButtonModule, ToastModule],
  template: `
    <p-toast />

    <div class="p-6">
      <!-- Back -->
      <button class="tx-btn-ghost" style="margin-bottom: 16px" (click)="goBack()">
        <i class="pi pi-arrow-left" style="margin-right: 6px"></i>
        Comissões
      </button>

      <!-- Header -->
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-h2" style="color: var(--text-primary)">
          Comissões {{ year }} — {{ partnerName() }}
        </h1>
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
          Extracto anual PDF
        </button>
      </div>

      <!-- Annual KPIs -->
      @if (summary(); as s) {
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px">
          <div class="tx-kpi-card">
            <div class="tx-kpi-label">Volume {{ year }}</div>
            <div class="tx-kpi-value">{{ formatEur(s.volumeTotal) }}</div>
          </div>
          <div class="tx-kpi-card accent">
            <div class="tx-kpi-label">Comissão {{ year }}</div>
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
              <div class="tx-kpi-hint">Próximo patamar: {{ formatEur(s.nextTierThreshold) }}</div>
            } @else {
              <div class="tx-kpi-hint" style="color: var(--tx-gold)">Patamar máximo atingido</div>
            }
          </div>
        </div>
      }

      <!-- Tier Progress -->
      @if (summary(); as s) {
        @if (s.nextTierThreshold !== null) {
          <div class="tx-card" style="margin-bottom: 24px; padding: 20px">
            <h2 class="text-h3" style="margin-bottom: 12px; color: var(--text-primary)">Progresso de Patamar</h2>
            <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 13px; color: var(--text-secondary)">
              <span>{{ formatEur(s.volumeTotal) }}</span>
              <span>{{ formatEur(s.nextTierThreshold) }}</span>
            </div>
            <div style="background: var(--tx-gray-200); border-radius: 8px; height: 12px; overflow: hidden">
              <div
                style="height: 100%; border-radius: 8px; background: linear-gradient(90deg, var(--tx-teal-500), var(--tx-blue-500)); transition: width var(--transition-spring)"
                [style.width]="progressPct(s) + '%'"
              ></div>
            </div>
            <div style="text-align: center; margin-top: 8px; font-size: 13px; color: var(--text-muted)">
              {{ formatEur(s.nextTierThreshold - s.volumeTotal) }} para o próximo patamar
            </div>
          </div>
        }
      }

      <!-- Bonus Tracker -->
      @if (bonuses().length > 0) {
        <div class="tx-card" style="margin-bottom: 24px; padding: 20px">
          <h2 class="text-h3" style="margin-bottom: 12px; color: var(--text-primary)">Bónus</h2>
          @for (bonus of bonuses(); track bonus.id) {
            <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid var(--tx-gray-100)">
              <div>
                <span style="font-weight: 500; color: var(--text-primary)">{{ formatEur(bonus.threshold) }}</span>
                <span style="color: var(--text-muted); margin-left: 8px; font-size: 13px">limiar</span>
              </div>
              <div style="display: flex; align-items: center; gap: 12px">
                <span style="font-weight: 600; color: var(--tx-gold)">{{ formatEur(bonus.bonus_amount) }}</span>
                @if (bonus.paid) {
                  <span class="tx-badge" style="background: var(--tx-teal-100); color: var(--tx-teal-700)">Pago</span>
                } @else {
                  <span class="tx-badge" style="background: var(--tx-gray-100); color: var(--tx-gray-600)">Pendente</span>
                }
              </div>
            </div>
          }
        </div>
      }

      <!-- Monthly Breakdown -->
      <div class="tx-card" style="margin-bottom: 24px">
        <h2 class="text-h3" style="padding: 20px 20px 0; color: var(--text-primary)">Resumo Mensal</h2>
        <div class="tx-table">
          <p-table [value]="monthlyBreakdown()" styleClass="p-datatable-sm">
            <ng-template pTemplate="header">
              <tr>
                <th>Mês</th>
                <th style="text-align: right">Volume</th>
                <th style="text-align: right">Comissão</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-row>
              <tr>
                <td>{{ row.monthName }}</td>
                <td style="text-align: right; font-family: var(--font-mono)">
                  @if (row.volume > 0) {
                    {{ formatEur(row.volume) }}
                  } @else {
                    <span style="color: var(--text-muted)">—</span>
                  }
                </td>
                <td style="text-align: right; font-family: var(--font-mono); color: var(--tx-teal-600)">
                  @if (row.commission > 0) {
                    {{ formatEur(row.commission) }}
                  } @else {
                    <span style="color: var(--text-muted)">—</span>
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </div>

      <!-- All commissions for this partner/year -->
      <div class="tx-card">
        <h2 class="text-h3" style="padding: 20px 20px 0; color: var(--text-primary)">Detalhe de Comissões</h2>
        <div class="tx-table">
          <p-table
            [value]="commissions()"
            [loading]="loading()"
            [rows]="20"
            [paginator]="true"
            [rowHover]="true"
            styleClass="p-datatable-sm"
          >
            <ng-template pTemplate="header">
              <tr>
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
                <td>{{ row.project_title ?? '—' }}</td>
                <td>{{ row.client_name ?? '—' }}</td>
                <td>{{ row.tranche_description ?? '—' }}</td>
                <td style="text-align: right; font-family: var(--font-mono)">{{ formatEur(row.tranche_amount) }}</td>
                <td style="text-align: right; font-family: var(--font-mono)">{{ formatPct(row.rate_percent / 100) }}</td>
                <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: var(--tx-teal-600)">{{ formatEur(row.commission_amount) }}</td>
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
                <td colspan="8" style="text-align: center; padding: 32px; color: var(--text-muted)">
                  Sem comissões para este parceiro/ano.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
      </div>
    </div>
  `,
})
export class CommissionDetailComponent implements OnInit {
  readonly #commissionService = inject(CommissionService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);
  readonly #destroyRef = inject(DestroyRef);

  partnerId = '';
  year = new Date().getFullYear();

  readonly partnerName = signal<string>('');
  readonly commissions = signal<CommissionWithContext[]>([]);
  readonly summary = signal<CommissionSummary | null>(null);
  readonly bonuses = signal<AnnualBonus[]>([]);
  readonly monthlyBreakdown = signal<Array<{ month: number; monthName: string; volume: number; commission: number }>>([]);
  readonly loading = signal(false);
  readonly generatingPdf = signal(false);

  readonly formatEur = formatEur;
  readonly formatPct = formatPct;
  readonly formatDate = formatDate;

  progressPct(s: CommissionSummary): number {
    if (!s.nextTierThreshold || s.nextTierThreshold === 0) return 100;
    return Math.min(100, Math.round((s.volumeTotal / s.nextTierThreshold) * 100));
  }

  ngOnInit(): void {
    this.partnerId = this.#route.snapshot.paramMap.get('partnerId') ?? '';
    this.year = parseInt(this.#route.snapshot.paramMap.get('year') ?? String(new Date().getFullYear()), 10);

    this.#loadAll();
  }

  goBack(): void {
    void this.#router.navigate(['/commissions']);
  }

  generatePdf(): void {
    const currentMonth = new Date().getMonth() + 1;
    const monthStr = String(currentMonth).padStart(2, '0');
    const month = `${this.year}-${monthStr}`;
    this.generatingPdf.set(true);

    from(this.#commissionService.generateStatementPdf(this.partnerId, month))
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

  #loadAll(): void {
    if (!this.partnerId) return;

    this.loading.set(true);

    from(this.#commissionService.listCommissions({ partnerId: this.partnerId, year: this.year }))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) => {
          this.commissions.set(data);
          this.loading.set(false);
          if (data[0]?.partner_name) {
            this.partnerName.set(data[0].partner_name);
          }
        },
        error: (err: Error) => {
          this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
          this.loading.set(false);
        },
      });

    from(this.#commissionService.getAnnualSummary(this.partnerId, this.year))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({ next: (s) => this.summary.set(s) });

    from(this.#commissionService.getAnnualBonuses(this.partnerId, this.year))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({ next: (b) => this.bonuses.set(b) });

    from(this.#commissionService.getMonthlyBreakdown(this.partnerId, this.year))
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (rows) =>
          this.monthlyBreakdown.set(
            rows.map((r) => ({ ...r, monthName: MONTH_NAMES[r.month - 1] })),
          ),
      });
  }
}
