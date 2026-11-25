import { ADMIN_MODULES, Role } from '../data/models';

export interface NavLink {
  path: string;
  label: string;
  icon: string;
  /** Admin module key; the link only shows when the role holds View on it. */
  moduleKey?: string;
  /** Sub-menu shown under the link while it (or one of its children) is the active route. */
  children?: NavLink[];
}

/** Modules that are reached through another menu entry (Course Management → ...), so they get no top-level link. */
const NESTED_MODULES = new Set(['a_assess', 'a_attempts']);

/** Sub-menus per admin module key. */
const ADMIN_SUBMENUS: Record<string, NavLink[]> = {
  a_courses: [
    { path: '/app/courses', label: 'Courses', icon: 'bi-journal-bookmark', moduleKey: 'a_courses' },
    { path: '/app/courses/assignments', label: 'Assignments', icon: 'bi-file-earmark-text', moduleKey: 'a_assess' },
    { path: '/app/courses/assessments', label: 'Assessments', icon: 'bi-patch-check', moduleKey: 'a_assess' },
    { path: '/app/courses/quiz', label: 'Quiz', icon: 'bi-patch-question', moduleKey: 'a_assess' },
    { path: '/app/submissions', label: 'Assignment Submissions', icon: 'bi-inbox', moduleKey: 'a_assess' },
  ],
};

export const MENTOR_NAV: NavLink[] = [
  { path: '/app/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' },
  { path: '/app/group-progress', label: 'Group Progress', icon: 'bi-bar-chart-line' },
  { path: '/app/manual-attendance', label: 'Manual Attendance', icon: 'bi-clock-history' },
  { path: '/app/unlock-module', label: 'Unlock Module', icon: 'bi-unlock' },
  { path: '/app/certificate-review', label: 'Certificate Review', icon: 'bi-award' },
  { path: '/app/submissions', label: 'Assignment Submissions', icon: 'bi-inbox' },
  { path: '/app/quiz-attempts', label: 'Quiz Attempts', icon: 'bi-clipboard-data' },
  { path: '/app/community', label: 'SHARP Community', icon: 'bi-chat-dots' },
  { path: '/app/more', label: 'More', icon: 'bi-three-dots' },
];

export const STUDENT_NAV: NavLink[] = [
  { path: '/app/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' },
  { path: '/app/learning', label: 'My Learning', icon: 'bi-journal-richtext' },
  { path: '/app/attendance', label: 'Attendance', icon: 'bi-clock-history' },
  { path: '/app/assessments', label: 'Assessments', icon: 'bi-patch-check' },
  { path: '/app/certificates', label: 'Certificates', icon: 'bi-award' },
  { path: '/app/community', label: 'SHARP Community', icon: 'bi-chat-dots' },
  { path: '/app/profile', label: 'My Profile & More', icon: 'bi-person-circle' },
];

/** Admin workspace: Dashboard, then every module the role may view; Settings for the two admin roles. */
export function adminNav(role: Role | null, can: (moduleKey: string) => boolean): NavLink[] {
  const links: NavLink[] = [{ path: '/app/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' }];
  // Assessment Library is no longer a top-level module: its pages sit under Course Management.
  for (const m of ADMIN_MODULES) {
    if (!can(m.key) || NESTED_MODULES.has(m.key)) continue;
    const children = ADMIN_SUBMENUS[m.key]?.filter(c => !c.moduleKey || can(c.moduleKey));
    links.push({ path: '/app/' + m.route, label: m.label, icon: m.icon, moduleKey: m.key, children });
  }
  if (role === 'Super Admin' || role === 'Admin') links.push({ path: '/app/settings', label: 'Settings', icon: 'bi-gear' });
  return links;
}
