/** Quiz attempts as staff and mentors see them (GET quiz-attempts). */
export type AttemptOutcome = 'passed' | 'not_passed' | 'needs_review' | 'timed_out' | 'in_progress';

export const ATTEMPT_OUTCOMES: readonly AttemptOutcome[] = ['passed', 'not_passed', 'needs_review', 'timed_out', 'in_progress'];

/** Label shown in the table, filters and badges. */
export const OUTCOME_LABEL: Record<AttemptOutcome, string> = {
  passed: 'Passed',
  not_passed: 'Not passed',
  needs_review: 'Needs review',
  timed_out: 'Timed out',
  in_progress: 'In progress',
};

export interface QuizAttemptRow {
  id: number;
  attempt_no: number;
  outcome: AttemptOutcome;
  assessment?: { id: number; title: string; course: string; min_percent: number };
  student?: { id: number; public_id: string; name: string; batch_id: number | null };
  started_at: string | null;
  expires_at: string | null;
  submitted_at: string | null;
  time_taken_sec: number | null;
  marks: number | null;
  total: number | null;
  result_percent: number | null;
  passed: boolean | null;
  needs_manual_grading: boolean;
  question_count: number;
}

export type AttemptCounts = { total: number } & Record<AttemptOutcome, number>;

export type QuestionKind = 'multiple_choice' | 'sorting' | 'matching' | 'puzzle' | 'short_answer' | 'long_answer';

/** One question as this student was served it, with their answer and the right one. */
export interface AttemptQuestion {
  id: number;
  position: number;
  type: QuestionKind;
  marks: number;
  text: string;
  image: string | null;
  options?: string[];
  answered: boolean;
  your_answer: unknown;
  marks_awarded: number;
  /** null while a mentor still has to mark it. */
  correct: boolean | null;
  correct_answer: unknown;
  /** A long answer nobody has marked yet. */
  needs_marking: boolean;
  /** A mentor or admin has marked it by hand. */
  marked: boolean;
  feedback: string | null;
  marked_by: string | null;
  explanation: string | null;
}

export interface QuizAttemptDetailResponse {
  attempt: QuizAttemptRow;
  questions: AttemptQuestion[];
}
