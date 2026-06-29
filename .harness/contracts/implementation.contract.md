# Contract: implementation.execute

## Purpose

Implement the approved canonical spec or triaged small change.

## Inputs

- `.harness/runs/<run-id>/feature.spec.yaml`.
- `.harness/runs/<run-id>/implementation-plan.md`.
- Applicable implementation rules and source-of-truth files.

## Outputs

- Git diff in the selected worktree.
- Test/verification results recorded in `.harness/runs/<run-id>/ledger.md` and/or `.harness/runs/<run-id>/evaluation-report.md`.

## Done conditions

- Implementation stays inside approved scope.
- Changed behavior has automated regression coverage or an explicit documented gap.
- Generated code is regenerated with its source contract/schema change.
- No downstream phase needs provider-private files to evaluate the change.
