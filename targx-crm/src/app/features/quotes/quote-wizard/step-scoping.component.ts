import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
  signal,
  input,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectButtonModule } from 'primeng/selectbutton';
import { MultiSelectModule } from 'primeng/multiselect';
import { InputNumberModule } from 'primeng/inputnumber';
import { SliderModule } from 'primeng/slider';
import { ToggleButtonModule } from 'primeng/togglebutton';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { validateCompleteness } from '../../../core/services/scoping-engine.functions';
import type { ProjectType, ScopingQuestion } from '../../../core/models/quote.model';
import type { ScopingAnswers } from '../../../core/services/scoping-engine.functions';

@Component({
  selector: 'app-step-scoping',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CommonModule,
    FormsModule,
    SelectButtonModule,
    MultiSelectModule,
    InputNumberModule,
    SliderModule,
    ToggleButtonModule,
    TextareaModule,
    MessageModule,
  ],
  template: `
    <div class="p-6">
      <h2 class="text-h3 mb-2">Detalhe do projecto</h2>
      <p class="text-[var(--tx-gray-500)] mb-6">Responda às perguntas para configurar o orçamento.</p>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <i class="pi pi-spin pi-spinner text-3xl text-[var(--tx-teal-500)]"></i>
        </div>
      } @else {
        <div class="flex flex-col gap-6">
          @for (q of questions(); track q.id) {
            <div class="tx-field">
              <label class="tx-form-label">
                {{ q.label }}
                @if (q.required) { <span class="text-[var(--tx-red-500)]">*</span> }
              </label>
              @if (q.description) {
                <p class="text-sm text-[var(--tx-gray-400)] mb-2">{{ q.description }}</p>
              }

              @switch (q.question_type) {
                @case ('single_choice') {
                  <p-selectbutton
                    [options]="optionsFor(q)"
                    [(ngModel)]="answers()[q.key]"
                    (ngModelChange)="onAnswerChange(q.key, $event)"
                    optionLabel="label"
                    optionValue="value"
                  />
                }
                @case ('multi_select') {
                  <p-multiselect
                    [options]="optionsFor(q)"
                    [(ngModel)]="answers()[q.key]"
                    (ngModelChange)="onAnswerChange(q.key, $event)"
                    optionLabel="label"
                    optionValue="value"
                    styleClass="w-full"
                    placeholder="Seleccionar..."
                  />
                }
                @case ('numeric') {
                  <p-inputnumber
                    [(ngModel)]="answers()[q.key]"
                    (ngModelChange)="onAnswerChange(q.key, $event)"
                    styleClass="w-full"
                  />
                }
                @case ('complexity_scale') {
                  <div class="flex flex-col gap-2">
                    <p-slider
                      [(ngModel)]="answers()[q.key]"
                      (ngModelChange)="onAnswerChange(q.key, $event)"
                      [min]="1"
                      [max]="5"
                      styleClass="w-full"
                    />
                    <span class="text-sm font-mono text-[var(--tx-teal-600)]">
                      Nível: {{ answers()[q.key] ?? 1 }}/5
                    </span>
                  </div>
                }
                @case ('risk_indicator') {
                  <p-togglebutton
                    [(ngModel)]="answers()[q.key]"
                    (ngModelChange)="onAnswerChange(q.key, $event)"
                    onLabel="Sim"
                    offLabel="Não"
                  />
                }
                @case ('text') {
                  <textarea
                    pTextarea
                    [(ngModel)]="answers()[q.key]"
                    (ngModelChange)="onAnswerChange(q.key, $event)"
                    rows="3"
                    class="tx-input w-full"
                    placeholder="Nota opcional..."
                  ></textarea>
                }
              }
            </div>
          }

          @if (errors().length > 0) {
            <div class="flex flex-col gap-2">
              @for (err of errors(); track err) {
                <p-message severity="error" [text]="err" />
              }
            </div>
          }

          <div class="flex justify-end mt-4">
            <button class="tx-btn-primary" (click)="continuar()">
              Continuar <i class="pi pi-arrow-right ml-2"></i>
            </button>
          </div>
        </div>
      }
    </div>
  `,
})
export class StepScopingComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);

  readonly projectType = input.required<ProjectType>();
  readonly answersChanged = output<ScopingAnswers>();
  readonly completed = output<{ answers: ScopingAnswers; questions: ScopingQuestion[] }>();

  readonly questions = signal<ScopingQuestion[]>([]);
  readonly answers = signal<ScopingAnswers>({});
  readonly errors = signal<string[]>([]);
  readonly loading = signal(true);

  ngOnInit(): void {
    this.#loadQuestions();
  }

  #loadQuestions(): void {
    this.#supabase
      .from('scoping_questions')
      .select('*')
      .eq('project_type_id', this.projectType().id)
      .order('sort_order', { ascending: true })
      .then(({ data }) => {
        this.questions.set((data ?? []) as ScopingQuestion[]);
        // Init defaults
        const defaults: ScopingAnswers = {};
        for (const q of this.questions()) {
          if (q.question_type === 'complexity_scale') defaults[q.key] = 1;
          if (q.question_type === 'risk_indicator') defaults[q.key] = false;
        }
        this.answers.set(defaults);
        this.loading.set(false);
      });
  }

  onAnswerChange(key: string, value: unknown): void {
    this.answers.update(prev => ({ ...prev, [key]: value }));
    this.answersChanged.emit(this.answers());
  }

  continuar(): void {
    const result = validateCompleteness(this.answers(), this.questions());
    if (!result.valid) {
      const qs = this.questions();
      const missingLabels = result.missing.map(key => {
        const q = qs.find(q => q.key === key);
        return q ? `"${q.label}" é obrigatório.` : `Campo "${key}" é obrigatório.`;
      });
      this.errors.set(missingLabels);
      return;
    }
    this.errors.set([]);
    this.completed.emit({ answers: this.answers(), questions: this.questions() });
  }

  optionsFor(q: ScopingQuestion): { label: string; value: string }[] {
    if (!q.options) return [];
    const opts = q.options as Record<string, string>;
    return Object.entries(opts).map(([value, label]) => ({ label, value }));
  }
}
