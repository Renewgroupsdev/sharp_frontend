import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/auth/auth.service';
import { LiveNotification, NotificationToast } from '../models/notification.model';
import { RealtimeService } from './realtime.service';

export interface InboxItem {
  id: number;
  type: string;
  title: string;
  body: string;
  /** Where the notification leads in the app, or ''. */
  url: string;
  read: boolean;
  /** ISO timestamp. */
  at: string;
}

interface InboxApi {
  id: number;
  type: string;
  title: string;
  body: string | null;
  data: { url?: string } | null;
  read: boolean;
  created_at: string;
}

const toItem = (n: InboxApi): InboxItem => ({ id: n.id, type: n.type, title: n.title, body: n.body ?? '', url: n.data?.url ?? '', read: n.read, at: n.created_at });

/**
 * The signed-in user's own notification inbox (GET /api/web/notifications). New notifications arrive live over the WebSocket:
 * each one pops up as a toast and refreshes the bell at once. A slow poll stays as the fallback for when the socket is down.
 */
@Injectable({ providedIn: 'root' })
export class NotificationsInboxService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly realtime = inject(RealtimeService);
  private readonly base = `${environment.apiBaseUrl}/notifications`;

  readonly items = signal<InboxItem[]>([]);
  readonly unread = signal(0);
  /** Pop-ups for notifications that just arrived (newest last). */
  readonly toasts = signal<NotificationToast[]>([]);
  private toastKey = 0;

  async load(): Promise<void> {
    if (!this.auth.accessToken()) return;
    const res = await firstValueFrom(this.http.get<{ ok: boolean; unread: number; notifications: InboxApi[] }>(this.base));
    this.unread.set(res.unread);
    this.items.set(res.notifications.map(toItem));
  }

  /** Listens for live notifications and keeps a slow fallback refresh; returns the function that stops both. */
  start(fallbackMs = 120_000): () => void {
    const stopLive = this.realtime.listenNotifications(this.auth.userId(), n => this.arrived(n));
    const timer = setInterval(() => this.load().catch(() => undefined), fallbackMs);
    return () => { stopLive(); clearInterval(timer); };
  }

  dismiss(key: number): void {
    this.toasts.update(list => list.filter(t => t.key !== key));
  }

  /** A notification was pushed: show it now and bring the bell up to date. */
  private arrived(n: LiveNotification): void {
    const key = ++this.toastKey;
    this.toasts.update(list => [...list.slice(-2), { ...n, key }]);
    setTimeout(() => this.dismiss(key), 8000);
    this.load().catch(() => undefined);
  }

  async markRead(id: number): Promise<void> {
    const res = await firstValueFrom(this.http.post<{ unread: number }>(`${this.base}/${id}/read`, {}));
    this.unread.set(res.unread);
    this.items.update(list => list.map(n => (n.id === id ? { ...n, read: true } : n)));
  }

  async markAllRead(): Promise<void> {
    await firstValueFrom(this.http.post(`${this.base}/read-all`, {}));
    this.unread.set(0);
    this.items.update(list => list.map(n => ({ ...n, read: true })));
  }
}
