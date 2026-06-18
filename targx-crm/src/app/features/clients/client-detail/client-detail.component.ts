import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  inject,
  DestroyRef,
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { switchMap } from 'rxjs';

import { ButtonModule } from 'primeng/button';
import { TabsModule } from 'primeng/tabs';

import { ClientService } from '../../../core/services/client.service';
import { QuoteService } from '../../../core/services/quote.service';
import type { Client } from '../../../core/models/client.model';
import type { Quote } from '../../../core/models/quote.model';
import { ClientFormComponent } from '../client-form/client-form.component';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-client-detail',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ButtonModule, TabsModule, ClientFormComponent],
  template: `
    <div class="p-6" style="max-width: 960px; margin: 0 auto">

      <!-- Loading state -->
      @if (loading()) {
        <div style="padding: 60px 0; text-align: center; color: var(--text-muted)">
          <i class="pi pi-spin pi-spinner" style="font-size: 1.5rem"></i>
          <p style="margin-top: 12px">A carregar cliente…</p>
        </div>
      }

      <!-- Error state -->
      @if (error()) {
        <div class="tx-card" style="text-align: center; padding: 40px; color: var(--tx-danger)">
          <i class="pi pi-exclamation-triangle" style="font-size: 2rem; margin-bottom: 12px; display: block"></i>
          <p>Não foi possível carregar o cliente.</p>
          <button class="tx-btn-secondary" style="margin-top: 16px" (click)="goBack()">
            <i class="pi pi-arrow-left" style="margin-right: 6px"></i>
            Voltar
          </button>
        </div>
      }

      @if (!loading() && !error() && client()) {
        <!-- Page header -->
        <div style="display: flex; align-items: center; gap: 16px; margin-bottom: 24px">
          <button class="tx-btn-ghost" (click)="goBack()" aria-label="Voltar à lista de clientes">
            <i class="pi pi-arrow-left"></i>
          </button>
          <div style="flex: 1">
            <h1 style="margin: 0; font-size: 1.5rem; font-weight: 700; color: var(--text-primary)">
              {{ client()!.name }}
            </h1>
            @if (client()!.sector) {
              <span class="tx-badge" style="margin-top: 4px; display: inline-block">
                {{ client()!.sector }}
              </span>
            }
          </div>
          <button class="tx-btn-secondary" (click)="openEdit()">
            <i class="pi pi-pencil" style="margin-right: 6px"></i>
            Editar
          </button>
          <button class="tx-btn-primary" (click)="createQuote()">
            <i class="pi pi-file-plus" style="margin-right: 6px"></i>
            Novo orçamento
          </button>
        </div>

        <!-- Tabs -->
        <p-tabs [value]="0">
          <p-tablist>
            <p-tab [value]="0">Informação</p-tab>
            <p-tab [value]="1">Leads</p-tab>
            <p-tab [value]="2">Projectos</p-tab>
            <p-tab [value]="3">Orçamentos</p-tab>
          </p-tablist>

          <p-tabpanels>
            <!-- Informação -->
            <p-tabpanel [value]="0">
              <div class="tx-card" style="margin-top: 16px">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 24px">

                  <div>
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                      NIF
                    </p>
                    <p style="margin: 0; color: var(--text-primary); font-family: 'JetBrains Mono', monospace">
                      {{ client()!.nif ?? '—' }}
                    </p>
                  </div>

                  <div>
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                      Sector
                    </p>
                    <p style="margin: 0; color: var(--text-primary)">
                      {{ client()!.sector ?? '—' }}
                    </p>
                  </div>

                  <div>
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                      Email
                    </p>
                    @if (client()!.email) {
                      <a
                        [href]="'mailto:' + client()!.email"
                        style="color: var(--tx-teal-500); text-decoration: none"
                      >
                        {{ client()!.email }}
                      </a>
                    } @else {
                      <p style="margin: 0; color: var(--text-primary)">—</p>
                    }
                  </div>

                  <div>
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                      Telefone
                    </p>
                    @if (client()!.phone) {
                      <a
                        [href]="'tel:' + client()!.phone"
                        style="color: var(--tx-teal-500); text-decoration: none"
                      >
                        {{ client()!.phone }}
                      </a>
                    } @else {
                      <p style="margin: 0; color: var(--text-primary)">—</p>
                    }
                  </div>

                  <div>
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                      Website
                    </p>
                    @if (client()!.website) {
                      <a
                        [href]="client()!.website!"
                        target="_blank"
                        rel="noopener noreferrer"
                        style="color: var(--tx-teal-500); text-decoration: none"
                      >
                        {{ client()!.website }}
                      </a>
                    } @else {
                      <p style="margin: 0; color: var(--text-primary)">—</p>
                    }
                  </div>

                  <div>
                    <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                      Data de criação
                    </p>
                    <p style="margin: 0; color: var(--text-primary)">
                      {{ formatDate(client()!.created_at) }}
                    </p>
                  </div>

                  @if (client()!.address) {
                    <div style="grid-column: 1 / -1">
                      <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                        Morada
                      </p>
                      <p style="margin: 0; color: var(--text-primary)">{{ client()!.address }}</p>
                    </div>
                  }

                  @if (client()!.notes) {
                    <div style="grid-column: 1 / -1">
                      <p style="margin: 0 0 4px; font-size: 0.75rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em">
                        Notas
                      </p>
                      <p style="margin: 0; color: var(--text-secondary); white-space: pre-wrap">
                        {{ client()!.notes }}
                      </p>
                    </div>
                  }

                </div>
              </div>
            </p-tabpanel>

            <!-- Leads (placeholder) -->
            <p-tabpanel [value]="1">
              <div class="tx-card" style="margin-top: 16px; text-align: center; padding: 48px; color: var(--text-muted)">
                <i class="pi pi-users" style="font-size: 2rem; display: block; margin-bottom: 12px; opacity: 0.4"></i>
                <p style="margin: 0">Os leads deste cliente serão mostrados aqui.</p>
              </div>
            </p-tabpanel>

            <!-- Projectos (placeholder) -->
            <p-tabpanel [value]="2">
              <div class="tx-card" style="margin-top: 16px; text-align: center; padding: 48px; color: var(--text-muted)">
                <i class="pi pi-briefcase" style="font-size: 2rem; display: block; margin-bottom: 12px; opacity: 0.4"></i>
                <p style="margin: 0">Os projectos deste cliente serão mostrados aqui.</p>
              </div>
            </p-tabpanel>

            <!-- Orçamentos -->
            <p-tabpanel [value]="3">
              <div style="margin-top: 16px">
                @if (quotesLoading()) {
                  <div style="text-align:center;padding:48px;color:var(--text-muted)">
                    <i class="pi pi-spin pi-spinner" style="font-size:1.5rem"></i>
                  </div>
                } @else if (quotes().length === 0) {
                  <div class="tx-card" style="text-align:center;padding:48px;color:var(--text-muted)">
                    <i class="pi pi-file" style="font-size:2rem;display:block;margin-bottom:12px;opacity:0.4"></i>
                    <p style="margin:0">Este cliente ainda não tem orçamentos.</p>
                  </div>
                } @else {
                  <div class="tx-card" style="overflow:hidden">
                    <table class="tx-table" style="width:100%">
                      <thead>
                        <tr>
                          <th>Título</th>
                          <th>Estado</th>
                          <th>Versão</th>
                          <th>Data</th>
                          <th style="text-align:right">Acções</th>
                        </tr>
                      </thead>
                      <tbody>
                        @for (q of quotes(); track q.id) {
                          <tr>
                            <td style="font-weight:500">{{ q.title }}</td>
                            <td>
                              <span class="tx-badge">{{ q.status }}</span>
                            </td>
                            <td style="font-family:monospace">v{{ q.version }}</td>
                            <td>{{ formatDate(q.created_at) }}</td>
                            <td style="text-align:right">
                              <div style="display:flex;gap:8px;justify-content:flex-end">
                                <button class="tx-btn-ghost" style="font-size:0.8rem" (click)="viewQuote(q.id)">
                                  <i class="pi pi-eye" style="margin-right:4px"></i>Ver
                                </button>
                                @if (q.client_accept_token) {
                                  <button class="tx-btn-secondary" style="font-size:0.8rem" (click)="openClientPortal(q)">
                                    <i class="pi pi-external-link" style="margin-right:4px"></i>Portal
                                  </button>
                                }
                              </div>
                            </td>
                          </tr>
                        }
                      </tbody>
                    </table>
                  </div>
                }
              </div>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      }
    </div>

    <app-client-form
      [visible]="formVisible()"
      [client]="client()"
      (visibleChange)="formVisible.set($event)"
      (saved)="onClientSaved($event)"
    />
  `,
})
export class ClientDetailComponent implements OnInit {
  readonly #clientService = inject(ClientService);
  readonly #quoteService = inject(QuoteService);
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);

  readonly client = signal<Client | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly formVisible = signal(false);
  readonly quotes = signal<Quote[]>([]);
  readonly quotesLoading = signal(false);

  ngOnInit(): void {
    this.#route.paramMap
      .pipe(
        switchMap(params => {
          const id = params.get('id') ?? '';
          this.loading.set(true);
          this.error.set(false);
          return this.#clientService.getById(id);
        }),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: data => {
          this.client.set(data);
          this.loading.set(false);
          this.#loadQuotes(data.id);
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
  }

  #loadQuotes(clientId: string): void {
    this.quotesLoading.set(true);
    this.#quoteService
      .getAll({ client_id: clientId })
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: data => {
          this.quotes.set(data);
          this.quotesLoading.set(false);
        },
        error: () => this.quotesLoading.set(false),
      });
  }

  viewQuote(id: string): void {
    this.#router.navigate(['/quotes', id, 'preview']);
  }

  openClientPortal(q: Quote): void {
    if (q.client_accept_token) {
      window.open(`${environment.clientPortalBaseUrl}/${q.client_accept_token}`, '_blank', 'noopener,noreferrer');
    }
  }

  openEdit(): void {
    this.formVisible.set(true);
  }

  onClientSaved(updated: Client): void {
    this.client.set(updated);
    this.formVisible.set(false);
  }

  goBack(): void {
    this.#router.navigate(['/clients']);
  }

  createQuote(): void {
    this.#router.navigate(['/quotes/new'], { queryParams: { client_id: this.client()?.id } });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
