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
3. Read `.pi/rules/commit.md` and confirm the commit stack is reviewable.
4. Confirm commits/diff are ready: `git log`, `git diff --stat`, or PR branch comparison.
5. Check existing PR state before creating a new one.
6. Use `.github/pull_request_template.md` for PR descriptions.
7. Use title prefixes: `Feature-0000:`, `Fix:`, or `Docs:`.
8. Check CI/status before merge.
9. Merge only when requested and checks are acceptable.

## Output discipline

- Redirect long test/verify logs to a file.
- Show concise pass/fail summaries.
- On failure, show the failing command and the last relevant log lines only.

## Completion report

Include PR URL, merge result, CI/check result, and any skipped verification reason. Do not restate full feature specs.
