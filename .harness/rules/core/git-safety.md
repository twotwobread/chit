# Git Safety

- Inspect `git status --short` before editing.
- Do not overwrite unrelated user changes.
- Use one worktree per PR/MR.
- Keep the repository root on `develop` for sync/management when using feature worktrees.
- Feature PRs should contain their spec/plan and implementation on the same branch by default.
- Do not remove worktrees with uncommitted changes, open PRs, or unknown PR state.
- Before committing or PR creation, inspect the commit stack and diff stat.
- Prefer small logical commits; do not split mechanically by file.
