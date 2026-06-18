import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { TabsModule } from 'primeng/tabs';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../../../core/supabase/supabase.client';
import { AuthService } from '../../../core/services/auth.service';

interface WebhookToken {
  id: string;
  name: string;
  token: string;
  active: boolean;
  last_used_at: string | null;
  created_at: string;
}

interface WebhookLog {
  id: string;
  token_id: string;
  lead_id: string | null;
  payload: Record<string, unknown>;
  created_at: string;
}

@Component({
  selector: 'app-webhooks',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, DialogModule, ToastModule, TabsModule],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header">
          <h1 class="page-title">Webhook de Entrada</h1>
          <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">
            Cria leads directamente no CRM via HTTP POST
          </p>
        </div>

        <div style="padding:0 24px 8px;background:var(--tx-gray-050);border-radius:8px;margin:0 24px 24px;border:1px solid var(--tx-gray-200)">
          <p style="font-size:0.75rem;color:var(--tx-gray-500);margin:12px 0 4px">Endpoint</p>
          <code style="font-size:0.8125rem;color:var(--tx-blue-600);font-family:'JetBrains Mono',monospace">
            https://crm.targx.com/functions/v1/webhook-lead
          </code>
        </div>

        <p-tabs>
          <p-tabpanels>
            <p-tabpanel header="Tokens">
              <div style="padding:16px 0 0">
                <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
                  <button class="tx-btn-primary" (click)="showCreate = true">
                    <i class="pi pi-plus mr-2"></i>Criar novo token
                  </button>
                </div>

                @if (tokens().length === 0) {
                  <p style="color:var(--tx-gray-400);text-align:center;padding:32px">Sem tokens criados.</p>
                } @else {
                  <table class="tx-table" style="width:100%">
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>Token</th>
                        <th>Estado</th>
                        <th>Último uso</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (t of tokens(); track t.id) {
                        <tr>
                          <td style="font-weight:500">{{ t.name }}</td>
                          <td>
                            <code style="font-size:0.75rem;color:var(--tx-gray-500)">
                              ••••••••{{ t.token.slice(-6) }}
                            </code>
                          </td>
                          <td>
                            <span class="tx-badge" [style.background]="t.active ? 'var(--tx-teal-100)' : 'var(--tx-gray-100)'" [style.color]="t.active ? 'var(--tx-teal-600)' : 'var(--tx-gray-500)'">
                              {{ t.active ? 'Activo' : 'Inactivo' }}
                            </span>
                          </td>
                          <td style="color:var(--tx-gray-500);font-size:0.8125rem">
                            {{ t.last_used_at ? (t.last_used_at | date:'dd/MM/yy HH:mm') : 'Nunca' }}
                          </td>
                          <td>
                            <button class="tx-btn-danger" style="padding:4px 10px;font-size:0.75rem" (click)="revokeToken(t)">
                              Revogar
                            </button>
                          </td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </p-tabpanel>

            <p-tabpanel header="Logs">
              <div style="padding:16px 0 0">
                @if (logs().length === 0) {
                  <p style="color:var(--tx-gray-400);text-align:center;padding:32px">Sem chamadas registadas.</p>
                } @else {
                  <table class="tx-table" style="width:100%">
                    <thead>
                      <tr><th>Data</th><th>Lead criada</th><th>Payload</th></tr>
                    </thead>
                    <tbody>
                      @for (l of logs(); track l.id) {
                        <tr>
                          <td style="font-size:0.8125rem;color:var(--tx-gray-500)">{{ l.created_at | date:'dd/MM HH:mm' }}</td>
                          <td style="font-size:0.8125rem">{{ l.lead_id ? l.lead_id.slice(0, 8) + '…' : '—' }}</td>
                          <td style="font-size:0.75rem;color:var(--tx-gray-400)">{{ l.payload['name'] ?? '—' }}</td>
                        </tr>
                      }
                    </tbody>
                  </table>
                }
              </div>
            </p-tabpanel>

            <p-tabpanel header="Documentação">
              <div style="padding:16px 0 0">
                <p style="font-size:0.875rem;color:var(--tx-gray-600);margin-bottom:16px">Exemplo mínimo:</p>
                <pre style="background:var(--tx-gray-950);color:#e5e7eb;padding:16px;border-radius:8px;font-size:0.75rem;overflow-x:auto">curl -X POST https://crm.targx.com/functions/v1/webhook-lead \\
  -H "Authorization: Bearer SEU_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d '&#123;"name": "Empresa XYZ", "email": "geral@empresa.pt", "source": "zapier"&#125;'</pre>

                <p style="font-size:0.875rem;color:var(--tx-gray-600);margin:16px 0 8px">Campos disponíveis:</p>
                <table class="tx-table" style="width:100%">
                  <thead><tr><th>Campo</th><th>Tipo</th><th>Obrigatório</th><th>Descrição</th></tr></thead>
                  <tbody>
                    @for (field of docFields; track field.name) {
                      <tr>
                        <td><code style="font-size:0.75rem">{{ field.name }}</code></td>
                        <td style="color:var(--tx-gray-500)">{{ field.type }}</td>
                        <td>{{ field.required ? '✓' : '' }}</td>
                        <td style="color:var(--tx-gray-500);font-size:0.8125rem">{{ field.desc }}</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </p-tabpanel>
          </p-tabpanels>
        </p-tabs>
      </div>
    </div>

    <p-dialog header="Criar token" [(visible)]="showCreate" [modal]="true" [style]="{width:'400px'}">
      <div style="padding:8px 0">
        <label class="tx-form-label">Nome do token</label>
        <input pInputText [(ngModel)]="newTokenName" placeholder="ex: Formulário Website" class="tx-input w-full" />
      </div>
      <ng-template #footer>
        <button class="tx-btn-secondary" (click)="showCreate = false">Cancelar</button>
        <button class="tx-btn-primary" (click)="createToken()" [disabled]="!newTokenName.trim()">Criar</button>
      </ng-template>
    </p-dialog>

    @if (createdToken()) {
      <p-dialog header="Token criado" [(visible)]="showTokenOnce" [modal]="true" [style]="{width:'480px'}">
        <p style="color:var(--tx-warning);font-size:0.875rem;margin-bottom:12px">
          <i class="pi pi-exclamation-triangle mr-2"></i>
          Guarda este token agora — não será mostrado novamente.
        </p>
        <code style="display:block;padding:12px;background:var(--tx-gray-050);border-radius:8px;font-size:0.8125rem;word-break:break-all">
          {{ createdToken() }}
        </code>
        <ng-template #footer>
          <button class="tx-btn-primary" (click)="copyToken()">
            <i class="pi pi-copy mr-2"></i>Copiar
          </button>
          <button class="tx-btn-secondary" (click)="showTokenOnce = false; createdToken.set(null)">Fechar</button>
        </ng-template>
      </p-dialog>
    }
  `,
})
export class WebhooksComponent implements OnInit {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #auth = inject(AuthService);
  readonly #msg = inject(MessageService);

  readonly tokens = signal<WebhookToken[]>([]);
  readonly logs = signal<WebhookLog[]>([]);
  readonly createdToken = signal<string | null>(null);

  showCreate = false;
  showTokenOnce = false;
  newTokenName = '';

  readonly docFields = [
    { name: 'name', type: 'string', required: true, desc: 'Nome da empresa ou contacto' },
    { name: 'email', type: 'string', required: false, desc: 'Email — usado para deduplicação' },
    { name: 'phone', type: 'string', required: false, desc: 'Telefone' },
    { name: 'website', type: 'string', required: false, desc: 'Website da empresa' },
    { name: 'sector', type: 'string', required: false, desc: 'Sector de actividade' },
    { name: 'title', type: 'string', required: false, desc: 'Título da lead (auto-gerado se omitido)' },
    { name: 'description', type: 'string', required: false, desc: 'Descrição / notas' },
    { name: 'estimated_value', type: 'number', required: false, desc: 'Valor estimado em euros' },
    { name: 'project_type', type: 'string', required: false, desc: 'Slug do tipo de projecto' },
    { name: 'source', type: 'string', required: false, desc: 'Identificador da ferramenta externa' },
  ];

  ngOnInit(): void {
    this.#load();
  }

  async #load(): Promise<void> {
    const profile = this.#auth.currentProfile();
    if (!profile) return;

    const [tokensRes, logsRes] = await Promise.all([
      this.#supabase.from('webhook_tokens').select('*').order('created_at', { ascending: false }),
      this.#supabase.from('webhook_logs').select('*').order('created_at', { ascending: false }).limit(50),
    ]);

    this.tokens.set((tokensRes.data ?? []) as WebhookToken[]);
    this.logs.set((logsRes.data ?? []) as WebhookLog[]);
  }

  async createToken(): Promise<void> {
    const profile = this.#auth.currentProfile();
    if (!profile || !this.newTokenName.trim()) return;

    const { data, error } = await this.#supabase
      .from('webhook_tokens')
      .insert({ name: this.newTokenName.trim(), owner_id: profile.id })
      .select('*')
      .single();

    if (error) {
      this.#msg.add({ severity: 'error', summary: 'Erro', detail: 'Não foi possível criar o token.' });
      return;
    }

    this.tokens.update(ts => [data as WebhookToken, ...ts]);
    this.createdToken.set((data as WebhookToken).token);
    this.showCreate = false;
    this.showTokenOnce = true;
    this.newTokenName = '';
  }

  async revokeToken(t: WebhookToken): Promise<void> {
    await this.#supabase.from('webhook_tokens').update({ active: false }).eq('id', t.id);
    this.tokens.update(ts => ts.map(tok => tok.id === t.id ? { ...tok, active: false } : tok));
    this.#msg.add({ severity: 'success', summary: 'Token revogado', detail: t.name });
  }

  copyToken(): void {
    const t = this.createdToken();
    if (t) navigator.clipboard.writeText(t);
    this.#msg.add({ severity: 'success', summary: 'Copiado!' });
  }
}
