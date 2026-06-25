# Feature Slice: F-049 기본 전체 1/N 분할

## Metadata

- GitHub Issue: #49
- Status: Implemented (pending staging/internal smoke)
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #49 — [[Feature Slice] F-049 기본 전체 1/N 분할](https://github.com/twotwobread/i-um/issues/49)
- Ouroboros/PM/Seed: Interview `interview_20260625_140448`, Seed `seed_4847f1c76c28` (MCP generated; file path not provided)
- Ambiguity Score: `0.097`
- Notes:
  - F-047 quick expense creation already stores server-generated `expense_splits` for every current trip participant.
  - Current quick expense save API is `POST /trips/{tripId}/days/{date}/expenses/quick`; the request has `itineraryItemId`, `amountMinor`, and `payerParticipantId`, and does not include split inputs.
  - F-049 keeps server save behavior authoritative, adds a mobile pre-save split preview, and shows a post-save split summary from the server response.
  - F-049 does not add a preview API. Drift is controlled with shared golden fixture/parity tests across API and mobile.

## Goal

사용자는 빠른 지출 저장 전에 전체 참여자 기준 기본 1/N 분할 금액을 확인하고, 저장 후에는 서버가 실제 생성한 참여자별 split 결과를 확인할 수 있다.

시스템은 전체 현재 참여자를 대상으로 deterministic equal split을 생성하며, 모바일 preview와 서버 저장 결과가 같은 규칙을 따르도록 테스트로 보호한다.

## User Flow

1. 사용자가 Today 화면에서 `지출 등록`을 열고 장소, 금액, 결제자를 입력/선택한다.
2. 앱은 현재 로드된 여행 참여자 전체와 입력 금액을 기준으로 `기본 1/N 분할` preview를 보여준다.
   - 참여자별 표시 금액은 서버 기본 분할 규칙과 동일하게 계산한다.
   - 결제자도 다른 참여자와 동일하게 분할 대상에 포함된다.
3. 사용자가 `저장하기`를 누른다.
4. 서버는 quick expense를 저장하면서 transaction 시점의 현재 여행 참여자 전체에 대한 split rows를 생성한다.
5. 앱은 저장 성공 후 서버 응답 `expense.splits`를 기준으로 `실제 저장된 분할` summary를 보여준다.
6. 사용자가 확인하면 Today 화면으로 돌아간다.

## Scope

- App UI: Yes
  - `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`에 pre-save split preview와 post-save split summary를 추가한다.
  - `apps/mobile/lib/trips/quick-expense.ts`에 preview/summary view model과 equal split helper를 둔다.
- API Contract: No new endpoint or request field
  - Existing `POST /trips/{tripId}/days/{date}/expenses/quick` remains the save endpoint.
  - Existing `CreateQuickExpenseResponse.expense.splits` is the post-save source of truth.
- API Server: Behavior mostly existing; add/harden tests
  - Existing `AllocateEqualExpenseSplits` and `CreateQuickExpense` transaction remain server-authoritative.
  - Add golden fixture/parity coverage for the exact allocation rule.
- DB: No schema change
  - Existing `expenses` and `expense_splits` tables persist the result.
- Tests: Yes
  - API equal-split fixture/parity tests
  - Mobile preview/helper/view model tests
  - Mobile typecheck and relevant generated-code gates
- Deploy/Smoke: Needed before closing implementation
  - Internal build or staging smoke for preview + saved summary.

## Out of Scope

- Manual split editing, custom ratios, excluding participants, or per-person amount override
- Selecting split participants separately from current trip participants
- Server preview API, amount-input preview network calls, or preview-specific OpenAPI changes
- Expense list/detail/edit/delete and settlement summary
- Currency conversion or changing trip default currency behavior
- Changing F-047 quick expense request payload shape

## Requirements

### UI / UX

#### Screens

- Quick expense screen/sheet: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
  - Continue asking only for amount, payer, and item selection when needed.
  - Show a `기본 1/N 분할` section before `저장하기` once:
    - participants are loaded,
    - the amount parses to a positive integer minor-unit value,
    - there is at least one participant.
  - Preview rows show participant display name and formatted split amount.
  - Preview order matches the deterministic split order: `joinedAt ASC`, then `participantId ASC`.
  - If the amount is invalid, do not show stale preview amounts; keep the existing validation copy.
  - If participant data is empty/unavailable, disable save through existing payer validation and show a short error/helper instead of a misleading preview.
  - After save succeeds, show a success summary from `response.expense.splits` before returning to Today.
  - The success summary must use server response values, not recomputed preview values.

#### Copy

- Preview title: `기본 1/N 분할`
- Preview helper: `저장하면 모든 참여자에게 아래 금액으로 나눠져요.`
- Saved summary title: `실제 저장된 분할`
- Saved summary helper: `서버에 저장된 결과 기준이에요.`
- Success message: `지출을 저장했어요.`
- Empty/blocked participant helper: `참여자 정보를 불러오지 못해 분할을 계산할 수 없어요.`

#### Money display

- Use existing minor-unit amount parsing rules from quick expense:
  - KRW/JPY: integer minor units only.
  - USD/EUR: up to two decimal places, stored and calculated in minor units.
- Preview and summary money labels use existing `formatMoney`, e.g. `18,500원`, `3,200엔`, `$12.34`.
- Never calculate split amounts with floating point major-unit money.

#### Preview vs saved result

- Preview is an estimate from the currently loaded participant list.
- Server response is final authority.
- If participants changed after screen load, the saved summary may differ from preview; this is acceptable and must not be hidden.
- Existing 409 handling should refresh data and ask the user to retry.

### API Contract

No new API contract is required for F-049.

Existing save endpoint remains:

```text
POST /trips/{tripId}/days/{date}/expenses/quick
```

Request remains:

```yaml
CreateQuickExpenseRequest:
  required:
    - itineraryItemId
    - amountMinor
    - payerParticipantId
```

The request must not include currency, split participants, split amounts, or preview-only fields.

The post-save summary uses existing response data:

```yaml
CreateQuickExpenseResponse:
  expense:
    splits:
      - participantId
      - displayName
      - amountMinor
```

No server preview endpoint is added in this slice.

### DB Changes

No DB migration is required for F-049.

Existing persistence remains:

- `expenses.amount_minor` stores integer minor units.
- `expense_splits.amount_minor` stores each participant split as integer minor units.
- `expense_splits.participant_id` and `participant_display_name` preserve the participant split snapshot.

### Business Rules

#### Split target

- Default split target is every current trip participant at save time.
- The selected payer must be a current participant of the same trip.
- The selected payer is included in the split target and does not receive a special amount.
- Owner/member roles do not affect split eligibility or amount.

#### Allocation rule

Given `amountMinor` and participant list:

1. Reject `amountMinor < 1`.
2. Reject/conflict if participant list is empty.
3. Sort participants by `joinedAt ASC`, then `participantId ASC`.
4. Let `n = participant count`.
5. Let `base = amountMinor / n` using integer division.
6. Let `remainder = amountMinor % n`.
7. Assign `base + 1` minor unit to the first `remainder` participants in sorted order.
8. Assign `base` minor units to the rest.
9. Allow split amount `0` when `amountMinor < n`.
10. The sum of all split amounts must equal `amountMinor`.

#### Display names

- Trim participant display names for preview/summary display.
- Use `여행자` when a display name is blank, matching server normalization.

#### Authority and drift prevention

- Mobile preview must implement the same allocation rule as the server.
- Server save remains authoritative; mobile must display server response splits after save.
- Add a shared golden fixture or equivalent parity test cases consumed by API and mobile tests so changes to the rule fail both surfaces when they drift.

## Acceptance Criteria

- [ ] AC-01: The feature spec and TDD implementation plan exist at `docs/features/0049-default-equal-split.md`.
- [ ] AC-02: Quick expense UI shows a `기본 1/N 분할` preview before save when amount and participants are valid.
- [ ] AC-03: Preview includes every loaded trip participant, including the selected payer.
- [ ] AC-04: Preview uses the exact server allocation rule: participant order, integer base share, remainder distribution, and zero-minor-unit splits.
- [ ] AC-05: Preview updates when the amount changes and does not show stale amounts for invalid input.
- [ ] AC-06: Save request still sends only `itineraryItemId`, `amountMinor`, and `payerParticipantId`; no manual split payload is accepted or sent.
- [ ] AC-07: Server quick expense creation remains the final authority and creates one persisted split row for every current participant at save time.
- [ ] AC-08: Save success UI shows `실제 저장된 분할` using `response.expense.splits` from the server, not recomputed preview values.
- [ ] AC-09: Golden fixture/parity tests cover at least even split, uneven remainder, same `joinedAt` tie by participant ID, blank display name fallback, and `amountMinor < participantCount`.
- [ ] AC-10: No preview API, DB migration, manual split editing, or split participant selection is introduced in F-049.
- [ ] AC-11: Mobile typecheck and relevant API/mobile regression tests pass.
- [ ] AC-12: Internal build or staging smoke verifies preview, save, and saved summary on a real quick expense flow.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Existing quick expense contract remains generated/in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated server/client | `pnpm verify:generated` |
| Server allocation rule and edge cases match golden fixture | API service | `apps/api/internal/trip/service_test.go` plus shared fixture, or equivalent | `pnpm --filter @i-um/api test` |
| Quick expense transaction persists one split per current participant | API repository/handler | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Mobile preview allocation matches golden fixture | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Preview view model hides stale/invalid amounts and displays all participants | Mobile helper/view model | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Saved summary uses API response splits | Mobile helper/view model | `apps/mobile/lib/trips/quick-expense.test.mts` and route composition where practical | `pnpm --filter @i-um/mobile test` |
| Quick expense screen compiles with generated API types | Mobile typecheck | Expo Router/mobile TS | `pnpm --filter @i-um/mobile typecheck` |
| Final changed-surface gate | Whole repo | generated + API + mobile | `pnpm verify` |

## Regression Gaps

- Staging/internal device smoke is not automated.
  - Risk: modal/alert layout, keyboard behavior, and real API response summary can regress outside pure helper tests.
  - Follow-up: Run manual smoke before closing implementation and record result in this document.

## TDD Implementation Plan

1. Red: Golden fixture/parity cases
   - Add shared equal-split cases, for example under `packages/api-contract/fixtures/equal-split-cases.json`, with participants, amountMinor, expected order, display names, and amounts.
   - Include even split, uneven remainder, joinedAt tie, blank display name, and `amountMinor < participantCount`.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/mobile test` fail until both surfaces consume the cases.

2. Green: API allocation fixture coverage
   - Wire API service tests to the fixture or mirror the exact fixture values in table tests.
   - Confirm existing `AllocateEqualExpenseSplits` behavior matches the fixture.
   - Keep business logic in service/domain, not handlers.
   - Verify: `pnpm --filter @i-um/api test`.

3. Red: Mobile preview helper tests
   - Add tests for a `buildDefaultEqualSplitPreview` or equivalent helper in `apps/mobile/lib/trips/quick-expense.ts`.
   - Assert deterministic ordering, display-name fallback, total equals amount, zero-minor-unit split, and fixture parity.
   - Verify: `pnpm --filter @i-um/mobile test` fails.

4. Green: Mobile preview helper
   - Implement preview allocation using integer minor units and loaded `TripParticipantListItem[]`.
   - Reuse existing amount parser and money formatter.
   - Do not call a preview API.
   - Verify: `pnpm --filter @i-um/mobile test`.

5. Red: Preview and summary view model tests
   - Add tests that quick expense view model:
     - shows preview only for valid amount and participants;
     - hides stale preview for invalid amount;
     - includes all participants including payer;
     - builds saved summary rows from `CreateQuickExpenseResponse.expense.splits`.
   - Verify: `pnpm --filter @i-um/mobile test` fails.

6. Green: Quick expense UI
   - Add `기본 1/N 분할` preview section to the quick expense form.
   - Replace the current amount-only success alert with a success state/dialog/sheet that shows `실제 저장된 분할` rows from server response splits and then lets the user return to Today.
   - Use theme tokens/shared primitives; do not add raw colors.
   - Verify:
     - `pnpm --filter @i-um/mobile test`
     - `pnpm --filter @i-um/mobile typecheck`

7. Red/Green: Save-path regression hardening
   - Ensure handler/repository tests still prove response `expense.splits` is populated and ordered by the allocation rule.
   - Add missing assertions if current tests do not cover response split order or all-participant persistence.
   - Verify: `pnpm --filter @i-um/api test`.

8. Refactor and gates
   - Remove duplicated ad-hoc split calculations outside the helper.
   - Keep server response as final authority in the UI state model.
   - Run final relevant gates:
     - `pnpm verify:generated`
     - `pnpm --filter @i-um/api test`
     - `pnpm --filter @i-um/mobile test`
     - `pnpm --filter @i-um/mobile typecheck`
     - `pnpm verify` before PR if time/environment allows.

9. Manual smoke
   - Internal build or staging API smoke:
     - open a trip with today itinerary and at least three participants;
     - enter an uneven amount such as `1000` JPY;
     - confirm preview rows show `334`, `333`, `333` in deterministic participant order;
     - save;
     - confirm success summary shows server-returned rows and total equals the original amount.
   - Edge smoke if feasible:
     - use amount smaller than participant count and confirm zero-minor-unit row display is understandable.

## Verification Record

### Automated Regression

- `git diff --check` plus new-file `git diff --no-index --check`: pass (2026-06-25)
- `pnpm verify:generated`: pass (2026-06-25)
- `pnpm --filter @i-um/api test`: pass (2026-06-25)
- `pnpm --filter @i-um/api build`: pass (2026-06-25)
- `pnpm --filter @i-um/mobile test`: pass (2026-06-25)
- `pnpm --filter @i-um/mobile typecheck`: pass (2026-06-25)
- `pnpm --filter @i-um/api lint`: pass (2026-06-25)
- `pnpm --filter @i-um/mobile lint`: pass (2026-06-25)
- `pnpm --filter @i-um/api format:check`: pass (2026-06-25)
- `pnpm --filter @i-um/mobile format:check`: pass (2026-06-25)
- `pnpm verify`: pass (2026-06-25)

### Manual Smoke

- Pre-save 1/N preview: not run; requires internal build/staging smoke
- Post-save server split summary: not run; requires internal build/staging smoke

## Release Notes

- 빠른 지출 등록에서 저장 전 전체 참여자 기본 1/N 분할 금액을 미리 확인할 수 있게 한다.
- 저장 후에는 서버가 실제 저장한 참여자별 split 결과를 보여준다.

## Open Questions

- None. Scope and architecture were clarified through Ouroboros: local deterministic preview, server save result as final authority, no preview API in F-049.

## Follow-up Issues

- Manual/custom split editing if product later needs participant exclusion, custom ratios, or amount overrides
- Expense list/detail/settlement summary slices after quick expense creation and split preview are stable
