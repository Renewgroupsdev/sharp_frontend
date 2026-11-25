# SHARP Web (Angular)

Web portal for the SHARP programme. One app with three workspaces, chosen by the signed-in role:

- **Admin** (Super Admin, Admin, OB, Member, Institution): 13 management modules plus Settings.
- **Mentor**: group progress, manual attendance, module unlock, certificate review, assignment submissions, chat.
- **Student**: learning, attendance, assessments, certificates, team chat, profile.

The backend is the Laravel API in `D:\laragon\www\sharp-api` (Laravel 13, PostgreSQL, Sanctum). This app calls its `/api/web` routes.

## Requirements

- Node.js 20 or newer and npm
- Angular CLI 20 (installed locally through `npm install`)
- A running `sharp-api` instance

## Setup

```bash
npm install
npm start          # ng serve, http://localhost:4200
npm run build      # production build into dist/
npm test           # ng test (no spec files exist yet)
```

## Point the app at the API

The API base URL is set per environment:

| File | Used by | Current value |
|---|---|---|
| `src/environments/environment.ts` | `ng serve`, development build | `http://192.168.0.210:8000/api/web` |
| `src/environments/environment.production.ts` | production build | `/sharp/backend/api` |

Both need review. The development value is a LAN address for one machine. The production value is the legacy PHP path, not the Laravel `/api/web` prefix. See [docs/MIGRATION-STATUS.md](docs/MIGRATION-STATUS.md).

Start the API first:

```bash
cd D:\laragon\www\sharp-api
php artisan migrate --seed
php artisan serve --host=0.0.0.0
```

The seeded demo accounts use the password `sharp2026` (from the API README). Set `SHARP_CORS_ORIGINS` in the API `.env` to allow the Angular origin.

## Project structure

```
src/app/
  app.routes.ts        all routes; forShell() scopes routes per role, moduleRoute() adds permission guards
  core/auth/           AuthService (login, token, role, shell), guards
  core/http/           api.interceptor.ts (bearer token, 401 sign-out), api-crud.ts
  core/data/           models, seed data, LocalCollection, programme demo data
  core/nav/            nav-config.ts, coming-soon.config.ts
  layout/              shell layout and left navbar
  pages/<module>/      one folder per module; dialogs in sub-folders
  shared/
    common-services/   *.service.ts (state) and *-api.service.ts (HTTP)
    components/        table, filter, detail card, loader, bell, rich-text editor
    models/            TypeScript models
    utils/             csv, export, format helpers
```

Conventions are in [CONVERSION_GUIDE.md](CONVERSION_GUIDE.md): standalone components, signals, separate `.ts/.html/.scss`, `inject()`, new control flow, SweetAlert2 through `ToastService`.

## Documents

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): how the app, auth, roles and data fit together.
- [docs/MIGRATION-STATUS.md](docs/MIGRATION-STATUS.md): which modules use the API, which still use browser storage, and the open issues.
- [database-schema/user-management.md](database-schema/user-management.md): user module schema (MySQL, older than the Laravel migrations).
