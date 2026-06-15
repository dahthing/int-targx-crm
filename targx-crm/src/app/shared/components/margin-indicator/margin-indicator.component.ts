import {
  ChangeDetectionStrategy,
  Component,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-margin-indicator',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule],
  template: `
    <div class="margin-indicator" [ngClass]="statusClass()">
      <div class="flex items-center gap-2">
        <i class="pi" [ngClass]="iconClass()"></i>
        <span class="font-semibold text-sm">Margem: {{ marginPct() | number:'1.1-1' }}%</span>
      </div>
      <div class="text-xs mt-1 opacity-80">
        Mínimo: {{ minimumMarginPct() | number:'1.1-1' }}%
      </div>
    </div>
  `,
  styles: [`
    .margin-indicator {
      padding: 12px 16px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .margin-indicator.ok {
      background: var(--tx-green-050, #f0fdf4);
      border-color: var(--tx-green-500, #22c55e);
      color: var(--tx-green-700, #15803d);
    }
    .margin-indicator.warning {
      background: var(--tx-gold-050, #fffbeb);
      border-color: var(--tx-gold, #f59e0b);
      color: var(--tx-gold-700, #b45309);
    }
    .margin-indicator.danger {
      background: var(--tx-red-050, #fef2f2);
      border-color: var(--tx-red-500, #ef4444);
      color: var(--tx-red-700, #b91c1c);
    }
  `],
})
export class MarginIndicatorComponent {
  readonly marginPct = input.required<number>();
  readonly minimumMarginPct = input<number>(25);

  readonly statusClass = computed(() => {
    const pct = this.marginPct();
    const min = this.minimumMarginPct();
    if (pct >= min + 5) return 'ok';
    if (pct >= min) return 'warning';
    return 'danger';
  });

  readonly iconClass = computed(() => {
    const cls = this.statusClass();
    if (cls === 'ok') return 'pi-check-circle';
    if (cls === 'warning') return 'pi-exclamation-circle';
    return 'pi-times-circle';
  });
}
