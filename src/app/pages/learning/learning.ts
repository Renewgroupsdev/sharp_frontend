import { CommonModule } from '@angular/common';
import { Component, OnInit, computed, inject } from '@angular/core';
import { MatDialogModule } from '@angular/material/dialog';
import { apiErrorMessage } from '../../core/http/api.interceptor';
import { ActivityLogService } from '../../shared/common-services/activity-log.service';
import { CoursesService } from '../../shared/common-services/courses.service';
import { LearningService } from '../../shared/common-services/learning.service';
import { ToastService } from '../../shared/common-services/toast.service';
import { UserDetailService } from '../../shared/common-services/user-detail.service';
import { UsersService } from '../../shared/common-services/users.service';
import { CountRibbon } from '../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../shared/components/local-list-base';
import { CanActionDirective } from '../../shared/directives/can-action.directive';
import { DetailCardData, ExportFormat, FilterOption, TableColumn, TableRow } from '../../shared/models/common-components.model';
import { PROGRESS_BUCKETS, bucketOf } from '../../shared/models/learning.model';
import { LearningForm } from './learning-form/learning-form';
import { LearningReport } from './learning-report/learning-report';

/** Learning Management: each enrolled student's progress per course, with a per-module report. */
@Component({
  selector: 'app-learning',
  standalone: true,
  imports: [CommonModule, MatDialogModule, CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective],
  templateUrl: './learning.html',
  styleUrls: ['../../shared/styles/erp-page.scss'],
})
export class Learning extends LocalListBase implements OnInit {
  private readonly store = inject(LearningService);
  private readonly courses = inject(CoursesService);
  private readonly users = inject(UsersService);
  private readonly toast = inject(ToastService);
  private readonly log = inject(ActivityLogService);

  protected readonly noun = 'learning records';
  /** Filter card slots reused: status = progress bucket, source = course, branch = institute. */
  protected override filterFields = { status: 'bucket', source: 'course', branch: ['org'] };

  override filters: FilterOption[] = this.buildFilters();

  columns: TableColumn[] = [
    { key: 'student', header: 'Student', type: 'lead', width: '18%' },
    { key: 'org', header: 'Institute', width: '18%' },
    { key: 'course', header: 'Course', width: '18%' },
    { key: 'progress', header: 'Progress (% completed)', type: 'progress', width: '22%', minWidth: 170 },
    { key: 'status', header: 'Status', type: 'badge', width: '10%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', menu: true, width: '12%', sortable: false },
  ];

  override sortActive = 'student';
  override sortDirection: 'asc' | 'desc' = 'asc';

  ngOnInit(): void {
    // Enrolment comes from the course's batches, so courses (for the module report) load alongside the records.
    this.store.loadFromApi()
      .then(() => { this.filters = this.buildFilters(); })
      .catch(e => this.toast.error('Could not load learning records', apiErrorMessage(e)));
    this.courses.loadFromApi().catch(() => undefined);
    void this.users.refresh();
  }

  private buildFilters(): FilterOption[] {
    const records = this.store.items();
    const unique = (pick: (r: (typeof records)[number]) => string) => [...new Set(records.map(pick).filter(x => !!x && x !== '—'))].sort();
    return [
      { key: 'status', label: 'Progress', options: PROGRESS_BUCKETS.map(b => b.label) },
      { key: 'source', label: 'Course', options: unique(r => r.course) },
      { key: 'branch', label: 'Institute', multiSelect: true, options: unique(r => r.org) },
    ];
  }

  readonly stats = computed<DetailCardData[]>(() => {
    const all = this.store.items();
    return [
      { label: 'Learning records', value: all.length, icon: 'bi-collection-play', iconVariant: 'blue' },
      { label: 'Average progress', value: all.length ? `${Math.round(all.reduce((a, x) => a + x.progress, 0) / all.length)}%` : '—', icon: 'bi-graph-up-arrow', iconVariant: 'green' },
      { label: 'Completed', value: all.filter(x => x.status === 'Completed').length, icon: 'bi-check-circle-fill', iconVariant: 'purple' },
      { label: 'In progress', value: all.filter(x => x.status === 'In progress').length, icon: 'bi-hourglass-split', iconVariant: 'orange' },
    ];
  });

  private readonly userDetail = inject(UserDetailService);

  /** A student's name opens their details, as in User Management. */
  openProfile(row: TableRow): void { this.userDetail.open(String(row['sid']), 'learning'); }

  protected allRows(): TableRow[] {
    return this.store.items().map(r => {
      return {
        id: r.id,
        sid: r.sid,
        student: { name: r.name, subtitle: r.sid, photo: this.users.photoOf(r.sid) },
        __student: r.name,
        searchText: `${r.name} ${r.sid}`,
        org: r.org,
        course: r.course,
        bucket: bucketOf(r.progress),
        progress: { value: r.progress, sub: `${r.mats} lesson(s) completed` },
        __progress: r.progress,
        status: r.status,
        actions: [
          { key: 'report', icon: 'bi-bar-chart-line-fill', label: 'Progress report', permission: 'a_learn.view' },
          { key: 'edit', icon: 'bi-pencil-square', label: 'Edit progress', variant: 'primary' as const, permission: 'a_learn.edit' },
          { key: 'reset', icon: 'bi-arrow-counterclockwise', label: 'Reset progress', variant: 'danger' as const, permission: 'a_learn.delete' },
        ],
      };
    });
  }

  addRecord(): void {
    this.openDialog(LearningForm, {}, '700px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const id = String(e.row['id']);
    if (e.action === 'report') return void this.openDialog(LearningReport, { id }, '760px').afterClosed().subscribe(edit => edit && this.openDialog(LearningForm, { id }, '700px'));
    if (e.action === 'edit') return void this.openDialog(LearningForm, { id }, '700px');
    if (e.action === 'reset') {
      const r = this.store.get(id);
      if (!r) return;
      if (!(await this.toast.confirm('Reset progress?', `${r.name}'s progress in ${r.course} goes back to 0%. They stay enrolled.`, 'Yes, reset'))) return;
      try {
        await this.store.resetProgress(id);
      } catch (error) {
        return this.toast.error('Could not reset the progress', apiErrorMessage(error));
      }
      this.log.record('Learning Management', `Reset learning progress of ${r.name} in ${r.course}`);
      this.toast.success('Progress reset');
    }
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, 'sharp-learning', 'Learning progress');
  }
}
