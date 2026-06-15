import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { PipelineGroup } from '../../../core/models/dashboard.model';

const STATUS_LABELS: Record<string, string> = {
  nova: 'Nova',
  contactada: 'Contactada',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechada_ganha: 'Fechada (Ganha)',
  fechada_perdida: 'Fechada (Perdida)',
};

@Component({
  selector: 'app-pipeline-by-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tx-card">
      <div class="tx-card-header">
        <span class="card-title">Pipeline por Estado</span>
        <span class="card-total">{{ totalCount() }} leads</span>
      </div>

      @if (groups().length === 0) {
        <p class="empty-state">Sem leads no pipeline.</p>
      } @else {
        <ul class="pipeline-list" role="list">
          @for (group of groups(); track group.status) {
            <li class="pipeline-row">
              <div class="pipeline-left">
                <span class="tx-badge {{ group.status }}" aria-label="Estado: {{ getLabel(group.status) }}">
                  {{ getLabel(group.status) }}
                </span>
              </div>
              <div class="pipeline-right">
                <span class="pipeline-count">{{ group.count }}</span>
                <span class="pipeline-value">{{ formatCurrency(group.value_total) }}</span>
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

    .card-total {
      font-size: 0.8125rem;
      color: var(--text-muted);
    }

    .empty-state {
      font-size: 0.875rem;
      color: var(--text-muted);
      text-align: center;
      padding: 16px 0;
    }

    .pipeline-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .pipeline-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid var(--tx-gray-100);

      &:last-child {
        border-bottom: none;
      }
    }

    .pipeline-left {
      display: flex;
      align-items: center;
    }

    .pipeline-right {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .pipeline-count {
      font-size: 0.875rem;
      font-weight: 600;
      color: var(--text-primary);
      font-variant-numeric: tabular-nums;
      min-width: 24px;
      text-align: right;
    }

    .pipeline-value {
      font-size: 0.875rem;
      color: var(--text-secondary);
      font-variant-numeric: tabular-nums;
      min-width: 100px;
      text-align: right;
    }
  `],
})
export class PipelineByStatusComponent {
  readonly groups = input.required<PipelineGroup[]>();

  readonly totalCount = () => this.groups().reduce((s, g) => s + g.count, 0);

  getLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  formatCurrency(value: number): string {
    return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
}
