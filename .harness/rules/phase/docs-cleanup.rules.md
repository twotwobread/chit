# Docs Cleanup Rule

Use when editing documentation, process rules, skills, or agent-facing context.

## Goal

Keep default AI context small and unambiguous.

## Rules

- Put canonical agent behavior rules in `.harness/rules/*`, not broad docs. Keep `.pi/rules/*` as generated compatibility adapters only.
- Keep `AGENTS.md` to always-needed kernel rules only.
- Keep docs focused on feature specs and decision records.
- Put architecture/design/deploy implementation guidance in `.harness/rules/*`, task skills, or README source-of-truth tables, not standalone docs.
- Keep decision history, alternatives, and future ideas in `docs/decisions/`, feature docs, or Issues; do not put them in broad spec docs.
- Avoid “do not read this document” as the main control. Prefer removing references or moving the content behind a task-specific rule/skill.
- If a document is large, split by task so agents can read only the needed file.

## Verification

- Check line counts for always-read or commonly referenced files.
- Search for stale references to removed docs.
- Confirm new skills/rules point to small task-specific files under `.harness` or clearly marked compatibility adapters.
