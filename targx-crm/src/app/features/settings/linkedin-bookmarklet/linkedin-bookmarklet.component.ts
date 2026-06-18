import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { AuthService } from '../../../core/services/auth.service';
import { environment } from '../../../../environments/environment';

@Component({
  selector: 'app-linkedin-bookmarklet',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [MessageService],
  imports: [CommonModule, ButtonModule, ToastModule],
  template: `
    <p-toast />
    <div class="tx-page-content">
      <div class="tx-card">
        <div class="tx-card-header">
          <h1 class="page-title">LinkedIn Bookmarklet</h1>
          <p style="color:var(--tx-gray-500);font-size:0.875rem;margin-top:4px">
            Captura contactos do LinkedIn directamente para o CRM
          </p>
        </div>

        <div style="padding:24px;display:flex;flex-direction:column;gap:32px">

          <!-- Step 1 -->
          <div style="display:flex;gap:16px;align-items:flex-start">
            <div style="width:32px;height:32px;min-width:32px;border-radius:50%;background:var(--tx-teal-500);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">1</div>
            <div style="flex:1">
              <h3 style="font-size:1rem;font-weight:600;margin:0 0 8px">Instalar o bookmarklet</h3>
              <p style="color:var(--tx-gray-500);font-size:0.875rem;margin:0 0 16px">
                Arrasta o botão abaixo para a barra de favoritos do teu browser (Bookmarks Bar).
              </p>
              <a
                [href]="bookmarkletHref()"
                class="tx-btn-primary"
                style="display:inline-flex;align-items:center;gap:8px;cursor:grab;text-decoration:none"
                (click)="$event.preventDefault(); showInstallHint.set(true)"
                draggable="true"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg>
                TargX — Capturar Lead LinkedIn
              </a>

              @if (showInstallHint()) {
                <p style="margin-top:12px;color:var(--tx-warning);font-size:0.8125rem">
                  <i class="pi pi-info-circle mr-1"></i>
                  Clica e arrasta o botão para a tua barra de favoritos. Não cliques — arrasta.
                </p>
              }
            </div>
          </div>

          <!-- Step 2 -->
          <div style="display:flex;gap:16px;align-items:flex-start">
            <div style="width:32px;height:32px;min-width:32px;border-radius:50%;background:var(--tx-teal-500);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">2</div>
            <div style="flex:1">
              <h3 style="font-size:1rem;font-weight:600;margin:0 0 8px">Usar no LinkedIn</h3>
              <p style="color:var(--tx-gray-500);font-size:0.875rem;margin:0">
                Abre um perfil no LinkedIn, clica no bookmarklet, e a lead será criada automaticamente no CRM com os dados do perfil.
              </p>
            </div>
          </div>

          <!-- Step 3 -->
          <div style="display:flex;gap:16px;align-items:flex-start">
            <div style="width:32px;height:32px;min-width:32px;border-radius:50%;background:var(--tx-teal-500);color:white;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.875rem">3</div>
            <div style="flex:1">
              <h3 style="font-size:1rem;font-weight:600;margin:0 0 8px">Verificar no CRM</h3>
              <p style="color:var(--tx-gray-500);font-size:0.875rem;margin:0">
                A lead aparece na lista com estado "nova" e actividade "LinkedIn". Verás uma notificação de confirmação no browser após a captura.
              </p>
            </div>
          </div>

          <!-- Divider -->
          <hr style="border:none;border-top:1px solid var(--tx-gray-200)" />

          <!-- Tech info -->
          <div style="background:var(--tx-gray-050);border-radius:8px;padding:16px;border:1px solid var(--tx-gray-200)">
            <h4 style="font-size:0.875rem;font-weight:600;margin:0 0 8px;color:var(--tx-gray-700)">Dados capturados automaticamente</h4>
            <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:8px">
              @for (f of capturedFields; track f) {
                <div style="display:flex;align-items:center;gap:6px;font-size:0.8125rem;color:var(--tx-gray-600)">
                  <i class="pi pi-check-circle" style="color:var(--tx-teal-500)"></i>
                  {{ f }}
                </div>
              }
            </div>
          </div>

          <!-- API key info -->
          <div style="background:var(--tx-blue-950);border-radius:8px;padding:16px">
            <p style="font-size:0.75rem;color:var(--tx-gray-400);margin:0 0 4px">O bookmarklet usa a tua API key do CRM (incorporada no botão):</p>
            <code style="font-size:0.75rem;color:var(--tx-teal-300);font-family:'JetBrains Mono',monospace;word-break:break-all">
              Partner ID: {{ partnerId() }}
            </code>
            <p style="font-size:0.75rem;color:var(--tx-gray-500);margin:8px 0 0">
              <i class="pi pi-lock mr-1"></i>Não partilhes este botão — tem as tuas credenciais incorporadas.
            </p>
          </div>

        </div>
      </div>
    </div>
  `,
})
export class LinkedinBookmarkletComponent {
  readonly #auth = inject(AuthService);
  readonly #msg = inject(MessageService);

  readonly showInstallHint = signal(false);
  readonly partnerId = () => this.#auth.currentProfile()?.id ?? '';

  readonly capturedFields = [
    'Nome completo',
    'Empresa',
    'Cargo',
    'URL do perfil',
    'Localização',
    'Sector',
  ];

  readonly bookmarkletHref = () => {
    const apiUrl = `${environment.supabaseUrl}/functions/v1/capture-linkedin-lead`;
    const partnerId = this.partnerId();
    const code = `(function(){
var n=document.querySelector('.text-heading-xlarge');
var c=document.querySelector('.text-body-medium.break-words');
var t=document.querySelector('.pv-text-details__left-panel .text-body-small.inline.t-black--light.break-words');
var l=document.querySelector('.pv-text-details__left-panel li:first-child .text-body-small');
var d={name:n?n.innerText.trim():'',company:c?c.innerText.trim():'',title:t?t.innerText.trim():'',location:l?l.innerText.trim():'',linkedin_url:window.location.href,partner_id:'${partnerId}'};
fetch('${apiUrl}',{method:'POST',headers:{'Content-Type':'application/json','X-TX-API-Key':'${partnerId}'},body:JSON.stringify(d)})
.then(function(r){return r.json()})
.then(function(j){alert(j.success?'Lead capturada: '+d.name:'Erro: '+(j.error||'desconhecido'))})
.catch(function(e){alert('Erro ao capturar: '+e.message)});
})();`;
    return `javascript:${encodeURIComponent(code)}`;
  };
}
