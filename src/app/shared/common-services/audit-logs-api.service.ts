import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface AuditEntry {
  id: number;
  actor_name: string | null;
  action: string;
  target: string | null;
  details: string | null;
  created_at: string;
}

/** GET /audit-logs: the audit trail; with a user's public id, what they did and what was done to them. */
@Injectable({ providedIn: 'root' })
export class AuditLogsApi {
  private readonly http = inject(HttpClient);

  async forUser(publicId: string): Promise<AuditEntry[]> {
    return (await firstValueFrom(this.http.get<{ entries: AuditEntry[] }>(`${environment.apiBaseUrl}/audit-logs`, { params: { user: publicId } }))).entries;
  }
}
