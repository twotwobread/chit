# Provider: worktree-isolation

## Phase

`workspace.prepare`

## Behavior

Prepare or verify the local workspace for feature-start work.

1. Inspect git state with `git status --short`, `git branch --show-current`, and `git rev-parse --show-toplevel`.
2. If already inside a linked worktree under repository root `.worktrees/*`, continue there.
3. If in the repository root checkout, create or select a feature worktree using `.pi/bin/worktree-create`.
4. Do not use `git worktree add` directly.
5. Stop and ask before moving or overwriting any root checkout changes.
6. Run `node .harness/scripts/check-worktree-isolation.mjs --repo-root .` inside the selected worktree before implementation or PR creation.

## Output

No provider-private state is required. Record the selected worktree path and branch in the run ledger once a run envelope exists.
