import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChartModule } from 'primeng/chart';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { SkeletonModule } from 'primeng/skeleton';
import { AnalyticsService } from '../../core/services/analytics.service';
import type {
  MonthlyVolume,
  FunnelStage,
  EstimationAccuracy,
  ClientVolume,
  QuoteStats,
} from '../../core/services/analytics.service';

const MONTH_LABELS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ChartModule, SelectModule, ButtonModule, SkeletonModule],
  template: `
    <div class="tx-page-content">
      <div class="tx-card-header" style="display:flex;align-items:center;justify-content:space-between;padding:24px 24px 0">
        <div>
          <h1 class="page-title">Analytics</h1>
          <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">Métricas de negócio e performance</p>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <p-select
            [options]="yearOptions"
            [(ngModel)]="selectedYear"
            (ngModelChange)="loadAll()"
            [style]="{'min-width':'120px'}"
          />
        </div>
      </div>

      <!-- Quote KPIs -->
      <div style="padding:24px;display:grid;grid-template-columns:repeat(4,1fr);gap:16px">
        @if (loading()) {
          @for (i of [1,2,3,4]; track i) {
            <p-skeleton height="88px" borderRadius="12px" />
          }
        } @else if (quoteStats()) {
          <div class="tx-kpi-card accent">
            <div class="kpi-label">Orçamentos enviados</div>
            <div class="kpi-value">{{ quoteStats()!.sent }}</div>
          </div>
          <div class="tx-kpi-card">
            <div class="kpi-label">Taxa de aceitação</div>
            <div class="kpi-value">{{ quoteStats()!.acceptance_rate }}%</div>
          </div>
          <div class="tx-kpi-card">
            <div class="kpi-label">Valor médio</div>
            <div class="kpi-value">{{ quoteStats()!.avg_value | currency:'EUR':'symbol':'1.0-0':'pt' }}</div>
          </div>
          <div class="tx-kpi-card">
            <div class="kpi-label">Rejeitados</div>
            <div class="kpi-value" style="color:var(--tx-danger)">{{ quoteStats()!.rejected }}</div>
          </div>
        }
      </div>

      <!-- Charts row -->
      <div style="padding:0 24px 24px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <!-- Volume Timeline -->
        <div class="tx-card" style="padding:20px">
          <h3 style="font-size:0.9375rem;font-weight:600;color:var(--tx-gray-800);margin-bottom:16px">Volume mensal ({{ selectedYear }})</h3>
          @defer (on viewport) {
            @if (volumeChartData()) {
              <p-chart type="line" [data]="volumeChartData()!" [options]="lineChartOptions" height="220" />
            }
          } @placeholder {
            <p-skeleton height="220px" />
          }
        </div>

        <!-- Conversion Funnel -->
        <div class="tx-card" style="padding:20px">
          <h3 style="font-size:0.9375rem;font-weight:600;color:var(--tx-gray-800);margin-bottom:16px">Funil de conversão</h3>
          @if (funnel().length > 0) {
            <div style="display:flex;flex-direction:column;gap:8px">
              @for (stage of funnel(); track stage.status) {
                <div style="display:flex;align-items:center;gap:10px">
                  <span style="font-size:0.75rem;color:var(--tx-gray-500);width:120px;text-align:right">{{ statusLabel(stage.status) }}</span>
                  <div style="flex:1;background:var(--tx-gray-100);border-radius:4px;height:24px;overflow:hidden">
                    <div
                      style="height:100%;background:var(--tx-teal-500);border-radius:4px;display:flex;align-items:center;padding:0 8px;transition:width 0.3s"
                      [style.width.%]="funnelBarPct(stage)"
                    >
                      <span style="font-size:0.75rem;color:white;font-weight:600;white-space:nowrap">{{ stage.count }}</span>
                    </div>
                  </div>
                  @if (stage.conversion_rate_to_next !== null) {
                    <span style="font-size:0.75rem;color:var(--tx-gray-400);width:40px">{{ stage.conversion_rate_to_next }}%↓</span>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>

      <!-- Estimation accuracy table -->
      <div style="padding:0 24px 24px">
        <div class="tx-card" style="padding:20px">
          <h3 style="font-size:0.9375rem;font-weight:600;color:var(--tx-gray-800);margin-bottom:16px">
            Estimação vs real por tipo de projecto
          </h3>
          @if (estimations().length > 0) {
            <table class="tx-table" style="width:100%">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th style="text-align:right">Horas estimadas (avg)</th>
                  <th style="text-align:right">Horas reais (avg)</th>
                  <th style="text-align:right">Desvio</th>
                  <th style="text-align:right">Projectos</th>
                </tr>
              </thead>
              <tbody>
                @for (row of estimations(); track row.project_type_name) {
                  <tr>
                    <td>{{ row.project_type_name }}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums">{{ row.avg_estimated }}h</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums">{{ row.avg_actual }}h</td>
                    <td style="text-align:right">
                      <span
                        class="tx-badge"
                        [style.background]="deviationBg(row.avg_deviation_pct)"
                        [style.color]="deviationColor(row.avg_deviation_pct)"
                      >
                        {{ row.avg_deviation_pct > 0 ? '+' : '' }}{{ row.avg_deviation_pct }}%
                      </span>
                    </td>
                    <td style="text-align:right;color:var(--tx-gray-500)">{{ row.count }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p style="color:var(--tx-gray-400);font-size:0.875rem">Sem projectos concluídos com horas reais registadas.</p>
          }
        </div>
      </div>

      <!-- Top clients + quote breakdown -->
      <div style="padding:0 24px 24px;display:grid;grid-template-columns:1fr 1fr;gap:24px">
        <div class="tx-card" style="padding:20px">
          <h3 style="font-size:0.9375rem;font-weight:600;color:var(--tx-gray-800);margin-bottom:16px">Top clientes ({{ selectedYear }})</h3>
          @if (topClients().length > 0) {
            <table class="tx-table" style="width:100%">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th style="text-align:right">Volume</th>
                  <th style="text-align:right">Comissão</th>
                </tr>
              </thead>
              <tbody>
                @for (c of topClients(); track c.client_name) {
                  <tr>
                    <td>{{ c.client_name }}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums">{{ c.total_volume | currency:'EUR':'symbol':'1.0-0':'pt' }}</td>
                    <td style="text-align:right;font-variant-numeric:tabular-nums;color:var(--tx-teal-600)">{{ c.total_commission | currency:'EUR':'symbol':'1.0-0':'pt' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          } @else {
            <p style="color:var(--tx-gray-400);font-size:0.875rem">Sem dados de volume para este ano.</p>
          }
        </div>

        <div class="tx-card" style="padding:20px">
          <h3 style="font-size:0.9375rem;font-weight:600;color:var(--tx-gray-800);margin-bottom:16px">Orçamentos {{ selectedYear }}</h3>
          @if (quoteStats()) {
            <div style="display:flex;flex-direction:column;gap:12px">
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--tx-gray-100)">
                <span style="color:var(--tx-gray-600)">Enviados</span>
                <span style="font-weight:600">{{ quoteStats()!.sent }}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--tx-gray-100)">
                <span style="color:var(--tx-gray-600)">Aceites</span>
                <span style="font-weight:600;color:var(--tx-success)">{{ quoteStats()!.accepted }}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--tx-gray-100)">
                <span style="color:var(--tx-gray-600)">Rejeitados</span>
                <span style="font-weight:600;color:var(--tx-danger)">{{ quoteStats()!.rejected }}</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--tx-gray-100)">
                <span style="color:var(--tx-gray-600)">Taxa de aceitação</span>
                <span style="font-weight:600;color:var(--tx-teal-600)">{{ quoteStats()!.acceptance_rate }}%</span>
              </div>
              <div style="display:flex;justify-content:space-between;padding:10px 0">
                <span style="color:var(--tx-gray-600)">Valor médio</span>
                <span style="font-weight:600">{{ quoteStats()!.avg_value | currency:'EUR':'symbol':'1.0-0':'pt' }}</span>
              </div>
            </div>
          }
        </div>
      </div>
    </div>
  `,
})
export class AnalyticsDashboardComponent implements OnInit {
  readonly #analytics = inject(AnalyticsService);

  readonly loading = signal(true);
  selectedYear = new Date().getFullYear();
  readonly yearOptions = Array.from({ length: 5 }, (_, i) => ({
    label: String(new Date().getFullYear() - i),
    value: new Date().getFullYear() - i,
  }));

  readonly volumeData = signal<MonthlyVolume[]>([]);
  readonly funnel = signal<FunnelStage[]>([]);
  readonly estimations = signal<EstimationAccuracy[]>([]);
  readonly topClients = signal<ClientVolume[]>([]);
  readonly quoteStats = signal<QuoteStats | null>(null);

  readonly volumeChartData = computed(() => {
    const data = this.volumeData();
    if (!data.length) return null;
    return {
      labels: MONTH_LABELS,
      datasets: [
        {
          label: 'Volume (€)',
          data: data.map(d => d.volume),
          borderColor: '#00B899',
          backgroundColor: 'rgba(0,184,153,0.08)',
          fill: true,
          tension: 0.3,
        },
        {
          label: 'Comissão (€)',
          data: data.map(d => d.commission),
          borderColor: '#2451A3',
          backgroundColor: 'rgba(36,81,163,0.05)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  });

  readonly lineChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'bottom' } },
    scales: {
      y: { beginAtZero: true, ticks: { callback: (v: number) => `${v.toLocaleString('pt-PT')}€` } },
    },
  };

  readonly funnelMax = computed(() => Math.max(...this.funnel().map(f => f.count), 1));

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.loading.set(true);
    const year = this.selectedYear;

    this.#analytics.getVolumeTimeline(year).subscribe(d => this.volumeData.set(d));
    this.#analytics.getConversionFunnel().subscribe(d => this.funnel.set(d));
    this.#analytics.getEstimationAccuracy().subscribe(d => this.estimations.set(d));
    this.#analytics.getTopClients(year).subscribe(d => this.topClients.set(d));
    this.#analytics.getQuoteStats(year).subscribe(d => {
      this.quoteStats.set(d);
      this.loading.set(false);
    });
  }

  statusLabel(status: string): string {
    const labels: Record<string, string> = {
      nova: 'Nova',
      contactada: 'Contactada',
      negociacao: 'Negociação',
      proposta_enviada: 'Proposta',
      fechada_ganha: 'Ganhas',
      fechada_perdida: 'Perdidas',
    };
    return labels[status] ?? status;
  }

  funnelBarPct(stage: FunnelStage): number {
    const max = this.funnelMax();
    return max > 0 ? Math.max((stage.count / max) * 100, stage.count > 0 ? 5 : 0) : 0;
  }

  deviationBg(pct: number): string {
    if (pct > 20) return 'var(--tx-danger)';
    if (pct > 0) return 'var(--tx-warning)';
    return 'var(--tx-teal-100)';
  }

  deviationColor(pct: number): string {
    if (pct > 0) return 'white';
    return 'var(--tx-teal-600)';
  }
}
