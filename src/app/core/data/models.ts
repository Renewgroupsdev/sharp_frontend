/** Shared SHARP entities used by more than one module. */

export const ROLES = ['Super Admin', 'Admin', 'Mentor', 'Member', 'OB', 'Institution', 'Student'] as const;
export type Role = (typeof ROLES)[number];

/** Roles that sit in the web admin workspace (the LMS modules); Mentor and Student have their own screens. */
export const ADMIN_SHELL_ROLES: Role[] = ['Super Admin', 'Admin', 'Member', 'OB', 'Institution'];

export const ROLE_PREFIX: Record<string, string> = { 'Super Admin': 'SA', Admin: 'AD', Mentor: 'MN', Member: 'MB', OB: 'OB', Institution: 'IN', Student: 'ST', Trainer: 'TR' };

export const ROLE_ACCESS: Record<Role, string> = {
  'Super Admin': 'Can have access to all modules.',
  Admin: 'Similar to Super Admin.',
  Mentor: 'Can view assigned students — details, attendance, learning, progress — and communicate with those students.',
  Member: 'Can view courses, students and institutes.',
  OB: 'Can view their assigned courses, batch details, attendance, learning details and assignments.',
  Institution: 'Can view the students enrolled from their institute, with attendance, learning progress and certificates.',
  Student: 'Can view their assigned courses, batch details, attendance, learning details, assessments, mentor, institute and certificates; can communicate with their mentor.',
};

export interface SharpUser {
  id: string;
  n: string;
  r: string;
  /** Institute / company the person belongs to. */
  org: string;
  /** Batch name, or "All batches". */
  b: string;
  st: 'Active' | 'Suspended' | 'Invited' | string;
  ph: string;
  email?: string;
  username?: string;
  i: string;
  col: string;
  last: string;
  spec?: string;
  sd?: string;
  bio?: string;
  pic?: string;
  tempPw?: boolean;
  /** Backend ids, kept so an edit can send them back unchanged. */
  collegeId?: number;
  batchId?: number;
}

export interface Institute {
  id: string;
  n: string;
  code: string;
  city: string;
  /** Principal / point of contact. */
  pr: string;
  email: string;
  ph: string;
  st: 'Active' | 'Inactive';
  lat?: number | null;
  lng?: number | null;
  geofenceRadiusM?: number;
}

export interface Batch {
  id: string;
  n: string;
  start: string;
  end: string;
  seats: number;
  filled: number;
  mentors: number;
  st: 'running' | 'closed' | 'enrolling' | string;
}

/** Permission letters per module key: v = view, c = create, u = edit, d = delete. */
export type PermissionMap = Record<string, Record<string, string>>;

export interface ActivityLog {
  id: string;
  w: string;
  a: string;
  m: string;
  t: string;
}

/** Admin-workspace module keys (the LMS-SHARP modules). `route` is the path under /app. */
export const ADMIN_MODULES: { key: string; label: string; icon: string; route: string }[] = [
  { key: 'a_users', label: 'User Management', icon: 'bi-person-gear', route: 'users' },
  { key: 'a_orgs', label: 'Institute Management', icon: 'bi-bank', route: 'institutes' },
  { key: 'a_courses', label: 'Course Management', icon: 'bi-journal-bookmark', route: 'courses' },
  { key: 'a_enroll', label: 'Enrollment', icon: 'bi-person-plus', route: 'enrollment' },
  { key: 'a_attend', label: 'Attendance Management', icon: 'bi-clock-history', route: 'attendance' },
  { key: 'a_learn', label: 'Learning Management', icon: 'bi-play-circle', route: 'learning' },
  { key: 'a_assess', label: 'Assessment Library', icon: 'bi-patch-check', route: 'assessments' },
  // Read-only view of every quiz attempt (student, outcome, questions served). Not a menu entry of its own: it is a tab under Course Management → Quiz, and a page for mentors.
  { key: 'a_attempts', label: 'Quiz Attempts', icon: 'bi-clipboard-data', route: 'courses/quiz' },
  { key: 'a_certs', label: 'Certificate Management', icon: 'bi-award', route: 'certificates' },
  { key: 'a_comms', label: 'SHARP Community', icon: 'bi-chat-dots', route: 'community' },
  { key: 'a_notif', label: 'Notification Management', icon: 'bi-bell', route: 'notifications' },
  { key: 'a_roles', label: 'Roles & Permissions', icon: 'bi-shield-lock', route: 'roles-permissions' },
  { key: 'a_logs', label: 'Logs Management', icon: 'bi-list-check', route: 'logs' },
  { key: 'a_reports', label: 'Reports', icon: 'bi-bar-chart', route: 'reports' },
];
