# Contract: change.classify

## Purpose

Classify the request so the workflow can choose rulepacks, provider policies, gates, and artifact depth.

## Inputs

- User request.
- Linked issue/spec when explicitly provided.
- Narrow repository facts needed to avoid misclassification.

## Output

`.harness/runs/<run-id>/classification.yaml`

Required fields:

```yaml
type: feature | bugfix | refactor | docs | deploy | investigation
size: small | normal | large | epic
ambiguity: low | medium | high
risk: low | medium | high | critical
testability: low | medium | high
architecture_impact: local | cross-module | cross-service
domain_sensitivity: []
product_direction_unclear: false
implementation_requires_exploration: false
recommended_workflow_tier: small_tdd | normal | full_ouroboros_loop
notes: []
```

## Done conditions

- The classification records evidence, not just labels.
- Provider policy inputs are present.
- Blocking ambiguity is surfaced before implementation.
