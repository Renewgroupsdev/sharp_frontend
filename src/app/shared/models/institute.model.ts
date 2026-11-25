import { Batch, Institute } from '../../core/data/models';

/** A batch plus the institutes taking part in it (empty = all institutes). */
export interface BatchRecord extends Batch {
  orgs?: string[];
  /** Courses mapped to the batch: every student in the batch is enrolled in them. */
  courses?: string[];
}

export type InstituteInput = Omit<Institute, 'id' | 'code'>;
// export type InstituteInput = Omit<Institute, 'code'>;

export interface BatchInput {
  n: string;
  start: string;
  end: string;
  seats: number;
  mentors: number;
  st: string;
  orgs: string[];
  courses: string[];
}
