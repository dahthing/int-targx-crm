import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { ToggleSwitchModule } from 'primeng/toggleswitch';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';

interface RoiBenchmark {
  id: string;
  project_type_id: string;
  label: string;
  description: string | null;
  investment_range_min: number;
  investment_range_max: number;
  avg_payback_months: number;
  avg_revenue_increase_pct: number | null;
  avg_cost_reduction_pct: number | null;
  sample_size: number;
  active: boolean;
}

interface ProjectType {
  id: string;
  name: string;
  slug: string;
}

@Component({
  selector: 'app-roi-benchmarks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputNumberModule, InputTextModule, ToastModule, ToggleSwitchModule],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header" style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h1 class="page-title">ROI Benchmarks</h1>
            <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">
              Dados de retorno de investimento apresentados no portal do cliente
            </p>
          </div>
          <button class="tx-btn-primary" (click)="openCreate()">
            <i class="pi pi-plus mr-2"></i>Novo benchmark
          </button>
        </div>

        <div style="padding:24px">
          <table class="tx-table" style="width:100%">
            <thead>
              <tr>
                <th>Label</th>
                <th>Tipo</th>
                <th>Range investimento</th>
                <th>Payback médio</th>
                <th>Amostra</th>
                <th>Activo</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (b of benchmarks(); track b.id) {
                <tr>
                  <td style="font-weight:500">{{ b.label }}</td>
                  <td style="color:var(--tx-gray-500)">{{ typeName(b.project_type_id) }}</td>
                  <td style="font-size:0.8125rem;color:var(--tx-gray-500)">
                    {{ b.investment_range_min | currency:'EUR':'symbol':'1.0-0':'pt' }} — {{ b.investment_range_max | currency:'EUR':'symbol':'1.0-0':'pt' }}
                  </td>
                  <td style="font-weight:600;color:var(--tx-teal-600)">{{ b.avg_payback_months }} meses</td>
                  <td style="color:var(--tx-gray-500)">{{ b.sample_size }} proj.</td>
                  <td>
                    <p-toggle-switch [(ngModel)]="b.active" (onChange)="toggleActive(b)" />
                  </td>
                  <td>
                    <button class="tx-btn-ghost" style="padding:4px 8px" (click)="openEdit(b)">
                      <i class="pi pi-pencil"></i>
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <p-dialog [header]="editing() ? 'Editar benchmark' : 'Novo benchmark'" [(visible)]="showDialog" [modal]="true" [style]="{width:'520px'}">
      <div style="display:flex;flex-direction:column;gap:16px;padding:8px 0">
        <div class="tx-field">
          <label class="tx-form-label">Label *</label>
          <input pInputText [(ngModel)]="form.label" class="tx-input w-full" placeholder="ex: eCommerce Farmácia" />
        </div>
        <div class="tx-field">
          <label class="tx-form-label">Tipo de projecto *</label>
          <select [(ngModel)]="form.project_type_id" class="tx-input w-full">
            <option value="">Seleccione...</option>
            @for (pt of projectTypes(); track pt.id) {
              <option [value]="pt.id">{{ pt.name }}</option>
            }
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div class="tx-field">
            <label class="tx-form-label">Investimento mín. (€)</label>
            <p-inputnumber [(ngModel)]="form.investment_range_min" [min]="0" styleClass="w-full" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label">Investimento máx. (€)</label>
            <p-inputnumber [(ngModel)]="form.investment_range_max" [min]="0" styleClass="w-full" />
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:12px">
          <div class="tx-field">
            <label class="tx-form-label">Payback médio (meses)</label>
            <p-inputnumber [(ngModel)]="form.avg_payback_months" [min]="0" [maxFractionDigits]="1" styleClass="w-full" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label">Aumento receita (%)</label>
            <p-inputnumber [(ngModel)]="form.avg_revenue_increase_pct" [min]="0" [maxFractionDigits]="1" styleClass="w-full" />
          </div>
          <div class="tx-field">
            <label class="tx-form-label">Redução custos (%)</label>
            <p-inputnumber [(ngModel)]="form.avg_cost_reduction_pct" [min]="0" [maxFractionDigits]="1" styleClass="w-full" />
          </div>
        </div>
        <div class="tx-field">
          <label class="tx-form-label">Nº de projectos na amostra</label>
          <p-inputnumber [(ngModel)]="form.sample_size" [min]="0" styleClass="w-full" />
        </div>
      </div>
      <ng-template #footer>
        <button class="tx-btn-secondary" (click)="showDialog = false">Cancelar</button>
        <button class="tx-btn-primary" (click)="save()">Guardar</button>
      </ng-template>
    </p-dialog>
  `,
})
export class RoiBenchmarksComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #msg = inject(MessageService);

  readonly benchmarks = signal<RoiBenchmark[]>([]);
  readonly projectTypes = signal<ProjectType[]>([]);
  readonly editing = signal<RoiBenchmark | null>(null);

  showDialog = false;
  form: Partial<RoiBenchmark> = {};

  ngOnInit(): void {
    this.#load();
  }

  async #load(): Promise<void> {
    const [bmRes, ptRes] = await Promise.all([
      this.#supabase.from('roi_benchmarks').select('*').order('label'),
      this.#supabase.from('project_types').select('id, name, slug').order('name'),
    ]);
    this.benchmarks.set((bmRes.data ?? []) as RoiBenchmark[]);
    this.projectTypes.set((ptRes.data ?? []) as ProjectType[]);
  }

  typeName(id: string): string {
    return this.projectTypes().find(pt => pt.id === id)?.name ?? '—';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form = { investment_range_min: 0, investment_range_max: 0, avg_payback_months: 0, sample_size: 0 };
    this.showDialog = true;
  }

  openEdit(b: RoiBenchmark): void {
    this.editing.set(b);
    this.form = { ...b };
    this.showDialog = true;
  }

  async save(): Promise<void> {
    const ed = this.editing();
    try {
      if (ed) {
        await this.#supabase.from('roi_benchmarks').update(this.form).eq('id', ed.id);
      } else {
        await this.#supabase.from('roi_benchmarks').insert(this.form);
      }
      this.showDialog = false;
      await this.#load();
      this.#msg.add({ severity: 'success', summary: 'Guardado' });
    } catch {
      this.#msg.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível guardar.' });
    }
  }

  async toggleActive(b: RoiBenchmark): Promise<void> {
    await this.#supabase.from('roi_benchmarks').update({ active: b.active }).eq('id', b.id);
  }
}
