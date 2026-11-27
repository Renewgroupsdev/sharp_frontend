import { Component, Input, computed, inject } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { HeaderActionsDirective } from '../../../shared/directives/header-actions.directive';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { AssessType, QUESTION_TYPES } from '../../../shared/models/assessment.model';
import { FilterOption, TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { QuestionForm } from '../question-form/question-form';

/** Question bank: every question with its group, type and marks. */
@Component({
  selector: 'app-question-bank',
  standalone: true,
  imports: [CommonFilterCard, CommonTableCard, CanActionDirective, HeaderActionsDirective],
  templateUrl: './question-bank.html',
  styleUrls: ['../../../shared/styles/erp-page.scss'],
})
export class QuestionBank extends LocalListBase {
  private readonly store = inject(AssessmentsService);
  private readonly toast = inject(ToastService);

  /** Which kind of question bank: the questions of quiz groups or of assessment groups. */
  @Input() type: AssessType = 'Quiz';

  protected readonly noun = 'questions';
  protected override filterFields = { status: 'type', source: 'groupTitle', branch: ['groupTitle'] };

  readonly filterOptions = computed<FilterOption[]>(() => [
    { key: 'source', label: 'Group', options: this.store.groupsOf(this.type).map(g => g.title) },
    { key: 'status', label: 'Type', options: [...QUESTION_TYPES] as string[] },
  ]);

  columns: TableColumn[] = [
    { key: 'groupTitle', header: 'Group', width: '17%' },
    { key: 'question', header: 'Question', width: '40%' },
    { key: 'type', header: 'Type', width: '14%' },
    { key: 'marks', header: 'Marks', width: '7%' },
    { key: 'image', header: 'Image', width: '8%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '10%', sortable: false },
  ];

  override sortActive = 'id';
  override sortDirection: 'asc' | 'desc' = 'asc';

  protected allRows(): TableRow[] {
    return this.store.questionsOf(this.type).map(x => ({
      id: x.id,
      groupTitle: this.store.groupTitle(x.gid),
      question: x.q.length > 140 ? `${x.q.slice(0, 140)}…` : x.q,
      searchText: x.q,
      type: x.type,
      marks: String(x.marks), __marks: Number(x.marks),
      image: x.image ? 'Yes' : '—',
      actions: [
        { key: 'edit', icon: 'bi-pencil-square', label: 'Edit', variant: 'primary', permission: 'a_assess.edit' },
        { key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger', permission: 'a_assess.delete' },
      ],
    }));
  }

  add(): void {
    this.openDialog(QuestionForm, { type: this.type }, '780px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const id = String(e.row['id']);
    if (e.action === 'edit') return void this.openDialog(QuestionForm, { id, type: this.type }, '780px');
    if (!(await this.toast.confirm('Delete question?', `Remove question ${id} from the question bank?`))) return;
    try {
      await this.store.removeQuestion(id);
      this.toast.success('Question deleted');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}
