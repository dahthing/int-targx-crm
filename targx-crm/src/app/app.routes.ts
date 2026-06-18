import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { AppShellComponent } from './shared/components/app-shell/app-shell.component';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./features/auth/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'client/quotes/:token',
    loadComponent: () =>
      import('./features/client-portal/client-portal/client-portal.component').then(
        m => m.ClientPortalComponent,
      ),
  },
  {
    path: '',
    component: AppShellComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./features/dashboard/dashboard-shell/dashboard-shell.component').then(
            m => m.DashboardShellComponent,
          ),
      },
      {
        path: 'clients',
        loadComponent: () =>
          import('./features/clients/client-list/client-list.component').then(
            m => m.ClientListComponent,
          ),
      },
      {
        path: 'clients/:id',
        loadComponent: () =>
          import('./features/clients/client-detail/client-detail.component').then(
            m => m.ClientDetailComponent,
          ),
      },
      {
        path: 'leads',
        loadComponent: () =>
          import('./features/leads/lead-list/lead-list.component').then(
            m => m.LeadListComponent,
          ),
      },
      {
        path: 'leads/:leadId',
        loadComponent: () =>
          import('./features/leads/lead-detail/lead-detail.component').then(
            m => m.LeadDetailComponent,
          ),
      },
      {
        path: 'quotes',
        loadComponent: () =>
          import('./features/quotes/quote-list/quote-list.component').then(
            m => m.QuoteListComponent,
          ),
      },
      {
        path: 'quotes/new',
        loadComponent: () =>
          import('./features/quotes/quote-wizard/quote-wizard.component').then(
            m => m.QuoteWizardComponent,
          ),
      },
      {
        path: 'quotes/:id/build',
        loadComponent: () =>
          import('./features/quotes/quote-builder/quote-builder.component').then(
            m => m.QuoteBuilderComponent,
          ),
      },
      {
        path: 'quotes/:id/preview',
        loadComponent: () =>
          import('./features/quotes/quote-preview/quote-preview.component').then(
            m => m.QuotePreviewComponent,
          ),
      },
      {
        path: 'quotes/:id/versions',
        loadComponent: () =>
          import('./features/quotes/quote-versions/quote-versions.component').then(
            m => m.QuoteVersionsComponent,
          ),
      },
      {
        path: 'quotes/:id/review',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/quotes/quote-review/quote-review.component').then(
            m => m.QuoteReviewComponent,
          ),
      },
      {
        path: 'projects',
        loadComponent: () =>
          import('./features/projects/project-list/project-list.component').then(
            m => m.ProjectListComponent,
          ),
      },
      {
        path: 'projects/:id',
        loadComponent: () =>
          import('./features/projects/project-detail/project-detail.component').then(
            m => m.ProjectDetailComponent,
          ),
      },
      {
        path: 'projects/:id/gantt',
        loadComponent: () =>
          import('./features/projects/project-gantt/project-gantt.component').then(
            m => m.ProjectGanttComponent,
          ),
      },
      {
        path: 'commissions',
        loadComponent: () =>
          import('./features/commissions/commission-list/commission-list.component').then(
            m => m.CommissionListComponent,
          ),
      },
      {
        path: 'commissions/:partnerId/:year',
        loadComponent: () =>
          import('./features/commissions/commission-detail/commission-detail.component').then(
            m => m.CommissionDetailComponent,
          ),
      },
      {
        path: 'knowledge/objections',
        loadComponent: () =>
          import('./features/knowledge/objection-playbook/objection-playbook.component').then(
            m => m.ObjectionPlaybookComponent,
          ),
      },
      {
        path: 'settings',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/settings-shell/settings-shell.component').then(
            m => m.SettingsShellComponent,
          ),
      },
      {
        path: 'settings/partner-targets',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/partner-targets/partner-targets.component').then(
            m => m.PartnerTargetsComponent,
          ),
      },
      {
        path: 'settings/project-types',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/project-types/project-types.component').then(
            m => m.ProjectTypesComponent,
          ),
      },
      {
        path: 'settings/scoping-questions',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/scoping-questions/scoping-questions.component').then(
            m => m.ScopingQuestionsComponent,
          ),
      },
      {
        path: 'settings/risk-multipliers',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/risk-multipliers/risk-multipliers.component').then(
            m => m.RiskMultipliersComponent,
          ),
      },
      {
        path: 'settings/rate-profiles',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/rate-profiles/rate-profiles.component').then(
            m => m.RateProfilesComponent,
          ),
      },
      {
        path: 'settings/catalog',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/catalog/catalog.component').then(
            m => m.CatalogSettingsComponent,
          ),
      },
      {
        path: 'settings/quote-templates',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/quote-templates/quote-templates.component').then(
            m => m.QuoteTemplatesComponent,
          ),
      },
      {
        path: 'settings/global',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/global-settings/global-settings.component').then(
            m => m.GlobalSettingsComponent,
          ),
      },
      {
        path: 'settings/commission-plans',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/commission-plans/commission-plans.component').then(
            m => m.CommissionPlansComponent,
          ),
      },
      {
        path: 'settings/partners',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/partner-management/partner-management.component').then(
            m => m.PartnerManagementComponent,
          ),
      },
      {
        path: 'settings/audit-log',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/audit-log/audit-log.component').then(
            m => m.AuditLogComponent,
          ),
      },
      {
        path: 'settings/webhooks',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/webhooks/webhooks.component').then(
            m => m.WebhooksComponent,
          ),
      },
      {
        path: 'settings/management-reports',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/management-reports/management-reports.component').then(
            m => m.ManagementReportsComponent,
          ),
      },
      {
        path: 'settings/roi-benchmarks',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/settings/roi-benchmarks/roi-benchmarks.component').then(
            m => m.RoiBenchmarksComponent,
          ),
      },
      {
        path: 'settings/linkedin-bookmarklet',
        canActivate: [roleGuard(['admin', 'partner'])],
        loadComponent: () =>
          import('./features/settings/linkedin-bookmarklet/linkedin-bookmarklet.component').then(
            m => m.LinkedinBookmarkletComponent,
          ),
      },
      {
        path: 'analytics',
        canActivate: [roleGuard(['admin'])],
        loadComponent: () =>
          import('./features/analytics/analytics-dashboard.component').then(
            m => m.AnalyticsDashboardComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'dashboard' },
];
