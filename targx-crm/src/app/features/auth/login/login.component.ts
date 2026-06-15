import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <!-- Logo -->
        <div class="login-logo">
          <span class="logo-text">TargX</span>
          <span class="logo-sub">CRM</span>
        </div>

        <h1 class="login-title">Bem-vindo</h1>
        <p class="login-subtitle">Inicia sessão na tua conta</p>

        <form [formGroup]="form" (ngSubmit)="onSubmit()" class="login-form">
          <!-- Email -->
          <div class="form-field">
            <label for="email" class="tx-form-label">Email</label>
            <input
              id="email"
              type="email"
              formControlName="email"
              class="tx-input"
              [class.error]="emailInvalid()"
              placeholder="nome@targx.com"
              autocomplete="email"
            />
            @if (emailInvalid()) {
              <span class="tx-field-error">Email inválido</span>
            }
          </div>

          <!-- Password -->
          <div class="form-field">
            <label for="password" class="tx-form-label">Password</label>
            <input
              id="password"
              type="password"
              formControlName="password"
              class="tx-input"
              [class.error]="passwordInvalid()"
              placeholder="A tua password"
              autocomplete="current-password"
            />
            @if (passwordInvalid()) {
              <span class="tx-field-error">Password obrigatória</span>
            }
          </div>

          <!-- Erro de autenticação -->
          @if (authError()) {
            <div class="login-error">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.5"/>
                <path d="M8 5v3.5M8 11h.01" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
              {{ authError() }}
            </div>
          }

          <button
            type="submit"
            class="tx-btn-primary login-btn"
            [disabled]="loading()"
          >
            @if (loading()) {
              A entrar...
            } @else {
              Entrar
            }
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      background: var(--bg-page);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
    }

    .login-card {
      background: var(--bg-surface);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-xl);
      box-shadow: var(--shadow-md);
      padding: 40px 48px;
      width: 100%;
      max-width: 400px;
    }

    .login-logo {
      display: flex;
      align-items: baseline;
      gap: 6px;
      margin-bottom: 32px;
    }

    .logo-text {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--tx-blue-950);
      letter-spacing: -0.02em;
    }

    .logo-sub {
      font-size: 0.75rem;
      font-weight: 600;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: var(--tx-teal-500);
    }

    .login-title {
      font-size: 1.5rem;
      font-weight: 700;
      color: var(--text-primary);
      letter-spacing: -0.015em;
      margin: 0 0 4px;
    }

    .login-subtitle {
      font-size: 0.875rem;
      color: var(--text-secondary);
      margin: 0 0 28px;
    }

    .login-form {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .form-field {
      display: flex;
      flex-direction: column;
    }

    .login-error {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #FEE2E2;
      color: #B91C1C;
      border-radius: var(--radius-md);
      font-size: 0.875rem;
      font-weight: 500;
    }

    .login-btn {
      width: 100%;
      padding: 10px 16px;
      font-size: 0.9375rem;
      margin-top: 4px;

      &:disabled {
        opacity: 0.65;
        cursor: not-allowed;
      }
    }
  `],
})
export class LoginComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);
  readonly #fb = inject(FormBuilder);

  readonly form = this.#fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  readonly loading = signal(false);
  readonly authError = signal<string | null>(null);

  readonly emailInvalid = () =>
    this.form.controls.email.invalid && this.form.controls.email.touched;

  readonly passwordInvalid = () =>
    this.form.controls.password.invalid && this.form.controls.password.touched;

  async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.authError.set(null);

    const { email, password } = this.form.getRawValue();
    const { error } = await this.#auth.signIn(email, password);

    if (error) {
      this.authError.set('Email ou password incorrectos. Tenta novamente.');
      this.loading.set(false);
      return;
    }

    this.#router.navigate(['/dashboard']);
  }
}
