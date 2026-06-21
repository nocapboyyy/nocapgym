# Agent Instructions

These instructions define how AI agents should work in this repository.

## Project Context

This project is NocapGym, a Telegram Mini App for gym workout planning,
workout execution, history, progress tracking, backups, and admin exercise
catalog management.

Before starting a task, read these files in order:

1. `README.md`
2. `docs/ai/project-brief.md`
3. `docs/ai/architecture.md`
4. `docs/ai/current-state.md`
5. `docs/ai/decisions.md`

Use `docs/ai/task-template.md` when shaping a new task or when the user asks
to split work into a clean task brief.

## Knowledge Base Map

Use the `docs/ai` files as the durable project memory:

- `docs/ai/project-brief.md` - product scope, target users, MVP boundaries,
  and non-goals.
- `docs/ai/architecture.md` - repo layout, API/web modules, auth, data model,
  backup behavior, and VPS/deployment notes.
- `docs/ai/current-state.md` - shipped features, known risks, operational
  notes, and current focus.
- `docs/ai/decisions.md` - short decision log for product, architecture,
  deployment, and data-model choices.
- `docs/ai/task-template.md` - lightweight template for turning larger asks
  into a clear implementation task.

For UI or Telegram viewport work, read `current-state.md` and
`architecture.md` before editing. For backend/API/data tasks, read
`architecture.md` and `decisions.md`. For scope questions, read
`project-brief.md` first.

## Working Principles

- Keep changes scoped to the current task.
- Prefer existing project patterns over new abstractions.
- Do not introduce social, trainer/client, shared-plan, or user-created
  exercise features unless the user explicitly changes the product scope.
- Preserve per-user data isolation. User-facing data must be scoped to the
  authenticated user.
- Admin behavior must be enforced by the backend, not only hidden in the UI.
- Hidden exercises should remain readable in old plans, sessions, history, and
  progress views.
- Treat Telegram Mini App mobile behavior as a first-class constraint,
  especially viewport height, safe areas, keyboard behavior, scrolling, and
  touch targets.
- Keep the UI Russian unless the user asks otherwise.

## New Chat Startup

At the beginning of a new task chat:

1. Restore context from the knowledge base files listed above.
2. Inspect the relevant source files before proposing or making changes.
3. Check the current git status and do not overwrite unrelated user changes.
4. Restate the task briefly if the scope is unclear.
5. Identify likely verification commands before editing.

For larger tasks, first produce a short task brief using
`docs/ai/task-template.md`. Keep the brief practical; do not create heavy
process artifacts for small fixes.

## Implementation Workflow

1. Understand the existing code path and data flow.
2. Make the smallest coherent change that solves the task.
3. Add or update tests when the change affects shared behavior, API contracts,
   data handling, or user-facing workflows.
4. Run focused checks first, then broader checks when risk warrants it.
5. Report what changed, what was verified, and what remains risky.

Useful verification commands:

```bash
npm run typecheck -w apps/api
npm run typecheck -w apps/web
npm test
npm run build
```

For layout changes, local browser checks are useful but not sufficient for
Telegram iOS WebView behavior. Mention when real-device Telegram testing is
still needed.

## Knowledge Base Updates

After completing a meaningful task, update the AI knowledge base so the next
chat can continue without relying on previous conversation history.

Always consider updating:

- `docs/ai/current-state.md` when features, known risks, operational notes, or
  current focus change.
- `docs/ai/decisions.md` when a product, architecture, deployment, data model,
  or security decision changes.
- `docs/ai/architecture.md` when routes, major components, data flow, auth,
  deployment, or repo structure change.
- `docs/ai/project-brief.md` only when product scope or core rules change.
- `docs/ai/task-template.md` only when the task process itself improves.

Keep documentation compact. Prefer short factual updates over long summaries.
Do not duplicate implementation details that are obvious from the code.

## Handoff Rules

Before ending a substantial task, leave a concise handoff in the final response:

- files changed;
- checks run and results;
- docs updated;
- follow-up risks or manual checks.

If the context window is getting full, produce a handoff summary that includes:

- current goal;
- completed work;
- important files;
- decisions made;
- commands already run;
- known failures or risks;
- next recommended step.

The repository, tests, and `docs/ai` knowledge base should be the source of
truth. Chat history is temporary.
