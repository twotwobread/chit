# Worktree Rule

Use when creating or selecting a worktree for feature/doc PR work.

## Rules

- Use `.pi/bin/worktree-create`; do not call `git worktree add` directly.
- One worktree per PR/MR.
- Worktrees must live under repository root `.worktrees/`.
- Do not create sibling-directory worktrees.
- Do not remove worktrees with uncommitted changes, open PR/MR, or unknown PR/MR state.
- Keep the repository root on `develop`; feature/doc branches belong in `.worktrees/*`.

## Standard commands

Feature work:

```bash
.pi/bin/worktree-create F042 short-name
```

Docs/process work:

```bash
.pi/bin/worktree-create docs short-name \
  --branch docs/short-name \
  --path docs-short-name
```

After creation, continue all edits and verification inside that worktree.
