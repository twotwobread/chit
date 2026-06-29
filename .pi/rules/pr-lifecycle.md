
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/phase/pr-lifecycle.rules.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# PR Lifecycle Rule

Use when the user asks to create, update, inspect, or merge an existing PR/worktree. Do not treat this as feature implementation.

## Default reads

- `.github/pull_request_template.md` only when creating/updating a PR body.
- GitHub Issue/PR metadata through `gh` when needed.

Do not read by default:

- `docs/features/*` full bodies
- product/architecture/design docs
- delivery/DoD/testing docs

If PR metadata is missing, read only the top section of the feature spec with `offset`/`limit`.

## Required checks

1. Confirm target worktree path and branch.
2. Run `git status --short`.
3. Read `.harness/rules/core/commit.md` and confirm the commit stack is reviewable.
4. Confirm commits/diff are ready: `git log`, `git diff --stat`, or PR branch comparison.
5. Treat feature specs/plans plus implementation as one feature PR when they share the same feature branch; do not split them into separate PRs by default.
6. Check existing PR state before creating a new one.
7. Use `.github/pull_request_template.md` for PR descriptions.
8. Use title prefixes: `Feature-0000:`, `Fix:`, or `Docs:`.
9. Check CI/status before merge.
10. Merge only when requested and checks are acceptable.

## Branch cleanup

- Prefer repository-level GitHub auto-delete for merged PR head branches: `gh repo edit --delete-branch-on-merge`.
- Do not require `gh pr merge --delete-branch` as the default merge path; remote cleanup should not depend on the merge command used.
- Use `git config --global fetch.prune true` in agent/developer environments so deleted remote refs are pruned on fetch.
- After merge, clean up local worktrees and local branches when they are no longer needed.

## Output discipline

- Redirect long test/verify logs to a file.
- Show concise pass/fail summaries.
- On failure, show the failing command and the last relevant log lines only.

## Completion report

Include PR URL, merge result, CI/check result, and any skipped verification reason. Do not restate full feature specs.
