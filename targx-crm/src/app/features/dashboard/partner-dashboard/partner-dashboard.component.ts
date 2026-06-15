import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';
import { DashboardService } from '../../../core/services/dashboard.service';
import type { PartnerSummary } from '../../../core/models/dashboard.model';
import { TierProgressComponent } from '../tier-progress/tier-progress.component';
import { BonusTrackerComponent } from '../bonus-tracker/bonus-tracker.component';
import { PipelineByStatusComponent } from '../pipeline-by-status/pipeline-by-status.component';

@Component({
  selector: 'app-partner-dashboard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TierProgressComponent, BonusTrackerComponent, PipelineByStatusComponent, DecimalPipe],
  template: `
    <div class="dashboard-page">
      <div class="dashboard-header">
        <h1 class="dashboard-title">O meu Dashboard</h1>
        <span class="dashboard-year">{{ year }}</span>
      </div>

      @if (loading()) {
        <div class="loading-state">A carregar dados…</div>
      } @else if (error()) {
        <div class="error-state">Erro ao carregar dashboard. Tente novamente.</div>
      } @else if (summary()) {
        <!-- Row 1: KPI Cards -->
        <div class="kpi-grid">
          <div class="tx-kpi-card">
            <span class="tx-kpi-label">Volume Anual</span>
            <span class="tx-kpi-value">{{ formatCurrency(summary()!.volume_ano) }}</span>
            <span class="tx-kpi-sub">Total de obras recebidas</span>
          </div>

          <div class="tx-kpi-card accent">
            <span class="tx-kpi-label">Comissão Anual</span>
            <span class="tx-kpi-value">{{ formatCurrency(summary()!.commission_ano) }}</span>
            <span class="tx-kpi-sub">Taxa actual {{ summary()!.tier_rate }}%</span>
          </div>

          <div class="tx-kpi-card">
            <span class="tx-kpi-label">Leads Abertas</span>
            <span class="tx-kpi-value">{{ summary()!.leads_abertas }}</span>
            @if (summary()!.leads_sem_actividade > 0) {
              <span class="tx-kpi-sub warning-text">
                {{ summary()!.leads_sem_actividade }} sem actividade
              </span>
            } @else {
              <span class="tx-kpi-sub">Em pipeline activo</span>
            }
          </div>

          <div class="tx-kpi-card" [class.gold]="(summary()!.progress_pct_target ?? 0) >= 100">
            <span class="tx-kpi-label">Progresso Trimestral</span>
            <span class="tx-kpi-value">
              {{ summary()!.progress_pct_target !== null ? (summary()!.progress_pct_target! | number:'1.0-0') + '%' : '—' }}
            </span>
            <span class="tx-kpi-sub">
              {{ formatCurrency(summary()!.volume_trimestre) }}
              @if (summary()!.target_trimestre !== null) {
                / {{ formatCurrency(summary()!.target_trimestre!) }}
              }
            </span>
          </div>
        </div>

        <!-- Row 2: Tier Progress -->
        <div class="tx-card tier-card">
          <div class="tx-card-header">
            <span class="card-section-title">Barra de Escalão</span>
          </div>
          <app-tier-progress
            [progressPct]="summary()!.progress_pct_tier"
            [tierRate]="summary()!.tier_rate"
            [nextTierRate]="summary()!.next_tier_rate"
            [nextTierThreshold]="summary()!.next_tier_threshold"
            [volumeToNextTier]="summary()!.volume_to_next_tier"
            [volumeFrom]="summary()!.tier_actual.volume_from"
            [volumeTo]="summary()!.tier_actual.volume_to"
          />
        </div>

        <!-- Row 3: Pipeline + Bonus -->
        <div class="two-col-grid">
          <app-pipeline-by-status [groups]="pipelineGroups()" />
          <app-bonus-tracker [bonusStatus]="summary()!.bonus_status" />
        </div>
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

    .tier-card {
      padding: 20px 24px;
    }

    .card-section-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .two-col-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;

      @media (max-width: 768px) {
        grid-template-columns: 1fr;
      }
    }

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

    .warning-text {
      color: var(--tx-warning) !important;
    }
  `],
})
export class PartnerDashboardComponent implements OnInit {
  readonly #auth = inject(AuthService);
  readonly #dashboard = inject(DashboardService);
  readonly #destroyRef = inject(DestroyRef);

  readonly year = new Date().getFullYear();
  readonly summary = signal<PartnerSummary | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly pipelineGroups = signal<{ status: string; count: number; value_total: number }[]>([]);

  ngOnInit(): void {
    const profile = this.#auth.currentProfile();
    if (!profile) return;

    this.#dashboard
      .getPartnerSummary(profile.id, this.year)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: (data) => {
          this.summary.set(data);
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
  }

  formatCurrency(value: number): string {
    return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
