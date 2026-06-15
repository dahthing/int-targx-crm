import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';
import type { BonusStatus } from '../../../core/models/dashboard.model';

@Component({
  selector: 'app-bonus-tracker',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tx-card">
      <div class="tx-card-header">
        <span class="card-title">Bónus de Volume</span>
      </div>

      @if (bonusStatus().length === 0) {
        <p class="empty-state">Sem bónus configurados para este ano.</p>
      } @else {
        <ul class="bonus-list" role="list">
          @for (bonus of bonusStatus(); track bonus.threshold) {
            <li class="bonus-item" [class.achieved]="bonus.achieved">
              <div class="bonus-header">
                <div class="bonus-meta">
                  <span class="bonus-threshold">{{ formatCurrency(bonus.threshold) }}</span>
                  <span class="bonus-amount" [class.gold-text]="bonus.achieved">
                    + {{ formatCurrency(bonus.bonus_amount) }}
                  </span>
                </div>
                @if (bonus.achieved) {
                  <span class="bonus-check" aria-label="Bónus atingido">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" width="18" height="18" aria-hidden="true">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  </span>
                } @else if (bonus.volume_remaining !== null) {
                  <span class="bonus-remaining">faltam {{ formatCurrency(bonus.volume_remaining) }}</span>
                }
              </div>
              <div class="bonus-bar-track" role="progressbar" [attr.aria-valuenow]="getBonusPct(bonus)" aria-valuemin="0" aria-valuemax="100">
                <div
                  class="bonus-bar-fill"
                  [class.achieved]="bonus.achieved"
                  [style.width.%]="getBonusPct(bonus)"
                  aria-hidden="true"
                ></div>
              </div>
            </li>
          }
        </ul>
      }
    </div>
  `,
  styles: [`
    .card-title {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
    }

    .empty-state {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-align: center;
      padding: 16px 0;
    }

    .bonus-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .bonus-item {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .bonus-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .bonus-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .bonus-threshold {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
    }

    .bonus-amount {
      font-size: 0.8125rem;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;

      &.gold-text {
        color: var(--tx-gold);
        font-weight: 700;
      }
    }

    .bonus-check {
      color: var(--tx-success);
      display: flex;
      align-items: center;
    }

    .bonus-remaining {
      font-size: 0.75rem;
      color: var(--text-muted);
    }

    .bonus-bar-track {
      height: 6px;
      background: var(--tx-gray-200);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .bonus-bar-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--tx-blue-500) 0%, var(--tx-teal-500) 100%);
      transition: width var(--transition-spring);

      &.achieved {
        background: var(--tx-success);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .bonus-bar-fill {
        transition: none;
      }
    }
  `],
})
export class BonusTrackerComponent {
  readonly bonusStatus = input.required<BonusStatus[]>();

  getBonusPct(bonus: BonusStatus): number {
    if (bonus.achieved) return 100;
    if (bonus.volume_remaining === null) return 0;
    const filled = bonus.threshold - bonus.volume_remaining;
    const pct = (filled / bonus.threshold) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }

  formatCurrency(value: number): string {
    return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
