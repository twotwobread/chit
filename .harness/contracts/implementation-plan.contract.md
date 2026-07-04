# Contract: implementation.plan

## Purpose

Turn the canonical spec into an execution plan without binding downstream phases to a provider's private state.

## Inputs

- `.harness/runs/<run-id>/artifacts/feature.spec.md`.
- `.harness/runs/<run-id>/artifacts/spec-review.md` when required by workflow tier.
- Relevant source-of-truth files for API, DB, mobile, or tests.

## Output

`.harness/runs/<run-id>/artifacts/implementation-plan.md`

Required sections:

```md
# Implementation Plan

## Scope
## Files likely to change
## Test-first plan
## Steps
## Verification
## Risks / rollback
```

## Done conditions

- Plan traces back to acceptance criteria.
- API changes start from OpenAPI; DB changes start from migrations.
- Testable changes identify the first failing test or explicit regression gap.
- For bugfixes, the first failing test is derived from the reported reproduction path:
  - Given `<reported input/state>`
  - When `<reported user action or system trigger>`
  - Then `<expected observable behavior>`
