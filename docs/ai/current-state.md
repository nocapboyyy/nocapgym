# Current State

Last updated: 2026-06-15

## Working Features

- Telegram Mini App auth with automatic user provisioning.
- Dev auth fallback for local browser testing.
- User workout templates.
- Plan creation wizard with modal exercise picker and set editor.
- In plan creation, adding a set copies the previous set's type, target weight, and target reps.
- Plan exercises can be reopened from the wizard summary and edited in place.
- Plan exercises can be reordered in the wizard summary by dragging a handle.
- Exercise drag reorder temporarily disables Telegram vertical swipes to prevent Mini App collapse.
- Active workout screen with editable exercises and sets.
- Workout completion with optional template update.
- Completed workout history.
- History workout cards show the source plan name instead of a generic stats icon.
- The dashboard summary strip is hidden on the Admin tab.
- Per-exercise progress from working sets.
- User JSON export/import.
- Admin exercise management.
- Exercise hiding instead of hard delete as the preferred catalog flow.
- Delete completed workout from history.

## Recent UI Work

- Dark mobile-first design using the project palette.
- Bottom tabbar with iPhone safe-area handling.
- Plan wizard modal with internal scroll containers.
- Modal attempts to account for Telegram viewport height and keyboard resizing.
- When an editable field is focused or keyboard viewport shrink is detected, the bottom tabbar is hidden. Active workout finish controls are a normal block below the exercise list, not a sticky overlay.

## Known Risks / Watch Areas

- Telegram iOS WebView viewport behavior is tricky. Modal height should be retested on real iPhones after every layout change.
- `apps/web/src/App.tsx` is getting large. Future feature work may benefit from splitting panels/components.
- SQLite is acceptable for v1 VPS deployment, but backups and migration discipline matter.
- Local browser behavior may differ from Telegram Mini App behavior.

## Operational Notes

- Production-like deploy is currently manual through `git pull`, `npm run build`, and service restart.
- Build runs Prisma client generation before API TypeScript compilation.
- If API fails after deploy, check:

```bash
sudo systemctl status nocapgym-api --no-pager
sudo journalctl -u nocapgym-api -n 100 --no-pager
```

## Current Focus

- Stabilize mobile Telegram UX.
- Keep documentation compact and update `docs/ai/current-state.md` after meaningful feature or deployment changes.
