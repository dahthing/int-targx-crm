import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { StepClientPartnerComponent } from './step-client-partner.component';
import { StepProjectTypeComponent } from './step-project-type.component';
import { StepScopingComponent } from './step-scoping.component';
import { StepModulesComponent } from './step-modules.component';
import { StepReviewComponent } from './step-review.component';
import { QuoteService } from '../../../core/services/quote.service';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { ProjectType, ScopingQuestion, CatalogItem, RiskMultiplier, RateProfile } from '../../../core/models/quote.model';
import type { ScopingAnswers } from '../../../core/services/scoping-engine.functions';
import type { ReviewSubmitPayload } from './step-review.component';
import type { ClientPartnerPayload } from './step-client-partner.component';

@Component({
  selector: 'app-quote-wizard',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [
    CommonModule,
    StepperModule,
    ButtonModule,
    ToastModule,
    StepClientPartnerComponent,
    StepProjectTypeComponent,
    StepScopingComponent,
    StepModulesComponent,
    StepReviewComponent,
  ],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header">
          <h1 class="page-title">Novo orçamento</h1>
          <p style="color:var(--tx-gray-500);margin-top:4px;font-size:0.875rem">Siga os passos para configurar o orçamento.</p>
        </div>

        <p-stepper [(value)]="activeStep" styleClass="mt-6">
          <p-step-list>
            <p-step [value]="1">Cliente & Parceiro</p-step>
            <p-step [value]="2">Tipo de projecto</p-step>
            <p-step [value]="3">Scoping</p-step>
            <p-step [value]="4">Módulos</p-step>
            <p-step [value]="5">Revisão</p-step>
          </p-step-list>

          <p-step-panels>
            <!-- Step 1: Client & Partner -->
            <p-step-panel [value]="1">
              <ng-template #content>
                <app-step-client-partner
                  [prefilledClientId]="prefilledClientId"
                  (selectionChanged)="onClientPartnerSelected($event)"
                />
                <div style="display:flex;justify-content:flex-end;padding:0 24px 24px">
                  <button
                    class="tx-btn-primary"
                    [disabled]="!selectedPartnerId() || !selectedClientId()"
                    (click)="activeStep = 2"
                  >
                    Continuar <i class="pi pi-arrow-right" style="margin-left:8px"></i>
                  </button>
                </div>
              </ng-template>
            </p-step-panel>

            <!-- Step 2: Project type -->
            <p-step-panel [value]="2">
              <ng-template #content>
                <app-step-project-type
                  [selected]="selectedProjectType()"
                  (projectTypeSelected)="onProjectTypeSelected($event)"
                />
                <div style="display:flex;justify-content:flex-end;padding:0 24px 24px">
                  <button
                    class="tx-btn-primary"
                    [disabled]="!selectedProjectType()"
                    (click)="activeStep = 3"
                  >
                    Continuar <i class="pi pi-arrow-right" style="margin-left:8px"></i>
                  </button>
                </div>
              </ng-template>
            </p-step-panel>

            <!-- Step 3: Scoping -->
            <p-step-panel [value]="3">
              <ng-template #content>
                @if (selectedProjectType()) {
                  <app-step-scoping
                    [projectType]="selectedProjectType()!"
                    (answersChanged)="scopingAnswers.set($event)"
                    (completed)="onScopingCompleted($event)"
                  />
                }
              </ng-template>
            </p-step-panel>

            <!-- Step 4: Modules -->
            <p-step-panel [value]="4">
              <ng-template #content>
                @if (selectedProjectType() && scopingCompleted()) {
                  <app-step-modules
                    [projectType]="selectedProjectType()!"
                    [answers]="scopingAnswers()"
                    [questions]="scopingQuestions()"
                    [rateProfiles]="rateProfiles()"
                    (selectionChanged)="onModulesChanged($event)"
                  />
                  <div style="display:flex;justify-content:flex-end;padding:0 24px 24px">
                    <button class="tx-btn-primary" (click)="activeStep = 5">
                      Continuar <i class="pi pi-arrow-right" style="margin-left:8px"></i>
                    </button>
                  </div>
                }
              </ng-template>
            </p-step-panel>

            <!-- Step 5: Review -->
            <p-step-panel [value]="5">
              <ng-template #content>
                @if (selectedProjectType() && scopingCompleted()) {
                  <app-step-review
                    [projectType]="selectedProjectType()!"
                    [answers]="scopingAnswers()"
                    [questions]="scopingQuestions()"
                    [activatedModules]="activatedModules()"
                    [optionalModules]="selectedOptionals()"
                    [riskMultipliers]="riskMultipliers()"
                    [rateProfiles]="rateProfiles()"
                    (submitClicked)="onSubmit($event)"
                  />
                }
              </ng-template>
            </p-step-panel>
          </p-step-panels>
        </p-stepper>
      </div>
    </div>
  `,
})
export class QuoteWizardComponent implements OnInit {
  readonly #quoteService = inject(QuoteService);
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #router = inject(Router);
  readonly #route = inject(ActivatedRoute);
  readonly #messageService = inject(MessageService);

  activeStep = 1;
  readonly prefilledClientId = this.#route.snapshot.queryParamMap.get('client_id') ?? '';
  readonly prefilledLeadId = this.#route.snapshot.queryParamMap.get('lead_id') ?? '';

  readonly selectedPartnerId = signal<string>('');
  readonly selectedClientId = signal<string>('');
  readonly selectedProjectType = signal<ProjectType | null>(null);
  readonly scopingAnswers = signal<ScopingAnswers>({});
  readonly scopingQuestions = signal<ScopingQuestion[]>([]);
  readonly scopingCompleted = signal(false);
  readonly activatedModules = signal<CatalogItem[]>([]);
  readonly selectedOptionals = signal<CatalogItem[]>([]);
  readonly riskMultipliers = signal<RiskMultiplier[]>([]);
  readonly rateProfiles = signal<RateProfile[]>([]);

  async ngOnInit(): Promise<void> {
    const [rmRes, rpRes] = await Promise.all([
      this.#supabase
        .from('risk_multipliers')
        .select('*')
        .eq('active', true),
      this.#supabase
        .from('rate_profiles')
        .select('*')
        .eq('active', true),
    ]);
    this.riskMultipliers.set((rmRes.data ?? []) as RiskMultiplier[]);
    this.rateProfiles.set((rpRes.data ?? []) as RateProfile[]);
  }

  onClientPartnerSelected(event: ClientPartnerPayload): void {
    this.selectedPartnerId.set(event.partnerId);
    this.selectedClientId.set(event.clientId);
  }

  onProjectTypeSelected(pt: ProjectType): void {
    this.selectedProjectType.set(pt);
  }

  onScopingCompleted(event: { answers: ScopingAnswers; questions: ScopingQuestion[] }): void {
    this.scopingAnswers.set(event.answers);
    this.scopingQuestions.set(event.questions);
    this.scopingCompleted.set(true);
    this.activeStep = 4;
  }

  onModulesChanged(event: { activated: CatalogItem[]; optionals: CatalogItem[] }): void {
    this.activatedModules.set(event.activated);
    this.selectedOptionals.set(event.optionals);
  }

  async onSubmit(payload: ReviewSubmitPayload): Promise<void> {
    try {
      const quote = await this.#quoteService.create({
        title: payload.title,
        client_id: this.selectedClientId(),
        partner_id: this.selectedPartnerId(),
        lead_id: this.prefilledLeadId || null,
        project_type_id: this.selectedProjectType()?.id ?? null,
        scoping_answers: payload.answers,
        scoping_completed: true,
        risk_multiplier_total: payload.riskMultiplierTotal,
        has_blocking_risk: payload.hasBlockingRisk,
      });

      const allItems = [...payload.activatedModules, ...payload.optionalModules];
      if (allItems.length > 0) {
        await this.#quoteService.savePhasesAndItems(quote.id, [
          {
            name: 'Fase 1',
            description: null,
            phase_order: 1,
            items: allItems.map((item, i) => ({
              name: item.name,
              description: item.description,
              pricing_type: item.pricing_type,
              hours: item.default_hours,
              hourly_rate: payload.resolvedRates[item.id] ?? null,
              unit_value: item.default_value,
              quantity: 1,
              item_order: i + 1,
              optional: payload.optionalModules.some(o => o.id === item.id),
              catalog_item_id: item.id,
              rate_profile_id: item.default_rate_profile_id,
            })),
          },
        ]);
      }

      this.#router.navigate(['/quotes', quote.id, 'build']);
    } catch {
      this.#messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Não foi possível criar o orçamento. Tente novamente.',
      });
    }
  }
}
