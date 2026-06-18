import {
  ChangeDetectionStrategy,
  Component,
  ViewEncapsulation,
  computed,
  inject,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { NotificationBellComponent } from '../notification-bell/notification-bell.component';

interface NavItem {
  label: string;
  route: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Dashboard',    route: '/dashboard',            icon: 'pi-home' },
  { label: 'Clientes',     route: '/clients',              icon: 'pi-building' },
  { label: 'Leads',        route: '/leads',                icon: 'pi-users' },
  { label: 'Orçamentos',   route: '/quotes',               icon: 'pi-file-edit', roles: ['admin', 'partner'] },
  { label: 'Projectos',    route: '/projects',             icon: 'pi-briefcase' },
  { label: 'Comissões',    route: '/commissions',          icon: 'pi-chart-line', roles: ['admin', 'partner'] },
  { label: 'Conhecimento', route: '/knowledge/objections', icon: 'pi-book',       roles: ['admin', 'partner'] },
];

@Component({
  selector: 'app-shell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, NotificationBellComponent],
  template: `
    <div class="shell-layout">
      <aside class="sidebar">
        <div class="sidebar-logo">
          <span class="logo-tx">TargX</span>
          <span class="logo-crm">CRM</span>
        </div>

        <nav class="sidebar-nav">
          @for (item of visibleNav(); track item.route) {
            <a
              [routerLink]="item.route"
              routerLinkActive="nav-item-active"
              class="nav-item"
              [attr.aria-label]="item.label">
              <i class="pi {{ item.icon }}"></i>
              <span>{{ item.label }}</span>
            </a>
          }
        </nav>

        @if (role() === 'admin') {
          <div class="sidebar-section-label">Administração</div>
          <nav class="sidebar-nav">
            <a routerLink="/analytics" routerLinkActive="nav-item-active" class="nav-item">
              <i class="pi pi-chart-bar"></i>
              <span>Analytics</span>
            </a>
            <a routerLink="/settings" routerLinkActive="nav-item-active" class="nav-item">
              <i class="pi pi-cog"></i>
              <span>Configurações</span>
            </a>
          </nav>
        }

        <div class="sidebar-footer">
          <div class="sidebar-user">
            <div class="user-avatar">{{ userInitials() }}</div>
            <div class="user-info">
              <span class="user-name">{{ userName() }}</span>
              <span class="user-role">{{ roleLabel() }}</span>
            </div>
          </div>
          <button class="logout-btn" (click)="signOut()" aria-label="Terminar sessão">
            <i class="pi pi-sign-out"></i>
          </button>
        </div>
      </aside>

      <div class="main-area">
        <header class="topbar">
          <div class="topbar-left"></div>
          <div class="topbar-right" style="display:flex;align-items:center;gap:12px">
            <app-notification-bell />
            <span style="font-size:0.875rem;color:var(--text-secondary);font-weight:500">{{ userName() }}</span>
          </div>
        </header>
        <main class="page-content">
          <router-outlet />
        </main>
      </div>
    </div>
  `,
  styles: [`
    .shell-layout { display:flex; height:100vh; overflow:hidden; background:var(--bg-page); }
    .sidebar { width:256px; flex-shrink:0; background:var(--tx-blue-950); display:flex; flex-direction:column; border-right:1px solid rgba(255,255,255,0.06); }
    .sidebar-logo { height:64px; display:flex; align-items:center; gap:6px; padding:0 20px; border-bottom:1px solid rgba(255,255,255,0.08); flex-shrink:0; }
    .logo-tx { font-size:1.125rem; font-weight:700; color:#fff; letter-spacing:-0.02em; }
    .logo-crm { font-size:0.75rem; font-weight:500; color:var(--tx-teal-400); letter-spacing:0.06em; text-transform:uppercase; margin-top:2px; }
    .sidebar-nav { display:flex; flex-direction:column; padding:8px; gap:2px; }
    .sidebar-section-label { font-size:0.6875rem; font-weight:600; letter-spacing:0.08em; text-transform:uppercase; color:rgba(255,255,255,0.3); padding:16px 20px 4px; }
    .nav-item { display:flex; align-items:center; gap:10px; height:40px; padding:0 12px; border-radius:8px; color:rgba(255,255,255,0.6); font-size:0.875rem; font-weight:500; text-decoration:none; transition:background 0.15s ease, color 0.15s ease; }
    .nav-item:hover { background:rgba(255,255,255,0.06); color:rgba(255,255,255,0.9); }
    .nav-item i { font-size:1rem; width:18px; text-align:center; flex-shrink:0; }
    .nav-item-active { background:var(--tx-teal-500) !important; color:#fff !important; }
    .sidebar-footer { margin-top:auto; padding:12px; border-top:1px solid rgba(255,255,255,0.08); display:flex; align-items:center; gap:8px; }
    .sidebar-user { display:flex; align-items:center; gap:10px; flex:1; min-width:0; }
    .user-avatar { width:32px; height:32px; border-radius:50%; background:var(--tx-teal-500); color:#fff; font-size:0.75rem; font-weight:700; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
    .user-info { display:flex; flex-direction:column; min-width:0; }
    .user-name { font-size:0.8125rem; font-weight:500; color:rgba(255,255,255,0.9); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .user-role { font-size:0.6875rem; color:rgba(255,255,255,0.4); text-transform:capitalize; }
    .logout-btn { background:none; border:none; color:rgba(255,255,255,0.4); cursor:pointer; padding:6px; border-radius:6px; transition:color 0.15s ease, background 0.15s ease; line-height:1; }
    .logout-btn:hover { color:rgba(255,255,255,0.8); background:rgba(255,255,255,0.06); }
    .main-area { flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden; }
    .topbar { height:64px; background:#fff; border-bottom:1px solid var(--tx-gray-200); display:flex; align-items:center; justify-content:space-between; padding:0 24px; flex-shrink:0; }
    .topbar-right { font-size:0.875rem; color:var(--text-secondary); font-weight:500; }
    .page-content { flex:1; overflow-y:auto; padding:24px; }
  `],
})
export class AppShellComponent {
  readonly #auth = inject(AuthService);
  readonly #router = inject(Router);

  protected readonly role = this.#auth.role;

  protected readonly visibleNav = computed<NavItem[]>(() => {
    const r = this.role();
    return NAV_ITEMS.filter(item => !item.roles || (r !== null && item.roles.includes(r)));
  });

  protected readonly userName = computed(() =>
    this.#auth.currentProfile()?.full_name ?? this.#auth.currentUser()?.email ?? '—',
  );

  protected readonly userInitials = computed(() => {
    const name = this.#auth.currentProfile()?.full_name ?? '';
    return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase() || '?';
  });

  protected readonly roleLabel = computed(() => {
    const map: Record<string, string> = { admin: 'Administrador', partner: 'Parceiro', tech: 'Técnico' };
    return map[this.role() ?? ''] ?? '';
  });

  protected async signOut(): Promise<void> {
    await this.#auth.signOut();
  }
}
