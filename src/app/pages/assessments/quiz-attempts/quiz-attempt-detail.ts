import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../../core/auth/auth.service';
import { apiErrorMessage } from '../../../core/http/api.interceptor';
import { AssessmentsApi } from '../../../shared/common-services/assessments-api.service';
import { ToastService } from '../../../shared/common-services/toast.service';
import { AttemptQuestion, OUTCOME_LABEL, QuizAttemptRow } from '../../../shared/models/quiz-attempt.model';
import { QuestionVerdict, answerLines, verdict } from '../../../shared/utils/attempt-answer.util';

const VERDICT_LABEL: Record<QuestionVerdict, string> = {
  correct: 'Correct', wrong: 'Wrong', partial: 'Partly right', pending: 'Needs marking', skipped: 'Not answered',
};
const VERDICTS: QuestionVerdict[] = ['correct', 'partial', 'wrong', 'skipped', 'pending'];

/** One attempt in full: summary, then every question the student was served, in order, with their answer and the right one. */
@Component({
  selector: 'app-quiz-attempt-detail',
  standalone: true,
  imports: [MatDialogModule, FormsModule],
  templateUrl: './quiz-attempt-detail.html',
  styleUrls: ['../../../shared/styles/erp-dialog.scss', './quiz-attempt-detail.scss'],
})
export class QuizAttemptDetail implements OnInit {
  private readonly ref = inject(MatDialogRef<QuizAttemptDetail>);
  private readonly data = inject<{ attemptId: number }>(MAT_DIALOG_DATA);
  private readonly api = inject(AssessmentsApi);
  private readonly toast = inject(ToastService);
  private readonly auth = inject(AuthService);

  /** Marking a long answer needs the Edit permission on Quiz Attempts. */
  readonly canMark = this.auth.can('a_attempts', 'u');
  /** What the marker has typed per question, and which question is being saved. */
  readonly drafts = signal<Record<number, { marks: number | null; feedback: string }>>({});
  readonly savingId = signal<number | null>(null);
  private changed = false;

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly attempt = signal<QuizAttemptRow | null>(null);
  readonly questions = signal<AttemptQuestion[]>([]);
  readonly outcomeLabel = OUTCOME_LABEL;
  readonly verdictLabel = VERDICT_LABEL;
  readonly verdicts = VERDICTS;
  readonly verdict = verdict;
  readonly lines = answerLines;

  /** How many questions fell into each verdict, for the summary strip. */
  readonly tally = computed(() => {
    const t: Record<QuestionVerdict, number> = { correct: 0, wrong: 0, partial: 0, pending: 0, skipped: 0 };
    for (const q of this.questions()) t[verdict(q)]++;
    return t;
  });

  async ngOnInit(): Promise<void> {
    try {
      const res = await this.api.getQuizAttempt(this.data.attemptId);
      this.attempt.set(res.attempt);
      this.load(res.attempt, res.questions);
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }

  private load(attempt: QuizAttemptRow, questions: AttemptQuestion[]): void {
    this.attempt.set(attempt);
    this.questions.set(questions);
    this.drafts.set(Object.fromEntries(questions.filter(q => q.type === 'long_answer')
      .map(q => [q.id, { marks: q.marked ? q.marks_awarded : null, feedback: q.feedback ?? '' }])));
  }

  /** A long answer of a submitted attempt that was not closed by the clock can be marked. */
  markable(q: AttemptQuestion): boolean {
    const o = this.attempt()?.outcome;
    return q.type === 'long_answer' && !!o && o !== 'in_progress' && o !== 'timed_out';
  }

  setMarks(id: number, value: number | null): void {
    this.drafts.update(d => ({ ...d, [id]: { ...d[id], marks: value } }));
  }

  setFeedback(id: number, value: string): void {
    this.drafts.update(d => ({ ...d, [id]: { ...d[id], feedback: value } }));
  }

  async saveMarks(q: AttemptQuestion): Promise<void> {
    const a = this.attempt();
    const draft = this.drafts()[q.id];
    const marks = draft?.marks;
    if (!a || marks === null || marks === undefined || !Number.isInteger(Number(marks)) || marks < 0 || marks > q.marks) {
      return void this.toast.error(`Enter whole marks from 0 to ${q.marks}.`);
    }
    this.savingId.set(q.id);
    try {
      const res = await this.api.gradeQuizAnswer(a.id, { question_id: q.id, marks: Number(marks), feedback: draft.feedback.trim() || undefined });
      this.changed = true;
      this.load(res.attempt, res.questions);
      this.toast.success('Marks saved');
    } catch (e) {
      this.toast.error(apiErrorMessage(e));
    } finally {
      this.savingId.set(null);
    }
  }

  when(iso: string | null): string {
    return iso ? new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
  }

  time(sec: number | null): string {
    return sec === null ? '—' : `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  }

  /** Closes with true when any marks were saved, so the list can refresh. */
  close(): void { this.ref.close(this.changed); }
}
