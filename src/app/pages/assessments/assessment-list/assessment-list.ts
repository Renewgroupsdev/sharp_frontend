import { Component, Input, OnInit, computed, inject } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentViewService } from '../../../shared/common-services/assessment-view.service';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { HeaderActionsDirective } from '../../../shared/directives/header-actions.directive';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { ASSESS_STATUSES, ASSESS_TYPES, AssessType, usesQuestions } from '../../../shared/models/assessment.model';
import { RibbonItem, TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { AssessmentForm } from '../assessment-form/assessment-form';

/** Quizzes, assignments and assessments list. */
@Component({
  selector: 'app-assessment-list',
  standalone: true,
  imports: [CountRibbon, CommonFilterCard, CommonTableCard, CanActionDirective, HeaderActionsDirective],
  templateUrl: './assessment-list.html',
  styleUrls: ['../../../shared/styles/erp-page.scss'],
})
export class AssessmentList extends LocalListBase implements OnInit {
  private readonly store = inject(AssessmentsService);
  private readonly toast = inject(ToastService);
  private readonly viewer = inject(AssessmentViewService);

  /** One type pins the list to it and enables its create button; unset lists everything, filterable by type. */
  @Input() type?: AssessType;

  protected readonly noun = 'items';
  protected override filterFields = { status: 'status', source: 'course', branch: ['title'] };

  override filters = [
    { key: 'type', label: 'Type', options: [...ASSESS_TYPES] as string[] },
    { key: 'source', label: 'Course', options: this.store.courseTitles() },
    { key: 'status', label: 'Status', options: [...ASSESS_STATUSES] as string[] },
  ];

  columns: TableColumn[] = [
    { key: 'type', header: 'Type', width: '8%' },
    { key: 'title', header: 'Title', type: 'lead', width: '20%' },
    { key: 'courseCell', header: 'Course · module', type: 'lead', width: '20%' },
    { key: 'due', header: 'Due date', width: '10%' },
    { key: 'marks', header: 'Marks / min %', width: '13%' },
    { key: 'attachment', header: 'Attachment', width: '11%' },
    { key: 'status', header: 'Status', type: 'badge', width: '8%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '8%', sortable: false },
  ];

  override sortActive = 'id';
  override sortDirection: 'asc' | 'desc' = 'asc';

  /** Columns and filters that only make sense for a mixed list are dropped once the list is pinned to one type. */
  ngOnInit(): void {
    if (!this.type) return;
    const hidden = new Set(['type', ...(this.type && usesQuestions(this.type) ? ['due', 'attachment'] : [])]);
    this.columns = this.columns.filter(c => !hidden.has(c.key));
    this.filters = this.filters.filter(f => f.key !== 'type');
  }

  get label(): string { return this.type ? this.type.toLowerCase() : 'quiz / assignment / assessment'; }

  readonly stats = computed<RibbonItem[]>(() => {
    if (this.type) {
      const mine = this.store.items().filter(a => a.type === this.type);
      const by = (s: string) => mine.filter(a => a.status === s).length;
      return [
        { label: `Total ${this.type.toLowerCase()}s`, value: mine.length, icon: 'bi-collection-fill', iconVariant: 'purple' },
        { label: 'Published', value: by('Published'), icon: 'bi-check-circle-fill', iconVariant: 'green', filter: { key: 'status', value: 'Published' } },
        { label: 'Draft', value: by('Draft'), icon: 'bi-pencil-square', iconVariant: 'orange', filter: { key: 'status', value: 'Draft' } },
        { label: 'Closed', value: by('Closed'), icon: 'bi-lock-fill', iconVariant: 'blue', filter: { key: 'status', value: 'Closed' } },
      ];
    }
    const all = this.store.items();
    const n = (t: string) => all.filter(a => a.type === t).length;
    return [
      { label: 'Quizzes', value: n('Quiz'), icon: 'bi-patch-question', iconVariant: 'blue' },
      { label: 'Assignments', value: n('Assignment'), icon: 'bi-journal-text', iconVariant: 'purple' },
      { label: 'Assessments', value: n('Assessment'), icon: 'bi-clipboard-check', iconVariant: 'orange' },
      { label: 'Published', value: all.filter(a => a.status === 'Published').length, icon: 'bi-check-circle-fill', iconVariant: 'green', filter: { key: 'status', value: 'Published' } },
    ];
  });

  protected allRows(): TableRow[] {
    const type = this.type ?? this.filterState.type;
    return this.store.items().filter(a => !type || a.type === type).map(a => {
      const quiz = usesQuestions(a.type);
      return {
        id: a.id,
        type: a.type,
        title: { name: a.title, subtitle: a.id },
        __title: a.title,
        searchText: `${a.title} ${a.id} ${a.course} ${a.module}`,
        courseCell: { name: a.course, subtitle: `${a.module || '—'}${a.topic && a.topic !== 'All topics' ? ` · ${a.topic}` : ''}` },
        __courseCell: a.course,
        course: a.course,
        due: quiz ? '—' : a.due,
        marks: quiz
          ? `${this.store.quizTotal(a)} marks · pass ${a.setup?.minp ?? a.minp ?? 60}%`
          : `${a.max} marks · min ${a.minp}%`,
        attachment: a.attach ? `${a.attach.name} (${a.attach.size})` : '—',
        status: a.status,
        actions: [
          { key: 'view', icon: 'bi-eye', label: 'View', variant: 'primary', permission: 'a_assess.view' },
          { key: 'edit', icon: 'bi-pencil-square', label: 'Edit', variant: 'primary', permission: 'a_assess.edit' },
          { key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger', permission: 'a_assess.delete' },
        ],
      };
    });
  }

  add(): void {
    this.openDialog(AssessmentForm, { type: this.type, lockType: !!this.type }, '780px');
  }

  /** Edit form with every field open, including type and course. */
  private openEdit(id: string): void {
    this.openDialog(AssessmentForm, { id }, '780px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const id = String(e.row['id']);
    if (e.action === 'view') {
      const item = this.store.get(id);
      if (item) this.viewer.openStaff(item).subscribe(r => { if (r === 'edit') this.openEdit(id); });
    } else if (e.action === 'edit') {
      this.openEdit(id);
    } else if (e.action === 'delete') {
      if (!(await this.toast.confirm('Delete assessment?', `This removes ${id}.`))) return;
      try {
        await this.store.removeAssessment(id);
        this.toast.success('Deleted');
      } catch (err) {
        this.toast.error(apiErrorMessage(err));
      }
    }
  }
}
