import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentViewService } from '../../../shared/common-services/assessment-view.service';
import { MyAssessmentsService } from '../../../shared/common-services/my-assessments.service';
import { MyAssessment } from '../../../shared/models/my-assessment.model';

type Filter = 'all' | 'quiz' | 'assignment' | 'assessment';

/** Student "Assessments": the quizzes, assignments and assessments of the courses the student's batch takes. */
@Component({
  selector: 'app-student-assessments',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './student-assessments.html',
  styleUrls: ['../../../shared/styles/erp-page.scss', '../student.scss', './student-assessments.scss'],
})
export class StudentAssessments implements OnInit {
  private readonly store = inject(MyAssessmentsService);

  readonly loaded = this.store.loaded;
  readonly error = signal<string | null>(null);
  readonly filter = signal<Filter>('all');
  readonly filters: { key: Filter; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'quiz', label: 'Quizzes' }, { key: 'assignment', label: 'Assignments' }, { key: 'assessment', label: 'Assessments' },
  ];

  readonly visible = computed(() => this.store.items().filter(a => this.filter() === 'all' || a.type === this.filter()));

  /** The list grouped by course, in the order the API returns them. */
  readonly byCourse = computed(() => {
    const groups = new Map<string, MyAssessment[]>();
    for (const a of this.visible()) groups.set(a.course, [...(groups.get(a.course) ?? []), a]);
    return [...groups].map(([course, items]) => ({ course, items }));
  });

  readonly summary = computed(() => {
    const quizzes = this.store.items().filter(a => a.type !== 'assignment');
    return {
      quizzes: quizzes.length,
      passed: quizzes.filter(a => a.passed).length,
      todo: quizzes.filter(a => !a.attempts_used && !a.in_progress_attempt_id).length,
      assignments: this.store.items().filter(a => a.type === 'assignment').length,
      submitted: this.store.items().filter(a => a.type === 'assignment' && !!a.latest_submission).length,
    };
  });

  private readonly viewer = inject(AssessmentViewService);

  view(a: MyAssessment): void {
    this.viewer.openStudent(a);
  }

  ngOnInit(): void {
    this.store.load().catch(e => this.error.set(apiErrorMessage(e)));
  }

  /** What the main button says for a quiz. */
  action(a: MyAssessment): { label: string; disabled: boolean } {
    if (a.locked_reason) return { label: 'Locked', disabled: true };
    if (a.in_progress_attempt_id) return { label: 'Resume', disabled: false };
    const used = a.attempts_used ?? 0;
    if (!used) return { label: 'Start', disabled: false };
    return a.attempts_allowed === null || a.attempts_allowed > used ? { label: 'Try again', disabled: false } : { label: 'View result', disabled: false };
  }

  /** "45 min", "1 h 10 min". */
  minutes(sec: number | null): string {
    if (!sec) return 'Untimed';
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}` : `${m} min`;
  }

  submissionStatus(a: MyAssessment): { text: string; tone: string } {
    const status = a.latest_submission?.status;
    if (status === 'graded') return { text: 'Graded', tone: 'g' };
    if (status === 'returned') return { text: 'Returned', tone: 'w' };
    if (status === 'under_review') return { text: 'Under review', tone: 'w' };
    if (status === 'submitted') return { text: 'Submitted', tone: 'b' };
    return { text: 'Not submitted', tone: '' };
  }

  status(a: MyAssessment): { text: string; tone: string } {
    if (a.in_progress_attempt_id) return { text: 'In progress', tone: 'w' };
    if (a.passed) return { text: 'Passed', tone: 'g' };
    if (a.attempts_used) return { text: 'Not passed', tone: 'd' };
    return { text: 'Not attempted', tone: '' };
  }
}
