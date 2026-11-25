import { HttpClient } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { Observable, firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { NotificationRule, SendNotificationBody } from '../models/notification.model';

/**
 * Notification Management (staff): the rules behind every automatic notification, and messages written by hand.
 * Each answer from the API replaces the rule in the list, so the screen never drifts from the database.
 */
@Injectable({ providedIn: 'root' })
export class NotificationRulesService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  readonly rules = signal<NotificationRule[]>([]);
  readonly loaded = signal(false);

  async load(): Promise<void> {
    const res = await firstValueFrom(this.http.get<{ rules: NotificationRule[] }>(`${this.base}/notification-rules`));
    this.rules.set(res.rules);
    this.loaded.set(true);
  }

  get(event: string): NotificationRule | undefined {
    return this.rules().find(r => r.event === event);
  }

  update(event: string, body: Partial<Pick<NotificationRule, 'enabled' | 'title' | 'body'>>): Promise<NotificationRule> {
    return this.store(this.http.put<{ rule: NotificationRule }>(`${this.base}/notification-rules/${event}`, body));
  }

  reset(event: string): Promise<NotificationRule> {
    return this.store(this.http.post<{ rule: NotificationRule }>(`${this.base}/notification-rules/${event}/reset`, {}));
  }

  /** Sends a message by hand; resolves with how many people got it. */
  async send(body: SendNotificationBody): Promise<number> {
    const payload = { ...body, roles: body.roles.length ? body.roles : undefined, users: body.users.length ? body.users : undefined };
    return (await firstValueFrom(this.http.post<{ sent: number }>(`${this.base}/notifications/send`, payload))).sent;
  }

  private async store(call: Observable<{ rule: NotificationRule }>): Promise<NotificationRule> {
    const { rule } = await firstValueFrom(call);
    this.rules.update(list => list.map(r => (r.event === rule.event ? rule : r)));
    return rule;
  }
}
