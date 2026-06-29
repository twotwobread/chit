# Contract: spec.author

## Purpose

Create the canonical implementation-ready feature spec for the current run.

## Inputs

- User request and linked issue/spec when present.
- `.harness/runs/<run-id>/classification.yaml`.
- Applicable rulepack entries for `spec.author`.
- Existing source-of-truth files only when needed to verify facts.

## Output

`.harness/runs/<run-id>/feature.spec.yaml`

Minimum fields:

```yaml
schema_version: feature-spec.v1
id: <stable feature or run identifier>
title: <short title>
status: draft | review | approved
summary: <what changes and why>
scope:
  in: []
  out: []
acceptance_criteria: []
implementation_notes: []
api_changes: []
db_changes: []
mobile_changes: []
test_plan: []
open_questions: []
provider:
  name: <provider-name>
  evidence: []
```

## Done conditions

- Downstream phases can implement from `feature.spec.yaml` without reading provider-private state.
- Product/domain/UX unknowns remain in `open_questions`; they are not converted into guesses.
- High-risk or high-ambiguity specs record the clarification/seed source used by the provider.
- Small specs may be concise, but must still include acceptance criteria and test plan.
