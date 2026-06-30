# Feature Slice: F-168 Expense participant fallback policy

## Metadata

- GitHub Issue: #168
- Status: Implemented
- Created: 2026-06-30
- Updated: 2026-06-30

## Source

- Issue: #168 — [[Follow-up] Define expense participant fallback policy](https://github.com/twotwobread/i-um/issues/168)
- Related: F-153 expense anchor display model / PR #167
- Canonical spec: `.harness/runs/20260630-1239-f168-expense-participant-fallback/feature.spec.yaml`

## Goal

When an expense payer or split participant becomes unresolved because a trip member is removed, expense history should keep a readable participant display name that reflects the latest live name at the moment of removal.

## Policy

- Use the same policy for payer and split participants.
- Before removing a member participant, refresh existing expense fallback snapshots from the latest live `trip_participants.display_name`:
  - `expenses.payer_display_name`
  - `expense_splits.participant_display_name`
- After removal, expense responses still resolve those participant displays as fallback:
  - `source = fallback`
  - `participantId = null`
- Unaffected participants continue to resolve live.
- This is prospective only. Already-unresolved historical expense snapshots are not backfilled.
- Account deletion/anonymization policy is out of scope for this slice.

## Scope

### In

- Trip member removal storage behavior.
- Expense payer/split fallback display snapshots.
- API/storage regression tests for rename-then-remove fallback behavior.

### Out

- OpenAPI schema changes.
- DB schema migrations or historical data backfill.
- Mobile UI changes.
- Expense edit/delete UI/API changes.
- Account-erasure anonymization or privacy-retention policy changes.
- Removing fallback snapshot columns.

## Acceptance Criteria

- [x] AC-01: F-168 documents the chosen latest-live-before-removal fallback policy.
- [x] AC-02: Removing a member who is an expense payer refreshes `expenses.payer_display_name` to the member's latest live display name before deletion.
- [x] AC-03: Removing a member who appears in expense splits refreshes `expense_splits.participant_display_name` to the member's latest live display name before deletion.
- [x] AC-04: After removal, affected payer and split participant displays resolve as `source = fallback` with no live participant id.
- [x] AC-05: Unaffected live participants continue to resolve as `source = live` with participant ids.
- [x] AC-06: Existing authorization/removal rules remain unchanged.
- [x] AC-07: The change is prospective only; no historical backfill is performed.
- [x] AC-08: API contract, DB schema, generated OpenAPI/TS artifacts, and mobile UI remain unchanged.

## Verification Plan

- `pnpm verify:generated`
- `pnpm --filter @i-um/api test`
- `pnpm --filter @i-um/api build`
- `pnpm lint`
- `pnpm format:check`
- `git diff --check`
- `pnpm verify`

## Manual Smoke

Not required for this API/storage-only policy slice. Optional smoke: remove a renamed member who paid/split an expense and confirm the expense list still shows the renamed participant as a readable fallback display.
