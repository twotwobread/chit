# Feature Slice: F-048 결제자 선택

## Metadata

- GitHub Issue: #48
- Status: Spec Review
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #48 — [[Feature Slice] F-048 결제자 선택](https://github.com/twotwobread/i-um/issues/48)
- Covered by: #47 / `docs/features/0047-quick-expense-create.md`
- Ouroboros/PM/Seed: Interview `interview_20260625_134414`, Seed `seed_2c74e1723b01` (MCP generated; file path not provided)
- Ambiguity Score: `0.088`
- Notes:
  - User clarified that F-048's functional scope is already included in F-047 quick expense.
  - F-048 must not introduce new product, API, DB, or mobile UI behavior.
  - This document records the overlap, verification plan, and issue cleanup criteria for closing F-048 as covered by F-047 after verification.

## Goal

여행 참여자 중 결제자를 선택하는 기능이 F-047 빠른 지출 등록 흐름에서 이미 제공됨을 명확히 기록한다.

F-048은 신규 구현 slice가 아니라, 기존 quick expense 결제자 선택 동작을 확인하고 검증 완료 후 이슈를 `covered by F-047`로 정리하기 위한 문서/검증 slice다.

## User Flow

### Existing quick expense payer selection

1. 사용자가 빠른 지출 화면(`/trips/{tripId}/days/{date}/expenses/quick`)을 연다.
2. 앱은 여행 상세, 해당 Day itinerary, 여행 참여자 목록을 불러온다.
3. 빠른 지출 화면은 `결제자` 섹션에 여행 참여자를 선택 가능한 chip/button 목록으로 보여준다.
   - 현재 구현은 드롭다운이 아니다.
   - 참여자가 1명뿐이면 해당 참여자가 자동 선택된다.
   - 참여자가 2명 이상이면 사용자가 직접 결제자를 선택한다.
4. 사용자가 결제자를 선택하면 선택 상태가 표시되고 `payerParticipantId`가 form state에 저장된다.
5. 금액, 장소, 결제자가 모두 유효하면 `저장하기`가 가능해진다.
6. 저장 요청은 `payerParticipantId`를 포함해 `POST /trips/{tripId}/days/{date}/expenses/quick`로 전송된다.
7. 서버는 결제자가 같은 여행의 참여자인지 검증하고, 응답에 `payerParticipantId`와 `payerDisplayName` snapshot을 포함한다.

## Scope

- App UI: No new UI
  - Existing covered path: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
  - Existing helper: `apps/mobile/lib/trips/quick-expense.ts`
  - F-048 does not convert the chip/button selector to a dropdown, bottom sheet, or reusable component.
- API Contract: No API changes
  - Existing covered endpoint: `POST /trips/{tripId}/days/{date}/expenses/quick`
  - Existing request field: `payerParticipantId`
- API Server: No server changes
  - Existing covered service/handler validate `payerParticipantId` and trip participation.
- DB: No DB changes
  - Existing `expenses.payer_participant_id` / `payer_display_name` behavior is owned by F-047.
- Tests: Verification only
  - Confirm existing F-047 tests/checks cover payer option construction, missing-payer validation, request payload, handler response, and missing payer rejection.
  - Do not add new F-048 test-code scope unless a separate follow-up is created.
- Deploy/Smoke: Needed before closing #48
  - Close #48 only after existing payer-selection tests/checks and manual smoke are confirmed.

## Out of Scope

- New payer selector UX such as dropdown, searchable picker, bottom sheet, or modal.
- Reusable payer selector component extraction for future expense/settlement flows.
- General expense create/edit screens outside quick expense.
- Manual split participant selection, custom split ratios, settlement confirmation, or payment transfer.
- API contract changes, DB migrations, generated code updates, or server behavior changes.
- New automated tests as part of F-048; uncovered gaps should be recorded as follow-up work.

## Requirements

### UI / UX

No new UI requirements are added by F-048.

Existing F-047 behavior to verify:

- Screen: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
- Label: `결제자`
- Selector presentation: participant chip/button list, not dropdown
- Option source: current trip participants returned by `listTripParticipants(tripId)`
- Selection behavior:
  - selecting a participant stores that participant's `participantId` as `payerParticipantId`;
  - selected option exposes selected visual/accessibility state;
  - missing payer blocks submission with `결제자를 선택해주세요.`;
  - one-participant trips may preselect the sole participant.
- Submit behavior:
  - `저장하기` remains disabled until amount, place, and payer are valid;
  - success shows existing quick expense success messaging.

### API Contract

No API changes.

Existing F-047 contract already requires a payer:

```text
POST /trips/{tripId}/days/{date}/expenses/quick
```

Existing `CreateQuickExpenseRequest` fields:

```yaml
required:
  - itineraryItemId
  - amountMinor
  - payerParticipantId
```

Existing `Expense` response includes:

```yaml
payerParticipantId
payerDisplayName
```

### DB Changes

No DB changes.

F-047 owns expense persistence. F-048 does not add or alter tables, constraints, indexes, sqlc queries, migrations, or generated DB code.

### Business Rules

- F-048 is closed as covered-by only if the existing F-047 quick expense flow demonstrably lets the user choose a payer from trip participants.
- The selected payer is represented by `payerParticipantId`.
- The server must reject nonexistent or out-of-trip payer participants through the existing quick expense validation path.
- F-048 does not redefine the selector as a dropdown; the existing chip/button list is acceptable coverage for “여행 참여자 중 결제자를 선택한다.”
- If verification finds a missing regression test or UX concern, record it as a regression gap/follow-up instead of expanding F-048 scope.

## Acceptance Criteria

- [ ] AC-01: This feature spec and verification plan exist at `docs/features/0048-select-expense-payer.md`.
- [ ] AC-02: The spec states that F-048 has no new implementation scope and is functionally covered by F-047 quick expense.
- [ ] AC-03: Existing mobile helper behavior builds payer options from trip participants and validates missing payer with `결제자를 선택해주세요.`.
- [ ] AC-04: Existing quick expense UI shows a `결제자` participant chip/button list and records the selected participant as `payerParticipantId`.
- [ ] AC-05: Existing OpenAPI contract requires `payerParticipantId` in `CreateQuickExpenseRequest` and returns payer snapshot fields in `Expense`.
- [ ] AC-06: Existing API/server tests confirm happy-path payer snapshot and missing payer rejection.
- [ ] AC-07: Manual smoke confirms a user can select a trip participant as payer and save a quick expense in an internal build or staging-connected app.
- [ ] AC-08: #48 is not closed until AC-03 through AC-07 are confirmed.
- [ ] AC-09: After verification, #48 is commented/closed as covered by #47 with no new product/API/DB/mobile behavior.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Payer options are built from trip participants; missing payer produces `결제자를 선택해주세요.`; request includes `payerParticipantId` | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Quick expense route compiles with participant loading, chip selection state, and request payload types | Mobile typecheck | `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx` | `pnpm --filter @i-um/mobile typecheck` |
| OpenAPI requires `payerParticipantId` and generated client/server types stay in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated outputs | `pnpm verify:generated` |
| Handler response stores/returns payer snapshot and rejects missing payer | API handler/service | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Quick expense payer selection works in the app | Manual smoke | Internal build or staging-connected app | See Manual Smoke checklist |

## Regression Gaps

- React Native route-level interaction for tapping payer chips is not covered by an automated UI/E2E test in F-048.
  - Risk: helper/API tests could pass while a future UI refactor breaks the visible chip selection interaction.
  - Follow-up: if this risk becomes unacceptable, create a separate mobile UI test/e2e hardening issue instead of expanding F-048.
- Multi-participant visual design is currently a chip/button list, not a dropdown.
  - Risk: if product later expects a dropdown specifically, current coverage will not satisfy that new UX requirement.
  - Follow-up: create a new feature slice for dropdown/bottom-sheet/reusable payer selector UX.

## TDD Implementation Plan

F-048 has no new code implementation. The TDD plan is therefore verification-centered and must not create new product/API/DB/mobile behavior.

1. Red: Confirm expected payer-selection coverage points before closing #48.
   - Check that existing mobile helper tests cover payer option construction, missing-payer validation, and payload creation.
   - Check that existing API tests cover payer snapshot success and missing payer rejection.
   - Verify: `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/api test`
2. Green: If existing checks pass, record F-048 as covered by F-047.
   - No code changes.
   - No OpenAPI, migration, generated code, mobile UI, or server changes.
   - Verify: `pnpm verify:generated`, `pnpm --filter @i-um/mobile typecheck`
3. Refactor: Documentation and issue cleanup only.
   - Keep F-047 as the source of truth for quick expense payer-selection behavior.
   - Comment on #48 that the scope is covered by #47 and link to this spec plus verification evidence.
   - Close #48 only after manual smoke is complete.
4. Gate: Final verification before #48 closure.
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - `pnpm --filter @i-um/api test`
   - `pnpm verify:generated`
   - Manual smoke checklist below

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: Pass (prepared worktree dependencies; log `.pi/logs/f048-pnpm-install.log`).
- `pnpm --filter @i-um/mobile test`: Pass (log `.pi/logs/f048-mobile-test.log`).
- `pnpm --filter @i-um/mobile typecheck`: Pass (log `.pi/logs/f048-mobile-typecheck.log`).
- `pnpm --filter @i-um/api test`: Pass (log `.pi/logs/f048-api-test.log`).
- `pnpm verify:generated`: Pass (log `.pi/logs/f048-verify-generated.log`).

### Manual Smoke

Before closing #48:

- Multi-participant trip quick expense:
  - Open Today → `지출 등록`.
  - Confirm `결제자` section shows trip participants as selectable chips/buttons.
  - Select a participant.
  - Enter amount, confirm save becomes available, save successfully.
  - Expected: success message appears and the saved expense response uses the selected payer.
- Missing payer validation:
  - In a trip with two or more participants, do not select a payer.
  - Enter valid amount/place.
  - Expected: submission remains blocked or shows `결제자를 선택해주세요.`.
- Single-participant trip quick expense:
  - Open quick expense in a trip with only one participant.
  - Expected: sole participant is preselected and visible.

Current status: Not run for this spec draft.

## Issue / Document Cleanup Plan

1. Keep `docs/features/0047-quick-expense-create.md` as the behavior source of truth for quick expense payer selection.
2. Use this F-048 spec to document the issue overlap and closure criteria.
3. After automated checks and manual smoke pass, add a GitHub comment to #48:
   - state that “여행 참여자 중 결제자 선택” is covered by F-047 quick expense;
   - link #47 and `docs/features/0047-quick-expense-create.md`;
   - summarize verification evidence;
   - state that no new F-048 implementation was needed.
4. Close #48 as `covered by #47` / duplicate after verification evidence is available.
5. If verification fails because existing behavior is missing, do not close #48; create or reopen a concrete follow-up with the failing behavior.

## Release Notes

- No user-facing release note for F-048 itself.
- User-facing behavior is already described by F-047: 빠른 지출 등록에서 여행 참여자 중 결제자를 선택해 지출을 저장할 수 있다.

## Open Questions

- None for the current no-new-implementation decision.

## Follow-up Issues

- Optional: mobile UI/E2E hardening for payer chip tapping if manual smoke is not considered sufficient long-term regression coverage.
- Optional: dropdown/bottom-sheet/reusable payer selector if product later requires a selector UX beyond the existing quick expense chip list.
