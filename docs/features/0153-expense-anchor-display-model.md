# Feature Slice: Expense anchor display model

## Metadata

- GitHub Issue: #153
- Status: In Progress
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #153
- Ouroboros/PM/Seed: Interview `interview_20260628_070006`, ambiguity `0.1545`, Seed `seed_b276c8f2ab09` (generated via MCP)
- Notes: User confirmed live-linked names are the primary display source while references resolve, snapshots are fallback-only internals, and #153 fully updates the current day expense list + schedule-item quick-create API/UI surfaces while leaving edit/delete APIs and UI to #52/F-052.

## Goal

Make expense display identity come from canonical linked IDs instead of copied display snapshots for the current expense list/create surfaces. After this slice, day expense list and quick-create responses use live schedule/place/participant data whenever it is still resolvable, while existing snapshot columns remain internal fallback data for deleted, unlinked, or unresolved references.

## User Flow

1. A participant opens a trip Day and views expenses for that Day.
2. The app receives canonical expense display DTOs where place/title, payer, and split participant names are resolved from live linked rows when possible.
3. If a linked place, schedule item, payer, or split participant can no longer be resolved, the API still returns a readable expense using stored fallback text.
4. A participant creates a quick expense from a schedule item; the response uses the same canonical display DTO and stores the selected equal-split policy for later F-052 amount edits.

## Scope

- App UI: Yes. Current day expense list UI and quick expense UI consume the canonical display DTO.
- API Contract: Yes. Existing day list and quick-create response schemas move away from snapshot-shaped naming and expose resolved display objects.
- API Server: Yes. Handler/service/repository layers resolve display values by live joins first, fallback values second.
- DB: Yes. Persist split policy and adjust fallback storage semantics needed for canonical display/future non-place anchors.
- Tests: API repository/service/handler tests, generated contract checks, and mobile helper/type tests for list/create display DTOs and fallback cases.
- Deploy/Smoke: Staging smoke recommended because this changes generated API types consumed by mobile.

## Out of Scope

- Expense edit API, delete API, and mobile edit/delete UI (#52/F-052).
- Trip-level or trip-day general expense creation UI/API beyond the existing day list and schedule-item quick-create surfaces.
- Custom split ratio/amount UI.
- Settlement, payment completion, reimbursement, receipt/image attachment, or attachment storage.
- Final category/memo/paid-on UX decisions for general expense creation; see Open Questions.
- Physical removal of fallback text columns. This slice removes them as primary display sources, not as durability fallback storage.

## Requirements

### UI / UX

- Screens:
  - Day expense list in the trip Day screen consumes the new list item DTO.
  - Quick expense screen keeps the current schedule-item flow and consumes the new create response DTO.
- Existing visible behavior should stay familiar:
  - List row first line: resolved display title/place + amount.
  - List row second line: `결제 {payer.displayName} · {split summary}`.
  - Quick-create form still asks for amount, payer, and selected split participants.
- The UI must not display technical source labels such as `live` or `fallback` to users.
- If a place display object is unavailable for a non-place future expense, the row uses server-provided `displayTitle` instead of rendering an empty place name.
- If a payer or split participant was removed, show the fallback display name exactly as returned by the API.
- Korean copy remains short and action-oriented; no new decorative UI copy is required for this model change.

### API Contract

OpenAPI is the source of truth and should be updated before implementation. Compatibility with old snapshot-shaped expense response names is not required for the in-scope surfaces.

#### Day expense list

```text
GET /trips/{tripId}/days/{tripDayId}/expenses
```

- Keep the endpoint and auth/error behavior.
- Response remains ordered newest-first.
- `DayExpenseListItem` should expose canonical display fields instead of `ExpensePlaceSnapshot` and plain `payerDisplayName`/split `displayName` fields.

Target shape:

```yaml
ListDayExpensesResponse:
  required: [expenses]
  properties:
    expenses:
      type: array
      items:
        $ref: '#/components/schemas/DayExpenseListItem'

DayExpenseListItem:
  required:
    - id
    - anchorType
    - tripDayId
    - scheduleItemId
    - expenseDate
    - displayTitle
    - place
    - amountMinor
    - currency
    - payer
    - splitPolicy
    - splits
    - createdAt
  properties:
    id: string
    anchorType: ExpenseAnchorType
    tripDayId:
      type: string
      nullable: true
    scheduleItemId:
      type: string
      nullable: true
    expenseDate:
      type: string
      format: date
    displayTitle:
      type: string
      minLength: 1
      description: User-facing title resolved by the server. For current schedule-item quick expenses this is the linked place/schedule display name or fallback place name.
    place:
      $ref: '#/components/schemas/ExpensePlaceDisplay'
      nullable: true
    amountMinor:
      type: integer
      format: int64
      minimum: 1
    currency: SupportedCurrency
    payer:
      $ref: '#/components/schemas/ExpenseParticipantDisplay'
    splitPolicy: ExpenseSplitPolicy
    splits:
      type: array
      items:
        $ref: '#/components/schemas/DayExpenseSplitListItem'
    createdAt:
      type: string
      format: date-time
```

#### Quick expense create

```text
POST /trips/{tripId}/days/{tripDayId}/expenses/quick
```

- Request stays schedule-item focused:
  - `scheduleItemId`
  - `amountMinor`
  - `payerParticipantId`
  - `participantIds`
- Response uses the same canonical display model as list items.
- Quick create always stores `anchorType = schedule_item` and `splitPolicy = equal`.
- `expenseDate` defaults to the selected `TripDay.date` and remains distinct from the anchor FK.
- The server captures fallback text from the live schedule/place/participant rows at creation time, but clients do not treat that fallback as the primary source.

Target create response:

```yaml
CreateQuickExpenseResponse:
  required: [expense]
  properties:
    expense:
      $ref: '#/components/schemas/Expense'
```

`Expense` should use the same display components as `DayExpenseListItem` and include any additional fields already needed by quick-create success UI.

#### Shared schemas

```yaml
ExpenseAnchorType:
  type: string
  enum: [trip, trip_day, schedule_item]

ExpenseDisplaySource:
  type: string
  enum: [live, fallback]
  description: For client diagnostics/tests; not user-visible copy.

ExpenseSplitPolicy:
  type: string
  enum: [equal]
  description: Persisted split policy for current quick expenses. Future custom split support may add enum values.

ExpensePlaceDisplay:
  required: [tripPlaceId, name, address, placeType, source]
  properties:
    tripPlaceId:
      type: string
      nullable: true
    name:
      type: string
      minLength: 1
    address:
      type: string
      nullable: true
    placeType:
      $ref: '#/components/schemas/TripPlaceType'
      nullable: true
    source:
      $ref: '#/components/schemas/ExpenseDisplaySource'

ExpenseParticipantDisplay:
  required: [participantId, displayName, source]
  properties:
    participantId:
      type: string
      nullable: true
    displayName:
      type: string
      minLength: 1
    source:
      $ref: '#/components/schemas/ExpenseDisplaySource'

DayExpenseSplitListItem:
  required: [splitOrder, participant, amountMinor]
  properties:
    splitOrder:
      type: integer
      minimum: 1
    participant:
      $ref: '#/components/schemas/ExpenseParticipantDisplay'
    amountMinor:
      type: integer
      format: int64
      minimum: 0

ExpenseSplit:
  required: [participant, amountMinor]
  properties:
    participant:
      $ref: '#/components/schemas/ExpenseParticipantDisplay'
    amountMinor:
      type: integer
      format: int64
      minimum: 0
```

### DB Changes

Existing post-#154 facts:

- `expenses.anchor_type` already supports `trip`, `trip_day`, and `schedule_item` with nullable `trip_day_id` and `schedule_item_id` constraints.
- `expense_date` is required and is not the FK source of truth.
- `expenses.trip_place_id`, `place_name`, `place_address`, `place_type`, `payer_display_name`, and `expense_splits.participant_display_name` exist as copied display data.
- `expense_splits.participant_id` and `expenses.payer_participant_id` are nullable and can fall back to stored display text after participant removal.

Required changes for #153:

- Add persisted split policy:

```text
expenses
  split_policy text NOT NULL DEFAULT 'equal'
    CHECK (split_policy in ('equal'))
```

- Backfill existing expenses to `split_policy = 'equal'` because all current quick expenses are equal-split expenses.
- Make place fallback columns internal and nullable-friendly for future non-place anchors:
  - `place_name` / `place_address` / `place_type` are fallback display fields, not canonical display sources.
  - Drop `NOT NULL` from these place fallback columns if needed so future trip-level/day-level expenses do not need fake place data.
  - Keep existing length/type checks for non-null values.
- Keep `payer_display_name` and `expense_splits.participant_display_name` non-null fallback fields for removed participant history.
- Do not drop existing fallback columns in #153; they are required to preserve readable history after unlink/delete.
- Do not expose `expenses.trip_place_id` as the canonical place source for schedule-item expenses. For `anchor_type = schedule_item`, derive live place through `schedule_items.trip_place_id -> trip_places.id`; keep `expenses.trip_place_id` only as legacy/fallback-compatible storage for this slice.
- Add or adjust indexes only if the new display-resolution query plan needs them; expected existing indexes are sufficient for `trip_day_id`, `schedule_item_id`, `trip_place_id`, and participant lookups.

### Business Rules

#### Canonical display resolution

- Display identity is resolved live-first:
  1. Use linked schedule/place/participant rows when they exist and are eligible for normal user display.
  2. Use stored fallback fields only when the linked source is missing, unlinked, deleted, or otherwise not resolvable for that expense response.
- For `schedule_item` expenses:
  - Canonical anchor is `expenses.schedule_item_id` plus `expenses.trip_day_id`.
  - Live place display is derived from `schedule_items.trip_place_id -> trip_places`.
  - If the schedule item is deleted/unresolvable or its place cannot be resolved, use fallback `expenses.place_*` when present.
- For `trip_day` expenses:
  - Canonical anchor is `expenses.trip_day_id`.
  - Place display is nullable unless a future direct place relation is explicitly added.
  - Day list includes these expenses because they belong to the requested Day.
- For `trip` expenses:
  - Canonical anchor is `trip_id` only.
  - They are not returned by the day expense list unless a future endpoint explicitly includes trip-level expenses.
- Payer display:
  - Use `trip_participants.display_name` while `payer_participant_id` resolves.
  - Use `expenses.payer_display_name` after participant unlink/delete.
- Split participant display:
  - Use `trip_participants.display_name` while `expense_splits.participant_id` resolves.
  - Use `expense_splits.participant_display_name` after participant unlink/delete.
- Before code intentionally unlinks or deletes a source row referenced by an expense, the service should refresh fallback fields from the latest live values when that source is still readable. This keeps fallback text as the last known identity, not an obsolete creation-time value.

#### Quick create

- Quick create remains schedule-item only in #153.
- The selected schedule item must belong to the requested active `tripDayId` and `tripId`.
- The selected payer and split participants must belong to the trip.
- The server stores:
  - `anchor_type = 'schedule_item'`
  - `trip_day_id` from the selected Day
  - `schedule_item_id` from the request
  - `expense_date = trip_days.date`
  - fallback place text from the current linked place
  - fallback payer/split display names from current participants
  - `split_policy = 'equal'`
- Equal split allocation continues to use selected participants ordered by joined time and ID, with any remainder assigned deterministically by that order.

#### Split policy for F-052

- `split_policy = 'equal'` means later amount edits can recalculate split amounts across the existing split rows while preserving split participant membership and split order.
- Removed participants remain represented by their split row and fallback display name until an explicit future edit removes them.
- Custom split ratios/amounts are out of scope, but the policy field must not block adding future values such as `custom`.

#### Category, memo, and paid date

- #153 does not add category/memo input to the current quick-create UI.
- `expense_date` remains the current canonical business date exposed by API responses.
- `expense_date` must not implicitly choose or change `trip_day_id`; anchors and dates remain separate concepts.
- Product choices for category enum/default, optional memo, and whether to rename/expose `paidOn` are documented as Open Questions before future general expense creation.

## Acceptance Criteria

- [ ] AC-01: The feature spec exists at `docs/features/0153-expense-anchor-display-model.md` and records the Ouroboros interview/seed.
- [ ] AC-02: OpenAPI replaces snapshot-shaped expense display schemas on the in-scope list/create responses with canonical live-linked display schemas.
- [ ] AC-03: Day expense list returns live place/title, payer, and split participant display values when linked rows resolve.
- [ ] AC-04: Day expense list returns fallback place/title, payer, and split participant display values when linked rows are deleted, unlinked, or unresolved.
- [ ] AC-05: Quick-create response uses the same canonical display DTO as the list surface.
- [ ] AC-06: Quick create still validates schedule item, payer, selected split participants, and positive amount as before.
- [ ] AC-07: Quick create stores `split_policy = 'equal'` and existing expenses are backfilled to `equal`.
- [ ] AC-08: `expenses.place_*` fallback fields are no longer required as primary display source and can be nullable for future non-place anchors without creating fake places.
- [ ] AC-09: Schedule-item expense display derives live place from `schedule_items -> trip_places`, not from `expenses.trip_place_id` as the canonical source.
- [ ] AC-10: Mobile day expense list and quick-create success UI consume the new generated DTOs and continue rendering readable rows/summaries.
- [ ] AC-11: Edit/delete APIs and mobile UI are not introduced by #153 and remain blocked/deferred to #52/F-052.
- [ ] AC-12: Category/memo/paid-on product decisions remain explicit Open Questions rather than implicit implementation guesses.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI exposes canonical display DTOs for list/create | Contract/generated | `packages/api-contract/openapi.yaml`, generated outputs | `pnpm generate && pnpm verify:generated` |
| Migration adds/backfills `split_policy` and relaxes place fallback nullability | DB/storage | migration tests / schema validation | `pnpm --filter @i-um/api test` + migration apply/status/rollback/re-apply on test DB |
| Day list resolves live schedule/place, payer, and split participant names | API repository | `apps/api/internal/storage/trip_repository_test.go` or repository integration test | `pnpm --filter @i-um/api test` |
| Day list falls back when schedule/place/participant references are unavailable | API repository/service/handler | storage + server tests | `pnpm --filter @i-um/api test` |
| Quick create stores schedule-item anchor, fallback fields, and `split_policy = equal` | API repository/service/handler | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Quick create response maps to canonical `Expense` display DTO | API handler/mapper | server mapper/handler tests | `pnpm --filter @i-um/api test` |
| Mobile day expense rows render canonical payer/split display objects | Mobile helper | `apps/mobile/lib/trips/day-expenses.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile quick-create request remains unchanged and success summary consumes canonical split DTOs | Mobile helper/screen | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Final repository gate | All | standard verification | `pnpm verify` |

## Regression Gaps

- Edit/delete behavior is not automated in #153 because the API/UI is out of scope.
  - Risk: F-052 still needs separate regression coverage for amount changes, deletion, and split recalculation.
  - Follow-up: #52/F-052.
- User-visible distinction between live and fallback display is not smoke-tested as separate UI copy because source labels are intentionally not shown.
  - Risk: Manual testers may not notice whether a value came from live data or fallback data.
  - Follow-up: rely on API tests for source resolution and add debug logging only if implementation needs it.
- Category/memo/paid-on behavior is not automated because the product decisions are open and no in-scope UI/API uses those fields.
  - Risk: Future general expense creation may need another migration/contract update.
  - Follow-up: resolve Open Questions before trip-level/day-level general expense creation.

## TDD Implementation Plan

1. Red: Update OpenAPI contract tests/fixtures to expect canonical display schemas for `ListDayExpensesResponse`, `DayExpenseListItem`, `CreateQuickExpenseResponse`, `Expense`, and split participant display objects.
   - Verify: `pnpm generate && pnpm verify:generated`
2. Green: Regenerate Go/TS contract code and update server/mobile compile errors only enough to use the new types.
   - Verify: `pnpm verify:generated`
3. Red: Add DB migration tests/schema assertions for `expenses.split_policy`, existing-row backfill to `equal`, and nullable place fallback fields.
   - Verify: `pnpm --filter @i-um/api test`
4. Green: Implement migration, schema update, sqlc query changes, and generated DB updates.
   - Verify: migration apply/status/rollback/re-apply on a test DB and `pnpm --filter @i-um/api test`
5. Red: Add repository tests for day expense list live resolution from `schedule_items -> trip_places`, payer participant, and split participant joins.
   - Verify: `pnpm --filter @i-um/api test`
6. Green: Implement list query/repository mapping using live joins first and fallback columns second.
   - Verify: `pnpm --filter @i-um/api test`
7. Red: Add repository/service/handler tests for fallback display when linked schedule/place/payer/split participant rows are unresolvable.
   - Verify: `pnpm --filter @i-um/api test`
8. Green: Implement fallback resolution and mapper changes for list/create DTOs.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`
9. Red: Add quick-create tests asserting request compatibility, `split_policy = equal`, fallback capture at creation, and canonical create response mapping.
   - Verify: `pnpm --filter @i-um/api test`
10. Green: Update quick-create repository/service/handler mapping without changing request behavior.
    - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`
11. Red: Add mobile helper tests for canonical day expense row rendering and quick-create saved split summary using nested participant display objects.
    - Verify: `pnpm --filter @i-um/mobile test`
12. Green: Update mobile generated type usage, helper mapping, and screen rendering for list/create surfaces.
    - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
13. Refactor: Remove stale `ExpensePlaceSnapshot` naming from in-scope client/server code paths and keep fallback handling centralized in API mapping/query helpers.
    - Verify: `pnpm verify:generated && pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test`
14. Gate: Run generated, API, mobile, and migration verification before PR review.
    - Verify: `pnpm verify`

## Verification Record

### Automated Regression

- `pnpm generate`: pass
- `pnpm verify:generated`: pass
- `pnpm --filter @i-um/api db:migrate`: pass, applied `00014_canonical_expense_display.sql`
- `pnpm --filter @i-um/api db:status`: pass, migration 14 applied
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api db:rollback && pnpm --filter @i-um/api db:migrate && pnpm --filter @i-um/api db:status`: pass, rollback/re-apply verified for migration 14
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm lint`: pass
- `pnpm format:check`: pass
- `pnpm verify`: pass

### Manual Smoke

- Day expense list live/fallback display: not run (automated API/mobile coverage only)
- Quick expense create success summary: not run (automated API/mobile coverage only)
- Staging generated client/server compatibility smoke: not run (not deployed)

## Release Notes

- Expense list/create responses now use canonical live-linked display data for place, payer, and split participants, with stored fallback text used only when linked sources are gone.
- Quick expense creation remains schedule-item based and equal-split, and now persists split policy for later edit/delete work.

## Open Questions

- Category enum/default: should future general expenses use `flight`, `lodging`, `food`, `transport`, `activity`, `shopping`, `etc`, reuse `TripPlaceType`, or a different product taxonomy?
- Memo/title: should future general expense creation add optional `memo` only, or also a required/optional `title`? Current direction is no required title.
- Paid date naming/exposure: should the current `expenseDate` remain the public field, or should future UI/API expose a nullable `paidOn` while keeping `expenseDate` as storage/business date?
- Direct place relation for non-schedule expenses: should future trip/day expenses be allowed to link directly to a `trip_place_id`, or should place association always happen through schedule items?

## Follow-up Issues

- #52/F-052: expense edit/delete API/UI, including amount edits that reuse `split_policy = equal`.
- Future trip-level/day-level general expense creation after category/memo/paid-on decisions are resolved.
