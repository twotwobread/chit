# Contract: pr.create

## Purpose

Create or update a reviewable PR only after required checks pass.

## Inputs

- Git diff and commit stack.
- `.harness/runs/<run-id>/artifacts/feature.spec.md` when feature work exists.
- `.harness/runs/<run-id>/artifacts/evaluation-report.md`.
- PR template when present.

## Output

- PR URL recorded in `.harness/runs/<run-id>/artifacts/ledger.md`.

## Done conditions

- PR title/body summarize scope and verification.
- For bugfixes, the PR body includes a User Scenario Verification summary or explicitly states why it is not applicable.
- Known gaps and risks are explicit.
- Blocking evaluation failures are resolved or user-accepted.
