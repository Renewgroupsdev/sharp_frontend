import { Component, Input, inject } from '@angular/core';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { HeaderActionsDirective } from '../../../shared/directives/header-actions.directive';
import { CanActionDirective } from '../../../shared/directives/can-action.directive';
import { AssessType } from '../../../shared/models/assessment.model';
import { TableColumn, TableRow } from '../../../shared/models/common-components.model';
import { GroupForm } from '../group-form/group-form';

/** Question groups: a quiz draws its questions from the groups chosen in its setup. */
@Component({
  selector: 'app-question-groups',
  standalone: true,
  imports: [CommonFilterCard, CommonTableCard, CanActionDirective, HeaderActionsDirective],
  templateUrl: './question-groups.html',
  styleUrls: ['../../../shared/styles/erp-page.scss'],
})
export class QuestionGroups extends LocalListBase {
  private readonly store = inject(AssessmentsService);
  private readonly toast = inject(ToastService);

  /** Which kind of group this list holds: quizzes and assessments each have their own. */
  @Input() type: AssessType = 'Quiz';

  protected readonly noun = 'groups';

  columns: TableColumn[] = [
    { key: 'title', header: 'Question group', type: 'lead', width: '45%' },
    { key: 'questions', header: 'Questions', width: '15%' },
    { key: 'used', header: 'Used by', width: '20%' },
    { key: 'actions', header: 'Actions', type: 'quickActions', width: '10%', sortable: false },
  ];

  override sortActive = 'title';
  override sortDirection: 'asc' | 'desc' = 'asc';

  protected allRows(): TableRow[] {
    const users = this.store.items().filter(a => a.type === this.type);
    return this.store.groupsOf(this.type).map(g => {
      const questions = this.store.questions.items().filter(q => q.gid === g.id).length;
      return {
        id: g.id,
        title: { name: g.title, subtitle: g.id },
        __title: g.title,
        searchText: `${g.title} ${g.id}`,
        questions: String(questions), __questions: questions,
        used: String(users.filter(a => a.setup?.groups.includes(g.id)).length),
        actions: [
          { key: 'edit', icon: 'bi-pencil-square', label: 'Edit', variant: 'primary', permission: 'a_assess.edit' },
          { key: 'delete', icon: 'bi-trash3-fill', label: 'Delete', variant: 'danger', permission: 'a_assess.delete' },
        ],
      };
    });
  }

  add(): void {
    this.openDialog(GroupForm, { type: this.type }, '420px');
  }

  async onQuickAction(e: { row: TableRow; action: string }): Promise<void> {
    const id = String(e.row['id']);
    if (e.action === 'edit') return void this.openDialog(GroupForm, { id, type: this.type }, '420px');
    const g = this.store.groups.get(id);
    if (!g) return;
    const n = this.store.questionCount(id);
    if (n) return void this.toast.warning(`${n} question(s) are in “${g.title}” — delete or move them first`);
    if (!(await this.toast.confirm('Delete question group?', `Remove ${g.title}?`))) return;
    try {
      await this.store.removeGroup(id);
      this.toast.success('Group deleted');
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}
