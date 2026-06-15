import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { from, Observable } from 'rxjs';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import {
  validateToken,
  buildAcceptanceUpdate,
  buildRejectionUpdate,
  TokenInvalidError,
  TokenExpiredError,
} from '../../../core/services/client-portal.functions';
import type { Quote, QuotePhase, QuoteItem } from '../../../core/models/quote.model';

interface PortalQuote extends Quote {
  phases: (QuotePhase & { items: QuoteItem[] })[];
}

@Component({
  selector: 'app-client-portal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Minimal public header -->
    <header class="portal-header">
      <div class="portal-header-inner">
        <div class="portal-logo">
          <span class="logo-tx">TargX</span>
        </div>
      </div>
    </header>

    <main class="portal-main">
      <!-- Loading -->
      @if (loading()) {
        <div class="portal-loading">
          <div class="portal-spinner"></div>
          <p>A carregar proposta...</p>
        </div>
      }

      <!-- Error: invalid/expired token -->
      @if (!loading() && errorType()) {
        <div class="portal-error-card">
          <div class="portal-error-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h2>{{ errorType() === 'expired' ? 'Proposta expirada' : 'Link inválido' }}</h2>
          <p>{{ errorType() === 'expired'
            ? 'O período de validade desta proposta terminou. Contacte o seu consultor para obter uma nova versão.'
            : 'Este link de acesso é inválido ou já foi utilizado. Contacte o seu consultor.' }}</p>
        </div>
      }

      <!-- Accepted success screen -->
      @if (!loading() && accepted()) {
        <div class="portal-success-card">
          <div class="confetti-container" aria-hidden="true">
            @for (i of confettiItems; track i) {
              <div class="confetti-piece" [style]="confettiStyle(i)"></div>
            }
          </div>
          <div class="portal-success-icon">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-label="Sucesso">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2>Proposta Aceite!</h2>
          <p>Obrigado pela sua confirmação. A nossa equipa entrará em contacto brevemente para iniciar o projecto.</p>
        </div>
      }

      <!-- Quote content -->
      @if (!loading() && !errorType() && !accepted() && quote()) {
        <div class="portal-content">

          <!-- Expiry warning -->
          @if (daysUntilExpiry() !== null && daysUntilExpiry()! <= 3 && daysUntilExpiry()! >= 0) {
            <div class="portal-expiry-banner" role="alert">
              <svg class="banner-icon" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Esta proposta expira em {{ daysUntilExpiry() }} {{ daysUntilExpiry() === 1 ? 'dia' : 'dias' }}.
            </div>
          }

          <!-- Quote header -->
          <div class="portal-card mb-6">
            <h1 class="portal-title">{{ quote()!.title }}</h1>
            <p class="portal-subtitle">{{ quote()!.client_id }}</p>
            @if (quote()!.description) {
              <p class="portal-description">{{ quote()!.description }}</p>
            }
            @if (quote()!.valid_until) {
              <p class="portal-validity">Válido até {{ formatDate(quote()!.valid_until!) }}</p>
            }
          </div>

          <!-- Phase accordion -->
          @for (phase of quote()!.phases; track phase.id; let pi = $index) {
            <div class="portal-card mb-4">
              <button
                class="phase-toggle"
                [attr.aria-expanded]="expandedPhases().has(phase.id)"
                (click)="togglePhase(phase.id)"
              >
                <span class="phase-num">{{ pi + 1 }}</span>
                <span class="phase-name">{{ phase.name }}</span>
                <svg
                  class="phase-chevron"
                  [class.rotated]="expandedPhases().has(phase.id)"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              @if (expandedPhases().has(phase.id)) {
                <div class="phase-items">
                  @for (item of phase.items; track item.id) {
                    <div class="phase-item" [class.item-optional]="item.optional">
                      <div class="item-left">
                        @if (item.optional) {
                          <input
                            type="checkbox"
                            class="item-checkbox"
                            [checked]="selectedOptionals().has(item.id)"
                            (change)="toggleOptional(item.id)"
                            [attr.aria-label]="'Seleccionar ' + item.name"
                          />
                        }
                        <div>
                          <p class="item-name">
                            {{ item.name }}
                            @if (item.optional) {
                              <span class="item-optional-badge">(Opcional)</span>
                            }
                          </p>
                          @if (item.description) {
                            <p class="item-desc">{{ item.description }}</p>
                          }
                        </div>
                      </div>
                      <span class="item-value">{{ itemValue(item) }}</span>
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Financial summary -->
          <div class="portal-card mb-6 portal-summary">
            <h3 class="summary-title">Resumo financeiro</h3>
            <div class="summary-row">
              <span>Subtotal (sem opcionais)</span>
              <span class="font-mono">{{ formatCurrency(quote()!.total_before_tax) }}</span>
            </div>
            @if (selectedOptionals().size > 0) {
              <div class="summary-row">
                <span>Opcionais seleccionados</span>
                <span class="font-mono">+ {{ formatCurrency(optionalsValue()) }}</span>
              </div>
              <div class="summary-row summary-subtotal">
                <span>Subtotal c/ opcionais</span>
                <span class="font-mono">{{ formatCurrency((quote()!.total_before_tax ?? 0) + optionalsValue()) }}</span>
              </div>
            }
            <div class="summary-row summary-total">
              <span>Total c/ IVA (23%)</span>
              <span class="font-mono">{{ formatCurrency(totalWithTax()) }}</span>
            </div>
          </div>

          <!-- Rejection form -->
          @if (showRejectForm()) {
            <div class="portal-card mb-4">
              <h3 class="summary-title">Motivo de rejeição</h3>
              <textarea
                class="portal-textarea"
                rows="4"
                [(ngModel)]="rejectionReason"
                placeholder="Por favor indique o motivo da rejeição..."
              ></textarea>
              <div class="cta-row mt-4">
                <button class="portal-btn-danger" [disabled]="acting()" (click)="confirmReject()">
                  @if (acting()) { <span class="btn-spinner"></span> }
                  Confirmar Rejeição
                </button>
                <button class="portal-btn-ghost" (click)="showRejectForm.set(false)">Cancelar</button>
              </div>
            </div>
          }

          <!-- CTAs -->
          @if (!showRejectForm()) {
            <div class="cta-row">
              <button class="portal-btn-primary" [disabled]="acting()" (click)="accept()">
                @if (acting()) { <span class="btn-spinner"></span> }
                Aceitar Proposta
              </button>
              <button class="portal-btn-danger-outline" [disabled]="acting()" (click)="showRejectForm.set(true)">
                Rejeitar Proposta
              </button>
            </div>
          }

          @if (actionError()) {
            <p class="portal-error-msg" role="alert">{{ actionError() }}</p>
          }
        </div>
      }
    </main>

    <style>
      /* ── Layout ── */
      .portal-header {
        background: #ffffff;
        border-bottom: 1px solid var(--tx-gray-200);
        position: sticky;
        top: 0;
        z-index: 10;
      }
      .portal-header-inner {
        max-width: 760px;
        margin: 0 auto;
        padding: 16px 24px;
      }
      .portal-logo .logo-tx {
        font-size: 1.25rem;
        font-weight: 800;
        color: var(--tx-blue-950);
        letter-spacing: -0.03em;
      }
      .portal-main {
        max-width: 760px;
        margin: 0 auto;
        padding: 32px 24px 64px;
        min-height: calc(100vh - 64px);
        background: var(--bg-page);
      }
      .portal-loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 80px 0;
        color: var(--text-secondary);
        gap: 16px;
      }
      .portal-spinner {
        width: 40px;
        height: 40px;
        border: 3px solid var(--tx-gray-200);
        border-top-color: var(--tx-teal-500);
        border-radius: 50%;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin { to { transform: rotate(360deg); } }

      /* ── Cards ── */
      .portal-card {
        background: var(--bg-surface);
        border: 1px solid var(--tx-gray-200);
        border-radius: 12px;
        box-shadow: var(--shadow-card);
        padding: 24px;
      }

      /* ── Expiry banner ── */
      .portal-expiry-banner {
        display: flex;
        align-items: center;
        gap: 10px;
        background: var(--tx-gold-bg);
        border: 1px solid var(--tx-gold);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 20px;
        color: var(--tx-warning);
        font-weight: 500;
        font-size: 0.9rem;
      }
      .banner-icon {
        width: 20px;
        height: 20px;
        flex-shrink: 0;
      }

      /* ── Quote header ── */
      .portal-title {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--tx-blue-950);
        margin-bottom: 4px;
      }
      .portal-subtitle {
        color: var(--text-secondary);
        font-size: 0.95rem;
        margin-bottom: 8px;
      }
      .portal-description {
        color: var(--text-secondary);
        margin-top: 8px;
        font-size: 0.9rem;
      }
      .portal-validity {
        margin-top: 8px;
        font-size: 0.85rem;
        color: var(--text-muted);
      }

      /* ── Phases ── */
      .phase-toggle {
        display: flex;
        align-items: center;
        gap: 12px;
        width: 100%;
        text-align: left;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
      }
      .phase-num {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 28px;
        height: 28px;
        border-radius: 50%;
        background: var(--tx-teal-500);
        color: white;
        font-size: 0.8rem;
        font-weight: 700;
        flex-shrink: 0;
      }
      .phase-name {
        flex: 1;
        font-weight: 600;
        color: var(--text-primary);
        font-size: 1rem;
      }
      .phase-chevron {
        width: 18px;
        height: 18px;
        color: var(--text-muted);
        transition: transform var(--transition-base);
      }
      .phase-chevron.rotated {
        transform: rotate(180deg);
      }
      .phase-items {
        margin-top: 16px;
        border-top: 1px solid var(--tx-gray-100);
        padding-top: 12px;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .phase-item {
        display: flex;
        align-items: flex-start;
        justify-content: space-between;
        gap: 12px;
        padding: 10px 12px;
        border-radius: 8px;
        background: var(--bg-surface-2);
      }
      .phase-item.item-optional {
        border: 1px dashed var(--tx-gray-200);
      }
      .item-left {
        display: flex;
        align-items: flex-start;
        gap: 10px;
        flex: 1;
      }
      .item-checkbox {
        margin-top: 2px;
        accent-color: var(--tx-teal-500);
        width: 16px;
        height: 16px;
      }
      .item-name {
        font-weight: 500;
        color: var(--text-primary);
        font-size: 0.9rem;
      }
      .item-optional-badge {
        margin-left: 6px;
        font-size: 0.75rem;
        color: var(--text-muted);
        font-weight: 400;
      }
      .item-desc {
        font-size: 0.8rem;
        color: var(--text-secondary);
        margin-top: 2px;
      }
      .item-value {
        font-family: 'JetBrains Mono', monospace;
        font-size: 0.875rem;
        color: var(--text-secondary);
        white-space: nowrap;
        flex-shrink: 0;
      }

      /* ── Summary ── */
      .summary-title {
        font-weight: 600;
        color: var(--text-primary);
        margin-bottom: 12px;
        font-size: 1rem;
      }
      .summary-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid var(--tx-gray-100);
        color: var(--text-secondary);
        font-size: 0.9rem;
      }
      .summary-subtotal {
        font-weight: 500;
        color: var(--text-primary);
      }
      .summary-total {
        font-weight: 700;
        font-size: 1.05rem;
        color: var(--tx-teal-600);
        border-bottom: none;
        padding-top: 12px;
      }

      /* ── CTAs ── */
      .cta-row {
        display: flex;
        gap: 12px;
        flex-wrap: wrap;
      }
      .portal-btn-primary {
        flex: 1;
        min-width: 200px;
        background: var(--tx-teal-500);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 14px 24px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 8px;
        transition: background var(--transition-base);
      }
      .portal-btn-primary:hover:not(:disabled) {
        background: var(--tx-teal-600);
      }
      .portal-btn-primary:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
      .portal-btn-danger {
        background: var(--tx-danger);
        color: white;
        border: none;
        border-radius: 8px;
        padding: 12px 24px;
        font-size: 0.95rem;
        font-weight: 600;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        transition: opacity var(--transition-base);
      }
      .portal-btn-danger:hover:not(:disabled) {
        opacity: 0.88;
      }
      .portal-btn-danger-outline {
        background: transparent;
        color: var(--tx-danger);
        border: 1px solid var(--tx-danger);
        border-radius: 8px;
        padding: 14px 24px;
        font-size: 1rem;
        font-weight: 600;
        cursor: pointer;
        transition: background var(--transition-base);
      }
      .portal-btn-danger-outline:hover:not(:disabled) {
        background: rgba(220,38,38,0.06);
      }
      .portal-btn-ghost {
        background: transparent;
        color: var(--text-secondary);
        border: 1px solid var(--border-default);
        border-radius: 8px;
        padding: 12px 20px;
        font-size: 0.9rem;
        cursor: pointer;
      }
      .btn-spinner {
        display: inline-block;
        width: 16px;
        height: 16px;
        border: 2px solid rgba(255,255,255,0.4);
        border-top-color: white;
        border-radius: 50%;
        animation: spin 0.6s linear infinite;
      }

      /* ── Textarea ── */
      .portal-textarea {
        width: 100%;
        border: 1px solid var(--tx-gray-200);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 0.9rem;
        color: var(--text-primary);
        resize: vertical;
        outline: none;
        box-sizing: border-box;
      }
      .portal-textarea:focus {
        border-color: var(--tx-teal-500);
        box-shadow: 0 0 0 2px var(--tx-teal-100);
      }

      /* ── Error ── */
      .portal-error-card {
        background: var(--bg-surface);
        border: 1px solid var(--tx-gray-200);
        border-radius: 12px;
        padding: 48px 24px;
        text-align: center;
        box-shadow: var(--shadow-card);
      }
      .portal-error-icon {
        width: 56px;
        height: 56px;
        margin: 0 auto 16px;
        color: var(--tx-warning);
      }
      .portal-error-card h2 {
        font-size: 1.25rem;
        font-weight: 700;
        color: var(--tx-blue-950);
        margin-bottom: 8px;
      }
      .portal-error-card p {
        color: var(--text-secondary);
        max-width: 400px;
        margin: 0 auto;
      }
      .portal-error-msg {
        margin-top: 12px;
        color: var(--tx-danger);
        font-size: 0.875rem;
      }

      /* ── Success ── */
      .portal-success-card {
        position: relative;
        overflow: hidden;
        background: var(--bg-surface);
        border: 1px solid var(--tx-gray-200);
        border-radius: 12px;
        padding: 48px 24px;
        text-align: center;
        box-shadow: var(--shadow-card);
      }
      .portal-success-icon {
        width: 64px;
        height: 64px;
        margin: 0 auto 16px;
        color: var(--tx-success);
      }
      .portal-success-card h2 {
        font-size: 1.5rem;
        font-weight: 700;
        color: var(--tx-blue-950);
        margin-bottom: 8px;
      }
      .portal-success-card p {
        color: var(--text-secondary);
        max-width: 400px;
        margin: 0 auto;
      }

      /* ── Confetti ── */
      .confetti-container {
        position: absolute;
        inset: 0;
        pointer-events: none;
        overflow: hidden;
      }
      .confetti-piece {
        position: absolute;
        width: 8px;
        height: 8px;
        border-radius: 2px;
        animation: confetti-fall 3s ease-in forwards;
      }
      @keyframes confetti-fall {
        0%   { transform: translateY(-20px) rotate(0deg); opacity: 1; }
        100% { transform: translateY(100vh) rotate(720deg); opacity: 0; }
      }

      @media (prefers-reduced-motion: reduce) {
        .confetti-piece,
        .portal-spinner,
        .btn-spinner,
        .phase-chevron {
          animation: none !important;
          transition: none !important;
        }
      }
    </style>
  `,
})
export class ClientPortalComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #route = inject(ActivatedRoute);

  readonly loading = signal(true);
  readonly errorType = signal<'invalid' | 'expired' | null>(null);
  readonly quote = signal<PortalQuote | null>(null);
  readonly accepted = signal(false);
  readonly acting = signal(false);
  readonly showRejectForm = signal(false);
  readonly actionError = signal<string | null>(null);
  readonly expandedPhases = signal<Set<string>>(new Set());
  readonly selectedOptionals = signal<Set<string>>(new Set());

  rejectionReason = '';

  readonly confettiItems = Array.from({ length: 40 }, (_, i) => i);

  readonly daysUntilExpiry = computed(() => {
    const q = this.quote();
    if (!q?.valid_until) return null;
    const diff = new Date(q.valid_until).getTime() - Date.now();
    return Math.ceil(diff / 86_400_000);
  });

  readonly optionalsValue = computed(() => {
    const q = this.quote();
    if (!q) return 0;
    const selected = this.selectedOptionals();
    return q.phases
      .flatMap(p => p.items)
      .filter(item => item.optional && selected.has(item.id))
      .reduce((sum, item) => {
        if (item.pricing_type === 'fixed') return sum + (item.unit_value ?? 0) * item.quantity;
        return sum + (item.hours ?? 0) * (item.hourly_rate ?? 0) * item.quantity;
      }, 0);
  });

  readonly totalWithTax = computed(() => {
    const base = (this.quote()?.total_before_tax ?? 0) + this.optionalsValue();
    return base * 1.23;
  });

  ngOnInit(): void {
    const token = this.#route.snapshot.paramMap.get('token');
    void this.#loadQuote(token);
  }

  async #loadQuote(token: string | null): Promise<void> {
    try {
      if (!token) throw new TokenInvalidError();

      const { data, error } = await this.#supabase
        .from('quotes')
        .select('*')
        .eq('client_accept_token', token)
        .single();

      if (error || !data) throw new TokenInvalidError();

      validateToken(token, (data as Quote).token_expires_at ?? (data as Quote).valid_until);

      const q = data as Quote;
      const { data: phases } = await this.#supabase
        .from('quote_phases')
        .select('*')
        .eq('quote_id', q.id)
        .order('phase_order', { ascending: true });

      const phaseList = (phases ?? []) as QuotePhase[];
      const phasesWithItems: (QuotePhase & { items: QuoteItem[] })[] = [];

      for (const phase of phaseList) {
        const { data: items } = await this.#supabase
          .from('quote_items')
          .select('*')
          .eq('phase_id', phase.id)
          .order('item_order', { ascending: true });
        phasesWithItems.push({ ...phase, items: (items ?? []) as QuoteItem[] });
      }

      // Expand all phases by default
      this.expandedPhases.set(new Set(phaseList.map(p => p.id)));
      this.quote.set({ ...q, phases: phasesWithItems });

      // Track portal open
      void this.#trackOpen(q.id, q.portal_open_count);
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        this.errorType.set('expired');
      } else {
        this.errorType.set('invalid');
      }
    } finally {
      this.loading.set(false);
    }
  }

  async #trackOpen(quoteId: string, currentCount: number): Promise<void> {
    await this.#supabase
      .from('quotes')
      .update({
        portal_open_count: currentCount + 1,
        portal_opened_at: currentCount === 0 ? new Date().toISOString() : undefined,
      })
      .eq('id', quoteId);
  }

  togglePhase(phaseId: string): void {
    this.expandedPhases.update(set => {
      const next = new Set(set);
      if (next.has(phaseId)) next.delete(phaseId);
      else next.add(phaseId);
      return next;
    });
  }

  toggleOptional(itemId: string): void {
    this.selectedOptionals.update(set => {
      const next = new Set(set);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  accept(): void {
    const q = this.quote();
    if (!q) return;
    this.acting.set(true);
    this.actionError.set(null);
    const payload = buildAcceptanceUpdate([...this.selectedOptionals()]);
    void this.#supabase
      .from('quotes')
      .update(payload)
      .eq('id', q.id)
      .then(({ error }) => {
        if (error) {
          this.actionError.set('Erro ao aceitar proposta. Tente novamente.');
        } else {
          this.accepted.set(true);
        }
        this.acting.set(false);
      });
  }

  confirmReject(): void {
    const q = this.quote();
    if (!q) return;
    try {
      const payload = buildRejectionUpdate(this.rejectionReason);
      this.acting.set(true);
      this.actionError.set(null);
      void this.#supabase
        .from('quotes')
        .update(payload)
        .eq('id', q.id)
        .then(({ error }) => {
          if (error) {
            this.actionError.set('Erro ao rejeitar proposta. Tente novamente.');
          } else {
            this.showRejectForm.set(false);
            this.errorType.set('invalid'); // reuse error screen as "rejected" state
          }
          this.acting.set(false);
        });
    } catch (err) {
      this.actionError.set((err as Error).message);
    }
  }

  protected itemValue(item: QuoteItem): string {
    let value = 0;
    if (item.pricing_type === 'fixed') {
      value = (item.unit_value ?? 0) * item.quantity;
    } else {
      value = (item.hours ?? 0) * (item.hourly_rate ?? 0) * item.quantity;
    }
    return this.formatCurrency(value);
  }

  protected formatCurrency(value: number | null | undefined): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  protected formatDate(dateStr: string): string {
    return new Intl.DateTimeFormat('pt-PT', { dateStyle: 'long' }).format(new Date(dateStr));
  }

  protected confettiStyle(i: number): string {
    const colors = ['var(--tx-teal-500)', 'var(--tx-blue-500)', 'var(--tx-gold)', 'var(--tx-success)', 'var(--tx-teal-400)'];
    const color = colors[i % colors.length];
    const left = (i * 2.5) % 100;
    const delay = (i * 0.07) % 2;
    const size = 6 + (i % 5);
    return `background:${color}; left:${left}%; top:-10px; width:${size}px; height:${size}px; animation-delay:${delay}s`;
  }
}
