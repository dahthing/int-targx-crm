import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-settings-shell',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="p-6">
      <h1 class="text-h2 text-[var(--tx-gray-950)] mb-6">Configuração</h1>

      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <a routerLink="/settings/partner-targets" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Metas Trimestrais">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-teal-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-teal-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Metas Trimestrais</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Define objectivos de volume por parceiro e trimestre.</p>
          </div>
        </a>

        <a routerLink="/settings/project-types" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Tipos de projecto">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-blue-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-blue-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Tipos de projecto</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Categorias de projecto com preços e horas base.</p>
          </div>
        </a>

        <a routerLink="/settings/scoping-questions" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Perguntas de scoping">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-teal-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-teal-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Perguntas de scoping</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Questionário de levantamento por tipo de projecto.</p>
          </div>
        </a>

        <a routerLink="/settings/risk-multipliers" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Multiplicadores de risco">
          <div class="w-10 h-10 rounded-lg bg-red-50 flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-danger)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Multiplicadores de risco</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Factores de risco que ajustam o preço final.</p>
          </div>
        </a>

        <a routerLink="/settings/rate-profiles" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Perfis de taxa horária">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-gold-bg)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-gold)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Perfis de taxa horária</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Tarifas por hora aplicadas aos itens do orçamento.</p>
          </div>
        </a>

        <a routerLink="/settings/catalog" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Catálogo de itens">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-blue-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-blue-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Catálogo de itens</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Itens reutilizáveis no construtor de orçamentos.</p>
          </div>
        </a>

        <a routerLink="/settings/global" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Configurações Globais">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-teal-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-teal-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Configurações Globais</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Parâmetros do sistema: IVA, margens, capacidade diária.</p>
          </div>
        </a>

        <a routerLink="/settings/commission-plans" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Planos de Comissão">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-teal-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-teal-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Planos de Comissão</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Tiers de volume, taxas e bónus anuais por plano.</p>
          </div>
        </a>

        <a routerLink="/settings/partners" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Gestão de Parceiros">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-blue-050)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-blue-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Gestão de Parceiros</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Convidar parceiros, atribuir planos e ver métricas.</p>
          </div>
        </a>

        <a routerLink="/settings/audit-log" class="tx-card p-5 flex items-start gap-4 hover:border-[var(--tx-teal-500)] transition-colors cursor-pointer no-underline" aria-label="Audit Log">
          <div class="w-10 h-10 rounded-lg bg-[var(--tx-gray-100)] flex items-center justify-center shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 text-[var(--tx-gray-600)]" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>
          </div>
          <div>
            <p class="text-body font-semibold text-[var(--tx-gray-950)]">Audit Log</p>
            <p class="text-body-sm text-[var(--tx-gray-600)] mt-0.5">Registo imutável de alterações a campos críticos.</p>
          </div>
        </a>
      </div>
    </div>
  `,
})
export class SettingsShellComponent {}
