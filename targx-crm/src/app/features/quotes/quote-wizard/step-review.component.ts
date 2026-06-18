import {
  ChangeDetectionStrategy,
  Component,
  output,
  signal,
  input,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { InputTextModule } from 'primeng/inputtext';
import { detectRisks, calculateTotalMultiplier, hasBlockingRisk as checkBlockingRisk } from '../../../core/services/risk-engine.functions';
import { calculateQuoteTotals } from '../../../core/services/quote-calculator.functions';
import type { ProjectType, ScopingQuestion, CatalogItem, RiskMultiplier, RateProfile } from '../../../core/models/quote.model';
import type { ScopingAnswers } from '../../../core/services/scoping-engine.functions';
import type { DetectedRisk } from '../../../core/services/risk-engine.functions';

export interface ReviewSubmitPayload {
  title: string;
  answers: ScopingAnswers;
  risks: DetectedRisk[];
  riskMultiplierTotal: number;
  hasBlockingRisk: boolean;
  activatedModules: CatalogItem[];
  optionalModules: CatalogItem[];
  /** map of catalogItem.id → resolved hourly_rate (for saving to quote_items) */
  resolvedRates: Record<string, number>;
}

@Component({
  selector: 'app-step-review',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, InputTextModule],
  template: `
    <div class="p-6">
      <h2 class="text-h3 mb-2">Revisão e criação</h2>
      <p class="text-[var(--tx-gray-500)] mb-6">Confirme o orçamento antes de criar.</p>

      <div class="flex flex-col gap-6">
        <!-- Title -->
        <div class="tx-field">
          <label class="tx-form-label">Título do orçamento <span class="text-red-500">*</span></label>
          <input
            pInputText
            [(ngModel)]="title"
            class="tx-input w-full"
            placeholder="Ex: Website institucional — Empresa X"
          />
        </div>

        <!-- Scoping summary -->
        <div class="tx-card p-4">
          <h3 class="font-semibold text-[var(--tx-gray-700)] mb-3">Respostas de scoping</h3>
          <div class="grid grid-cols-2 gap-2">
            @for (q of questions(); track q.id) {
              @if (answers()[q.key] !== undefined && answers()[q.key] !== null) {
                <div class="text-sm">
                  <span class="text-[var(--tx-gray-500)]">{{ q.label }}:</span>
                  <span class="ml-1 font-medium text-[var(--tx-gray-800)]">
                    {{ formatAnswer(answers()[q.key]) }}
                  </span>
                </div>
              }
            }
          </div>
        </div>

        <!-- Risks -->
        @if (risks().length > 0) {
          <div class="tx-card p-4">
            <h3 class="font-semibold text-[var(--tx-gray-700)] mb-3">Riscos detectados</h3>
            <div class="flex flex-wrap gap-2 mb-3">
              @for (risk of risks(); track risk.key) {
                <span class="tx-badge" [ngClass]="riskBadgeClass(risk)">
                  {{ risk.name }}
                  @if (risk.is_blocking) {
                    <i class="pi pi-exclamation-triangle ml-1"></i>
                  }
                </span>
              }
            </div>
            <div class="font-mono text-sm text-[var(--tx-gray-600)]">
              Multiplicador total: <strong class="text-[var(--tx-gold)]">×{{ riskMultiplierTotal() | number:'1.2-2' }}</strong>
            </div>
            @if (hasBlockingRisk()) {
              <div class="mt-2 text-sm text-red-600 font-medium">
                <i class="pi pi-exclamation-circle mr-1"></i>
                Existem riscos bloqueantes. Necessário aprovação de administrador.
              </div>
            }
          </div>
        }

        <!-- Financial breakdown -->
        <div class="tx-card p-4">
          <h3 class="font-semibold text-[var(--tx-gray-700)] mb-3">Resumo financeiro</h3>
          <div class="flex flex-col gap-2 font-mono text-sm">
            <div class="flex justify-between">
              <span class="text-[var(--tx-gray-500)]">Subtotal base</span>
              <span>{{ formatCurrency(totals().subtotal_base) }}</span>
            </div>
            @if (totals().risk_adjustment > 0) {
              <div class="flex justify-between text-[var(--tx-gold)]">
                <span>Ajuste de risco</span>
                <span>+ {{ formatCurrency(totals().risk_adjustment) }}</span>
              </div>
            }
            <div class="flex justify-between border-t border-[var(--tx-gray-200)] pt-2 font-semibold">
              <span>Total s/IVA</span>
              <span>{{ formatCurrency(totals().total_before_tax) }}</span>
            </div>
            <div class="flex justify-between text-[var(--tx-gray-400)]">
              <span>IVA (23%)</span>
              <span>{{ formatCurrency(totals().total_with_tax - totals().total_before_tax) }}</span>
            </div>
            <div class="flex justify-between text-lg font-bold text-[var(--tx-teal-700)] border-t border-[var(--tx-gray-200)] pt-2">
              <span>Total c/IVA</span>
              <span>{{ formatCurrency(totals().total_with_tax) }}</span>
            </div>
          </div>
        </div>

        @if (error()) {
          <div class="text-red-600 text-sm">{{ error() }}</div>
        }

        <div class="flex justify-end">
          <button
            class="tx-btn-primary"
            [disabled]="submitting() || !title"
            (click)="submit()"
          >
            @if (submitting()) {
              <i class="pi pi-spin pi-spinner mr-2"></i>A criar...
            } @else {
              <i class="pi pi-check mr-2"></i>Criar orçamento
            }
          </button>
        </div>
      </div>
    </div>
  `,
})
export class StepReviewComponent {
  readonly projectType = input.required<ProjectType>();
  readonly answers = input.required<ScopingAnswers>();
  readonly questions = input.required<ScopingQuestion[]>();
  readonly activatedModules = input.required<CatalogItem[]>();
  readonly optionalModules = input.required<CatalogItem[]>();
  readonly riskMultipliers = input<RiskMultiplier[]>([]);
  readonly rateProfiles = input<RateProfile[]>([]);
  readonly submitClicked = output<ReviewSubmitPayload>();

  readonly submitting = signal(false);
  readonly error = signal<string | null>(null);
  title = '';

  readonly risks = computed<DetectedRisk[]>(() =>
    detectRisks(this.answers(), this.questions(), this.riskMultipliers())
  );

  readonly riskMultiplierTotal = computed(() => calculateTotalMultiplier(this.risks()));

  readonly hasBlockingRisk = computed(() => checkBlockingRisk(this.risks()));

  readonly resolvedRates = computed<Record<string, number>>(() => {
    const profiles = this.rateProfiles();
    const allItems = [...this.activatedModules(), ...this.optionalModules()];
    return Object.fromEntries(
      allItems.map(item => {
        const profile = profiles.find(rp => rp.id === item.default_rate_profile_id);
        return [item.id, profile?.hourly_rate ?? 75];
      })
    );
  });

  readonly totals = computed(() => {
    const rates = this.resolvedRates();
    const allItems = [...this.activatedModules(), ...this.optionalModules()].map((item, i) => ({
      id: `tmp-${i}`,
      phase_id: 'tmp',
      catalog_item_id: item.id,
      name: item.name,
      description: item.description,
      pricing_type: item.pricing_type,
      hours: item.default_hours,
      rate_profile_id: item.default_rate_profile_id,
      hourly_rate: rates[item.id] ?? 75,
      unit_value: item.default_value,
      quantity: 1,
      item_order: i + 1,
      optional: false,
      optional_accepted: false,
      created_at: '',
      updated_at: '',
    }));

    return calculateQuoteTotals(
      [],
      allItems,
      0,
      this.riskMultiplierTotal(),
      this.projectType().minimum_price,
      23
    );
  });

  submit(): void {
    if (!this.title.trim()) {
      this.error.set('O título é obrigatório.');
      return;
    }
    this.error.set(null);
    this.submitClicked.emit({
      title: this.title.trim(),
      answers: this.answers(),
      risks: this.risks(),
      riskMultiplierTotal: this.riskMultiplierTotal(),
      hasBlockingRisk: this.hasBlockingRisk(),
      activatedModules: this.activatedModules(),
      optionalModules: this.optionalModules(),
      resolvedRates: this.resolvedRates(),
    });
  }

  riskBadgeClass(risk: DetectedRisk & { category?: string }): string {
    // We'll extend DetectedRisk with category from the caller if needed
    return risk.is_blocking ? 'tx-badge-red' : 'tx-badge-gold';
  }

  formatAnswer(value: unknown): string {
    if (Array.isArray(value)) return value.join(', ');
    if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
    return String(value ?? '—');
  }

  formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'EUR' }).format(value);
  }
}
