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
const NESTED_MODULES = new Set(['a_assess', 'a_attempts', 'a_dmchat']);

/** Modules switched off from every role's menu (Enrollment, Learning). */
const HIDDEN_MODULES = new Set(['a_enroll', 'a_learn']);

/** Sub-menus per admin module key. */
const ADMIN_SUBMENUS: Record<string, NavLink[]> = {
  a_courses: [
    { path: '/app/courses', label: 'Courses', icon: 'bi-journal-bookmark', moduleKey: 'a_courses' },
    { path: '/app/courses/assignments', label: 'Assignments', icon: 'bi-file-earmark-text', moduleKey: 'a_assess' },
    { path: '/app/courses/assessments', label: 'Assessments', icon: 'bi-patch-check', moduleKey: 'a_assess' },
    { path: '/app/courses/quiz', label: 'Quiz', icon: 'bi-patch-question', moduleKey: 'a_assess' },
    { path: '/app/submissions', label: 'Submissions', icon: 'bi-inbox', moduleKey: 'a_assess' },
    { path: '/app/unlock-module', label: 'Unlock Module', icon: 'bi-unlock', moduleKey: 'a_learn' },
  ],
};

export const STUDENT_NAV: NavLink[] = [
  { path: '/app/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' },
  { path: '/app/learning', label: 'My Learning', icon: 'bi-journal-richtext', moduleKey: 'a_learn' },
  { path: '/app/attendance', label: 'Attendance', icon: 'bi-clock-history', moduleKey: 'a_attend' },
  { path: '/app/assessments', label: 'Assessments', icon: 'bi-patch-check', moduleKey: 'a_assess' },
  { path: '/app/certificates', label: 'Certificates', icon: 'bi-award', moduleKey: 'a_certs' },
  { path: '/app/community', label: 'SHARP Community', icon: 'bi-chat-dots', moduleKey: 'a_comms' },
  { path: '/app/profile', label: 'My Profile & More', icon: 'bi-person-circle' },
];

/** Menu for every role except Student: Dashboard, then every module the role may View on Roles & Permissions; Settings for the two admin roles. */
export function adminNav(role: Role | null, can: (moduleKey: string) => boolean): NavLink[] {
  const links: NavLink[] = [{ path: '/app/dashboard', label: 'Dashboard', icon: 'bi-grid-fill' }];
  // Assessment Library is no longer a top-level module: its pages sit under Course Management.
  for (const m of ADMIN_MODULES) {
    if (!can(m.key) || NESTED_MODULES.has(m.key) || HIDDEN_MODULES.has(m.key)) continue;
    const children = ADMIN_SUBMENUS[m.key]?.filter(c => !c.moduleKey || can(c.moduleKey));
    links.push({ path: '/app/' + m.route, label: m.label, icon: m.icon, moduleKey: m.key, children });
  }
  if (role === 'Super Admin' || role === 'Admin') links.push({ path: '/app/settings', label: 'Settings', icon: 'bi-gear' });
  return links;
}

/** The role-aware menu for a shell: used by the sidebar and by the header's breadcrumb / quick search. */
export function navForShell(shell: 'admin' | 'mentor' | 'student', role: Role | null, can: (moduleKey: string) => boolean): NavLink[] {
  if (shell === 'student') return STUDENT_NAV.filter(l => !l.moduleKey || can(l.moduleKey));
  return adminNav(role, can);
}
