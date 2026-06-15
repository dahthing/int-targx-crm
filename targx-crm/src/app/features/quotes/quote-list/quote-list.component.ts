import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { QuoteService } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Quote, QuoteStatus } from '../../../core/models/quote.model';

interface StatusOption {
  label: string;
  value: QuoteStatus | null;
}

@Component({
  selector: 'app-quote-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, TableModule, SelectModule, ButtonModule],
  template: `
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header">
          <div class="flex items-center justify-between">
            <h1 class="text-h2">Orçamentos</h1>
            <button class="tx-btn-primary" (click)="newQuote()">
              <i class="pi pi-plus mr-2"></i>Novo orçamento
            </button>
          </div>
          <div class="mt-4">
            <p-select
              [options]="statusOptions"
              [(ngModel)]="selectedStatus"
              optionLabel="label"
              optionValue="value"
              placeholder="Filtrar por estado"
              (onChange)="onStatusChange()"
              styleClass="w-64"
            />
          </div>
        </div>

        <p-table
          [value]="quotes()"
          styleClass="tx-table"
          [loading]="loading()"
          [paginator]="true"
          [rows]="20"
          (onRowSelect)="onRowClick($event)"
          selectionMode="single"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Título</th>
              <th>Cliente</th>
              @if (isAdmin()) {
                <th>Parceiro</th>
              }
              <th>Estado</th>
              <th class="text-right">Valor</th>
              <th>Data</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-quote>
            <tr class="cursor-pointer hover:bg-[var(--tx-gray-050)]" (click)="onRowClick(quote)">
              <td>{{ quote.title }}</td>
              <td>{{ quote.client_id }}</td>
              @if (isAdmin()) {
                <td>{{ quote.partner_id }}</td>
              }
              <td>
                <span class="tx-badge" [ngClass]="statusClass(quote.status)">
                  {{ statusLabel(quote.status) }}
                </span>
              </td>
              <td class="text-right font-mono">
                {{ formatCurrency(quote.total_before_tax) }}
              </td>
              <td>{{ formatDate(quote.created_at) }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td [attr.colspan]="isAdmin() ? 6 : 5" class="text-center py-8 text-[var(--tx-gray-400)]">
                Nenhum orçamento encontrado.
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
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);

  readonly quotes = signal<Quote[]>([]);
  readonly loading = signal(false);
  readonly isAdmin = computed(() => this.#authService.role() === 'admin');

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
