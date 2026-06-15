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
import { Lead, LeadActivity, LeadStatus } from '../../../core/models/lead.model';
import { StatusBadgeComponent } from '../../../shared/components/status-badge/status-badge.component';
import { SilenceWarningComponent } from '../../../shared/components/silence-warning/silence-warning.component';
import { ObjectionPanelComponent } from '../../knowledge/objection-panel/objection-panel.component';

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

                <!-- Quotes tab (Phase 3 placeholder) -->
                <p-tabpanel value="quotes">
                  <div class="tx-card p-8 text-center">
                    <p class="text-tx-gray-500">Módulo TIQS — Fase 3</p>
                  </div>
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

      <!-- Objections panel -->
      <app-objection-panel [(visible)]="showObjections" />
    }
  `,
})
export class LeadDetailComponent implements OnInit {
  private readonly leadService = inject(LeadService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  // Route param via withComponentInputBinding
  readonly leadId = input.required<string>();

  protected readonly loading = signal(false);
  protected readonly lead = signal<LeadWithActivities | null>(null);
  protected readonly activities = computed(() => this.lead()?.activities ?? []);
  protected readonly savingActivity = signal(false);
  protected readonly transitioning = signal(false);
  protected readonly showObjections = signal(false);
  protected readonly showLostReasonModal = signal(false);
  protected lostReasonValue = '';
  protected pendingTransition: LeadStatus | null = null;

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
        },
        error: () => this.loading.set(false),
      });
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
    } else {
      this.doTransition(newStatus);
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
