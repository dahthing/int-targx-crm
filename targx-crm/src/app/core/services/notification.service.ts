import { Injectable, inject, signal } from '@angular/core';
import { from, Observable } from 'rxjs';
import { MessageService } from 'primeng/api';
import { SUPABASE_CLIENT } from '../supabase/supabase.client';
import type { Notification } from '../models/notification.model';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  readonly #supabase = inject(SUPABASE_CLIENT);
  readonly #messageService = inject(MessageService);

  readonly unreadCount = signal<number>(0);
  readonly notifications = signal<Notification[]>([]);

  async loadRecent(userId: string): Promise<void> {
    const { data } = await this.#supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20);

    this.notifications.set((data ?? []) as Notification[]);
    this.unreadCount.set((data ?? []).filter((n: Notification) => !n.read).length);
  }

  subscribeToRealtime(userId: string): void {
    this.#supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const notif = payload.new as Notification;
          this.notifications.update(n => [notif, ...n].slice(0, 20));
          this.unreadCount.update(c => c + 1);
          this.#showToast(notif);
        }
      )
      .subscribe();
  }

  async markAsRead(id: string): Promise<void> {
    await this.#supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', id);
    this.notifications.update(ns =>
      ns.map(n => (n.id === id ? { ...n, read: true } : n))
    );
    this.unreadCount.update(c => Math.max(0, c - 1));
  }

  async markAllAsRead(userId: string): Promise<void> {
    await this.#supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('read', false);
    this.notifications.update(ns => ns.map(n => ({ ...n, read: true })));
    this.unreadCount.set(0);
  }

  getUnreadCount(): Observable<number> {
    return from(
      this.#supabase
        .from('notifications')
        .select('id', { count: 'exact', head: true })
        .eq('read', false)
        .then(({ count }) => count ?? 0)
    );
  }

  #showToast(notif: Notification): void {
    this.#messageService.add({
      severity: 'info',
      summary: notif.title,
      detail: notif.body ?? '',
      life: 5000,
    });
  }
}
