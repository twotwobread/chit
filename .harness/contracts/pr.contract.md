# Contract: pr.create

## Purpose

Create or update a reviewable PR only after required gates pass.

## Inputs

- Git diff and commit stack.
- `.harness/runs/<run-id>/feature.spec.yaml` when feature work exists.
- `.harness/runs/<run-id>/evaluation-report.md`.
- PR template when present.

## Output

- PR URL recorded in `.harness/runs/<run-id>/ledger.md`.

## Done conditions

- PR title/body summarize scope and verification.
- Known gaps and risks are explicit.
- Blocking evaluation failures are resolved or user-accepted.
