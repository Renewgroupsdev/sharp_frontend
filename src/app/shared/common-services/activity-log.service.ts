import { Injectable, Injector, inject } from '@angular/core';
import { LocalCollection } from '../../core/data/local-collection';
import { ActivityLog } from '../../core/data/models';
import { AuthService } from '../../core/auth/auth.service';

const stamp = () => new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Audit trail shown on Logs Management. Every module records its create / update / delete actions here. */
@Injectable({ providedIn: 'root' })
export class ActivityLogService extends LocalCollection<ActivityLog> {
  /** AuthService -> UsersService -> this service, so AuthService is resolved lazily to avoid a circular dependency. */
  private readonly injector = inject(Injector);

  constructor() {
    super('logs', () => [{ id: 'LOG-0001', w: '13 Oct 2026, 9:00 AM', a: 'System', m: 'System', t: 'LMS modules initialised with sample data' }], 'LOG', 4);
  }

  /** `module` is the screen name, `text` the activity, e.g. record('Institute Management', 'Created Fatima College (FC)'). */
  record(module: string, text: string): void {
    const list = [{ id: this.nextId(), w: stamp(), a: this.injector.get(AuthService).actor().n, m: module, t: text }, ...this.items()].slice(0, 400);
    this.replace(list);
  }
}
