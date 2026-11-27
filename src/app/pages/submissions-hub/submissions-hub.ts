import { Component, signal } from '@angular/core';
import { QuizAttempts } from '../assessments/quiz-attempts/quiz-attempts';
import { SubmissionsPage } from '../mentor/submissions/submissions';

type Tab = 'quiz' | 'assessment' | 'assignment';

/**
 * Submissions: everything students hand in, in one place. One tab per kind: quiz and assessment attempts (marked by the
 * system) and assignment submissions (graded by the mentor).
 */
@Component({
  selector: 'app-submissions-hub',
  standalone: true,
  imports: [QuizAttempts, SubmissionsPage],
  templateUrl: './submissions-hub.html',
  styleUrls: ['../../shared/styles/erp-page.scss', './submissions-hub.scss'],
})
export class SubmissionsHub {
  readonly tab = signal<Tab>('quiz');
  readonly tabs: { key: Tab; label: string; icon: string }[] = [
    { key: 'quiz', label: 'Quizzes', icon: 'bi-patch-question' },
    { key: 'assessment', label: 'Assessments', icon: 'bi-patch-check' },
    { key: 'assignment', label: 'Assignments', icon: 'bi-journal-text' },
  ];
}
