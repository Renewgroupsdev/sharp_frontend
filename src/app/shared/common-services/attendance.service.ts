import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { AttendanceRecord } from '../models/attendance.model';
import { AttendanceApi, AttendanceListFilter, AttendanceListRow } from './attendance-api.service';

export const isoOf = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export const displayOf = (iso: string) => new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });

/** The server's Present / Manual / Absent as the screens show them: Manual is a present marked by staff. */
function toRecord(r: AttendanceListRow): AttendanceRecord {
  return {
    id: String(r.id),
    date: displayOf(r.date),
    iso: r.date,
    batch: r.batch ?? '—',
    sid: r.student_id,
    name: r.name,
    status: r.status === 'Absent' ? 'Absent' : 'Present',
    mode: r.status === 'Present' ? 'Reported' : 'Manual',
    method: r.status === 'Present' ? 'Reported by the student' : 'Marked by staff',
    remarks: r.reason ?? '',
    by: r.marked_by_name ?? undefined,
  };
}

/**
 * Attendance read from and written to the Laravel attendance API (one row per student and day). `items` is a cache of
 * the last 90 days for the screens that summarise (reports, certificates, mentor dashboard); a screen that needs one
 * day or one student asks `fetch()` for exactly that. Students use MyAttendanceService instead.
 */
@Injectable({ providedIn: 'root' })
export class AttendanceService {
  private readonly api = inject(AttendanceApi);
  private readonly auth = inject(AuthService);

  readonly items = signal<AttendanceRecord[]>([]);
  readonly loaded = signal(false);

  private loading?: Promise<void>;

  constructor() {
    // Staff and mentors may list attendance; a student's session would only get a 403.
    if (this.auth.accessToken() && this.auth.shell() !== 'student') this.load().catch(() => undefined);
  }

  /** Reloads the cache (the server's default window: the last 90 days). Concurrent calls share one request. */
  load(): Promise<void> {
    this.loading ??= (async () => {
      try {
        this.items.set((await this.api.list()).map(toRecord));
        this.loaded.set(true);
      } finally {
        this.loading = undefined;
      }
    })();
    return this.loading;
  }

  /** Attendance for one query (a day, a student, a batch…); does not touch the cache. */
  async fetch(filters: AttendanceListFilter): Promise<AttendanceRecord[]> {
    return (await this.api.list(filters)).map(toRecord);
  }

  /** Marks many students the same way for one day, all or nothing, and refreshes the cache. */
  async markMany(sids: string[], status: 'Present' | 'Absent', reason: string, iso: string): Promise<number> {
    const marked = await this.api.markMany({ student_ids: sids, status: status === 'Absent' ? 'Absent' : 'Manual', reason: reason || null, date: iso });
    await this.load();
    return marked;
  }

  /** Marks one person for a day (a present needs a reason, an absence too) and refreshes the cache. */
  async mark(
    sid: string,
    status: 'Present' | 'Absent',
    reason: string,
    iso: string,
  ): Promise<void> {
    await this.api.mark({
      student_id: sid,
      status: status === 'Absent' ? 'Absent' : 'Manual',
      reason: reason || null,
      date: iso,
    });
    await this.load();
  }
}
