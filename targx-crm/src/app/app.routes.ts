import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'dashboard',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/dashboard/dashboard-shell/dashboard-shell.component').then(
        m => m.DashboardShellComponent,
      ),
  },
  {
    path: 'clients',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/clients/client-list/client-list.component').then(
        m => m.ClientListComponent,
      ),
  },
  {
    path: 'clients/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/clients/client-detail/client-detail.component').then(
        m => m.ClientDetailComponent,
      ),
  },
  {
    path: 'leads',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/leads/lead-list/lead-list.component').then(
        m => m.LeadListComponent,
      ),
  },
  {
    path: 'leads/:leadId',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/leads/lead-detail/lead-detail.component').then(
        m => m.LeadDetailComponent,
      ),
  },
  {
    path: 'quotes',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quotes/quote-list/quote-list.component').then(
        m => m.QuoteListComponent,
      ),
  },
  {
    path: 'quotes/new',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quotes/quote-wizard/quote-wizard.component').then(
        m => m.QuoteWizardComponent,
      ),
  },
  {
    path: 'quotes/:id/build',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quotes/quote-builder/quote-builder.component').then(
        m => m.QuoteBuilderComponent,
      ),
  },
  {
    path: 'quotes/:id/preview',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quotes/quote-preview/quote-preview.component').then(
        m => m.QuotePreviewComponent,
      ),
  },
  {
    path: 'quotes/:id/versions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/quotes/quote-versions/quote-versions.component').then(
        m => m.QuoteVersionsComponent,
      ),
  },
  {
    path: 'quotes/:id/review',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/quotes/quote-review/quote-review.component').then(
        m => m.QuoteReviewComponent,
      ),
  },
  {
    path: 'projects',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-list/project-list.component').then(
        m => m.ProjectListComponent,
      ),
  },
  {
    path: 'projects/:id',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-detail/project-detail.component').then(
        m => m.ProjectDetailComponent,
      ),
  },
  {
    path: 'projects/:id/gantt',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/projects/project-gantt/project-gantt.component').then(
        m => m.ProjectGanttComponent,
      ),
  },
  {
    path: 'commissions',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/commissions/commission-list/commission-list.component').then(
        m => m.CommissionListComponent,
      ),
  },
  {
    path: 'commissions/:partnerId/:year',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/commissions/commission-detail/commission-detail.component').then(
        m => m.CommissionDetailComponent,
      ),
  },
  {
    path: 'knowledge/objections',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/knowledge/objection-playbook/objection-playbook.component').then(
        m => m.ObjectionPlaybookComponent,
      ),
  },
  {
    path: 'settings',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/settings-shell/settings-shell.component').then(
        m => m.SettingsShellComponent,
      ),
  },
  {
    path: 'settings/partner-targets',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/partner-targets/partner-targets.component').then(
        m => m.PartnerTargetsComponent,
      ),
  },
  {
    path: 'settings/project-types',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/project-types/project-types.component').then(
        m => m.ProjectTypesComponent,
      ),
  },
  {
    path: 'settings/scoping-questions',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/scoping-questions/scoping-questions.component').then(
        m => m.ScopingQuestionsComponent,
      ),
  },
  {
    path: 'settings/risk-multipliers',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/risk-multipliers/risk-multipliers.component').then(
        m => m.RiskMultipliersComponent,
      ),
  },
  {
    path: 'settings/rate-profiles',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/rate-profiles/rate-profiles.component').then(
        m => m.RateProfilesComponent,
      ),
  },
  {
    path: 'settings/catalog',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/catalog/catalog.component').then(
        m => m.CatalogSettingsComponent,
      ),
  },
  {
    path: 'settings/global',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/global-settings/global-settings.component').then(
        m => m.GlobalSettingsComponent,
      ),
  },
  {
    path: 'settings/commission-plans',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/commission-plans/commission-plans.component').then(
        m => m.CommissionPlansComponent,
      ),
  },
  {
    path: 'settings/partners',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/partner-management/partner-management.component').then(
        m => m.PartnerManagementComponent,
      ),
  },
  {
    path: 'settings/audit-log',
    canActivate: [authGuard, roleGuard(['admin'])],
    loadComponent: () =>
      import('./features/settings/audit-log/audit-log.component').then(
        m => m.AuditLogComponent,
      ),
  },
  {
    path: 'client/quotes/:token',
    loadComponent: () =>
      import('./features/client-portal/client-portal/client-portal.component').then(
        m => m.ClientPortalComponent,
      ),
  },
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: '**', redirectTo: 'dashboard' },
];
