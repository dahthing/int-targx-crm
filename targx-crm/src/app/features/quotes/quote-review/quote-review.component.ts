import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { QuoteService, QuoteWithPhases } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import type { QuoteStatusHistory } from '../../../core/models/quote.model';

interface DetectedRisk {
  key: string;
  name: string;
  multiplier: number;
  is_blocking: boolean;
}

@Component({
  selector: 'app-quote-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, ButtonModule, TextareaModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="tx-page-content">
      <!-- Header -->
      <div class="tx-card mb-6">
        <div class="flex items-center justify-between mb-2">
          <button class="tx-btn-ghost flex items-center gap-2" (click)="back()">
            <svg class="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Voltar">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>
          <span class="tx-badge em_revisao">Em Revisão</span>
        </div>
        <h1 class="text-h2">Revisão de Orçamento</h1>
      </div>

      @if (loading()) {
        <div class="tx-card flex items-center justify-center py-16">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      }

      @if (error()) {
        <div class="tx-card py-8 text-center" style="color: var(--tx-danger)">
          <i class="pi pi-exclamation-triangle text-2xl mb-2 block"></i>
          {{ error() }}
        </div>
      }

      @if (!loading() && !error() && quote()) {
        <!-- Quote Summary -->
        <div class="tx-card mb-6">
          <h2 class="text-h3 mb-4">Resumo do Orçamento</h2>
          <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div class="tx-summary-item">
              <span class="tx-form-label">Título</span>
              <span class="font-medium" style="color: var(--text-primary)">{{ quote()!.title }}</span>
            </div>
            <div class="tx-summary-item">
              <span class="tx-form-label">Versão</span>
              <span class="font-mono font-medium" style="color: var(--text-primary)">v{{ quote()!.version }}</span>
            </div>
            <div class="tx-summary-item">
              <span class="tx-form-label">Total s/ IVA</span>
              <span class="font-mono font-medium text-lg" style="color: var(--text-primary)">
                {{ formatCurrency(quote()!.total_before_tax) }}
              </span>
            </div>
            <div class="tx-summary-item">
              <span class="tx-form-label">Total c/ IVA</span>
              <span class="font-mono font-medium text-lg" style="color: var(--tx-teal-600)">
                {{ formatCurrency(quote()!.total_with_tax) }}
              </span>
            </div>
            <div class="tx-summary-item">
              <span class="tx-form-label">Margem</span>
              <span
                class="font-mono font-medium text-lg"
                [style.color]="marginOk() ? 'var(--tx-success)' : 'var(--tx-danger)'"
              >
                {{ quote()!.calculated_margin_pct ?? 0 | number:'1.1-1' }}%
              </span>
            </div>
            <div class="tx-summary-item">
              <span class="tx-form-label">Margem mínima</span>
              <span class="font-mono" style="color: var(--text-secondary)">{{ quote()!.minimum_margin_pct ?? 0 | number:'1.1-1' }}%</span>
            </div>
          </div>
        </div>

        <!-- Risk Overview -->
        <div class="tx-card mb-6">
          <h2 class="text-h3 mb-4">Riscos Detectados</h2>

          @if (risks().length === 0) {
            <p style="color: var(--text-muted)">Nenhum risco detectado.</p>
          } @else {
            <div class="space-y-3">
              @for (risk of risks(); track risk.key) {
                <div
                  class="flex items-center justify-between p-3 rounded-lg"
                  [style.background]="risk.is_blocking ? 'rgba(220,38,38,0.06)' : 'var(--bg-surface-2)'"
                  [style.border]="risk.is_blocking ? '1px solid rgba(220,38,38,0.3)' : '1px solid var(--border-subtle)'"
                >
                  <div class="flex items-center gap-3">
                    @if (risk.is_blocking) {
                      <svg class="w-5 h-5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--tx-danger)" aria-label="Risco bloqueante">
                        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                      </svg>
                    }
                    <div>
                      <p class="font-medium" [style.color]="risk.is_blocking ? 'var(--tx-danger)' : 'var(--text-primary)'">
                        {{ risk.name }}
                      </p>
                      @if (risk.is_blocking) {
                        <p class="text-sm" style="color: var(--tx-danger)">Risco bloqueante</p>
                      }
                    </div>
                  </div>
                  <span class="font-mono text-sm font-semibold" style="color: var(--text-secondary)">
                    ×{{ risk.multiplier | number:'1.2-2' }}
                  </span>
                </div>
              }
            </div>

            <!-- Risk Override (admin) -->
            @if (hasBlockingRisk() && !quote()!.admin_risk_override) {
              <div class="mt-4 p-4 rounded-lg" style="border: 1px solid var(--tx-warning); background: rgba(249,158,27,0.06)">
                <p class="font-medium mb-3" style="color: var(--tx-warning)">Existe um risco bloqueante. Para aprovar, um override é obrigatório.</p>
                <div class="tx-field mb-3">
                  <label class="tx-form-label" for="override-notes">Justificação do override *</label>
                  <textarea
                    id="override-notes"
                    class="tx-input w-full"
                    rows="3"
                    [(ngModel)]="overrideNotes"
                    placeholder="Justificação detalhada para ignorar o risco bloqueante..."
                  ></textarea>
                </div>
                <button class="tx-btn-secondary" (click)="applyOverride()">
                  Aplicar override de risco
                </button>
              </div>
            }

            @if (quote()!.admin_risk_override) {
              <div class="mt-4 p-3 rounded-lg flex items-start gap-3" style="background: var(--bg-surface-2); border: 1px solid var(--border-subtle)">
                <svg class="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style="color: var(--tx-success)" aria-label="Override aplicado">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p class="font-medium text-sm" style="color: var(--tx-success)">Override de risco aplicado</p>
                  @if (quote()!.admin_risk_notes) {
                    <p class="text-sm mt-1" style="color: var(--text-secondary)">{{ quote()!.admin_risk_notes }}</p>
                  }
                </div>
              </div>
            }
          }
        </div>

        <!-- Actions -->
        <div class="tx-card mb-6">
          <h2 class="text-h3 mb-4">Acções</h2>

          <!-- Reject -->
          @if (showRejectForm()) {
            <div class="mb-4 p-4 rounded-lg" style="border: 1px solid var(--border-default); background: var(--bg-surface-2)">
              <p class="font-medium mb-3" style="color: var(--text-primary)">Motivo de rejeição</p>
              <textarea
                class="tx-input w-full mb-3"
                rows="3"
                [(ngModel)]="rejectionNotes"
                placeholder="Descreva o motivo da rejeição..."
              ></textarea>
              <div class="flex gap-3">
                <button class="tx-btn-danger" [disabled]="acting()" (click)="confirmReject()">
                  @if (acting()) {
                    <i class="pi pi-spin pi-spinner mr-2"></i>
                  }
                  Confirmar Rejeição
                </button>
                <button class="tx-btn-ghost" (click)="showRejectForm.set(false)">Cancelar</button>
              </div>
            </div>
          }

          <!-- Revision form -->
          @if (showRevisionForm()) {
            <div class="mb-4 p-4 rounded-lg" style="border: 1px solid var(--border-default); background: var(--bg-surface-2)">
              <p class="font-medium mb-3" style="color: var(--text-primary)">Notas para revisão</p>
              <textarea
                class="tx-input w-full mb-3"
                rows="3"
                [(ngModel)]="revisionNotes"
                placeholder="Indique o que precisa de ser revisto..."
              ></textarea>
              <div class="flex gap-3">
                <button class="tx-btn-secondary" [disabled]="acting()" (click)="confirmRevision()">
                  @if (acting()) {
                    <i class="pi pi-spin pi-spinner mr-2"></i>
                  }
                  Confirmar
                </button>
                <button class="tx-btn-ghost" (click)="showRevisionForm.set(false)">Cancelar</button>
              </div>
            </div>
          }

          <div class="flex flex-wrap gap-3">
            <button
              class="tx-btn-primary"
              [disabled]="!canApprove() || acting()"
              (click)="approve()"
            >
              @if (acting()) {
                <i class="pi pi-spin pi-spinner mr-2"></i>
              }
              <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              Aprovar
            </button>
            <button
              class="tx-btn-danger"
              [disabled]="acting()"
              (click)="showRejectForm.set(true)"
            >
              <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
              Rejeitar
            </button>
            <button
              class="tx-btn-secondary"
              [disabled]="acting()"
              (click)="showRevisionForm.set(true)"
            >
              <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Pedir revisão
            </button>
          </div>

          @if (!canApprove() && !acting()) {
            <p class="text-sm mt-3" style="color: var(--tx-warning)">
              <svg class="w-4 h-4 inline mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              {{ approveBlockReason() }}
            </p>
          }
        </div>

        <!-- Status Timeline -->
        @defer (on idle) {
          <div class="tx-card">
            <h2 class="text-h3 mb-4">Histórico de Estados</h2>
            @if (history().length === 0) {
              <p style="color: var(--text-muted)">Sem histórico disponível.</p>
            } @else {
              <ol class="relative border-l-2" style="border-color: var(--border-subtle); margin-left: 0.5rem">
                @for (entry of history(); track entry.id) {
                  <li class="mb-6 ml-6">
                    <span
                      class="absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full"
                      style="background: var(--bg-surface); border: 2px solid var(--tx-teal-500)"
                    ></span>
                    <div class="flex flex-wrap items-center gap-2 mb-1">
                      <span class="tx-badge" [ngClass]="entry.to_status">
                        {{ statusLabel(entry.to_status) }}
                      </span>
                      @if (entry.from_status) {
                        <span class="text-xs" style="color: var(--text-muted)">← {{ statusLabel(entry.from_status) }}</span>
                      }
                    </div>
                    <time class="text-xs" style="color: var(--text-muted)">
                      {{ formatDate(entry.changed_at) }}
                    </time>
                    @if (entry.changed_by) {
                      <span class="text-xs ml-2" style="color: var(--text-muted)">por {{ entry.changed_by }}</span>
                    }
                    @if (entry.notes) {
                      <p class="mt-1 text-sm" style="color: var(--text-secondary)">{{ entry.notes }}</p>
                    }
                  </li>
                }
              </ol>
            }
          </div>
        } @placeholder {
          <div class="tx-card animate-pulse">
            <div class="h-4 rounded w-48 mb-4" style="background: var(--tx-gray-200)"></div>
            <div class="space-y-3">
              <div class="h-12 rounded" style="background: var(--tx-gray-100)"></div>
              <div class="h-12 rounded" style="background: var(--tx-gray-100)"></div>
            </div>
          </div>
        }
      }
    </div>

    <style>
      .tx-summary-item {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
    </style>
  `,
})
export class QuoteReviewComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #auth = inject(AuthService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);
  readonly #destroyRef = takeUntilDestroyed();

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly quote = signal<QuoteWithPhases | null>(null);
  readonly history = signal<QuoteStatusHistory[]>([]);
  readonly acting = signal(false);

  readonly showRejectForm = signal(false);
  readonly showRevisionForm = signal(false);

  overrideNotes = '';
  rejectionNotes = '';
  revisionNotes = '';

  readonly risks = computed<DetectedRisk[]>(() => {
    const q = this.quote();
    if (!q?.detected_risks) return [];
    const raw = q.detected_risks as Record<string, { name?: string; multiplier?: number; is_blocking?: boolean }>;
    return Object.entries(raw).map(([key, v]) => ({
      key,
      name: v.name ?? key,
      multiplier: v.multiplier ?? 1,
      is_blocking: v.is_blocking ?? false,
    }));
  });

  readonly hasBlockingRisk = computed(() => this.risks().some(r => r.is_blocking));

  readonly marginOk = computed(() => {
    const q = this.quote();
    if (!q) return false;
    const margin = q.calculated_margin_pct ?? 0;
    const min = q.minimum_margin_pct ?? 0;
    return margin >= min;
  });

  readonly canApprove = computed(() => {
    const q = this.quote();
    if (!q) return false;
    if (!this.marginOk()) return false;
    if (this.hasBlockingRisk() && !q.admin_risk_override) return false;
    return true;
  });

  readonly approveBlockReason = computed(() => {
    if (!this.marginOk()) return 'Margem abaixo do mínimo permitido.';
    if (this.hasBlockingRisk() && !this.quote()?.admin_risk_override) {
      return 'Existe um risco bloqueante. Aplique um override para poder aprovar.';
    }
    return '';
  });

  ngOnInit(): void {
    const id = this.#route.snapshot.paramMap.get('id');
    if (!id) {
      this.error.set('ID do orçamento inválido.');
      this.loading.set(false);
      return;
    }
    this.#quoteService.getById(id).pipe(this.#destroyRef).subscribe({
      next: (q) => {
        this.quote.set(q);
        this.loading.set(false);
        this.#loadHistory(id);
      },
      error: (err: Error) => {
        this.error.set(err.message);
        this.loading.set(false);
      },
    });
  }

  #loadHistory(quoteId: string): void {
    this.#quoteService.getStatusHistory(quoteId).pipe(this.#destroyRef).subscribe({
      next: (h) => this.history.set(h),
    });
  }

  approve(): void {
    const q = this.quote();
    if (!q) return;
    this.acting.set(true);
    this.#quoteService.transition(q.id, 'aprovado_interno').pipe(this.#destroyRef).subscribe({
      next: () => {
        this.#messageService.add({ severity: 'success', summary: 'Aprovado', detail: 'Orçamento aprovado com sucesso.' });
        this.acting.set(false);
        this.#router.navigate(['/quotes', q.id, 'preview']);
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
        this.acting.set(false);
      },
    });
  }

  confirmReject(): void {
    const q = this.quote();
    if (!q || !this.rejectionNotes.trim()) return;
    this.acting.set(true);
    this.#quoteService.transition(q.id, 'rejeitado', this.rejectionNotes).pipe(this.#destroyRef).subscribe({
      next: () => {
        this.#messageService.add({ severity: 'warn', summary: 'Rejeitado', detail: 'Orçamento rejeitado.' });
        this.acting.set(false);
        this.#router.navigate(['/quotes']);
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
        this.acting.set(false);
      },
    });
  }

  confirmRevision(): void {
    const q = this.quote();
    if (!q) return;
    this.acting.set(true);
    this.#quoteService.transition(q.id, 'em_revisao', this.revisionNotes).pipe(this.#destroyRef).subscribe({
      next: () => {
        this.#messageService.add({ severity: 'info', summary: 'Revisão', detail: 'Orçamento devolvido para revisão.' });
        this.acting.set(false);
        this.showRevisionForm.set(false);
        this.#loadHistory(q.id);
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
        this.acting.set(false);
      },
    });
  }

  applyOverride(): void {
    const q = this.quote();
    if (!q || !this.overrideNotes.trim()) {
      this.#messageService.add({ severity: 'warn', summary: 'Atenção', detail: 'A justificação é obrigatória.' });
      return;
    }
    this.#quoteService.applyRiskOverride(q.id, this.overrideNotes).pipe(this.#destroyRef).subscribe({
      next: (updated) => {
        this.quote.set({ ...q, ...updated });
        this.#messageService.add({ severity: 'success', summary: 'Override aplicado', detail: 'O risco bloqueante foi ignorado com justificação.' });
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
      },
    });
  }

  back(): void {
    this.#router.navigate(['/quotes']);
  }

  protected statusLabel(status: string): string {
    const LABELS: Record<string, string> = {
      rascunho: 'Rascunho',
      em_revisao: 'Em Revisão',
      aprovado_interno: 'Aprovado',
      enviado_cliente: 'Enviado',
      aceite: 'Aceite',
      rejeitado: 'Rejeitado',
    };
    return LABELS[status] ?? status;
  }

  protected formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(dateStr));
  }
}
