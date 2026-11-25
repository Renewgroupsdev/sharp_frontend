import { Component, Input, computed, inject } from '@angular/core';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { CountRibbon } from '../../../shared/components/count-ribbon/count-ribbon';
import { CommonFilterCard } from '../../../shared/components/common-filter-card/common-filter-card';
import { CommonTableCard } from '../../../shared/components/common-table-card/common-table-card';
import { LocalListBase } from '../../../shared/components/local-list-base';
import { AssessType } from '../../../shared/models/assessment.model';
import { RibbonItem, ExportFormat, TableColumn, TableRow } from '../../../shared/models/common-components.model';

/** Quiz results per student with pass / fail against each quiz's pass percentage. */
@Component({
  selector: 'app-quiz-report',
  standalone: true,
  imports: [CountRibbon, CommonFilterCard, CommonTableCard],
  templateUrl: './quiz-report.html',
  styleUrls: ['../../../shared/styles/erp-page.scss'],
})
export class QuizReport extends LocalListBase {
  private readonly store = inject(AssessmentsService);

  /** Quiz results or assessment results; the two are reported separately. */
  @Input() type: AssessType = 'Quiz';

  protected readonly noun = 'results';

  private results() {
    const ids = new Set(this.store.items().filter(a => a.type === this.type).map(a => a.id));
    return this.store.results.items().filter(r => ids.has(r.quizId));
  }
  /** Filter card slots reused: status = outcome, source = course, branch = quiz. */
  protected override filterFields = { status: 'status', source: 'course', branch: ['quiz'] };

  override filters = [
    { key: 'status', label: 'Result', options: ['Pass', 'Fail'] },
    { key: 'source', label: 'Course', options: this.store.courseTitles() },
    { key: 'branch', label: 'Quiz', multiSelect: true, options: this.store.items().filter(a => a.type === this.type).map(q => q.title) },
  ];

  columns: TableColumn[] = [
    { key: 'student', header: 'Student', type: 'lead', width: '20%' },
    { key: 'course', header: 'Course', width: '20%' },
    { key: 'quiz', header: 'Quiz', width: '22%' },
    { key: 'score', header: 'Marks', width: '10%' },
    { key: 'resultText', header: 'Result %', width: '10%' },
    { key: 'attempts', header: 'Attempts', width: '8%' },
    { key: 'status', header: 'Status', type: 'badge', width: '10%' },
  ];

  override sortActive = 'student';
  override sortDirection: 'asc' | 'desc' = 'asc';

  readonly stats = computed<RibbonItem[]>(() => {
    const all = this.results();
    const passed = all.filter(r => r.result >= r.minp).length;
    return [
      { label: 'Attempts recorded', value: all.length, icon: 'bi-clipboard-data', iconVariant: 'blue' },
      { label: 'Passed', value: passed, icon: 'bi-check-circle-fill', iconVariant: 'green', filter: { key: 'status', value: 'Pass' } },
      { label: 'Failed', value: all.length - passed, icon: 'bi-x-circle-fill', iconVariant: 'orange', filter: { key: 'status', value: 'Fail' } },
      { label: 'Average result', value: all.length ? `${Math.round(all.reduce((s, r) => s + r.result, 0) / all.length)}%` : '—', icon: 'bi-graph-up-arrow', iconVariant: 'purple' },
    ];
  });

  protected allRows(): TableRow[] {
    return this.results().map(r => ({
      id: r.id,
      student: { name: r.name, subtitle: r.sid },
      __student: r.name,
      searchText: `${r.name} ${r.sid} ${r.quiz}`,
      course: r.course,
      quiz: r.quiz,
      score: `${r.marks} / ${r.total}`, __score: r.marks,
      resultText: `${r.result}%`, __resultText: r.result,
      attempts: String(r.attempts), __attempts: r.attempts,
      status: r.result >= r.minp ? 'Pass' : 'Fail',
    }));
  }

  onExport(format: ExportFormat): void {
    this.exportAs(format, `sharp-${this.type.toLowerCase()}-results`, `${this.type} report`);
  }
}
