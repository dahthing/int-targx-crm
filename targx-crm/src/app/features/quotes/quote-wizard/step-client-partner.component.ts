import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  OnInit,
  output,
  signal,
  computed,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SelectModule } from 'primeng/select';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/services/auth.service';
import type { Client } from '../../../core/models/client.model';

interface PartnerOption {
  id: string;
  full_name: string;
  email: string;
}

export interface ClientPartnerPayload {
  partnerId: string;
  clientId: string;
}

@Component({
  selector: 'app-step-client-partner',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, FormsModule, SelectModule],
  template: `
    <div class="p-6">
      <h2 class="text-h3 mb-2">Cliente e parceiro</h2>
      <p class="text-[var(--tx-gray-500)] mb-6">Associe o orçamento a um cliente e a um parceiro.</p>

      @if (loading()) {
        <div class="flex justify-center py-12">
          <i class="pi pi-spin pi-spinner text-3xl text-[var(--tx-teal-500)]"></i>
        </div>
      } @else {
        <div class="flex flex-col gap-6" style="max-width: 520px">

          <!-- Partner -->
          <div class="tx-field">
            <label class="tx-form-label">
              Parceiro <span class="text-red-500">*</span>
            </label>
            <p-select
              [options]="partners()"
              [(ngModel)]="selectedPartnerId"
              optionValue="id"
              optionLabel="full_name"
              placeholder="Seleccionar parceiro…"
              [style]="{'width':'100%'}"
              styleClass="tx-input"
              [filter]="true"
              filterBy="full_name,email"
              (onChange)="emitIfValid()"
            >
              <ng-template #item let-p>
                <div>
                  <div class="font-medium text-[var(--tx-gray-800)]">{{ p.full_name }}</div>
                  <div class="text-xs text-[var(--tx-gray-400)]">{{ p.email }}</div>
                </div>
              </ng-template>
            </p-select>
          </div>

          <!-- Client -->
          <div class="tx-field">
            <label class="tx-form-label">
              Cliente <span class="text-red-500">*</span>
            </label>
            <p-select
              [options]="clients()"
              [(ngModel)]="selectedClientId"
              optionValue="id"
              optionLabel="name"
              placeholder="Seleccionar cliente…"
              styleClass="w-full tx-input"
              [filter]="true"
              filterBy="name,email"
              (onChange)="emitIfValid()"
            >
              <ng-template #item let-c>
                <div>
                  <div class="font-medium text-[var(--tx-gray-800)]">{{ c.name }}</div>
                  @if (c.email) {
                    <div class="text-xs text-[var(--tx-gray-400)]">{{ c.email }}</div>
                  }
                </div>
              </ng-template>
            </p-select>
          </div>

          @if (!isValid()) {
            <p class="text-sm text-[var(--tx-gray-400)]">
              <i class="pi pi-info-circle mr-1"></i>Seleccione parceiro e cliente para continuar.
            </p>
          }

        </div>
      }
    </div>
  `,
})
export class StepClientPartnerComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #auth = inject(AuthService);

  readonly prefilledClientId = input<string>('');
  readonly selectionChanged = output<ClientPartnerPayload>();

  readonly partners = signal<PartnerOption[]>([]);
  readonly clients = signal<Client[]>([]);
  readonly loading = signal(true);

  selectedPartnerId = '';
  selectedClientId = '';

  readonly isAdmin = computed(() => this.#auth.role() === 'admin');
  readonly currentPartnerName = computed(() => this.#auth.currentProfile()?.full_name ?? '');

  readonly isValid = computed(() => !!this.selectedPartnerId && !!this.selectedClientId);

  async ngOnInit(): Promise<void> {
    const [partnersRes, clientsRes] = await Promise.all([
      this.#supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('role', ['admin', 'partner'])
        .order('full_name'),
      this.#supabase
        .from('clients')
        .select('*')
        .order('name'),
    ]);

    this.partners.set((partnersRes.data ?? []) as PartnerOption[]);
    this.clients.set((clientsRes.data ?? []) as Client[]);
    this.loading.set(false);

    // Pre-select own profile as default partner (admin = TargX by default; partner = themselves)
    const profile = this.#auth.currentProfile();
    if (profile && !this.selectedPartnerId) {
      this.selectedPartnerId = profile.id;
    }

    // Pre-fill client from query param
    const prefilled = this.prefilledClientId();
    if (prefilled) {
      this.selectedClientId = prefilled;
    }

    this.emitIfValid();
  }

  emitIfValid(): void {
    if (this.selectedPartnerId && this.selectedClientId) {
      this.selectionChanged.emit({
        partnerId: this.selectedPartnerId,
        clientId: this.selectedClientId,
      });
    }
  }
}
