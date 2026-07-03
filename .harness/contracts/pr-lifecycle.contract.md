# Contract: pr-lifecycle

## Purpose

Create, update, inspect, merge, or clean up an existing PR/worktree without reopening feature implementation scope.

## Inputs

- Worktree/branch and PR/issue identifier when provided.
- Git diff and commit stack.
- PR template when creating/updating a PR body.
- `.harness/policies/rulepacks/pr-lifecycle.yml`.

## Outputs

- PR URL/status or merge/cleanup result.
- Completion report with CI/check status and skipped verification reasons.

## Done conditions

- Target worktree/branch is explicit.
- Commit stack and diff are reviewable.
- PR body summarizes scope, verification, gaps, and risks.
- Merge happens only when requested and checks are acceptable or accepted risk is explicit.
