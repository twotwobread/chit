# Feature Slice: F-055 정산 계산 API

## Metadata

- GitHub Issue: #55
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #55 — [[Feature Slice] F-055 정산 계산 API](https://github.com/twotwobread/i-um/issues/55)
- Ouroboros/PM/Seed: Interview `interview_20260629_155532`, Seed `seed_7dbd59563090`
- Ambiguity Score: `0.0735`
- Notes:
  - #54 manual split is merged; F-055 must consume persisted `expense_splits` for both `equal` and `manual` expenses.
  - #56 renders final transfer results, #57 renders person summaries, #58 owns cross-currency principles, and #59 owns MyPage aggregation.
  - Existing mobile `apps/mobile/lib/trips/settlement.ts` is a non-authoritative helper from #175; F-055 establishes the server source of truth.
  - Issue body references `docs/delivery/*`, but those files are stale/missing in the current repository. Follow `.harness` workflow/rules.

## Goal

여행 참여자는 서버가 계산한 여행 전체 정산 결과를 조회할 수 있다.

서버는 저장된 지출과 분할 rows를 기준으로 통화별 사람별 balance와 결정적인 송금 제안 목록을 계산해 이후 정산 화면들이 클라이언트에서 정산 수식을 다시 구현하지 않도록 한다.

## User Flow

### Fetch authoritative settlement calculation

1. 인증된 현재 여행 참여자가 여행 정산 데이터를 요청한다.
2. 앱은 `GET /trips/{tripId}/settlement`를 호출한다.
3. 서버는 여행 존재와 현재 참여자 권한을 확인한다.
4. 서버는 여행의 모든 정산 대상 지출과 `expense_splits` rows를 읽는다.
5. 서버는 통화별로 지출 금액, 부담 금액, 사람별 net balance, 송금 제안을 계산한다.
6. 앱은 응답을 저장/표시 준비 상태로 받는다.
7. 실제 최종 송금 결과 화면은 #56에서 이 응답의 `suggestedTransfers`를 렌더링한다.

### Empty trip settlement

1. 현재 여행 참여자가 지출이 없는 여행의 정산 데이터를 요청한다.
2. 서버는 정상적으로 `200 OK`를 반환한다.
3. 응답의 `currencySummaries`는 빈 배열이다.
4. 이후 UI는 이를 빈 정산 상태로 표시할 수 있다.

### Inconsistent settlement data

1. 서버가 특정 통화에서 `총 결제액 != 총 부담액` 또는 최종 net 합계 불일치를 감지한다.
2. 서버는 부분 계산이나 best-effort 결과를 반환하지 않는다.
3. 서버는 `409 CONFLICT`와 `SETTLEMENT_DATA_INCONSISTENT` 코드를 반환한다.

## Scope

- App UI: No visible screen in F-055
  - Mobile generated client and optional helper/client wrapper may be updated.
  - #56 owns visible final transfer result UI.
- API Contract: Yes
  - Add `GET /trips/{tripId}/settlement`.
  - Add settlement response schemas.
- API Server: Yes
  - Handler/service/repository calculation and error mapping.
- DB: No migration expected
  - Add sqlc query/repository method for settlement input rows if needed.
- Tests: Yes
  - Contract/generated, API service/repository/handler, mobile client/helper/typecheck.
- Deploy/Smoke: API smoke or internal build before release; no staging deploy required for spec approval.

## Out of Scope

- Final transfer result screen, transfer CTA, payment confirmation, settlement completion state, or paid status (#56).
- Person-by-person settlement summary UI beyond API balance rows (#57).
- FX conversion, representative currency, cross-currency netting, or cross-currency product copy (#58).
- MyPage settlement aggregation (#59).
- Persisted settlement runs, settlement history tables, audit logs, notifications, bank/payment integrations.
- Receipt/category/date/currency editing.
- Client-side reimplementation of authoritative settlement math.

## Requirements

### UI / UX

- No new user-visible screen is required in F-055.
- Mobile must be able to call and consume the generated settlement API without recomputing balances/transfers locally.
- User-visible Korean copy for settlement result screens is deferred to #56/#57.
- The API response must be self-contained enough for later UI:
  - current and historical participant display names are included;
  - removed/unresolved participants can be rendered with a nullable `participantId` and `participantStatus`.

### API Contract

Add:

```text
GET /trips/{tripId}/settlement
```

#### Response: `GetTripSettlementResponse`

```yaml
GetTripSettlementResponse:
  type: object
  additionalProperties: false
  required:
    - tripId
    - defaultCurrency
    - currencySummaries
  properties:
    tripId:
      type: string
    defaultCurrency:
      $ref: '#/components/schemas/SupportedCurrency'
    currencySummaries:
      type: array
      items:
        $ref: '#/components/schemas/SettlementCurrencySummary'
```

#### `SettlementCurrencySummary`

```yaml
SettlementCurrencySummary:
  type: object
  additionalProperties: false
  required:
    - currency
    - totalPaidMinor
    - totalShareMinor
    - balances
    - suggestedTransfers
  properties:
    currency:
      $ref: '#/components/schemas/SupportedCurrency'
    totalPaidMinor:
      type: integer
      format: int64
    totalShareMinor:
      type: integer
      format: int64
    balances:
      type: array
      items:
        $ref: '#/components/schemas/SettlementBalance'
    suggestedTransfers:
      type: array
      items:
        $ref: '#/components/schemas/SettlementTransfer'
```

#### `SettlementParticipantStatus`

```yaml
SettlementParticipantStatus:
  type: string
  enum:
    - current
    - removed
```

#### `SettlementParticipantSnapshot`

```yaml
SettlementParticipantSnapshot:
  type: object
  additionalProperties: false
  required:
    - participantId
    - displayName
    - participantStatus
  properties:
    participantId:
      type: string
      nullable: true
      description: Current participant id, or null for removed/unresolved historical rows.
    displayName:
      type: string
      minLength: 1
      maxLength: 80
    participantStatus:
      $ref: '#/components/schemas/SettlementParticipantStatus'
```

#### `SettlementBalance`

```yaml
SettlementBalance:
  type: object
  additionalProperties: false
  required:
    - participant
    - paidMinor
    - shareMinor
    - netMinor
  properties:
    participant:
      $ref: '#/components/schemas/SettlementParticipantSnapshot'
    paidMinor:
      type: integer
      format: int64
      minimum: 0
    shareMinor:
      type: integer
      format: int64
      minimum: 0
    netMinor:
      type: integer
      format: int64
      description: Positive means the participant should receive; negative means they should pay.
```

#### `SettlementTransfer`

```yaml
SettlementTransfer:
  type: object
  additionalProperties: false
  required:
    - fromParticipant
    - toParticipant
    - amountMinor
  properties:
    fromParticipant:
      $ref: '#/components/schemas/SettlementParticipantSnapshot'
    toParticipant:
      $ref: '#/components/schemas/SettlementParticipantSnapshot'
    amountMinor:
      type: integer
      format: int64
      minimum: 1
```

#### Response codes

- `200 OK`: settlement calculation succeeded.
- `400 VALIDATION_ERROR`: invalid `tripId` format.
- `401 UNAUTHORIZED`: missing or invalid auth session.
- `403 FORBIDDEN`: authenticated user is not a current participant of the trip, including invited-but-not-accepted or removed participant states.
- `404 NOT_FOUND`: trip does not exist.
- `409 CONFLICT`: persisted settlement data is inconsistent; error code `SETTLEMENT_DATA_INCONSISTENT`.
- `500`: unexpected server error.

### DB Changes

No migration is expected.

Implementation may add a sqlc query or repository method that returns settlement input rows for a trip:

- current trip participants:
  - `trip_participants.id`
  - `display_name`
  - `joined_at`
- expenses:
  - `expenses.id`
  - `amount_minor`
  - `currency`
  - `payer_participant_id`
  - `payer_display_name`
- splits:
  - `expense_splits.expense_id`
  - `participant_id`
  - `participant_display_name`
  - `amount_minor`
  - `split_order`

The query must preserve fallback display names for removed/unresolved payer and split participants.

### Business Rules

#### Authorization

- Only authenticated current trip participants can call `GET /trips/{tripId}/settlement`.
- Use existing trip detail/participant endpoint precedence:
  - invalid trip id -> `400`;
  - unauthenticated -> `401`;
  - missing trip -> `404`;
  - existing trip but non-current requester -> `403`.

#### Input data

- Use all persisted settlement-eligible expenses for the trip.
- Use persisted `expense_splits` rows as the source of truth.
- Do not recompute equal/manual splits from `splitPolicy`.
- Equal and manual split policies must both work because both persist final `expense_splits` rows.
- No draft settlement entities exist in F-055.

#### Currency policy

- F-055 v1 is strictly per-currency.
- No FX conversion.
- No cross-currency netting.
- No representative/default-currency conversion.
- The same participant may appear in multiple currency summaries.
- Currency summary order:
  1. trip `defaultCurrency` first if that currency has expenses;
  2. remaining currencies by currency code ascending.
- Trips with no expenses return `currencySummaries: []`.

#### Participant inclusion

- Every current accepted trip participant appears in each non-empty currency summary even when `paidMinor`, `shareMinor`, and `netMinor` are all 0.
- Removed/unresolved historical rows appear only if their paid/share/net amount is nonzero.
- Removed/unresolved rows use:
  - `participantId: null`;
  - normalized stored display name;
  - `participantStatus: "removed"`.
- Current participant rows use:
  - current `participantId`;
  - current normalized display name;
  - `participantStatus: "current"`.
- Removed/unresolved aggregation limitation:
  - if the FK is gone, F-055 groups removed/unresolved amounts by normalized stored display name within a currency;
  - duplicate removed people with the same display name cannot be distinguished from persisted data alone.

#### Accounting

For each currency:

- `totalPaidMinor = sum(expenses.amount_minor)` for that currency.
- `totalShareMinor = sum(expense_splits.amount_minor)` for that currency.
- Each participant's `paidMinor` is the sum of expenses paid by that participant/snapshot in that currency.
- Each participant's `shareMinor` is the sum of split rows burdened to that participant/snapshot in that currency.
- `netMinor = paidMinor - shareMinor`.
- Positive `netMinor`: participant should receive money.
- Negative `netMinor`: participant should pay money.
- The currency is valid only when:
  - `totalPaidMinor == totalShareMinor`;
  - `sum(balance.netMinor) == 0`.
- If any currency is invalid, fail the entire endpoint with `409 SETTLEMENT_DATA_INCONSISTENT`.
- Do not return partial/best-effort settlement results.

#### Canonical ordering

Balance row order:

1. current participants by `joinedAt ASC`, then `participantId ASC`;
2. removed/unresolved rows by normalized `displayName ASC`, then deterministic synthetic key.

Transfer generation per currency:

1. Build creditors where `netMinor > 0`.
2. Build debtors where `netMinor < 0`.
3. Sort creditors by remaining amount DESC, tie-break by canonical balance row order.
4. Sort debtors by remaining amount DESC, tie-break by canonical balance row order.
5. Greedily match the first debtor to the first creditor.
6. Emit transfer amount `min(debtor.remaining, creditor.remaining)`.
7. Decrease remaining amounts and advance rows that reach 0.
8. Emit transfer rows in exact greedy matching order.

This guarantees repeatable transfer rows for identical data and avoids leaking database row order.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0055-settlement-calculation-api.md`.
- [x] AC-02: OpenAPI defines `GET /trips/{tripId}/settlement` with `GetTripSettlementResponse`.
- [x] AC-03: Response includes `tripId`, `defaultCurrency`, and `currencySummaries`.
- [x] AC-04: `currencySummaries` are sorted with default currency first when present, then currency code ascending.
- [x] AC-05: Each currency summary includes `currency`, `totalPaidMinor`, `totalShareMinor`, `balances`, and `suggestedTransfers`.
- [x] AC-06: Each balance includes `participant`, `paidMinor`, `shareMinor`, and `netMinor`.
- [x] AC-07: Positive `netMinor` means receive; negative `netMinor` means pay.
- [x] AC-08: Each transfer includes `fromParticipant`, `toParticipant`, and positive `amountMinor`.
- [x] AC-09: Transfers fully reconcile every returned currency to zero.
- [x] AC-10: Calculation uses persisted `expense_splits` and works for both equal and manual split policies without recomputing splits from policy.
- [x] AC-11: Current accepted participants appear in each non-empty currency summary even with zero amounts.
- [x] AC-12: Removed/unresolved historical participants with nonzero settlement amounts appear with nullable `participantId` and `participantStatus = removed`.
- [x] AC-13: Trips with no expenses return `200 OK` and `currencySummaries: []`.
- [x] AC-14: Inconsistent persisted data fails the whole endpoint with `409 CONFLICT` and `SETTLEMENT_DATA_INCONSISTENT`.
- [x] AC-15: Authorization and errors follow the existing `400`/`401`/`403`/`404` trip endpoint contract.
- [x] AC-16: Repeated calls over identical data produce identical balance order and suggested transfer order.
- [x] AC-17: Generated Go server and TS client code are updated and checked in.
- [x] AC-18: API/mobile tests cover empty trip, single-currency, multi-currency no-conversion, manual splits, zero-balance participants, removed/unresolved snapshots, deterministic ordering, auth/errors, and inconsistent data.

## Regression Test Plan

| Behavior / AC                                                          | Layer                  | Test File / Gate                                                                    | Command                                  |
| ---------------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------- | ---------------------------------------- |
| OpenAPI endpoint and settlement schemas generate cleanly               | Contract/generated     | `packages/api-contract/openapi.yaml`, generated code                                | `pnpm generate && pnpm verify:generated` |
| Auth and membership errors follow trip endpoint behavior               | API service/server     | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test`           |
| Empty trip returns empty summaries                                     | API service/handler    | service/server tests                                                                | `pnpm --filter @i-um/api test`           |
| Single-currency balances and transfers reconcile                       | API service/repository | service/storage tests                                                               | `pnpm --filter @i-um/api test`           |
| Manual split rows are consumed as persisted                            | API service/repository | service/storage tests with `split_policy=manual` rows                               | `pnpm --filter @i-um/api test`           |
| Multi-currency summaries are independent and sorted                    | API service            | service tests                                                                       | `pnpm --filter @i-um/api test`           |
| Current zero-balance participants are included                         | API service            | service tests                                                                       | `pnpm --filter @i-um/api test`           |
| Removed/unresolved snapshots with nonzero amounts are included         | API service/repository | service/storage tests                                                               | `pnpm --filter @i-um/api test`           |
| Inconsistent data fails with `SETTLEMENT_DATA_INCONSISTENT`            | API service/handler    | service/server tests                                                                | `pnpm --filter @i-um/api test`           |
| Mobile client/helper consumes generated response without recalculation | Mobile helper/client   | `apps/mobile/lib/trips/settlement.test.mts` or client tests                         | `pnpm --filter @i-um/mobile test`        |
| Final gates                                                            | Whole repo             | generated + API + mobile                                                            | `pnpm verify`                            |

## Regression Gaps

- No visible settlement screen is implemented in F-055.
  - Risk: end-to-end user-visible settlement result cannot be manually completed until #56.
  - Follow-up: #56 final transfer result screen should smoke the response with real API data.
- Removed/unresolved participants with identical stored display names cannot be distinguished after `participant_id` is null.
  - Risk: rare historical rows may be grouped by display name.
  - Follow-up: a future audit/history model would need stable deleted participant identity if product requires exact distinction.
- Cross-currency settlement policy is intentionally deferred.
  - Risk: users with multiple currencies see independent currency summaries, not converted totals.
  - Follow-up: #58 defines cross-currency principle/copy.

## TDD Implementation Plan

1. Red: API contract and generated expectations
   - Add `GET /trips/{tripId}/settlement` and settlement schemas to OpenAPI.
   - Run generation and observe server/client compile failures until handlers are implemented.
   - Verify: `pnpm generate && pnpm verify:generated`.
2. Red: API service settlement tests
   - Add tests for empty trip, single-currency balances, manual split rows, zero-balance current participants, multi-currency independent summaries, deterministic transfers, removed/unresolved snapshots, inconsistent data, and auth/membership errors.
   - Verify: `pnpm --filter @i-um/api test` should fail.
3. Green: API domain calculation
   - Add domain types for settlement response and participant snapshots.
   - Implement per-currency aggregation, canonical ordering, consistency checks, and deterministic greedy transfer generation.
   - Verify: `pnpm --filter @i-um/api test`.
4. Red: Repository/handler tests
   - Add storage/query tests proving persisted expenses and splits are read with current and fallback participant snapshots.
   - Add handler tests for success response shape and `409 SETTLEMENT_DATA_INCONSISTENT` mapping.
   - Verify: `pnpm --filter @i-um/api test` should fail until repository/handler are wired.
5. Green: Repository/handler integration
   - Add sqlc query/repository method for settlement input rows.
   - Add service method and API handler.
   - Map domain response to OpenAPI response.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
6. Red/Green: Mobile client/helper compatibility
   - Add or update mobile client wrapper for the generated endpoint.
   - Align `apps/mobile/lib/trips/settlement.ts` helper types/tests only if needed to consume API response without recalculation.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
7. Refactor and consistency
   - Keep calculation in domain/service layer and SQL in repository.
   - Do not add DB migrations or visible UI.
   - Ensure all money values are integer minor units.
8. Gate: final verification before PR
   - `pnpm verify:generated`
   - `pnpm --filter @i-um/api test`
   - `pnpm --filter @i-um/api build`
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - `pnpm lint`
   - `pnpm format:check`
   - `pnpm verify`
   - `git diff --check`

## Verification Record

### Automated Regression

- `pnpm generate` — pass.
- `pnpm verify:generated` — pass.
- `pnpm --filter @i-um/api test` — pass.
- `pnpm --filter @i-um/api build` — pass.
- `pnpm --filter @i-um/mobile test` — pass.
- `pnpm --filter @i-um/mobile typecheck` — pass.
- `pnpm lint` — pass.
- `pnpm format:check` — pass after Prettier formatting.
- `pnpm verify` — pass.
- `git diff --check` — pass.

### Manual Smoke

- Not run — F-055 adds an API and generated client/helper only; no visible settlement screen is in scope until #56.

## Release Notes

- 여행 지출과 분할 내역을 기준으로 서버가 통화별 정산 balance와 송금 제안을 계산하는 API를 추가한다.
- 화면 표시와 결제 완료 상태는 후속 정산 화면 이슈에서 연결한다.

## Open Questions

- None after Ouroboros clarification.

## Follow-up Issues

- #56 — 최종 송금 결과 화면.
- #57 — 사람별 결제/부담 요약.
- #58 — 통화별 정산 원칙 적용.
- #59 — 마이페이지 내 정산 요약.
