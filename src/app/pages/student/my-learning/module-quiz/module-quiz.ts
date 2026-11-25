import { Component, computed, inject, input, output, signal } from '@angular/core';
import { MODULES, QUIZ } from '../../../../core/data/programme-data';
import { ActivityLogService } from '../../../../shared/common-services/activity-log.service';
import { StudentProgress } from '../../student-progress.service';

interface QuizQuestion { q: string; o: string[]; a: number; }

const PASS_MARK = 60;

/** Module assessment: answer every question, submit, then continue (unlocks the next module) or retry. */
@Component({
  selector: 'app-module-quiz',
  standalone: true,
  templateUrl: './module-quiz.html',
  styleUrls: ['../../student.scss', './module-quiz.scss'],
})
export class ModuleQuiz {
  private readonly progress = inject(StudentProgress);
  private readonly log = inject(ActivityLogService);
  readonly moduleId = input.required<number>();
  /** Closed with no result, or after a pass has been recorded. */
  readonly closed = output<void>();

  protected readonly letters = ['A', 'B', 'C', 'D'];
  protected readonly passMark = PASS_MARK;
  protected readonly answers = signal<Record<number, number>>({});
  protected readonly submitted = signal(false);

  protected readonly mod = computed(() => MODULES.find(m => m.id === this.moduleId())!);
  protected readonly questions = computed<QuizQuestion[]>(() => (QUIZ as Record<number, QuizQuestion[]>)[this.moduleId()] ?? []);
  protected readonly answered = computed(() => Object.keys(this.answers()).length);
  protected readonly score = computed(() => this.questions().filter((q, i) => this.answers()[i] === q.a).length);
  protected readonly pct = computed(() => Math.round((this.score() / Math.max(1, this.questions().length)) * 100));
  protected readonly passed = computed(() => this.pct() >= PASS_MARK);
  protected readonly nextModule = computed(() => (this.moduleId() < MODULES.length ? this.moduleId() + 1 : this.moduleId()));

  protected pick(q: number, o: number): void {
    if (!this.submitted()) this.answers.update(a => ({ ...a, [q]: o }));
  }

  protected submit(): void {
    if (this.answered() === this.questions().length) this.submitted.set(true);
  }

  protected retry(): void {
    this.answers.set({});
    this.submitted.set(false);
  }

  protected proceed(): void {
    this.progress.recordPass(this.moduleId(), this.pct());
    this.log.record('Assessment Management', `${this.mod().title} assessment passed with ${this.pct()}% by the student`);
    this.closed.emit();
  }
}
