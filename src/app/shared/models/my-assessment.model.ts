/** A student's view of quizzes, assignments and assessments (GET /api/web/my/assessments); field names follow the API. */

import { AttachmentInfo } from './assessment.model';

export type AssessmentKind = 'quiz' | 'assignment' | 'assessment';

export type QuestionKind = 'multiple_choice' | 'sorting' | 'matching' | 'puzzle' | 'short_answer' | 'long_answer';

export interface MyAssessment {
  id: number;
  type: AssessmentKind;
  title: string;
  course: string;
  module: string | null;
  topic: string | null;
  description: string | null;
  due_date: string | null;
  attachment: AttachmentInfo | null;
  max_marks: number;
  /** Pass mark, %. */
  min_percent: number;
  /** Quizzes only; null for assignments and assessments. */
  questions_count: number | null;
  /** Total time for the quiz in seconds, or null when it is untimed. */
  time_limit_sec: number | null;
  /** Quizzes only: null means unlimited attempts. */
  attempts_allowed: number | null;
  attempts_used: number | null;
  best_percent: number | null;
  passed: boolean | null;
  in_progress_attempt_id: number | null;
  same_page: boolean;
  /** Set when the quiz sits in a module that is still locked: the reason. */
  locked_reason?: string | null;
  latest_submission?: { id: number; submission_no: number; status: SubmissionStatus; marks_obtained: number | string | null; submitted_at: string } | null;
}

export type SubmissionStatus = 'submitted' | 'under_review' | 'graded' | 'returned';

export interface SubmissionAttachment {
  id: number;
  name: string;
  mime_type: string | null;
  size: number;
  download_url: string;
}

export interface AssessmentSubmission {
  id: number;
  assessment_id: number;
  assessment?: { id: number; type: AssessmentKind; title: string; course: string; due_date: string | null; max_marks: number };
  submission_no: number;
  content: string | null;
  status: SubmissionStatus;
  marks_obtained: number | string | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
  student?: { id: number; public_id: string; name: string; batch_id: number | null };
  grader?: { id: number; name: string } | null;
  attachments: SubmissionAttachment[];
}

export interface AttemptSummary {
  id: number;
  attempt_no: number;
  result_percent: number;
  passed: boolean;
  time_taken_sec: number;
  submitted_at: string;
}

export interface MyAssessmentDetail {
  assessment: MyAssessment;
  attempts: AttemptSummary[];
  in_progress: { id: number; expires_at: string | null } | null;
}

/** A question as served to the learner: never carries the answer. */
export interface ServedQuestion {
  id: number;
  type: QuestionKind;
  marks: number;
  text: string;
  image: string | null;
  options?: string[];
  /** Multiple choice with more than one right answer: use checkboxes. */
  multiple?: boolean;
  /** Sorting: the items in a shuffled order. */
  items?: string[];
  /** Matching: the left column, and the right column shuffled. */
  left?: string[];
  right?: string[];
  scrambled?: string;
  hint?: string | null;
  word_limit?: number | null;
}

export interface StartedAttempt {
  attempt: { id: number; attempt_no: number; started_at: string; expires_at: string | null };
  questions: ServedQuestion[];
}

/** What the student answered: choice indexes, an ordered list, matched pairs, or text. */
export type AnswerValue = number[] | string[] | string[][] | string | null;

export interface SubmittedAnswer {
  question_id: number;
  answer: AnswerValue;
}

export interface QuizOutcome {
  attempt_id: number;
  attempt_no: number;
  submitted: boolean;
  /** False when the quiz hides the score: only `submitted` and the flags below are sent. */
  show_score: boolean;
  needs_manual_grading: boolean;
  /** null when attempts are unlimited. */
  attempts_left: number | null;
  review_allowed: boolean;
  marks?: number;
  total?: number;
  result_percent?: number;
  passed?: boolean;
  min_percent?: number;
  time_taken_sec?: number;
  correct_count?: number;
  question_count?: number;
}

export interface ReviewQuestion {
  id: number;
  type: QuestionKind;
  marks: number;
  text: string;
  image: string | null;
  options?: string[];
  your_answer: AnswerValue;
  marks_awarded: number;
  /** null = waiting for a mentor to mark it. */
  correct: boolean | null;
  /** Present only when the quiz setup shows the answer sheet. */
  correct_answer?: unknown;
  explanation?: string;
}

export interface QuizReview {
  attempt: QuizOutcome & { id: number };
  questions: ReviewQuestion[];
}
