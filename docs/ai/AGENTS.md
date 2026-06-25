# AGENTS.md

## Knowledge base update rules

- Update `docs/ai/*` only when a long-lived project fact changes:
  architecture decision, data flow, product scope, operational risk, or
  deployment behavior.
- Do not update the knowledge base for local fixes, narrow implementation
  details, temporary debugging notes, routine refactors, or one-off task
  progress.
- Keep durable notes compact and factual. Avoid duplicating details that are
  already obvious from code, tests, or git history.
