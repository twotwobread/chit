# Feature Slice: F-047 빠른 지출 등록

## Metadata

- GitHub Issue: #47
- Status: Implemented (pending staging/internal smoke)
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #47 — [[Feature Slice] F-047 빠른 지출 등록](https://github.com/twotwobread/i-um/issues/47)
- Ouroboros/PM/Seed: Interview `interview_20260625_034156`, Seed `seed_0506dfc87399` (MCP generated; file path not provided)
- Ambiguity Score: `0.117`
- Notes:
  - 목표는 사용자가 현재 장소에서 `금액`과 `결제자`만 입력해 지출을 저장하는 것이다.
  - 현재 저장소에는 expense OpenAPI endpoint/schema, DB table, SQL query, server/mobile 구현이 없다.
  - 현재 Today 실행 화면은 첫 번째 pending `DayItineraryItem`을 다음 장소로 사용한다.
  - #95 시간 선택 가능한 일정 항목은 아직 미구현이므로 F-047의 현재 장소 추론은 현재 execution/progress 모델을 기준으로 한다.

## Goal

사용자는 여행 실행 중 현재 장소에서 지출 금액과 결제자만 입력해 빠르게 지출을 저장할 수 있다.

시스템은 현재/선택된 일정 항목과 장소, 여행 기본 통화, 전체 참여자 균등 분담을 자동으로 채워 저장한다.

## User Flow

### Current place inferred

1. 사용자가 로그인한 상태로 Today 화면(`/`)을 연다.
2. 앱이 오늘 진행 중인 여행과 오늘 일정의 현재 itinerary item을 결정한다.
   - F-047 시점에는 오늘 일정의 첫 번째 pending item이 현재 장소다.
   - #95 이후에는 현재 시간 window 기반 active item을 먼저 사용할 수 있다.
3. 다음 장소 카드에서 사용자가 `지출 등록`을 누른다.
4. 앱이 빠른 지출 입력 화면/시트를 연다.
   - 장소는 현재 itinerary item의 장소로 표시된다.
   - 통화는 여행 기본 통화로 표시된다.
   - 사용자는 금액과 결제자를 입력/선택한다.
5. 사용자가 저장한다.
6. 서버가 현재 active 참여자 전원에 대한 균등 split을 생성하고 지출을 저장한다.
7. 앱은 저장 완료 메시지를 보여주고 Today 화면으로 돌아간다.

### Current place cannot be inferred

1. 사용자가 Today 화면에서 `지출 등록`을 누른다.
2. 앱이 현재 장소를 확정할 수 없으면 오늘 일정 항목 선택 UI를 먼저 보여준다.
   - 선택 대상은 오늘의 itinerary items만이다.
   - lodging item이 오늘 itinerary에 표현되어 있으면 선택 대상에 포함한다.
3. 사용자가 장소/일정 항목을 선택한다.
4. 이후 금액과 결제자를 입력해 저장한다.

### No eligible itinerary item

1. 오늘 일정 항목이 없으면 빠른 지출 진입점을 노출하지 않는다.
2. 앱은 기능이 동작하지 않는 disabled 버튼을 표시하지 않는다.

## Scope

- App UI: Yes
  - `apps/mobile/app/index.tsx` Today 화면에 functional `지출 등록` 진입점 추가
  - 새 route 또는 modal/sheet: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx` 또는 동등한 quick expense UI
  - pure helper: amount parsing/formatting, current item inference, fallback chooser view model
- API Contract: Yes
  - `POST /trips/{tripId}/days/{date}/expenses/quick`
  - Quick expense request/response, expense, split schemas
- API Server: Yes
  - Handler: auth, request decode/response mapping/error mapping
  - Service: validation, authorization, current participant/payer/item checks, currency default, equal split allocation
  - Repository: expense creation transaction and required lookups
- DB: Yes
  - `expenses`, `expense_splits` migration
  - sqlc queries for quick expense creation and lookup inputs
  - `apps/api/schema.sql` and generated DB code update
- Tests: Yes
  - API service/handler/repository behavior where practical
  - Mobile helper tests and route/typecheck coverage
  - Generated code verification
- Deploy/Smoke: Needed before closing implementation
  - Staging API or internal build smoke for happy path and fallback chooser

## Out of Scope

- Expense list, expense detail, edit, delete, receipt/image attachment, memo/category input
- Manual custom split ratios, excluding participants, partial participants, debt settlement, settlement summary
- Currency selection or exchange rate conversion
- Saving an expense without an itinerary item/place link at creation time
- Whole-trip place picker or selecting places not in today's itinerary
- Multi-trip switcher on Today screen
- Time-window schedule logic implementation from #95
- Today expense summary and settlement summary (#50~#59)
- Payment transfer, payment confirmation, or external payment integration

## Requirements

### UI / UX

#### Screens

- `apps/mobile/app/index.tsx`
  - Today success state shows `지출 등록` as a functional action near the next/current place card.
  - Completed day state may show `지출 등록` only when today's itinerary has at least one item and the flow opens the explicit chooser first.
  - Empty itinerary, no ongoing trip, login-required, loading, unavailable, and retryable error states do not show a nonfunctional quick expense action.

- Quick expense screen/sheet: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx` or equivalent
  - Route params: `tripId`, `date`, optional inferred `itemId`.
  - Loads/reuses today's itinerary and trip participants.
  - Shows selected place name, address, Day label/date, trip default currency, amount input, payer selector, and save button.
  - If no valid inferred `itemId` is provided, shows a required selector with today's itinerary items.
  - The place selector includes only itinerary items for the route `date`.
  - The save button is enabled only when:
    - a valid itinerary item is selected,
    - amount parses to a positive integer minor-unit value,
    - payer participant is selected.

#### Copy

- Entry action: `지출 등록`
- Amount label: `금액`
- Payer label: `결제자`
- Place selector label: `장소 선택`
- Save action: `저장하기`
- Saving label: `저장 중...`
- Success message: `지출을 저장했어요.`
- Current-place fallback helper: `현재 장소를 확정할 수 없어 오늘 일정에서 장소를 선택해주세요.`
- Empty chooser copy: `오늘 일정에 등록된 장소가 없어 지출을 저장할 수 없어요.`
- Validation copy:
  - amount missing/invalid: `금액을 1 이상 입력해주세요.`
  - payer missing: `결제자를 선택해주세요.`
  - item missing: `지출을 연결할 장소를 선택해주세요.`

#### Money input and display

- API and DB store `amountMinor` as integer minor units.
- Mobile input is displayed in the trip default currency.
- KRW/JPY: decimal input is not allowed; `1` means 1 won/yen.
- USD/EUR: at most two decimal places are allowed; `12.34` means `1234` minor units.
- Display uses comma separators and Korean-friendly labels where existing design supports them, e.g. `18,500원`, `3,200엔`.

#### Payer selection

- Payer options are active trip participants returned by the participant list API or the quick-expense preparation call if implementation combines the fetch.
- If the current user's participant row can be identified, the UI may preselect it, but the selected payer must remain visible and changeable.
- Removed/nonexistent participants cannot be selected.

#### Loading / empty / error / success states

- Loading: show a compact loading state while itinerary/participants are fetched or save is in progress.
- Empty: if today has no itinerary items, explain that quick expense requires a today itinerary item.
- Validation error: keep user input and show field-level or form-level Korean copy.
- 401: clear invalid session and send user to login using existing auth recovery patterns.
- 403/404: show that the trip/day/place/participant can no longer be used and offer retry/back.
- 409: show that itinerary/participants changed and ask the user to refresh/retry.
- Success: return to Today or dismiss the sheet and show `지출을 저장했어요.`.

### API Contract

Add the following OpenAPI path under `Trips`:

```text
POST /trips/{tripId}/days/{date}/expenses/quick
```

#### Request

```yaml
CreateQuickExpenseRequest:
  type: object
  additionalProperties: false
  required:
    - itineraryItemId
    - amountMinor
    - payerParticipantId
  properties:
    itineraryItemId:
      type: string
      description: Required itinerary item for the selected Day. Must belong to tripId/date.
    amountMinor:
      type: integer
      format: int64
      minimum: 1
      description: Positive amount in currency minor units.
    payerParticipantId:
      type: string
      description: Active trip participant who paid the expense.
```

The request does not include `currency`, split participants, split amounts, trip place, or title. The server derives them.

#### Response

```yaml
CreateQuickExpenseResponse:
  type: object
  required:
    - expense
  properties:
    expense:
      $ref: '#/components/schemas/Expense'

Expense:
  type: object
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
    - splits
    - createdAt
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
      description: Source itinerary item. Present at creation; may become null later if the source item is deleted and history is retained.
    tripPlaceId:
      type: string
      nullable: true
      description: Source trip place. Present at creation; may become null later if the source place is deleted and history is retained.
    place:
      $ref: '#/components/schemas/ExpensePlaceSnapshot'
    amountMinor:
      type: integer
      format: int64
    currency:
      $ref: '#/components/schemas/SupportedCurrency'
    payerParticipantId:
      type: string
      nullable: true
    payerDisplayName:
      type: string
    splits:
      type: array
      items:
        $ref: '#/components/schemas/ExpenseSplit'
    createdAt:
      type: string
      format: date-time

ExpensePlaceSnapshot:
  type: object
  required:
    - name
    - address
    - placeType
  properties:
    name:
      type: string
    address:
      type: string
    placeType:
      $ref: '#/components/schemas/TripPlaceType'

ExpenseSplit:
  type: object
  required:
    - participantId
    - displayName
    - amountMinor
  properties:
    participantId:
      type: string
      nullable: true
    displayName:
      type: string
    amountMinor:
      type: integer
      format: int64
      minimum: 0
```

#### Responses

- `201`: quick expense created.
- `400`: invalid trip/date/item/payer id format or invalid amount.
- `401`: unauthenticated.
- `403`: authenticated user is not a participant of the trip.
- `404`: trip, date, itinerary item, or payer participant does not exist in the required scope.
- `409`: participant or itinerary state changed during creation such that the request must be refreshed.
- `500`: unexpected server error.

### DB Changes

Add a goose migration, for example:

```text
apps/api/migrations/000XX_create_expenses.sql
```

#### `expenses`

Purpose: one expense record created from a quick expense action.

Required columns:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE`
- `scheduled_date date NOT NULL`
- `itinerary_item_id uuid REFERENCES itinerary_items(id) ON DELETE SET NULL`
- `trip_place_id uuid REFERENCES trip_places(id) ON DELETE SET NULL`
- `place_name text NOT NULL`
- `place_address text NOT NULL`
- `place_type text NOT NULL`
- `amount_minor bigint NOT NULL CHECK (amount_minor > 0)`
- `currency text NOT NULL CHECK (currency IN ('KRW', 'JPY', 'USD', 'EUR'))`
- `payer_participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL`
- `payer_display_name text NOT NULL`
- `created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT`
- `created_at timestamptz NOT NULL DEFAULT now()`
- `updated_at timestamptz NOT NULL DEFAULT now()`

Recommended constraints/indexes:

- `place_name` length: `1..120`
- `place_address` length: `1..240`
- `place_type` enum matches `TripPlaceType`
- `payer_display_name` length: `1..80`
- index `(trip_id, scheduled_date, created_at DESC)`
- index `(trip_id, itinerary_item_id)` where `itinerary_item_id IS NOT NULL`
- index `(trip_id, trip_place_id)` where `trip_place_id IS NOT NULL`
- index `(payer_participant_id)` where `payer_participant_id IS NOT NULL`

Creation must require a valid itinerary item and place in service/repository logic. Nullable source ids are allowed only to preserve expense history if future itinerary/place/participant deletes remove the original row.

#### `expense_splits`

Purpose: per-participant equal split snapshot for an expense.

Required columns:

- `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`
- `expense_id uuid NOT NULL REFERENCES expenses(id) ON DELETE CASCADE`
- `participant_id uuid REFERENCES trip_participants(id) ON DELETE SET NULL`
- `participant_display_name text NOT NULL`
- `amount_minor bigint NOT NULL CHECK (amount_minor >= 0)`
- `split_order integer NOT NULL CHECK (split_order >= 1)`
- `created_at timestamptz NOT NULL DEFAULT now()`

Recommended constraints/indexes:

- `participant_display_name` length: `1..80`
- unique `(expense_id, split_order)`
- index `(participant_id)` where `participant_id IS NOT NULL`

#### SQL queries

Add queries in `apps/api/queries/expenses.sql` or the existing domain query file, then regenerate sqlc output.

Needed query/transaction capabilities:

- Verify authenticated user is an active trip participant.
- Fetch trip default currency.
- Fetch itinerary item by `trip_id`, `scheduled_date`, and `itinerary_item_id`, including linked `TripPlaceSummary`.
- Fetch payer participant by `trip_id` and `payerParticipantId`.
- List active trip participants ordered by `joined_at ASC, id ASC`.
- Insert `expenses` row.
- Bulk insert `expense_splits` rows in deterministic `split_order`.
- Return the created expense with splits in `split_order`.

### Business Rules

#### Authorization and scope

- Only authenticated users can create quick expenses.
- The requester must be a current participant of the trip.
- The payer must be a current participant of the same trip.
- Split participants are all current trip participants at creation time.
- Owner/member roles have the same quick expense creation permission in F-047.

#### Required itinerary/place link

- Every quick expense creation request must identify a valid `itineraryItemId` for `tripId` and `date`.
- The server derives `tripPlaceId` and place snapshot from that itinerary item.
- The server must reject requests where the item does not belong to the requested trip/date.
- The server must not create an expense without a valid source itinerary item and place.

#### Current place inference

- F-047 implementation uses client-side Today execution state to preselect the current item.
- Before #95:
  - Sort today itinerary items by `itemOrder`.
  - Use the first item with `arrivedAt === null` as the inferred current item.
  - If no pending item exists, inference is not confident and the explicit chooser is required.
- After #95:
  - A future feature may prefer a timed active schedule window.
  - If no active timed item exists, it should fall back to execution/progress or explicit selection.
- Server still validates the submitted item; it does not trust client inference.

#### Fallback chooser

- If current place inference is unavailable or ambiguous, user must explicitly select a target from today's itinerary items.
- The chooser is limited to the selected `date` only.
- It must not show whole-trip items or raw `trip_places` that are not represented by today itinerary items.
- If the eligible list is empty, quick expense cannot be saved.

#### Currency

- The server uses `trips.default_currency` at creation time.
- The request must not include currency.
- Existing expenses keep their stored currency if the trip default currency changes later.

#### Equal split allocation

- Store all money as integer minor units.
- Let `n` be the number of current active trip participants.
- Let `base = amountMinor / n` using integer division.
- Let `remainder = amountMinor % n`.
- Order participants by `joined_at ASC, participant_id ASC`.
- Assign `base + 1` minor unit to the first `remainder` participants in that deterministic order.
- Assign `base` minor units to the rest.
- Split totals must always equal `amountMinor`.
- Split amount can be `0` when `amountMinor < n`.

#### Concurrency and consistency

- Expense row and split rows must be created in one DB transaction.
- The transaction uses the current participant list at creation time.
- If the payer, itinerary item, or participant list changes between screen load and submit, the server response must be deterministic:
  - missing/removed payer or item: `404`;
  - transaction conflict or inconsistent state: `409`.
- The mobile app should refresh itinerary/participants after `409`.

## Acceptance Criteria

- [ ] AC-01: The feature spec and TDD implementation plan exist at `docs/features/0047-quick-expense-create.md`.
- [ ] AC-02: Today success state exposes a working `지출 등록` action only when quick expense can proceed.
- [ ] AC-03: Empty/no-login/loading/error/no-ongoing states do not expose a disabled or nonfunctional quick expense action.
- [ ] AC-04: Quick expense UI asks only for amount and payer when a current itinerary item is confidently inferred.
- [ ] AC-05: If current item cannot be inferred, the user must select from today's itinerary items before saving.
- [ ] AC-06: The fallback chooser includes only itinerary items for the selected date, including lodging items if represented in today's itinerary.
- [ ] AC-07: The UI validates positive amount, selected payer, and selected itinerary item before submit.
- [ ] AC-08: `POST /trips/{tripId}/days/{date}/expenses/quick` is defined in OpenAPI with generated server/client code.
- [ ] AC-09: The API request contains `itineraryItemId`, `amountMinor`, and `payerParticipantId`; it does not accept currency or manual splits.
- [ ] AC-10: The server rejects unauthenticated users and non-participants.
- [ ] AC-11: The server rejects payer participants outside the trip.
- [ ] AC-12: The server rejects itinerary items outside the requested trip/date.
- [ ] AC-13: The server uses the trip default currency at creation time.
- [ ] AC-14: The server creates one expense and split rows for all current participants in one transaction.
- [ ] AC-15: Equal split allocation distributes uneven remainders by `joined_at ASC, participant_id ASC`.
- [ ] AC-16: Split totals always equal the expense `amountMinor`, including amounts smaller than participant count.
- [ ] AC-17: DB stores money as integer minor units, not floating point.
- [ ] AC-18: Expense creation stores place and participant display snapshots so later itinerary/place/participant deletion does not erase the historical expense meaning.
- [ ] AC-19: Mobile handles 401, 403/404, 409, validation, and retryable errors with Korean copy.
- [ ] AC-20: Staging/internal smoke verifies inferred current-place save and fallback chooser save.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI quick expense schemas and generated code stay in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated server/client | `pnpm generate && pnpm verify:generated` |
| Money amount validation and equal split remainder allocation | API service | `apps/api/internal/trip/*expense*_test.go` or equivalent expense service test | `pnpm --filter @i-um/api test` |
| Auth, participant, payer, item/date validation | API service/handler | `apps/api/internal/trip/*_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| DB migration/query compiles and transaction inserts expense + splits | DB/repository | sqlc generated code + repository tests where available | `pnpm verify:generated && pnpm --filter @i-um/api test` |
| API builds after new generated server interface implementation | API build | Go build gate | `pnpm --filter @i-um/api build` |
| Today current item preselection and no nonfunctional action states | Mobile helper | `apps/mobile/lib/trips/today-execution.test.mts` and/or `quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Fallback chooser is limited to today's itinerary items | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Amount parser/formatter handles KRW/JPY integer and USD/EUR 2 decimals | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Route params/generated client usage typecheck | Mobile typecheck | Expo Router/mobile TS | `pnpm --filter @i-um/mobile typecheck` |
| Full changed-surface gate | Whole repo | generated + API + mobile | `pnpm verify` |

## Regression Gaps

- Staging/internal device smoke is not automated.
  - Risk: navigation/modal behavior, keyboard behavior, auth refresh, and real API wiring can regress outside pure helper tests.
  - Follow-up: Run manual smoke before closing implementation and record result in this document.

## TDD Implementation Plan

1. Red: Contract acceptance
   - Add OpenAPI path/schemas for `POST /trips/{tripId}/days/{date}/expenses/quick`.
   - Run generation/verification before server implementation to expose missing handler/interface implementation.
   - Verify: `pnpm generate && pnpm verify:generated` should fail until server/client generated artifacts and implementation are aligned.

2. Green: Generated code alignment
   - Regenerate TS client, Go OpenAPI types/server interface, and sqlc after query additions.
   - Add placeholder server method only as needed to compile, returning service unavailable until service tests drive behavior.
   - Verify: `pnpm verify:generated`.

3. Red: API service rules
   - Add service tests for:
     - unauthenticated/invalid ids/invalid amount;
     - requester must be participant;
     - payer must be participant in same trip;
     - itinerary item must belong to trip/date;
     - trip default currency is used;
     - all active participants receive splits;
     - remainder allocation is deterministic;
     - `amountMinor < participantCount` still totals correctly.
   - Verify: `pnpm --filter @i-um/api test` fails.

4. Green: API service implementation
   - Add domain types, repository interface methods, and service method for quick expense creation.
   - Keep validation/authorization/business rules in service, not handler.
   - Verify: `pnpm --filter @i-um/api test`.

5. Red: DB/repository persistence
   - Add migration and SQL queries.
   - Add repository tests or service integration-style coverage available in current test harness for transaction behavior.
   - Verify: `pnpm verify:generated` and `pnpm --filter @i-um/api test` fail until query/repository code is complete.

6. Green: DB/repository implementation
   - Implement transaction that fetches trip/item/payer/participants, inserts expense, inserts splits, and maps response.
   - Update `apps/api/schema.sql` and generated DB code.
   - Verify:
     - `pnpm verify:generated`
     - `pnpm --filter @i-um/api test`
     - `pnpm --filter @i-um/api build`

7. Red: Handler/error mapping
   - Add handler tests for 201, 400, 401, 403, 404, 409.
   - Verify: `pnpm --filter @i-um/api test` fails.

8. Green: Handler implementation
   - Decode request, call service, map response to OpenAPI schemas, and map domain errors.
   - Use generated OpenAPI types only.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.

9. Red: Mobile quick expense helpers
   - Add pure tests for:
     - current item inference from Today itinerary;
     - fallback chooser model when inference is missing;
     - no action for empty/no-login/loading/error states;
     - amount parsing/formatting by currency;
     - request body construction from selected item/amount/payer.
   - Verify: `pnpm --filter @i-um/mobile test` fails.

10. Green: Mobile helper/client implementation
    - Add generated client wrapper `createQuickExpense` in `apps/mobile/lib/trips/client.ts`.
    - Add quick expense helper module under `apps/mobile/lib/trips/`.
    - Keep route building typed according to mobile UI rule.
    - Verify: `pnpm --filter @i-um/mobile test`.

11. Red: Mobile UI flow
    - Add Today action view model tests for showing/hiding `지출 등록`.
    - Add route/screen tests where practical through helper view models.
    - Verify: `pnpm --filter @i-um/mobile test` fails.

12. Green: Mobile UI implementation
    - Add Today entry point only in functional states.
    - Add quick expense route/sheet with amount input, payer picker, fallback item picker, save/error/success states.
    - Use theme tokens/shared primitives; do not add raw colors.
    - Verify:
      - `pnpm --filter @i-um/mobile test`
      - `pnpm --filter @i-um/mobile typecheck`

13. Refactor and gates
    - Remove duplication, keep DTOs generated, keep business rules out of handlers/UI.
    - Run final relevant gates:
      - `pnpm verify:generated`
      - `pnpm --filter @i-um/api test`
      - `pnpm --filter @i-um/api build`
      - `pnpm --filter @i-um/mobile test`
      - `pnpm --filter @i-um/mobile typecheck`
      - `pnpm verify` before PR if time/environment allows.

14. Manual smoke
    - Staging/internal build happy path:
      - create/open ongoing trip with today itinerary and at least two participants;
      - tap `지출 등록` from inferred next place;
      - save amount with selected payer;
      - confirm success.
    - Fallback path:
      - use completed day or state with no confident current item but existing today itinerary;
      - choose today item manually;
      - save and confirm success.
    - Error path:
      - try invalid amount and participant/item changed-after-load scenario if feasible.

## Verification Record

### Automated Regression

- `git diff --check`: pass (2026-06-25)
- `pnpm verify:generated`: pass (2026-06-25)
- `pnpm --filter @i-um/api test`: pass (2026-06-25)
- `pnpm --filter @i-um/api build`: pass (2026-06-25)
- `pnpm --filter @i-um/mobile test`: pass (2026-06-25)
- `pnpm --filter @i-um/mobile typecheck`: pass (2026-06-25)
- `pnpm verify`: pass (2026-06-25)
- DB migration check with configured local/test `DATABASE_URL`: `db:status`, `db:migrate`, `db:status`, `db:rollback`, `db:migrate`, `db:status` pass (2026-06-25)

### Manual Smoke

- Inferred current-place quick expense save: not run; requires staging/internal build smoke
- Fallback chooser quick expense save: not run; requires staging/internal build smoke

## Release Notes

- 여행 Today 화면에서 현재 장소 기준으로 지출을 빠르게 저장할 수 있는 기반을 추가한다.
- 금액과 결제자만 입력하면 여행 기본 통화와 전체 참여자 균등 분담이 자동 적용된다.

## Open Questions

- None for F-047 spec drafting. Product decisions for default payload, fallback chooser scope, and split remainder handling were resolved through Ouroboros clarification.

## Follow-up Issues

- #50~#59: 오늘 지출 요약, 정산 요약, settlement flow
- #95: 시간 선택 가능한 일정 항목/타임라인. F-047 current-place inference can later prefer timed active schedule windows.
- Expense list/detail/edit/delete feature slices if needed after quick create
