import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
  computed,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TableModule } from 'primeng/table';
import { PaginatorModule, PaginatorState } from 'primeng/paginator';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';

interface AuditLogEntry {
  id: string;
  quote_id: string | null;
  field_name: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
}

const PAGE_SIZE = 50;

@Component({
  selector: 'app-audit-log',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, TableModule, PaginatorModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />

    <div class="p-6">
      <div class="mb-6">
        <h1 class="text-h2" style="color: var(--tx-gray-950)">Audit Log</h1>
        <p class="text-body-sm mt-1" style="color: var(--text-secondary)">
          Registo imutável de alterações a campos críticos dos orçamentos.
        </p>
      </div>

      <!-- Filters -->
      <div class="tx-card mb-4 flex flex-wrap gap-4">
        <div class="tx-field flex-1 min-w-48">
          <label class="tx-form-label" for="filter-quote">ID do Orçamento</label>
          <input id="filter-quote" type="text" class="tx-input" [(ngModel)]="filterQuoteId" placeholder="uuid…" (ngModelChange)="applyFilters()" />
        </div>
        <div class="tx-field flex-1 min-w-48">
          <label class="tx-form-label" for="filter-field">Campo</label>
          <input id="filter-field" type="text" class="tx-input" [(ngModel)]="filterFieldName" placeholder="Ex: total_before_tax" (ngModelChange)="applyFilters()" />
        </div>
        <div class="tx-field flex-1 min-w-40">
          <label class="tx-form-label" for="filter-from">Data início</label>
          <input id="filter-from" type="date" class="tx-input" [(ngModel)]="filterFrom" (ngModelChange)="applyFilters()" />
        </div>
        <div class="tx-field flex-1 min-w-40">
          <label class="tx-form-label" for="filter-to">Data fim</label>
          <input id="filter-to" type="date" class="tx-input" [(ngModel)]="filterTo" (ngModelChange)="applyFilters()" />
        </div>
        <div class="flex items-end">
          <button class="tx-btn-secondary" (click)="clearFilters()">Limpar</button>
        </div>
      </div>

      @if (loading()) {
        <div class="tx-card py-12 text-center">
          <i class="pi pi-spin pi-spinner text-3xl" style="color: var(--tx-teal-500)"></i>
        </div>
      } @else {
        <div class="tx-card overflow-hidden">
          <p-table [value]="pageEntries()" styleClass="tx-table" [rowHover]="true">
            <ng-template pTemplate="header">
              <tr>
                <th>Data</th>
                <th>Orçamento</th>
                <th>Campo</th>
                <th>Valor anterior</th>
                <th>Valor novo</th>
                <th>Quem alterou</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-entry>
              <tr>
                <td class="font-mono text-sm whitespace-nowrap">{{ formatDateTime(entry.changed_at) }}</td>
                <td class="font-mono text-xs" style="color: var(--text-muted)">{{ entry.quote_id ? entry.quote_id.slice(0, 8) + '…' : '—' }}</td>
                <td><code class="text-sm" style="color: var(--tx-teal-700)">{{ entry.field_name }}</code></td>
                <td class="font-mono text-sm" style="color: var(--text-secondary)">{{ entry.old_value ?? '—' }}</td>
                <td class="font-mono text-sm font-semibold" style="color: var(--tx-gray-900)">{{ entry.new_value ?? '—' }}</td>
                <td class="text-sm" style="color: var(--text-muted)">{{ entry.changed_by ? entry.changed_by.slice(0, 8) + '…' : '—' }}</td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="6" class="text-center py-8" style="color: var(--text-muted)">Nenhum registo encontrado.</td>
              </tr>
            </ng-template>
          </p-table>

          @if (filteredEntries().length > PAGE_SIZE) {
            <div class="border-t p-3" style="border-color: var(--tx-gray-200)">
              <p-paginator
                [rows]="PAGE_SIZE"
                [totalRecords]="filteredEntries().length"
                (onPageChange)="onPageChange($event)"
                [rowsPerPageOptions]="[]"
              />
            </div>
          }
        </div>

        <p class="text-body-sm mt-2" style="color: var(--text-muted)">
          {{ filteredEntries().length }} registo(s) encontrado(s)
        </p>
      }
    </div>
  `,
})
export class AuditLogComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly loading = signal(true);
  readonly allEntries = signal<AuditLogEntry[]>([]);
  readonly filteredEntries = signal<AuditLogEntry[]>([]);
  readonly currentPage = signal(0);

  readonly pageEntries = computed(() => {
    const start = this.currentPage() * PAGE_SIZE;
    return this.filteredEntries().slice(start, start + PAGE_SIZE);
  });

  filterQuoteId = '';
  filterFieldName = '';
  filterFrom = '';
  filterTo = '';

  readonly PAGE_SIZE = PAGE_SIZE;

  ngOnInit(): void {
    void this.#load();
  }

  async #load(): Promise<void> {
    const { data, error } = await this.#supabase
      .from('quote_audit_logs')
      .select('*')
      .order('changed_at', { ascending: false })
      .limit(5000);

    if (error) {
      this.#messageService.add({ severity: 'error', summary: 'Erro', detail: error.message });
      this.loading.set(false);
      return;
    }

    const entries = (data ?? []) as AuditLogEntry[];
    this.allEntries.set(entries);
    this.filteredEntries.set(entries);
    this.loading.set(false);
  }

  applyFilters(): void {
    this.currentPage.set(0);
    let result = this.allEntries();

    if (this.filterQuoteId.trim()) {
      const q = this.filterQuoteId.trim().toLowerCase();
      result = result.filter(e => e.quote_id?.toLowerCase().includes(q));
    }
    if (this.filterFieldName.trim()) {
      const f = this.filterFieldName.trim().toLowerCase();
      result = result.filter(e => e.field_name.toLowerCase().includes(f));
    }
    if (this.filterFrom) {
      result = result.filter(e => e.changed_at >= this.filterFrom);
    }
    if (this.filterTo) {
      result = result.filter(e => e.changed_at <= this.filterTo + 'T23:59:59');
    }

    this.filteredEntries.set(result);
  }

  clearFilters(): void {
    this.filterQuoteId = '';
    this.filterFieldName = '';
    this.filterFrom = '';
    this.filterTo = '';
    this.filteredEntries.set(this.allEntries());
    this.currentPage.set(0);
  }

  onPageChange(event: PaginatorState): void {
    this.currentPage.set(event.page ?? 0);
  }

  protected formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString('pt-PT', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }
}
