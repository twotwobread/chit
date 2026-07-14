# Settlement General Expenses Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build settlement-tab general expense creation with independent payment date/context and compact settlement expense history rows.

**Architecture:** Add a general trip expense create endpoint for settlement entry while keeping the existing schedule-item quick endpoint for Today. Persist `expenses.title` for no-place display titles, keep `expense_date` independent from anchors, and extend trip expense listing with a trip-level section. Mobile reuses the existing quick expense screen in two modes: Today quick mode and settlement general mode.

**Tech Stack:** OpenAPI/oapi-codegen/openapi-typescript-codegen, Go API service/repository/sqlc, PostgreSQL/goose, Expo/React Native TypeScript, node:test mobile helper tests.

## Global Constraints

- Do not expose `trip`, `trip_day`, or `schedule_item` as user-facing expense types.
- Settlement mode default related context is no selection.
- Payment date never auto-selects Day or schedule context.
- Today mode hides payment date and stores the route TripDay date.
- Settlement rows stay compact: title, amount, payer, split count, and conditional payment date only.
- OpenAPI changes happen before generated code updates.
- DB changes happen through goose migration plus `apps/api/schema.sql` update.

---

## Scope

Implement F-278 from `docs/features/0278-settlement-general-expenses.md`:

- API contract and generated artifacts for `POST /trips/{tripId}/expenses`.
- DB title persistence.
- API service/storage create/list/update mapping.
- Mobile settlement-mode request builder, controller state, UI fields, and compact history view model.
- Today default related schedule update and copy change.

## Files likely to change

- `packages/api-contract/openapi.yaml`: Add create endpoint/schemas, `title`, and `tripExpenses`.
- Generated: `packages/api-contract/gen/ts/**`, `apps/api/internal/openapi/server.gen.go`.
- `apps/api/migrations/00024_add_expense_title.sql`: Add nullable `expenses.title`.
- `apps/api/schema.sql`: Schema snapshot.
- `apps/api/queries/expenses.sql`: Insert/update/select title and trip-level list rows.
- Generated: `apps/api/internal/db/expenses.sql.go`.
- `apps/api/internal/trip/types.go`: New create input/record/result and title fields.
- `apps/api/internal/trip/service.go`: Validate general create and title normalization; update title preservation.
- `apps/api/internal/storage/trip_repository.go`: Create general expense transaction; list trip-level expenses.
- `apps/api/internal/server/trip_handlers.go`: New handler and update handler title mapping.
- `apps/api/internal/server/mappers.go`: New response mapper and title fields.
- API tests: `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go`, `apps/api/internal/storage/trip_repository_test.go` where practical.
- `apps/mobile/lib/trips/expense-api.ts`: Add `createTripExpense` wrapper.
- `apps/mobile/lib/trips/quick-expense.ts`: Add settlement-mode title/date/context request builder and Today default helper.
- `apps/mobile/lib/trip-ui/useQuickExpenseController.ts`: Split Today vs settlement behavior.
- `apps/mobile/lib/trip-ui/QuickExpenseEntryParts.tsx`: Add settlement title/date fields and optional related context UI; copy change.
- `apps/mobile/lib/trips/settlement.ts`: Add trip-level section and compact rows.
- `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`: Render new section/chips as needed.
- Mobile tests: `apps/mobile/lib/trips/quick-expense.test.mts`, `apps/mobile/lib/trips/settlement.test.mts`, `apps/mobile/lib/trips/expense-api.test.mts`.

## Test-first plan

1. Add mobile helper tests first for the two product rules that do not need generated code:
   - settlement mode defaults to no related context;
   - Today default picks latest arrived item before pending item.
2. Add OpenAPI schema and generated code.
3. Add API service/handler tests for trip/day/schedule general create.
4. Implement API service/storage.
5. Add mobile request-builder and settlement-list view-model tests.
6. Implement mobile UI/controller.
7. Run generated/API/mobile gates.

## Steps

### Task 1: Contract and DB source changes

**Files:**
- Modify: `packages/api-contract/openapi.yaml`
- Create: `apps/api/migrations/00024_add_expense_title.sql`
- Modify: `apps/api/schema.sql`

**Interfaces:**
- Produces `CreateTripExpenseRequest`, `CreateTripExpenseResponse`.
- Produces `TripsService.createTripExpense(tripId, request)` in generated TS.
- Adds nullable `title` to `Expense` and `UpdateExpenseRequest`.
- Adds `tripExpenses: DayExpenseListItem[]` to `ListTripExpensesResponse`.

- [x] **Step 1: Add OpenAPI path**

Add under `/trips/{tripId}/expenses`:

```yaml
    post:
      operationId: createTripExpense
      summary: Create a general trip expense
      description: Creates a trip-level, Day-level, or schedule-item expense from settlement entry. Payment date is independent from related context.
      tags:
        - Trips
      security:
        - bearerAuth: []
      parameters:
        - name: tripId
          in: path
          required: true
          schema:
            type: string
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateTripExpenseRequest'
      responses:
        '201':
          description: Expense created.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/CreateTripExpenseResponse'
        '400':
          description: Validation error.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '401':
          description: Unauthorized.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '403':
          description: Forbidden.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '404':
          description: Trip, Day, schedule item, payer, or split participant not found.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '409':
          description: Participant or schedule state changed during creation.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
        '500':
          description: Unexpected server error.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ErrorResponse'
```

- [x] **Step 2: Add OpenAPI schemas**

Add near existing expense schemas:

```yaml
    CreateTripExpenseRequest:
      type: object
      additionalProperties: false
      required:
        - title
        - expenseDate
        - tripDayId
        - scheduleItemId
        - amountMinor
        - payerParticipantId
        - splitPolicy
        - memo
      properties:
        title:
          type: string
          nullable: true
          maxLength: 120
          description: Optional display title. Required when no schedule item is selected.
        expenseDate:
          type: string
          format: date
          description: Actual payment/business date. It may be outside the trip range.
        tripDayId:
          type: string
          nullable: true
          description: Optional related Day. If scheduleItemId is present, the server derives/validates the Day from the schedule item.
        scheduleItemId:
          type: string
          nullable: true
          description: Optional related schedule item.
        amountMinor:
          type: integer
          format: int64
          minimum: 1
        payerParticipantId:
          type: string
        splitPolicy:
          $ref: '#/components/schemas/ExpenseSplitPolicy'
        participantIds:
          type: array
          minItems: 1
          uniqueItems: true
          items:
            type: string
          description: Required only when splitPolicy is equal. Must be omitted for manual.
        splits:
          type: array
          minItems: 1
          items:
            $ref: '#/components/schemas/ManualExpenseSplitInput'
          description: Required only when splitPolicy is manual. Must be omitted for equal.
        memo:
          type: string
          nullable: true
          maxLength: 240
    CreateTripExpenseResponse:
      type: object
      additionalProperties: false
      required:
        - expense
      properties:
        expense:
          $ref: '#/components/schemas/Expense'
```

- [x] **Step 3: Extend existing OpenAPI schemas**

In `Expense.required`, add `title` next to `displayTitle`. Add property:

```yaml
        title:
          type: string
          nullable: true
          maxLength: 120
          description: User-entered title for general expenses. Schedule quick expenses may leave it null.
```

In `UpdateExpenseRequest.required`, add `title`; add nullable property with same max length. In `ListTripExpensesResponse.required`, add `tripExpenses`; add property:

```yaml
        tripExpenses:
          type: array
          items:
            $ref: '#/components/schemas/DayExpenseListItem'
```

- [x] **Step 4: Add DB migration**

Create `apps/api/migrations/00024_add_expense_title.sql`:

```sql
-- +goose Up
ALTER TABLE expenses
  ADD COLUMN title text;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_title_length_check CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 120);

-- +goose Down
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_title_length_check;
ALTER TABLE expenses DROP COLUMN IF EXISTS title;
```

- [x] **Step 5: Update schema snapshot**

In `apps/api/schema.sql`, add `title text,` to `expenses` after `expense_date date NOT NULL,` and add:

```sql
  CONSTRAINT expenses_title_length_check CHECK (title IS NULL OR char_length(btrim(title)) BETWEEN 1 AND 120),
```

- [x] **Step 6: Generate contract code**

Run:

```bash
pnpm generate
```

Expected: generated OpenAPI/TS and sqlc files update. If sqlc fails because queries do not yet reference `title`, continue after Task 2 query edits, then rerun.

### Task 2: SQL/storage support for titles and trip-level list

**Files:**
- Modify: `apps/api/queries/expenses.sql`
- Generated: `apps/api/internal/db/expenses.sql.go`
- Modify: `apps/api/internal/storage/trip_repository.go`
- Modify: `apps/api/internal/trip/types.go`

**Interfaces:**
- Produces `Store.CreateTripExpense(ctx, trip.CreateTripExpenseRecord) (trip.CreateTripExpenseResult, error)`.
- Produces `ListTripExpenses(ctx) []TripExpenseDayListItem` with separate trip expenses in service result.

- [x] **Step 1: Update trip domain types**

In `apps/api/internal/trip/types.go`, add `Title *string` to `Expense`, `CreateTripExpenseInput`, `CreateTripExpenseRecord`, and `UpdateExpenseInput/Record`. Add:

```go
type CreateTripExpenseInput struct {
    Title              *string
    ExpenseDate        string
    TripDayID          *string
    ScheduleItemID     *string
    AmountMinor        int64
    PayerParticipantID string
    SplitPolicy        string
    ParticipantIDs     []string
    ManualSplits       []ManualExpenseSplitInput
    Memo               *string
}

type CreateTripExpenseRecord struct {
    TripID             string
    Title              *string
    ExpenseDate        string
    TripDayID          *string
    ScheduleItemID     *string
    AmountMinor        int64
    PayerParticipantID string
    SplitPolicy        string
    ParticipantIDs     []string
    ManualSplits       []ManualExpenseSplitInput
    Memo               *string
    CreatedBy          string
}

type CreateTripExpenseResult struct { Expense Expense }
```

Extend `TripExpenseDayListItem` handling by adding to `ListTripExpensesResult`:

```go
TripExpenses []DayExpenseListItem
```

Add repository interface method:

```go
CreateTripExpense(ctx context.Context, record CreateTripExpenseRecord) (CreateTripExpenseResult, error)
```

- [x] **Step 2: Update insert/select SQL**

In `InsertExpense`, add `title` column and `sqlc.narg(title)`. Include `COALESCE(title, '')::text AS title` in `RETURNING`.

In list/detail selects, add:

```sql
  COALESCE(e.title, '')::text AS title,
  COALESCE(e.title, live_place.name, e.place_name, '지출')::text AS display_title,
```

Replace existing `display_title` expression with the title-first expression.

- [x] **Step 3: Add trip-level list query**

Update `ListTripExpensesByTrip` WHERE clause to include all anchors:

```sql
WHERE e.trip_id = sqlc.arg(trip_id)::uuid
  AND e.anchor_type IN ('trip', 'trip_day', 'schedule_item')
ORDER BY
  CASE WHEN e.anchor_type = 'trip' THEN 0 ELSE 1 END,
  e.trip_day_id ASC NULLS FIRST,
  e.created_at DESC,
  e.id DESC;
```

Trip-level rows have empty `trip_day_id` and will be separated in storage.

- [x] **Step 4: Update update SQL**

Add `title = sqlc.narg(title)` to expense update query and return `title` in `GetExpenseByTripDayAndID`/update return query.

- [x] **Step 5: Regenerate sqlc**

Run:

```bash
pnpm --filter @i-um/api generate
```

Expected: `apps/api/internal/db/expenses.sql.go` compiles with new params/rows.

- [x] **Step 6: Implement storage mapping**

In `trip_repository.go`, map `row.Title` with `optionalString(row.Title)` for `Expense.Title`. For list items no separate title is necessary, but keep displayTitle from SQL.

Implement `CreateTripExpense` by reusing the transaction structure of `CreateQuickExpense`:

1. Begin tx.
2. Fetch trip default currency.
3. Validate optional schedule item with `GetQuickExpenseScheduleItem` when `record.ScheduleItemID != nil`.
4. Validate optional Day with existing active Day query when only `record.TripDayID != nil`.
5. Fetch payer and participants.
6. Build splits with `BuildExpenseSplitRecords`.
7. Decide anchor:
   - schedule -> `anchor_type='schedule_item'`, `trip_day_id=schedule.TripDayID`, `schedule_item_id=schedule.ScheduleItemID`, place fallback from schedule.
   - day -> `anchor_type='trip_day'`, `trip_day_id=record.TripDayID`, `schedule_item_id=nil`, no place.
   - trip -> `anchor_type='trip'`, no day/schedule/place.
8. Insert expense with title, memo, currency, date, payer.
9. Insert splits.
10. Return `Expense` with splits.

### Task 3: API service and handlers

**Files:**
- Modify: `apps/api/internal/trip/service.go`
- Modify: `apps/api/internal/server/trip_handlers.go`
- Modify: `apps/api/internal/server/mappers.go`
- Tests: `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go`

**Interfaces:**
- Produces `Service.CreateTripExpense(ctx, userID, tripID, input)`.
- Produces `apiServer.CreateTripExpense` matching generated interface.

- [x] **Step 1: Add failing service tests**

Add tests for:

```go
func TestServiceCreateTripExpenseCreatesTripAnchorWithoutRelatedContext(t *testing.T)
func TestServiceCreateTripExpenseCreatesDayAnchorWhenOnlyTripDaySelected(t *testing.T)
func TestServiceCreateTripExpenseCreatesScheduleAnchorWhenScheduleSelected(t *testing.T)
func TestServiceCreateTripExpenseRequiresTitleForTripAndDayAnchors(t *testing.T)
func TestServiceCreateTripExpenseAllowsExpenseDateOutsideTripRange(t *testing.T)
```

Expected first run:

```bash
pnpm --filter @i-um/api test -- ./internal/trip -run TestServiceCreateTripExpense
```

FAIL because service method/types are missing.

- [x] **Step 2: Implement validation helpers**

In `service.go`, add:

```go
func normalizeExpenseTitle(value *string) (*string, error) {
    if value == nil { return nil, nil }
    title := strings.TrimSpace(*value)
    if title == "" { return nil, nil }
    if len([]rune(title)) > 120 { return nil, ErrValidation }
    return &title, nil
}
```

Add `CreateTripExpense` service method:

- validate auth and trip UUID;
- validate `expenseDate` with existing date parser or `parseDateStrict` equivalent;
- normalize split input and memo/title;
- validate payer UUID;
- validate nullable Day/schedule UUIDs;
- require title when `scheduleItemID == nil`;
- ensure requester is trip participant via `IsTripParticipant` after trip existence check;
- call repository.

- [x] **Step 3: Add handler and mapper**

In `trip_handlers.go`, implement:

```go
func (s apiServer) CreateTripExpense(w http.ResponseWriter, r *http.Request, tripId string)
```

Decode `openapi.CreateTripExpenseJSONRequestBody`, map fields to `trip.CreateTripExpenseInput`, call service, return `201` with `createTripExpenseResponseToOpenAPI`.

In `mappers.go`, add:

```go
func createTripExpenseResponseToOpenAPI(result trip.CreateTripExpenseResult) openapi.CreateTripExpenseResponse {
    return openapi.CreateTripExpenseResponse{Expense: expenseToOpenAPI(result.Expense)}
}
```

Map `Title: expense.Title` in `expenseToOpenAPI`. Map `Title: body.Title` in update handler input and update service/record.

- [x] **Step 4: Update fake backend**

In `server_test.go` fake backend, implement `CreateTripExpense`. It should append a `DayExpenseListItem` to `dayExpenses` for day/schedule anchors and a separate `tripExpenses` slice/map for trip anchors, returning an `Expense` with title/displayTitle/splits.

- [x] **Step 5: Run API tests**

Run:

```bash
pnpm --filter @i-um/api test -- ./internal/trip ./internal/server
```

Expected: PASS after implementation.

### Task 4: Mobile helper behavior for settlement mode and Today defaults

**Files:**
- Modify: `apps/mobile/lib/trips/quick-expense.ts`
- Modify: `apps/mobile/lib/trips/quick-expense.test.mts`
- Modify: `apps/mobile/lib/trips/expense-api.ts`
- Modify: `apps/mobile/lib/trips/expense-api.test.mts`

**Interfaces:**
- Produces `resolveTodayQuickExpenseInitialItemId(items, preferredItemId)`.
- Produces `buildCreateTripExpenseRequest(...)` for settlement mode.
- Produces `createTripExpense(tripId, request)` wrapper.

- [x] **Step 1: Add failing mobile tests**

Add tests:

```ts
test('settlement mode defaults to no related schedule or Day', () => { ... });
test('today quick expense defaults to latest arrived item before pending item', () => { ... });
test('builds trip-level general expense request when no related context is selected', () => { ... });
test('builds day-level general expense request when only related Day is selected', () => { ... });
test('builds schedule-item general expense request when schedule is selected', () => { ... });
```

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/trips/quick-expense.test.mts
```

Expected: FAIL because helpers are missing or old defaults select a schedule item.

- [x] **Step 2: Implement Today default helper**

Add to `quick-expense.ts`:

```ts
export function resolveTodayQuickExpenseInitialItemId(items: ScheduleItem[], preferredItemId?: string | null): string | null {
  const ordered = orderedItems(items);
  if (preferredItemId && ordered.some((item) => item.id === preferredItemId)) return preferredItemId;
  const arrived = ordered.filter((item) => item.arrivedAt !== null && !item.skippedAt);
  if (arrived.length > 0) return arrived[arrived.length - 1].id;
  return ordered.find((item) => item.arrivedAt === null && !item.skippedAt)?.id ?? null;
}
```

Keep existing inference helper for route fallback if used elsewhere, but controller Today mode should call this helper.

- [x] **Step 3: Implement settlement request builder**

Add:

```ts
export function buildCreateTripExpenseRequest({
  titleInput,
  expenseDate,
  amountInput,
  currency,
  selectedTripDayId,
  scheduleItemId,
  splitPolicy,
  participantIds,
  manualSplitInputs,
  payerParticipantId,
  memoInput,
}: ...): { ok: true; request: CreateTripExpenseRequest } | { ok: false; errors: QuickExpenseFormErrors }
```

Rules:

- parse amount using `parseAmountMinor`;
- require valid `expenseDate` string `/^\d{4}-\d{2}-\d{2}$/`;
- require payer;
- require title when `!scheduleItemId`;
- map title/memo blank to null;
- set `tripDayId: selectedTripDayId`, `scheduleItemId` as nullable;
- preserve equal/manual split behavior.

- [x] **Step 4: Add API wrapper**

In `expense-api.ts` import generated `CreateTripExpenseRequest/Response` and add:

```ts
export async function createTripExpense(tripId: string, request: CreateTripExpenseRequest): Promise<CreateTripExpenseResponse> {
  return runAuthenticatedRequest(() => TripsService.createTripExpense(tripId, request));
}
```

Update `expense-api.test.mts` to assert wrapper/generated method exist.

### Task 5: Mobile controller/UI for settlement entry

**Files:**
- Modify: `apps/mobile/lib/trip-ui/useQuickExpenseController.ts`
- Modify: `apps/mobile/lib/trip-ui/QuickExpenseEntryParts.tsx`
- Modify: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`

**Interfaces:**
- Consumes `buildCreateTripExpenseRequest` and `createTripExpense`.
- Produces one screen with `mode = returnTo === 'settle' ? 'settlement' : 'today'`.

- [x] **Step 1: Add controller state fields**

Add state:

```ts
const [titleInput, setTitleInput] = useState('');
const [expenseDate, setExpenseDate] = useState(localDateString());
const [activeDatePicker, setActiveDatePicker] = useState(false);
const isSettlementMode = returnTo === 'settle';
```

Initialize:

- settlement: `selectedItemId = null`, `selectedTripDayId = null`, `expenseDate = localDateString()`;
- today: use route Day date for `expenseDate`, selected item from `resolveTodayQuickExpenseInitialItemId(todayItems, routeItemId)`.

- [x] **Step 2: Route submit by mode**

In `submit`:

- settlement mode calls `buildCreateTripExpenseRequest` and `createTripExpense(tripId, request)`;
- today mode keeps `buildCreateQuickExpenseRequest` and `createQuickExpense(tripId, date, request)`;
- only today memo follow-up update remains if quick endpoint lacks memo; settlement create sends memo in one request.

- [x] **Step 3: Update form props**

Pass to `QuickExpenseForm`:

```ts
mode={isSettlementMode ? 'settlement' : 'today'}
titleInput={titleInput}
expenseDate={expenseDate}
onUpdateTitle={setTitleInput}
onSelectExpenseDate={setExpenseDate}
```

- [x] **Step 4: Add form fields**

In `QuickExpenseEntryParts.tsx`:

- When mode is settlement, render `지출명` text input before payment date.
- When mode is settlement, render `결제일자` with `TripDateFieldButton` and `TripDatePicker` from `../trips/date-picker`.
- Label schedule section `관련 일정`.
- Allow no schedule selected in settlement mode: selected title `선택 안 함` and a clear option.
- Add Day chips including `전체`/no Day filter; selecting `전체` sets selectedTripDayId null.
- In today mode keep current schedule required behavior.
- Change secondary button label to `돌아가기`.

### Task 6: Settlement expense history grouping and compact rows

**Files:**
- Modify: `apps/mobile/lib/trips/settlement.ts`
- Modify: `apps/mobile/lib/trips/settlement.test.mts`
- Modify: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx` if prop names change.

**Interfaces:**
- Consumes `ListTripExpensesResponse.tripExpenses`.
- Produces `SettlementExpenseHistorySectionViewModel` with `sectionId`, `title`, `helper`, `rows`.

- [x] **Step 1: Add failing settlement tests**

Update `ListTripExpensesResponse` fixtures with `tripExpenses: []`. Add tests:

```ts
test('builds 여행 전체 section for trip-level expenses', () => { ... });
test('settlement row uses compact split count and conditional payment date', () => { ... });
```

Run:

```bash
pnpm --filter @i-um/mobile test -- lib/trips/settlement.test.mts
```

Expected: FAIL until view model changes.

- [x] **Step 2: Update history inputs**

Change `SettlementExpenseHistoryDayInput` to a generic section type or add a `tripExpenses` field. `buildSettlementExpenseHistoryDayInputs(days, response)` should return:

```ts
{
  tripExpenses: response.tripExpenses,
  days: days.map(...),
}
```

If minimizing churn, keep the old function name but return a new object type and update call sites.

- [x] **Step 3: Build compact rows**

Add helper:

```ts
function buildSettlementCompactExpenseRow(expense: DayExpenseListItem, tripId: string, fallbackTripDayId: string | null, dayDate: string | null): DayExpenseRowViewModel
```

Rules:

- `payerLabel = `${name} 결제``;
- `splitLabel = `${unique split participant count}명 분담``;
- if `expense.expenseDate !== dayDate` or section is trip-level, append ` · ${MM.DD} 결제`;
- do not include split amounts in settlement row meta.

- [x] **Step 4: Add trip-level chip/section**

In view model:

- Section id `__trip__`.
- Chip label `여행 전체`.
- Date label omitted.
- Status label `${count}건` or `지출 없음`.
- Default selection order: trip-level section if it has expenses, then today Day, then first expense Day, then first Day.

### Task 7: API/mobile edit title preservation

**Files:**
- Modify: `apps/mobile/lib/trips/expense-edit.ts`
- Modify: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx`
- Modify: `apps/mobile/lib/trips/expense-edit.test.mts`

**Interfaces:**
- Consumes `Expense.title` and `UpdateExpenseRequest.title`.
- Produces edit request preserving or editing title.

- [x] **Step 1: Add test for title preservation**

In `expense-edit.test.mts`, add:

```ts
test('builds update request with nullable general expense title', () => { ... });
```

Expected: FAIL until request builder includes `title`.

- [x] **Step 2: Update edit helper/UI**

Expose `titleInput` in edit view model. For no-place/trip-level expenses, show editable `지출명`; for schedule-linked expenses, show optional title field if `expense.title` exists. Include `title` in `UpdateExpenseRequest` and preserve `null` for legacy quick expenses.

### Task 8: Verification and cleanup

**Files:**
- Modify: `.harness/runs/F278-settlement-general-expenses/artifacts/evaluation-report.md`
- Modify docs if implementation deviates from spec.

- [x] **Step 1: Run generated checks**

```bash
pnpm generate
pnpm verify:generated
```

Expected: PASS.

- [x] **Step 2: Run API tests/build**

```bash
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
```

Expected: PASS or document pre-existing local DB failures separately.

- [x] **Step 3: Run mobile tests/typecheck**

```bash
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```

Expected: PASS.

- [x] **Step 4: Run lint/format targeted or broad gates**

```bash
pnpm lint
pnpm format:check
```

Expected: PASS.

- [x] **Step 5: Write evaluation report**

Record commands, pass/fail, manual smoke not run, and residual risks in `.harness/runs/F278-settlement-general-expenses/artifacts/evaluation-report.md`.

## Verification

Minimum completion gates:

```bash
pnpm generate
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```

Run broader `pnpm verify` if time/environment allows after the targeted gates pass.

## Risks / rollback

- Risk: General expense title changes touch edit/update contracts. Rollback by reverting migration/contract/code together before release.
- Risk: Trip-level expenses already included in settlement calculations but previously hidden from history. Verify list grouping so totals and history are not confusing.
- Risk: Calendar UI in quick expense route can regress layout. Manual internal smoke is recommended.
- Rollback: revert feature branch before merge; after migration deployment, down migration drops `expenses.title`, so do not deploy until generated/API/mobile gates pass.
