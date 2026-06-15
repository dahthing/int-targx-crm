import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { QuoteService } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import type { Quote } from '../../../core/models/quote.model';

@Component({
  selector: 'app-quote-versions',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, TableModule, ToastModule],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Versões do orçamento</h1>
          @if (currentQuote()) {
            <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">{{ currentQuote()!.title }}</p>
          }
        </div>
        <div class="flex gap-2">
          <button class="tx-btn-ghost" (click)="goBack()">
            <i class="pi pi-arrow-left mr-2"></i>Voltar ao editor
          </button>
          @if (isAdmin()) {
            <button
              class="tx-btn-primary"
              (click)="createNewVersion()"
              [disabled]="creating()"
            >
              @if (creating()) { <i class="pi pi-spin pi-spinner mr-2"></i> }
              <i class="pi pi-plus mr-2"></i>Criar nova versão
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="tx-card p-12 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-2xl"></i>
        </div>
      }

      @if (!loading()) {
        <!-- Versions table -->
        <div class="tx-card mb-6">
          <p-table [value]="versions()" styleClass="tx-table" [sortField]="'version'" [sortOrder]="-1">
            <ng-template pTemplate="header">
              <tr>
                <th pSortableColumn="version">Versão <p-sortIcon field="version" /></th>
                <th>Estado</th>
                <th pSortableColumn="created_at">Data <p-sortIcon field="created_at" /></th>
                <th class="text-right">Valor s/IVA</th>
                <th></th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-quote>
              <tr
                class="hover:bg-[var(--tx-gray-050)] cursor-pointer"
                [class.bg-[var(--tx-teal-050)]]="quote.id === currentId()"
              >
                <td>
                  <span class="font-mono font-semibold text-[var(--tx-blue-700)]">v{{ quote.version }}</span>
                  @if (quote.id === currentId()) {
                    <span class="ml-2 text-body-sm text-[var(--tx-teal-600)]">(actual)</span>
                  }
                </td>
                <td>
                  <span class="tx-badge" [ngClass]="statusClass(quote.status)">{{ statusLabel(quote.status) }}</span>
                </td>
                <td class="text-[var(--tx-gray-600)]">{{ formatDate(quote.created_at) }}</td>
                <td class="text-right font-mono text-[var(--tx-gray-950)]">
                  {{ formatCurrency(quote.total_before_tax) }}
                </td>
                <td>
                  <button
                    class="tx-btn-ghost text-body-sm"
                    (click)="openVersion(quote)"
                    [attr.aria-label]="'Abrir versão ' + quote.version"
                  >
                    <i class="pi pi-external-link mr-1"></i>Abrir
                  </button>
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" class="text-center py-8 text-[var(--tx-gray-400)]">
                  Sem versões encontradas.
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>

        <!-- Comparison panel: current vs previous -->
        @if (versions().length >= 2) {
          <div class="tx-card p-5">
            <h3 class="text-body font-semibold text-[var(--tx-gray-950)] mb-4">
              Comparação: versão actual vs anterior
            </h3>
            <div class="overflow-x-auto">
              <table class="w-full text-body-sm">
                <thead>
                  <tr class="border-b border-[var(--tx-gray-200)]">
                    <th class="text-left py-2 font-medium text-[var(--tx-gray-600)]">Campo</th>
                    <th class="text-right py-2 font-medium text-[var(--tx-gray-600)]">v{{ previousVersion()?.version }}</th>
                    <th class="text-right py-2 font-medium text-[var(--tx-teal-600)]">v{{ currentQuote()?.version }} (actual)</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of comparisonRows(); track row.label) {
                    <tr class="border-b border-[var(--tx-gray-100)]" [class.bg-[var(--tx-gold-bg)]]="row.changed">
                      <td class="py-2 text-[var(--tx-gray-600)]">{{ row.label }}</td>
                      <td class="py-2 text-right font-mono text-[var(--tx-gray-400)]">{{ row.prev }}</td>
                      <td class="py-2 text-right font-mono" [class.font-semibold]="row.changed" [class.text-[var(--tx-blue-700)]]="row.changed">
                        {{ row.curr }}
                        @if (row.changed) { <i class="pi pi-arrow-right ml-1 text-xs text-[var(--tx-warning)]"></i> }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }
      }
    </div>
  `,
})
export class QuoteVersionsComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #authService = inject(AuthService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly creating = signal(false);
  readonly versions = signal<Quote[]>([]);
  readonly currentId = signal<string>('');
  readonly isAdmin = computed(() => this.#authService.role() === 'admin');

  readonly currentQuote = computed(() => this.versions().find(q => q.id === this.currentId()) ?? null);
  readonly previousVersion = computed(() => {
    const sorted = [...this.versions()].sort((a, b) => b.version - a.version);
    const curr = this.currentQuote();
    if (!curr) return null;
    return sorted.find(q => q.version < curr.version) ?? null;
  });

  readonly comparisonRows = computed(() => {
    const curr = this.currentQuote();
    const prev = this.previousVersion();
    if (!curr || !prev) return [];

    const rows = [
      { label: 'Estado', prev: this.statusLabel(prev.status), curr: this.statusLabel(curr.status), changed: prev.status !== curr.status },
      { label: 'Total s/IVA', prev: this.formatCurrency(prev.total_before_tax), curr: this.formatCurrency(curr.total_before_tax), changed: prev.total_before_tax !== curr.total_before_tax },
      { label: 'Total c/IVA', prev: this.formatCurrency(prev.total_with_tax), curr: this.formatCurrency(curr.total_with_tax), changed: prev.total_with_tax !== curr.total_with_tax },
      { label: 'Desconto', prev: `${prev.discount_pct ?? 0}%`, curr: `${curr.discount_pct ?? 0}%`, changed: prev.discount_pct !== curr.discount_pct },
      { label: 'Margem calculada', prev: `${prev.calculated_margin_pct?.toFixed(1) ?? '—'}%`, curr: `${curr.calculated_margin_pct?.toFixed(1) ?? '—'}%`, changed: prev.calculated_margin_pct !== curr.calculated_margin_pct },
    ];
    return rows;
  });

  async ngOnInit(): Promise<void> {
    const id = this.#route.snapshot.paramMap.get('id');
    if (!id) { this.#router.navigate(['/quotes']); return; }
    this.currentId.set(id);

    try {
      // Load current quote to get lead_id
      const current = await this.#quoteService.getById(id).toPromise();
      if (!current) throw new Error('Not found');

      if (current.lead_id) {
        const versions = await this.#quoteService.getVersions(current.lead_id).toPromise();
        this.versions.set(versions ?? []);
      } else {
        this.versions.set([current]);
      }
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível carregar versões.' });
    } finally {
      this.loading.set(false);
    }
  }

  async createNewVersion(): Promise<void> {
    const id = this.currentId();
    this.creating.set(true);
    try {
      const newQuote = await this.#quoteService.createVersion(id);
      this.#router.navigate(['/quotes', newQuote.id, 'build']);
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível criar nova versão.' });
    } finally {
      this.creating.set(false);
    }
  }

  openVersion(quote: Quote): void {
    this.#router.navigate(['/quotes', quote.id, 'build']);
  }

  goBack(): void {
    this.#router.navigate(['/quotes', this.currentId(), 'build']);
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      rascunho: 'Rascunho', em_revisao: 'Em revisão',
      aprovado_interno: 'Aprovado', enviado_cliente: 'Enviado',
      aceite: 'Aceite', rejeitado: 'Rejeitado',
    };
    return map[status] ?? status;
  }

  statusClass(status: string): string {
    const map: Record<string, string> = {
      rascunho: 'tx-badge-gray', em_revisao: 'tx-badge-blue',
      aprovado_interno: 'tx-badge-teal', enviado_cliente: 'tx-badge-gold',
      aceite: 'tx-badge-green', rejeitado: 'tx-badge-red',
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
}
