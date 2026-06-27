# Feature Slice: F-051 지출 목록 조회

## Metadata

- GitHub Issue: #51
- Status: Implemented (pending manual smoke)
- Created: 2026-06-26
- Updated: 2026-06-26

## Source

- Issue: #51 — [[Feature Slice] F-051 지출 목록 조회](https://github.com/twotwobread/i-um/issues/51)
- Ouroboros/PM/Seed: Interview `interview_20260626_023212`, Seed `seed_4625a66bb333` (MCP generated; file path not provided)
- Ambiguity Score: `0.13`
- Notes:
  - User selected a read-only, Day-level expense list inside the existing trip day screen.
  - The list is shown below the itinerary, newest-first, with compact non-tappable rows.
  - Empty expense days still show the expense section with an entry point to the existing quick-expense creation flow.
  - User pushed back on nullable display fallbacks. F-051 should avoid null display data in the list by using non-null expense snapshots and list-specific display DTOs rather than exposing nullable source IDs in the list rows.
  - Existing `Expense` source references (`itineraryItemId`, `tripPlaceId`, `payerParticipantId`) are nullable for retained history after source deletes. F-051 does not change that deletion/nullability model unless explicitly approved.

## Goal

여행 참여자 모두가 기존 Day 일정 화면에서 해당 날짜에 등록된 지출 목록을 읽기 전용으로 확인할 수 있다.

지출 목록은 장소/지출명, 금액, 결제자, 분담 요약을 빠르게 훑을 수 있게 보여주고, 지출이 없을 때는 기존 `지출 등록` 흐름으로 바로 이어지게 한다.

## User Flow

### Expenses exist

1. 사용자가 로그인한 상태로 여행 Day 화면(`/trips/{tripId}/days/{date}`)을 연다.
2. 앱은 기존 Day 일정과 함께 해당 날짜의 지출 목록을 불러온다.
3. 일정 목록 아래에 `지출` 섹션이 표시된다.
4. 각 지출 row는 최신 등록순으로 표시된다.
5. 사용자는 각 row에서 다음 정보를 확인한다.
   - 1줄: 장소/지출명과 금액
   - 2줄: 결제자와 분담 요약
6. Row는 탭할 수 없고 상세/수정/삭제 액션을 제공하지 않는다.

### No expenses yet

1. 사용자가 지출이 없는 Day 화면을 연다.
2. 일정 목록 아래에 `지출` 섹션과 empty state가 표시된다.
3. Empty state는 아직 등록된 지출이 없음을 알려준다.
4. 사용자가 `지출 등록`을 누르면 기존 빠른 지출 등록 화면(`/trips/{tripId}/days/{date}/expenses/quick`)으로 이동한다.
5. 빠른 지출 화면은 기존 F-047 동작처럼 오늘 일정 항목이 있으면 선택/입력 흐름을 제공하고, 일정 항목이 없으면 기존 empty/error copy를 보여준다.

### Unauthorized or non-participant

1. 인증되지 않은 사용자는 기존 인증 복구 흐름에 따라 로그인으로 이동한다.
2. 여행 참여자가 아닌 사용자는 Day 일정과 지출 목록을 볼 수 없다.
3. 삭제되었거나 범위를 벗어난 여행/날짜는 not found 상태로 처리한다.

## Scope

- App UI: Yes
  - Existing screen: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - New helper: `apps/mobile/lib/trips/day-expenses.ts` or equivalent for formatting/view-model logic
  - Existing quick-expense entry point: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
- API Contract: Yes
  - Add `GET /trips/{tripId}/days/{date}/expenses`
  - Add list-specific response schemas that contain non-null display fields for list rows.
- API Server: Yes
  - Handler, service, repository, mapper, error mapping for the read-only list endpoint.
- DB: Query only
  - No migration expected.
  - Add sqlc query/queries to fetch Day expenses and their splits from existing `expenses` / `expense_splits` tables.
- Tests: Yes
  - API service/handler coverage for auth, date validation/range, newest-first order, empty list, and display DTO mapping.
  - Mobile helper coverage for row formatting, empty state, quick-expense route, and non-null list display.
- Deploy/Smoke: Needed before closing implementation
  - Staging/internal smoke for Day screen with expenses and no expenses.

## Out of Scope

- Dedicated expense screen.
- Trip-wide expense list or aggregation.
- Filters, search, grouping, pagination, or infinite scroll.
- Expense detail, drill-down, edit, delete, receipt/image attachment, memo/category input.
- Settlement summary, settlement calculation, transfer/payment confirmation, custom split ratios, or excluding participants.
- Creating expenses from this slice beyond linking to the existing quick-expense flow.
- Changing existing `Expense` source ID nullability or DB deletion semantics (`ON DELETE SET NULL`) unless explicitly approved as a separate API/DB decision.
- Backfilling or repairing legacy/corrupt expense rows.

## Requirements

### UI / UX

#### Screen placement

- Screen: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
- Place a standalone `지출` section below the itinerary content.
- Keep the itinerary section behavior unchanged except for any state orchestration needed to also load expenses.
- Use theme tokens/shared primitives; do not add raw colors.

#### List row

- Rows are compact and non-tappable.
- Row first line:
  - Left: place/name label from the expense place snapshot. For F-051 this is `expense.place.name` / `placeName` because custom expense names are out of scope.
  - Right: formatted amount, e.g. `18,500원`, `3,200엔`, `$12.34`, `€12.34`.
- Row second line:
  - `결제 {payerDisplayName} · {splitSummary}`
- Split summary uses the saved splits, not recalculated client-side assumptions.
  - 1 split: `분담 {name} {amount}`
  - 2 splits: `분담 {name1} {amount1} · {name2} {amount2}`
  - 3+ splits: `분담 {name1} {amount1} 외 {n-1}명`
- Rows must not show detail/edit/delete affordances.

#### Empty state

- The `지출` section remains visible when the list is empty.
- Copy:
  - Title: `아직 등록된 지출이 없어요.`
  - Helper: `지출 등록을 눌러 오늘 쓴 금액을 남겨보세요.`
  - CTA: `지출 등록`
- CTA navigates to the existing quick-expense route for the current `tripId`/`date`.
- If quick expense cannot be completed because the Day has no itinerary item, the existing quick-expense screen handles that state.

#### Loading / error / success states

- Loading: show a compact loading state for the expense section while expenses are fetched.
- Empty: show the empty state above.
- Success: show newest-first rows.
- 401: follow existing mobile auth recovery/login behavior.
- 403/404: show existing not-found/access copy for the Day screen or an expense-section error if itinerary data is still usable.
- Retryable expense-list failure: prefer keeping the itinerary visible and showing a retryable error inside the `지출` section.
  - Title: `지출을 불러올 수 없어요.`
  - Helper: `잠시 후 다시 시도해주세요.`
  - Action: `다시 시도`

#### Null/display policy

- The list UI should not need missing-field fallbacks for normal data.
- The list API should return non-null display fields sourced from existing snapshots:
  - Place/name: `expenses.place_name` or non-null `ExpensePlaceSnapshot.name`
  - Payer: `expenses.payer_display_name`
  - Split participants: `expense_splits.participant_display_name`
- The list row should not expose nullable historical source IDs (`itineraryItemId`, `tripPlaceId`, `payerParticipantId`, split `participantId`).
- Existing nullable source IDs can remain in the create response `Expense` model for history preservation; this slice does not require showing those IDs.

### API Contract

Add a read-only endpoint under `Trips`:

```text
GET /trips/{tripId}/days/{date}/expenses
```

Responses:

- `200`: Day expense list.
- `400`: invalid `tripId` or `date`.
- `401`: unauthenticated.
- `403`: authenticated user is not a participant of the trip.
- `404`: trip missing or `date` is outside the trip range.
- `500`: unexpected server error.

Proposed response schema:

```yaml
ListDayExpensesResponse:
  type: object
  additionalProperties: false
  required:
    - expenses
  properties:
    expenses:
      type: array
      items:
        $ref: '#/components/schemas/DayExpenseListItem'

DayExpenseListItem:
  type: object
  additionalProperties: false
  required:
    - id
    - place
    - amountMinor
    - currency
    - payerDisplayName
    - splits
    - createdAt
  properties:
    id:
      type: string
    place:
      $ref: '#/components/schemas/ExpensePlaceSnapshot'
    amountMinor:
      type: integer
      format: int64
      minimum: 1
    currency:
      $ref: '#/components/schemas/SupportedCurrency'
    payerDisplayName:
      type: string
      minLength: 1
    splits:
      type: array
      items:
        $ref: '#/components/schemas/DayExpenseSplitListItem'
    createdAt:
      type: string
      format: date-time

DayExpenseSplitListItem:
  type: object
  additionalProperties: false
  required:
    - splitOrder
    - displayName
    - amountMinor
  properties:
    splitOrder:
      type: integer
      minimum: 1
    displayName:
      type: string
      minLength: 1
    amountMinor:
      type: integer
      format: int64
      minimum: 0
```

Notes:

- Do not reuse `Expense` directly for the list response if doing so would expose nullable source IDs the list does not render.
- The response is intentionally not paginated in F-051. Add pagination only if a later issue introduces a performance/product need.
- The API returns `200` with `expenses: []` for a valid Day with no expenses.

### DB Changes

No migration expected.

Existing schema used by F-051:

- `apps/api/migrations/00011_create_expenses.sql`
- `expenses`
  - `id`
  - `trip_id`
  - `scheduled_date`
  - nullable historical source IDs: `itinerary_item_id`, `trip_place_id`, `payer_participant_id`
  - non-null display snapshots: `place_name`, `place_address`, `place_type`, `payer_display_name`
  - `amount_minor`, `currency`, `created_at`
- `expense_splits`
  - `expense_id`
  - nullable historical `participant_id`
  - non-null display snapshot `participant_display_name`
  - `amount_minor`, `split_order`
- Existing index:
  - `expenses_trip_date_created_idx ON expenses (trip_id, scheduled_date, created_at DESC)`

Query changes:

- Add sqlc query in `apps/api/queries/expenses.sql`, for example:
  - `ListDayExpensesByTripAndDate`
    - Filter: `expenses.trip_id = $tripId`, `expenses.scheduled_date = $date`
    - Order: `expenses.created_at DESC, expenses.id DESC`
  - `ListExpenseSplitsByExpenseIDs` or a single join query that keeps expense row order and maps splits by `expense_id` / `split_order`.
- Sort splits by `split_order ASC`.
- Avoid per-expense N+1 queries.

### Business Rules

- Only authenticated current trip participants may view the Day expense list.
- `tripId` must be a valid UUID.
- `date` must be a valid date and fall inside the trip start/end range.
- Missing trip returns not found.
- Valid Day with zero expenses returns `200` and an empty list.
- Expense rows are ordered newest-first by creation time; `id DESC` is used as a deterministic tie-breaker if needed.
- The list is read-only. It must not expose mutation actions or imply tappable detail navigation.
- Display uses saved snapshots from creation time, not live participant/place names.
- The list response avoids nullable display fields by excluding nullable source IDs from the list DTO.
- Split summary is based on persisted split rows and amounts.
- The list endpoint must not recalculate equal splits.

## Acceptance Criteria

- [ ] AC-01: Feature spec and implementation plan exist at `docs/features/0051-expense-list.md`.
- [ ] AC-02: `GET /trips/{tripId}/days/{date}/expenses` is defined in OpenAPI with a `200` list response and standard `400/401/403/404/500` errors.
- [ ] AC-03: The list response uses non-null display fields for place/name, payer display, and split display names; nullable source IDs are not required for the row UI.
- [ ] AC-04: API service authorizes only authenticated trip participants and rejects invalid trip IDs, invalid dates, missing trips, and out-of-range dates.
- [ ] AC-05: A valid Day with no expenses returns `200` with `expenses: []`.
- [ ] AC-06: Expenses are returned newest-first with deterministic tie handling.
- [ ] AC-07: Each expense row includes place/name, amount, payer display, split rows, and created time needed for ordering.
- [ ] AC-08: Existing Day itinerary screen shows a standalone `지출` section below the itinerary.
- [ ] AC-09: Non-empty list rows are compact, non-tappable, and show `place/name + amount` on the first line and `payer + split summary` on the second line.
- [ ] AC-10: Empty expense state remains visible and includes copy plus a `지출 등록` CTA to the existing quick-expense route.
- [ ] AC-11: The feature introduces no detail/edit/delete/filter/trip-wide aggregation behavior.
- [ ] AC-12: API and mobile tests cover authorization/empty/order/mapping and view-model formatting/empty states.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI defines day expense list endpoint and non-null list DTO display fields | Contract/generated | `packages/api-contract/openapi.yaml`, generated outputs | `pnpm verify:generated` |
| Service rejects unauthenticated, invalid trip/date, missing trip, forbidden participant, and out-of-range Day | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Valid Day with no expenses returns an empty list | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Expenses are listed newest-first and splits are sorted by `split_order` | API repository/handler | `apps/api/queries/expenses.sql`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Handler maps response without nullable source IDs and with non-null display snapshots | API handler/mapper | `apps/api/internal/server/server_test.go`, `apps/api/internal/server/mappers.go` | `pnpm --filter @i-um/api test` |
| Mobile helper formats amount and split summary copy | Mobile helper | `apps/mobile/lib/trips/day-expenses.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile helper builds empty state and quick-expense route CTA | Mobile helper | `apps/mobile/lib/trips/day-expenses.test.mts` | `pnpm --filter @i-um/mobile test` |
| Day screen composes itinerary and expense section states | Mobile typecheck | `apps/mobile/app/trips/[tripId]/days/[date].tsx` | `pnpm --filter @i-um/mobile typecheck` |
| Generated API client/server code is in sync | Generated code | `packages/api-contract/gen/**`, `apps/api/internal/openapi/**` | `pnpm verify:generated` |

## Regression Gaps

- No automated React Native E2E interaction is planned for visually confirming the Day screen expense section.
  - Risk: helper/typecheck tests can pass while final layout spacing or tap affordance is visually wrong.
  - Follow-up: verify in internal build/staging smoke; add E2E coverage later if the project standardizes mobile UI automation.
- Repository behavior may be covered through handler/service tests and generated SQL review rather than a dedicated DB integration test, depending on the available test harness.
  - Risk: SQL grouping/order bugs could be caught later than a focused repository integration test.
  - Follow-up: add a repository/integration test if an expense DB test harness exists or is introduced during implementation.

## TDD Implementation Plan

1. Red: Contract and API tests
   - Add failing OpenAPI contract expectations for `GET /trips/{tripId}/days/{date}/expenses` and list-specific non-null display schemas.
   - Add service tests for auth, trip/date validation, participant authorization, missing/out-of-range Day, empty list, and successful list delegation.
   - Add handler tests for `200` empty/non-empty responses, newest-first order, split order, and error status mapping.
   - Verify: `pnpm verify:generated`, `pnpm --filter @i-um/api test`
2. Green: API contract/server/query
   - Update `packages/api-contract/openapi.yaml`.
   - Run generation.
   - Add domain result/types and repository interface method.
   - Add sqlc list query/queries using existing `expenses` and `expense_splits` tables.
   - Implement repository mapping without N+1 queries.
   - Implement service validation/authorization using the `GetDayItinerary` date-range pattern.
   - Implement handler and mapper to list DTOs that omit nullable source IDs.
   - Verify: `pnpm generate`, `pnpm verify:generated`, `pnpm --filter @i-um/api test`, `pnpm --filter @i-um/api build`
3. Red: Mobile helper tests
   - Add failing tests for `buildDayExpensesViewModel` or equivalent:
     - newest-first display order is preserved from API order,
     - amount formatting for KRW/JPY/USD/EUR,
     - split summary formatting for 1/2/3+ splits,
     - empty state copy and quick-expense CTA route,
     - row model contains no nullable display labels.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: Mobile UI
   - Add generated client wrapper `listDayExpenses` in `apps/mobile/lib/trips/client.ts`.
   - Add `apps/mobile/lib/trips/day-expenses.ts` helper for row/empty/error view models.
   - Update `apps/mobile/app/trips/[tripId]/days/[date].tsx` to load expenses and render the `지출` section below the itinerary.
   - Preserve existing itinerary actions and shared-update behavior.
   - Verify: `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck`
5. Refactor: polish and consistency
   - Reuse `formatMoney` from quick-expense helper or move shared money formatting to a common helper if needed.
   - Keep row styles aligned with theme/shared components and existing Day screen cards.
   - Ensure no detail/edit/delete affordance appears in the expense section.
   - Verify targeted API/mobile tests again.
6. Gate: final verification before PR/staging
   - `pnpm verify:generated`
   - `pnpm --filter @i-um/api test`
   - `pnpm --filter @i-um/api build`
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - Broader `pnpm verify` if the implementation touches shared/generated surfaces broadly.

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: Pass (prepared worktree dependencies for generation/mobile tests).
- `pnpm generate`: Pass.
- `pnpm verify:generated`: Pass.
- `pnpm --filter @i-um/api test`: Pass.
- `pnpm --filter @i-um/api build`: Pass.
- `pnpm --filter @i-um/mobile test`: Pass.
- `pnpm --filter @i-um/mobile typecheck`: Pass.

### Manual Smoke

- Day screen with expenses: Not run (manual device/internal build smoke not requested in this step).
- Day screen with no expenses and `지출 등록` CTA: Not run (manual device/internal build smoke not requested in this step).
- Non-participant access: Not run (manual device/internal build smoke not requested in this step).

## Release Notes

- 여행 Day 화면에서 해당 날짜의 지출 목록을 읽기 전용으로 확인할 수 있게 한다.
- 지출이 없을 때도 `지출` 섹션에서 바로 기존 `지출 등록` 흐름으로 이동할 수 있게 한다.

## Open Questions

- None for F-051 implementation.
- Nullability resolution used for this slice: F-051 avoids null display data by returning list-specific DTOs with non-null display snapshots and omitting nullable source IDs. Existing `Expense` create response and DB source-reference nullability remain unchanged for history preservation.

## Follow-up Issues

- Expense detail/edit/delete.
- Dedicated or trip-wide expense screen with filters/grouping/pagination.
- Settlement summary and payment/transfer tracking.
- Global API/DB source-reference nullability change, if product decides historical source IDs must never be nullable.
