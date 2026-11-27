import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, computed, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../core/auth/auth.service';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { AttendanceRequestsService } from '../../shared/common-services/attendance-requests.service';
import { AttendanceService, isoOf } from '../../shared/common-services/attendance.service';
import { BatchesService } from '../../shared/common-services/batches.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { UsersService } from '../../shared/common-services/users.service';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { AttendanceRecord } from '../../shared/models/attendance.model';
import { RibbonItem, ExportFormat, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { displayDate } from '../../shared/utils/format.util';

type Tab = 'list' | 'manual';
interface Draft { st: 'Present' | 'Absent'; rem: string; }
interface ManualRow { u: { id: string; n: string; r: string; b: string; org: string }; reported?: string; ex?: AttendanceRecord; st: 'Present' | 'Absent'; rem: string; }

/** Attendance Management: the students' Present / Absent reports to mark, and manual marking on behalf of others. Everything is read from and saved to the database. */
@Component({
  selector: 'app-attendance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective],
  templateUrl: './attendance.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './attendance.scss'],
})
export class Attendance extends LocalListBase implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly store = inject(AttendanceService);
  private readonly requestStore = inject(AttendanceRequestsService);
  private readonly users = inject(UsersService);
  private readonly auth = inject(AuthService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  protected readonly noun = 'reports';
  protected override filterFields = { status: 'outcome', source: 'requested', branch: ['batch'] };
  readonly displayDate = displayDate;

  override filters = [
    { key: 'status', label: 'Status', options: ['Pending', 'Present', 'Absent'] },
    { key: 'source', label: 'Student reported', options: ['Present', 'Absent'] },
    { key: 'branch', label: 'Batch', multiSelect: true, options: inject(BatchesService).names() },
    { key: 'date', label: 'Date' },
  ];

  columns: TableColumn[] = [
    { key: 'person', header: 'Student', type: 'lead', width: '22%' },
    { key: 'batch', header: 'Batch', width: '12%' },
    { key: 'date', header: 'Date', width: '11%' },
    { key: 'requested', header: 'Student reported', type: 'badge', width: '12%' },
    { key: 'origin', header: 'Marked by', width: '12%' },
    { key: 'reason', header: 'Reason', width: '16%' },
    { key: 'outcome', header: 'Status', type: 'badge', width: '10%' },
    { key: 'actions', header: 'Mark attendance', type: 'quickActions', width: '14%', sortable: false },
  ];

  /** Pending reports first, then newest day first (rows carry `__order`: "2" + day for pending, "1" + day for the rest). */
  override sortActive = 'order';
  override sortDirection: 'asc' | 'desc' = 'desc';

  readonly tab = signal<Tab>(this.auth.hasTab('a_attend.tab.list') || !this.auth.hasTab('a_attend.tab.manual') ? 'list' : 'manual');
  readonly showListTab = this.auth.hasTab('a_attend.tab.list');
  readonly showManualTab = this.auth.hasTab('a_attend.tab.manual');
  /** The day the list tab shows: today, or the day picked from the dashboard calendar. */
  private readonly listDate = signal<string | null>(null);
  private readonly listDay = () => this.listDate() ?? this.requestStore.serverToday();
  /** With no date range chosen the list shows one day (today, or the day opened from the dashboard); with a range, every day in it. */
  private inScope(iso: string): boolean {
    return !!(this.filterState.dateFrom || this.filterState.dateTo) || iso === this.listDay();
  }
  readonly reports = this.requestStore.items;
  readonly pending = this.requestStore.pendingCount;

  constructor() {
    super();
    // New student reports appear while the page is open.
    inject(DestroyRef).onDestroy(this.requestStore.poll());
    // The manual tab shows the day's marks: fetch them whenever the date changes.
    effect(() => { void this.loadDay(this.mDate()); });
  }

  ngOnInit(): void {
    // Opened from the dashboard's pending attendance: show that day's list of every student and their status.
    const date = this.route.snapshot.queryParamMap.get('date');
    if (date && /^\d{4}-\d{2}-\d{2}$/.test(date)) {
      this.mDate.set(date);
      // Requests waiting for a decision live in the list tab; students nobody marked at all, in the manual tab.
      const requested = this.route.snapshot.queryParamMap.get('kind') === 'requested';
      this.listDate.set(date);
      this.onlyPending.set(!requested);
      this.tab.set(requested ? 'list' : 'manual');
    }
    this.requestStore.loadFromApi().catch(e => this.toast.error('Could not load attendance reports', apiErrorMessage(e)));
    void this.users.refresh();
  }

  readonly stats = computed<RibbonItem[]>(() => {
    const today = this.listDay();
    const all = this.reports().filter(r => r.iso === today);
    return [
      { label: 'Reports today', value: all.length, icon: 'bi-journal-check', iconVariant: 'blue' },
      { label: 'Waiting to be marked', value: all.filter(r => r.outcome === 'Pending').length, icon: 'bi-hourglass-split', iconVariant: 'orange', filter: { key: 'status', value: 'Pending' } },
      { label: 'Marked present', value: all.filter(r => r.outcome === 'Present').length, icon: 'bi-person-check', iconVariant: 'green', filter: { key: 'status', value: 'Present' } },
      { label: 'Marked absent', value: all.filter(r => r.outcome === 'Absent').length, icon: 'bi-person-x', iconVariant: 'purple', filter: { key: 'status', value: 'Absent' } },
    ];
  });

  /**
   * The student reports, then the attendance staff marked by hand. A mark that came from approving a report is already the
   * report's row, so only marks with no report for that student and day are added here.
   */
  protected allRows(): TableRow[] {
    return [...this.reportRows(), ...this.manualMarkRows()];
  }

  private manualMarkRows(): TableRow[] {
    const reported = new Set(this.reports().map(r => `${r.sid}|${r.iso}`));
    return this.store.items().filter(rec => this.inScope(rec.iso) && !reported.has(`${rec.sid}|${rec.iso}`)).map(rec => ({
      id: `m-${rec.id}`,
      person: { name: rec.name, subtitle: rec.sid, photo: this.users.photoOf(rec.sid) },
      __person: rec.name,
      __sid: rec.sid,
      searchText: `${rec.name} ${rec.sid} ${rec.remarks}`,
      batch: rec.batch,
      date: rec.date,
      __date: rec.iso,
      requested: '—',
      origin: rec.by ? `Manual · ${rec.by}` : 'Manual',
      reason: rec.remarks || '—',
      outcome: rec.status,
      __outcome: `1${rec.status}`,
      __order: `1${rec.iso}`,
      actions: [{ key: 'update', icon: 'bi-pencil-square', label: 'Update this mark', variant: 'primary' as const, permission: 'a_attend.edit' }],
    }));
  }

  private reportRows(): TableRow[] {
    return this.reports().filter(r => this.inScope(r.iso)).map(r => ({
      id: r.id,
      person: { name: r.name, subtitle: `${r.sid} · ${r.org}`, photo: this.users.photoOf(r.sid) },
      __person: r.name,
      __sid: r.sid,
      searchText: `${r.name} ${r.sid} ${r.org} ${r.reason}`,
      batch: r.batch,
      date: r.date,
      __date: r.iso,
      requested: r.requested,
      origin: 'Student report',
      reason: r.reason || '—',
      outcome: r.outcome,
      // Pending reports sort first; within a status, newest day first.
      __outcome: `${r.outcome === 'Pending' ? 0 : 1}${r.outcome}`,
      __order: `${r.outcome === 'Pending' ? 2 : 1}${r.iso}`,
      // Once a report is marked present or absent its buttons go away.
      actions: r.outcome === 'Pending' ? [
        { key: 'present', icon: 'bi-person-check-fill', label: 'Mark present', variant: 'primary' as const, permission: 'a_attend.edit' },
        { key: 'absent', icon: 'bi-person-x-fill', label: 'Mark absent', variant: 'danger' as const, permission: 'a_attend.edit' },
      ] : [],
    }));
  }

  /** Marks the report's final status; marking a marked report again simply changes it. */
  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    if (e.action === 'update') {
      const mark = this.store.items().find(rec => `m-${rec.id}` === String(e.row['id']));
      if (mark) {
        this.mDate.set(mark.iso);
        this.editing.set(mark);
        this.pop.set({ id: mark.sid });
      }
      return;
    }
    const decision = e.action === 'present' ? 'Present' : e.action === 'absent' ? 'Absent' : null;
    const r = this.requestStore.get(String(e.row['id']));
    if (!decision || !r) return;
    if (r.outcome === decision) return void this.toast.success(`${r.name} is already marked ${decision.toLowerCase()}`);
    try {
      await this.requestStore.mark(r.id, decision);
    } catch (err) {
      return void this.toast.error('Could not mark the attendance', apiErrorMessage(err));
    }
    this.toast.success(`${r.name} marked ${decision.toLowerCase()}`);
    void this.loadDay(this.mDate());
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, 'sharp-attendance-reports', 'Attendance reports');
  }

  /* ---------- manual attendance (and who is acting) ---------- */

  readonly actors = computed(() => this.users.items().filter(u => ['Super Admin', 'Admin', 'OB', 'Mentor'].includes(u.r) && u.st !== 'Suspended'));
  private readonly actorPick = signal('');
  readonly actorId = computed(() => {
    const list = this.actors();
    if (list.some(a => a.id === this.actorPick())) return this.actorPick();
    return list.find(a => a.id === this.auth.actor().id)?.id ?? list[0]?.id ?? '';
  });
  readonly actor = computed(() => this.actors().find(a => a.id === this.actorId()));
  readonly actorName = computed(() => this.actor()?.n ?? this.auth.actor().n);
  readonly limited = computed(() => this.actor()?.r === 'Mentor');
  readonly mDate = signal(isoOf());

  /** The marks already saved for the chosen day. */
  readonly dayRecords = signal<AttendanceRecord[]>([]);

  private readonly pool = computed(() => {
    const actor = this.actor();
    // A student who sent an attendance report for the day is decided from the list tab, so is left out here.
    const requested = new Set(this.reports().filter(r => r.iso === this.mDate()).map(r => r.sid));
    const all = this.users.items().filter(u =>
      u.r === 'Student'
      && u.st !== 'Suspended'
      && u.id !== actor?.id
      && !(u.r === 'Student' && requested.has(u.id))
    );
    // A mentor's user list already holds only their assigned students (the API limits it), whatever their own batch is.
    return all;
  });

  private readonly drafts = signal<Record<string, Partial<Draft>>>({});

  /** Everyone the acting person may mark, with the day's status: a mark, else a report waiting for a decision, else Pending. */
  readonly manualRows = computed<ManualRow[]>(() => {
    const recs = this.dayRecords();
    const reports = new Map(this.reports().filter(r => r.iso === this.mDate()).map(r => [r.sid, r.requested]));
    return this.pool().map(u => {
      const ex = recs.find(r => r.sid === u.id);
      const d = this.drafts()[u.id] ?? {};
      return { u, ex, reported: ex ? undefined : reports.get(u.id), st: d.st ?? ex?.status ?? 'Present', rem: d.rem ?? ex?.remarks ?? '' };
    }).filter(r => !r.ex);
  });

  private async loadDay(iso: string): Promise<void> {
    try {
      this.dayRecords.set(await this.store.fetch({ date_from: iso, date_to: iso }));
    } catch (error) {
      this.toast.error('Could not load attendance marks', apiErrorMessage(error));
    }
  }

  pickActor(id: string): void { this.actorPick.set(id); this.selected.set(new Set()); }

  /* ---------- bulk marking: tick students, choose one status and remark, apply to all ---------- */

  readonly selected = signal<ReadonlySet<string>>(new Set());
  readonly bulkStatus = signal<'Present' | 'Absent'>('Present');
  readonly bulkRemark = signal('');
  readonly bulkBusy = signal(false);
  readonly bulkOpen = signal(false);

  /** Only students are marked in bulk. */
  readonly onlyPending = signal(false);
  /** The rows on screen: everyone, or only those nobody has marked yet. */
  readonly shownRows = computed(() => {
    const q = this.mSearch().trim().toLowerCase();
    const college = this.mCollege();
    const batch = this.mBatch();
    return (this.onlyPending() ? this.manualRows().filter(r => !r.ex) : this.manualRows())
      .filter(r => (!college || r.u.org === college) && (!batch || r.u.b === batch) && (!q || `${r.u.n} ${r.u.id} ${r.u.org}`.toLowerCase().includes(q)));
  });
  readonly studentRows = computed(() => this.shownRows().filter(r => r.u.r === 'Student'));
  readonly allTicked = computed(() => this.studentRows().length > 0 && this.studentRows().every(r => this.selected().has(r.u.id)));
  readonly unmarkedCount = computed(() => this.studentRows().filter(r => !r.ex).length);

  toggleOne(id: string, on: boolean): void {
    this.selected.update(s => { const n = new Set(s); on ? n.add(id) : n.delete(id); return n; });
  }

  toggleAll(on: boolean): void {
    this.selected.set(on ? new Set(this.studentRows().map(r => r.u.id)) : new Set());
  }

  /** Ticks every student who has no mark for the day yet. */
  selectUnmarked(): void {
    this.selected.set(new Set(this.studentRows().filter(r => !r.ex).map(r => r.u.id)));
  }

  async applyBulk(): Promise<void> {
    const ids = [...this.selected()];
    const remark = this.bulkRemark().trim();
    const status = this.bulkStatus();
    if (!ids.length) return void this.toast.error('Tick at least one student');
    if (!remark) return void this.toast.error('Add a remark for the manual attendance');
    const date = this.mDate();
    if (!(await this.toast.confirm(`Mark ${ids.length} student${ids.length === 1 ? '' : 's'} ${status.toLowerCase()}?`, `For ${displayDate(date)}. Anyone already marked that day is overwritten. Remark: ${remark}`, `Yes, mark ${status.toLowerCase()}`))) return;
    this.bulkBusy.set(true);
    try {
      const marked = await this.store.markMany(ids, status, remark, date);
      this.log.record('Attendance Management', `Bulk attendance — ${marked} students ${status} on ${date} (by ${this.actorName()}) — ${remark}`);
      this.toast.success(`${marked} student${marked === 1 ? '' : 's'} marked ${status.toLowerCase()}`, remark);
      this.selected.set(new Set());
      this.bulkRemark.set('');
      this.bulkOpen.set(false);
      await this.loadDay(date);
    } catch (e) {
      this.toast.error('Could not save the attendance', apiErrorMessage(e));
    } finally {
      this.bulkBusy.set(false);
    }
  }

  setDraft(id: string, patch: Partial<Draft>): void {
    this.drafts.update(d => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  /* ---------- manual list filters ---------- */

  readonly mSearch = signal('');
  readonly mCollege = signal('');
  readonly mBatch = signal('');
  readonly collegeOptions = computed(() => [...new Set(this.pool().map(u => u.org).filter(Boolean))].sort());
  readonly batchOptions = computed(() => [...new Set(this.pool().map(u => u.b).filter(Boolean))].sort());
  readonly filtersOn = computed(() => !!(this.mSearch() || this.mCollege() || this.mBatch()));

  clearManualFilters(): void { this.mSearch.set(''); this.mCollege.set(''); this.mBatch.set(''); }

  /* ---------- student details: profile and attendance history ---------- */

  readonly viewSid = signal<string | null>(null);
  readonly viewTab = signal<'details' | 'attendance'>('details');
  readonly viewUser = computed(() => this.users.items().find(u => u.id === this.viewSid()) ?? null);
  readonly viewRecords = signal<AttendanceRecord[]>([]);
  readonly viewBusy = signal(false);
  readonly viewStats = computed(() => {
    const rows = this.viewRecords();
    const present = rows.filter(r => r.status === 'Present').length;
    return { total: rows.length, present, absent: rows.length - present, rate: rows.length ? Math.round((present / rows.length) * 100) : 0 };
  });

  async openStudent(sid: string): Promise<void> {
    this.viewSid.set(sid);
    this.viewTab.set('details');
    this.viewRecords.set([]);
    this.viewBusy.set(true);
    try {
      const from = new Date(Date.now() - 180 * 86_400_000).toLocaleDateString('en-CA');
      this.viewRecords.set((await this.store.fetch({ student_id: sid, date_from: from })).sort((a, b) => b.iso.localeCompare(a.iso)));
    } catch (e) {
      this.toast.error('Could not load the attendance history', apiErrorMessage(e));
    } finally {
      this.viewBusy.set(false);
    }
  }

  closeStudent(): void { this.viewSid.set(null); }

  /** A student's name in the list tab opens their details. */
  onProfile(row: TableRow): void {
    const sid = String(row['__sid'] ?? '');
    if (sid) void this.openStudent(sid);
  }

  /* ---------- inline popover form for one person ---------- */

  protected readonly quickRemarks = ['Medical reason', 'GPS / network issue', 'On official duty', 'Forgot to report'];
  initials(name: string): string { return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() ?? '').join(''); }

  readonly pop = signal<{ id: string } | null>(null);
  /** A mark being corrected from the list tab (those students are no longer in the manual tab's list). */
  private readonly editing = signal<AttendanceRecord | null>(null);
  readonly popRow = computed<ManualRow | null>(() => {
    const id = this.pop()?.id;
    const ex = this.editing();
    if (ex && ex.sid === id) {
      const u = this.users.items().find(x => x.id === id);
      const d = this.drafts()[ex.sid] ?? {};
      return { u: { id: ex.sid, n: ex.name, r: u?.r ?? 'Student', b: ex.batch, org: u?.org ?? '' }, ex, st: d.st ?? ex.status, rem: d.rem ?? ex.remarks };
    }
    return this.manualRows().find(r => r.u.id === id) ?? null;
  });
  readonly popBusy = signal(false);

  /** The form opens centred on the screen, over a dimmed page. */
  openPop(row: ManualRow): void { this.pop.set({ id: row.u.id }); }

  closePop(): void { this.pop.set(null); this.editing.set(null); }

  async savePop(): Promise<void> {
    const row = this.popRow();
    if (!row) return;
    this.popBusy.set(true);
    try {
      if (await this.mark(row)) this.closePop();
    } finally {
      this.popBusy.set(false);
    }
  }

  /** Saves one manual mark; true when it was saved. */
  async mark(row: ManualRow): Promise<boolean> {
    const rem = row.rem.trim();
    if (!rem) return void this.toast.error('Add a remark for the manual attendance'), false;
    try {
      await this.store.mark(row.u.id, row.st, rem, this.mDate());
    } catch (e) {
      return void this.toast.error('Could not save the attendance', apiErrorMessage(e)), false;
    }
    this.log.record('Attendance Management', `Manual attendance — ${row.u.n} ${row.st} on ${this.mDate()} (by ${this.actorName()})`);
    this.drafts.update(d => Object.fromEntries(Object.entries(d).filter(([k]) => k !== row.u.id)));
    this.toast.success(`${row.u.n} marked ${row.st.toLowerCase()}`);
    await this.loadDay(this.mDate());
    return true;
  }
}
