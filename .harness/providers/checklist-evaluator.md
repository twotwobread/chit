# Provider: checklist-evaluator

## Phase

`evaluation.checklist`

## Behavior

Evaluate the git diff against the canonical spec, acceptance criteria, applicable rules, and verification evidence.

## Checklist

- Spec scope covered.
- Out-of-scope items not implemented.
- Tests or explicit regression gaps recorded.
- API/DB/mobile source-of-truth rules followed when touched.
- Secret/log safety preserved.
- Generated artifacts updated with source changes.
- PR readiness checks satisfied.

## Output

Write `.harness/runs/<run-id>/artifacts/evaluation-report.md` with `Passed`, `Failed`, or `Blocked`.
