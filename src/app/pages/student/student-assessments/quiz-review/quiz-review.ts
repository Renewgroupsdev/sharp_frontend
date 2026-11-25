import { Component, OnInit, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { apiErrorMessage } from '../../../../core/http/api.interceptor';
import { MyAssessmentsApi } from '../../../../shared/common-services/my-assessments.service';
import { AnswerValue, QuizReview, ReviewQuestion } from '../../../../shared/models/my-assessment.model';

/** Review of a finished attempt: the student's answers, and, when the quiz setup allows it, the right answers and explanations. */
@Component({
  selector: 'app-quiz-review',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './quiz-review.html',
  styleUrls: ['../../../../shared/styles/erp-page.scss', '../../student.scss', '../quiz-attempt/quiz-attempt.scss', './quiz-review.scss'],
})
export class QuizReviewPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(MyAssessmentsApi);

  protected readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly review = signal<QuizReview | null>(null);
  readonly error = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const attempt = Number(this.route.snapshot.queryParamMap.get('attempt')) || undefined;
    try {
      this.review.set(await this.api.review(this.id, attempt));
    } catch (e) {
      this.error.set(apiErrorMessage(e));
    }
  }

  /** The student's or the right answer as readable lines. */
  lines(q: ReviewQuestion, value: unknown): string[] {
    if (value === null || value === undefined || value === '') return ['No answer'];
    switch (q.type) {
      case 'multiple_choice': return (value as number[]).map(i => q.options?.[i] ?? `Option ${i + 1}`);
      case 'sorting': return (value as string[]).map((v, i) => `${i + 1}. ${v}`);
      case 'matching': return (value as string[][]).map(p => `${p[0]} → ${p[1]}`);
      case 'short_answer': {
        const a = value as { answer?: string; keywords?: string };
        return [a.answer ?? '', a.keywords ? `Also accepted: ${a.keywords}` : ''].filter(Boolean);
      }
      default: return [String(value)];
    }
  }

  yours(q: ReviewQuestion): string[] { return this.lines(q, q.your_answer as AnswerValue); }

  /** Whether the right answer is worth showing next to the student's. */
  hasAnswer(q: ReviewQuestion): boolean { return q.correct_answer !== undefined && q.correct_answer !== null; }

  tone(q: ReviewQuestion): string { return q.correct === null ? 'w' : q.correct ? 'g' : 'd'; }

  label(q: ReviewQuestion): string {
    if (q.correct === null) return 'Waiting for your mentor';
    return q.correct ? 'Correct' : q.marks_awarded > 0 ? `Partly correct · ${q.marks_awarded}/${q.marks}` : 'Incorrect';
  }
}
