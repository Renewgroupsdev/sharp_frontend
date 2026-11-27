import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditEntry {
  id: number;
  actor_name: string | null;
  actor_role?: string | null;
  action: string;
  target: string | null;
  details: string | null;
  created_at: string;
}

/** How a log entry's time is written, in the Logs page and in every report made from the log. */
export const auditWhen = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/** The columns of the activity log, and one entry's cells in the same order. */
export const AUDIT_HEAD = ['When', 'Actor', 'Role', 'Activity', 'About', 'Details'];
export const auditRow = (e: AuditEntry): string[] => [auditWhen(e.created_at), e.actor_name ?? 'System', e.actor_role ?? '', e.action, e.target ?? '', e.details ?? ''];

/** GET /audit-logs: the audit trail; with a user's public id, what they did and what was done to them. */
@Injectable({ providedIn: 'root' })
export class AuditLogsApi {
  private readonly http = inject(HttpClient);

  /** The latest entries the signed-in role may see (an institution only its own students'). */
  async list(): Promise<AuditEntry[]> {
    return (await firstValueFrom(this.http.get<{ entries: AuditEntry[] }>(`${environment.apiBaseUrl}/audit-logs`))).entries;
  }

  async forUser(publicId: string): Promise<AuditEntry[]> {
    return (await firstValueFrom(this.http.get<{ entries: AuditEntry[] }>(`${environment.apiBaseUrl}/audit-logs`, { params: { user: publicId } }))).entries;
  }
}
