# Feature Implementation Rule

Use for implementing a specific GitHub Issue or `docs/features/<id>.md` spec.

## Minimal reads

1. Target feature spec.
2. `.pi/rules/worktree.md` if a worktree must be created or selected.
3. Conditional rules only when the spec changes that area:
   - API/DB/domain schema: `.pi/rules/api-db.md`
   - Mobile UI: `.pi/rules/mobile-ui.md`
   - Tests/verification: `.pi/rules/testing.md`
   - Code structure concerns: `.pi/rules/code-quality.md`
   - Commit preparation: `.pi/rules/commit.md`

Do not read delivery/DoD/testing umbrella docs. Those rules live in `.pi/rules`.

Read `docs/decisions/` only when the feature changes or revisits product/technical/domain/API/DB/ops direction.

## Readiness gate

Stop and ask if:

- Required scope/API/DB/UI decisions are unresolved.
- Acceptance criteria are not testable.
- The user request conflicts with the spec.
- The feature appears too large for one PR and the user has not approved the scope.

## Implementation

- Implement only the approved spec.
- Keep vertical-slice behavior deployable across the touched layers.
- API changes start from OpenAPI.
- DB changes use goose migrations and sqlc regeneration when needed.
- Mobile uses generated API types/client when available.
- Update the feature spec if implementation reveals a spec mismatch.
- Add or update a decision record when a cross-feature decision changes.

## Verification

Run the smallest command set that covers changed behavior, then broader gates when needed. Record commands and results in the completion report.
