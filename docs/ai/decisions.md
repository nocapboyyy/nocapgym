# Decisions

This is a short decision log. Keep entries small: date, decision, reason, consequence.

## 2026-06-11 - Any Telegram User Can Access The App

Decision: do not whitelist normal users.

Reason: the app should create an account for any valid Telegram user.

Consequence: all user data endpoints must be scoped by authenticated `userId`.

## 2026-06-11 - Admins Are Whitelisted By Telegram ID

Decision: admin-only features use `ADMIN_TELEGRAM_IDS`.

Reason: simple and sufficient for a small private admin group.

Consequence: admin panel can live inside the mini app, but backend must enforce admin access.

## 2026-06-11 - Users Cannot Create Exercises

Decision: exercises are global catalog entities managed by admins.

Reason: cleaner progress/history and simpler v1 UX.

Consequence: user backup excludes exercise catalog data.

## 2026-06-11 - SQLite For First VPS Production

Decision: keep SQLite as production DB for v1.

Reason: low expected load and simpler operations.

Consequence: monitor DB backups and avoid features requiring high write concurrency.

## 2026-06-12 - Build Generates Prisma Client

Decision: API build runs `prisma generate && tsc`.

Reason: fresh VPS deploys can otherwise compile against a stale/default Prisma client.

Consequence: `npm run build` is safer as a deployment command.

## 2026-06-13 - Plan Creation Uses A Modal Wizard

Decision: create/edit plan flow uses one modal wizard.

Reason: keeps unsaved plan context together on mobile.

Consequence: modal layout must carefully manage internal scroll areas and Telegram viewport quirks.

## 2026-06-15 - History Sessions Can Be Deleted

Decision: users can delete completed sessions from history.

Reason: users need to remove mistaken workouts.

Consequence: backend deletes by `id + userId`; progress should refresh after deletion.
