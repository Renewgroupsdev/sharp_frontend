import { Component, computed, inject, input } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentsService } from '../../../shared/common-services/assessments.service';
import { CoursesService } from '../../../shared/common-services/courses.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { AssessType, usesQuestions } from '../../../shared/models/assessment.model';
import { AssessmentForm } from '../../assessments/assessment-form/assessment-form';

const HINTS: Record<AssessType, string> = {
  Assignment: 'Assignments learners submit by a date, with marks and an optional attachment.',
  Assessment: 'Graded assessments (e.g. module-end or final) with marks and a minimum percentage.',
  Quiz: 'Quizzes per module or topic. Marks come from the question groups chosen for the quiz.',
};

/** One wizard step of the course form: the assignments, assessments or quizzes of a course, with add / edit / delete. */
@Component({
  selector: 'app-course-assessments',
  standalone: true,
  templateUrl: './course-assessments.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss'],
  styles: ['.step-head { display: flex; gap: 12px; align-items: center; justify-content: space-between; margin-bottom: 10px; } .step-hint { margin: 0; color: var(--text-muted); font-size: 12px; }'],
})
export class CourseAssessments {
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly courses = inject(CoursesService);
  private readonly store = inject(AssessmentsService);

  readonly courseId = input.required<string>();
  readonly type = input.required<AssessType>();

  readonly hint = computed(() => HINTS[this.type()]);
  readonly noun = computed(() => this.type().toLowerCase());
  readonly isQuiz = computed(() => usesQuestions(this.type()));
  private readonly title = computed(() => this.courses.get(this.courseId())?.title ?? '');

  readonly rows = computed(() => {
    const course = this.title(), type = this.type();
    return this.store.items().filter(a => a.course === course && a.type === type).map(a => ({
      id: a.id,
      title: a.title,
      module: a.module || '—',
      topic: a.topic || 'All topics',
      status: a.status,
      detail: usesQuestions(type) ? `${this.questionCount(a.setup?.groups ?? [])} questions` : a.due,
      marks: usesQuestions(type) ? this.store.quizTotal(a) : a.max,
      minp: usesQuestions(type) ? a.setup?.minp ?? a.minp ?? 60 : a.minp,
    }));
  });

  private questionCount(groups: string[]): number {
    return groups.reduce((n, g) => n + this.store.questionCount(g), 0);
  }

  open(id?: string): void {
    this.dialog.open(AssessmentForm, {
      width: '780px', maxWidth: 'calc(100vw - 32px)', maxHeight: '92vh', autoFocus: false,
      data: { id, type: this.type(), course: this.title() },
    });
  }

  async remove(id: string, title: string): Promise<void> {
    if (!(await this.toast.confirm(`Delete ${this.noun()}?`, `Remove “${title}” from this course.`))) return;
    try {
      await this.store.removeAssessment(id);
      this.toast.success(`${this.type()} deleted`);
    } catch (err) {
      this.toast.error(apiErrorMessage(err));
    }
  }
}
