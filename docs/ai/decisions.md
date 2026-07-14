# Decisions

This is a short decision log. Keep entries small: date, decision, reason, consequence.

## 2026-07-14 - Empty Actual Repetitions Are Null

Decision: store an empty actual repetition field as `null`; allow it only while
the set is incomplete, and require a positive integer when the set is marked
completed. Template target repetitions are always positive integers.

Reason: zero and empty have different meanings, and an invisible zero caused
late validation failures during plan saving and workout completion.

Consequence: frontend validation gives Russian feedback before the request,
and backend validation enforces the completed-set rule independently.

## 2026-07-14 - Production Migrations Use A Checked SQLite Backup

Decision: run production on Node.js 22 and deploy migrations through the
repository wrapper before restarting the API.

Reason: SQLite needs a recoverable pre-migration state, and Prisma 6 does not
officially support Node.js 24 or reliably create a missing SQLite file here.

Consequence: deployment stops API writes, verifies a timestamped backup,
applies migrations, checks database integrity, and leaves the service stopped
on failure.

## 2026-07-14 - Telegram Init Data Expires After 24 Hours

Decision: accept signed Telegram Mini App `initData` for at most 86400 seconds,
with 60 seconds of clock skew.

Reason: bound replay risk without interrupting ordinary workout sessions.

Consequence: an unusually long-lived WebView receives
`TELEGRAM_AUTH_EXPIRED` on its next API request and asks the user to close and
reopen the Mini App; local development auth is unchanged.

## 2026-07-14 - Workout History Keeps The Original Plan Name

Decision: copy the source plan name into each workout session when it starts.

Reason: renaming or deleting a live template must not rewrite the meaning of completed history.

Consequence: history prefers `templateNameSnapshot`, while the nullable template relation remains available for current navigation and is backfilled where an old linked plan still exists.

## 2026-07-14 - One Active Workout Per User

Decision: allow at most one active workout session per user and return it from repeated start requests.

Reason: users must be able to resume a workout after Telegram WebView reloads without creating duplicate active sessions.

Consequence: SQLite enforces a partial unique index, active sessions are loaded during app startup, and completion with optional template application is one idempotent transaction.

## 2026-06-22 - Gender Is Explicit User Profile Data

Decision: store a nullable user-provided `male` or `female` value and require users with no value to choose one.

Reason: Telegram does not provide gender, so the app must not guess it for new or existing users.

Consequence: gender can be changed from the profile menu and remains outside personal workout backup export/import.

## 2026-06-22 - Admin Is Outside Primary Navigation

Decision: open the admin service screen from the profile menu instead of a bottom tab.

Reason: catalog administration is a secondary service action, not a primary workout destination.

Consequence: only users reported as admins see the entry, and backend authorization checks remain authoritative.

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
