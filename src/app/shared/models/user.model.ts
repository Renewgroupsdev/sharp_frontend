import { SharpUser } from '../../core/data/models';

export const USER_STATUSES = ['Active', 'Invited', 'Suspended'] as const;

/** Roles that carry a specialist / short description / biography. */
export const PROFILE_ROLES = ['Mentor', 'Member', 'OB', 'Institution'];

/** Roles tied to a college / institute (the rest belong to a free-text organization). */
export const INSTITUTE_ROLES = ['Student', 'Institution'];

/** Roles tied to a batch. */
export const BATCH_ROLES = ['Student', 'Mentor', 'Trainer'];

export const USER_CSV_COLS = ['role', 'college', 'batch', 'full_name', 'username', 'temp_password', 'mobile', 'email', 'specialist', 'short_description', 'biography', 'status'];

/** Values collected by the add / edit user form. `ph` is the 10 digits without +91. */
export interface UserInput {
  r: string;
  org: string;
  org2: string;
  b: string;
  n: string;
  username: string;
  pw: string;
  ph: string;
  email: string;
  spec: string;
  sd: string;
  bio: string;
  st: string;
  pic: string | null;
}

export interface UserImportRow {
  line: number;
  errs: string[];
  role: string;
  org: string;
  b: string;
  n: string;
  username: string;
  ph: string;
  email: string;
  spec: string;
  sd: string;
  bio: string;
  st: string;
}

export type UserRecord = SharpUser;
