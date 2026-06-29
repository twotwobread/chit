
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/phase/task-triage.rules.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Task Triage Rule

Use when the user asks to implement, fix, debug, or resolve an issue and did not explicitly ask to create or revise a feature spec/plan. Use this because user-provided labels such as “bug”, “feature”, or “simple” can be wrong.

## Routing priority

1. Explicit spec/plan request wins.
   - If the user asks to “write/draft/update a spec”, “make a plan”, or create/update `docs/features/*`, use `i-um-feature-spec-plan`.
   - If the target looks small enough for a no-spec fix, mention that option, but do not switch away from the requested spec flow unless the user agrees.
2. Explicit implementation/fix/debug request gets light triage first.
   - Inspect enough context to decide between no-spec fast path, short technical investigation, or spec escalation.
3. PR, deploy, and docs-process requests use their dedicated skills/rules instead of this rule.

## Light triage budget

- Inspect only the request, linked issue, existing linked spec/labels, relevant error/log, and narrow code/contract snippets needed to classify the work.
- Do not read broad docs or run heavyweight spec providers during triage.
- Prefer evidence over labels; treat “bug vs feature” as a hypothesis, not a source of truth.
- State assumptions when they affect the route.

## No-spec fast path

Proceed without a feature spec only when all are true:

- Desired behavior is already clear from the user request, existing contract/spec/code, or an obvious regression.
- The change is small and local enough for a focused PR.
- No new product, domain, UX policy, API contract, DB schema, data migration, auth/permission, or cross-feature decision is needed.
- Acceptance can be verified with a focused test, reproduction check, or smoke test.
- The request does not conflict with an existing source of truth.

## Technical investigation path

Use this when the expected behavior is clear but the cause or implementation is not.

- Share a short investigation plan or working hypothesis.
- Keep context narrow and continue debugging.
- Do not escalate to a spec solely because the code is hard; escalate when the difficulty creates behavior/scope ambiguity or high coordination risk.

## Spec escalation triggers

Stop and recommend a `.harness` provider-policy-backed feature spec/plan when any trigger appears:

- “Correct” behavior is unclear or requires a product/domain/UX decision.
- The work adds a new capability or materially changes existing behavior rather than restoring already-defined behavior.
- The fix needs API contract, DB schema/data migration, auth/permission, or core cross-layer behavior changes.
- Acceptance criteria, rollout/backfill, or compatibility expectations are not defined.
- Multiple clients/layers must coordinate and the failure impact is high.
- The scope is likely larger than one small PR or risks breaking unrelated flows.
- The request conflicts with existing specs, decisions, or contracts.
- The issue is labeled/marked `needs-spec` or explicitly asks for a feature spec/plan.

## Escalation behavior

- Do not silently switch to the heavy flow.
- Pause before implementation, summarize the evidence, explain why no-spec is risky, and ask whether to use `i-um-feature-spec-plan`.
- If the user approves, continue with the `.harness/workflows/feature-start.yml` spec phases in the appropriate worktree; the workflow policy chooses the provider.
- If the user declines, narrow the scope, record assumptions/risks, and avoid product/domain decisions beyond the approved scope.

## Re-triage during work

Re-run the triage decision when new facts invalidate the original route. If a fast-path fix starts requiring a source-of-truth change or product decision, pause and escalate before continuing.
