import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { AuthService } from '../../../core/services/auth.service';
import { PartnerDashboardComponent } from '../partner-dashboard/partner-dashboard.component';
import { AdminDashboardComponent } from '../admin-dashboard/admin-dashboard.component';

@Component({
  selector: 'app-dashboard-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PartnerDashboardComponent, AdminDashboardComponent],
  template: `
    @if (role() === 'partner') {
      <app-partner-dashboard />
    } @else if (role() === 'admin' || role() === 'tech') {
      <app-admin-dashboard />
    } @else {
      <div class="p-6" style="color: var(--text-muted)">A verificar permissões…</div>
    }
  `,
})
export class DashboardShellComponent {
  protected readonly role = inject(AuthService).role;
}
