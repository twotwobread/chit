# Contract: spec.review

## Purpose

Verify that the canonical spec is safe to implement.

## Inputs

- `.harness/runs/<run-id>/artifacts/classification.yaml`.
- `.harness/runs/<run-id>/artifacts/feature.spec.md`.
- Applicable phase and risk rules.

## Output

`.harness/runs/<run-id>/artifacts/spec-review.md`

Required sections:

```md
# Spec Review

## Verdict
Approved | Changes requested | Blocked

## Findings
- <finding>

## Required changes before implementation
- <change or None>

## Provider notes
- <provider, reason, relevant source ids>
```

## Done conditions

- Verdict is explicit.
- Required changes are actionable.
- Implementation does not proceed when verdict is `Blocked` or unresolved required changes remain.
