---
name: i-um-docs-cleanup
description: Clean up i-um docs, rules, skills, or agent-facing context. Use for documentation restructuring, context reduction, rule extraction, or stale reference cleanup.
---

<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/skills/docs-cleanup/SKILL.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->


# i-um Docs Cleanup

Use when the user asks to improve docs/rules/skills or reduce agent context.

## Minimal reads

1. `.harness/rules/phase/docs-cleanup.rules.md`.
2. Target docs/rules files being changed.
3. `.harness/rules/core/worktree.md` if creating a docs worktree.
4. `.harness/rules/core/completion-report.md` before final response.

Do not read feature specs unless the task is specifically about a feature document.

## Procedure

1. Confirm scope: docs, rules, skills, or references.
2. Inspect current references with `rg` instead of opening broad docs.
3. Move canonical behavior rules into `.harness/rules/*`; keep `.pi/rules/*` only as generated compatibility adapters.
4. Keep `AGENTS.md` short and always applicable.
5. Keep docs focused on project state/specs, not agent process.
6. Verify with line counts and stale-reference search.
7. Report changed files and verification commands.
