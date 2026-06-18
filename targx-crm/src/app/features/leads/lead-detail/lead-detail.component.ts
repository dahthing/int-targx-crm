import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { TabsModule } from 'primeng/tabs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { SelectModule } from 'primeng/select';
import { TextareaModule } from 'primeng/textarea';
import { LeadService } from '../../../core/services/lead.service';
import { AuthService } from '../../../core/services/auth.service';
import { QuoteService } from '../../../core/services/quote.service';
import { ProjectService } from '../../../core/services/project.service';
import { Lead, LeadActivity, LeadStatus } from '../../../core/models/lead.model';
import type { Quote } from '../../../core/models/quote.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { SilenceWarningComponent } from '../../../shared/components/silence-warning/silence-warning.component';
import { ObjectionPanelComponent } from '../../knowledge/objection-panel/objection-panel.component';
import { environment } from '../../../../environments/environment';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';

interface WinTranche {
  description: string;
  amount: number;
  due_date: string;
}

interface WinForm {
  contract_value: number;
  contract_date: string;
  tranche_count: number;
  first_pct: number;
  tranches: WinTranche[];
  selected_quote_id: string;
  pending_note: string;
}

const VALID_TRANSITIONS: Record<LeadStatus, LeadStatus[]> = {
  nova: ['contactada'],
  contactada: ['proposta_enviada', 'fechada_perdida'],
  proposta_enviada: ['negociacao', 'fechada_perdida'],
  negociacao: ['fechada_ganha', 'fechada_perdida'],
  fechada_ganha: [],
  fechada_perdida: [],
};

const STATUS_LABELS: Record<LeadStatus, string> = {
  nova: 'Nova',
  contactada: 'Contactada',
  proposta_enviada: 'Proposta Enviada',
  negociacao: 'Negociação',
  fechada_ganha: 'Ganha',
  fechada_perdida: 'Perdida',
};

const ACTIVITY_TYPE_LABELS = [
  { label: 'Nota', value: 'nota' },
  { label: 'Chamada', value: 'chamada' },
  { label: 'Reunião', value: 'reuniao' },
  { label: 'Email', value: 'email' },
  { label: 'Proposta', value: 'proposta' },
];

function daysSince(dateStr: string | null): number {
  if (!dateStr) return 999;
  return Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
}

function formatCurrency(value: number | null): string {
  if (value == null) return '—';
  return '€ ' + value.toLocaleString('pt-PT', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('pt-PT');
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-PT', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface LeadWithActivities extends Lead {
  activities: LeadActivity[];
}

@Component({
  selector: 'app-lead-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    TabsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    SelectModule,
    TextareaModule,
    FormsModule,
    ReactiveFormsModule,
    StatusBadgeComponent,
    SilenceWarningComponent,
    ObjectionPanelComponent,
  ],
  template: `
    @if (loading()) {
      <div class="flex items-center justify-center h-64">
        <p class="text-tx-gray-400">A carregar...</p>
      </div>
    }

    @if (lead(); as lead) {
      <div class="p-6 max-w-6xl mx-auto">

        <!-- Silence warning banner -->
        @if (silenceDays() > 7) {
          <div class="mb-4">
            <app-silence-warning [daysSinceActivity]="silenceDays()" />
          </div>
        }

        <!-- Header -->
        <div class="flex items-start justify-between gap-4 mb-6">
          <div class="flex items-start gap-3">
            <button
              class="tx-btn-ghost text-sm"
              (click)="goBack()"
              aria-label="Voltar à lista"
            >
              ← Leads
            </button>
            <div>
              <div class="flex items-center gap-3 mb-1">
                <h1 class="text-h2 text-tx-gray-900">{{ lead.title }}</h1>
                <app-status-badge [status]="lead.status" type="lead" />
              </div>
              <p class="text-sm text-tx-gray-500">
                Parceiro: {{ lead.partner_id }}
              </p>
            </div>
          </div>

          <!-- Transition buttons + Objecções -->
          <div class="flex items-center gap-2 flex-shrink-0">
            <button
              class="tx-btn-ghost text-sm"
              (click)="showObjections.set(true)"
            >
              Objecções
            </button>
            @for (nextStatus of nextStatuses(); track nextStatus) {
              <button
                [class]="nextStatus === 'fechada_perdida' ? 'tx-btn-danger text-sm' : 'tx-btn-primary text-sm'"
                (click)="handleTransition(nextStatus)"
              >
                → {{ statusLabel(nextStatus) }}
              </button>
            }
          </div>
        </div>

        <!-- Two-column layout -->
        <div class="grid grid-cols-3 gap-6">

          <!-- Main content (2/3) -->
          <div class="col-span-2">
            <p-tabs [value]="'activities'">
              <p-tablist>
                <p-tab value="activities">Actividades</p-tab>
                <p-tab value="quotes">Orçamentos</p-tab>
              </p-tablist>

              <p-tabpanels>
                <!-- Activities tab -->
                <p-tabpanel value="activities">
                  <!-- Add activity form -->
                  <form [formGroup]="activityForm" (ngSubmit)="submitActivity()" class="tx-card p-4 mb-4">
                    <p class="text-sm font-semibold text-tx-gray-700 mb-3">Registar actividade</p>
                    <div class="flex gap-3 mb-3">
                      <p-select
                        [options]="activityTypeOptions"
                        optionLabel="label"
                        optionValue="value"
                        formControlName="type"
                        placeholder="Tipo"
                        styleClass="w-40"
                      />
                    </div>
                    <textarea
                      pTextarea
                      class="tx-input w-full mb-3"
                      formControlName="content"
                      placeholder="Descrever a actividade..."
                      rows="3"
                    ></textarea>
                    @if (activityForm.get('content')?.invalid && activityForm.get('content')?.touched) {
                      <span class="tx-field-error block mb-2">Conteúdo obrigatório</span>
                    }
                    <div class="flex justify-end">
                      <button
                        type="submit"
                        class="tx-btn-primary text-sm"
                        [disabled]="activityForm.invalid || savingActivity()"
                      >
                        {{ savingActivity() ? 'A guardar...' : 'Guardar' }}
                      </button>
                    </div>
                  </form>

                  <!-- Timeline -->
                  <div class="flex flex-col gap-3">
                    @for (activity of activities(); track activity.id) {
                      <div class="tx-card p-4">
                        <div class="flex items-center justify-between mb-2">
                          <span class="tx-badge {{ activity.type }} text-xs">{{ activity.type }}</span>
                          <span class="text-xs text-tx-gray-400">{{ formatDateTime(activity.activity_at) }}</span>
                        </div>
                        <p class="text-sm text-tx-gray-700 whitespace-pre-wrap">{{ activity.content }}</p>
                      </div>
                    } @empty {
                      <p class="text-sm text-tx-gray-400 text-center py-8">Sem actividades registadas</p>
                    }
                  </div>
                </p-tabpanel>

                <!-- Quotes tab -->
                <p-tabpanel value="quotes">
                  <div class="flex justify-between items-center mt-4 mb-3">
                    <p class="text-sm font-semibold text-tx-gray-700">Orçamentos desta lead</p>
                    <button class="tx-btn-primary text-sm" (click)="createQuote()">
                      <i class="pi pi-plus mr-1"></i>Novo orçamento
                    </button>
                  </div>
                  @if (quotesLoading()) {
                    <div class="flex justify-center py-8">
                      <i class="pi pi-spin pi-spinner text-2xl text-[var(--tx-teal-500)]"></i>
                    </div>
                  } @else if (quotes().length === 0) {
                    <div class="tx-card p-8 text-center">
                      <i class="pi pi-file" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.3"></i>
                      <p class="text-sm text-tx-gray-400">Sem orçamentos para esta lead.</p>
                    </div>
                  } @else {
                    <div class="flex flex-col gap-3">
                      @for (q of quotes(); track q.id) {
                        <div class="tx-card p-4 flex items-center justify-between gap-4">
                          <div class="flex-1 min-w-0">
                            <p class="text-sm font-semibold text-tx-gray-800 truncate">{{ q.title }}</p>
                            <div class="flex items-center gap-2 mt-1">
                              <span class="tx-badge text-xs">{{ q.status }}</span>
                              <span class="font-mono text-xs text-tx-gray-400">v{{ q.version }}</span>
                              @if (q.total_before_tax != null) {
                                <span class="font-mono text-xs font-semibold text-[var(--tx-teal-600)]">
                                  {{ formatCurrency(q.total_before_tax) }}
                                </span>
                              }
                            </div>
                          </div>
                          <div class="flex gap-2 flex-shrink-0">
                            <button class="tx-btn-ghost text-sm" (click)="viewQuote(q.id)">
                              <i class="pi pi-eye mr-1"></i>Ver
                            </button>
                            @if (q.client_accept_token) {
                              <button class="tx-btn-secondary text-sm" (click)="openClientPortal(q)">
                                <i class="pi pi-external-link mr-1"></i>Portal
                              </button>
                            }
                          </div>
                        </div>
                      }
                    </div>
                  }
                </p-tabpanel>
              </p-tabpanels>
            </p-tabs>
          </div>

          <!-- Sidebar (1/3) -->
          <div class="col-span-1 flex flex-col gap-4">
            <div class="tx-card p-4">
              <h3 class="text-sm font-semibold text-tx-gray-600 uppercase tracking-wide mb-3">Detalhes</h3>
              <div class="flex flex-col gap-3">
                <div>
                  <p class="text-xs text-tx-gray-400 mb-1">Valor estimado</p>
                  <p class="text-base font-mono font-semibold text-tx-teal-600">
                    {{ formatCurrency(lead.estimated_value) }}
                  </p>
                </div>
                @if (lead.source) {
                  <div>
                    <p class="text-xs text-tx-gray-400 mb-1">Fonte</p>
                    <p class="text-sm text-tx-gray-700">{{ lead.source }}</p>
                  </div>
                }
                @if (lead.next_action) {
                  <div>
                    <p class="text-xs text-tx-gray-400 mb-1">Próxima acção</p>
                    <p class="text-sm text-tx-gray-700">{{ lead.next_action }}</p>
                    @if (lead.next_action_date) {
                      <p class="text-xs text-tx-gray-400 mt-1">{{ formatDate(lead.next_action_date) }}</p>
                    }
                  </div>
                }
                @if (lead.lost_reason) {
                  <div>
                    <p class="text-xs text-tx-gray-400 mb-1">Motivo de perda</p>
                    <p class="text-sm text-red-600">{{ lead.lost_reason }}</p>
                  </div>
                }
                <div>
                  <p class="text-xs text-tx-gray-400 mb-1">Criada em</p>
                  <p class="text-sm text-tx-gray-700">{{ formatDate(lead.created_at) }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Lost reason modal -->
      <p-dialog
        header="Motivo de perda"
        [visible]="showLostReasonModal()"
        (visibleChange)="showLostReasonModal.set($event)"
        [modal]="true"
        [style]="{ width: '400px' }"
      >
        <div class="flex flex-col gap-4">
          <p class="text-sm text-tx-gray-600">Indique o motivo pelo qual esta lead foi perdida.</p>
          <textarea
            pTextarea
            class="tx-input w-full"
            [(ngModel)]="lostReasonValue"
            placeholder="Descrever motivo..."
            rows="4"
          ></textarea>
        </div>
        <ng-template pTemplate="footer">
          <div class="flex justify-end gap-3">
            <button class="tx-btn-secondary" (click)="cancelLostReason()">Cancelar</button>
            <button
              class="tx-btn-danger"
              [disabled]="!lostReasonValue.trim() || transitioning()"
              (click)="confirmLostReason()"
            >
              {{ transitioning() ? 'A processar...' : 'Confirmar perda' }}
            </button>
          </div>
        </ng-template>
      </p-dialog>

      <!-- Win conversion modal -->
      <p-dialog
        header="🎉 Lead Ganha — Próximo passo"
        [visible]="showWinModal()"
        (visibleChange)="showWinModal.set($event)"
        [modal]="true"
        [closable]="false"
        [style]="{ width: '560px' }"
      >
        <div style="padding:8px 0;display:flex;flex-direction:column;gap:20px">
          <!-- Option selector -->
          <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
            @for (opt of winOptions; track opt.id) {
              <button
                (click)="winMode.set(opt.id)"
                [style.border]="winMode() === opt.id ? '2px solid var(--tx-teal-500)' : '2px solid var(--tx-gray-200)'"
                [style.background]="winMode() === opt.id ? 'var(--tx-teal-50)' : 'white'"
                style="border-radius:8px;padding:12px 8px;text-align:center;cursor:pointer;transition:all 0.15s"
              >
                <div style="font-size:1.25rem;margin-bottom:6px">{{ opt.icon }}</div>
                <div style="font-size:0.8125rem;font-weight:600;color:var(--tx-gray-800)">{{ opt.label }}</div>
                <div style="font-size:0.75rem;color:var(--tx-gray-500);margin-top:4px">{{ opt.desc }}</div>
              </button>
            }
          </div>

          <!-- Option A: Create project now -->
          @if (winMode() === 'create') {
            <div style="display:flex;flex-direction:column;gap:12px;padding:16px;background:var(--tx-gray-050);border-radius:8px;border:1px solid var(--tx-gray-200)">
              <div class="tx-field">
                <label class="tx-form-label">Valor do contrato (€) *</label>
                <input type="number" class="tx-input w-full" [(ngModel)]="winForm.contract_value" min="0" step="500" />
              </div>
              <div class="tx-field">
                <label class="tx-form-label">Data de contrato *</label>
                <input type="date" class="tx-input w-full" [(ngModel)]="winForm.contract_date" />
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
                <div class="tx-field">
                  <label class="tx-form-label">Nº de tranches</label>
                  <select class="tx-input w-full" [(ngModel)]="winForm.tranche_count" (ngModelChange)="buildTranches()">
                    <option [value]="1">1 — pagamento único</option>
                    <option [value]="2">2 tranches</option>
                    <option [value]="3">3 tranches</option>
                    <option [value]="4">4 tranches</option>
                  </select>
                </div>
                <div class="tx-field">
                  <label class="tx-form-label">1ª tranche (%)</label>
                  <input type="number" class="tx-input w-full" [(ngModel)]="winForm.first_pct" [max]="100" [min]="10" (ngModelChange)="buildTranches()" />
                </div>
              </div>
              <!-- Tranches preview -->
              @if (winForm.tranches.length > 0) {
                <div>
                  <p class="tx-form-label" style="margin-bottom:8px">Tranches</p>
                  @for (t of winForm.tranches; track $index; let i = $index) {
                    <div style="display:grid;grid-template-columns:1fr 140px 140px;gap:8px;margin-bottom:6px;align-items:center">
                      <input type="text" class="tx-input" [(ngModel)]="t.description" placeholder="Descrição" />
                      <span style="font-size:0.8125rem;font-family:'JetBrains Mono',monospace;color:var(--tx-teal-600);text-align:right;padding-right:8px">
                        {{ formatCurrency(t.amount) }}
                      </span>
                      <input type="date" class="tx-input" [(ngModel)]="t.due_date" />
                    </div>
                  }
                </div>
              }
            </div>
          }

          <!-- Option B: Associate existing quote -->
          @if (winMode() === 'quote') {
            <div style="padding:16px;background:var(--tx-gray-050);border-radius:8px;border:1px solid var(--tx-gray-200)">
              @if (convertibleQuotes().length === 0) {
                <p style="color:var(--tx-gray-400);font-size:0.875rem;text-align:center;padding:16px">
                  Sem orçamentos aprovados para esta lead.<br>
                  <span style="font-size:0.8125rem">Cria um orçamento ou usa a opção "Criar projecto".</span>
                </p>
              } @else {
                <p class="tx-form-label" style="margin-bottom:8px">Selecciona o orçamento</p>
                @for (q of convertibleQuotes(); track q.id) {
                  <button
                    (click)="winForm.selected_quote_id = q.id"
                    [style.border]="winForm.selected_quote_id === q.id ? '2px solid var(--tx-teal-500)' : '1px solid var(--tx-gray-200)'"
                    style="display:block;width:100%;text-align:left;padding:12px;border-radius:8px;margin-bottom:8px;cursor:pointer;background:white"
                  >
                    <div style="font-weight:500;font-size:0.875rem">{{ q.title }}</div>
                    <div style="font-size:0.8125rem;color:var(--tx-gray-500)">
                      {{ formatCurrency(q.total_before_tax) }} · v{{ q.version }} · {{ q.status }}
                    </div>
                  </button>
                }
              }
            </div>
          }

          <!-- Option C: Win without project -->
          @if (winMode() === 'later') {
            <div style="padding:16px;background:var(--tx-gray-050);border-radius:8px;border:1px solid var(--tx-gray-200)">
              <p style="font-size:0.875rem;color:var(--tx-gray-600);margin-bottom:12px">
                A lead ficará marcada como <strong>Ganha — por converter</strong>. Aparecerá como alerta no dashboard até criar o projecto.
              </p>
              <label class="tx-form-label">Nota (obrigatória)</label>
              <textarea class="tx-input w-full" [(ngModel)]="winForm.pending_note" rows="3" placeholder="ex: Cliente confirmou por email, contrato a assinar semana que vem"></textarea>
            </div>
          }
        </div>

        <ng-template pTemplate="footer">
          <div class="flex justify-end gap-3">
            <button class="tx-btn-secondary" (click)="cancelWin()">Cancelar</button>
            <button
              class="tx-btn-primary"
              [disabled]="!canConfirmWin() || transitioning()"
              (click)="confirmWin()"
            >
              {{ transitioning() ? 'A processar...' : 'Confirmar' }}
            </button>
          </div>
        </ng-template>
      </p-dialog>

      <!-- Objections panel -->
      <app-objection-panel [(visible)]="showObjections" />
    }
  `,
})
export class LeadDetailComponent implements OnInit {
  private readonly leadService = inject(LeadService);
  private readonly authService = inject(AuthService);
  private readonly quoteService = inject(QuoteService);
  private readonly projectService = inject(ProjectService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  readonly #supabase = inject(SUPABASE_CLIENT);

  // Route param via withComponentInputBinding
  readonly leadId = input.required<string>();

  protected readonly loading = signal(false);
  protected readonly lead = signal<LeadWithActivities | null>(null);
  protected readonly activities = computed(() => this.lead()?.activities ?? []);
  protected readonly savingActivity = signal(false);
  protected readonly transitioning = signal(false);
  protected readonly showObjections = signal(false);
  protected readonly showLostReasonModal = signal(false);
  protected readonly quotes = signal<Quote[]>([]);
  protected readonly quotesLoading = signal(false);
  protected lostReasonValue = '';
  protected pendingTransition: LeadStatus | null = null;

  // Win conversion modal
  protected readonly showWinModal = signal(false);
  protected readonly winMode = signal<'create' | 'quote' | 'later'>('create');
  protected readonly convertibleQuotes = computed(() =>
    this.quotes().filter(q => q.status === 'aprovado_interno' || q.status === 'enviado_cliente')
  );
  protected winForm: WinForm = this.#freshWinForm();

  protected readonly winOptions = [
    { id: 'create' as const, icon: '🏗️', label: 'Criar projecto', desc: 'Definir valor e tranches agora' },
    { id: 'quote' as const, icon: '📄', label: 'Usar orçamento', desc: 'A partir de proposta existente' },
    { id: 'later' as const, icon: '⏳', label: 'Mais tarde', desc: 'Marcar como ganha sem projecto' },
  ];

  protected readonly silenceDays = computed(() => daysSince(this.lead()?.last_activity_at ?? null));
  protected readonly nextStatuses = computed<LeadStatus[]>(() => {
    const s = this.lead()?.status;
    return s ? (VALID_TRANSITIONS[s] ?? []) : [];
  });

  protected readonly activityTypeOptions = ACTIVITY_TYPE_LABELS;
  protected readonly formatCurrency = formatCurrency;
  protected readonly formatDate = formatDate;
  protected readonly formatDateTime = formatDateTime;

  protected readonly activityForm = this.fb.nonNullable.group({
    type: ['nota' as string, Validators.required],
    content: ['', Validators.required],
  });

  ngOnInit(): void {
    this.loadLead();
  }

  private loadLead(): void {
    this.loading.set(true);
    this.leadService.getById(this.leadId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: lead => {
          this.lead.set(lead);
          this.loading.set(false);
          this.loadQuotes(lead);
        },
        error: () => this.loading.set(false),
      });
  }

  private loadQuotes(lead: Lead): void {
    this.quotesLoading.set(true);
    this.quoteService.getAll({ lead_id: lead.id })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: qs => {
          this.quotes.set(qs);
          this.quotesLoading.set(false);
        },
        error: () => this.quotesLoading.set(false),
      });
  }

  protected createQuote(): void {
    const lead = this.lead();
    this.router.navigate(['/quotes/new'], {
      queryParams: {
        client_id: lead?.client_id ?? '',
        lead_id: lead?.id ?? '',
      },
    });
  }

  protected viewQuote(id: string): void {
    this.router.navigate(['/quotes', id, 'preview']);
  }

  protected openClientPortal(q: Quote): void {
    if (q.client_accept_token) {
      window.open(`${environment.clientPortalBaseUrl}/${q.client_accept_token}`, '_blank', 'noopener,noreferrer');
    }
  }

  protected statusLabel(status: LeadStatus): string {
    return STATUS_LABELS[status];
  }

  protected goBack(): void {
    this.router.navigate(['/leads']);
  }

  protected handleTransition(newStatus: LeadStatus): void {
    if (newStatus === 'fechada_perdida') {
      this.pendingTransition = newStatus;
      this.showLostReasonModal.set(true);
    } else if (newStatus === 'fechada_ganha') {
      this.winForm = this.#freshWinForm();
      this.winMode.set('create');
      this.showWinModal.set(true);
    } else {
      void this.doTransition(newStatus);
    }
  }

  #freshWinForm(): WinForm {
    return {
      contract_value: 0,
      contract_date: new Date().toISOString().slice(0, 10),
      tranche_count: 2,
      first_pct: 40,
      tranches: [],
      selected_quote_id: '',
      pending_note: '',
    };
  }

  protected buildTranches(): void {
    const { contract_value, tranche_count, first_pct } = this.winForm;
    if (!contract_value || tranche_count < 1) return;
    const tranches: WinTranche[] = [];
    const firstAmt = Math.round(contract_value * (first_pct / 100));
    const remaining = contract_value - firstAmt;
    const restAmt = tranche_count > 1 ? Math.round(remaining / (tranche_count - 1)) : 0;
    const labels = ['Adjudicação', 'Entrega intermédia', 'Conclusão fase', 'Fecho'];
    const today = new Date();
    for (let i = 0; i < tranche_count; i++) {
      const dueDate = new Date(today);
      dueDate.setMonth(today.getMonth() + i * 2);
      tranches.push({
        description: labels[i] ?? `Tranche ${i + 1}`,
        amount: i === 0 ? firstAmt : restAmt,
        due_date: dueDate.toISOString().slice(0, 10),
      });
    }
    // Adjust last tranche for rounding
    if (tranches.length > 1) {
      const sum = tranches.slice(0, -1).reduce((a, t) => a + t.amount, 0);
      tranches[tranches.length - 1].amount = contract_value - sum;
    }
    this.winForm = { ...this.winForm, tranches };
  }

  protected canConfirmWin(): boolean {
    const mode = this.winMode();
    if (mode === 'create') {
      return this.winForm.contract_value > 0 && !!this.winForm.contract_date && this.winForm.tranches.length > 0;
    }
    if (mode === 'quote') return !!this.winForm.selected_quote_id;
    if (mode === 'later') return this.winForm.pending_note.trim().length > 0;
    return false;
  }

  protected cancelWin(): void {
    this.showWinModal.set(false);
  }

  protected async confirmWin(): Promise<void> {
    const lead = this.lead();
    if (!lead) return;
    this.transitioning.set(true);
    try {
      const mode = this.winMode();

      if (mode === 'create') {
        // Create project + tranches
        const { data: proj } = await this.#supabase.from('projects').insert({
          lead_id: lead.id,
          client_id: lead.client_id,
          partner_id: lead.partner_id,
          title: lead.title,
          contract_value: this.winForm.contract_value,
          contract_date: this.winForm.contract_date,
          status: 'em_curso',
        }).select('id').single();

        if (proj) {
          for (const t of this.winForm.tranches) {
            await this.#supabase.from('project_tranches').insert({
              project_id: proj['id'],
              description: t.description,
              amount: t.amount,
              due_date: t.due_date,
            });
          }
        }
        await this.leadService.transition(lead.id, 'fechada_ganha');

      } else if (mode === 'quote') {
        // Invoke Edge Function to convert quote → project
        await this.#supabase.functions.invoke('convert-quote-to-project', {
          body: { quoteId: this.winForm.selected_quote_id, leadId: lead.id },
        });
        await this.leadService.transition(lead.id, 'fechada_ganha');

      } else {
        // Won without project — set pending_conversion flag
        await this.#supabase.from('leads').update({
          pending_conversion: true,
          pending_conversion_note: this.winForm.pending_note,
        }).eq('id', lead.id);
        await this.leadService.transition(lead.id, 'fechada_ganha');
      }

      this.showWinModal.set(false);
      this.loadLead();
    } finally {
      this.transitioning.set(false);
    }
  }

  protected cancelLostReason(): void {
    this.pendingTransition = null;
    this.showLostReasonModal.set(false);
  }

  protected async confirmLostReason(): Promise<void> {
    if (!this.pendingTransition || !this.lostReasonValue.trim()) return;
    await this.doTransition(this.pendingTransition, this.lostReasonValue.trim());
    this.showLostReasonModal.set(false);
  }

  private async doTransition(newStatus: LeadStatus, lostReason?: string): Promise<void> {
    this.transitioning.set(true);
    try {
      await this.leadService.transition(this.leadId(), newStatus, lostReason);
      this.loadLead();
    } finally {
      this.transitioning.set(false);
    }
  }

  protected async submitActivity(): Promise<void> {
    if (this.activityForm.invalid) return;
    const profile = this.authService.currentProfile();
    if (!profile) return;

    this.savingActivity.set(true);
    const { type, content } = this.activityForm.getRawValue();
    try {
      await this.leadService.addActivity(this.leadId(), {
        type: type as LeadActivity['type'],
        content,
        author_id: profile.id,
      });
      this.activityForm.reset({ type: 'nota', content: '' });
      this.loadLead();
    } finally {
      this.savingActivity.set(false);
    }
  }
}
