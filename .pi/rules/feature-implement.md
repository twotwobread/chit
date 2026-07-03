
<!--
GENERATED FILE. DO NOT EDIT.

Source:
.harness/rules/phase/feature-implement.rules.md

To modify this adapter:
edit the source file, then run:
pnpm harness:sync
-->

# Feature / Issue Implementation Rule

Use for implementing an approved `docs/features/<id>.md` spec or a triaged no-spec issue/bug fix. Do not use this rule to create or substantially revise a feature spec/plan.

## Minimal reads

1. `.harness/rules/phase/task-triage.rules.md` when no approved spec already defines the work, or when the user/issue classification may be wrong.
2. Target feature spec when present.
3. `.harness/rules/core/worktree.md` if a worktree must be created or selected.
4. Conditional rules only when the spec or triaged scope changes that area:
   - API/DB/domain schema: `.harness/rules/code/api-db.md`
   - Mobile UI: `.harness/rules/code/mobile-ui.md`
   - Tests/verification: `.harness/rules/code/testing.md`
   - Code structure concerns: `.harness/rules/code/code-quality.md`
   - Commit preparation: `.harness/rules/core/commit.md`

Do not read delivery/DoD/testing umbrella docs. Those rules live in `.harness/rules`.

Read `docs/decisions/` only when the work changes or revisits product/technical/domain/API/DB/ops direction.

## Readiness gate

Stop and ask, or recommend `i-um-feature-spec-plan`, if:

- Required scope/API/DB/UI decisions are unresolved.
- Acceptance criteria are not testable.
- The user request conflicts with the spec, contract, or decision record.
- A no-spec fix starts requiring product/domain/UX decisions or source-of-truth changes.
- The work appears too large for one focused PR and the user has not approved the scope.

## Implementation

- Implement only the approved spec or the explicitly triaged no-spec scope.
- Continue in the same feature/issue worktree/branch where the spec/plan or fix was started when it is unmerged.
- Keep the feature spec/plan and implementation in one feature PR by default; do not create a separate implementation branch unless the user requests it.
- Keep vertical-slice behavior deployable across the touched layers.
- API changes start from OpenAPI.
- DB changes use goose migrations and sqlc regeneration when needed.
- Mobile uses generated API types/client when available.
- Update the feature spec if implementation reveals a spec mismatch; if no spec exists, pause and escalate before making product/domain source-of-truth changes.
- Add or update a decision record when a cross-feature decision changes.

## Verification

Run the smallest command set that covers changed behavior, then broader checks when needed. Record commands and results in the completion report.
