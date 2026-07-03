# Contract: change.classify

## Purpose

Create the intake triage artifact that decides whether the request is ready for implementation, needs technical investigation, needs clarification/spec work, needs product direction, or must be blocked.

This phase does **not** have to finalize `lightweight`, `normal`, or `strict`. A run starts with `tier: pending`; tier selection happens only after enough scope evidence exists.

## Inputs

- User request.
- Linked issue/spec when explicitly provided.
- Relevant error/log/reproduction detail when provided.
- Narrow repository facts needed to avoid misrouting.

Do not read broad docs, perform full root-cause analysis, or run heavyweight spec providers during triage.

## Output

`.harness/runs/<run-id>/artifacts/classification.yaml`

Required fields:

```yaml
schema_version: classification.v1
type: feature | bugfix | refactor | docs | deploy | investigation
route: pending | ready_for_lightweight_investigation | ready_for_implementation | needs_clarification | needs_investigation | needs_product_direction | blocked
size: unknown | small | normal | large | epic
ambiguity: unknown | low | medium | high
risk: unknown | low | medium | high | critical
testability: unknown | low | medium | high
architecture_impact: unknown | local | cross-module | cross-service
domain_sensitivity: none | auth | privacy | billing | audit-log | security | data-migration
product_direction_unclear: false
implementation_requires_exploration: false
ready_for_implementation: false
likely_tier: pending | lightweight | normal | strict
next_phase: intake.triage | investigation.localize | spec.author | implementation.execute | blocked
knowns: []
unknowns: []
blocking_questions: []
risk_signals: []
rationale: <short evidence-backed explanation>
```

## Route guidance

- Use `ready_for_lightweight_investigation` when expected behavior is clear but the cause is unknown and the risk appears local/low.
- Use `ready_for_implementation` when behavior, acceptance, and likely scope are clear enough to implement.
- Use `needs_clarification` when expected behavior, acceptance, target surface, or scope cannot be judged safely.
- Use `needs_product_direction` when product/domain/UX policy must be decided before implementation.
- Use `blocked` when required information remains unavailable or source-of-truth conflicts cannot be resolved.

## Done conditions

- The route is explicit and evidence-backed.
- Unknowns remain `unknown`; they are not converted into guesses.
- If scope is not clear enough, the output records focused blocking questions or a blocked reason.
- Provider/tier policy inputs are present when enough evidence exists.
- The next phase can proceed without reading provider-private state.
