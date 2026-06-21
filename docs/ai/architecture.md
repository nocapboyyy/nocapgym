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

Auth is registered as a Fastify preHandler in `auth/plugin.ts`.

## Auth And Access

- Frontend sends Telegram Mini App `initData` in `x-telegram-init-data`.
- Backend validates init data with bot token.
- If valid, backend upserts `User` by Telegram ID.
- Local development can use `x-dev-telegram-id` when dev auth is enabled.
- Admin access is controlled by `ADMIN_TELEGRAM_IDS`.

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

Template/session children use cascade deletes where appropriate. Exercise deletion is not the preferred product flow; hiding is safer for preserving old history.

## Frontend

The current UI is concentrated in `apps/web/src/App.tsx` and `apps/web/src/styles.css`.

Key screens:

- `Планы` - plan list and plan creation wizard.
- `Зал` - active workout execution.
- `История` - month calendar, progress, completed sessions.
- `Админ` - exercise catalog management for admins.

The plan creation flow is a modal wizard:

1. Plan fields.
2. Exercise picker.
3. Exercise set editor.
4. Return to plan summary.

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

Common deploy commands:

```bash
cd /opt/nocapgym
git pull
npm run build
sudo systemctl restart nocapgym-api
sudo systemctl status nocapgym-api --no-pager
```

SQLite DB location is controlled by `DATABASE_URL`. If relative, resolve it from the API process working directory.
