# Feature Slice: F-059 마이페이지 내 정산 요약

## Metadata

- GitHub Issue: #59
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #59 — [[Feature Slice] F-059 마이페이지 내 정산 요약](https://github.com/twotwobread/i-um/issues/59)
- Ouroboros/PM/Seed: Not used; `micro-spec-author` selected for a low-ambiguity, normal cross-layer slice.
- Notes:
  - #55 is merged and provides authoritative per-trip settlement balances.
  - #58 is merged and establishes strict per-currency/no-FX display.
  - Existing mobile MyPage/trip list data does not expose the current user's trip participant id; server-side aggregation is required.
  - Issue body references `docs/delivery/*`, but those references are stale for agent process; follow `.harness` workflow/rules.
  - Spec review verdict: Approved.

## Goal

사용자는 마이페이지에서 내가 돈을 보내야 하거나 받을 금액이 있는 여행을 빠르게 확인할 수 있다.

집계는 서버가 현재 사용자와 trip participant를 안전하게 연결해 계산하며, 앱은 표시용 포맷만 수행한다.

## User Flow

### View MyPage settlement summary

1. 로그인한 사용자가 마이페이지를 연다.
2. 앱은 기존 프로필/여행 목록과 별도로 `GET /me/settlement-summary`를 호출한다.
3. 서버는 사용자가 현재 참여자인 여행들의 정산 결과를 계산한다.
4. 서버는 현재 사용자에게 non-zero 정산 잔액이 있는 여행만 반환한다.
5. 앱은 여행별로 보낼/받을 금액을 통화별로 표시한다.
6. 사용자는 해당 여행의 정산 화면으로 이동해 자세한 사람별/송금 안내를 확인할 수 있다.

### No settlement items

1. 현재 사용자가 모든 참여 여행에서 보낼/받을 non-zero 잔액이 없다.
2. 앱은 마이페이지 정산 요약 섹션에 빈 상태를 표시한다.
3. 기존 프로필과 내 여행 섹션은 그대로 표시된다.

### Summary unavailable

1. 정산 요약 API 호출이 실패하거나 특정 여행의 정산 데이터가 일관되지 않다.
2. 앱은 정산 요약 섹션에만 retryable error를 표시한다.
3. 기존 프로필과 내 여행 섹션은 숨기지 않는다.

## Scope

- App UI: Yes
  - Extend `apps/mobile/app/mypage.tsx` with an independent settlement summary section.
  - Add/update mobile MyPage settlement helper/view-model code.
- API Contract: Yes
  - Add `GET /me/settlement-summary`.
  - Add response schemas for my settlement trip/currency summaries.
- API Server: Yes
  - Handler/service method that derives current-user summary from existing settlement calculation.
- DB: No migration expected
  - Reuse existing trip list and settlement input queries where possible.
- Tests: API handler/service tests, generated contract checks, mobile helper tests, mobile typecheck, final repo gates.
- Deploy/Smoke: Manual smoke or internal build verification when feasible because this is user-visible UI.

## Out of Scope

- DB migrations, persisted settlement summary tables, settlement runs, or history.
- FX conversion, representative/base currency totals, or cross-currency netting.
- Settlement completion/payment state, bank/account details, copy/share actions, notifications, or audit logs.
- Broad MyPage redesign or new navigation IA.
- Mobile-side current participant inference by display name.

## Requirements

### UI / UX

- Screen path: `apps/mobile/app/mypage.tsx`.
- Section title: `정산 요약`.
- Section placement:
  - Show after the profile card and before the existing `내 여행` section.
- Loading:
  - Show a compact loading card for settlement summary only.
- Empty:
  - Title: `정산할 여행이 없어요.`
  - Helper: `보내거나 받을 금액이 있는 여행이 없어요.`
- Error:
  - Title: `정산 요약을 불러올 수 없어요.`
  - Helper: `잠시 후 다시 시도해주세요.`
  - Retry action calls only the settlement summary loader.
- Populated:
  - Show one row/card per returned trip, preserving API order.
  - Row shows trip name and date range.
  - Row shows one or more per-currency chips/labels:
    - `send`: `보낼 금액 <amount>`
    - `receive`: `받을 금액 <amount>`
  - Amounts are formatted from API minor units.
  - Multiple currencies remain separate; no conversion or netting.
  - Row navigation opens the trip settlement tab if a stable route exists; otherwise trip detail is acceptable.
- Independence:
  - Summary loading/error/empty states do not hide the existing profile or `내 여행` sections.

### API Contract

Add:

```text
GET /me/settlement-summary
```

#### Response: `GetMySettlementSummaryResponse`

```yaml
GetMySettlementSummaryResponse:
  type: object
  additionalProperties: false
  required:
    - trips
  properties:
    trips:
      type: array
      items:
        $ref: '#/components/schemas/MySettlementTripSummary'
```

#### `MySettlementTripSummary`

```yaml
MySettlementTripSummary:
  type: object
  additionalProperties: false
  required:
    - tripId
    - tripName
    - startDate
    - endDate
    - defaultCurrency
    - currencySummaries
  properties:
    tripId:
      type: string
    tripName:
      type: string
    startDate:
      type: string
      format: date
    endDate:
      type: string
      format: date
    defaultCurrency:
      $ref: '#/components/schemas/SupportedCurrency'
    currencySummaries:
      type: array
      minItems: 1
      items:
        $ref: '#/components/schemas/MySettlementCurrencySummary'
```

#### `MySettlementDirection`

```yaml
MySettlementDirection:
  type: string
  enum:
    - send
    - receive
```

#### `MySettlementCurrencySummary`

```yaml
MySettlementCurrencySummary:
  type: object
  additionalProperties: false
  required:
    - currency
    - direction
    - netMinor
  properties:
    currency:
      $ref: '#/components/schemas/SupportedCurrency'
    direction:
      $ref: '#/components/schemas/MySettlementDirection'
    netMinor:
      type: integer
      format: int64
      minimum: 1
      description: Absolute non-zero amount in minor units.
```

Error policy:

- `401`: unauthenticated.
- `409 SETTLEMENT_SUMMARY_UNAVAILABLE`: one or more underlying trip settlements cannot be calculated consistently.
- Generic `500`: unexpected failure.

### DB Changes

No DB migration expected.

Implementation should reuse:

- current user's trip list query;
- existing settlement input queries and calculation logic.

### Business Rules

- Server settlement data is the source of truth.
- Include only trips where the current user's settlement balance is non-zero in at least one currency.
- For each included trip, include only currencies where the current user's balance is non-zero.
- Positive authoritative `netMinor` means `receive`; negative means `send`.
- Response `netMinor` is absolute minor units.
- Preserve trip list order from the existing current-user trip list.
- Preserve per-trip authoritative `currencySummaries` order.
- No FX conversion, representative currency, or cross-currency netting.
- If an underlying settlement is inconsistent, fail the whole endpoint with `409 SETTLEMENT_SUMMARY_UNAVAILABLE`; do not return partial or misleading summaries.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0059-mypage-settlement-summary.md`.
- [x] AC-02: OpenAPI defines `GET /me/settlement-summary` and generated clients/types are updated.
- [x] AC-03: Endpoint requires authentication and returns `401` for unauthenticated requests.
- [x] AC-04: Endpoint returns only current-user trips with at least one non-zero current-user settlement balance.
- [x] AC-05: Each returned trip includes trip id, name, date range, default currency, and per-currency summaries.
- [x] AC-06: Positive current-user net values map to `receive`; negative values map to `send`; zero values are excluded.
- [x] AC-07: Per-currency summaries preserve authoritative settlement currency order.
- [x] AC-08: No FX conversion, representative currency, or cross-currency netting is performed.
- [x] AC-09: Inconsistent underlying settlement data maps to `409 SETTLEMENT_SUMMARY_UNAVAILABLE`.
- [x] AC-10: MyPage renders settlement summary loading, empty, error/retry, and populated states independently from the existing trip list.
- [x] AC-11: Populated MyPage rows show trip name, date range, and per-currency send/receive amount labels.
- [x] AC-12: Row navigation opens the trip settlement tab or trip detail.
- [x] AC-13: API and mobile tests cover filtering, direction mapping, ordering, auth/error handling, and view-model states.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Contract and generated client/server types | Contract | OpenAPI generation check | `pnpm generate && pnpm verify:generated` |
| Auth and handler mapping | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Current-user filtering/direction/order/error behavior | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Mobile view-model empty/populated/error-independent states | Mobile helper | `apps/mobile/lib/trips/mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| MyPage API integration type safety | Mobile app | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full end-to-end device verification depends on available seeded settlement data or an internal build environment.
  - Risk: visual density/navigation issues may be missed by helper tests.
  - Follow-up: run manual smoke/internal build before release when feasible.

## TDD Implementation Plan

1. Red: Contract/API tests
   - Add OpenAPI schema and generated-code expectation.
   - Add handler/service tests for auth, non-zero filtering, direction mapping, order preservation, and 409 mapping.
   - Verify: targeted API tests should fail before implementation/generation.
2. Green: API implementation
   - Implement contract, generation, handler, service result types/mappers, and wrapper methods.
   - Reuse existing settlement calculation data; no DB migration unless a blocking gap is found.
   - Verify: `pnpm generate && pnpm --filter @i-um/api test`.
3. Red/Green: Mobile helper and UI
   - Add mobile view-model tests for empty/populated/error-independent states.
   - Implement client wrapper, helper mapping, and MyPage section rendering.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
4. Refactor and final gates
   - Keep styling token-based and state independent.
   - Verify final gate list before PR.

## Verification Record

### Automated Regression

- `pnpm generate`: pass.
- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass (297 tests).
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass after gofmt/Prettier formatting.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Not run — no simulator/internal build smoke was requested or available in this agent session. API and mobile behavior are covered by automated tests; visual/device smoke remains recommended before release.

## Release Notes

- Adds a MyPage settlement summary for trips where the current user needs to send or receive money.

## Open Questions

- None.

## Follow-up Issues

- None.
