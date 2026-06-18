import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import type { PipelineGroup } from '../../../core/models/dashboard.model';

const STATUS_LABELS: Record<string, string> = {
  nova: 'Nova',
  contactada: 'Contactada',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechada_ganha: 'Fechada (Ganha)',
  fechada_perdida: 'Fechada (Perdida)',
};

const STATUS_BADGE: Record<string, string> = {
  nova: 'background:var(--tx-gray-100);color:var(--tx-gray-600)',
  contactada: 'background:var(--tx-blue-100,#DBEAFE);color:var(--tx-blue-700,#1D4ED8)',
  proposta_enviada: 'background:var(--tx-teal-100);color:var(--tx-teal-700)',
  negociacao: 'background:var(--tx-gold-bg,#FEF3C7);color:#92400E',
};

@Component({
  selector: 'app-pipeline-by-status',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  template: `
    <div class="tx-card">
      <div class="tx-card-header" style="display:flex;align-items:center;justify-content:space-between;padding:16px 20px">
        <span style="font-size:0.875rem;font-weight:600;color:var(--tx-gray-800)">Pipeline por Estado</span>
        <span style="font-size:0.8125rem;color:var(--tx-gray-400)">{{ totalCount() }} leads</span>
      </div>

      @if (groups().length === 0) {
        <p style="font-size:0.875rem;color:var(--tx-gray-400);text-align:center;padding:16px">Sem leads no pipeline.</p>
      } @else {
        <div style="display:flex;flex-direction:column">
          @for (group of groups(); track group.status) {
            <div style="border-top:1px solid var(--tx-gray-100)">
              <!-- Status header row -->
              <div style="display:flex;align-items:center;justify-content:space-between;padding:12px 20px;cursor:pointer"
                   (click)="toggleGroup(group.status)"
                   (keydown.enter)="toggleGroup(group.status)"
                   tabindex="0" role="button">
                <div style="display:flex;align-items:center;gap:10px">
                  <i class="pi" style="font-size:0.625rem;color:var(--tx-gray-400);transition:transform 0.15s ease"
                     [style.transform]="isExpanded(group.status) ? 'rotate(90deg)' : 'none'"
                     [class.pi-chevron-right]="true"></i>
                  <span class="tx-badge" [style]="getBadgeStyle(group.status)">{{ getLabel(group.status) }}</span>
                  <span style="font-size:0.8125rem;color:var(--tx-gray-500)">{{ group.count }} lead{{ group.count !== 1 ? 's' : '' }}</span>
                </div>
                <span style="font-size:0.875rem;font-weight:600;color:var(--tx-teal-600);font-variant-numeric:tabular-nums">
                  {{ formatCurrency(group.value_total) }}
                </span>
              </div>

              <!-- Lead rows (expanded) -->
              @if (isExpanded(group.status) && group.leads?.length) {
                <div style="background:var(--tx-gray-050,#F9FAFB);padding:0 20px 12px">
                  @for (lead of group.leads!; track lead.id) {
                    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--tx-gray-100);cursor:pointer"
                         (click)="goToLead(lead.id)"
                         (keydown.enter)="goToLead(lead.id)"
                         tabindex="0" role="button">
                      <div>
                        <p style="font-size:0.875rem;font-weight:500;color:var(--tx-gray-800);margin:0">{{ lead.title }}</p>
                        @if (lead.client_name) {
                          <p style="font-size:0.75rem;color:var(--tx-gray-400);margin:2px 0 0">{{ lead.client_name }}</p>
                        }
                      </div>
                      <i class="pi pi-arrow-right" style="font-size:0.75rem;color:var(--tx-gray-300)"></i>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class PipelineByStatusComponent {
  readonly groups = input.required<PipelineGroup[]>();
  readonly #router = inject(Router);
  readonly #expanded = new Set<string>();

  readonly totalCount = () => this.groups().reduce((s, g) => s + g.count, 0);

  getLabel(status: string): string {
    return STATUS_LABELS[status] ?? status;
  }

  getBadgeStyle(status: string): string {
    return STATUS_BADGE[status] ?? 'background:var(--tx-gray-100);color:var(--tx-gray-600)';
  }

  formatCurrency(value: number): string {
    return '€\u00a0' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }

  toggleGroup(status: string): void {
    if (this.#expanded.has(status)) {
      this.#expanded.delete(status);
    } else {
      this.#expanded.add(status);
    }
  }

  isExpanded(status: string): boolean {
    return this.#expanded.has(status);
  }

  goToLead(id: string): void {
    void this.#router.navigate(['/leads', id]);
  }
}
