import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  output,
  signal,
  input,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputNumberModule } from 'primeng/inputnumber';
import { SliderModule } from 'primeng/slider';
import { TextareaModule } from 'primeng/textarea';
import { MessageModule } from 'primeng/message';
import { CheckboxModule } from 'primeng/checkbox';
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
    InputNumberModule,
    SliderModule,
    TextareaModule,
    MessageModule,
    CheckboxModule,
  ],
  styles: [`
    .radio-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid var(--tx-gray-200);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
      background: white;
    }
    .radio-option:hover {
      border-color: var(--tx-teal-400);
      background: var(--tx-gray-050);
    }
    .radio-option.selected {
      border-color: var(--tx-teal-500);
      background: color-mix(in srgb, var(--tx-teal-500) 6%, white);
    }
    .radio-dot {
      width: 18px;
      height: 18px;
      border-radius: 50%;
      border: 2px solid var(--tx-gray-300);
      flex-shrink: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: border-color 0.15s ease;
    }
    .radio-option.selected .radio-dot {
      border-color: var(--tx-teal-500);
    }
    .radio-dot-inner {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--tx-teal-500);
    }
    .check-option {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 14px;
      border: 1px solid var(--tx-gray-200);
      border-radius: 8px;
      cursor: pointer;
      transition: border-color 0.15s ease, background 0.15s ease;
      background: white;
    }
    .check-option:hover {
      border-color: var(--tx-teal-400);
      background: var(--tx-gray-050);
    }
    .check-option.selected {
      border-color: var(--tx-teal-500);
      background: color-mix(in srgb, var(--tx-teal-500) 6%, white);
    }
    .scale-labels {
      display: flex;
      justify-content: space-between;
      font-size: 0.75rem;
      color: var(--tx-gray-400);
      margin-top: 4px;
    }
    .toggle-group {
      display: flex;
      gap: 8px;
    }
    .toggle-btn {
      padding: 8px 20px;
      border-radius: 8px;
      border: 1px solid var(--tx-gray-200);
      background: white;
      cursor: pointer;
      font-size: 0.875rem;
      font-weight: 500;
      transition: all 0.15s ease;
      color: var(--tx-gray-600);
    }
    .toggle-btn:hover {
      border-color: var(--tx-teal-400);
    }
    .toggle-btn.active {
      border-color: var(--tx-teal-500);
      background: var(--tx-teal-500);
      color: white;
    }
  `],
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
                @if (q.required) { <span class="text-[var(--tx-red-500,red)]">*</span> }
              </label>
              @if (q.description) {
                <p class="text-sm text-[var(--tx-gray-400)] mb-2">{{ q.description }}</p>
              }

              @switch (q.question_type) {

                @case ('single_choice') {
                  <div class="flex flex-col gap-2">
                    @for (opt of choicesFor(q); track opt) {
                      <div
                        class="radio-option"
                        [class.selected]="answers()[q.key] === opt"
                        (click)="onAnswerChange(q.key, opt)"
                        role="radio"
                        [attr.aria-checked]="answers()[q.key] === opt"
                      >
                        <div class="radio-dot">
                          @if (answers()[q.key] === opt) {
                            <div class="radio-dot-inner"></div>
                          }
                        </div>
                        <span class="text-[var(--tx-gray-800)] text-sm">{{ opt }}</span>
                      </div>
                    }
                  </div>
                }

                @case ('multi_select') {
                  <div class="flex flex-col gap-2">
                    @for (opt of choicesFor(q); track opt) {
                      <div
                        class="check-option"
                        [class.selected]="isChecked(q.key, opt)"
                        (click)="toggleMulti(q.key, opt)"
                        role="checkbox"
                        [attr.aria-checked]="isChecked(q.key, opt)"
                      >
                        <p-checkbox
                          [ngModel]="isChecked(q.key, opt)"
                          [binary]="true"
                          (click)="$event.stopPropagation()"
                          (ngModelChange)="toggleMulti(q.key, opt)"
                        />
                        <span class="text-[var(--tx-gray-800)] text-sm">{{ opt }}</span>
                      </div>
                    }
                  </div>
                }

                @case ('numeric') {
                  <p-inputnumber
                    [ngModel]="toNumber(answers()[q.key])"
                    (ngModelChange)="onAnswerChange(q.key, $event)"
                    styleClass="w-full"
                    [min]="numMin(q)"
                    [max]="numMax(q)"
                    [showButtons]="true"
                  />
                }

                @case ('complexity_scale') {
                  <div class="flex flex-col gap-3">
                    <p-slider
                      [ngModel]="toNumber(answers()[q.key]) || 1"
                      (ngModelChange)="onAnswerChange(q.key, $event)"
                      [min]="1"
                      [max]="5"
                      styleClass="w-full"
                    />
                    <div class="scale-labels">
                      <span>Simples</span>
                      <span class="font-mono font-semibold text-[var(--tx-teal-600)]">
                        Nível {{ toNumber(answers()[q.key]) || 1 }}/5
                      </span>
                      <span>Muito complexo</span>
                    </div>
                  </div>
                }

                @case ('risk_indicator') {
                  <div class="toggle-group">
                    <button
                      type="button"
                      class="toggle-btn"
                      [class.active]="answers()[q.key] === true"
                      (click)="onAnswerChange(q.key, true)"
                    >
                      <i class="pi pi-check mr-1"></i>Sim
                    </button>
                    <button
                      type="button"
                      class="toggle-btn"
                      [class.active]="answers()[q.key] === false || answers()[q.key] === undefined"
                      (click)="onAnswerChange(q.key, false)"
                    >
                      <i class="pi pi-times mr-1"></i>Não
                    </button>
                  </div>
                }

                @case ('text') {
                  <textarea
                    pTextarea
                    [ngModel]="toString(answers()[q.key])"
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
        const defaults: ScopingAnswers = {};
        for (const q of this.questions()) {
          if (q.question_type === 'complexity_scale') defaults[q.key] = 1;
          if (q.question_type === 'risk_indicator') defaults[q.key] = false;
          if (q.question_type === 'multi_select') defaults[q.key] = [];
        }
        this.answers.set(defaults);
        this.loading.set(false);
      });
  }

  onAnswerChange(key: string, value: unknown): void {
    this.answers.update(prev => ({ ...prev, [key]: value }));
    this.answersChanged.emit(this.answers());
  }

  toggleMulti(key: string, opt: string): void {
    const current = (this.answers()[key] as string[]) ?? [];
    const next = current.includes(opt)
      ? current.filter(v => v !== opt)
      : [...current, opt];
    this.onAnswerChange(key, next);
  }

  isChecked(key: string, opt: string): boolean {
    const val = this.answers()[key];
    return Array.isArray(val) && val.includes(opt);
  }

  /** options.choices: string[] */
  choicesFor(q: ScopingQuestion): string[] {
    if (!q.options) return [];
    const opts = q.options as Record<string, unknown>;
    const choices = opts['choices'];
    return Array.isArray(choices) ? (choices as string[]) : [];
  }

  numMin(q: ScopingQuestion): number {
    const opts = q.options as Record<string, unknown> | null;
    return typeof opts?.['min'] === 'number' ? (opts['min'] as number) : 0;
  }

  numMax(q: ScopingQuestion): number {
    const opts = q.options as Record<string, unknown> | null;
    return typeof opts?.['max'] === 'number' ? (opts['max'] as number) : 9999;
  }

  toNumber(v: unknown): number {
    return typeof v === 'number' ? v : Number(v) || 0;
  }

  toString(v: unknown): string {
    return v == null ? '' : String(v);
  }

  continuar(): void {
    const result = validateCompleteness(this.answers(), this.questions());
    if (!result.valid) {
      const qs = this.questions();
      this.errors.set(
        result.missing.map(key => {
          const q = qs.find(q => q.key === key);
          return q ? `"${q.label}" é obrigatório.` : `Campo "${key}" é obrigatório.`;
        })
      );
      return;
    }
    this.errors.set([]);
    this.completed.emit({ answers: this.answers(), questions: this.questions() });
  }
}
