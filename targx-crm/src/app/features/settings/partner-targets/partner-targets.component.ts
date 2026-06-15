import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/services/auth.service';
import { Profile } from '../../../core/models/profile.model';

interface PartnerTarget {
  id?: string;
  partner_id: string;
  year: number;
  quarter: 1 | 2 | 3 | 4;
  target_volume: number | null;
  created_by?: string;
  created_at?: string;
}

type QuarterMap = Record<1 | 2 | 3 | 4, number | null>;
type TargetGrid = Record<string, QuarterMap>;

const QUARTERS: Array<1 | 2 | 3 | 4> = [1, 2, 3, 4];
const CURRENT_YEAR = new Date().getFullYear();

@Component({
  selector: 'app-partner-targets',
  standalone: true,
  imports: [CommonModule, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <!-- Page header -->
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-h2 text-[var(--tx-gray-950)]">Metas Trimestrais</h1>
          <p class="text-body-sm text-[var(--tx-gray-600)] mt-1">
            Define os objectivos de volume de negócio por parceiro e trimestre.
          </p>
        </div>

        <!-- Year selector -->
        <div class="flex items-center gap-2">
          <button
            class="tx-btn-ghost w-8 h-8 flex items-center justify-center rounded"
            (click)="changeYear(-1)"
            aria-label="Ano anterior"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span class="text-body font-semibold text-[var(--tx-blue-900)] min-w-[3rem] text-center">
            {{ selectedYear() }}
          </span>
          <button
            class="tx-btn-ghost w-8 h-8 flex items-center justify-center rounded"
            (click)="changeYear(1)"
            aria-label="Próximo ano"
          >
            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Loading state -->
      @if (loading()) {
        <div class="tx-card p-8 flex items-center justify-center">
          <span class="text-body text-[var(--tx-gray-400)]">A carregar parceiros...</span>
        </div>
      }

      <!-- Error state -->
      @if (error()) {
        <div class="tx-card p-4 border-[var(--tx-danger)] bg-red-50">
          <p class="text-body-sm text-[var(--tx-danger)]">{{ error() }}</p>
        </div>
      }

      <!-- Targets grid -->
      @if (!loading() && !error() && partners().length > 0) {
        <div class="tx-card overflow-hidden">
          <table class="tx-table w-full">
            <thead>
              <tr>
                <th class="text-left px-4 py-3 text-[var(--tx-gray-600)] font-medium text-body-sm">
                  Parceiro
                </th>
                @for (q of quarters; track q) {
                  <th class="text-center px-4 py-3 text-[var(--tx-gray-600)] font-medium text-body-sm min-w-[140px]">
                    T{{ q }} {{ selectedYear() }}
                  </th>
                }
              </tr>
            </thead>
            <tbody>
              @for (partner of partners(); track partner.id) {
                <tr class="border-t border-[var(--tx-gray-200)] hover:bg-[var(--tx-gray-050)]">
                  <td class="px-4 py-3">
                    <div>
                      <p class="text-body font-medium text-[var(--tx-gray-950)]">{{ partner.full_name }}</p>
                      <p class="text-body-sm text-[var(--tx-gray-400)]">{{ partner.email }}</p>
                    </div>
                  </td>
                  @for (q of quarters; track q) {
                    <td class="px-4 py-3 text-center">
                      <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--tx-gray-400)] text-body-sm pointer-events-none">€</span>
                        <input
                          type="number"
                          class="tx-input pl-7 w-full text-right"
                          [value]="getTarget(partner.id, q)"
                          placeholder="0"
                          min="0"
                          step="1000"
                          [attr.aria-label]="'Meta T' + q + ' para ' + partner.full_name"
                          (blur)="onTargetBlur($event, partner.id, q)"
                          [disabled]="savingCell() === partner.id + '_' + q"
                        />
                        @if (savingCell() === partner.id + '_' + q) {
                          <span class="absolute right-2 top-1/2 -translate-y-1/2 text-[var(--tx-teal-500)]">
                            <svg class="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                            </svg>
                          </span>
                        }
                      </div>
                    </td>
                  }
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      @if (!loading() && !error() && partners().length === 0) {
        <div class="tx-card p-8 text-center">
          <p class="text-body text-[var(--tx-gray-400)]">Nenhum parceiro activo encontrado.</p>
        </div>
      }

      <!-- Save feedback toast -->
      @if (saveSuccess()) {
        <div class="fixed bottom-6 right-6 bg-[var(--tx-success)] text-white px-4 py-2 rounded-lg shadow-lg text-body-sm">
          Meta guardada com sucesso.
        </div>
      }
    </div>
  `,
  styles: [`
    input[type="number"]::-webkit-inner-spin-button,
    input[type="number"]::-webkit-outer-spin-button {
      -webkit-appearance: none;
    }
    input[type="number"] {
      -moz-appearance: textfield;
    }
  `],
})
export class PartnerTargetsComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #auth = inject(AuthService);

  readonly quarters = QUARTERS;

  readonly selectedYear = signal<number>(CURRENT_YEAR);
  readonly partners = signal<Profile[]>([]);
  readonly targetsGrid = signal<TargetGrid>({});
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly savingCell = signal<string | null>(null);
  readonly saveSuccess = signal(false);

  readonly currentUserId = computed(() => this.#auth.currentUser()?.id ?? '');

  async ngOnInit(): Promise<void> {
    await this.loadPartners();
    await this.loadTargets();
    this.loading.set(false);
  }

  changeYear(delta: -1 | 1): void {
    const next = this.selectedYear() + delta;
    if (next < CURRENT_YEAR - 1 || next > CURRENT_YEAR + 1) return;
    this.selectedYear.set(next);
    this.loading.set(true);
    this.loadTargets().then(() => this.loading.set(false));
  }

  getTarget(partnerId: string, quarter: 1 | 2 | 3 | 4): number | null {
    return this.targetsGrid()[partnerId]?.[quarter] ?? null;
  }

  async onTargetBlur(event: Event, partnerId: string, quarter: 1 | 2 | 3 | 4): Promise<void> {
    const input = event.target as HTMLInputElement;
    const raw = input.value.trim();
    const value = raw === '' ? null : Number(raw);

    if (value !== null && (isNaN(value) || value < 0)) return;

    const cellKey = `${partnerId}_${quarter}`;
    this.savingCell.set(cellKey);

    try {
      const upsertPayload: Omit<PartnerTarget, 'id' | 'created_at'> & { target_volume: number } = {
        partner_id: partnerId,
        year: this.selectedYear(),
        quarter,
        target_volume: value ?? 0,
        created_by: this.currentUserId(),
      };

      const { error } = await this.#supabase
        .from('partner_targets')
        .upsert(upsertPayload, { onConflict: 'partner_id,year,quarter' });

      if (error) throw new Error(error.message);

      // Update local grid
      const grid = { ...this.targetsGrid() };
      if (!grid[partnerId]) {
        grid[partnerId] = { 1: null, 2: null, 3: null, 4: null };
      }
      grid[partnerId] = { ...grid[partnerId], [quarter]: value };
      this.targetsGrid.set(grid);

      this.#showSaveSuccess();
    } catch (err) {
      this.error.set('Erro ao guardar meta. Tenta novamente.');
      setTimeout(() => this.error.set(null), 4000);
    } finally {
      this.savingCell.set(null);
    }
  }

  private async loadPartners(): Promise<void> {
    const { data, error } = await this.#supabase
      .from('profiles')
      .select('id, full_name, email, role, active, created_at')
      .eq('role', 'partner')
      .eq('active', true)
      .order('full_name');

    if (error) {
      this.error.set('Erro ao carregar parceiros.');
      return;
    }
    this.partners.set((data as Profile[]) ?? []);
  }

  private async loadTargets(): Promise<void> {
    const { data, error } = await this.#supabase
      .from('partner_targets')
      .select('partner_id, quarter, target_volume')
      .eq('year', this.selectedYear());

    if (error) {
      this.error.set('Erro ao carregar metas.');
      return;
    }

    const grid: TargetGrid = {};
    for (const partner of this.partners()) {
      grid[partner.id] = { 1: null, 2: null, 3: null, 4: null };
    }
    for (const row of (data as PartnerTarget[]) ?? []) {
      if (grid[row.partner_id]) {
        grid[row.partner_id][row.quarter] = row.target_volume;
      }
    }
    this.targetsGrid.set(grid);
  }

  #showSaveSuccess(): void {
    this.saveSuccess.set(true);
    setTimeout(() => this.saveSuccess.set(false), 2500);
  }
}
