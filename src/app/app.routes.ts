import { Route, Routes } from '@angular/router';
import { authGuard, forShell, loginRedirectGuard, moduleRoute } from './core/auth/auth.guard';

/**
 * Role pages share one flat URL space (no role in the path): forShell() scopes each set to a role, so a path used by
 * several roles (dashboard, attendance, ...) resolves to the signed-in role's own page. Anything the role doesn't have
 * falls to the wildcard and lands on its dashboard.
 *
 * Admin modules go through moduleRoute(): View permission on the module, plus optional guarded create / edit / delete
 * routes, e.g. moduleRoute('a_users', { path: 'users', ... }, { create: { path: 'users/new', ... } }).
 */

const assessmentsPage = () => import('./pages/assessments/assessments').then(m => m.Assessments);

const adminRoutes: Route[] = [
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard').then(m => m.Dashboard) },
  ...moduleRoute('a_users', { path: 'users', loadComponent: () => import('./pages/users/users').then(m => m.Users) }),
  ...moduleRoute('a_orgs', { path: 'institutes', loadComponent: () => import('./pages/institutes/institutes').then(m => m.Institutes) }),
  ...moduleRoute('a_courses', { path: 'courses', loadComponent: () => import('./pages/courses/courses').then(m => m.Courses) }),
  ...moduleRoute('a_enroll', { path: 'enrollment', loadComponent: () => import('./pages/enrollment/enrollment').then(m => m.Enrollment) }),
  ...moduleRoute('a_enroll', { path: 'enrollment/:id', loadComponent: () => import('./pages/enrollment/enrollment-detail/enrollment-detail').then(m => m.EnrollmentDetailPage) }),
  ...moduleRoute('a_attend', { path: 'attendance', loadComponent: () => import('./pages/attendance/attendance').then(m => m.Attendance) }),
  ...moduleRoute('a_learn', { path: 'learning', loadComponent: () => import('./pages/learning/learning').then(m => m.Learning) }),
  ...moduleRoute('a_assess', { path: 'courses/assignments', loadComponent: assessmentsPage, data: { kind: 'Assignment' } }),
  ...moduleRoute('a_assess', { path: 'courses/assessments', loadComponent: assessmentsPage, data: { kind: 'Assessment' } }),
  ...moduleRoute('a_assess', { path: 'courses/quiz', loadComponent: assessmentsPage, data: { kind: 'Quiz' } }),
  ...moduleRoute('a_assess', { path: 'submissions', loadComponent: () => import('./pages/submissions-hub/submissions-hub').then(m => m.SubmissionsHub) }),
  ...moduleRoute('a_certs', { path: 'certificates', loadComponent: () => import('./pages/certificates/certificates').then(m => m.Certificates) }),
  ...moduleRoute('a_comms', { path: 'community', loadComponent: () => import('./pages/community/community').then(m => m.Community) }),
  ...moduleRoute('a_attempts', { path: 'quiz-attempts', loadComponent: () => import('./pages/assessments/quiz-attempts/quiz-attempts').then(m => m.QuizAttempts) }),
  ...moduleRoute('a_learn', { path: 'unlock-module', loadComponent: () => import('./pages/mentor/unlock-module/unlock-module').then(m => m.UnlockModule) }),
  ...moduleRoute('a_certs', { path: 'certificate-review', loadComponent: () => import('./pages/mentor/certificate-review/certificate-review').then(m => m.CertificateReview) }),
  ...moduleRoute('a_notif', { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications) }),
  ...moduleRoute('a_roles', { path: 'roles-permissions', loadComponent: () => import('./pages/roles-permissions/roles-permissions').then(m => m.RolesPermissions) }),
  ...moduleRoute('a_logs', { path: 'logs', loadComponent: () => import('./pages/logs/logs').then(m => m.Logs) }),
  ...moduleRoute('a_reports', { path: 'reports', loadComponent: () => import('./pages/reports/reports').then(m => m.Reports) }),
  { path: 'settings', loadComponent: () => import('./pages/settings/settings').then(m => m.Settings) },
];

const mentorRoutes: Route[] = [
  { path: 'dashboard', loadComponent: () => import('./pages/mentor/dashboard/mentor-dashboard').then(m => m.MentorDashboard) },
  ...moduleRoute('a_users', { path: 'users', loadComponent: () => import('./pages/users/users').then(m => m.Users) }),
  ...moduleRoute('a_courses', { path: 'courses', loadComponent: () => import('./pages/courses/courses').then(m => m.Courses) }),
  ...moduleRoute('a_assess', { path: 'courses/assignments', loadComponent: assessmentsPage, data: { kind: 'Assignment' } }),
  ...moduleRoute('a_assess', { path: 'courses/assessments', loadComponent: assessmentsPage, data: { kind: 'Assessment' } }),
  ...moduleRoute('a_assess', { path: 'courses/quiz', loadComponent: assessmentsPage, data: { kind: 'Quiz' } }),
  ...moduleRoute('a_attend', { path: 'attendance', loadComponent: () => import('./pages/attendance/attendance').then(m => m.Attendance) }),
  ...moduleRoute('a_certs', { path: 'certificates', loadComponent: () => import('./pages/certificates/certificates').then(m => m.Certificates) }),
  ...moduleRoute('a_notif', { path: 'notifications', loadComponent: () => import('./pages/notifications/notifications').then(m => m.Notifications) }),
  ...moduleRoute('a_orgs', { path: 'institutes', loadComponent: () => import('./pages/institutes/institutes').then(m => m.Institutes) }),
  ...moduleRoute('a_enroll', { path: 'enrollment', loadComponent: () => import('./pages/enrollment/enrollment').then(m => m.Enrollment) }),
  ...moduleRoute('a_enroll', { path: 'enrollment/:id', loadComponent: () => import('./pages/enrollment/enrollment-detail/enrollment-detail').then(m => m.EnrollmentDetailPage) }),
  ...moduleRoute('a_learn', { path: 'learning', loadComponent: () => import('./pages/learning/learning').then(m => m.Learning) }),
  ...moduleRoute('a_roles', { path: 'roles-permissions', loadComponent: () => import('./pages/roles-permissions/roles-permissions').then(m => m.RolesPermissions) }),
  ...moduleRoute('a_logs', { path: 'logs', loadComponent: () => import('./pages/logs/logs').then(m => m.Logs) }),
  ...moduleRoute('a_reports', { path: 'reports', loadComponent: () => import('./pages/reports/reports').then(m => m.Reports) }),
  { path: 'group-progress', loadComponent: () => import('./pages/mentor/group-progress/group-progress').then(m => m.GroupProgress) },
  { path: 'manual-attendance', loadComponent: () => import('./pages/mentor/manual-attendance/manual-attendance').then(m => m.ManualAttendance) },
  { path: 'unlock-module', loadComponent: () => import('./pages/mentor/unlock-module/unlock-module').then(m => m.UnlockModule) },
  { path: 'certificate-review', loadComponent: () => import('./pages/mentor/certificate-review/certificate-review').then(m => m.CertificateReview) },
  { path: 'submissions', loadComponent: () => import('./pages/submissions-hub/submissions-hub').then(m => m.SubmissionsHub) },
  ...moduleRoute('a_attempts', { path: 'quiz-attempts', loadComponent: () => import('./pages/assessments/quiz-attempts/quiz-attempts').then(m => m.QuizAttempts) }),
  { path: 'community', loadComponent: () => import('./pages/chats/chats').then(m => m.Chats) },
  { path: 'more', loadComponent: () => import('./pages/mentor/mentor-more/mentor-more').then(m => m.MentorMore) },
];

const studentRoutes: Route[] = [
  { path: 'dashboard', loadComponent: () => import('./pages/student/student-dashboard/student-dashboard').then(m => m.StudentDashboard) },
  ...moduleRoute('a_learn', { path: 'learning', loadComponent: () => import('./pages/student/my-learning/my-learning').then(m => m.MyLearning) }),
  ...moduleRoute('a_learn', { path: 'learning/:id', loadComponent: () => import('./pages/student/course-player/course-player').then(m => m.CoursePlayer) }),
  ...moduleRoute('a_attend', { path: 'attendance', loadComponent: () => import('./pages/student/student-attendance/student-attendance').then(m => m.StudentAttendance) }),
  ...moduleRoute('a_assess', { path: 'assessments', loadComponent: () => import('./pages/student/student-assessments/student-assessments').then(m => m.StudentAssessments) }),
  { path: 'assessments/:id/assignment', loadComponent: () => import('./pages/student/student-assessments/assignment-detail/assignment-detail').then(m => m.AssignmentDetailPage) },
  { path: 'assessments/:id/attempt', loadComponent: () => import('./pages/student/student-assessments/quiz-attempt/quiz-attempt').then(m => m.QuizAttempt) },
  { path: 'assessments/:id/review', loadComponent: () => import('./pages/student/student-assessments/quiz-review/quiz-review').then(m => m.QuizReviewPage) },
  ...moduleRoute('a_certs', { path: 'certificates', loadComponent: () => import('./pages/student/student-certificates/student-certificates').then(m => m.StudentCertificates) }),
  ...moduleRoute('a_comms', { path: 'community', loadComponent: () => import('./pages/chats/chats').then(m => m.Chats) }),
  { path: 'profile', loadComponent: () => import('./pages/student/student-profile/student-profile').then(m => m.StudentProfile) },
];

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'login' },
  // Public: the page a certificate's QR code opens. No sign-in.
  { path: 'certificate/:token', loadComponent: () => import('./pages/certificate-scan/certificate-scan').then(m => m.CertificateScan) },
  { path: 'verify/:number', loadComponent: () => import('./pages/certificate-verify/certificate-verify').then(m => m.CertificateVerify) },
  {
    path: 'login',
    canActivate: [loginRedirectGuard],
    loadComponent: () => import('./login-page/login-page').then(m => m.LoginPage),
  },
  {
    path: 'app',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/layout').then(m => m.Layout),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      ...forShell('admin', adminRoutes),
      ...forShell('mentor', mentorRoutes),
      ...forShell('student', studentRoutes),
      { path: '**', redirectTo: 'dashboard' },
    ],
  },
  { path: '**', redirectTo: 'login' },
];
