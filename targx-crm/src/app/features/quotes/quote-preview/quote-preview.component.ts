import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { QuoteService } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { PdfRendererService } from '../../../core/services/pdf-renderer.service';
import { environment } from '../../../../environments/environment';
import { calculateItemSubtotal, calculateQuoteTotals } from '../../../core/services/quote-calculator.functions';
import type { QuoteItem, QuotePhase } from '../../../core/models/quote.model';
import type { QuoteWithPhases } from '../../../core/services/quote.service';

@Component({
  selector: 'app-quote-preview',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <!-- Toolbar -->
      <div class="flex items-center justify-between mb-6 print:hidden">
        <button class="tx-btn-ghost" (click)="goBack()" aria-label="Voltar ao editor">
          <i class="pi pi-arrow-left mr-2"></i>Voltar ao editor
        </button>

        <div class="flex gap-2">
          @if (quote()?.client_accept_token) {
            <button
              class="tx-btn-secondary"
              (click)="openClientPortal()"
              aria-label="Ver portal do cliente"
            >
              <i class="pi pi-external-link mr-2"></i>Ver portal do cliente
            </button>
          }
          @if (isAdmin()) {
            <button
              class="tx-btn-secondary"
              (click)="generatePdf()"
              aria-label="Gerar PDF"
            >
              <i class="pi pi-file-pdf mr-2"></i>Gerar PDF
            </button>
            <button
              class="tx-btn-primary"
              [disabled]="sendingToClient() || !canSend()"
              (click)="sendToClient()"
              aria-label="Enviar ao cliente"
            >
              @if (sendingToClient()) {
                <i class="pi pi-spin pi-spinner mr-2"></i>A enviar...
              } @else {
                <i class="pi pi-send mr-2"></i>Enviar ao cliente
              }
            </button>
          }
        </div>
      </div>

      @if (loading()) {
        <div class="tx-card p-12 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-2xl"></i>
        </div>
      }

      @if (!loading() && quote()) {
        <!-- Preview document -->
        <div class="tx-card max-w-4xl mx-auto p-10 print:shadow-none print:border-0">
          <!-- Header -->
          <div class="flex items-start justify-between border-b-2 border-[var(--tx-blue-950)] pb-6 mb-8">
            <div>
              <div class="text-h1 font-bold text-[var(--tx-blue-950)]">ORÇAMENTO</div>
              <div class="text-body-sm text-[var(--tx-gray-400)] mt-1 font-mono">
                Nº {{ quote()!.id.slice(0, 8).toUpperCase() }} · v{{ quote()!.version }}
              </div>
            </div>
            <div class="text-right">
              <div class="font-bold text-[var(--tx-blue-950)] text-lg">TargX</div>
              <div class="text-body-sm text-[var(--tx-gray-400)]">crm.targx.com</div>
              @if (quote()!.valid_until) {
                <div class="text-body-sm text-[var(--tx-gray-600)] mt-2">
                  Válido até {{ formatDate(quote()!.valid_until!) }}
                </div>
              }
            </div>
          </div>

          <!-- Quote info -->
          <div class="grid grid-cols-2 gap-8 mb-8">
            <div>
              <h3 class="text-body-sm font-semibold text-[var(--tx-gray-400)] uppercase tracking-wide mb-2">Para</h3>
              <p class="text-body font-medium text-[var(--tx-gray-950)]">{{ quote()!.client_id }}</p>
            </div>
            <div>
              <h3 class="text-body-sm font-semibold text-[var(--tx-gray-400)] uppercase tracking-wide mb-2">Data</h3>
              <p class="text-body text-[var(--tx-gray-950)]">{{ formatDate(quote()!.created_at) }}</p>
            </div>
          </div>

          <!-- Title & description -->
          <div class="mb-8">
            <h2 class="text-h3 font-bold text-[var(--tx-blue-950)]">{{ quote()!.title }}</h2>
            @if (quote()!.description) {
              <p class="text-body text-[var(--tx-gray-600)] mt-2 leading-relaxed">{{ quote()!.description }}</p>
            }
          </div>

          <!-- Phases & items -->
          @for (phase of quote()!.phases; track phase.id) {
            <div class="mb-6">
              <h3 class="text-body font-bold text-[var(--tx-blue-950)] bg-[var(--tx-gray-050)] px-4 py-2 rounded-lg mb-2">
                {{ phase.name }}
              </h3>
              <table class="w-full text-body-sm">
                <thead>
                  <tr class="border-b border-[var(--tx-gray-200)] text-[var(--tx-gray-400)]">
                    <th class="text-left py-2 font-medium">Item</th>
                    <th class="text-right py-2 font-medium w-20">Tipo</th>
                    <th class="text-right py-2 font-medium w-32">Detalhe</th>
                    <th class="text-right py-2 font-medium w-28">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  @for (item of phase.items; track item.id) {
                    <tr
                      class="border-b border-[var(--tx-gray-100)]"
                      [class.opacity-60]="item.optional"
                    >
                      <td class="py-2">
                        <span class="text-[var(--tx-gray-950)]">{{ item.name }}</span>
                        @if (item.optional) {
                          <span class="ml-2 text-[var(--tx-gray-400)] italic">(Opcional)</span>
                        }
                        @if (item.description) {
                          <p class="text-[var(--tx-gray-400)] text-xs mt-0.5">{{ item.description }}</p>
                        }
                      </td>
                      <td class="text-right py-2 text-[var(--tx-gray-400)]">
                        {{ item.pricing_type === 'hourly' ? 'Hora' : 'Fixo' }}
                      </td>
                      <td class="text-right py-2 font-mono text-[var(--tx-gray-600)]">
                        @if (item.pricing_type === 'hourly') {
                          {{ item.hours ?? 0 }}h × {{ formatCurrency(item.hourly_rate ?? 0) }}
                        } @else {
                          {{ formatCurrency(item.unit_value ?? 0) }} × {{ item.quantity }}
                        }
                      </td>
                      <td class="text-right py-2 font-mono font-medium text-[var(--tx-gray-950)]">
                        {{ formatCurrency(itemSubtotal(item)) }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          }

          <!-- Financial summary -->
          <div class="border-t-2 border-[var(--tx-blue-950)] pt-6 mt-8">
            <div class="flex justify-end">
              <dl class="w-72 space-y-2 text-body-sm">
                <div class="flex justify-between">
                  <dt class="text-[var(--tx-gray-600)]">Subtotal base</dt>
                  <dd class="font-mono text-[var(--tx-gray-950)]">{{ formatCurrency(totals().subtotal_base) }}</dd>
                </div>
                @if (totals().risk_adjustment > 0) {
                  <div class="flex justify-between">
                    <dt class="text-[var(--tx-gray-600)]">Ajuste de risco</dt>
                    <dd class="font-mono text-[var(--tx-gray-950)]">{{ formatCurrency(totals().risk_adjustment) }}</dd>
                  </div>
                }
                @if (quote()!.discount_pct > 0) {
                  <div class="flex justify-between">
                    <dt class="text-[var(--tx-gray-600)]">Desconto ({{ quote()!.discount_pct }}%)</dt>
                    <dd class="font-mono text-[var(--tx-gray-950)]">-{{ formatCurrency(totals().discount_amount) }}</dd>
                  </div>
                }
                <div class="flex justify-between border-t border-[var(--tx-gray-200)] pt-2">
                  <dt class="font-semibold text-[var(--tx-gray-950)]">Total s/IVA</dt>
                  <dd class="font-mono font-semibold text-[var(--tx-gray-950)]">{{ formatCurrency(totals().total_before_tax) }}</dd>
                </div>
                <div class="flex justify-between text-[var(--tx-gray-400)]">
                  <dt>IVA (23%)</dt>
                  <dd class="font-mono">{{ formatCurrency(totals().total_with_tax - totals().total_before_tax) }}</dd>
                </div>
                <div class="flex justify-between border-t-2 border-[var(--tx-blue-950)] pt-2">
                  <dt class="font-bold text-[var(--tx-blue-950)] text-base">Total c/IVA</dt>
                  <dd class="font-mono font-bold text-[var(--tx-blue-950)] text-base">{{ formatCurrency(totals().total_with_tax) }}</dd>
                </div>
              </dl>
            </div>
          </div>

          @if (quote()!.payment_terms) {
            <div class="mt-8 pt-6 border-t border-[var(--tx-gray-200)]">
              <h3 class="text-body-sm font-semibold text-[var(--tx-gray-400)] uppercase tracking-wide mb-2">Condições de pagamento</h3>
              <p class="text-body text-[var(--tx-gray-600)]">{{ quote()!.payment_terms }}</p>
            </div>
          }

          <!-- Footer -->
          <div class="mt-10 pt-6 border-t border-[var(--tx-gray-200)] text-body-sm text-[var(--tx-gray-400)] text-center">
            Orçamento gerado em {{ formatDate(quote()!.created_at) }} · TargX CRM
          </div>
        </div>
      }
    </div>
  `,
})
export class QuotePreviewComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #authService = inject(AuthService);
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #pdfRenderer = inject(PdfRendererService);
  readonly #messageService = inject(MessageService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);

  readonly loading = signal(true);
  readonly quote = signal<QuoteWithPhases | null>(null);
  readonly sendingToClient = signal(false);

  readonly isAdmin = computed(() => this.#authService.role() === 'admin');
  readonly canSend = computed(() => {
    const q = this.quote();
    return !!q && ['aprovado', 'em_revisao'].includes(q.status);
  });

  readonly totals = computed(() => {
    const q = this.quote();
    if (!q) return { subtotal_base: 0, risk_adjustment: 0, subtotal_with_risk: 0, discount_amount: 0, total_before_tax: 0, total_with_tax: 0, total_hours: 0 };
    const allItems = q.phases.flatMap(p => p.items);
    return calculateQuoteTotals(
      [] as QuotePhase[],
      allItems,
      q.discount_pct ?? 0,
      q.risk_multiplier_total ?? 1,
      0,
      23
    );
  });

  async ngOnInit(): Promise<void> {
    const id = this.#route.snapshot.paramMap.get('id');
    if (!id) { this.#router.navigate(['/quotes']); return; }
    try {
      const q = await this.#quoteService.getById(id).toPromise();
      this.quote.set(q ?? null);
    } finally {
      this.loading.set(false);
    }
  }

  async generatePdf(): Promise<void> {
    const q = this.quote();
    if (!q) return;
    try {
      const [{ data: clientData }, { data: partnerData }] = await Promise.all([
        this.#supabase.from('clients').select('id, name, email, company').eq('id', q.client_id).single(),
        this.#supabase.from('profiles').select('id, full_name, email, role').eq('id', q.partner_id).single(),
      ]);
      await this.#pdfRenderer.openPrintPreview(
        q,
        clientData ?? { name: 'Cliente', company: null, email: null },
        partnerData ?? { id: q.partner_id, full_name: 'TargX', email: 'hello@targx.pt', role: 'partner' },
      );
    } catch (err) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o PDF.' });
      console.error('[generatePdf]', err);
    }
  }

  async sendToClient(): Promise<void> {
    const id = this.quote()?.id;
    if (!id || this.sendingToClient()) return;
    this.sendingToClient.set(true);
    try {
      const { error } = await this.#supabase.functions.invoke('send-quote-to-client', {
        body: { quoteId: id },
      });
      if (error) throw error;
      this.#messageService.add({ severity: 'success', summary: 'Enviado', detail: 'Orçamento enviado ao cliente com sucesso.' });
      // Reload quote to get updated status + token
      const q = await this.#quoteService.getById(id).toPromise();
      this.quote.set(q ?? null);
    } catch (err) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível enviar ao cliente.' });
      console.error('[sendToClient]', err);
    } finally {
      this.sendingToClient.set(false);
    }
  }

  openClientPortal(): void {
    const token = this.quote()?.client_accept_token;
    if (token) {
      window.open(`${environment.clientPortalBaseUrl}/${token}`, '_blank', 'noopener,noreferrer');
    }
  }

  goBack(): void {
    const id = this.#route.snapshot.paramMap.get('id');
    this.#router.navigate(['/quotes', id, 'build']);
  }

  itemSubtotal(item: QuoteItem): number {
    return calculateItemSubtotal(item);
  }

  formatCurrency(value: number | null): string {
    if (value == null) return '—';
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('pt-PT');
  }
}
