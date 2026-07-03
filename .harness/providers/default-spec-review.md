# Provider: default-spec-review

## Phase

`spec.review`

## Behavior

Review `feature.spec.md` against the spec-review contract, applicable rulepack entries, and classification risk. For high-risk/high-ambiguity work, require stricter evidence and explicit approval before implementation.

## Output

Write `.harness/runs/<run-id>/artifacts/spec-review.md` with an explicit verdict.
