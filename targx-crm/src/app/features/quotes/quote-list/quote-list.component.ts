import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { QuoteService } from '../../../core/services/quote.service';
import type { Quote, QuoteStatus } from '../../../core/models/quote.model';

interface StatusOption {
  label: string;
  value: QuoteStatus | null;
}

@Component({
  selector: 'app-quote-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TableModule, SelectModule, ButtonModule],
  styles: [`
    .quotes-page { padding: 24px; }
    .quotes-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .quotes-filter { margin-bottom:16px; }
    .col-title { font-weight:500; color:var(--tx-gray-800); }
    .col-meta { color:var(--tx-gray-500); font-size:0.8125rem; }
    .col-amount { text-align:right; font-variant-numeric:tabular-nums; font-weight:600; color:var(--tx-gray-800); }
    .col-date { color:var(--tx-gray-400); font-size:0.8125rem; }
    .tx-badge-gray   { background:var(--tx-gray-100); color:var(--tx-gray-700); }
    .tx-badge-blue   { background:#DBEAFE; color:#1D4ED8; }
    .tx-badge-teal   { background:#CCFBF1; color:#0F766E; }
    .tx-badge-gold   { background:#FEF9C3; color:#854D0E; }
    .tx-badge-green  { background:#DCFCE7; color:#15803D; }
    .tx-badge-red    { background:#FEE2E2; color:#B91C1C; }
  `],
  template: `
    <div class="quotes-page">
      <div class="quotes-header">
        <h1 class="page-title">Orçamentos</h1>
        <button class="tx-btn-primary" (click)="newQuote()">
          <i class="pi pi-plus" style="margin-right:6px"></i>Novo orçamento
        </button>
      </div>

      <div class="tx-card">
        <div class="quotes-filter">
          <p-select
            [options]="statusOptions"
            [(ngModel)]="selectedStatus"
            optionLabel="label"
            optionValue="value"
            placeholder="Filtrar por estado"
            (onChange)="onStatusChange()"
            styleClass="tx-input"
            style="width:260px"
          />
        </div>

        <p-table
          [value]="quotes()"
          styleClass="tx-table"
          [loading]="loading()"
          [paginator]="true"
          [rows]="20"
          [rowHover]="true"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Título</th>
              <th>Estado</th>
              <th style="text-align:right">Valor</th>
              <th>Data</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-quote>
            <tr style="cursor:pointer" (click)="onRowClick(quote)">
              <td><span class="col-title">{{ quote.title }}</span></td>
              <td>
                <span class="tx-badge" [class]="statusClass(quote.status)">
                  {{ statusLabel(quote.status) }}
                </span>
              </td>
              <td class="col-amount">{{ formatCurrency(quote.total_before_tax) }}</td>
              <td class="col-date">{{ formatDate(quote.created_at) }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="4">
                <div class="empty-state">
                  <span>Nenhum orçamento encontrado.</span>
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>
  `,
})
export class QuoteListComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #router = inject(Router);

  readonly quotes = signal<Quote[]>([]);
  readonly loading = signal(false);

  selectedStatus: QuoteStatus | null = null;

  readonly statusOptions: StatusOption[] = [
    { label: 'Todos', value: null },
    { label: 'Rascunho', value: 'rascunho' },
    { label: 'Em revisão', value: 'em_revisao' },
    { label: 'Aprovado interno', value: 'aprovado_interno' },
    { label: 'Enviado ao cliente', value: 'enviado_cliente' },
    { label: 'Aceite', value: 'aceite' },
    { label: 'Rejeitado', value: 'rejeitado' },
  ];

  ngOnInit(): void {
    this.#loadQuotes();
  }

  onStatusChange(): void {
    this.#loadQuotes();
  }

  onRowClick(quote: Quote): void {
    this.#router.navigate(['/quotes', quote.id, 'build']);
  }

  newQuote(): void {
    this.#router.navigate(['/quotes/new']);
  }

  statusLabel(status: QuoteStatus): string {
    const map: Record<QuoteStatus, string> = {
      rascunho: 'Rascunho',
      em_revisao: 'Em revisão',
      aprovado_interno: 'Aprovado',
      enviado_cliente: 'Enviado',
      aceite: 'Aceite',
      rejeitado: 'Rejeitado',
    };
    return map[status] ?? status;
  }

  statusClass(status: QuoteStatus): string {
    const map: Record<QuoteStatus, string> = {
      rascunho: 'tx-badge-gray',
      em_revisao: 'tx-badge-blue',
      aprovado_interno: 'tx-badge-teal',
      enviado_cliente: 'tx-badge-gold',
      aceite: 'tx-badge-green',
      rejeitado: 'tx-badge-red',
    };
    return map[status] ?? '';
  }

  formatCurrency(value: number | null): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString('pt-PT');
  }

  #loadQuotes(): void {
    this.loading.set(true);
    const filters = this.selectedStatus ? { status: this.selectedStatus } : undefined;
    this.#quoteService.getAll(filters).subscribe({
      next: (data) => {
        this.quotes.set(data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }
}
