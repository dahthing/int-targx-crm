import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule, DecimalPipe } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ButtonModule } from 'primeng/button';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { QuoteService, QuoteWithPhases } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { QuoteStatusHistory } from '../../../core/models/quote.model';

interface PortalAccessEntry {
  id: string;
  accessed_at: string;
  action: 'open' | 'accept' | 'reject' | 'optional_toggle';
  ip_address: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown> | null;
}

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
  imports: [CommonModule, FormsModule, ButtonModule, TextareaModule, ToastModule, TabsModule, DecimalPipe],
  providers: [MessageService],
  templateUrl: './quote-review.component.html',
})
export class QuoteReviewComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #auth = inject(AuthService);
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);
  readonly #destroyRef = inject(DestroyRef);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly quote = signal<QuoteWithPhases | null>(null);
  readonly history = signal<QuoteStatusHistory[]>([]);
  readonly acting = signal(false);
  readonly activeTab = signal<string>('review');
  readonly accessLog = signal<PortalAccessEntry[]>([]);
  readonly accessLogLoading = signal(false);

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
    this.#quoteService
      .getById(id)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
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
    this.#quoteService
      .getStatusHistory(quoteId)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
      next: (h) => this.history.set(h),
    });
    this.#loadAccessLog(quoteId);
  }

  async #loadAccessLog(quoteId: string): Promise<void> {
    this.accessLogLoading.set(true);
    const { data } = await this.#supabase
      .from('portal_access_log')
      .select('id, accessed_at, action, ip_address, user_agent, metadata')
      .eq('quote_id', quoteId)
      .order('accessed_at', { ascending: false });
    this.accessLog.set((data ?? []) as PortalAccessEntry[]);
    this.accessLogLoading.set(false);
  }

  approve(): void {
    const q = this.quote();
    if (!q) return;
    this.acting.set(true);
    this.#quoteService
      .transition(q.id, 'aprovado_interno')
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
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
    this.#quoteService
      .transition(q.id, 'rejeitado', this.rejectionNotes)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
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
    this.#quoteService
      .transition(q.id, 'em_revisao', this.revisionNotes)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
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
    this.#quoteService
      .applyRiskOverride(q.id, this.overrideNotes)
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
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

  protected accessActionLabel(action: string): string {
    const LABELS: Record<string, string> = {
      open: 'Abriu',
      accept: 'Aceitou',
      reject: 'Rejeitou',
      optional_toggle: 'Alterou opcionais',
    };
    return LABELS[action] ?? action;
  }

  protected accessActionClass(action: string): string {
    const CLASSES: Record<string, string> = {
      open: 'enviado_cliente',
      accept: 'aceite',
      reject: 'rejeitado',
      optional_toggle: 'em_revisao',
    };
    return CLASSES[action] ?? '';
  }

  protected formatUserAgent(ua: string | null): string {
    if (!ua) return '—';
    if (ua.includes('iPhone') || ua.includes('Android')) return '📱 Mobile';
    if (ua.includes('Chrome')) return 'Chrome';
    if (ua.includes('Firefox')) return 'Firefox';
    if (ua.includes('Safari')) return 'Safari';
    return ua.slice(0, 40);
  }
}
