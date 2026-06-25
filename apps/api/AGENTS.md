# AGENTS.md

## Scope

Applies to `apps/api`: Fastify + TypeScript backend, Prisma schema, migrations,
and API tests.

## Context to read

- For API, data, auth, backup, or admin work, read `docs/ai/architecture.md`
  and `docs/ai/decisions.md`.
- For product/scope questions, also read `docs/ai/project-brief.md`.
- Use `docs/ai/task-template.md` only when shaping a larger task brief.

## Backend rules

- Preserve per-user data isolation. User-facing data must be scoped to the
  authenticated user.
- Admin behavior must be enforced by the backend, not only hidden in the UI.
- Hidden exercises should remain readable in old plans, sessions, history, and
  progress views.
- Exercise deletion is not the preferred product flow; hiding is safer for
  preserving old history.
- User export/import must include personal data only. Do not include the global
  exercise catalog in user backup.
- Preserve existing product scope. Do not introduce social, trainer/client,
  shared-plan, or user-created exercise features unless the user explicitly
  changes the scope.
- Prefer existing backend patterns before adding new abstractions.

## Verification

- Run the narrowest relevant backend check first, commonly:

```bash
npm run typecheck -w apps/api
```

- For data/API behavior changes, add or update focused tests and run the
  relevant test file when possible.
- For broader risk, run `npm test` or `npm run build`.
