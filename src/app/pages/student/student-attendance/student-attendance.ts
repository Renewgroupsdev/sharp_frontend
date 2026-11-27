import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AttendanceRequestsService } from '../../../shared/common-services/attendance-requests.service';
import { AttendanceSummary } from '../../../shared/components/attendance-summary/attendance-summary';
import { MyAttendanceService } from '../../../shared/common-services/my-attendance.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { AttendanceRequestForm } from '../attendance-request-form/attendance-request-form';

type DayKind = 'present' | 'absent' | 'waiting';

interface DayInfo { kind: DayKind; label: string; note: string }

interface Cell {
  /** null for the blanks before the 1st. */
  day: number | null;
  iso: string;
  info?: DayInfo;
  today: boolean;
  future: boolean;
}

const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const pad = (n: number) => String(n).padStart(2, '0');
const isoOf = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * Student attendance: a month calendar of marked days, today's Present / Absent report and a summary of the month.
 * A report is only a request: the programme office (admin, or the student's mentor) approves it as Present or Absent.
 */
@Component({
  selector: 'app-student-attendance',
  standalone: true,
  imports: [AttendanceSummary],
  templateUrl: './student-attendance.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss', './student-attendance.scss'],
})
export class StudentAttendance implements OnInit {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly requestStore = inject(AttendanceRequestsService);
  private readonly mine = inject(MyAttendanceService);

  protected readonly weekdays = WEEKDAYS;
  protected readonly saving = signal(false);
  protected readonly today = this.requestStore.today;
  protected readonly rate = this.mine.rate;
  protected readonly waiting = this.requestStore.pendingCount;

  /** First day of the month on show. */
  private readonly view = signal(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  protected readonly monthLabel = computed(() => this.view().toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }));

  protected readonly todayIso = computed(() => this.requestStore.serverToday() || isoOf(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()));

  protected readonly todayLabel = computed(() => new Date(this.todayIso() + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'short', year: 'numeric' }));

  /** Final marks from the database, with waiting reports filling the days that have no mark yet. */
  private readonly days = computed(() => {
    const map = new Map<string, DayInfo>();
    for (const r of this.requestStore.pending()) {
      map.set(r.iso, { kind: 'waiting', label: `Reported ${r.requested}, waiting`, note: r.reason });
    }
    for (const r of this.mine.records()) {
      const absent = r.status === 'Absent';
      map.set(r.att_date, { kind: absent ? 'absent' : 'present', label: absent ? 'Absent' : 'Present', note: r.reason ?? '' });
    }
    return map;
  });

  protected readonly cells = computed<Cell[]>(() => {
    const first = this.view(), y = first.getFullYear(), m = first.getMonth();
    const total = new Date(y, m + 1, 0).getDate();
    const blanks = (first.getDay() + 6) % 7;
    const today = this.todayIso();
    const out: Cell[] = Array.from({ length: blanks }, () => ({ day: null, iso: '', today: false, future: false }));
    for (let d = 1; d <= total; d++) {
      const iso = isoOf(y, m, d);
      out.push({ day: d, iso, info: this.days().get(iso), today: iso === today, future: iso > today });
    }
    return out;
  });

  protected readonly month = computed(() => {
    const prefix = this.view().getFullYear() + '-' + pad(this.view().getMonth() + 1);
    const inMonth = [...this.days()].filter(([iso]) => iso.startsWith(prefix)).map(([, info]) => info.kind);
    return { present: inMonth.filter(k => k === 'present').length, absent: inMonth.filter(k => k === 'absent').length };
  });

  protected readonly canGoNext = computed(() => {
    const t = new Date(this.todayIso() + 'T00:00:00');
    return this.view() < new Date(t.getFullYear(), t.getMonth(), 1);
  });

  /** Newest first: waiting reports, then the marked days. */
  protected readonly recent = computed(() => {
    const waiting = this.requestStore.pending().map(r => ({ key: 'r' + r.id, date: r.date, kind: 'waiting' as DayKind, label: `Reported ${r.requested}`, note: r.reason || 'Waiting for the programme office' }));
    const marked = this.mine.records().slice(0, 8).map(r => ({
      key: 'a' + r.id,
      date: new Date(r.att_date + 'T00:00:00').toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      kind: (r.status === 'Absent' ? 'absent' : 'present') as DayKind,
      label: r.status === 'Absent' ? 'Absent' : 'Present',
      note: [r.reason, r.marked_by_name ? `by ${r.marked_by_name}` : ''].filter(Boolean).join(' · '),
    }));
    return [...waiting, ...marked];
  });

  constructor() {
    // A report turns into a mark when the admin acts on it, so keep the page fresh while it is open.
    inject(DestroyRef).onDestroy(this.requestStore.poll(20_000));
    // Once today's report is marked, pull the attendance record the admin just wrote.
    effect(() => { if (this.today()?.outcome !== 'Pending') this.mine.load().catch(() => undefined); });
  }

  ngOnInit(): void {
    this.requestStore.loadFromApi().catch(e => this.toast.error('Could not load attendance reports', apiErrorMessage(e)));
    this.mine.load().catch(e => this.toast.error('Could not load your attendance', apiErrorMessage(e)));
  }

  protected shift(by: number): void {
    const v = this.view();
    this.view.set(new Date(v.getFullYear(), v.getMonth() + by, 1));
  }

  protected tip(c: Cell): string {
    return c.info ? `${c.day} ${this.monthLabel()}: ${c.info.label}${c.info.note ? ' — ' + c.info.note : ''}` : `${c.day} ${this.monthLabel()}`;
  }

  /** Sends today's Present report to the programme office; nothing is marked until they approve it. */
  protected async reportPresent(): Promise<void> {
    if (this.saving()) return;
    this.saving.set(true);
    try {
      await this.requestStore.submit('Present');
      this.toast.success('Present reported', 'The programme office will mark your attendance.');
    } catch (e) {
      this.toast.error('Could not send your report', apiErrorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  protected reportAbsent(): void {
    this.dialog.open(AttendanceRequestForm, { width: '520px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false, restoreFocus: true });
  }
}
