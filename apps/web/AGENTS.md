# AGENTS.md

## Scope

Applies to `apps/web`: React + Vite + TypeScript Telegram Mini App frontend.

## Context to read

- For UI or Telegram viewport work, read `docs/ai/current-state.md` and `docs/ai/architecture.md`.
- For product/scope questions, also read `docs/ai/project-brief.md`.
- Use `docs/ai/task-template.md` only when shaping a larger task brief.

## UI rules

- Keep user-facing UI in Russian unless the user explicitly asks otherwise.
- Treat Telegram Mini App mobile behavior as a first-class constraint:
  viewport height, safe areas, keyboard behavior, scrolling, swipe gestures,
  and touch targets.
- Preserve existing product scope. Do not introduce social, trainer/client,
  shared-plan, or user-created exercise features unless the user explicitly
  changes the scope.
- Hidden exercises should remain visible/readable in old plans, sessions,
  history, and progress views.
- Prefer existing frontend patterns before adding new abstractions.

## Verification

- Run the narrowest relevant frontend check first, commonly:

```bash
npm run typecheck -w apps/web
```

- For broader risk, run `npm test` or `npm run build`.
- For layout changes, local browser checks are useful but not sufficient for
  Telegram iOS WebView behavior. Mention when real-device Telegram testing is
  still needed.
