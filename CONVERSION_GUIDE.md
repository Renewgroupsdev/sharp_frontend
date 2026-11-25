# SHARP POC → Angular conversion guide

Source (vanilla JS prototype, **read-only reference**): `d:\Downloads\Chrome\ChatGPT\sharp\SHARP_Student_Mentor_Admin_POC_v6\`
- `js/lms-modules.js` – the 13 admin modules (string templates + a click switch + localStorage `DB`)
- `js/app.js` – student & mentor mobile-style screens (`V.home`, `V.mhome`, `V.attendance` …), admin dashboard (`V.ahome`), demo data constants
- `css/styles.css` – prototype styles (use for reference of look/behaviour only)

Target (Angular 20, standalone components, signals): `d:\Downloads\Chrome\ChatGPT\sharp\sharp-web-angular\`
Code structure follows the reference project `D:\zelora_erp_combo\zelora-erp-web` (look at `src/app/pages/branch-management/branches/` for the list-page pattern and `branch-form/` for the dialog-form pattern).

## Conventions (match the reference project)
- Standalone components, **separate** `.ts` / `.html` / `.scss` files; file name = kebab-case, class = PascalCase without suffix (`institutes.ts` → `class Institutes`). Selector `app-<file>`.
- `inject()` for DI, **signals** (`signal`, `computed`) for state, new control flow (`@if`, `@for ... track`). No NgModules.
- Pages live in `src/app/pages/<module>/…`; dialogs/forms that belong to a page live in a sub-folder (`pages/institutes/institute-form/`), opened with `MatDialog` (see `LocalListBase.openDialog`).
- Services in `src/app/shared/common-services/<name>.service.ts`, models in `src/app/shared/models/<name>.model.ts`.
- List pages = page header + `app-common-detail-card` stat row + `app-common-filter-card` + `app-common-table-card`, extending `LocalListBase` (`shared/components/local-list-base.ts`). Copy the pattern of `branches.html/.ts` in the reference project. Table row buttons are `quickActions` cells; permission slug per action is `<moduleKey>.<view|create|edit|delete>` (e.g. `a_orgs.edit`) via `[actionPermissions]` / the `permission` field, and `*appCan="'a_orgs.create'"` on header buttons.
- Page-level styles: reuse `shared/styles/erp-page.scss` and `erp-dialog.scss` via `styleUrls`; add a small page `.scss` only when needed. Theme variables (`--primary`, `--text-dark`, `--border-soft`, `--status-*`…) are in `src/styles.scss`.
- Confirmations / messages: `ToastService` (SweetAlert2): `success`, `error`, `confirm`.
- Icons: Bootstrap Icons (`bi bi-…`). Forms: template-driven `FormsModule` like `branch-form`.
- Every create / edit / delete also calls `ActivityLogService.record('<Module name>', '<text>')` (this feeds Logs Management) — same messages as the prototype's `log(...)`.
- Do NOT use `any` where a model is easy to write. No `console.log`. Keep comments sparse, same density as the reference.

## Shared infrastructure already built (do not modify; ask via your final report if you need a change)
- `core/auth/auth.service.ts` – `role()`, `shell()`, `actor()` (the demo account of the viewed role), `can(moduleKey, 'v'|'c'|'u'|'d')`, `hasActionAccess(slug)`.
- `core/data/models.ts` – `ROLES`, `ROLE_ACCESS`, `SharpUser`, `Institute`, `Batch`, `ADMIN_MODULES` (module keys `a_users`, `a_orgs`, `a_courses`, `a_enroll`, `a_attend`, `a_learn`, `a_assess`, `a_certs`, `a_comms`, `a_notif`, `a_roles`, `a_logs`, `a_reports`).
- `core/data/local-collection.ts` – `LocalCollection<T extends {id:string}>` signal + localStorage list (`items()`, `get`, `add`, `update`, `remove`, `nextId`, `replace`, `reset`). **Build your module stores as `@Injectable({providedIn:'root'}) class XService extends LocalCollection<X>` with a seed function ported from the prototype's `seed()` / constants.** Use a unique storage name per store.
- `shared/common-services/` : `users.service.ts` (`UsersService`: all accounts, `students()`, `nameOf`, `orgOf`), `institutes.service.ts`, `batches.service.ts`, `permissions.service.ts`, `activity-log.service.ts`, `toast.service.ts`, `learner-state.service.ts` (demo student's progress/attendance).
- `core/data/programme-data.ts` – student/mentor demo constants (STUDENT, MENTOR, MODULES, QUIZ, SYLLABUS, SCHEDULE, TIMETABLE, TEAM, ANNOUNCE, NOTIFS, DISCUSS, GROUPCHAT, DOCS). Do not rename existing exports; you may add types or fields.
- `shared/components/` : `common-table-card`, `common-filter-card`, `common-detail-card`, `page-loader`, `local-list-base.ts`; `shared/directives/can-action.directive.ts` (`*appCan`); `shared/utils/export.util.ts`, `format.util.ts`; `shared/models/common-components.model.ts`.
- Routes are already declared in `src/app/app.routes.ts` and each page already exists as a stub (`pages/<x>/<x>.ts` + `.html`) with the exact class name the router imports. **Replace the stub in place, keep the file path and exported class name.** Do not edit `app.routes.ts`, `app.config.ts`, layout, navbars, or other agents' files.

## Behaviour to preserve from the prototype
- Permission-aware UI: a role without Create/Edit/Delete on a module must not see those buttons (use the slug scheme above). Roles: Super Admin & Admin = everything; Member/OB/Institution = view-only subsets (see `buildPermissions` in `core/data/seed.ts`).
- Menu/screen names already renamed in the prototype: "Institute Management" (was Organization Management) and "SHARP Community" (was Communication Management). Use the new names everywhere.
- Attendance flow: students **send an attendance request** (reason + note); admins/OBs/mentors **Approve/Reject** it (approve = mark present on the student's behalf, recorded as a Manual mark) and can also **mark attendance on behalf of a student/mentor** without a request. Student-side request button lives on the student Attendance screen. Requests are shared through `shared/common-services/attendance.service.ts` (already created with the API `requestsFor(sid)`, `sendRequest(sid, session, reason, note)`, `save(...)`, `resolveRequest(id, approve, by)`, `requests`, `pendingCount`). The Attendance agent may extend it but must keep that API; the student and mentor agents only call it.
- CSV downloads / exports from the prototype → `shared/utils/export.util.ts` helpers (`downloadExcel`, `saveBlob`) or `LocalListBase.exportAs`.

## Verification
- Type-check with `npx ng build --configuration development --output-path <your own scratch dir>/dist-<yourname>` from the project root (use your own output dir, other agents build in parallel). Fix every error in YOUR files. Errors in files you don't own: mention them in your report, don't edit.
- You cannot run a browser; carefully re-read templates against the prototype's behaviour instead.

## Report back
Final message: list of files created/changed, public service APIs other modules may use, anything from the prototype you intentionally did not port, and any shared-file change you need.
