# Provider: default-change-classifier

## Phase

`change.classify`

## Contract

`.harness/contracts/change-classify.contract.md`

## Behavior

Use the user request, linked issue/spec, and narrow repository facts to classify the work. Do not run heavyweight product/spec tools during initial classification unless the request itself is for that tool.

## Output

Write `.harness/runs/<run-id>/classification.yaml` with all provider-policy inputs populated.
