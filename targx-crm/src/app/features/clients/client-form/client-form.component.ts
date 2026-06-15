import {
  ChangeDetectionStrategy,
  Component,
  inject,
  input,
  output,
  effect,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';

import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { DrawerModule } from 'primeng/drawer';

import { ClientService } from '../../../core/services/client.service';
import type { Client } from '../../../core/models/client.model';

@Component({
  selector: 'app-client-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule, DrawerModule],
  template: `
    <p-drawer
      [visible]="visible()"
      position="right"
      [style]="{ width: '480px' }"
      [header]="client() ? 'Editar cliente' : 'Novo cliente'"
      (visibleChange)="visibleChange.emit($event)"
    >
      <form [formGroup]="form" (ngSubmit)="onSubmit()" style="display: flex; flex-direction: column; gap: 16px; padding: 8px 0">

        <!-- Nome -->
        <div>
          <label class="tx-form-label">
            Nome <span style="color: var(--tx-danger)">*</span>
          </label>
          <input
            class="tx-input"
            type="text"
            formControlName="name"
            placeholder="Nome do cliente"
            style="width: 100%"
          />
          @if (form.controls.name.invalid && form.controls.name.touched) {
            <span class="tx-field-error">O nome é obrigatório.</span>
          }
        </div>

        <!-- NIF -->
        <div>
          <label class="tx-form-label">NIF</label>
          <input
            class="tx-input"
            type="text"
            formControlName="nif"
            placeholder="Número de identificação fiscal"
            style="width: 100%"
          />
        </div>

        <!-- Sector -->
        <div>
          <label class="tx-form-label">Sector</label>
          <input
            class="tx-input"
            type="text"
            formControlName="sector"
            placeholder="Ex: Tecnologia, Retalho…"
            style="width: 100%"
          />
        </div>

        <!-- Website -->
        <div>
          <label class="tx-form-label">Website</label>
          <input
            class="tx-input"
            type="url"
            formControlName="website"
            placeholder="https://…"
            style="width: 100%"
          />
        </div>

        <!-- Email -->
        <div>
          <label class="tx-form-label">Email</label>
          <input
            class="tx-input"
            type="email"
            formControlName="email"
            placeholder="email@empresa.pt"
            style="width: 100%"
          />
          @if (form.controls.email.invalid && form.controls.email.touched) {
            <span class="tx-field-error">Endereço de email inválido.</span>
          }
        </div>

        <!-- Telefone -->
        <div>
          <label class="tx-form-label">Telefone</label>
          <input
            class="tx-input"
            type="tel"
            formControlName="phone"
            placeholder="+351 900 000 000"
            style="width: 100%"
          />
        </div>

        <!-- Morada -->
        <div>
          <label class="tx-form-label">Morada</label>
          <input
            class="tx-input"
            type="text"
            formControlName="address"
            placeholder="Rua, número, cidade"
            style="width: 100%"
          />
        </div>

        <!-- Notas -->
        <div>
          <label class="tx-form-label">Notas</label>
          <textarea
            class="tx-input"
            formControlName="notes"
            placeholder="Informação adicional…"
            rows="3"
            style="width: 100%; resize: vertical"
          ></textarea>
        </div>

      </form>

      <ng-template pTemplate="footer">
        <div style="display: flex; gap: 8px; justify-content: flex-end">
          <button
            type="button"
            class="tx-btn-secondary"
            (click)="visibleChange.emit(false)"
          >
            Cancelar
          </button>
          <button
            type="button"
            class="tx-btn-primary"
            [disabled]="saving() || form.invalid"
            (click)="onSubmit()"
          >
            @if (saving()) {
              <i class="pi pi-spin pi-spinner" style="margin-right: 6px"></i>
            }
            Guardar
          </button>
        </div>
      </ng-template>
    </p-drawer>
  `,
})
export class ClientFormComponent {
  readonly #clientService = inject(ClientService);
  readonly #fb = inject(FormBuilder);

  readonly visible = input<boolean>(false);
  readonly client = input<Client | null>(null);
  readonly visibleChange = output<boolean>();
  readonly saved = output<Client>();

  readonly saving = signal(false);

  readonly form = this.#fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    nif: [''],
    sector: [''],
    website: [''],
    email: ['', [Validators.email]],
    phone: [''],
    address: [''],
    notes: [''],
  });

  constructor() {
    effect(() => {
      const c = this.client();
      if (c) {
        this.form.patchValue({
          name: c.name,
          nif: c.nif ?? '',
          sector: c.sector ?? '',
          website: c.website ?? '',
          email: c.email ?? '',
          phone: c.phone ?? '',
          address: c.address ?? '',
          notes: c.notes ?? '',
        });
      } else {
        this.form.reset();
      }
    });
  }

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const values = this.form.getRawValue();

    const payload = {
      name: values.name,
      nif: values.nif || null,
      sector: values.sector || null,
      website: values.website || null,
      email: values.email || null,
      phone: values.phone || null,
      address: values.address || null,
      notes: values.notes || null,
      created_by: null,
    };

    try {
      const existing = this.client();
      const result = existing
        ? await this.#clientService.update(existing.id, payload)
        : await this.#clientService.create(payload);
      this.saved.emit(result);
      this.form.reset();
    } finally {
      this.saving.set(false);
    }
  }
}
