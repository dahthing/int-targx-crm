import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { GanttService } from '../../../core/services/gantt.service';
import type { GanttPhase } from '../../../core/services/gantt.service';

@Component({
  selector: 'app-project-gantt',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="tx-card">
      <div class="flex items-center justify-between mb-6">
        <h2 class="text-h3">Gantt do Projecto</h2>
        <button class="tx-btn-secondary" (click)="exportPng()">
          <svg class="w-4 h-4 mr-2 inline" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Exportar PNG
        </button>
      </div>

      @if (loading()) {
        <div class="flex items-center justify-center py-16">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else if (error()) {
        <div class="py-8 text-center" style="color: var(--tx-danger)">{{ error() }}</div>
      } @else if (phases().length === 0) {
        <p class="text-center py-8" style="color: var(--text-muted)">Sem fases para exibir.</p>
      } @else {
        <!-- Legend -->
        <div class="flex items-center gap-6 mb-4 text-sm">
          <div class="flex items-center gap-2">
            <span class="inline-block w-4 h-3 rounded" style="background: var(--tx-success)"></span>
            <span style="color: var(--text-secondary)">Concluída</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-4 h-3 rounded" style="background: var(--tx-teal-500)"></span>
            <span style="color: var(--text-secondary)">Em curso</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-4 h-3 rounded" style="background: var(--tx-gray-400)"></span>
            <span style="color: var(--text-secondary)">Futura</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="inline-block w-3 h-3 border-l-2 border-dashed" style="border-color: var(--tx-danger)"></span>
            <span style="color: var(--text-secondary)">Hoje</span>
          </div>
        </div>

        <!-- Gantt scrollable -->
        <div class="overflow-x-auto">
          <div [style.min-width.px]="minWidth()">
            <!-- Header: months -->
            <div class="flex" style="margin-left: 200px; border-bottom: 1px solid var(--border-subtle)">
              @for (month of monthLabels(); track month.label) {
                <div
                  class="text-xs font-medium py-1 px-2"
                  style="color: var(--text-muted); border-left: 1px solid var(--tx-gray-100)"
                  [style.width.px]="month.widthPx"
                >
                  {{ month.label }}
                </div>
              }
            </div>

            <!-- Rows -->
            <div class="relative">
              <!-- Today line -->
              @if (todayOffsetPx() >= 0) {
                <div
                  class="absolute top-0 bottom-0 pointer-events-none"
                  style="border-left: 2px dashed var(--tx-danger); z-index: 2"
                  [style.left.px]="todayOffsetPx() + 200"
                  aria-label="Hoje"
                ></div>
              }

              @for (phase of phases(); track phase.id; let i = $index) {
                <div
                  class="flex items-center"
                  style="border-bottom: 1px solid var(--tx-gray-100); min-height: 44px"
                >
                  <!-- Phase name -->
                  <div
                    class="flex-shrink-0 px-3 py-2 text-sm font-medium truncate"
                    style="width: 200px; color: var(--text-primary)"
                    [title]="phase.name"
                  >
                    {{ phase.name }}
                  </div>

                  <!-- Bar area -->
                  <div class="relative flex-1" style="height: 44px">
                    <div
                      class="absolute top-1/2 -translate-y-1/2 rounded"
                      style="height: 24px; transition: left var(--transition-base), width var(--transition-base); cursor: grab"
                      [style.left.px]="barLeft(phase)"
                      [style.width.px]="barWidth(phase)"
                      [style.background]="phaseColor(phase, i)"
                      [title]="phase.name + ': ' + formatDate(phase.start_date) + ' → ' + formatDate(phase.end_date)"
                      (mousedown)="startDrag($event, phase)"
                    >
                      <span class="absolute inset-0 flex items-center px-2 text-xs text-white font-medium truncate select-none">
                        {{ phase.duration_days }}d
                      </span>
                    </div>
                  </div>

                  <!-- Date range -->
                  <div class="flex-shrink-0 px-3 text-xs text-right" style="width: 160px; color: var(--text-muted)">
                    {{ formatDate(phase.start_date) }} – {{ formatDate(phase.end_date) }}
                  </div>
                </div>
              }
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class ProjectGanttComponent implements OnInit {
  readonly projectId = input<string | null>(null);

  readonly #ganttService = inject(GanttService);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly phases = signal<GanttPhase[]>([]);

  readonly #today = new Date();
  readonly #pxPerDay = 24;

  readonly minDate = computed<Date>(() => {
    const all = this.phases();
    if (!all.length) return new Date();
    return new Date(Math.min(...all.map(p => p.start_date.getTime())));
  });

  readonly maxDate = computed<Date>(() => {
    const all = this.phases();
    if (!all.length) return new Date();
    return new Date(Math.max(...all.map(p => p.end_date.getTime())));
  });

  readonly totalDays = computed(() =>
    Math.ceil((this.maxDate().getTime() - this.minDate().getTime()) / 86_400_000) + 5
  );

  readonly minWidth = computed(() => 200 + this.totalDays() * this.#pxPerDay + 160);

  readonly todayOffsetPx = computed(() => {
    const diff = this.#today.getTime() - this.minDate().getTime();
    if (diff < 0) return -1;
    return Math.floor(diff / 86_400_000) * this.#pxPerDay;
  });

  readonly monthLabels = computed(() => {
    const labels: { label: string; widthPx: number }[] = [];
    const start = new Date(this.minDate());
    start.setDate(1);
    const end = new Date(this.maxDate());
    end.setMonth(end.getMonth() + 1, 1);

    let cur = new Date(start);
    while (cur < end) {
      const next = new Date(cur.getFullYear(), cur.getMonth() + 1, 1);
      const days = Math.ceil((next.getTime() - cur.getTime()) / 86_400_000);
      labels.push({
        label: new Intl.DateTimeFormat('pt-PT', { month: 'short', year: '2-digit' }).format(cur),
        widthPx: days * this.#pxPerDay,
      });
      cur = next;
    }
    return labels;
  });

  ngOnInit(): void {
    const id = this.projectId();
    if (!id) {
      this.loading.set(false);
      return;
    }
    void this.#ganttService.getProjectGantt(id).then(ganttPhases => {
      this.phases.set(ganttPhases);
      this.loading.set(false);
    }).catch((err: Error) => {
      this.error.set(err.message);
      this.loading.set(false);
    });
  }

  protected barLeft(phase: GanttPhase): number {
    const diff = phase.start_date.getTime() - this.minDate().getTime();
    return Math.floor(diff / 86_400_000) * this.#pxPerDay;
  }

  protected barWidth(phase: GanttPhase): number {
    return Math.max(phase.duration_days * this.#pxPerDay, 8);
  }

  protected phaseColor(phase: GanttPhase, index: number): string {
    if (phase.end_date < this.#today) return 'var(--tx-success)';
    if (phase.start_date <= this.#today && phase.end_date >= this.#today) return 'var(--tx-teal-500)';
    // Alternate shades for future phases so they're distinguishable
    return index % 2 === 0 ? 'var(--tx-gray-400)' : 'var(--tx-gray-600)';
  }

  protected formatDate(date: Date): string {
    return new Intl.DateTimeFormat('pt-PT', { day: '2-digit', month: '2-digit' }).format(date);
  }

  protected startDrag(event: MouseEvent, phase: GanttPhase): void {
    const id = this.projectId();
    if (!id) return;

    const startX = event.clientX;
    const originalStart = new Date(phase.start_date);
    let lastDiffDays = 0;

    const onMove = (e: MouseEvent) => {
      const diffPx = e.clientX - startX;
      const diffDays = Math.round(diffPx / this.#pxPerDay);
      if (diffDays === lastDiffDays) return;
      lastDiffDays = diffDays;
      const newStart = new Date(originalStart);
      newStart.setDate(newStart.getDate() + diffDays);
      void this.#ganttService.updatePhaseStart(id, phase.id, newStart).then(updated => {
        this.phases.set(updated);
      });
    };

    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    event.preventDefault();
  }

  protected exportPng(): void {
    this.#messageService.add({ severity: 'info', summary: 'Em breve', detail: 'Exportação PNG em desenvolvimento.' });
  }
}
