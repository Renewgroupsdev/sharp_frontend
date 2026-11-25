import { Component, DestroyRef, ElementRef, HostListener, OnInit, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { InboxItem, NotificationsInboxService } from '../../common-services/notifications-inbox.service';

export const NOTIFICATION_ICONS: Record<string, string> = {
  certificate: 'bi-award', enrollment: 'bi-person-plus', learning: 'bi-unlock', assessment: 'bi-patch-check', attendance: 'bi-clock-history', message: 'bi-megaphone', account: 'bi-person-gear', community: 'bi-chat-dots',
};
const ICONS = NOTIFICATION_ICONS;

/** Header bell: the unread count and a dropdown of the signed-in user's notifications. */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  templateUrl: './notification-bell.html',
  styleUrl: './notification-bell.scss',
})
export class NotificationBell implements OnInit {
  private readonly inbox = inject(NotificationsInboxService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);

  protected readonly items = this.inbox.items;
  protected readonly unread = this.inbox.unread;
  protected readonly open = signal(false);

  constructor() {
    inject(DestroyRef).onDestroy(this.inbox.start());
  }

  ngOnInit(): void {
    this.inbox.load().catch(() => undefined);
  }

  protected toggle(): void {
    this.open.update(v => !v);
    if (this.open()) this.inbox.load().catch(() => undefined);
  }

  protected async pick(n: InboxItem): Promise<void> {
    if (!n.read) await this.inbox.markRead(n.id).catch(() => undefined);
    this.open.set(false);
    if (n.url) void this.router.navigateByUrl(n.url);
  }

  protected markAll(): void {
    this.inbox.markAllRead().catch(() => undefined);
  }

  protected icon(type: string): string {
    return ICONS[type] ?? 'bi-bell';
  }

  /** "5 min ago", "2 h ago", "3 d ago". */
  protected ago(iso: string): string {
    const min = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60_000));
    return min < 1 ? 'just now' : min < 60 ? `${min} min ago` : min < 1440 ? `${Math.round(min / 60)} h ago` : `${Math.round(min / 1440)} d ago`;
  }

  @HostListener('document:click', ['$event'])
  protected outside(event: Event): void {
    if (this.open() && !this.host.nativeElement.contains(event.target as Node)) this.open.set(false);
  }
}
