# Contract: evaluation.checklist

## Purpose

Evaluate the final diff against the canonical spec, project rules, and verification evidence.

## Inputs

- `.harness/runs/<run-id>/artifacts/classification.yaml`.
- `.harness/runs/<run-id>/artifacts/feature.spec.md`.
- Git diff/stat.
- Test and verification command results.
- Applicable phase/risk rules.

## Output

`.harness/runs/<run-id>/artifacts/evaluation-report.md`

Required sections:

```md
# Evaluation Report

## Verdict
Passed | Failed | Blocked

## Spec coverage
## Test evidence
## Rule/gate evidence
## Regression gaps
## Manual smoke / deploy
## Risks
```

## Done conditions

- Verdict is explicit.
- Failures or blocked items prevent PR creation unless the user explicitly accepts the risk.
- Verification commands are summarized without long logs or secrets.
