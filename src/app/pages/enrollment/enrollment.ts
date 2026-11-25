import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { Router } from '@angular/router';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { BatchEnrollmentsService } from '../../shared/common-services/batch-enrollments.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { BatchEnrollment, ENROLLMENT_STATUSES, EnrollmentEvent, MemberKind } from '../../shared/models/batch-enrollment.model';
import { RibbonItem, ExportFormat, FilterOption, QuickAction, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { EnrollmentCalendar } from './enrollment-calendar/enrollment-calendar';
import { EnrollmentCopy } from './enrollment-copy/enrollment-copy';
import { EnrollmentForm } from './enrollment-form/enrollment-form';
import { EnrollmentImport } from './enrollment-import/enrollment-import';
import { EnrollmentMembers } from './enrollment-members/enrollment-members';
import { EnrollmentTimeline } from './enrollment-timeline/enrollment-timeline';

type ViewMode = 'list' | 'cards' | 'calendar' | 'history';

const VIEWS: { key: ViewMode; label: string; icon: string }[] = [
  { key: 'list', label: 'List', icon: 'bi-list-ul' },
  { key: 'cards', label: 'Cards', icon: 'bi-grid-3x2-gap' },
  { key: 'calendar', label: 'Calendar', icon: 'bi-calendar3' },
  { key: 'history', label: 'History', icon: 'bi-clock-history' },
];

const PAGE_OF_CARDS = 12;

/** Enrollment management: the courses run for each batch as a list, cards or a calendar, bulk actions, import and the history. */
@Component({
  selector: 'app-enrollment',
  standalone: true,
  imports: [CommonModule, MatDialogModule, CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective, EnrollmentCalendar, EnrollmentTimeline],
  templateUrl: './enrollment.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './enrollment.scss'],
})
export class Enrollment extends LocalListBase implements OnInit {
  private readonly store = inject(BatchEnrollmentsService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);
  private readonly router = inject(Router);

  protected readonly noun = 'enrollments';
  /** Filter card slots reused: status = enrollment status, source = course, branch = batch. */
  protected override filterFields = { status: 'status', source: 'course', branch: ['batch'] };

  override filters: FilterOption[] = this.buildFilters();

  columns: TableColumn[] = [
    { key: 'sel', header: '', type: 'select', width: '4%', minWidth: 44, sortable: false },
    { key: 'course', header: 'Course', type: 'lead', width: '22%', minWidth: 180 },
    { key: 'batch', header: 'Batch', width: '14%' },
    { key: 'duration', header: 'Start – end date', width: '18%' },
    { key: 'students', header: 'Students', type: 'countLink', width: '8%' },
    { key: 'mentors', header: 'Mentors', type: 'countLink', width: '8%' },
    { key: 'status', header: 'Status', type: 'badge', width: '10%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', menu: true, width: '8%', sortable: false },
  ];

  override sortActive = 'duration';

  readonly views = VIEWS;
  readonly view = signal<ViewMode>(this.savedView());
  readonly shown = signal(PAGE_OF_CARDS);
  readonly selected = signal<string[]>([]);
  readonly history = signal<EnrollmentEvent[]>([]);
  readonly historyLoaded = signal(false);

  readonly stats = computed<RibbonItem[]>(() => {
    const all = this.store.items();
    // Students and mentors belong to the batch, so count each batch once however many courses it takes.
    const perBatch = new Map(all.map(e => [e.batchId, e]));
    const sum = (pick: (e: BatchEnrollment) => number) => [...perBatch.values()].reduce((n, e) => n + pick(e), 0);
    return [
      { label: 'Enrollments', value: all.length, icon: 'bi-person-plus-fill', iconVariant: 'blue' },
      { label: 'Ongoing', value: all.filter(e => e.status === 'Ongoing').length, icon: 'bi-play-circle-fill', iconVariant: 'orange', filter: { key: 'status', value: 'Ongoing' } },
      { label: 'Students enrolled', value: sum(e => e.students), icon: 'bi-mortarboard-fill', iconVariant: 'green' },
      { label: 'Mentors', value: sum(e => e.mentors), icon: 'bi-person-workspace', iconVariant: 'purple' },
    ];
  });

  ngOnInit(): void {
    this.store.loadFromApi()
      .then(() => { this.filters = this.buildFilters(); })
      .catch(e => this.toast.error('Could not load enrollments', apiErrorMessage(e)));
    if (this.view() === 'history') void this.loadHistory();
  }

  private buildFilters(): FilterOption[] {
    const items = this.store.items();
    const unique = (pick: (e: BatchEnrollment) => string) => [...new Set(items.map(pick))].sort();
    return [
      { key: 'status', label: 'Status', options: [...ENROLLMENT_STATUSES] },
      { key: 'source', label: 'Course', options: unique(e => e.course) },
      { key: 'branch', label: 'Batch', multiSelect: true, options: unique(e => e.batch) },
    ];
  }

  protected allRows(): TableRow[] {
    return this.store.items().map(e => ({
      id: e.id,
      course: { name: e.course, subtitle: e.code },
      __course: e.course,
      searchText: `${e.course} ${e.code} ${e.batch}`,
      batch: e.batch,
      duration: e.start || e.end ? `${e.start || '—'} – ${e.end || '—'}` : '—',
      __duration: e.startIso,
      students: e.students,
      __students: e.students,
      mentors: e.mentors,
      __mentors: e.mentors,
      status: e.status,
      actions: this.actionsOf(),
    }));
  }

  private actionsOf(): QuickAction[] {
    return [
      { key: 'open', icon: 'bi-box-arrow-up-right', label: 'View details', permission: 'a_enroll.view' },
      { key: 'students', icon: 'bi-mortarboard-fill', label: 'View students', permission: 'a_enroll.view' },
      { key: 'mentors', icon: 'bi-person-workspace', label: 'View mentors', permission: 'a_enroll.view' },
      { key: 'remove', icon: 'bi-trash3-fill', label: 'Remove enrollment', variant: 'danger', permission: 'a_enroll.delete' },
    ];
  }

  /** The enrollments on show: the same search and filters as the list. */
  get cards(): BatchEnrollment[] {
    return this.filteredRows.map(r => this.store.get(String(r['id']))).filter((e): e is BatchEnrollment => !!e);
  }

  get shownCards(): BatchEnrollment[] { return this.cards.slice(0, this.shown()); }

  setView(mode: ViewMode): void {
    this.view.set(mode);
    this.shown.set(PAGE_OF_CARDS);
    try { localStorage.setItem('sharp.enrollment.view', mode); } catch { /* storage blocked */ }
    if (mode === 'history' && !this.historyLoaded()) void this.loadHistory();
  }

  private savedView(): ViewMode {
    try {
      const v = localStorage.getItem('sharp.enrollment.view');
      return VIEWS.some(x => x.key === v) ? (v as ViewMode) : 'list';
    } catch { return 'list'; }
  }

  async loadHistory(): Promise<void> {
    try {
      this.history.set(await this.store.history());
      this.historyLoaded.set(true);
    } catch (e) {
      this.toast.error('Could not load the history', apiErrorMessage(e));
    }
  }

  /** After a change the trail is out of date: reload it now if it is on show, otherwise next time it opens. */
  private changed(): void {
    this.historyLoaded.set(false);
    if (this.view() === 'history') void this.loadHistory();
  }

  /* ---------- selection and bulk actions ---------- */

  isSelected(id: string): boolean { return this.selected().includes(id); }

  toggleSelect(id: string, on: boolean): void {
    this.selected.update(list => (on ? [...new Set([...list, id])] : list.filter(x => x !== id)));
  }

  clearSelection(): void { this.selected.set([]); }

  copySelected(): void {
    this.openDialog<EnrollmentCopy, boolean>(EnrollmentCopy, { ids: this.selected() }, '560px').afterClosed().subscribe(done => {
      if (done) { this.clearSelection(); this.changed(); }
    });
  }

  async removeSelected(): Promise<void> {
    const ids = this.selected();
    if (!ids.length) return;
    if (!(await this.toast.confirm('Remove selected enrollments?', `${ids.length} course run(s) will be removed from their batches. Students keep their accounts but lose access to those courses.`, 'Yes, remove'))) return;
    try {
      const removed = await this.store.removeMany(ids);
      this.log.record('Enrollment', `Removed ${removed} enrollment(s) in bulk`);
      this.toast.success(`${removed} enrollment(s) removed`);
      this.clearSelection();
      this.changed();
    } catch (e) {
      this.toast.error('Could not remove the enrollments', apiErrorMessage(e));
    }
  }

  /* ---------- dialogs and navigation ---------- */

  addEnrollment(): void {
    this.openDialog<EnrollmentForm, boolean>(EnrollmentForm, {}, '620px').afterClosed().subscribe(done => done && this.changed());
  }

  openImport(): void {
    this.openDialog<EnrollmentImport, boolean>(EnrollmentImport, {}, '760px').afterClosed().subscribe(done => done && this.changed());
  }

  openMembers(id: string, kind: MemberKind): void {
    this.openDialog(EnrollmentMembers, { id, kind }, '820px');
  }

  openDetail(id: string): void {
    void this.router.navigate(['/app/enrollment', id]);
  }

  /** A lead cell (course name) in the list was clicked. */
  open(row: TableRow): void {
    this.openDetail(String(row['id']));
  }

  /** A count in the list was clicked. */
  onCell(e: { row: TableRow; key: string }): void {
    if (e.key === 'students' || e.key === 'mentors') this.openMembers(String(e.row['id']), e.key);
  }

  onQuickAction(e: { row: TableRow; action: string }): void {
    const id = String(e.row['id']);
    if (e.action === 'open') return this.openDetail(id);
    if (e.action === 'students' || e.action === 'mentors') return this.openMembers(id, e.action);
    if (e.action === 'remove') void this.remove(id);
  }

  async remove(id: string): Promise<void> {
    const e = this.store.get(id);
    if (!e) return;
    if (!(await this.toast.confirm('Remove enrollment?', `${e.course} will no longer run for ${e.batch}. The batch's ${e.students} student(s) stay in the batch but lose access to this course.`, 'Yes, remove'))) return;
    try {
      await this.store.removeEnrollment(id);
    } catch (error) {
      return this.toast.error('Could not remove the enrollment', apiErrorMessage(error));
    }
    this.log.record('Enrollment', `Removed ${e.course} from ${e.batch}`);
    this.toast.success('Enrollment removed');
    this.selected.update(list => list.filter(x => x !== id));
    this.changed();
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, 'sharp-enrollments', 'Enrollments');
  }
}
