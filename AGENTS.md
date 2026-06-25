# AGENTS.md

## Project invariants

- Keep product scope unchanged unless the user explicitly changes it.
- Preserve per-user data isolation.
- Enforce admin behavior on the backend.
- Keep user-facing UI in Russian unless requested otherwise.

## Task routing

- Product/scope questions -> read docs/ai/project-brief.md
- UI/Telegram work -> read apps/web/AGENTS.md and relevant docs/ai files
- API/data/auth work -> read apps/api/AGENTS.md and relevant docs/ai files
- Read all docs/ai files only for cross-cutting tasks

## Workflow

- Inspect relevant files before editing.
- Run the narrowest relevant verification first.
- Summarize logs; do not carry full logs forward unless they are the failure itself.

## Durable state

- Update docs/ai only when long-lived project facts changed.

## Handoff

- Report: files changed, checks run, docs updated, open risks.
