# Project Brief

## What We Are Building

NocapGym is a Telegram Mini App for building gym workout plans, running workouts, saving training history, and tracking progress.

The app is intended for personal use first, but access is not restricted to a fixed user whitelist. Any valid Telegram user can open the mini app and gets an account automatically.

## Primary Users

- Regular Telegram users who want a simple gym training planner.
- App admins who maintain the global exercise catalog.

There are no social features in v1: no trainers, shared plans, chats, public profiles, or interaction between users.

## Core Product Rules

- Every user sees only their own plans, active workouts, history, progress, and backup data.
- Exercises are global and managed only by admins.
- Regular users cannot create custom exercises.
- Hidden exercises should not appear for new selection, but old history must remain readable.
- Progress is calculated only from working sets.
- Weight is in kilograms.
- UI language is Russian.

## MVP Scope

- Telegram auth through Mini App `initData`.
- Auto-provision user account on first valid Telegram launch.
- Workout templates from global exercises.
- Run/edit/complete workout sessions.
- Option to apply workout changes back to source template.
- History and per-exercise progress.
- User JSON export/import for personal data only.
- Admin panel for creating/editing/hiding exercises.

## Out Of Scope For Now

- User-created exercises.
- Social features.
- Coach/client workflows.
- Shared plans.
- Admin catalog export/import.
- Multi-database production setup.
