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
  template: `
    <div class="p-6">
      <div class="tx-card">
        <div class="tx-card-header">
          <h1 class="text-xl font-semibold" style="color: var(--text-primary)">Clientes</h1>
          <button class="tx-btn-primary" (click)="openForm()">
            <i class="pi pi-plus" style="margin-right: 6px"></i>
            Novo cliente
          </button>
        </div>

        <div style="margin-bottom: 16px">
          <input
            class="tx-input"
            type="text"
            placeholder="Pesquisar por nome ou NIF…"
            [(ngModel)]="searchValue"
            (ngModelChange)="onSearch($event)"
            style="width: 100%; max-width: 360px"
          />
        </div>

        <div class="tx-table">
          <p-table
            [value]="clients()"
            [loading]="loading()"
            [rows]="20"
            [paginator]="true"
            [rowHover]="true"
            styleClass="p-datatable-sm"
            (onRowSelect)="onRowClick($event.data)"
            selectionMode="single"
          >
            <ng-template pTemplate="header">
              <tr>
                <th>Nome</th>
                <th>Sector</th>
                <th>Email</th>
                <th>Telefone</th>
                <th>Data de criação</th>
              </tr>
            </ng-template>
            <ng-template pTemplate="body" let-client>
              <tr
                style="cursor: pointer"
                (click)="onRowClick(client)"
              >
                <td>
                  <span style="font-weight: 500; color: var(--text-primary)">{{ client.name }}</span>
                </td>
                <td>
                  @if (client.sector) {
                    <span class="tx-badge">{{ client.sector }}</span>
                  } @else {
                    <span style="color: var(--text-muted)">—</span>
                  }
                </td>
                <td style="color: var(--text-secondary)">{{ client.email ?? '—' }}</td>
                <td style="color: var(--text-secondary)">{{ client.phone ?? '—' }}</td>
                <td style="color: var(--text-muted); font-size: 0.75rem">
                  {{ formatDate(client.created_at) }}
                </td>
              </tr>
            </ng-template>
            <ng-template pTemplate="emptymessage">
              <tr>
                <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 40px 0">
                  @if (loading()) {
                    A carregar clientes…
                  } @else {
                    Nenhum cliente encontrado.
                  }
                </td>
              </tr>
            </ng-template>
          </p-table>
        </div>
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
      return idx >= 0 ? list.with(idx, client) : [client, ...list];
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
