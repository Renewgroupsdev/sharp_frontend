export type EnrollmentStatus = 'Upcoming' | 'Ongoing' | 'Completed';

export const ENROLLMENT_STATUSES: EnrollmentStatus[] = ['Upcoming', 'Ongoing', 'Completed'];

/**
 * A course run for a batch. Every student of the batch is enrolled and the batch's mentors teach it, so the counts are
 * the batch's students and mentors.
 */
export interface BatchEnrollment {
  /** Server id of the course-to-batch mapping. */
  id: string;
  courseId: number;
  /** Display code, e.g. CRS-007. */
  code: string;
  course: string;
  batchId: number;
  batch: string;
  /** Display dates, e.g. "14 Jun 2026"; '' when the batch has none. */
  start: string;
  end: string;
  startIso: string;
  endIso: string;
  students: number;
  mentors: number;
  status: EnrollmentStatus;
}

/** Which list a count opens in the members dialog. */
export type MemberKind = 'students' | 'mentors';

export type CertificateState = 'Pending' | 'Issued' | 'Rejected' | 'Cancelled';

/** One student's row on the enrollment detail page. */
export interface EnrollmentStudent {
  id: string;
  name: string;
  org: string;
  status: string;
  /** Course progress, 0-100. */
  progress: number;
  lessonsDone: number;
  /** Last time the student opened the course (ISO date), or ''. */
  lastAccessed: string;
  /** Overall attendance %, or null when nothing is recorded. */
  attendance: number | null;
  /** Average % over the course's quizzes, or null when none were taken. */
  quiz: number | null;
  certificate: { id: number; status: CertificateState; number: string | null } | null;
}

export interface EnrollmentSummary {
  students: number;
  completed: number;
  avgProgress: number;
  avgAttendance: number | null;
  avgQuiz: number | null;
  certificatesIssued: number;
  certificatesPending: number;
}

/** A course being added to / removed from a batch. */
export interface EnrollmentEvent {
  id: number;
  courseId: number;
  course: string;
  batchId: number;
  batch: string;
  event: 'Enrolled' | 'Removed';
  /** manual, bulk, copy, import, course form or batch form. */
  source: string;
  actor: string;
  /** Display date and time. */
  at: string;
}

export interface EnrollmentMember {
  id: string;
  name: string;
  org: string;
  mobile: string;
  email: string;
  status: string;
  specialist: string;
}

export interface EnrollmentDetail {
  enrollment: BatchEnrollment;
  lessonsTotal: number;
  summary: EnrollmentSummary;
  students: EnrollmentStudent[];
  mentors: EnrollmentMember[];
  history: EnrollmentEvent[];
}

export interface ImportRowResult {
  line: number;
  course: string;
  batch: string;
  status: 'ok' | 'exists' | 'error';
  message: string;
}

export interface ImportResult {
  dryRun: boolean;
  summary: { ok: number; exists: number; error: number };
  rows: ImportRowResult[];
}
