import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const LEAD_LABELS: Record<string, string> = {
  nova: 'Nova',
  contactada: 'Contactada',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechada_ganha: 'Ganha',
  fechada_perdida: 'Perdida',
};

@Component({
  selector: 'app-status-badge',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span [class]="badgeClass()">{{ label() }}</span>`,
})
export class StatusBadgeComponent {
  readonly status = input.required<string>();
  readonly type = input<'lead' | 'quote' | 'project'>('lead');

  readonly label = computed(() => {
    if (this.type() === 'lead') {
      return LEAD_LABELS[this.status()] ?? this.status();
    }
    return this.status();
  });

  readonly badgeClass = computed(() => `tx-badge ${this.status()}`);
}
