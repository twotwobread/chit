# Task Triage Rule

Use when the user asks to implement, fix, debug, or resolve an issue and did not explicitly ask to create or revise a feature spec/plan. User-provided labels such as `bug`, `feature`, or `simple` are hints, not authority.

## Goal

Decide the next route with minimal evidence:

- `ready_for_lightweight_investigation`
- `ready_for_implementation`
- `needs_clarification`
- `needs_investigation`
- `needs_product_direction`
- `blocked`

Do not finalize `lightweight`, `normal`, or `strict` until enough scope evidence exists.

## Actual triage actions

1. Capture the request or issue text in the active run.
2. Extract known expected behavior, actual behavior, target surface, and stated acceptance criteria.
3. Inspect only narrow repo evidence needed to route the task:
   - linked spec/issue if provided,
   - relevant error/log/reproduction detail,
   - targeted `rg` searches for named screens/components/API endpoints,
   - small source snippets needed to confirm whether the request is local, cross-layer, or source-of-truth-changing.
4. Do not perform full root-cause analysis, broad documentation reading, or code modification during triage.
5. Do not use web research by default. Use it only when an external library/API behavior is directly relevant and local evidence is insufficient.
6. Ask the user only when expected behavior, target surface, acceptance criteria, or product/domain/UX policy cannot be inferred safely from request + narrow repo evidence.
7. If focused questions still do not make the scope safe, mark the route `blocked` or propose a smaller explicit safe scope for approval.

## Light triage budget

- Inspect only the request, linked issue, existing linked spec/labels, relevant error/log, and narrow code/contract snippets needed to classify the work.
- Do not read broad docs or run heavyweight spec providers during triage.
- Prefer evidence over labels; treat `bug` vs `feature` as a hypothesis.
- State assumptions when they affect the route.

## No-spec fast path

Proceed without a feature spec only when all are true:

- Desired behavior is already clear from the user request, existing contract/spec/code, or an obvious regression.
- The change is small and local enough for a focused PR.
- No new product, domain, UX policy, API contract, DB schema, data migration, auth/permission, or cross-feature decision is needed.
- Acceptance can be verified with a focused test, reproduction check, or smoke test.
- The request does not conflict with an existing source of truth.

## Technical investigation path

Use this when expected behavior is clear but the cause or implementation is not.

- Share a short investigation plan or working hypothesis.
- Keep context narrow and continue debugging.
- Do not escalate to a spec solely because the code is hard; escalate when difficulty creates behavior/scope ambiguity or high coordination risk.

## Clarification/spec path

Use this when the request does not define implementable behavior.

Examples:

- `여행 생성 UX를 개선해줘` → ask what target behavior and success criteria are desired.
- `가끔 여행 생성이 안 돼` without reproduction → ask for repro details or route to investigation-only.
- A request conflicts with existing specs/contracts → block until the conflict is resolved.

Clarification can still return to a lightweight path if the clarified scope is small and low-risk.

## Spec escalation triggers

Stop and recommend a `.harness` provider-policy-backed feature spec/plan when any trigger appears:

- Correct behavior is unclear or requires a product/domain/UX decision.
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
- If the user approves, continue with the `.harness/workflows/feature-start.yml` spec phases in the appropriate worktree; `.harness/policies/default.yml` chooses the provider.
- If the user declines, narrow the scope, record assumptions/risks, and avoid product/domain decisions beyond the approved scope.

## Re-triage during work

Re-run the triage decision when new facts invalidate the original route. If a fast-path fix starts requiring a source-of-truth change or product decision, pause and escalate before continuing.
