import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SlicePipe, DecimalPipe } from '@angular/common';
import { DashboardService } from '../../../core/services/dashboard.service';
import type { AdminOverview, PipelineGroup, EstimationAccuracyItem } from '../../../core/models/dashboard.model';
import { PipelineByStatusComponent } from '../pipeline-by-status/pipeline-by-status.component';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PipelineByStatusComponent, SlicePipe, DecimalPipe],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-header">
        <h1 class="dashboard-title">Visão Geral</h1>
        <span class="dashboard-year">{{ year }}</span>
      </div>

      @if (loading()) {
        <div class="loading-state">A carregar dados…</div>
      } @else if (error()) {
        <div class="error-state">Erro ao carregar dashboard. Tente novamente.</div>
      } @else {
        <!-- Row 1: KPI Cards -->
        <div class="kpi-grid">
          <div class="tx-kpi-card">
            <span class="tx-kpi-label">Volume Total</span>
            <span class="tx-kpi-value">{{ formatCurrency(overview()?.volume_total ?? 0) }}</span>
            <span class="tx-kpi-sub">Todas as obras recebidas</span>
          </div>

          <div class="tx-kpi-card accent">
            <span class="tx-kpi-label">Comissões Totais</span>
            <span class="tx-kpi-value">{{ formatCurrency(overview()?.commission_total ?? 0) }}</span>
            <span class="tx-kpi-sub">Pagas a parceiros</span>
          </div>

          <div class="tx-kpi-card">
            <span class="tx-kpi-label">Leads Abertas</span>
            <span class="tx-kpi-value">{{ overview()?.leads_abertas_total ?? 0 }}</span>
            <span class="tx-kpi-sub">Em todos os parceiros</span>
          </div>

          <div class="tx-kpi-card">
            <span class="tx-kpi-label">Taxa de Conversão</span>
            <span class="tx-kpi-value">—</span>
            <span class="tx-kpi-sub">Disponível em breve</span>
          </div>
        </div>

        <!-- Row 2: Pipeline -->
        <app-pipeline-by-status [groups]="pipelineGroups()" />

        <!-- Row 3: Leads em silêncio + Parceiros -->
        <div class="two-col-grid">
          <!-- Leads em silêncio -->
          <div class="tx-card">
            <div class="tx-card-header">
              <span class="card-section-title">Leads em Silêncio</span>
            </div>
            <div class="silence-stat">
              <span class="silence-count">{{ silentLeadsCount() }}</span>
              <span class="silence-label">leads sem actividade recente</span>
            </div>
          </div>

          <!-- Parceiros overview -->
          <div class="tx-card">
            <div class="tx-card-header">
              <span class="card-section-title">Parceiros</span>
            </div>
            @if ((overview()?.partners ?? []).length === 0) {
              <p class="empty-state">Sem dados de parceiros.</p>
            } @else {
              <table class="tx-table partners-table" aria-label="Tabela de parceiros">
                <thead>
                  <tr>
                    <th scope="col">Parceiro</th>
                    <th scope="col" class="num-col">Volume</th>
                    <th scope="col" class="num-col">Comissão</th>
                    <th scope="col" class="num-col">Leads</th>
                  </tr>
                </thead>
                <tbody>
                  @for (partner of overview()!.partners; track partner.partner_id) {
                    <tr>
                      <td class="partner-id-cell">{{ partner.partner_id | slice:0:8 }}…</td>
                      <td class="num-col">{{ formatCurrency(partner.volume) }}</td>
                      <td class="num-col">{{ formatCurrency(partner.commission) }}</td>
                      <td class="num-col">{{ partner.leads_abertas }}</td>
                    </tr>
                  }
                </tbody>
              </table>
            }
          </div>
        </div>

        <!-- Row 4: Estimation Accuracy (DSH-009) -->
        @defer (on viewport) {
          <div class="tx-card">
            <div class="tx-card-header mb-4">
              <span class="card-section-title">Precisão de Estimativas</span>
              <span class="text-body-sm" style="color: var(--text-muted)">Estimado vs. real por tipo de projecto</span>
            </div>
            @if (accuracyLoading()) {
              <div class="py-6 text-center" style="color: var(--text-muted)">A carregar…</div>
            } @else if (estimationAccuracy().length === 0) {
              <p class="empty-state">Sem projectos concluídos para análise.</p>
            } @else {
              <div class="accuracy-chart">
                @for (item of estimationAccuracy(); track item.project_type) {
                  <div class="accuracy-row">
                    <div class="accuracy-label text-body-sm font-medium" style="color: var(--tx-gray-700)">
                      {{ item.project_type }}
                      <span class="text-body-sm font-normal" style="color: var(--text-muted)"> ({{ item.count }})</span>
                    </div>
                    <div class="accuracy-bars">
                      <div class="bar-group">
                        <span class="bar-legend" style="color: var(--tx-teal-600)">Est.</span>
                        <div class="bar-track">
                          <div class="bar-fill bar-estimated"
                               [style.width.%]="barPct(item.avg_estimated, item)"
                               [title]="item.avg_estimated + 'h estimadas'"></div>
                        </div>
                        <span class="bar-value font-mono text-sm">{{ item.avg_estimated | number:'1.0-0' }}h</span>
                      </div>
                      <div class="bar-group">
                        <span class="bar-legend" style="color: var(--tx-blue-600)">Real</span>
                        <div class="bar-track">
                          <div class="bar-fill bar-actual"
                               [style.width.%]="barPct(item.avg_actual, item)"
                               [title]="item.avg_actual + 'h reais'"></div>
                        </div>
                        <span class="bar-value font-mono text-sm">{{ item.avg_actual | number:'1.0-0' }}h</span>
                      </div>
                    </div>
                    <div class="accuracy-deviation">
                      <span class="tx-badge"
                            [class]="deviationClass(item.avg_deviation_pct)">
                        {{ item.avg_deviation_pct > 0 ? '+' : '' }}{{ item.avg_deviation_pct | number:'1.0-0' }}%
                      </span>
                    </div>
                  </div>
                }
              </div>
            }
          </div>
        } @placeholder {
          <div class="tx-card py-6 text-center" style="color: var(--text-muted)">Precisão de estimativas…</div>
        }
      }
    </div>
  `,
  styles: [`
    .dashboard-page {
      padding: 24px;
      display: flex;
      flex-direction: column;
      gap: 24px;
      background: var(--bg-page);
      min-height: 100%;
    }

    .dashboard-header {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
    }

    .dashboard-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      margin: 0;
    }

    .dashboard-year {
      font-size: 0.875rem;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 16px;

      @media (max-width: 1024px) {
        grid-template-columns: repeat(2, 1fr);
      }

      @media (max-width: 640px) {
        grid-template-columns: 1fr;
      }
    }

    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 16px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

    .card-section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .silence-stat {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 0;
      gap: 4px;
    }

    .silence-count {
      font-size: 3rem;
      font-weight: 700;
      color: var(--tx-warning);
      font-variant-numeric: tabular-nums;
      line-height: 1;
    }

    .silence-label {
      font-size: 0.875rem;
      color: var(--text-secondary);
      text-align: center;
    }

    .partners-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 0.8125rem;

      th {
        text-align: left;
        font-weight: 600;
        color: var(--text-secondary);
        padding: 6px 8px;
        border-bottom: 1px solid var(--tx-gray-200);
        font-size: 0.75rem;
        letter-spacing: 0.04em;
        text-transform: uppercase;
      }

      td {
        padding: 10px 8px;
        color: var(--text-primary);
        border-bottom: 1px solid var(--tx-gray-100);
      }

      tr:last-child td {
        border-bottom: none;
      }
    }

    .num-col {
      text-align: right;
      font-variant-numeric: tabular-nums;
    }

    .partner-id-cell {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.75rem;
      color: var(--text-secondary);
    }

    .tx-card-header {
      display: flex;
      align-items: baseline;
      gap: 8px;
      flex-wrap: wrap;
    }

    .accuracy-chart {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .accuracy-row {
      display: grid;
      grid-template-columns: 180px 1fr 80px;
      align-items: center;
      gap: 16px;
    }

    .accuracy-bars {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .bar-group {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .bar-legend {
      font-size: 0.75rem;
      font-weight: 600;
      width: 28px;
      flex-shrink: 0;
    }

    .bar-track {
      flex: 1;
      height: 12px;
      background: var(--tx-gray-100);
      border-radius: 6px;
      overflow: hidden;
    }

    .bar-fill {
      height: 100%;
      border-radius: 6px;
      transition: width var(--transition-spring, 0.4s ease);
    }

    .bar-estimated { background: var(--tx-teal-400); }
    .bar-actual { background: var(--tx-blue-400); }

    .bar-value {
      width: 40px;
      text-align: right;
      color: var(--text-secondary);
    }

    .accuracy-deviation {
      display: flex;
      justify-content: flex-end;
    }

    .deviation-green { background: var(--tx-teal-100); color: var(--tx-teal-700); }
    .deviation-gold { background: var(--gold-bg, #fef9e7); color: var(--tx-gold, #b7891a); }
    .deviation-red { background: #fee2e2; color: var(--tx-danger); }

    .loading-state,
    .error-state {
      padding: 48px;
      text-align: center;
      color: var(--text-muted);
      font-size: 0.875rem;
    }

    .error-state {
      color: var(--tx-danger);
    }

    .empty-state {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-align: center;
      padding: 16px 0;
    }
  `],
})
export class AdminDashboardComponent implements OnInit {
  readonly #dashboard = inject(DashboardService);
  readonly #destroyRef = inject(DestroyRef);

  readonly year = new Date().getFullYear();
  readonly overview = signal<AdminOverview | null>(null);
  readonly pipelineGroups = signal<PipelineGroup[]>([]);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly silentLeadsCount = signal(0);
  readonly estimationAccuracy = signal<EstimationAccuracyItem[]>([]);
  readonly accuracyLoading = signal(true);

  ngOnInit(): void {
    this.#dashboard
      .getAdminOverview(this.year)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) => {
          this.overview.set(data);
          this.loading.set(false);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });

    this.#dashboard
      .getPipelineSummary()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) => this.pipelineGroups.set(data.groups),
      });

    this.#dashboard
      .getEstimationAccuracy()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) => {
          this.estimationAccuracy.set(data);
          this.accuracyLoading.set(false);
        },
        error: () => this.accuracyLoading.set(false),
      });
  }

  formatCurrency(value: number): string {
    return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  barPct(value: number, item: EstimationAccuracyItem): number {
    const max = Math.max(item.avg_estimated, item.avg_actual, 1);
    return Math.min((value / max) * 100, 100);
  }

  deviationClass(pct: number): string {
    const abs = Math.abs(pct);
    if (abs < 10) return 'tx-badge deviation-green';
    if (abs <= 25) return 'tx-badge deviation-gold';
    return 'tx-badge deviation-red';
  }
}
