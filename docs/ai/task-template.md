# Task Template

Use this when starting a new project task.

## Goal

What should change, in one or two sentences?

## User Value

Why does this matter to the user?

## Scope

In:

- 

Out:

- 

## UX Notes

Screens affected:

- 

Mobile/Telegram concerns:

- safe area;
- keyboard behavior;
- scroll behavior;
- touch targets.

## Data / API Notes

Models or endpoints affected:

- 

Auth/access constraints:

- 

## Acceptance Criteria

- 
- 
- 

## Verification

Run relevant checks:

```bash
npm run typecheck -w apps/api
npm run typecheck -w apps/web
npm test
npm run build
```

Manual checks:

- Telegram Mini App on phone if layout is involved.
- Local browser is useful, but not enough for iOS Telegram viewport issues.

## Docs To Update

- `docs/ai/current-state.md`
- `docs/ai/decisions.md` if an architectural/product decision changes
