import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { NotificationsInboxService } from '../../common-services/notifications-inbox.service';
import { NotificationToast } from '../../models/notification.model';
import { NOTIFICATION_ICONS } from '../notification-bell/notification-bell';

/** Pop-ups for notifications that arrive while the app is open: top-right, a few seconds each, click to open the thing. */
@Component({
  selector: 'app-notification-toasts',
  standalone: true,
  template: `
    <div class="nt" aria-live="polite">
      @for (t of toasts(); track t.key) {
        <div class="nt-card" role="status">
          <button type="button" class="nt-main" (click)="open(t)">
            <span class="nt-ico"><i class="bi" [class]="icon(t.type)"></i></span>
            <span class="nt-txt"><b>{{ t.title }}</b>@if (t.body) { <small>{{ t.body }}</small> }</span>
          </button>
          <button type="button" class="nt-x" (click)="inbox.dismiss(t.key)" aria-label="Dismiss"><i class="bi bi-x-lg"></i></button>
        </div>
      }
    </div>
  `,
  styles: `
    .nt { position: fixed; top: 76px; right: 20px; z-index: 1100; display: flex; flex-direction: column; gap: 10px; width: 340px; max-width: calc(100vw - 24px); pointer-events: none; }
    .nt-card { pointer-events: auto; display: flex; align-items: flex-start; gap: 6px; padding: 10px 8px 10px 12px; border-left: 4px solid var(--primary, #0e7a4e); border-radius: 12px; background: #fff; box-shadow: 0 8px 26px rgba(0, 0, 0, 0.22); animation: nt-in 0.2s ease-out; }
    @keyframes nt-in { from { transform: translateX(30px); opacity: 0; } to { transform: none; opacity: 1; } }
    .nt-main { display: flex; flex: 1; gap: 10px; min-width: 0; padding: 0; border: 0; background: none; text-align: left; cursor: pointer; }
    .nt-ico { flex: 0 0 auto; width: 36px; height: 36px; border-radius: 50%; display: grid; place-items: center; background: var(--primary-soft, #e6f4ec); color: var(--primary-dark, #0b5d49); font-size: 16px; }
    .nt-txt { min-width: 0; }
    .nt-txt b { display: block; font-size: 13.5px; color: #111827; }
    .nt-txt small { display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; font-size: 12.5px; color: #6b7280; }
    .nt-x { flex: 0 0 auto; width: 26px; height: 26px; border: 0; border-radius: 50%; background: none; color: #9ca3af; cursor: pointer; }
    .nt-x:hover { background: #f3f4f6; }
  `,
})
export class NotificationToasts {
  protected readonly inbox = inject(NotificationsInboxService);
  private readonly router = inject(Router);

  protected readonly toasts = this.inbox.toasts;
  protected readonly icon = (type: string): string => NOTIFICATION_ICONS[type] ?? 'bi-bell';

  protected open(t: NotificationToast): void {
    this.inbox.dismiss(t.key);
    if (t.url) void this.router.navigateByUrl(t.url);
  }
}
