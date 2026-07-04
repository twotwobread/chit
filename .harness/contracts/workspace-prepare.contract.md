# Contract: workspace.prepare

## Purpose

Ensure feature-start work runs in the correct isolated workspace before any run artifacts, specs, plans, implementation files, or PR changes are written.

## Inputs

- User request or issue/spec identifier.
- Current git checkout state.
- `.harness/rules/core/worktree.md`.

## Output

No canonical run artifact is required before this phase completes. The phase output is the selected working directory and branch:

- Either an existing linked worktree under `.worktrees/*`.
- Or a newly created worktree from `.pi/bin/worktree-create`.

## Required behavior

- Do not write run artifacts, specs, plans, or implementation changes in the repository root checkout.
- Keep repository root on `develop` for sync/management only.
- Use `.pi/bin/worktree-create`; do not call `git worktree add` directly.
- If the repository root has working-tree changes, stop and ask before moving or overwriting anything.
- After entering the selected worktree, re-run:
  - `git status --short`
  - `git branch --show-current`
  - `git rev-parse --show-toplevel`

## Done conditions

- Current working directory is a linked worktree under repository root `.worktrees/*`.
- The selected branch is explicit.
- The repository root remains clean and on `develop`.
- No unrelated user changes were moved, overwritten, or discarded.
