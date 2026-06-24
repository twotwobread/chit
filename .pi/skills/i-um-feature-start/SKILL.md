---
name: i-um-feature-start
description: Start implementation for an approved i-um feature spec. Use for implementation only, not feature spec/plan drafting or PR-only lifecycle tasks.
---

# i-um Feature Start

Use when the user asks to implement/start coding from an approved specific GitHub Issue or feature spec.

Do not use this for feature spec/plan drafting; use `i-um-feature-spec-plan` instead.
Do not use this for “create/merge PR from an existing worktree”; use `i-um-pr-lifecycle` instead.

## Required input

Need at least one:

- GitHub Issue number, e.g. `#42`
- Feature spec path, e.g. `docs/features/0042-*.md`

If missing, ask before implementation.

## Minimal reads

1. Target feature spec.
2. `.pi/rules/feature-implement.md`.
3. `.pi/rules/worktree.md` if creating/selecting a worktree.
4. Conditional rules only when needed:
   - API/DB/domain schema: `.pi/rules/api-db.md`
   - Mobile UI: `.pi/rules/mobile-ui.md`
   - Testing/verification: `.pi/rules/testing.md`
   - Code size/duplication: `.pi/rules/code-quality.md`
   - Commit preparation: `.pi/rules/commit.md`

Do not read delivery/DoD/testing umbrella docs. Read `docs/decisions/` only when the feature changes or revisits product/technical/domain/API/DB/ops direction.

## Procedure

1. Inspect state
   - `git status --short`
   - `git branch --show-current`
   - `git rev-parse --show-toplevel`
   - Do not overwrite unrelated user changes.

2. Spec/plan drafting guard
   - If the current request is to create or substantially revise a feature spec/implementation plan, stop this implementation flow and use `i-um-feature-spec-plan`.
   - Do not draft from issue text alone unless the user explicitly waived Ouroboros in the spec/plan workflow.

3. Resolve issue/spec
   - If an issue number is provided, inspect with `gh issue view <number> --comments` when useful.
   - Prefer the spec linked from the issue.
   - Otherwise resolve `docs/features/NNNN-*.md`.
   - If no spec exists, stop and ask whether to create one with `i-um-feature-spec-plan` first.

4. Readiness gate
   - Stop if scope/API/DB/UI/acceptance criteria are ambiguous.
   - Stop if open questions block implementation.
   - Stop if the request conflicts with the spec.

5. Worktree
   - Use `.pi/bin/worktree-create` from repository root.
   - Continue all implementation inside the selected `.worktrees/*` path.

6. Implement
   - Follow the target spec only.
   - API changes start from OpenAPI.
   - DB changes use migrations.
   - Mobile uses generated API client/types when available.
   - Add tests for changed behavior or record a gap.

7. Complete
   - Read `.pi/rules/completion-report.md` before the final report.
   - Report changed behavior, verification commands/results, manual smoke/deploy status, and gaps.
