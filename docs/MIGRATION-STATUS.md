# Migration status: prototype to API

The app began as a front-end prototype whose data lived in browser localStorage. The API now exists. This page records which parts use it. Status comes from reading the code on 2026-11-11 (which services inject an API client). It does not prove that every screen reads from the API. Confirm each row in the browser before relying on it.

## Module status

| Module (key) | State service | API client | Status |
|---|---|---|---|
| User Management (`a_users`) | users | UsersApi | API-backed, local cache |
| Institute Management (`a_orgs`) | institutes, batches | InstitutesApi, BatchesApi | API-backed, local cache |
| Course Management (`a_courses`) | courses | CoursesApi, CourseCategoriesApi | API-backed, local cache |
| Enrollment (`a_enroll`) | batch-enrollments, enrollment | BatchEnrollmentsApi | API-backed, local cache |
| Attendance (`a_attend`) | attendance, attendance-requests, sessions | AttendanceApi, AttendanceRequestsApi | API-backed |
| Learning (`a_learn`) | learning, my-learning | LearningApi | API-backed, local cache |
| Assessment Library (`a_assess`) | assessments, my-assessments | AssessmentsApi | API-backed, local cache |
| Assignment Submissions | page services | SubmissionController | API-backed |
| Notifications inbox | notifications-inbox | HttpClient | API-backed |
| Module unlock | module-unlocks | HttpClient | API-backed |
| Certificate Management (`a_certs`) | certificates | CertificatesApi | API-backed (admin list and settings, mentor review, student page, public verification) |
| SHARP Community (`a_comms`) | community | CommunityApi | API-backed (admin page, student and mentor chat) |
| Team and mentor chat | student-chat, mentor-chat, mentor-group | none | Local only |
| Notification rules (`a_notif`) | notification-rules | none | Local only |
| Roles and Permissions (`a_roles`) | permissions | none | Local only |
| Logs (`a_logs`) | activity-log | none | Local only. API has `audit-logs`. |
| Reports (`a_reports`) | reads other state services | none | Derived from local state |
| Dashboard | reads other state services | none | Derived from local state. API has `dashboard`. |
| Student demo progress | learner-state, programme-data | none | Prototype constants |

## Open issues

1. **Production API URL.** `environment.production.ts` uses `/sharp/backend/api`, the legacy PHP path. The Laravel API serves `/api/web`. A production build will call the wrong address.
2. **Development API URL.** `environment.ts` uses `http://192.168.0.210:8000/api/web`. Use `http://localhost:8000/api/web` as the default and keep machine addresses out of the repo. The comment above it still says no API URL is needed.
3. **Placeholder modules.** None left. Certificates and Community are done (2026-11-12); the student and mentor chat now use the API.
4. **Stale Coming Soon entries.** `core/nav/coming-soon.config.ts` still lists `institutes`, `courseAssignments`, `courseAssessments`, `courseQuizzes`, `enrollment`, `assessments`, `studentDashboard`, `studentLearning` and `studentAssessments`, although those pages exist. Remove unused entries.
5. **Permissions are front-end only.** The editable matrix in localStorage can differ from API role middleware. Decide: store it in the API, or make it read-only and mirror the API rules.
6. **Audit logs are local.** `ActivityLogService` writes to localStorage. The API already records `audit-logs`. Read those instead.
7. **Seed data still ships.** `core/data/seed.ts` and `programme-data.ts` hold demo users, batches and constants. Remove them once every module is API-backed.
8. **Reports and Dashboard** count local state, so figures can disagree with the database. Point them at `GET dashboard` and report endpoints.
9. **Auth uses `fetch` and localStorage tokens.** Move login to `HttpClient`. Consider Sanctum cookie sessions.
10. **No tests.** There are no `*.spec.ts` files. The API has 14 feature tests, but the assignment tests were not run (no `vendor/` in the delivered archive). Run `php artisan test`.
11. **Repository hygiene.** The project has no git history. It contains `src_61126_bkup.zip`, `dist/` and `logo-backup/`. Copies exist under `Downloads\Chrome\ChatGPT\sharp\` (`sharp-web-angular`, `sharp-angular-src-updated`, `sharp-angular-src-fixed`). Choose one source of truth.
12. **Instructor assignment file.** Done (2026-11-11). Older assessment rows keep a name but no stored file and need a re-upload. Run `php artisan migrate` to add the `attachment_path`, `attachment_disk` and `attachment_mime` columns.
13. **Schema doc is out of date.** `database-schema/user-management.md` is MySQL and covers users only. The API uses PostgreSQL with 19 migrations.

## Suggested order

1. Fix the two environment URLs and put the project under git.
2. Switch Logs, Dashboard and Reports to API data.
3. (done) Student and mentor chat use the Community API.
4. Decide the permissions approach.
5. Add API endpoints for chat and notification rules, or remove those features.
6. Delete seed data and `LocalCollection` once nothing uses them.
7. Add specs for auth, guards and each module service.
