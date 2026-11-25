import { Injectable, computed, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { LocalCollection } from '../../core/data/local-collection';
import { AttendanceChoice, AttendanceRequest } from '../models/attendance.model';
import { ActivityLogService } from './activity-log.service';
import { AttendanceRequestApiResource, AttendanceRequestsApi } from './attendance-requests-api.service';
import { displayOf } from './attendance.service';

const stamp = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });

function toRequest(r: AttendanceRequestApiResource): AttendanceRequest {
  return {
    id: String(r.id),
    sid: r.student_id,
    name: r.name,
    org: r.org ?? '—',
    batch: r.batch ?? '—',
    iso: r.date,
    date: displayOf(r.date),
    requested: r.requested_status,
    reason: r.reason ?? '',
    outcome: r.decision ?? 'Pending',
    on: stamp(r.requested_at),
    by: r.resolved_by ?? undefined,
    resolution: r.resolution_note ?? undefined,
  };
}

/**
 * Student Present / Absent reports, stored through the Laravel attendance-requests API (the server scopes the list to
 * the signed-in role). The signal collection is a cache the screens read; every write goes to the API first.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceRequestsService extends LocalCollection<AttendanceRequest> {
  private readonly api = inject(AttendanceRequestsApi);
  private readonly auth = inject(AuthService);
  private readonly log = inject(ActivityLogService);

  /** The server's day: the day a student's report counts for. */
  readonly serverToday = signal('');

  readonly pending = computed(() => this.items().filter(r => r.outcome === 'Pending'));
  readonly pendingCount = computed(() => this.pending().length);
  readonly pendingPresent = computed(() => this.pending().filter(r => r.requested === 'Present').length);
  readonly pendingAbsent = computed(() => this.pending().filter(r => r.requested === 'Absent').length);

  /** The signed-in student's report for today, if they have sent one. */
  readonly today = computed(() => this.items().find(r => r.iso === this.serverToday()));

  private loading?: Promise<void>;

  constructor() {
    super('attendance-reports', () => [], 'REQ', 4);
    if (this.auth.accessToken()) this.loadFromApi().catch(() => undefined);
  }

  /** Loads the reports the signed-in role may see. Concurrent calls share one request. */
  loadFromApi(): Promise<void> {
    this.loading ??= (async () => {
      try {
        const { today, requests } = await this.api.fetch();
        this.serverToday.set(today);
        this.replace(requests.map(toRequest));
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** Refreshes the list every `ms` while a screen needs to show new reports; returns the function that stops it. */
  poll(ms = 30_000): () => void {
    const timer = setInterval(() => { if (this.auth.accessToken()) this.loadFromApi().catch(() => undefined); }, ms);
    return () => clearInterval(timer);
  }

  /** The signed-in student reports for today. A pending report can be changed; the server rejects a marked day. */
  async submit(choice: AttendanceChoice, reason?: string): Promise<AttendanceRequest> {
    const saved = toRequest(await this.api.create({ status: choice, reason: choice === 'Absent' ? reason?.trim() || null : null }));
    this.serverToday.set(saved.iso);
    this.upsert(saved);
    return saved;
  }

  /** Marks the final status (Present / Absent) of a report. The server writes the day's attendance row. */
  async mark(id: string, decision: AttendanceChoice, note?: string): Promise<AttendanceRequest> {
    const saved = toRequest(await this.api.mark(id, decision, note));
    this.upsert(saved);
    this.log.record('Attendance Management', `Marked ${saved.name} ${decision.toLowerCase()} for ${saved.date}`);
    return saved;
  }

  private upsert(rec: AttendanceRequest): void {
    if (this.get(rec.id)) this.update(rec.id, rec); else this.add(rec);
  }
}
