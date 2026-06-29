# Contract: docs-cleanup

## Purpose

Clean up docs, rules, skills, or agent-facing context while keeping default context small and source-of-truth boundaries clear.

## Inputs

- User request.
- Target docs/rules/skills/references.
- `.harness/rulepacks/docs-cleanup.yml`.

## Outputs

- Updated docs/rules/skills or references.
- Verification summary with line counts and stale-reference search when relevant.

## Done conditions

- Canonical behavior rules live in `.harness/rules/*`.
- Generated adapter files are not edited as source.
- `AGENTS.md` remains short and bootstrap-oriented.
- Stale references are searched and reported.
