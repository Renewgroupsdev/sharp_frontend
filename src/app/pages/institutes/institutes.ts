import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { AuthService } from '../../core/auth/auth.service';
import { MatDialogModule } from '@angular/material/dialog';
import { Institute } from '../../core/data/models';
import { BatchesService } from '../../shared/common-services/batches.service';
import { CoursesService } from '../../shared/common-services/courses.service';
import { InstituteActionsService } from '../../shared/common-services/institute-actions.service';
import { InstitutesService } from '../../shared/common-services/institutes.service';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { ToastService } from '../../shared/common-services/toast.service';
import { DetailCardData, ExportFormat, FilterOption, QuickAction, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { BatchRecord } from '../../shared/models/institute.model';
import { BatchForm } from './batch-form/batch-form';
import { BatchView } from './batch-view/batch-view';
import { InstituteForm } from './institute-form/institute-form';
import { InstituteView } from './institute-view/institute-view';

type OrgTab = 'inst' | 'batch';

const FORM_WIDTH = '760px';
const VIEW_WIDTH = '640px';

const INSTITUTE_COLUMNS: TableColumn[] = [
  { key: 'institute', header: 'College / institute', type: 'lead', width: '26%', minWidth: 200 },
  { key: 'city', header: 'City', width: '11%' },
  { key: 'principal', header: 'Principal', width: '16%' },
  { key: 'contact', header: 'Phone', width: '14%' },
  { key: 'students', header: 'Students', type: 'countList', width: '9%' },
  { key: 'status', header: 'Status', type: 'badge', width: '10%' },
  { key: 'actions', header: 'Actions', type: 'quickActions', width: '14%', minWidth: 130, sortable: false },
];

const BATCH_COLUMNS: TableColumn[] = [
  { key: 'batch', header: 'Batch', type: 'lead', width: '17%', minWidth: 170 },
  { key: 'duration', header: 'Duration', width: '16%' },
  { key: 'seats', header: 'Seats', width: '6%' },
  { key: 'students', header: 'Students', type: 'countList', width: '7%' },
  { key: 'mentors', header: 'Mentors', width: '7%' },
  { key: 'orgs', header: 'Institutes', width: '13%' },
  { key: 'courses', header: 'Courses', type: 'countList', width: '8%' },
  { key: 'status', header: 'Status', type: 'badge', width: '9%' },
  { key: 'actions', header: 'Actions', type: 'quickActions', width: '14%', minWidth: 130, sortable: false },
];

/** Batch status as stored -> label shown in the table (and its filter). */
const BATCH_STATUS_LABEL: Record<string, string> = { running: 'In progress', enrolling: 'Upcoming', closed: 'Closed' };

const action = (key: string, icon: string, label: string, permission: string, variant?: QuickAction['variant']): QuickAction => ({ key, icon, label, permission, variant });

/** Row buttons shared by both tables; `noun` only feeds the tooltips. */
const rowActions = (noun: string): QuickAction[] => [
  action('view', 'bi-eye-fill', `View ${noun}`, 'a_orgs.view'),
  action('edit', 'bi-pencil-square', `Edit ${noun}`, 'a_orgs.edit', 'primary'),
  action('delete', 'bi-trash3-fill', `Delete ${noun}`, 'a_orgs.delete', 'danger'),
];

/** Institute Management: colleges / institutes and the batches they take part in (search, filter, add / edit / delete, export). */
@Component({
  selector: 'app-institutes',
  standalone: true,
  imports: [MatDialogModule, CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective],
  templateUrl: './institutes.html',
  styleUrls: ['../../shared/styles/erp-page.scss'],
})
export class Institutes extends LocalListBase implements OnInit {
  private readonly institutes = inject(InstitutesService);
  private readonly batches = inject(BatchesService);
  private readonly courses = inject(CoursesService);
  private readonly actions = inject(InstituteActionsService);
  private readonly toast = inject(ToastService);

  readonly tab = signal<OrgTab>('inst');
  private readonly authForTabs = inject(AuthService);
  readonly tabs: { key: OrgTab; label: string }[] = [
    { key: 'inst' as OrgTab, label: 'Colleges / institutes', slug: 'a_orgs.tab.institutes' },
    { key: 'batch' as OrgTab, label: 'Batch details', slug: 'a_orgs.tab.batches' },
  ].filter(t => this.authForTabs.hasTab(t.slug));

  override columns = INSTITUTE_COLUMNS;
  override filters = this.instituteFilters();
  protected override filterFields = { status: 'status', source: 'city', branch: ['city'] };

  /** Rows are rebuilt from the active tab's store, so counts in the footer use the matching noun. */
  protected get noun(): string { return this.tab() === 'inst' ? 'institutes' : 'batches'; }

  ngOnInit(): void {
    // Batches reference institutes by name, so load institutes first.
    void this.institutes.loadInstitutes()
      .catch(error => this.toast.error('Unable to load institutes', apiErrorMessage(error)))
      .then(() => this.batches.loadBatches())
      .then(() => this.courses.loadFromApi())
      .catch(error => this.toast.error('Unable to load batches', apiErrorMessage(error)));
  }

  get searchPlaceholder(): string {
    return this.tab() === 'inst' ? 'Filter by name, code, city, phone or email...' : 'Filter by batch name, ID or institute...';
  }

  get title(): string { return this.tab() === 'inst' ? 'Colleges / institutes' : 'Batches'; }

  /** Stat tiles for the active tab. */
  readonly stats = computed<DetailCardData[]>(() => {
    if (this.tab() === 'batch') {
      const list = this.batches.items();
      const seats = list.reduce((n, b) => n + b.seats, 0);
      return [
        { label: 'Batches', value: list.length, icon: 'bi-collection-fill', iconVariant: 'blue' },
        { label: 'In progress', value: list.filter(b => b.st === 'running').length, icon: 'bi-play-circle-fill', iconVariant: 'orange' },
        { label: 'Upcoming', value: list.filter(b => b.st === 'enrolling').length, icon: 'bi-calendar-plus-fill', iconVariant: 'green' },
        { label: 'Total seats', value: seats, icon: 'bi-person-workspace', iconVariant: 'purple' },
      ];
    }
    const list = this.institutes.items();
    return [
      { label: 'Institutes', value: list.length, icon: 'bi-bank2', iconVariant: 'blue' },
      { label: 'Active', value: list.filter(o => o.st === 'Active').length, icon: 'bi-check-circle-fill', iconVariant: 'green' },
      { label: 'Students enrolled', value: list.reduce((n, o) => n + this.institutes.studentCount(o), 0), icon: 'bi-mortarboard-fill', iconVariant: 'purple' },
      { label: 'Cities', value: new Set(list.map(o => o.city)).size, icon: 'bi-geo-alt-fill', iconVariant: 'orange' },
    ];
  });

  /** Per-tab handlers for the table's quick actions, keyed by `QuickAction.key`. */
  private readonly handlers: Record<OrgTab, Record<string, (id: string) => unknown>> = {
    inst: {
      view: id => this.viewInstitute(id),
      edit: id => this.editInstitute(id),
      delete: id => this.actions.removeInstitute(id),
    },
    batch: {
      view: id => this.viewBatch(id),
      edit: id => this.editBatch(id),
      delete: id => this.actions.removeBatch(id),
    },
  };

  protected allRows(): TableRow[] {
    return this.tab() === 'inst'
      ? this.institutes.items().map(o => this.instituteRow(o))
      : this.batches.items().map(b => this.batchRow(b));
  }

  /** Table row for one institute; `__students` keeps the raw number for sorting. */
  private instituteRow(o: Institute): TableRow {
    const students = this.institutes.studentNames(o);
    return {
      id: o.id,
      institute: { name: o.n, subtitle: o.code },
      __institute: o.n,
      searchText: [o.n, o.code, o.city, o.ph, o.email, o.pr].join(' '),
      city: o.city,
      principal: o.pr,
      contact: o.ph,
      students,
      __students: students.length,
      status: o.st,
      actions: rowActions('institute'),
    };
  }

  /** Table row for one batch; the status is shown as a label but stored raw. */
  private batchRow(b: BatchRecord): TableRow {
    const students = this.batches.studentNames(b);
    const orgs = b.orgs?.length ? b.orgs.join(', ') : 'All';
    return {
      id: b.id,
      batch: { name: b.n, subtitle: b.id },
      __batch: b.n,
      searchText: [b.n, b.id, orgs, ...(b.courses ?? [])].join(' '),
      duration: `${b.start} – ${b.end}`,
      seats: b.seats,
      __seats: b.seats,
      students,
      __students: students.length,
      mentors: b.mentors,
      __mentors: b.mentors,
      orgs,
      courses: b.courses ?? [], __courses: b.courses?.length ?? 0,
      status: BATCH_STATUS_LABEL[b.st] ?? b.st,
      actions: rowActions('batch'),
    };
  }

  /** Filter-card config for the institutes tab: status plus city (reuses the card's `source` slot). */
  private instituteFilters(): FilterOption[] {
    const cities = [...new Set(this.institutes.items().map(o => o.city))].sort();
    return [
      { key: 'status', label: 'Status', options: ['Active', 'Inactive'] },
      { key: 'source', label: 'City', options: cities },
    ];
  }

  /** Switches tab: swaps columns / filters and clears search, filters, sort and paging so the new table starts clean. */
  setTab(tab: OrgTab): void {
    if (tab === this.tab()) return;
    this.tab.set(tab);
    this.columns = tab === 'inst' ? INSTITUTE_COLUMNS : BATCH_COLUMNS;
    this.filters = tab === 'inst' ? this.instituteFilters() : [{ key: 'status', label: 'Status', options: Object.values(BATCH_STATUS_LABEL) }];
    this.filterFields = { status: 'status', source: 'city', branch: ['city'] };
    this.searchTerm = '';
    this.filterState = { status: null, source: null, branch: [], telecaller: null, dateFrom: null, dateTo: null };
    this.sortActive = '';
    this.currentPage = 1;
    this.refresh();
  }

  addInstitute(): void { this.openDialog(InstituteForm, {}, FORM_WIDTH); }
  addBatch(): void { this.openDialog(BatchForm, {}, FORM_WIDTH); }

  editInstitute(instituteId: string): void { this.openDialog(InstituteForm, { instituteId }, FORM_WIDTH); }
  editBatch(batchId: string): void { this.openDialog(BatchForm, { batchId }, FORM_WIDTH); }

  /** Detail dialogs; their Edit button hands over to the matching edit form. */
  viewInstitute(instituteId: string): void {
    this.openDialog<InstituteView, 'edit' | undefined>(InstituteView, { instituteId }, VIEW_WIDTH)
      .afterClosed().subscribe(r => { if (r === 'edit') this.editInstitute(instituteId); });
  }

  viewBatch(batchId: string): void {
    this.openDialog<BatchView, 'edit' | undefined>(BatchView, { batchId }, VIEW_WIDTH)
      .afterClosed().subscribe(r => { if (r === 'edit') this.editBatch(batchId); });
  }

  /** Opens the profile for a clicked name cell. */
  open(row: TableRow): void {
    const id = String(row['id']);
    if (this.tab() === 'inst') this.viewInstitute(id); else this.viewBatch(id);
  }

  onQuickAction(event: { row: TableRow; action: string }): void {
    this.handlers[this.tab()][event.action]?.(String(event.row['id']));
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, this.tab() === 'inst' ? 'sharp-institutes' : 'sharp-batches', this.title);
  }
}
