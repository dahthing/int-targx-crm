import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { DrawerModule } from 'primeng/drawer';
import { SelectModule } from 'primeng/select';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { LeadService } from '../../../core/services/lead.service';
import { ClientService } from '../../../core/services/client.service';
import { AuthService } from '../../../core/services/auth.service';
import { Client } from '../../../core/models/client.model';

@Component({
  selector: 'app-lead-form',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [DrawerModule, SelectModule, ButtonModule, InputTextModule, ReactiveFormsModule],
  template: `
    <p-drawer
      [visible]="visible()"
      (visibleChange)="visible.set($event)"
      header="Nova lead"
      position="right"
      styleClass="w-[480px]"
    >
      <form [formGroup]="form" (ngSubmit)="submit()" class="flex flex-col gap-4">
        <!-- Título -->
        <div class="tx-field">
          <label class="tx-form-label" for="title">Título *</label>
          <input
            id="title"
            pInputText
            class="tx-input w-full"
            formControlName="title"
            placeholder="Título da lead"
          />
          @if (form.get('title')?.invalid && form.get('title')?.touched) {
            <span class="tx-field-error">Título é obrigatório</span>
          }
        </div>

        <!-- Cliente -->
        <div class="tx-field">
          <label class="tx-form-label" for="client">Cliente</label>
          <p-select
            id="client"
            [options]="clientOptions()"
            optionLabel="name"
            optionValue="id"
            formControlName="client_id"
            placeholder="Seleccionar cliente"
            [filter]="true"
            filterBy="name"
            styleClass="w-full"
          />
        </div>

        <!-- Valor estimado -->
        <div class="tx-field">
          <label class="tx-form-label" for="value">Valor estimado (€)</label>
          <input
            id="value"
            pInputText
            type="number"
            class="tx-input w-full"
            formControlName="estimated_value"
            placeholder="0"
          />
        </div>

        <!-- Fonte -->
        <div class="tx-field">
          <label class="tx-form-label" for="source">Fonte</label>
          <input
            id="source"
            pInputText
            class="tx-input w-full"
            formControlName="source"
            placeholder="Referência, evento, website..."
          />
        </div>

        <!-- Próxima acção -->
        <div class="tx-field">
          <label class="tx-form-label" for="next_action">Próxima acção</label>
          <input
            id="next_action"
            pInputText
            class="tx-input w-full"
            formControlName="next_action"
            placeholder="O que fazer a seguir?"
          />
        </div>

        <!-- Data próxima acção -->
        <div class="tx-field">
          <label class="tx-form-label" for="next_action_date">Data próxima acção</label>
          <input
            id="next_action_date"
            pInputText
            type="date"
            class="tx-input w-full"
            formControlName="next_action_date"
          />
        </div>

        @if (errorMessage()) {
          <p class="text-sm text-red-600">{{ errorMessage() }}</p>
        }

        <!-- Actions -->
        <div class="flex justify-end gap-3 mt-4">
          <button
            type="button"
            class="tx-btn-secondary"
            (click)="visible.set(false)"
            [disabled]="saving()"
          >
            Cancelar
          </button>
          <button
            type="submit"
            class="tx-btn-primary"
            [disabled]="form.invalid || saving()"
          >
            {{ saving() ? 'A criar...' : 'Criar lead' }}
          </button>
        </div>
      </form>
    </p-drawer>
  `,
})
export class LeadFormComponent implements OnInit {
  private readonly leadService = inject(LeadService);
  private readonly clientService = inject(ClientService);
  private readonly authService = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  readonly visible = model<boolean>(false);
  readonly leadCreated = output<void>();

  protected readonly clients = signal<Client[]>([]);
  protected readonly saving = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly clientOptions = computed(() => this.clients());

  protected readonly form = this.fb.nonNullable.group({
    title: ['', Validators.required],
    client_id: [''],
    estimated_value: [null as number | null],
    source: [''],
    next_action: [''],
    next_action_date: [''],
  });

  ngOnInit(): void {
    this.clientService.getAll().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: clients => this.clients.set(clients),
    });
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.saving.set(true);
    this.errorMessage.set(null);

    const profile = this.authService.currentProfile();
    if (!profile) {
      this.errorMessage.set('Utilizador não autenticado');
      this.saving.set(false);
      return;
    }

    const raw = this.form.getRawValue();
    try {
      await this.leadService.create({
        title: raw.title,
        partner_id: profile.id,
        client_id: raw.client_id || undefined,
        estimated_value: raw.estimated_value ?? undefined,
        source: raw.source || undefined,
        next_action: raw.next_action || undefined,
        next_action_date: raw.next_action_date || undefined,
      });
      this.form.reset();
      this.leadCreated.emit();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao criar lead';
      this.errorMessage.set(msg);
    } finally {
      this.saving.set(false);
    }
  }
}
