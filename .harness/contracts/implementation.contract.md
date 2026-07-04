# Contract: implementation.execute

## Purpose

Implement the approved canonical spec or triaged small change.

## Inputs

- `.harness/runs/<run-id>/artifacts/feature.spec.md`.
- `.harness/runs/<run-id>/artifacts/implementation-plan.md`.
- Applicable implementation rules and source-of-truth files.

## Outputs

- Git diff in the selected worktree.
- Test/verification results recorded in `.harness/runs/<run-id>/artifacts/ledger.md` and/or `.harness/runs/<run-id>/artifacts/evaluation-report.md`.

## Done conditions

- Implementation stays inside approved scope.
- Changed behavior has automated regression coverage or an explicit documented gap.
- For bugfixes, at least one regression test maps to the reported reproduction path using Given/When/Then, or the run documents why no automated scenario test is practical.
- Adjacent hypothesis tests do not satisfy bugfix regression coverage unless they also cover the reported trigger and expected observable behavior.
- Generated code is regenerated with its source contract/schema change.
- No downstream phase needs provider-private files to evaluate the change.
