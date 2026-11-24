# Architecture

## Repo Layout

- `apps/web` - React + Vite + TypeScript Telegram Mini App frontend.
- `apps/api` - Fastify + TypeScript backend.
- `apps/api/prisma` - Prisma schema, migrations, SQLite database in local/dev setups.

Root package uses npm workspaces.

## Backend

Fastify app is built in `apps/api/src/server.ts`.

Main route groups:

- `routes/exercises.ts` - public catalog and admin exercise management.
- `routes/templates.ts` - user workout templates.
- `routes/sessions.ts` - active/completed sessions, history, progress, export/import.
- `routes/users.ts` - authenticated current-user profile updates.

Auth is registered as a Fastify preHandler in `auth/plugin.ts`.

API errors use a stable JSON contract with a public `code` and safe `message`.
Validation errors may additionally include Zod `issues`. Authentication,
authorization, not-found, conflict, and validation failures have explicit HTTP
statuses; unexpected and unmapped database errors expose only a generic 500
response while full details remain in server logs.

## Auth And Access

- Frontend sends Telegram Mini App `initData` in `x-telegram-init-data`.
- Backend validates the init data signature with the bot token, then requires a
  valid `auth_date`. The default maximum age is 86400 seconds with 60 seconds
  of permitted clock skew; both values are configurable through
  `TELEGRAM_INIT_DATA_MAX_AGE_SECONDS` and
  `TELEGRAM_INIT_DATA_CLOCK_SKEW_SECONDS`.
- Expired auth returns `401 TELEGRAM_AUTH_EXPIRED`; the frontend instructs the
  user to close and reopen the Mini App instead of retrying the same init data.
- After validation, the backend reads `User` by Telegram ID. It creates missing accounts and synchronizes changed Telegram name and username fields. Requests with unchanged identity fields only read the profile. Concurrent first requests resolve to the same account.
- Local development can use `x-dev-telegram-id` when dev auth is enabled.
- Admin access is controlled by `ADMIN_TELEGRAM_IDS`.
- Admin authorization remains enforced by backend checks; frontend navigation is not an authority boundary.

## Data Model

Core Prisma models:

- `User`
- `Exercise`
- `WorkoutTemplate`
- `TemplateExercise`
- `TemplateSet`
- `WorkoutSession`
- `SessionExercise`
- `SessionSet`

`User.gender` is a nullable `male`/`female` value. The migration leaves existing users at `null`, and both new and existing users with no value must complete gender onboarding before using the main app.

Template/session children use cascade deletes where appropriate. Exercise deletion is not the preferred product flow; hiding is safer for preserving old history.

Each user can have at most one active workout session. SQLite enforces this
with a partial unique index on `WorkoutSession.userId` for rows whose status is
`active`. `GET /api/sessions/active` restores the current session. Starting the
same plan again returns that session, while starting a different plan atomically
replaces only the unfinished active session and leaves completed history intact.

Only active sessions can be edited. Completion receives the final exercise
state and an optional apply-to-template flag in one request; session updates,
the `active → completed` transition, and template replacement run in one
transaction. Repeating completion returns the existing completed session
without changing `completedAt` or applying the template again.

Empty optional actual workout values are represented as `null`, not zero.
Incomplete sets may have `actualReps = null`; a set marked completed requires
positive integer repetitions on both frontend and backend. Template target
repetitions are also validated as positive integers before saving.

`WorkoutSession.templateNameSnapshot` stores the plan name as it was when the
session started. History renders this snapshot even if the live template is
later renamed or deleted; the nullable relation remains available for current
navigation. The migration backfills linked existing sessions and import keeps
the snapshot when it is present in a backup.

SQLite indexes cover user template ordering, user completed-session history,
template lookup, exercise progress, and ordered template/session child
relations. The history index is verified with SQLite query-plan integration
tests.

The API also exposes compact personal history reads. `GET /api/history/page`
uses a value cursor over completion date and ID, including undated imported
sessions. `GET /api/history/calendar` reads completed session markers by
indexed start-time range. `GET /api/progress/exercises` lists exercises with
qualifying working sets across the user’s dated completed sessions. The full
history endpoint remains available.

Exercise progress points include their source `sessionId`, so multiple sessions
for the same exercise on one calendar day remain distinct and provide stable
frontend list keys.

`PATCH /api/me` accepts a gender update for the authenticated user and cannot select another user.

## Frontend

The application shell in `apps/web/src/App.tsx` manages the account, navigation,
Telegram viewport and workout lifecycle. PlansScreen, GymScreen, HistoryPanel
and AdminPanel own their screen components. The plans controller persists
across tab switches. The account owns one in-memory SessionDraft, and only
GymScreen subscribes to its editable values. Restoring the same session ID
preserves local edits. Completing or replacing the session discards its draft.

Plans and the gym picker use `GET /api/templates/summary`. Each summary carries
its update time and ordered plan-row IDs and exercise names. The editor reads
the full template by ID on demand. Starting a plan only requires its ID.

After profile onboarding, startup reads the active session before selecting Gym
or Plans. The visible screen requests its resources independently. The weekly
and monthly calendars request their visible local date ranges. History reads
cursor pages and progress options on entry. The editor and admin catalogs load
when opened. Screen reads are cached in memory per account and request URL;
expired authorization unmounts the account UI. Successful workout mutations patch
cached history pages by session ID and update markers for the affected date ranges.
Page cursors retain their original boundaries. History cards carry ordered exercise
IDs and, only when the title comes from a live plan, its ID. Completing a workout
with template application returns the updated template on the successful transition.

Key screens:

- `Планы` - plan list and plan creation wizard.
- `Зал` - active workout execution.
- `История` - month calendar, progress, completed sessions.
- `Цикл` - female-only placeholder with no cycle data yet.
- `Админ` - service screen opened by admins from the profile menu, not a bottom tab.

The bottom navigation uses persistent icon-over-label items and contains three tabs for men or four tabs for women. The profile menu allows gender changes and exposes the admin entry only when the backend reports admin access.

The plan creation flow is a modal wizard:

1. Plan fields.
2. Exercise picker.
3. Exercise set editor.
4. Return to plan summary.

Plan and workout-picker dialogs move focus inside when opened, trap Tab and
Shift+Tab, close on Escape, and restore focus to the opening control.

## Backup

User export/import includes personal data only:

- templates;
- sessions/history.

The global exercise catalog is not included in user backup.

## Deployment Notes

Current VPS style:

- Ubuntu VPS.
- App path: `/opt/nocapgym`.
- Repository: `https://github.com/nocapboyyy/nocapgym.git`.
- API served by `nocapgym-api.service`.
- Caddy handles HTTPS/reverse proxy.
- SQLite remains the production DB for v1.

One-command deployment (defaults to `main`, optional branch argument):

```bash
/opt/nocapgym/scripts/deploy.sh
/opt/nocapgym/scripts/deploy.sh BRANCH_NAME
```

SQLite DB location is controlled by `DATABASE_URL`. The production wrapper
resolves relative paths from `apps/api/prisma`, matching the Prisma schema.
Production uses Node.js 22. The deployment script locks the checkout and stops
the API before changing code, dependencies, or build outputs. It leaves the API
stopped on failed verification, migration, or post-start health checks.
The migration wrapper creates and integrity-checks
a SQLite backup before `prisma migrate deploy`, checks the migrated database,
and prevents service restart on failure. The complete deployment and recovery
procedure is in `docs/ai/production-runbook.md`.
