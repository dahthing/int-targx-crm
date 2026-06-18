import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';

interface ReportFile {
  name: string;
  id: string;
  updated_at: string;
  metadata: { size: number };
}

@Component({
  selector: 'app-management-reports',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, ButtonModule, ToastModule],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header" style="display:flex;align-items:center;justify-content:space-between">
          <div>
            <h1 class="page-title">Relatórios de Gestão</h1>
            <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">
              Gerados automaticamente no dia 1 de cada mês
            </p>
          </div>
          <button class="tx-btn-primary" (click)="generateNow()" [disabled]="generating()">
            @if (generating()) {
              <i class="pi pi-spin pi-spinner mr-2"></i>A gerar...
            } @else {
              <i class="pi pi-refresh mr-2"></i>Gerar agora
            }
          </button>
        </div>

        <div style="padding:24px">
          @if (loading()) {
            <p style="color:var(--tx-gray-400)">A carregar...</p>
          } @else if (reports().length === 0) {
            <div style="text-align:center;padding:48px;color:var(--tx-gray-400)">
              <i class="pi pi-file-pdf" style="font-size:2rem;display:block;margin-bottom:12px"></i>
              <p>Ainda não há relatórios gerados.</p>
              <p style="font-size:0.875rem">O primeiro será gerado no dia 1 do próximo mês.</p>
            </div>
          } @else {
            <table class="tx-table" style="width:100%">
              <thead>
                <tr>
                  <th>Relatório</th>
                  <th>Tamanho</th>
                  <th>Gerado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (r of reports(); track r.name) {
                  <tr>
                    <td>
                      <div style="display:flex;align-items:center;gap:8px">
                        <i class="pi pi-file-pdf" style="color:var(--tx-danger)"></i>
                        <span>{{ r.name }}</span>
                      </div>
                    </td>
                    <td style="color:var(--tx-gray-500);font-size:0.8125rem">{{ formatSize(r.metadata?.size ?? 0) }}</td>
                    <td style="color:var(--tx-gray-500);font-size:0.8125rem">{{ r.updated_at | date:'dd/MM/yyyy HH:mm' }}</td>
                    <td>
                      <button class="tx-btn-secondary" style="padding:4px 12px;font-size:0.8125rem" (click)="download(r)">
                        <i class="pi pi-download mr-1"></i>Download
                      </button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          }
        </div>
      </div>
    </div>
  `,
})
export class ManagementReportsComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #msg = inject(MessageService);

  readonly reports = signal<ReportFile[]>([]);
  readonly loading = signal(true);
  readonly generating = signal(false);

  ngOnInit(): void {
    this.#load();
  }

  async #load(): Promise<void> {
    const { data } = await this.#supabase.storage.from('reports').list('management', {
      sortBy: { column: 'updated_at', order: 'desc' },
    });
    this.reports.set((data ?? []) as ReportFile[]);
    this.loading.set(false);
  }

  async generateNow(): Promise<void> {
    this.generating.set(true);
    try {
      const { error } = await this.#supabase.functions.invoke('generate-management-report');
      if (error) throw error;
      this.#msg.add({ severity: 'success', summary: 'Relatório gerado', detail: 'Email enviado ao admin.' });
      await this.#load();
    } catch {
      this.#msg.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível gerar o relatório.' });
    } finally {
      this.generating.set(false);
    }
  }

  async download(r: ReportFile): Promise<void> {
    const { data } = await this.#supabase.storage.from('reports').createSignedUrl(`management/${r.name}`, 60);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
  }

  formatSize(bytes: number): string {
    if (!bytes) return '—';
    return bytes > 1024 * 1024
      ? `${(bytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(bytes / 1024)} KB`;
  }
}
