# Contract: review.request

## Purpose

Request human or automated review with enough context to evaluate the change.

## Inputs

- PR URL.
- Evaluation report.
- Ledger phase summary.

## Output

- Review request note or reviewer assignment recorded in ledger.

## Done conditions

- Review request points to canonical artifacts, not provider-private state.
- Required reviewers/checks are clear.
