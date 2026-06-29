# Feature Slice: F-052 지출 수정/삭제

## Metadata

- GitHub Issue: #52
- Status: Implemented (pending manual smoke)
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #52 — [[Feature Slice] F-052 지출 수정/삭제](https://github.com/twotwobread/i-um/issues/52)
- Related blockers/history: #153, #154
- Ouroboros/PM/Seed: Interview `interview_20260629_131515`, Seed `seed_3f11e8c11e4f` (MCP generated; file path not provided)
- Ambiguity Score: `0.11` (`0.1075` in generated seed metadata)
- Notes:
  - F-052 was previously paused because expense display/source-of-truth depended on snapshot columns and unresolved Day/schedule modeling.
  - #153 and #154 are closed, but the current code still uses the existing `expenses` / `expense_splits` schema with Day date, itinerary item, trip place, payer, and display snapshot columns.
  - Minimal v1 is intentionally scoped to current Day expenses and current schema-compatible changes. The broader trip/day/schedule anchor refactor and snapshot removal remain out of scope.
  - User-approved product decisions for v1:
    - Day expense row opens an editor.
    - Editable fields: amount, payer, memo, linked place.
    - Read-only fields: currency, date.
    - Payer is required and must be one current trip participant.
    - Linked place can be selected or cleared.
    - Any trip participant can edit/delete any expense in the trip.
    - Updating amount, payer, or linked place recalculates persisted equal splits across current trip participants.
    - Delete uses confirmation and hard-deletes the expense.

## Goal

여행 참여자가 Day 지출 목록에서 기존 지출을 열어 금액, 결제자, 메모, 연결 장소를 수정하거나 지출을 삭제할 수 있다.

수정/삭제 후 Day 지출 목록으로 돌아오면 변경된 행이 즉시 반영되어, 잘못 등록한 현장 지출을 빠르게 정정할 수 있다.

## User Flow

### Edit an expense

1. 사용자가 로그인한 상태로 여행 Day 화면(`/trips/{tripId}/days/{date}`)을 연다.
2. 앱은 기존 Day 지출 목록을 보여주고 각 지출 row를 편집 가능한 항목으로 표시한다.
3. 사용자가 지출 row를 탭한다.
4. 앱은 지출 편집 화면(`/trips/{tripId}/days/{date}/expenses/{expenseId}/edit`)을 연다.
5. 화면은 현재 금액, 통화, 결제자, 메모, 연결 장소, 분담 미리보기를 보여준다.
6. 사용자는 다음 값만 수정한다.
   - 금액
   - 결제자
   - 메모
   - 연결 장소: 같은 Day의 일정 장소 중 하나를 선택하거나 `장소 없음`으로 해제
7. 사용자가 `저장`을 누른다.
8. 앱/서버는 입력을 검증하고 지출과 분담 row를 갱신한다.
9. 저장 성공 시 편집 화면을 닫고 Day 목록으로 돌아가며 수정된 지출 row가 즉시 반영된다.
10. 저장 실패 시 편집 화면에 머물고 오류 메시지를 표시한다.

### Delete an expense

1. 사용자가 지출 편집 화면에서 `삭제`를 누른다.
2. 앱은 삭제 확인 다이얼로그를 표시한다.
3. 사용자가 확인하면 서버에 삭제를 요청한다.
4. 삭제 성공 시 편집 화면을 닫고 Day 목록으로 돌아가며 해당 지출 row가 즉시 사라진다.
5. 삭제 실패 시 편집 화면에 머물고 오류 메시지를 표시한다.

### Unauthorized or non-participant

1. 인증되지 않은 사용자는 기존 인증 복구 흐름에 따라 로그인으로 이동한다.
2. 여행 참여자가 아닌 사용자는 지출 편집/삭제를 할 수 없다.
3. 삭제되었거나 범위를 벗어난 여행/날짜/지출은 not found 상태로 처리한다.

## Scope

- App UI: Yes
  - Existing Day screen: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - New edit route: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx`
  - New or updated helpers: `apps/mobile/lib/trips/day-expenses.ts`, `apps/mobile/lib/trips/expense-edit.ts`, `apps/mobile/lib/trips/client.ts`
- API Contract: Yes
  - Add detail/update/delete endpoints for a Day expense.
  - Add/update schemas for editable expense detail, update request, update response, memo, and nullable linked place.
  - Update Day expense list schema only as needed for row navigation and refreshed display.
- API Server: Yes
  - Handler, service, repository, mapper, transaction/error mapping for detail/update/delete.
- DB: Yes
  - Add optional `expenses.memo`.
  - Reuse current `expenses.itinerary_item_id`, `trip_place_id`, display snapshot columns, and `expense_splits` rows.
  - No trip_days/schedule_items/anchor refactor in this slice.
- Tests: Yes
  - API service/handler/storage coverage for auth, validation, update, split recalculation, place clear/select, memo, delete, and errors.
  - Mobile helper/screen type coverage for route, validation, edit view model, delete confirmation state, and refreshed list navigation.
- Deploy/Smoke: Needed before closing implementation
  - Staging/internal smoke for editing and deleting a Day expense.

## Out of Scope

- Trip-wide expense list, dedicated expense center, filters, search, grouping, or pagination.
- Creating new expenses outside the existing quick-expense flow.
- Editing currency or scheduled date.
- Custom split ratios, excluding participants from a split, settlement/transfer/payment completion, receipts/images, or categories.
- Soft delete, undo, audit history, or per-author edit permissions.
- Editing trip-level/pre-trip expenses; current v1 only edits Day expenses shown from the existing Day list.
- Persistent `trip_days` / `schedule_items` migration or canonical expense anchor refactor.
- Removing/deprecating existing place/payer/split display snapshot columns.
- Live-update source-of-truth semantics for renamed/deleted places/participants beyond the v1 rules below.

## Requirements

### UI / UX

#### Day expense list entry

- Screen: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
- Existing `지출` section remains below the itinerary.
- Non-empty expense rows become tappable and navigate to the edit route.
- Rows should keep the compact F-051 display:
  - 1줄: 지출 표시명/장소 + 금액
  - 2줄: 결제자 + 분담 요약
- Add an accessible affordance that the row opens edit, without adding inline edit/delete buttons to each row.
- Empty state remains the existing quick-expense CTA.

#### Edit screen

- Route: `/trips/{tripId}/days/{date}/expenses/{expenseId}/edit`
- Loading state: `지출 정보를 불러오는 중...`
- Not found/access state: reuse existing trip/day not-found or access copy where practical.
- Fields:
  - Amount input
    - Required.
    - Must parse using the stored read-only currency.
    - Must be greater than `0` minor units.
    - Validation copy: `금액을 0보다 크게 입력해주세요.`
  - Currency display
    - Read-only.
    - Uses the existing expense currency.
  - Date display
    - Read-only.
    - Uses the route/current expense `scheduledDate`.
  - Payer selector
    - Required.
    - Options are current trip participants.
    - Cannot be cleared.
    - Validation copy: `결제자를 선택해주세요.`
  - Linked place selector
    - Options are itinerary items for the same Day.
    - Includes `장소 없음` to clear the link.
    - If a place is selected, the server derives `tripPlaceId` and display snapshot from that itinerary item.
    - If cleared, the server stores no source place IDs and uses the v1 no-place display snapshot described in DB Changes.
  - Memo input
    - Optional.
    - Trim leading/trailing whitespace before save.
    - Empty trimmed value is stored as `null`.
    - Max length: `240` characters.
    - Validation copy: `메모는 240자 이내로 입력해주세요.`
- Split preview:
  - Show equal split preview based on the entered amount and current trip participants.
  - The preview is informational; users cannot edit split rows in v1.
- Actions:
  - Primary button: `저장`
  - Destructive action: `삭제`
  - Delete confirmation copy:
    - Title: `이 지출을 삭제할까요?`
    - Body: `삭제하면 되돌릴 수 없어요.`
    - Confirm: `삭제`
    - Cancel: `취소`
- Save success:
  - Close edit screen and return to the Day screen.
  - The Day expense list refreshes or updates local state so the updated row is visible immediately.
- Delete success:
  - Close edit screen and return to the Day screen.
  - The deleted row is removed immediately.
- Save/delete failure:
  - Stay on the edit screen.
  - Show generic copy: `지출을 저장할 수 없어요. 잠시 후 다시 시도해주세요.` or `지출을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`

### API Contract

Add endpoints under `Trips`:

```text
GET /trips/{tripId}/days/{date}/expenses/{expenseId}
PATCH /trips/{tripId}/days/{date}/expenses/{expenseId}
DELETE /trips/{tripId}/days/{date}/expenses/{expenseId}
```

#### `GET /trips/{tripId}/days/{date}/expenses/{expenseId}`

- Purpose: fetch editable detail for one Day expense.
- Responses:
  - `200`: expense detail.
  - `400`: invalid `tripId`, `date`, or `expenseId`.
  - `401`: unauthenticated.
  - `403`: authenticated user is not a trip participant.
  - `404`: trip/date/expense not found, or expense does not belong to the route trip/date.
  - `500`: unexpected server error.

#### `PATCH /trips/{tripId}/days/{date}/expenses/{expenseId}`

Request schema:

```yaml
UpdateExpenseRequest:
  type: object
  additionalProperties: false
  required:
    - amountMinor
    - payerParticipantId
    - memo
    - itineraryItemId
  properties:
    amountMinor:
      type: integer
      format: int64
      minimum: 1
    payerParticipantId:
      type: string
      description: Required current trip participant who paid the expense.
    memo:
      type: string
      nullable: true
      maxLength: 240
      description: Optional user memo. Empty strings are normalized to null by the server.
    itineraryItemId:
      type: string
      nullable: true
      description: Same-Day itinerary item to link, or null to clear the linked place.
```

Response schema:

```yaml
UpdateExpenseResponse:
  type: object
  additionalProperties: false
  required:
    - expense
  properties:
    expense:
      $ref: '#/components/schemas/ExpenseDetail'
```

Responses:

- `200`: updated expense detail.
- `400`: invalid path/body, amount <= 0, memo too long, or malformed IDs.
- `401`: unauthenticated.
- `403`: authenticated user is not a trip participant.
- `404`: trip/date/expense not found; payer not found in trip; linked itinerary item not found in the same trip/date.
- `409`: referenced payer/place changed during save or split recalculation could not be persisted due to concurrent changes.
- `500`: unexpected server error.

#### `DELETE /trips/{tripId}/days/{date}/expenses/{expenseId}`

- Request body: none.
- Success response: `204 No Content`.
- Error responses:
  - `400`: invalid path IDs/date.
  - `401`: unauthenticated.
  - `403`: authenticated user is not a trip participant.
  - `404`: trip/date/expense not found, or expense does not belong to the route trip/date.
  - `500`: unexpected server error.

#### Schemas

Add `ExpenseDetail` or evolve the existing `Expense` schema so edit screens can rely on:

```yaml
ExpenseDetail:
  type: object
  additionalProperties: false
  required:
    - id
    - tripId
    - scheduledDate
    - itineraryItemId
    - tripPlaceId
    - place
    - amountMinor
    - currency
    - payerParticipantId
    - payerDisplayName
    - memo
    - splits
    - createdAt
    - updatedAt
  properties:
    id:
      type: string
    tripId:
      type: string
    scheduledDate:
      type: string
      format: date
    itineraryItemId:
      type: string
      nullable: true
    tripPlaceId:
      type: string
      nullable: true
    place:
      $ref: '#/components/schemas/ExpensePlaceSnapshot'
    amountMinor:
      type: integer
      format: int64
      minimum: 1
    currency:
      $ref: '#/components/schemas/SupportedCurrency'
    payerParticipantId:
      type: string
      nullable: true
    payerDisplayName:
      type: string
      minLength: 1
    memo:
      type: string
      nullable: true
      maxLength: 240
    splits:
      type: array
      items:
        $ref: '#/components/schemas/ExpenseSplit'
    createdAt:
      type: string
      format: date-time
    updatedAt:
      type: string
      format: date-time
```

Notes:

- `payerParticipantId` remains nullable in response for historical compatibility, but update requests require a valid payer.
- `itineraryItemId`/`tripPlaceId` are nullable because v1 allows clearing the linked place and existing history can retain null source IDs.
- The list endpoint may keep its F-051 list-specific DTO. If the list row display should reflect memo or no-place labels, update `DayExpenseListItem` minimally rather than exposing mutation-only fields.

### DB Changes

Add a migration for optional memo:

- `expenses.memo text NULL`
- Constraint: memo is null or `char_length(memo) <= 240`

Use existing columns for v1 edit semantics:

- `expenses.amount_minor`: update from request; must remain `> 0`.
- `expenses.currency`: read-only; never changed by F-052.
- `expenses.scheduled_date`: read-only; never changed by F-052.
- `expenses.payer_participant_id`: update to the selected participant.
- `expenses.payer_display_name`: update snapshot from the selected participant at save time.
- `expenses.itinerary_item_id`: update to selected same-Day itinerary item or `NULL` when cleared.
- `expenses.trip_place_id`: derive from selected itinerary item or `NULL` when cleared.
- `expenses.place_name`, `place_address`, `place_type`:
  - When linked to an itinerary item, update snapshot from that itinerary item's trip place.
  - When link is cleared, store the v1 no-place display snapshot:
    - `place_name = '장소 없음'`
    - `place_address = '연결된 장소 없음'`
    - `place_type = 'etc'`
  - This is a v1 compatibility compromise because the existing list DTO and DB constraints require non-null place snapshot fields.
- `expenses.updated_at`: set to transaction time on successful update.
- `expense_splits`: delete and recreate split rows in the same transaction when an expense is updated.

Repository/query changes:

- Add query to fetch one expense by `trip_id`, `scheduled_date`, and `expense_id`.
- Add query to update expense scalar fields and display snapshots.
- Add query to delete split rows by expense ID.
- Reuse or add query to list current trip participants ordered by `joined_at ASC, id ASC`.
- Reuse equal split allocation and insert new split rows with deterministic `split_order`.
- Add query to hard-delete one expense by `trip_id`, `scheduled_date`, and `expense_id`.
- Avoid N+1 split reads for detail/list where possible.

Delete behavior:

- `DELETE` hard-deletes `expenses` row.
- Existing `expense_splits.expense_id REFERENCES expenses(id) ON DELETE CASCADE` removes split rows.
- No soft-delete marker or restore behavior in v1.

### Business Rules

- Only authenticated users can edit/delete expenses.
- Any current trip participant can edit/delete any expense in that trip.
- `tripId` and `expenseId` must be valid UUIDs.
- `date` must be a valid date and fall inside the trip start/end range.
- The target expense must belong to the route `tripId` and `date`.
- Amount is required and must be greater than `0` minor units.
- Currency is immutable in v1.
- Scheduled date is immutable in v1.
- Payer is required and must be a current participant in the same trip.
- Linked place is optional.
  - If present, it must be an itinerary item in the same trip and same date.
  - If null, the expense becomes unlinked from a source place but keeps a non-null v1 display snapshot.
- Memo is optional.
  - Trim before save.
  - Empty string becomes `null`.
  - Max length is `240` characters.
- Each successful update recalculates persisted equal splits across current trip participants using the same deterministic allocation as quick expense creation.
- Split rows are persisted; clients must not recalculate saved split summaries for display.
- If there are no current trip participants during split recalculation, save fails with a conflict or validation/domain error. Normal trips should always have at least one participant.
- Updating payer also updates payer display snapshot from the current participant display name.
- Updating linked place also updates place display snapshot from the selected itinerary item.
- Clearing linked place sets source IDs to null and stores the v1 no-place display snapshot.
- Deleting an expense removes the expense and its split rows permanently.
- Save/delete failures do not navigate away from the edit screen.

## Acceptance Criteria

- [ ] AC-01: Feature spec and implementation plan exist at `docs/features/0052-update-delete-expense.md`.
- [ ] AC-02: Day expense rows become tappable and navigate to `/trips/{tripId}/days/{date}/expenses/{expenseId}/edit`.
- [ ] AC-03: The edit screen loads one expense and shows amount, currency, date, payer, memo, linked place, and split preview.
- [ ] AC-04: Users can edit only amount, payer, memo, and linked place.
- [ ] AC-05: Currency and scheduled date are read-only and are not changed by save requests.
- [ ] AC-06: Amount is required and must be greater than `0` minor units before save.
- [ ] AC-07: Payer is required and must be one current trip participant; it cannot be cleared.
- [ ] AC-08: Linked place can be changed to a same-Day itinerary item or cleared to `장소 없음`.
- [ ] AC-09: Saving updates amount/payer/memo/place in one transaction and recalculates persisted equal splits across current trip participants.
- [ ] AC-10: Saving success closes the editor and immediately reflects the updated row in the Day expense list.
- [ ] AC-11: Saving failure keeps the user on the edit screen and shows an error message.
- [ ] AC-12: Delete action shows a confirmation dialog before calling the API.
- [ ] AC-13: Delete success hard-deletes the expense, cascades split rows, returns to the Day list, and immediately removes the row.
- [ ] AC-14: Delete failure keeps the user on the edit screen and shows an error message.
- [ ] AC-15: Any current trip participant can edit/delete any expense in the trip; non-participants receive forbidden.
- [ ] AC-16: API contract defines detail, update, and delete endpoints with standard `400/401/403/404/409/500` errors as applicable.
- [ ] AC-17: DB migration adds optional memo and update/delete queries without introducing the trip_days/schedule_items anchor refactor.
- [ ] AC-18: API and mobile tests cover validation, authorization, split recalculation, place clear/select, memo persistence, hard delete, and UI state transitions.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI defines detail/update/delete endpoints and schemas | Contract/generated | `packages/api-contract/openapi.yaml`, generated outputs | `pnpm verify:generated` |
| Service rejects unauthenticated, invalid trip/date/expense IDs, missing trip, out-of-range date, non-participant, and wrong-day expense | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Update validates amount, required payer, memo length, same-Day itinerary item, and optional cleared place | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Update persists memo, payer snapshot, place/no-place snapshot, amount, updated_at, and immutable currency/date | API repository/handler | `apps/api/queries/expenses.sql`, `apps/api/internal/storage/trip_repository.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Update deletes/recreates split rows with equal split allocation across current participants | API domain/repository | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Delete hard-deletes expense and cascades split rows | API handler/repository | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Mobile builds edit route and tappable Day expense row action | Mobile helper/screen | `apps/mobile/lib/trips/day-expenses.test.mts`, Day screen typecheck | `pnpm --filter @i-um/mobile test` / `pnpm --filter @i-um/mobile typecheck` |
| Mobile edit helper validates amount/payer/memo and supports `장소 없음` | Mobile helper | `apps/mobile/lib/trips/expense-edit.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile save/delete success returns to Day list and triggers list refresh/update | Mobile screen/typecheck | edit screen, Day screen | `pnpm --filter @i-um/mobile typecheck` |
| Generated API client/server code is in sync | Generated code | `packages/api-contract/gen/**`, `apps/api/internal/openapi/**` | `pnpm verify:generated` |

## Regression Gaps

- No automated React Native E2E flow is planned for tapping a row, editing fields, confirming delete, and visually checking the returned Day list.
  - Risk: helper tests/typecheck can pass while navigation, keyboard layout, or dialog behavior is awkward on device.
  - Follow-up: verify in internal build/staging smoke; add E2E later if the project standardizes mobile UI automation.
- Repository behavior may be covered through handler/service tests and generated SQL review rather than a dedicated migration-backed DB integration test, depending on the available test harness.
  - Risk: transaction or cascade behavior could be caught later than a focused repository integration test.
  - Follow-up: add a repository/integration test if an expense DB test harness exists or is introduced during implementation.

## TDD Implementation Plan

1. Red: Contract and API behavior tests
   - Add failing OpenAPI expectations for:
     - `GET /trips/{tripId}/days/{date}/expenses/{expenseId}`
     - `PATCH /trips/{tripId}/days/{date}/expenses/{expenseId}`
     - `DELETE /trips/{tripId}/days/{date}/expenses/{expenseId}`
     - `ExpenseDetail`, `UpdateExpenseRequest`, `UpdateExpenseResponse`, and memo fields.
   - Add service tests for auth, participant permission, invalid IDs/date, missing trip, out-of-range date, wrong-day expense, invalid amount, missing/invalid payer, invalid same-Day itinerary item, memo length, and successful update/delete.
   - Add handler tests for status mapping and response shapes.
   - Verify: `pnpm verify:generated`, `pnpm --filter @i-um/api test`
2. Green: API contract/server/domain/storage
   - Update `packages/api-contract/openapi.yaml`.
   - Run generation.
   - Add domain input/result types for expense detail/update/delete.
   - Add repository interface methods.
   - Add migration for `expenses.memo`.
   - Add sqlc queries for detail, update, split delete/reinsert, and hard delete.
   - Implement service validation/authorization using existing trip/date participant patterns.
   - Implement update transaction:
     - Fetch/validate expense by trip/date/id.
     - Validate payer and optional same-Day itinerary item.
     - Normalize memo.
     - Update expense scalar/snapshot fields.
     - Delete existing splits.
     - Allocate equal splits across current participants.
     - Insert new split rows.
     - Return updated detail.
   - Implement hard delete transaction/query.
   - Implement handlers/mappers/error mapping.
   - Verify: `pnpm generate`, `pnpm verify:generated`, `pnpm --filter @i-um/api test`, `pnpm --filter @i-um/api build`
3. Red: Mobile helper tests
   - Add failing tests for:
     - edit route builder,
     - Day expense row action/tappability model,
     - edit view model for amount/currency/date/payer/place/memo,
     - amount and memo validation,
     - place clear option,
     - split preview recalculation,
     - save/delete failure copy.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: Mobile UI
   - Add generated client wrappers for get/update/delete expense.
   - Add `apps/mobile/lib/trips/expense-edit.ts` helper for view model, validation, request building, split preview, and failure messages.
   - Update Day expense rows to navigate to the edit route.
   - Add edit screen route with loading/error/success states, fields, save action, delete confirmation, and navigation back to Day list.
   - Refresh or update Day expense list after save/delete.
   - Verify: `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck`
5. Refactor: consistency and polish
   - Reuse existing `formatMoney`, amount parsing, equal split helper logic where practical.
   - Keep screen styling aligned with theme/shared components and no raw colors.
   - Keep Korean copy short and action-oriented.
   - Ensure no custom split/date/currency editing leaks into UI.
   - Verify targeted API/mobile tests again.
6. Gate: final verification before PR/staging
   - `pnpm verify:generated`
   - `pnpm --filter @i-um/api test`
   - `pnpm --filter @i-um/api build`
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - For DB migration: apply/status/rollback/re-apply against a test database.
   - Broader `pnpm verify` if generated/shared surfaces change broadly.

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: Pass (prepared worktree dependencies for generation/mobile tests).
- `pnpm generate`: Pass.
- `pnpm verify:generated`: Pass.
- `cd apps/api && go test ./internal/trip ./internal/server ./cmd/api`: Pass.
- `pnpm --filter @i-um/api lint`: Pass.
- `pnpm --filter @i-um/api format:check`: Pass.
- `pnpm --filter @i-um/api build`: Pass.
- `pnpm --filter @i-um/api test`: Fail in pre-existing/local storage integration DB state; `apps/api/internal/storage` tests cannot find `itinerary_items` / `day_lodging_places` even though goose reports current version `14` with no migrations to run.
- `pnpm --filter @i-um/mobile test`: Pass.
- `pnpm --filter @i-um/mobile typecheck`: Pass.
- `pnpm --filter @i-um/mobile lint`: Pass.
- `pnpm --filter @i-um/mobile format:check`: Pass.
- DB migration apply/status/rollback/re-apply: Not completed because the local `DATABASE_URL` database is in an inconsistent goose/schema state (`goose: no migrations to run. current version: 14`, but storage tests report missing pre-existing tables).

### Manual Smoke

- Edit amount/payer/memo/place: Not run (manual device/internal build smoke not requested in this step).
- Clear linked place: Not run (manual device/internal build smoke not requested in this step).
- Delete expense with confirmation: Not run (manual device/internal build smoke not requested in this step).
- Non-participant access: Not run (manual device/internal build smoke not requested in this step).

## Release Notes

- Day 지출 목록에서 기존 지출을 열어 금액, 결제자, 메모, 연결 장소를 수정할 수 있게 한다.
- 잘못 등록한 지출은 확인 후 삭제할 수 있게 한다.

## Open Questions

- None blocking for minimal v1 after Ouroboros clarification.

## Follow-up Issues

- Canonical expense anchor model: trip-level/pre-trip, day-level, and schedule-item expenses without relying on the current snapshot workaround.
- Snapshot column deprecation/removal and live source-of-truth display semantics for renamed/deleted places/participants.
- Custom split policy and split editing UI.
- Trip-wide/pre-trip expense creation and editing.
- Soft delete, undo, audit history, or stricter edit permissions if product later needs them.
