---
name: i-um-feature-start
description: Start implementation for an i-um GitHub issue or feature spec. Use when the user asks to implement/start a specific issue or docs/features spec; gates on spec readiness, open questions, worktree rules, and vertical-slice implementation workflow.
---

# i-um Feature Start

Use this skill when the user asks to start implementation for a specific GitHub Issue or feature spec, for example:

- `4번 이슈 구현 시작해줘`
- `GitHub Issue #4 구현해줘`
- `docs/features/0004-trip-create.md 구현 시작해줘`

This skill is a thin execution entrypoint. The source of truth remains the project docs. If this skill conflicts with project docs, follow the project docs and mention the conflict.

## Required Inputs

You need at least one of:

- GitHub Issue number, e.g. `#4`
- Feature spec path, e.g. `docs/features/0004-*.md`

If both are missing, ask for the issue number or spec path before doing implementation work.

## Required Reads

Before implementation, read these files with the `read` tool:

1. `AGENTS.md`
2. `docs/delivery/feature_delivery_workflow.md`
3. `docs/delivery/definition_of_done.md`
4. The target `docs/features/NNNN-*.md` spec
5. Any product/architecture docs referenced by the spec

## Procedure

### 1. Inspect current state

- Run `git status --short` and `git branch --show-current`.
- Identify the repository root with `git rev-parse --show-toplevel`.
- The repository root worktree should stay on `develop`. Feature/doc branches should be checked out only inside `.worktrees/...`.
- If the current directory is the repository root and the branch is not `develop`, do not implement there. If there are no tracked local changes, switch the root back to `develop`; otherwise stop and ask before switching.
- Do not overwrite or clean up unrelated user changes.
- If currently inside `.worktrees/...`, identify whether it already matches the target feature.

### 2. Resolve issue and spec

- If an issue number is provided, inspect it when possible:
  - `gh issue view <number> --comments`
- Resolve the feature spec path:
  - Prefer the path linked in the issue body.
  - Otherwise look for `docs/features/NNNN-*.md`, where `NNNN` is the zero-padded issue number.
- If no spec exists, stop and tell the user to create the feature spec + plan first.

### 3. Readiness gate

Stop before implementation and ask/clarify if any of these are true:

- The spec has unresolved `Open Questions` that are not explicitly split into follow-up issues.
- The spec status is not `Ready` and the user has not explicitly approved starting anyway.
- Scope, API contract, DB changes, UI requirements, or acceptance criteria are too ambiguous to implement safely.
- The requested implementation differs from the spec.

For complex or long-running features, ask whether the user wants Ouroboros-based execution. Do not switch to Ouroboros implementation without explicit user approval.

### 4. Prepare feature worktree

Follow `docs/delivery/feature_delivery_workflow.md` Step 6.

Rules:

- One worktree per PR/MR.
- Worktrees must be under repository root `.worktrees/`.
- Never create sibling-directory worktrees such as `../i-um-F001-*`.
- Branch format: `feature/F-<NNN>-<short-name>`.
- Worktree path format: `.worktrees/F<NNN>-<short-name>`.
- If `scripts/worktree-create` exists, use it. Do not bypass it with direct `git worktree add`.

Derive names from the spec filename when possible:

- `docs/features/0004-trip-create.md`
- Feature id argument: `F004` or `0004`
- Short name argument: `trip-create`
- Branch created by script: `feature/F-004-trip-create`
- Worktree created by script: `.worktrees/F004-trip-create`

Run the worktree script from the repository root while the root worktree is on `develop`.

Preferred command pattern:

```bash
scripts/worktree-create F004 trip-create
```

Before running it, inspect the script help when needed:

```bash
scripts/worktree-create --help
```

For docs/process branches that intentionally do not use the feature branch naming convention, pass explicit options:

```bash
scripts/worktree-create docs worktree-cleanup-rule \
  --branch docs/worktree-cleanup-rule \
  --path docs-worktree-cleanup-rule
```

If `docs/delivery/feature_delivery_workflow.md` says to use `scripts/worktree-create` but the script is missing in the current checkout, stop and report the mismatch. Ask whether to update/rebase the branch, switch to the branch that contains the script, or explicitly allow a manual fallback.

If `origin/develop` does not exist, pause and ask which base branch to pass with `--base`. If the branch or worktree already exists, inspect it before reusing it.

After creating or selecting the worktree, continue all implementation work inside that worktree.

### 5. Restate the implementation slice

Before editing code, briefly report:

- Issue/spec path
- Goal
- In scope
- Out of scope
- API/OpenAPI changes
- DB changes
- UI changes
- Verification plan
- Worktree path and branch

If the user asked to implement, proceed after this checkpoint unless a readiness gate blocked the work.

## Implementation Guardrails

- Implement only what the spec requires.
- Keep the feature as a vertical slice: App UI + API Contract + API Server + DB + Tests + Deployable State, as applicable.
- For API changes, update OpenAPI first.
- Regenerate Go server interfaces and TypeScript API client when required.
- Mobile UI must use the generated API client/types instead of duplicate handwritten contract types.
- DB changes must use migrations.
- If implementation reveals a spec mismatch, update the feature spec or ask before changing behavior.
- Remove only unused code/imports created by your changes.

## Completion Report

When done, report in this shape:

```md
## Summary
- <what changed>

## Changed Files
- `<path>`: <change>

## Verification
- `<command>`: pass/fail
- `<manual check>`: pass/fail or not run with reason

## Deployment
- Staging/Internal build: <result or not run with reason>

## Notes
- <limitations, follow-up issues, open questions>
```
