import { ChangeDetectionStrategy, Component, input, computed } from '@angular/core';

@Component({
  selector: 'app-tier-progress',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tier-progress-wrap">
      <div class="tier-header">
        <div class="tier-current">
          <span class="tier-label">Escalão actual</span>
          <span class="tier-rate">{{ tierRate() }}%</span>
        </div>
        @if (nextTierRate() !== null) {
          <div class="tier-next">
            <span>Próximo: {{ nextTierRate() }}%</span>
            @if (volumeToNextTier() !== null) {
              <span class="tier-remaining">
                faltam {{ formatCurrency(volumeToNextTier()!) }}
              </span>
            }
          </div>
        }
      </div>

      <div class="tier-bar-track" role="progressbar" [attr.aria-valuenow]="clampedPct()" aria-valuemin="0" aria-valuemax="100">
        <div
          class="tier-bar-fill"
          [class.near-threshold]="clampedPct() > 80"
          [style.width.%]="clampedPct()"
          aria-hidden="true"
        ></div>
        <span class="tier-bar-label">{{ clampedPct() }}%</span>
      </div>

      <div class="tier-scale">
        <span>{{ formatCurrency(volumeFrom()) }}</span>
        @if (volumeTo() !== null) {
          <span>{{ formatCurrency(volumeTo()!) }}</span>
        }
      </div>
    </div>
  `,
  styles: [`
    .tier-progress-wrap {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .tier-header {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
    }

    .tier-current {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .tier-label {
      font-size: 0.75rem;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--text-secondary);
    }

    .tier-rate {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--tx-teal-600);
      font-variant-numeric: tabular-nums;
    }

    .tier-next {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
      font-size: 0.875rem;
      color: var(--text-secondary);
    }

    .tier-remaining {
      font-size: 0.8125rem;
      color: var(--tx-gold);
      font-weight: 600;
    }

    .tier-bar-track {
      position: relative;
      height: 12px;
      background: var(--tx-gray-200);
      border-radius: var(--radius-full);
      overflow: hidden;
    }

    .tier-bar-fill {
      height: 100%;
      border-radius: var(--radius-full);
      background: linear-gradient(90deg, var(--tx-blue-500) 0%, var(--tx-teal-500) 100%);
      transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1);

      &.near-threshold {
        background: linear-gradient(90deg, var(--tx-teal-600) 0%, var(--tx-gold) 100%);
      }
    }

    .tier-bar-label {
      position: absolute;
      right: 8px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 0.625rem;
      font-weight: 700;
      color: var(--tx-gray-800);
      mix-blend-mode: multiply;
    }

    .tier-scale {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--text-muted);
      font-variant-numeric: tabular-nums;
    }

    @media (prefers-reduced-motion: reduce) {
      .tier-bar-fill {
        transition: none;
      }
    }
  `],
})
export class TierProgressComponent {
  readonly progressPct = input.required<number>();
  readonly tierRate = input.required<number>();
  readonly nextTierRate = input<number | null>(null);
  readonly nextTierThreshold = input<number | null>(null);
  readonly volumeToNextTier = input<number | null>(null);
  readonly volumeFrom = input.required<number>();
  readonly volumeTo = input<number | null>(null);

  readonly clampedPct = computed(() => Math.max(0, Math.min(100, Math.round(this.progressPct()))));

  formatCurrency(value: number): string {
    return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
