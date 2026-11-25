# Architecture

## Overview

```
Browser (Angular 20, standalone components, signals)
   |  HTTPS, Authorization: Bearer <token>
   v
sharp-api (Laravel 13, Sanctum)  /api/web/*   (and /api/mobile/* for the mobile app)
   |
   v
PostgreSQL
```

The web app and the mobile app share one API and one database. Web routes live under `/api/web`; mobile routes under `/api/mobile`. Only the token label differs. Role rules are the same.

## Authentication

1. The login page posts to `auth/login` through `AuthService`, which uses `fetch`.
2. The response holds a token and a user (`id`, `name`, `username`, `role`, `initials`, `color`, `must_change_password`).
3. Token and user are saved in localStorage under the prefix `sharp_ng_` (`sharp_ng_token`, `sharp_ng_user`).
4. `api.interceptor.ts` adds `Authorization: Bearer <token>` to any request whose URL starts with `environment.apiBaseUrl`. A 401 on such a request signs the user out.
5. API errors use the envelope `{ ok: false, error }`; `apiErrorMessage()` turns them into text.

## Roles and workspaces

`AuthService.shell()` maps the role to a workspace:

| Role | Workspace |
|---|---|
| Mentor | mentor |
| Student | student |
| Super Admin, Admin, OB, Member, Institution and other roles | admin |

`app.routes.ts` uses one flat URL space under `/app`. `forShell('admin' | 'mentor' | 'student', routes)` limits each route set to a workspace, so `/app/dashboard` shows the right dashboard per role. Unknown paths redirect to the dashboard.

Admin modules use `moduleRoute(key, route, { create, edit, delete })`. It checks View permission on the module key, and optional extra guards for create, edit and delete routes.

## Permissions

- Module keys: `a_users`, `a_orgs`, `a_courses`, `a_enroll`, `a_attend`, `a_learn`, `a_assess`, `a_certs`, `a_comms`, `a_notif`, `a_roles`, `a_logs`, `a_reports`.
- Action slug: `<moduleKey>.<view|create|edit|delete>`, for example `a_orgs.edit`.
- `AuthService.can(moduleKey, 'v'|'c'|'u'|'d')` and `hasActionAccess(slug)` read the matrix.
- The `*appCan` directive hides buttons the role may not use.
- The matrix is built by `buildPermissions()` in `core/data/seed.ts` and kept in localStorage (`sharp_ng_perms`) by `PermissionsService`. It is a front-end rule only. The API enforces access separately with role middleware and policies, so a hidden button is not a security control.

## Data layer

Two kinds of service sit in `shared/common-services/`:

- `*-api.service.ts`: thin HTTP clients. `core/http/api-crud.ts` holds a shared CRUD helper.
- `*.service.ts`: state holders. Many extend `LocalCollection<T>` (`core/data/local-collection.ts`), a signal list backed by localStorage. Most inject the matching API service and use the collection as a cache. A few have no API service and are purely local. See [MIGRATION-STATUS.md](MIGRATION-STATUS.md).

Pages read signals from the state services. List pages extend `LocalListBase` and use `common-filter-card`, `common-detail-card` and `common-table-card`.

## Page pattern

- List page: header, stat cards, filter card, table card. Row buttons are `quickActions`.
- Form: a dialog opened with `MatDialog`, template-driven `FormsModule`.
- Feedback: `ToastService` (SweetAlert2) for success, error and confirm.
- Audit: create, edit and delete call `ActivityLogService.record(module, text)`.

## Backend pieces the front end depends on

- Enrollment and batches, with enrollment events.
- Module unlock gating (`ModuleGateService`): a student cannot open a module until the mentor or the quiz result allows it.
- Attendance with class sessions and geofence checks, and student attendance requests that staff approve or reject.
- Assessments: question bank, quiz attempts scored by `QuizScorer`, and versioned assignment submissions with private attachment storage (`ASSESSMENT_FILESYSTEM_DISK`).
- Certificates (issue and reject), notifications inbox, common floor with moderation, audit logs, dashboard.
