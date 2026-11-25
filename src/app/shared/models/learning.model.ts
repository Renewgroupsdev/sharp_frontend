export type LearningStatus = 'Completed' | 'In progress' | 'Not started';

/** One student's progress in one course they are enrolled in through their batch. */
export interface LearningRecord {
  /** `<student id>|<course id>`: a student has one record per course. */
  id: string;
  sid: string;
  name: string;
  org: string;
  course: string;
  courseId: number;
  /** Overall progress, 0-100. */
  progress: number;
  /** Materials completed. */
  mats: number;
  /** Last accessed, ISO date, or '' when never. */
  last: string;
  status: LearningStatus;
}

/** The editable fields the learning form submits. */
export type LearningInput = Pick<LearningRecord, 'sid' | 'courseId' | 'progress' | 'mats' | 'last'>;

export interface ModuleProgress {
  name: string;
  done: number;
  total: number;
  pct: number;
  status: LearningStatus;
}

/** Progress filter buckets. */
export const PROGRESS_BUCKETS: { min: number; max: number; label: string }[] = [
  { min: 0, max: 0, label: 'Not started (0%)' },
  { min: 1, max: 49, label: '1 – 49%' },
  { min: 50, max: 99, label: '50 – 99%' },
  { min: 100, max: 100, label: 'Completed (100%)' },
];

export const bucketOf = (progress: number): string => PROGRESS_BUCKETS.find(b => progress >= b.min && progress <= b.max)?.label ?? '';
