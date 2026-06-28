# Worktree Rule

Use when creating or selecting a worktree for feature/doc/issue PR work. Feature spec/plan drafting counts as feature work; triaged bugfix/small implementation PRs use the same worktree policy.

## Rules

- Use `.pi/bin/worktree-create`; do not call `git worktree add` directly.
- One worktree per PR/MR.
- A feature PR contains its `docs/features/*` spec/plan and implementation on the same branch.
- Do not create a separate docs/spec branch for a feature spec unless the user explicitly requests a docs-only PR.
- Worktrees must live under repository root `.worktrees/`.
- Do not create sibling-directory worktrees.
- Do not remove worktrees with uncommitted changes, open PR/MR, or unknown PR/MR state.
- Keep the repository root on `develop`; use it for sync/management only.
- Feature/doc branches belong in `.worktrees/*`; resolve rebase/conflicts inside the feature worktree.

## Standard commands

Feature or issue work, including spec/plan first:

```bash
.pi/bin/worktree-create F042 short-name
```

Docs/process work only, not feature specs:

```bash
.pi/bin/worktree-create docs short-name \
  --branch docs/short-name \
  --path docs-short-name
```

After creation, continue all edits and verification inside that worktree.
