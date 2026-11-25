/** GET /api/web/submission-stats: counts scoped to the caller (a student's own, a mentor's batch, or everyone for staff). */
export interface WrittenCounts {
  total: number;
  submitted: number;
  under_review: number;
  graded: number;
  returned: number;
}

export interface SubmissionStats {
  scope: 'own' | 'batch' | 'all';
  /** Submitted attempts: `passed`, `not_passed` and `needs_review` (long answers a mentor still marks) add up to `total`. */
  quiz: { total: number; needs_review: number; passed?: number; not_passed?: number };
  assignment: WrittenCounts;
  /** Submitted attempts, like `quiz`. */
  assessment: { total: number; needs_review?: number; passed?: number; not_passed?: number };
}
