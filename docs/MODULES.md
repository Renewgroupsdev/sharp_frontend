# Module-wise development details

For each module: what it does, the front-end files, the API it uses, current state, and the work left. Paths are under `src/app/` unless noted. Backend names refer to `D:\laragon\www\sharp-api` (`app/Http/Controllers/Api/Web`, `app/Services`, `app/Models`).

State labels follow [MIGRATION-STATUS.md](MIGRATION-STATUS.md): **API-backed** (service injects an API client, a local cache may remain), **Local only** (no API client), **Placeholder** (route shows Coming Soon). Status was read from code, not tested in a browser.

## Summary

| # | Module | Workspace | Status |
|---|---|---|---|
| 1 | Auth and layout | all | API-backed (uses `fetch`, not `HttpClient`) |
| 2 | Dashboard | admin | Local derived |
| 3 | User Management | admin | API-backed |
| 4 | Institute Management (institutes and batches) | admin | API-backed |
| 5 | Course Management | admin | API-backed |
| 6 | Enrollment | admin | API-backed |
| 7 | Attendance Management | admin | API-backed |
| 8 | Learning Management | admin | API-backed |
| 9 | Assessment Library and Submissions | admin | API-backed |
| 10 | Certificate Management | admin, mentor, student | API-backed |
| 11 | SHARP Community | admin, mentor, student | API-backed |
| 12 | Notification Management | admin | Local only (inbox is API-backed) |
| 13 | Roles and Permissions | admin | Local only |
| 14 | Logs Management | admin | Local only |
| 15 | Reports | admin | Local derived |
| 16 | Settings | admin | Local |
| 17 | Mentor workspace | mentor | Mixed |
| 18 | Student workspace | student | Mixed |

---

## 1. Auth and layout

- **Purpose:** sign in, hold the session, pick the workspace by role, render the shell and navigation.
- **Front end:** `login-page/`, `layout/`, `left-side-navbar/`, `core/auth/auth.service.ts`, `core/auth/auth.guard.ts` (`authGuard`, `loginRedirectGuard`, `forShell`, `moduleRoute`), `core/http/api.interceptor.ts`, `core/nav/nav-config.ts`, `services/nav-layout.service.ts`, `shared/components/notification-bell/`.
- **API:** `POST auth/login`, `POST auth/logout`, `POST auth/change-password`, `GET me`, `GET enums`, `GET enums/{enum}`. Backend: `AuthController`, `AuthService`, `EnumController`.
- **Done:** token session, bearer interceptor, 401 sign-out, forced password change flag, role to workspace mapping, per-role navigation.
- **To do:**
  - Move login from `fetch` to `HttpClient`.
  - Decide on token storage (localStorage today).
  - `AuthService.actor()` still falls back to seeded users from `UsersService`. Replace it with the `/me` response.
  - Fix the production `apiBaseUrl`.

## 2. Dashboard

- **Purpose:** admin summary of users, attendance, courses, enrollments, certificates, community.
- **Front end:** `pages/dashboard/`.
- **API available:** `GET dashboard` (staff only, `DashboardController`, `DashboardService`). Not used by the page.
- **Current:** the page injects `UsersService`, `InstitutesService`, `BatchesService`, `AttendanceRequestsService`, `CertificatesService`, `CommunityService`. Figures come from local state.
- **Activity charts (Super Admin, Admin, OB):** `shared/components/activity-charts/` shows everything people did, from the audit log: actions per day stacked by kind (columns with hover details), the share of each kind (donut), the most active people, the latest actions, a 7 / 14 / 30 / 90 day range and a table view. API: `GET dashboard/activity?days=` (`ActivityReportController`, `ActivityReportService`, which sorts each audit entry into Notifications, Community, Certificates, Assessments, Attendance, Learning, Users & access or Other by its wording). Colours follow the kind in a fixed order (the validated categorical palette, with a dark-theme set).
- **Dashboards by role (2026-11-14, from `SHARP-Dashboards-by-Role.pdf`):** one endpoint, `GET my/dashboard` (`RoleDashboardController`, `RoleDashboardService`), returns the signed-in person's figures and blocks (pie, bars, progress, list), scoped to their role: Super Admin (programme plus accounts, audit actions, community health), Admin (operations), OB (programme results), Member (students taught by its organisation's mentors, matched on the organisation name), Institution (its own college's students), Mentor (own batch), Student (own record). The web side is one component, `shared/components/role-dashboard`, plus the reusable `pie-chart`; a new figure needs only a new block in the service. Super Admin and Admin keep the full dashboard page with these blocks added; OB, Member and Institution see only their own; the Mentor and Student dashboards show them at the top.
- **To do:** read `GET dashboard`; extend `DashboardService` for any figure the page needs that the API lacks (certificates issued, pending attendance requests, submissions waiting).

## 3. User Management (`a_users`)

- **Purpose:** accounts for students, mentors, trainers, admins, members, OBs and institutions: create, edit, suspend, activate, reset password, bulk upload.
- **Front end:** `pages/users/` (`users`, `user-form/`, `user-view/`, `bulk-upload/`); `shared/common-services/users.service.ts`, `users-api.service.ts`, `user-actions.service.ts`; `shared/models/user.model.ts`; `shared/utils/csv.util.ts`.
- **API:** `GET/POST users`, `GET/PUT/DELETE users/{public_id}`, `POST users/{public_id}/suspend|activate|reset-password`. Backend: `UserController`, `UserService`, `UserPolicy`, `PublicIdGenerator`, `User` model.
- **Done:** list, filter, create, edit, status actions, CSV upload, per-role ID formats.
- **To do:**
  - Confirm bulk upload posts to the API; no bulk endpoint is registered in `routes/api.php`. Add one or loop single creates.
  - Invite and resend-invite flows exist in the front end (`UsersService.resendInvite`); the API has no invite endpoint.
  - Replace `database-schema/user-management.md` (MySQL, `auth_tokens`, `user_invites`, `id_sequences`) with the PostgreSQL schema from the migrations.

## 4. Institute Management (`a_orgs`)

- **Purpose:** colleges and the programme batches that run in them.
- **Front end:** `pages/institutes/` (`institutes`, `institute-form/`, `institute-view/`, `batch-form/`, `batch-view/`); `institutes.service.ts`, `institute-api.service.ts`, `institute-actions.service.ts`, `batches.service.ts`, `batch-api.service.ts`; `shared/models/institute.model.ts`.
- **API:** `GET/POST/PUT/DELETE colleges`, `GET colleges/suggest-code`, `GET/POST/PUT/DELETE batches`. Backend: `CollegeController`, `CollegeService`, `BatchController`, `BatchService`, `College` and `Batch` models.
- **Done:** institute and batch CRUD, code suggestion.
- **To do:**
  - Batch figures such as seats filled and mentor count come from seed fields (`SEED_BATCHES`). Compute them in the API.
  - Remove `SEED_COLLEGES` and `SEED_BATCHES`.
  - Remove the stale `institutes` entry in `coming-soon.config.ts`.

## 5. Course Management (`a_courses`)

- **Purpose:** categories, courses, chapters and lessons, course modules, assigned assessments, invited students.
- **Front end:** `pages/courses/` (`courses`, `course-form/`, `category-form/`, `chapter-form/`, `lesson-form/`, `course-view/`, `course-modules/`, `course-assessments/`, `course-students/`); `courses.service.ts`, `courses-api.service.ts`; `shared/models/course.model.ts`; `shared/components/rich-text-editor/`.
- **API:** `GET/POST/PUT/DELETE course-categories`, `GET/POST/PUT/DELETE courses`, `PUT courses/{id}/chapters`, `POST courses/{id}/restore`, `DELETE courses/{id}/purge`. Backend: `CourseController`, `CourseCategoryController`, `CourseService`, `CourseCategoryService`, models `Course`, `CourseCategory`, `CourseChapter`, `CourseLesson`. Soft delete with restore and purge.
- **Done:** category and course CRUD, chapter and lesson editing in one save, soft delete.
- **To do:**
  - File and video upload for lessons: confirm the storage endpoint; none is registered.
  - Remove stale `courseAssignments`, `courseAssessments`, `courseQuizzes` entries in `coming-soon.config.ts`.
  - Add a spec for chapter reordering.

## 6. Enrollment (`a_enroll`)

- **Purpose:** put students into a course run for a batch, copy runs, import lists, track members and history, trigger certificates.
- **Front end:** `pages/enrollment/` (`enrollment`, `enrollment-form/`, `enrollment-detail/`, `enrollment-members/`, `enrollment-calendar/`, `enrollment-copy/`, `enrollment-import/`, `enrollment-timeline/`); `batch-enrollments.service.ts`, `batch-enrollments-api.service.ts`, `enrollment.service.ts`; `shared/models/batch-enrollment.model.ts`.
- **API:** `GET enrollments`, `enrollments/history`, `enrollments/{id}/members`, `enrollments/{id}/detail`; staff `POST enrollments`, `enrollments/bulk`, `enrollments/copy`, `enrollments/remove`, `enrollments/import`, `enrollments/{id}/certificates`, `DELETE enrollments/{id}`. Backend: `EnrollmentController`, `EnrollmentService`, `EnrollmentEvent` model. Mentors read only their own batch.
- **Done:** full list, detail, members, history timeline, bulk, copy, import, remove.
- **To do:**
  - `enrollment.service.ts` and `learner-state.service.ts` still read prototype data (`programme-data.ts`). Remove them once the student pages use `my-*` endpoints.
  - Add tests for the mentor batch restriction.

## 7. Attendance Management (`a_attend`)

- **Purpose:** students report Present or Absent for the day; staff and mentors approve or reject each report, and can also mark attendance on a student's behalf. Attendance is one row per student and day.
- **Front end:** `pages/attendance/` (the Attendance list with reports to mark, and Mark manual attendance); `attendance-api.service.ts`, `attendance.service.ts`, `attendance-requests-api.service.ts`, `attendance-requests.service.ts`, `my-attendance.service.ts`; `shared/models/attendance.model.ts`. Student side: `pages/student/student-attendance/`.
- **API:** `GET attendance`, `GET attendance/list`, `POST attendance`; `GET/POST attendance-requests`, `POST attendance-requests/{id}/mark`. Backend: `AttendanceController`, `AttendanceRequestController`, `AttendanceService`, `AttendanceRequestService`, models `Attendance`, `AttendanceRequest`.
- **Bulk mark:** in Mark manual attendance, tick students (or "Select everyone not marked"), choose Present or Absent, write one remark and apply. `POST attendance/bulk` (`BulkMarkAttendanceRequest`, `AttendanceService::markMany`): up to 500 students, one day (not in the future), all or nothing, a remark required for Manual or Absent. A mentor can only mark their own batch. Each student gets the "Attendance marked" notification; the audit log gets one entry for the batch.
- **Removed (2026-11-12):** scheduled class sessions (the Sessions tab, Bulk mark, the student Upcoming sessions lists, `/sessions` and `/my/sessions`). Migration `2026_11_18_000001_remove_class_sessions` drops the `class_sessions` table and `attendance.session_id`. It refuses to run if any attendance mark is still tied to a session. Location and geofence are also not used in the attendance flow.
- **To do:**
  - `certificates.service.ts` reads the attendance percentage from the API; check the figures against the attendance list.
  - Retire `attendance.service.ts` local request methods from the conversion guide once nothing uses them.

## 8. Learning Management (`a_learn`)

- **Purpose:** staff view and correct each student's course progress; progress report.
- **Front end:** `pages/learning/` (`learning`, `learning-form/`, `learning-report/`); `learning.service.ts`, `learning-api.service.ts`; `shared/models/learning.model.ts`.
- **API:** `GET learning`, `GET learning/report` (staff and mentors); `PUT learning`, `DELETE learning` (staff). Backend: `LearningController`, `LearningService`, `LessonProgressService`, models `LearningProgress`, `LessonProgress`.
- **Done:** list, edit, reset, report.
- **To do:** check that the report page uses `GET learning/report` and not local data; add a CSV export check.

## 9. Assessment Library and Assignment Submissions (`a_assess`)

- **Purpose:** question groups and question bank, quizzes, assignments and written assessments, quiz results report, student submissions graded by mentors and staff.
- **Front end:**
  - Admin: `pages/assessments/` (`assessments`, `assessment-list/`, `assessment-form/`, `question-bank/`, `question-form/`, `question-groups/`, `group-form/`, `quiz-setup/`, `quiz-report/`).
  - Mentor and staff submissions: `pages/mentor/submissions/`.
  - Student: `pages/student/student-assessments/` (`quiz-attempt/`, `quiz-review/`, `assignment-detail/`), `student-assessments`.
  - Services: `assessments.service.ts`, `assessments-api.service.ts`, `my-assessments.service.ts`; models `assessment.model.ts`, `assessment-api.model.ts`, `my-assessment.model.ts`.
- **API:**
  - Staff: `question-groups`, `questions`, `assessments` (CRUD, `PUT assessments/{id}/setup`, `PUT assessments/rename-course`), `quiz-results`.
  - Submissions: `GET submissions`, `GET submissions/{id}`, `POST submissions/{id}/review`, `POST submissions/{id}/grade`, `GET submission-attachments/{id}/download`.
  - Student: `GET my/assessments`, `GET my/assessments/{id}`, `POST .../start`, `POST .../submit`, `POST .../submissions`, `GET .../submissions`, `GET .../review`.
  - Backend: `AssessmentController`, `QuestionController`, `QuestionGroupController`, `QuizResultController`, `SubmissionController`, `MyAssessmentController`; services `AssessmentService`, `QuestionBankService`, `QuizScorer`, `MyAssessmentService`, `AssignmentSubmissionService`; models `Assessment`, `Question`, `QuestionGroup`, `QuizAttempt`, `QuizResult`, `AssessmentSubmission`, `SubmissionAttachment`. Details in `README-ASSESSMENT-ASSIGNMENT-UPDATE.md`.
- **Done:** full quiz flow, versioned assignment submissions with up to five attachments (20 MB each), grade or return with feedback, private storage and authenticated download.
- **To do:**
  - The API tests need PostgreSQL (a migration runs `CREATE EXTENSION pg_trgm`), but `phpunit.xml` points at in-memory SQLite, so every test fails as shipped. Point `phpunit.xml` at a PostgreSQL test database. Never use the dev database: `RefreshDatabase` wipes it.
  - Instructor assignment document: done. Staff upload it in the assessment form; the API stores disk, path, name, size and type on `assessments` (`attachment_*` columns) and serves it at `GET assessments/{id}/attachment` (`?download=1` to download). The "View" row action (admin) and "View details" button (student) open one shared popup, `AssessmentView`, built on the reusable `AttachmentViewer`. Rows saved before this change keep a name but no file (`attachment.available = false`) and need a re-upload.
  - Remove stale `assessments` and `studentAssessments` entries in `coming-soon.config.ts`.
  - The nav shows "Assignment Submissions" under the `a_assess` module; check that the mentor-only route and the admin route resolve to the same page for both shells.

## 10. Certificate Management (`a_certs`)

- **Purpose:** issue, review, cancel and download completion certificates; settings for eligibility (minimum attendance and score) and template.
- **Lifecycle:** `Pending` (requested when a student reaches 100%, by staff, or from an enrollment) then `Issued` or `Rejected`. An issued certificate can be `Cancelled`. A rejected one can be reopened by creating it again.
- **Who does what:**
  - Student: sees their own certificates, and views, downloads or prints the issued ones.
  - Mentor: reads the certificates of their own batch and **recommends** each one (approve, or return with a note). A recommendation never issues anything.
  - Admin, Super Admin, OB: create, issue, reject, cancel, and edit the settings. They can issue without the mentor's recommendation.
  - Anyone (no sign-in): checks a certificate number on the public verification page.
- **Eligibility:** settings hold a minimum attendance % (default 75) and a minimum score % (default 0, meaning none). Attendance is the share of recorded days the student attended; score is the average quiz result for the course. A student with no attendance records, or no quiz results, is not held back by that measure. Issuing below a minimum is refused unless the admin confirms an override, which is stored on the certificate and written to the audit log.
- **Editing details:** while a certificate is Pending or Rejected, staff can **Edit details**: the issue date it will carry (not in the future, empty means the day it is issued), a score that replaces the computed one (eligibility uses it), and the template, type, title, wording and signature name and role. Only what differs from the programme settings is stored, so a field set back to the default is cleared. An issued certificate is locked: to correct it, cancel it and create a new one. Edits are audit-logged.
- **Cancelling:** an issued certificate can be cancelled (it was called Revoked). A reason is required: one of Issued in error, Wrong details on the certificate, Marks or attendance corrected, Duplicate certificate, Student request, Misconduct or policy breach, or Other with a written note. The reason is stored, shown to staff in the preview and to the student, and sent to the student in a notification. The public verification page reports the certificate as cancelled and never shows the reason.
- **Mentor review in the admin list:** the list has no Mentor review column. Staff see a mentor's decision and note inside **Edit details**; mentors use their own Certificate Review page.
- **Frozen at issue:** when a certificate is issued it keeps a copy of the design (template, wording, signature) and of the score and attendance. Changing the settings later does not alter an issued certificate. Pending ones show the current settings.
- **Numbering:** `{prefix}-{year}-{id, 5 digits}`, for example `SHARP-2026-00012`. The prefix is a setting.
- **Front end:**
  - Admin: `pages/certificates/` (`certificates`, `certificate-list/`, `certificate-form/`, `certificate-settings/`).
  - Student: `pages/student/student-certificates/`.
  - Mentor: `pages/mentor/certificate-review/`.
  - Public: `pages/certificate-verify/`, route `/verify/:number`, the page a certificate's QR code opens.
  - Shared: `shared/components/certificate-view/` (draws the artwork), `certificate-preview/` (popup with Download and Print), `shared/common-services/certificates.service.ts` (state), `certificates-api.service.ts` (HTTP), `certificate-actions.service.ts` (confirm and error handling used by every screen), `shared/utils/certificate-render.util.ts` (HTML, stand-alone download file, QR).
- **API** (`/api/web`):
  - `GET certificates` (filters `course_id`, `batch_id`, `status`, `q`), staff and mentors; `POST certificates` (staff creates for `student_id` + `course_id`).
  - `POST certificates/{id}/review` (mentor or staff: `decision` approved or returned, `note` required when returned).
  - `PUT certificates/{id}` (staff, not issued yet: `issue_date`, `score`, `design`).
  - `POST certificates/{id}/issue` (`override` optional), `POST .../reject`, `POST .../cancel` (staff); `POST certificates/{id}/cancel` takes `reason` and, for Other, `note`; `GET certificate-cancel-reasons` lists the reasons.
  - `GET my/certificates` (student).
  - `GET certificate-settings`, `PUT certificate-settings` (staff).
  - `GET verify/{number}` (public, throttled): returns only name, course and dates.
  - Backend: `CertificateController`, `CertificateSettingsController`, `CertificateService`, models `Certificate`, `CertificateSetting`, migration `2026_11_14_000001_certificate_management`.
- **Download:** the certificate is saved as a stand-alone HTML file that opens offline, and **Print / PDF** opens the browser print dialog (choose "Save as PDF"). There is no server-generated PDF.
- **To do:**
  - A server-rendered PDF, if a file is needed for email or an archive.
  - A bulk "issue all eligible" action.
  - Notify the student when a mentor returns a certificate, and the programme office when a mentor approves one.

## 11. SHARP Community (`a_comms`)

- **Purpose:** chat groups, announcement groups and personal messages for the whole programme, with staff able to review every conversation.
- **Groups:**
  - **Common Floor** (chat) and **All users** (announcements): every active user. The Common Floor chat is stored in `common_floor_messages`, so the web and the mobile app share one chat.
  - **Course groups:** a chat and an announcement group per course, created as soon as a batch takes the course. Members are the students, mentors and trainers of those batches, plus anyone added by hand. A renamed course renames its groups.
  - **Custom groups:** created from the **Create chat group** or **Create announcement group** popup with the people picked (Admin, Super Admin, OB, Member and Institution users can create one). The creator and staff can edit, add and remove members, and delete it.
  - **Personal chats:** one per pair of people. Only the two people write in it; staff can read it.
  - **Staff roles** (Super Admin, Admin, OB) are in every group except personal chats and cannot be removed.
- **Posting rules:** anyone who can read a group can post, except announcement groups (staff and the group creator only) and personal chats (the two people only). A person who is not in a group cannot read it (403). Staff can hide any message; it is hidden, not erased, and logged.
- **Admin page** (`pages/community/`): tabs for Chat groups, Announcement groups, Personal messages and Conversations by person; cards for group counts and who signed in in the last 30 minutes; **View** (members, add or remove people, message a member, chat), **Add members**, **Edit**, **Delete**.
- **Front end:** `community.ts` (page), `group-list/`, `dm-list/`, `person-view/`, `community-group-form/` (the create popup), `group-view/`, `add-members/`, `new-message/`, `community-member-picker/`; `shared/components/group-chat/` is a reusable chat for any one group (give it a group id); `shared/common-services/community-api.service.ts` and `community.service.ts`; `shared/models/community.model.ts`.
- **API** (`/api/web/community`): `GET groups` (staff: all; others: their own), `GET groups/{id}` (with members), `POST groups`, `PUT groups/{id}`, `POST groups/{id}/members`, `POST groups/{id}/members/remove`, `DELETE groups/{id}`, `GET|POST groups/{id}/messages`, `DELETE groups/{id}/messages/{message}` (staff), `POST dm`, `GET dms`, `GET overview` (staff), `GET person?user=` (staff). Backend: `CommunityController`, `CommunityGroupService`, `CommunityMessageService`, `CommunityAccess` (one place for who belongs, who can read and who can post), models `CommunityGroup`, `CommunityMessage`, migration `2026_11_19_000001_create_community_tables`.
- **Not done:**
  - Student and mentor screens: the separate Common Floor / My groups / Group Discussion pages are gone. One sidebar item, **SHARP Community** (`/app/community`, `pages/chats`), opens the chat drawer (`ChatDock`, `ChatLauncher`) that holds every chat, with the Common Floor, groups and personal messages. Messages go through the API and arrive live.
  - The prototype's "Sent messages" tab and message flagging are not part of this version. A staff member can hide a message instead.
  - Real-time delivery: WebSockets through Laravel Reverb (`php artisan reverb:start`, port 8080, keys in the API `.env` and `environment.realtime`). Events `CommunityMessagePosted/Removed` go to private channel `community.group.{id}` (authorised by `CommunityAccess::canView` through `POST /broadcasting/auth`), `CommunityChatsChanged` to `community.user.{publicId}`. The web side is `RealtimeService` (Laravel Echo); `GroupChat` listens per group and keeps a 30 s refresh as fallback if the socket server is down. A WhatsApp-style floating chat (`ChatDock`, bottom-right of every screen) shows all chats with unread counts.

## 12. Notification Management (`a_notif`)

- **Purpose:** automatic notifications (which event, who gets it, the wording, on or off) and messages staff write by hand. Every notification is stored in the person's inbox and pushed to their open screens the moment it is created.
- **Flow:** a service fires a catalog event (`NotificationService::notify('assignment_graded', $studentId, $vars, $data)`) -> `NotificationRuleService::resolve` returns the rule's wording, or nothing when staff switched it off -> placeholders such as `{course}` are filled -> one `notifications` row per person -> `NotificationsPushed` goes out on each person's private channel `notifications.{hex of public id}` -> the web app (`NotificationsInboxService.start`) shows a toast and refreshes the bell. If the socket server is down the push is logged and skipped; the inbox row and a 2-minute refresh still deliver it.
- **Backend:** `App\Support\NotificationCatalog` (21 events: certificate requested / recommended by mentor / issued / rejected / cancelled; course added to a batch (student, mentor) / removed; module unlocked; assignment submitted / review started / graded; quiz submitted; new assignment, quiz or assessment published; attendance reported by the student / marked on a report / marked by hand; user created; password reset; added to a community group; announcement posted. To add one, add it here and call `notify`, `notifyStaff` or `notifyBatch` from the service), `notification_rules` table + `NotificationRule`, `NotificationRuleService`, `NotificationService` (`notify`, `notifyBatch`, `compose` for hand-written messages, low-level `toUsers`), `NotificationsPushed` event, `NotificationRuleController`.
- **API:** `GET notifications`, `POST notifications/read-all`, `POST notifications/{id}/read` (own inbox); staff (Super Admin, Admin, OB): `GET notification-rules`, `PUT notification-rules/{event}` (enabled, title, body), `POST notification-rules/{event}/reset`, `POST notifications/send` (roles, optional batch, people, title, body).
- **Front end:** `pages/notifications/` (`notifications` list, `notification-form` edit wording, `send-message`); `notification-rules.service.ts` (API), `notifications-inbox.service.ts` (inbox + live), `realtime.service.ts` (`listenNotifications`); `shared/components/notification-bell/`, `notification-toasts/`; model `notification.model.ts`.
- **To do:** more events (new assignment, session reminder); email, SMS or mobile push channels.

## 13. Roles and Permissions (`a_roles`)

- **Purpose:** show and edit which role can view, create, edit and delete each admin module.
- **Front end:** `pages/roles-permissions/`; `permissions.service.ts` (localStorage `sharp_ng_perms`, built from `buildPermissions` in `core/data/seed.ts`); `shared/directives/can-action.directive.ts`.
- **API:** none. The API enforces roles through route middleware (`role:...`) and `UserPolicy`.
- **To do:** pick one approach. Either store the matrix in the API and have route middleware read it, or make the page read-only and generate the matrix from the API's role rules. Until then, treat the UI matrix as cosmetic.

## 14. Logs Management (`a_logs`)

- **Purpose:** audit trail of user actions.
- **Front end:** `pages/logs/`; `activity-log.service.ts` (local, written by every module through `record(module, text)`).
- **API available:** `GET audit-logs` (staff), `AuditLogController`, `AuditLogger`, `AuditLog` model.
- **To do:** read the page from `GET audit-logs`; drop the front-end `record` calls or keep them only as a fallback while migrating; add filters (actor, module, date) and paging to the API if missing.

## 15. Reports

- **Purpose:** charts and CSV or Excel exports across users, institutes, attendance, certificates, courses, enrollment, learning, assessments.
- **Front end:** `pages/reports/` (injects ten local state services); `shared/utils/csv.util.ts`, `export.util.ts`.
- **API available:** `GET learning/report`, `GET quiz-results`, `GET dashboard`, `GET attendance/list`. No dedicated report endpoints.
- **To do:** list the reports the programme needs, add server endpoints with filters (batch, institute, date), and have the page request them. Client-side counting over cached lists will be wrong once lists are paged.

## 16. Settings

- **Purpose:** admin and super admin programme settings.
- **Front end:** `pages/settings/` (35 lines, small); shown only for Super Admin and Admin.
- **API:** none.
- **To do:** define the settings (programme name, year, attendance rules, certificate defaults, file limits) and store them server side.

## 17. Mentor workspace

- **Pages:** `pages/mentor/` – `mentor-dashboard`, `group-progress`, `manual-attendance`, `unlock-module`, `certificate-review`, `submissions`, `mentor-more`.
- **State and API:**
  - Unlock module: `module-unlocks.service.ts` against `module-unlocks` (`GET /`, `GET overview`, `POST /`, `DELETE {id}`); backend `ModuleUnlockController`, `ModuleGateService`, `ModuleUnlock` model; mentors act on their own batch.
  - Manual attendance: attendance and attendance-request APIs (section 7).
  - Submissions: section 9.
  - Group progress, group discussion, dashboard: `mentor-group.service.ts` and `mentor-chat.service.ts` (local).
  - Common floor: not wired yet (section 11).
- **To do:** replace `MentorGroupService` with batch and enrollment endpoints (mentor's own batch, students, progress); wire dashboard figures to the API; certificate review per section 10.

## 18. Student workspace

- **Pages:** `pages/student/` – `student-dashboard`, `my-learning/` (`material-viewer`, `module-quiz`), `course-player`, `student-attendance`, `attendance-request-form`, `student-assessments/` (`quiz-attempt`, `quiz-review`, `assignment-detail`), `student-profile`; `student-progress.service.ts`.
- **API-backed:** `my/courses`, `my/courses/{id}`, `my/lessons/{id}/open|complete` (`my-learning.service.ts`); `my/assessments...` (`my-assessments.service.ts`); `my/sessions` and attendance requests (`my-attendance.service.ts`); notifications inbox.
- **Local or placeholder:** dashboard (`learner-state.service.ts`, `programme-data.ts` constants), team chat (`student-chat.service.ts`), common floor, certificates (Coming Soon), profile.
- **To do:**
  - Build the student dashboard from `my/*` endpoints (progress, next session, due assignments); add a summary endpoint if the combination is slow.
  - Certificates page per section 10.
  - Team chat and common floor per section 11.
  - Profile: show data from `GET me`; add a profile update endpoint if edits are allowed.
  - Remove `programme-data.ts` demo constants once no page imports them.

---

## Cross-cutting work

- Fix environment URLs (README and MIGRATION-STATUS, issues 1 and 2).
- Delete `core/data/seed.ts` demo data and `LocalCollection` when every module above is API-backed.
- Add unit specs per service and per guard; add API tests for chat, notification rules and settings when they exist.
- Put the project in git and remove `src_61126_bkup.zip`, `dist/` and `logo-backup/` from it.
