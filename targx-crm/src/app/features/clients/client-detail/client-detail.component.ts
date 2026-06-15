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
import type { Client } from '../../../core/models/client.model';
import { ClientFormComponent } from '../client-form/client-form.component';

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

            <!-- Orçamentos (placeholder) -->
            <p-tabpanel [value]="3">
              <div class="tx-card" style="margin-top: 16px; text-align: center; padding: 48px; color: var(--text-muted)">
                <i class="pi pi-file" style="font-size: 2rem; display: block; margin-bottom: 12px; opacity: 0.4"></i>
                <p style="margin: 0">Os orçamentos deste cliente serão mostrados aqui.</p>
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
  readonly #route = inject(ActivatedRoute);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);

  readonly client = signal<Client | null>(null);
  readonly loading = signal(true);
  readonly error = signal(false);
  readonly formVisible = signal(false);

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
        },
        error: () => {
          this.error.set(true);
          this.loading.set(false);
        },
      });
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

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
