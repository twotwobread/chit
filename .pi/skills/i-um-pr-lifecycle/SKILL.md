---
name: i-um-pr-lifecycle
description: Create, update, check, or merge an existing i-um PR/worktree with minimal context. Use when the user asks to make a PR, check CI, merge, close, or clean up a PR branch/worktree.
---

# i-um PR Lifecycle

Use for PR-only tasks on an existing implementation/worktree. This is not feature implementation.

## Minimal reads

1. `.pi/rules/pr-lifecycle.md`.
2. `.pi/rules/commit.md` before committing or creating/updating a PR.
3. `.github/pull_request_template.md` only when creating or updating a PR body.
4. `.pi/rules/completion-report.md` before final response.

Do not read feature specs, delivery docs, product docs, architecture docs, or design docs unless PR metadata is missing. If a feature spec is needed, read only the top section with `offset`/`limit`.

## Procedure

1. Identify target
   - Confirm worktree path, branch, issue/PR number if provided.
   - `git -C <worktree> status --short`
   - `git -C <worktree> branch --show-current`

2. Inspect readiness
   - Check commit stack: `git log --oneline origin/develop..HEAD`.
   - Check diff: `git diff --stat origin/develop..HEAD` or branch comparison.
   - Split large mixed commits before PR creation/update when practical.
   - Check existing PR: `gh pr status`, `gh pr view`, or `gh pr list`.

3. Create/update PR when requested
   - Use `.github/pull_request_template.md`.
   - Keep body concise; include verification summaries, not full logs.
   - Use title prefix `Feature-0000:`, `Fix:`, or `Docs:`.

4. Check CI
   - Prefer concise `gh pr checks` / `gh run view` summaries.
   - Do not paste full CI logs unless diagnosing a failure.

5. Merge when requested
   - Merge only if checks are acceptable or the user explicitly accepts the risk.
   - Confirm merge result and PR state.

6. Final report
   - PR URL
   - CI/check status
   - Merge result
   - Any skipped verification or blocker
