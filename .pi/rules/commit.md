
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/core/commit.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Commit Rule

Use before committing or creating a PR.

## Goal

Make review and rollback easy with small logical commits.

## Rules

- Do not default to one commit per PR.
- Create one commit per logical change.
- Keep each commit reviewable on its own.
- Do not split mechanically by file when one behavior needs multiple files.
- Keep generated artifacts in the same commit as the source contract/schema change that produced them.
- Do not mix unrelated refactors, docs cleanup, feature behavior, and tooling moves in one commit.
- If a commit would be hard to summarize in one sentence, split it.
- If a PR already has a large mixed commit and the PR is not merged, prefer rewriting it into smaller commits with `--force-with-lease`.

## Good commit units

- Draft or update one feature spec/plan.
- Implement one vertical feature slice from an approved spec.
- Add or update one task rule.
- Add one workflow skill.
- Move one helper script family.
- Replace one documentation category with its new home.
- Update stale references after a move.

## PR check

Before PR creation, inspect:

```bash
git log --oneline origin/develop..HEAD
git diff --stat origin/develop..HEAD
```

If the stack is not reviewable, split commits before opening or updating the PR.
