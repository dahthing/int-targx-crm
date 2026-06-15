import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-silence-warning',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (level() === 2) {
      <div class="tx-silence-warning level-2">
        {{ daysSinceActivity() }} dias sem actividade — alerta enviado
      </div>
    } @else if (level() === 1) {
      <div class="tx-silence-warning level-1">
        {{ daysSinceActivity() }} dias sem actividade
      </div>
    }
  `,
})
export class SilenceWarningComponent {
  readonly daysSinceActivity = input.required<number>();
  readonly warningDays = input<number>(7);
  readonly alertDays = input<number>(14);

  readonly level = computed(() => {
    const days = this.daysSinceActivity();
    if (days > this.alertDays()) return 2;
    if (days > this.warningDays()) return 1;
    return 0;
  });
}
