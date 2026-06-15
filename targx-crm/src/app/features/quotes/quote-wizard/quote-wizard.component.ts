import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { StepperModule } from 'primeng/stepper';
import { ButtonModule } from 'primeng/button';
import { MessageService } from 'primeng/api';
import { ToastModule } from 'primeng/toast';
import { StepProjectTypeComponent } from './step-project-type.component';
import { StepScopingComponent } from './step-scoping.component';
import { StepModulesComponent } from './step-modules.component';
import { StepReviewComponent } from './step-review.component';
import { QuoteService } from '../../../core/services/quote.service';
import { AuthService } from '../../../core/services/auth.service';
import type { ProjectType, ScopingQuestion, CatalogItem } from '../../../core/models/quote.model';
import type { ScopingAnswers } from '../../../core/services/scoping-engine.functions';
import type { ReviewSubmitPayload } from './step-review.component';

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
          <h1 class="text-h2">Novo orçamento</h1>
          <p class="text-[var(--tx-gray-500)] mt-1">Siga os passos para configurar o orçamento.</p>
        </div>

        <p-stepper [(value)]="activeStep" styleClass="mt-6">
          <p-step-list>
            <p-step [value]="1">Tipo de projecto</p-step>
            <p-step [value]="2">Scoping</p-step>
            <p-step [value]="3">Módulos</p-step>
            <p-step [value]="4">Revisão</p-step>
          </p-step-list>

          <p-step-panels>
            <p-step-panel [value]="1">
              <app-step-project-type
                [selected]="selectedProjectType()"
                (projectTypeSelected)="onProjectTypeSelected($event)"
              />
              <div class="flex justify-end px-6 pb-6">
                <button
                  class="tx-btn-primary"
                  [disabled]="!selectedProjectType()"
                  (click)="activeStep = 2"
                >
                  Continuar <i class="pi pi-arrow-right ml-2"></i>
                </button>
              </div>
            </p-step-panel>

            <p-step-panel [value]="2">
              @if (selectedProjectType()) {
                <app-step-scoping
                  [projectType]="selectedProjectType()!"
                  (answersChanged)="scopingAnswers.set($event)"
                  (completed)="onScopingCompleted($event)"
                />
              }
            </p-step-panel>

            <p-step-panel [value]="3">
              @if (selectedProjectType() && scopingCompleted()) {
                <app-step-modules
                  [projectType]="selectedProjectType()!"
                  [answers]="scopingAnswers()"
                  [questions]="scopingQuestions()"
                  (selectionChanged)="onModulesChanged($event)"
                />
                <div class="flex justify-end px-6 pb-6">
                  <button class="tx-btn-primary" (click)="activeStep = 4">
                    Continuar <i class="pi pi-arrow-right ml-2"></i>
                  </button>
                </div>
              }
            </p-step-panel>

            <p-step-panel [value]="4">
              @if (selectedProjectType() && scopingCompleted()) {
                <app-step-review
                  [projectType]="selectedProjectType()!"
                  [answers]="scopingAnswers()"
                  [questions]="scopingQuestions()"
                  [activatedModules]="activatedModules()"
                  [optionalModules]="selectedOptionals()"
                  (submitClicked)="onSubmit($event)"
                />
              }
            </p-step-panel>
          </p-step-panels>
        </p-stepper>
      </div>
    </div>
  `,
})
export class QuoteWizardComponent {
  readonly #quoteService = inject(QuoteService);
  readonly #authService = inject(AuthService);
  readonly #router = inject(Router);
  readonly #messageService = inject(MessageService);

  activeStep = 1;

  readonly selectedProjectType = signal<ProjectType | null>(null);
  readonly scopingAnswers = signal<ScopingAnswers>({});
  readonly scopingQuestions = signal<ScopingQuestion[]>([]);
  readonly scopingCompleted = signal(false);
  readonly activatedModules = signal<CatalogItem[]>([]);
  readonly selectedOptionals = signal<CatalogItem[]>([]);

  onProjectTypeSelected(pt: ProjectType): void {
    this.selectedProjectType.set(pt);
  }

  onScopingCompleted(event: { answers: ScopingAnswers; questions: ScopingQuestion[] }): void {
    this.scopingAnswers.set(event.answers);
    this.scopingQuestions.set(event.questions);
    this.scopingCompleted.set(true);
    this.activeStep = 3;
  }

  onModulesChanged(event: { activated: CatalogItem[]; optionals: CatalogItem[] }): void {
    this.activatedModules.set(event.activated);
    this.selectedOptionals.set(event.optionals);
  }

  async onSubmit(payload: ReviewSubmitPayload): Promise<void> {
    const profile = this.#authService.currentProfile();
    if (!profile) return;

    try {
      const quote = await this.#quoteService.create({
        title: payload.title,
        client_id: '', // Will be set later in builder
        partner_id: profile.id,
        project_type_id: this.selectedProjectType()?.id ?? null,
        scoping_answers: payload.answers,
        scoping_completed: true,
        risk_multiplier_total: payload.riskMultiplierTotal,
        has_blocking_risk: payload.hasBlockingRisk,
      });

      // Build phases from activated modules
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
              hourly_rate: null,
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
    } catch (err) {
      this.#messageService.add({
        severity: 'error',
        summary: 'Erro',
        detail: 'Não foi possível criar o orçamento. Tente novamente.',
      });
    }
  }
}
