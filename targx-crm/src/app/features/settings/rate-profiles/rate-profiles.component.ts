import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import type { RateProfile } from '../../../core/models/quote.model';

@Component({
  selector: 'app-rate-profiles',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ToastModule],
  template: `
    <p-toast />
    <div class="p-6">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Perfis de taxa horária</h1>
          <p class="text-body-sm text-[var(--tx-gray-400)] mt-1">Configurar perfis de preço por hora para os itens do orçamento.</p>
        </div>
        <button class="tx-btn-primary" (click)="addRow()">
          <i class="pi pi-plus mr-2"></i>Novo perfil
        </button>
      </div>

      @if (loading()) {
        <div class="tx-card p-8 flex items-center justify-center">
          <i class="pi pi-spin pi-spinner text-[var(--tx-teal-500)] text-xl"></i>
        </div>
      }

      @if (!loading()) {
        <div class="tx-card overflow-hidden">
          <table class="tx-table w-full">
            <thead>
              <tr>
                <th class="text-left pl-4">Nome</th>
                <th class="text-right">Taxa/hora (€)</th>
                <th class="text-center">Activo</th>
                <th class="w-20"></th>
              </tr>
            </thead>
            <tbody>
              @for (row of rows(); track row.id ?? row._tempKey) {
                <tr class="border-t border-[var(--tx-gray-200)]">
                  <td class="pl-4 py-2">
                    <input
                      class="tx-input w-full"
                      [(ngModel)]="row.name"
                      placeholder="Nome do perfil"
                      [attr.aria-label]="'Nome do perfil'"
                    />
                  </td>
                  <td class="py-2 px-3">
                    <input
                      type="number"
                      class="tx-input w-full text-right font-mono"
                      [(ngModel)]="row.hourly_rate"
                      min="0"
                      step="5"
                      [attr.aria-label]="'Taxa horária'"
                    />
                  </td>
                  <td class="py-2 text-center">
                    <input type="checkbox" [(ngModel)]="row.active" [attr.aria-label]="'Activo'" />
                  </td>
                  <td class="py-2 pr-3">
                    <div class="flex justify-end gap-1">
                      <button
                        class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center"
                        (click)="saveRow(row)"
                        [attr.aria-label]="'Guardar'"
                      >
                        <i class="pi pi-check text-xs text-[var(--tx-teal-600)]"></i>
                      </button>
                      @if (row.id) {
                        <button
                          class="tx-btn-ghost w-8 h-8 p-0 flex items-center justify-center text-[var(--tx-danger)]"
                          (click)="deleteRow(row)"
                          [attr.aria-label]="'Eliminar'"
                        >
                          <i class="pi pi-trash text-xs"></i>
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </table>
          @if (rows().length === 0) {
            <div class="p-8 text-center text-[var(--tx-gray-400)]">Sem perfis de taxa.</div>
          }
        </div>
      }
    </div>
  `,
})
export class RateProfilesComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly rows = signal<(Partial<RateProfile> & { _tempKey?: string })[]>([]);

  async ngOnInit(): Promise<void> { await this.#load(); }

  addRow(): void {
    this.rows.update(r => [...r, { _tempKey: crypto.randomUUID(), name: '', hourly_rate: 0, active: true }]);
  }

  async saveRow(row: Partial<RateProfile> & { _tempKey?: string }): Promise<void> {
    if (!row.name) return;
    try {
      if (row.id) {
        await this.#supabase.from('rate_profiles').update({ name: row.name, hourly_rate: row.hourly_rate, active: row.active }).eq('id', row.id);
      } else {
        await this.#supabase.from('rate_profiles').insert({ name: row.name, hourly_rate: row.hourly_rate ?? 0, active: row.active ?? true });
      }
      this.#messageService.add({ severity: 'success', summary: 'Guardado', detail: 'Perfil guardado.' });
      await this.#load();
    } catch {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: 'Erro ao guardar.' });
    }
  }

  async deleteRow(row: Partial<RateProfile>): Promise<void> {
    if (!row.id) return;
    await this.#supabase.from('rate_profiles').delete().eq('id', row.id);
    await this.#load();
  }

  async #load(): Promise<void> {
    this.loading.set(true);
    const { data } = await this.#supabase.from('rate_profiles').select('*').order('name');
    this.rows.set((data ?? []) as RateProfile[]);
    this.loading.set(false);
  }
}
