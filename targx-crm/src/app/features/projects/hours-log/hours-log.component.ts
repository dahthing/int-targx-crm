import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ProjectService } from '../../../core/services/project.service';
import { AuthService } from '../../../core/services/auth.service';
import type { ProjectHoursLog } from '../../../core/models/project.model';

interface HoursEntry {
  date: string;
  description: string;
  hours: number;
}

@Component({
  selector: 'app-hours-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TableModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="tx-card mt-4">
      <!-- Header + progress -->
      <div class="flex items-center justify-between mb-6 flex-wrap gap-4">
        <div>
          <h2 class="text-h3">Registo de Horas</h2>
          @if (estimatedHours() !== null) {
            <p class="text-body-sm mt-1" style="color: var(--text-secondary)">
              {{ totalHours() | number:'1.1-1' }}h registadas de {{ estimatedHours() }}h estimadas
            </p>
          }
        </div>
        <button class="tx-btn-primary" (click)="showDrawer.set(true)">
          + Registar horas
        </button>
      </div>

      <!-- Progress bar -->
      @if (estimatedHours() && estimatedHours()! > 0) {
        <div class="mb-6">
          <div class="h-2 rounded-full overflow-hidden" style="background: var(--tx-gray-200)">
            <div
              class="h-full rounded-full transition-all"
              [style.width.%]="progressPct()"
              [style.background]="progressColor()"
            ></div>
          </div>
          <div class="flex justify-between mt-1">
            <span class="text-body-sm" style="color: var(--text-muted)">0h</span>
            <span class="text-body-sm font-semibold" [style.color]="progressColor()">
              {{ progressPct() | number:'1.0-0' }}%
            </span>
            <span class="text-body-sm" style="color: var(--text-muted)">{{ estimatedHours() }}h</span>
          </div>
        </div>
      }

      <!-- Table -->
      @if (loading()) {
        <div class="py-8 text-center">
          <i class="pi pi-spin pi-spinner text-2xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else if (entries().length === 0) {
        <div class="py-8 text-center" style="color: var(--text-muted)">
          Nenhuma hora registada ainda.
        </div>
      } @else {
        <p-table [value]="entries()" styleClass="tx-table" [rowHover]="true">
          <ng-template pTemplate="header">
            <tr>
              <th>Data</th>
              <th>Descrição</th>
              <th class="text-right">Horas</th>
              <th>Registado por</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-entry>
            <tr>
              <td class="font-mono text-sm">{{ formatDate(entry.logged_date) }}</td>
              <td>{{ entry.description }}</td>
              <td class="text-right font-mono font-semibold" style="color: var(--tx-teal-600)">{{ entry.hours }}h</td>
              <td style="color: var(--text-secondary)">{{ entry.user_id }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="footer">
            <tr>
              <td colspan="2" class="font-semibold">Total</td>
              <td class="text-right font-mono font-bold" style="color: var(--tx-teal-700)">{{ totalHours() | number:'1.1-1' }}h</td>
              <td></td>
            </tr>
          </ng-template>
        </p-table>
      }
    </div>

    <!-- Drawer overlay -->
    @if (showDrawer()) {
      <div
        class="fixed inset-0 z-40"
        style="background: rgba(0,0,0,0.4)"
        (click)="closeDrawer()"
        (keydown.escape)="closeDrawer()"
        role="dialog"
        aria-modal="true"
        aria-label="Registar horas"
      ></div>
      <div class="fixed top-0 right-0 h-full w-96 z-50 flex flex-col"
           style="background: var(--surface-card); box-shadow: -4px 0 24px rgba(0,0,0,0.15)">
        <div class="flex items-center justify-between p-6 border-b" style="border-color: var(--tx-gray-200)">
          <h3 class="text-h3">Registar Horas</h3>
          <button class="tx-btn-ghost p-1" (click)="closeDrawer()" aria-label="Fechar">
            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-6 flex flex-col gap-5">
          <!-- Date -->
          <div class="tx-field">
            <label class="tx-form-label" for="hours-date">Data <span aria-hidden="true" style="color: var(--tx-danger)">*</span></label>
            <input
              id="hours-date"
              type="date"
              class="tx-input"
              [(ngModel)]="form.date"
              [max]="today"
            />
          </div>

          <!-- Description -->
          <div class="tx-field">
            <label class="tx-form-label" for="hours-desc">Descrição <span aria-hidden="true" style="color: var(--tx-danger)">*</span></label>
            <textarea
              id="hours-desc"
              class="tx-input"
              rows="3"
              [(ngModel)]="form.description"
              placeholder="Descreva o trabalho realizado…"
            ></textarea>
          </div>

          <!-- Hours -->
          <div class="tx-field">
            <label class="tx-form-label" for="hours-value">Horas <span aria-hidden="true" style="color: var(--tx-danger)">*</span></label>
            <input
              id="hours-value"
              type="number"
              class="tx-input"
              [(ngModel)]="form.hours"
              min="0.25"
              step="0.25"
              placeholder="Ex: 2.5"
            />
          </div>
        </div>

        <div class="p-6 border-t flex gap-3" style="border-color: var(--tx-gray-200)">
          <button class="tx-btn-secondary flex-1" (click)="closeDrawer()" [disabled]="saving()">Cancelar</button>
          <button class="tx-btn-primary flex-1" (click)="submitEntry()" [disabled]="saving() || !isFormValid()">
            @if (saving()) {
              <i class="pi pi-spin pi-spinner mr-2"></i>
            }
            Guardar
          </button>
        </div>
      </div>
    }
  `,
})
export class HoursLogComponent implements OnInit {
  readonly projectId = input.required<string>();
  readonly estimatedHours = input<number | null>(null);

  readonly #projectService = inject(ProjectService);
  readonly #authService = inject(AuthService);
  readonly #messageService = inject(MessageService);
  readonly #destroyed = takeUntilDestroyed();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly showDrawer = signal(false);
  readonly entries = signal<ProjectHoursLog[]>([]);

  form: HoursEntry = { date: '', description: '', hours: 0 };
  readonly today = new Date().toISOString().split('T')[0];

  readonly totalHours = computed(() =>
    this.entries().reduce((sum, e) => sum + Number(e.hours), 0)
  );

  readonly progressPct = computed(() => {
    const est = this.estimatedHours();
    if (!est || est <= 0) return 0;
    return Math.min((this.totalHours() / est) * 100, 100);
  });

  readonly progressColor = computed(() => {
    const pct = this.progressPct();
    if (pct > 100) return 'var(--tx-danger)';
    if (pct >= 90) return 'var(--tx-gold)';
    return 'var(--tx-teal-500)';
  });

  ngOnInit(): void {
    this.form = { date: this.today, description: '', hours: 0 };
    this.#loadEntries();
  }

  #loadEntries(): void {
    this.loading.set(true);
    this.#projectService.getHoursLog(this.projectId()).pipe(this.#destroyed).subscribe({
      next: (data) => {
        this.entries.set(data);
        this.loading.set(false);
      },
      error: (err: Error) => {
        this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
        this.loading.set(false);
      },
    });
  }

  isFormValid(): boolean {
    return !!this.form.date && !!this.form.description.trim() && this.form.hours > 0;
  }

  submitEntry(): void {
    if (!this.isFormValid()) return;
    const userId = this.#authService.currentUser()?.id;
    if (!userId) return;

    this.saving.set(true);
    this.#projectService
      .addHoursEntry(this.projectId(), {
        logged_date: this.form.date,
        description: this.form.description.trim(),
        hours: this.form.hours,
        user_id: userId,
      })
      .pipe(this.#destroyed)
      .subscribe({
        next: () => {
          this.#messageService.add({ severity: 'success', summary: 'Registado', detail: 'Horas guardadas.' });
          this.saving.set(false);
          this.closeDrawer();
          this.#loadEntries();
        },
        error: (err: Error) => {
          this.#messageService.add({ severity: 'error', summary: 'Erro', detail: err.message });
          this.saving.set(false);
        },
      });
  }

  closeDrawer(): void {
    this.showDrawer.set(false);
    this.form = { date: this.today, description: '', hours: 0 };
  }

  protected formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT');
  }
}
