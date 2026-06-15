import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';

interface GlobalSetting {
  key: string;
  value: string;
  description: string;
  label: string;
  type: 'number' | 'percentage';
  saving: boolean;
  dirty: boolean;
  editValue: string;
}

const SETTING_META: Record<string, { label: string; description: string; type: 'number' | 'percentage' }> = {
  lead_silence_warning_days: {
    label: 'Dias de silêncio (alerta)',
    description: 'Número de dias sem actividade antes de alertar o parceiro.',
    type: 'number',
  },
  fixed_item_cost_proxy_pct: {
    label: 'Custo proxy item fixo (%)',
    description: 'Percentagem do preço de venda usada como custo estimado dos itens fixos.',
    type: 'percentage',
  },
  default_tax_rate_pct: {
    label: 'Taxa de IVA padrão (%)',
    description: 'Taxa de IVA aplicada por defeito nos orçamentos.',
    type: 'percentage',
  },
  minimum_margin_pct: {
    label: 'Margem mínima (%)',
    description: 'Margem mínima aceitável nos orçamentos. Abaixo deste valor, alerta é gerado.',
    type: 'percentage',
  },
  quote_validity_days: {
    label: 'Validade do orçamento (dias)',
    description: 'Número de dias em que um orçamento enviado ao cliente é válido.',
    type: 'number',
  },
  daily_capacity_hours: {
    label: 'Capacidade diária (horas)',
    description: 'Horas de trabalho produtivo por dia, usado no Gantt para cálculo de durações.',
    type: 'number',
  },
};

@Component({
  selector: 'app-global-settings',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-h2" style="color: var(--tx-gray-950)">Configurações Globais</h1>
        <p class="text-body-sm mt-1" style="color: var(--text-secondary)">
          Parâmetros do sistema aplicados a todos os parceiros e orçamentos.
        </p>
      </div>

      @if (loading()) {
        <div class="tx-card py-12 text-center">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else {
        <div class="tx-card overflow-hidden">
          <table class="tx-table w-full">
            <thead>
              <tr>
                <th class="w-64">Parâmetro</th>
                <th>Descrição</th>
                <th class="w-40 text-right">Valor</th>
                <th class="w-28"></th>
              </tr>
            </thead>
            <tbody>
              @for (setting of settings(); track setting.key) {
                <tr>
                  <td class="font-semibold" style="color: var(--tx-gray-900)">{{ setting.label }}</td>
                  <td style="color: var(--text-secondary)">{{ setting.description }}</td>
                  <td class="text-right">
                    <div class="flex items-center justify-end gap-1">
                      <input
                        type="number"
                        class="tx-input text-right w-24"
                        [ngModel]="setting.editValue"
                        (ngModelChange)="onValueChange(setting, $event)"
                        [min]="0"
                        [step]="setting.type === 'percentage' ? 0.5 : 1"
                        [attr.aria-label]="setting.label"
                      />
                      @if (setting.type === 'percentage') {
                        <span style="color: var(--text-muted)">%</span>
                      }
                    </div>
                  </td>
                  <td class="text-right">
                    <button
                      class="tx-btn-primary text-sm px-3 py-1.5"
                      [disabled]="!setting.dirty || setting.saving"
                      (click)="save(setting)"
                    >
                      @if (setting.saving) {
                        <i class="pi pi-spin pi-spinner mr-1"></i>
                      }
                      Guardar
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class GlobalSettingsComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);
  readonly #destroyed = takeUntilDestroyed();

  readonly loading = signal(true);
  readonly settings = signal<GlobalSetting[]>([]);

  ngOnInit(): void {
    void this.#load();
  }

  async #load(): Promise<void> {
    const { data, error } = await this.#supabase
      .from('global_settings')
      .select('key, value');

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
      this.loading.set(false);
      return;
    }

    const rows = (data ?? []) as Array<{ key: string; value: string }>;
    const mapped: GlobalSetting[] = Object.entries(SETTING_META).map(([key, meta]) => {
      const row = rows.find(r => r.key === key);
      const value = row?.value ?? '0';
      return {
        key,
        value,
        editValue: value,
        label: meta.label,
        description: meta.description,
        type: meta.type,
        saving: false,
        dirty: false,
      };
    });

    this.settings.set(mapped);
    this.loading.set(false);
  }

  onValueChange(setting: GlobalSetting, newVal: string): void {
    this.settings.update(list =>
      list.map(s => s.key === setting.key
        ? { ...s, editValue: newVal, dirty: newVal !== s.value }
        : s
      )
    );
  }

  async save(setting: GlobalSetting): Promise<void> {
    this.settings.update(list =>
      list.map(s => s.key === setting.key ? { ...s, saving: true } : s)
    );

    const { error } = await this.#supabase
      .from('global_settings')
      .upsert({ key: setting.key, value: setting.editValue });

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
    } else {
      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: `${setting.label} actualizado.` });
    }

    this.settings.update(list =>
      list.map(s => s.key === setting.key
        ? { ...s, saving: false, dirty: false, value: s.editValue }
        : s
      )
    );
  }
}
