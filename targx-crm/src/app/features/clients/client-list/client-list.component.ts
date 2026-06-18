import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  signal,
  computed,
  inject,
  DestroyRef,
} from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { Subject, debounceTime, distinctUntilChanged, switchMap, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';

import { ClientService } from '../../../core/services/client.service';
import type { Client } from '../../../core/models/client.model';
import { ClientFormComponent } from '../client-form/client-form.component';

@Component({
  selector: 'app-client-list',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TableModule, ButtonModule, InputTextModule, FormsModule, ClientFormComponent],
  styles: [`
    .clients-page { padding:24px; }
    .clients-header { display:flex; align-items:center; justify-content:space-between; margin-bottom:24px; }
    .clients-search { margin-bottom:16px; }
    .client-name { font-weight:500; color:var(--tx-gray-800); }
    .col-meta { color:var(--tx-gray-500); font-size:0.8125rem; }
    .col-date { color:var(--tx-gray-400); font-size:0.8125rem; }
    .tx-badge-gray { background:var(--tx-gray-100); color:var(--tx-gray-700); }
  `],
  template: `
    <div class="clients-page">
      <div class="clients-header">
        <h1 class="page-title">Clientes</h1>
        <button class="tx-btn-primary" (click)="openForm()">
          <i class="pi pi-plus" style="margin-right:6px"></i>Novo cliente
        </button>
      </div>

      <div class="tx-card">
        <div class="clients-search">
          <input
            class="tx-input"
            type="text"
            placeholder="Pesquisar por nome ou NIF…"
            [(ngModel)]="searchValue"
            (ngModelChange)="onSearch($event)"
            style="width:100%;max-width:360px"
          />
        </div>

        <p-table
          [value]="clients()"
          [loading]="loading()"
          [rows]="20"
          [paginator]="true"
          [rowHover]="true"
          styleClass="tx-table"
        >
          <ng-template pTemplate="header">
            <tr>
              <th>Nome</th>
              <th>Sector</th>
              <th>Email</th>
              <th>Telefone</th>
              <th>Criado em</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-client>
            <tr style="cursor:pointer" (click)="onRowClick(client)">
              <td><span class="client-name">{{ client.name }}</span></td>
              <td>
                @if (client.sector) {
                  <span class="tx-badge tx-badge-gray">{{ client.sector }}</span>
                } @else {
                  <span class="col-meta">—</span>
                }
              </td>
              <td class="col-meta">{{ client.email ?? '—' }}</td>
              <td class="col-meta">{{ client.phone ?? '—' }}</td>
              <td class="col-date">{{ formatDate(client.created_at) }}</td>
            </tr>
          </ng-template>
          <ng-template pTemplate="emptymessage">
            <tr>
              <td colspan="5">
                <div class="empty-state">
                  @if (loading()) {
                    <span>A carregar clientes…</span>
                  } @else {
                    <span>Nenhum cliente encontrado.</span>
                  }
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      </div>
    </div>

    <app-client-form
      [visible]="formVisible()"
      [client]="selectedClient()"
      (visibleChange)="formVisible.set($event)"
      (saved)="onClientSaved($event)"
    />
  `,
})
export class ClientListComponent implements OnInit {
  readonly #clientService = inject(ClientService);
  readonly #router = inject(Router);
  readonly #destroyRef = inject(DestroyRef);

  readonly clients = signal<Client[]>([]);
  readonly loading = signal(true);
  readonly formVisible = signal(false);
  readonly selectedClient = signal<Client | null>(null);

  searchValue = '';
  readonly #searchSubject = new Subject<string>();

  ngOnInit(): void {
    this.#loadClients();

    this.#searchSubject
      .pipe(
        debounceTime(300),
        distinctUntilChanged(),
        switchMap(query =>
          query.trim().length > 0
            ? this.#clientService.search(query)
            : this.#clientService.getAll(),
        ),
        takeUntilDestroyed(this.#destroyRef),
      )
      .subscribe({
        next: data => {
          this.clients.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  #loadClients(): void {
    this.loading.set(true);
    this.#clientService
      .getAll()
      .pipe(takeUntilDestroyed(this.#destroyRef))
      .subscribe({
        next: data => {
          this.clients.set(data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onSearch(value: string): void {
    this.#searchSubject.next(value);
  }

  onRowClick(client: Client): void {
    this.#router.navigate(['/clients', client.id]);
  }

  openForm(): void {
    this.selectedClient.set(null);
    this.formVisible.set(true);
  }

  onClientSaved(client: Client): void {
    this.formVisible.set(false);
    this.clients.update(list => {
      const idx = list.findIndex(c => c.id === client.id);
      if (idx >= 0) {
        const next = [...list];
        next[idx] = client;
        return next;
      }
      return [client, ...list];
    });
  }

  formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  }
}
