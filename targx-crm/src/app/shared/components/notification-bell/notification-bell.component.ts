import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Popover } from 'primeng/popover';
import { ButtonModule } from 'primeng/button';
import { BadgeModule } from 'primeng/badge';
import { NotificationService } from '../../../core/services/notification.service';
import type { Notification } from '../../../core/models/notification.model';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, Popover, ButtonModule, BadgeModule],
  styles: [`
    .bell-btn {
      position: relative;
      background: none;
      border: none;
      cursor: pointer;
      padding: 6px;
      border-radius: 8px;
      color: var(--tx-gray-600);
      display: flex;
      align-items: center;
    }
    .bell-btn:hover { background: var(--tx-gray-100); }
    .unread-badge {
      position: absolute;
      top: 2px;
      right: 2px;
      background: var(--tx-danger);
      color: white;
      font-size: 0.625rem;
      font-weight: 700;
      min-width: 16px;
      height: 16px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 0 3px;
    }
    .notif-list { width: 320px; max-height: 400px; overflow-y: auto; }
    .notif-item {
      padding: 10px 14px;
      border-bottom: 1px solid var(--tx-gray-100);
      cursor: pointer;
      transition: background 0.1s;
    }
    .notif-item:hover { background: var(--tx-gray-050); }
    .notif-item.unread { background: color-mix(in srgb, var(--tx-teal-500) 5%, white); }
    .notif-title { font-size: 0.8125rem; font-weight: 600; color: var(--tx-gray-800); }
    .notif-body { font-size: 0.75rem; color: var(--tx-gray-500); margin-top: 2px; }
    .notif-time { font-size: 0.6875rem; color: var(--tx-gray-400); margin-top: 4px; }
    .notif-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 14px; border-bottom: 1px solid var(--tx-gray-200);
    }
    .notif-footer {
      padding: 8px 14px; text-align: center;
      border-top: 1px solid var(--tx-gray-100);
    }
    .mark-all-btn {
      background: none; border: none; cursor: pointer;
      font-size: 0.75rem; color: var(--tx-teal-600); font-weight: 500;
    }
    .empty-state { padding: 24px; text-align: center; color: var(--tx-gray-400); font-size: 0.8125rem; }
  `],
  template: `
    <button class="bell-btn" (click)="op.toggle($event)" aria-label="Notificações" #bellBtn>
      <i class="pi pi-bell" style="font-size:1.125rem"></i>
      @if (unread() > 0) {
        <span class="unread-badge">{{ unread() > 9 ? '9+' : unread() }}</span>
      }
    </button>

    <p-popover #op>
      <div class="notif-list">
        <div class="notif-header">
          <span style="font-size:0.875rem;font-weight:600;color:var(--tx-gray-800)">Notificações</span>
          @if (unread() > 0) {
            <button class="mark-all-btn" (click)="markAll()">Marcar todas como lidas</button>
          }
        </div>

        @if (notifications().length === 0) {
          <div class="empty-state">
            <i class="pi pi-check-circle" style="font-size:1.5rem;display:block;margin-bottom:8px"></i>
            Sem notificações
          </div>
        } @else {
          @for (n of notifications(); track n.id) {
            <div
              class="notif-item"
              [class.unread]="!n.read"
              (click)="openNotif(n, op)"
            >
              <div class="notif-title">
                <i class="pi {{ iconFor(n.type) }}" style="margin-right:6px;color:var(--tx-teal-500)"></i>
                {{ n.title }}
              </div>
              @if (n.body) {
                <div class="notif-body">{{ n.body }}</div>
              }
              <div class="notif-time">{{ relativeTime(n.created_at) }}</div>
            </div>
          }
        }

        <div class="notif-footer">
          <button class="mark-all-btn" (click)="op.hide()">Fechar</button>
        </div>
      </div>
    </p-popover>
  `,
})
export class NotificationBellComponent implements OnInit {
  readonly #notifService = inject(NotificationService);
  readonly #router = inject(Router);

  readonly notifications = this.#notifService.notifications;
  readonly unread = this.#notifService.unreadCount;

  ngOnInit(): void {}

  async markAll(): Promise<void> {
    await this.#notifService.markAllAsRead('');
  }

  async openNotif(n: Notification, op: { hide: () => void }): Promise<void> {
    if (!n.read) await this.#notifService.markAsRead(n.id);
    if (n.link) this.#router.navigateByUrl(n.link);
    op.hide();
  }

  iconFor(type: string): string {
    const icons: Record<string, string> = {
      lead_assigned: 'pi-user-plus',
      lead_silence: 'pi-clock',
      quote_submitted: 'pi-send',
      quote_returned: 'pi-reply',
      quote_approved: 'pi-check-circle',
      quote_accepted: 'pi-thumbs-up',
      quote_rejected: 'pi-thumbs-down',
      quote_portal_opened: 'pi-eye',
      commission_paid: 'pi-euro',
      bonus_reached: 'pi-star-fill',
      bonus_near: 'pi-star',
      project_created: 'pi-briefcase',
    };
    return icons[type] ?? 'pi-bell';
  }

  relativeTime(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'agora';
    if (mins < 60) return `há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `há ${hours}h`;
    const days = Math.floor(hours / 24);
    return `há ${days}d`;
  }
}
