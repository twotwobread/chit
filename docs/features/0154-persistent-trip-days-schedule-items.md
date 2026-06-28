# Feature Slice: Persistent trip days and schedule items

## Metadata

- GitHub Issue: #154
- Status: Spec Review
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #154
- Ouroboros/PM/Seed: Interview `interview_20260628_044835`, ambiguity `0.0465`, Seed `seed_6ec1bbc631ac` (generated via MCP)
- Notes: User approved a breaking coordinated cutover where `trip_days` becomes the canonical Day entity, public Day APIs move to `tripDayId`, `itinerary_items` becomes `schedule_items`, and lodging is absorbed into `trip_days.lodging_trip_place_id`.

## Goal

Make Day a first-class persistent entity so itinerary/schedule, lodging, and expense data share one canonical Day parent instead of separate date columns. Rename the current itinerary item model to schedule item, define expense anchor semantics that support trip-level, day-level, and schedule-item-level expenses, and keep the migration safe for existing user data.

## User Flow

1. A participant opens trip detail and receives a contiguous active `days` list for the trip range, where each Day has `id`, `date`, `dayOrder`, and optional lodging.
2. The mobile app navigates to a Day using `tripDayId`; Day actions create/update/reorder/delete schedule items, set lodging, and create quick expenses against schedule items.
3. If an owner shrinks a trip date range and existing data would be excluded, the API returns an impact summary; after explicit confirmation, excluded Days/items are archived and active expenses are detached to trip-level instead of deleted.
4. Expense rows remain available for future expense cleanup/re-attachment flows because they keep `trip_id`, `anchor_type`, `expense_date`, and place snapshot data.

## Scope

- App UI: Yes. Mobile trip detail/day navigation and quick expense client code must use `tripDayId`, `scheduleItems`, and `scheduleItemId` generated types.
- API Contract: Yes. OpenAPI hard cutover from date-addressed Day routes and itinerary naming to `tripDayId` and schedule naming.
- API Server: Yes. Handlers/services/repositories resolve persistent `trip_days`, enforce active/archived visibility, and implement date-range expand/shrink behavior.
- DB: Yes. Migration/backfill for `trip_days`, `schedule_items`, lodging absorption, expense anchors, constraints, and indexes.
- Tests: API migration/service/handler/storage tests, generated contract checks, and mobile unit/type checks for renamed generated types and navigation data.
- Deploy/Smoke: Needed for staging DB migration and coordinated server/mobile cutover; no backward-compatible old mobile window is required.

## Out of Scope

- Full expense edit/delete/re-attachment UI/API; keep it for #153/#52 after this schema direction lands.
- Public archived/history/admin retrieval APIs for soft-deleted `trip_days` or `schedule_items`.
- Day notes/status or richer Day-level metadata beyond lodging and archive state.
- Multiple lodging places per Day, lodging booking history, check-in/check-out metadata, or lodging audit UI.
- Calendar/timeline UI (#95), realtime shared editing (#46), CRDT ordering, and #89 rank rebalance implementation beyond preserving existing rank/version semantics.
- Backward compatibility for older mobile clients that still call date routes or send `itineraryItemId`.
- Full semantic down migration after production cutover; rollback is restore-from-backup plus verification.

## Requirements

### UI / UX

- Screens:
  - `apps/mobile/app/trips/[tripId]/index.tsx` consumes `TripDay.id` from trip detail and navigates with `tripDayId`.
  - `apps/mobile/app/trips/[tripId]/days/[date].tsx` is replaced or migrated to a `tripDayId` route while still displaying `TripDay.date` and `Day N`.
  - Quick expense screens use `scheduleItemId` and generated schedule item types.
- Trip detail still shows a contiguous in-range Day list even when a Day has no schedule items, lodging, or expenses.
- Date is display/today-matching data, not the public action identifier.
- Trip date shrink UX:
  - If no active data is excluded, save normally.
  - If data is excluded, show API-provided impact counts before confirmation.
  - Confirmation copy should communicate that excluded schedules and lodging are removed from the active trip plan while expenses remain in overall trip expenses.
  - Example copy: `02-16이 새 여행 기간에서 제외됩니다. 해당 날짜의 일정 3개와 숙소 지정이 여행 일정에서 숨겨지고, 연결된 지출 2건은 전체 지출로 이동됩니다. 계속하시겠습니까?`
- Archived `trip_days` and `schedule_items` are hidden from normal trip detail/day reads.

### API Contract

OpenAPI is a breaking coordinated cutover. Do not keep compatibility aliases unless implementation discovers an operational blocker and the spec is revised.

#### Trip detail

```text
GET /trips/{tripId}
```

- Keep the existing response property name `days` to limit response-shape churn, but each `TripDay` must include:

```yaml
TripDay:
  required: [id, date, dayOrder, lodgingPlace]
  properties:
    id: string
    date: string(date)
    dayOrder: integer
    lodgingPlace: TripPlaceSummary | null
```

- The response includes active, non-archived Days only, ordered by active `dayOrder`.

#### Day routes

All Day routes use `tripDayId` path params. Date-addressed `/days/{date}` routes are removed in this cutover.

```text
GET    /trips/{tripId}/days/{tripDayId}/schedule-items
POST   /trips/{tripId}/days/{tripDayId}/schedule-items
PUT    /trips/{tripId}/days/{tripDayId}/schedule-items/order
PATCH  /trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}
DELETE /trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}
POST   /trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/arrive
POST   /trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/skip
POST   /trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/restore
GET    /trips/{tripId}/days/{tripDayId}/schedule-items/{scheduleItemId}/route-preview
PUT    /trips/{tripId}/days/{tripDayId}/lodging-place
DELETE /trips/{tripId}/days/{tripDayId}/lodging-place
GET    /trips/{tripId}/days/{tripDayId}/expenses
POST   /trips/{tripId}/days/{tripDayId}/expenses/quick
GET    /trips/{tripId}/days/{tripDayId}/places/google/search
POST   /trips/{tripId}/days/{tripDayId}/places/google/schedule-items
```

- `DayItineraryItem` is renamed to `ScheduleItem` in public schemas.
- Response collections are named `scheduleItems`.
- Request/response fields are renamed from `itineraryItemId` to `scheduleItemId`.
- `CreateQuickExpenseRequest` immediately requires `scheduleItemId`; it does not accept `itineraryItemId`.
- Quick expense remains schedule-item-focused in #154. General trip/day expense creation and expense re-attachment APIs are deferred to #153/#52, but the DB/domain model must already support those anchors.

#### Trip update / date range change

```text
PATCH /trips/{tripId}
```

- Add an explicit confirmation field for destructive/archive date shrink: `confirmOutOfRangeDayArchive: boolean`.
- If the new date range excludes active Days with schedule items, lodging, or expenses and confirmation is absent/false, return `409` with an `ErrorResponse.details` impact summary:

```json
{
  "code": "TRIP_DATE_RANGE_SHRINK_REQUIRES_CONFIRMATION",
  "details": [
    {
      "excludedDayCount": 1,
      "scheduleItemCount": 3,
      "lodgingAssignmentCount": 1,
      "expenseCount": 2,
      "excludedDates": ["2026-02-16"]
    }
  ]
}
```

- If confirmation is true, the server recomputes the impact in the same transaction and applies the archive/detach behavior defined below.

### DB Changes

#### `trip_days`

Introduce persistent `trip_days` as the canonical Day entity.

```text
trip_days
  id uuid primary key default gen_random_uuid()
  trip_id uuid not null references trips(id) on delete cascade
  date date not null
  day_order integer not null check (day_order >= 1)
  lodging_trip_place_id uuid null
  deleted_at timestamptz null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()

constraints/indexes:
  unique (trip_id, date)
  unique (id, trip_id) -- for same-trip composite FKs
  unique (trip_id, day_order) where deleted_at is null
  foreign key (lodging_trip_place_id, trip_id)
    references trip_places(id, trip_id)
    on delete restrict
```

- Active `trip_days` are materialized for every date in `trips.start_date..trips.end_date`.
- `day_order` is contiguous for active Days and recomputed when the active trip range changes.
- If a previously archived Day date becomes in-range again, reactivate the existing `trip_days` row because `UNIQUE(trip_id, date)` spans archived and active rows. Do not automatically restore archived schedule items, lodging, or detached expense anchors.
- `day_lodging_places` is removed after backfill; its current 0-or-1 Day lodging role is represented by `trip_days.lodging_trip_place_id`.

#### `schedule_items`

Rename/re-anchor the current `itinerary_items` model to `schedule_items`.

```text
schedule_items
  id uuid primary key default gen_random_uuid()
  trip_id uuid not null
  trip_day_id uuid not null
  trip_place_id uuid not null
  item_order integer not null check (item_order >= 1)
  rank text collate "C" not null
  version integer not null default 1 check (version >= 1)
  arrived_at timestamptz null
  skipped_at timestamptz null
  deleted_at timestamptz null
  created_at timestamptz not null default now()
  updated_at timestamptz not null default now()

constraints/indexes:
  foreign key (trip_day_id, trip_id) references trip_days(id, trip_id) on delete restrict
  foreign key (trip_place_id, trip_id) references trip_places(id, trip_id) on delete restrict
  unique (id, trip_day_id, trip_id)
  unique (trip_day_id, item_order) where deleted_at is null
  unique (trip_day_id, rank) where deleted_at is null
  check (arrived_at is null or skipped_at is null)
```

- This is a pure rename and re-anchor for #154; preserve existing item order, rank, version, arrival, and skip behavior.
- Every active schedule item belongs to exactly one active `trip_day`.
- User-facing delete is soft delete (`deleted_at`).
- Hard delete is restricted while referenced by expenses. Whole-trip deletion may still cascade through `trips` as today.

#### `expenses`

Rework expense anchors without forcing every expense to a schedule item.

```text
expenses
  trip_id uuid not null references trips(id) on delete cascade
  anchor_type text not null check (anchor_type in ('trip', 'trip_day', 'schedule_item'))
  trip_day_id uuid null
  schedule_item_id uuid null
  expense_date date not null
  trip_place_id uuid null
  place_name/place_address/place_type snapshot fields retained for existing quick expenses
  ... existing amount/currency/payer/split fields ...

constraints/indexes:
  foreign key (trip_day_id, trip_id) references trip_days(id, trip_id) on delete restrict
  foreign key (schedule_item_id, trip_day_id, trip_id)
    references schedule_items(id, trip_day_id, trip_id)
    on delete restrict
  check anchor semantics:
    anchor_type = 'trip'          => trip_day_id is null and schedule_item_id is null
    anchor_type = 'trip_day'      => trip_day_id is not null and schedule_item_id is null
    anchor_type = 'schedule_item' => trip_day_id is not null and schedule_item_id is not null
  index (trip_id, anchor_type, expense_date desc, created_at desc)
  index (trip_id, trip_day_id, created_at desc) where trip_day_id is not null
  index (trip_id, schedule_item_id) where schedule_item_id is not null
```

- `expense_date` is the business/paid date. For day/item expenses it defaults to the anchor Day date but remains user-editable to any date; it is not the FK source of truth.
- `schedule_item_id` remains nullable to support trip-level/pre-trip and day-level expenses.
- `trip_place_id` and place snapshot fields are retained for current quick expense/history behavior. Final display snapshot removal/deprecation remains #153.
- Active expenses are never soft-deleted by trip range shrink. Confirmed shrink detaches affected expenses to `anchor_type = 'trip'`, `trip_day_id = null`, `schedule_item_id = null`, preserving `expense_date` and place snapshot fields.

### Migration / Backfill

- Migration name intent: `persist_trip_days_schedule_items`.
- Backfill active `trip_days` for every trip date in `start_date..end_date`.
- Backfill `day_order` from date order within each active trip range.
- Backfill lodging:
  - Valid in-range `day_lodging_places` rows set `trip_days.lodging_trip_place_id`.
  - Invalid or out-of-range lodging rows are cleared/skipped from active UX and reported.
- Backfill schedule items:
  - Valid in-range `itinerary_items` become active `schedule_items` via `(trip_id, scheduled_date) -> trip_days.id`.
  - Out-of-range legacy items create or use an archived protection `trip_day` and become archived schedule items when preserving the row is safer than dropping it.
- Backfill expenses:
  - `scheduled_date` becomes `expense_date`.
  - Existing expenses with a valid active itinerary item become `anchor_type = 'schedule_item'` with `trip_day_id` and `schedule_item_id`.
  - Existing expenses without an item but with an in-range date become `anchor_type = 'trip_day'`.
  - Expenses outside the active trip range, pointing to a missing legacy item, or failing new anchor invariants are preserved as `anchor_type = 'trip'` and reported.
- Duplicate legacy rows mapping to the same `trip_day` merge by `UNIQUE(trip_id, date)` and are reported.
- Fail migration only when data cannot be preserved without loss or when referential corruption prevents safe mapping/detachment.
- Add validation queries before and after cutover for row counts, orphan FKs, anchor check violations, active Day contiguity, active schedule uniqueness, and detached expense counts.
- Production rollout is a one-way cutover requiring backup and restore-from-backup rollback. A perfect semantic down migration is not required after production cutover.

### Business Rules

- Authorization and participant/owner checks remain unchanged unless a route already requires owner permissions.
- Day-scoped operations must validate that `tripDayId` belongs to `tripId` and is active (`deleted_at is null`).
- Schedule item operations must validate that `scheduleItemId` belongs to the requested active `tripDayId` and `tripId`.
- Lodging assignment must reference a `trip_place` from the same trip; assigned lodging blocks hard deletion of that `trip_place` until cleared.
- Normal trip/day reads exclude archived `trip_days` and `schedule_items`.
- Trip range expansion creates or reactivates active `trip_days` and recomputes active `day_order` contiguously.
- Trip range shrink:
  - Requires confirmation when excluded active Days contain schedule items, lodging, or expenses.
  - Archives excluded `trip_days` via `deleted_at`.
  - Soft-deletes child `schedule_items` via `deleted_at`.
  - Clears/hides lodging assignments from active UX.
  - Detaches active expenses to trip-level and preserves money/history fields.
- Schedule item user delete sets `deleted_at` and hides the item from normal Day APIs; referenced expenses keep their anchor until explicit future re-attachment/detachment.

## Acceptance Criteria

- [ ] `trip_days` exists with `id`, `trip_id`, `date`, `day_order`, nullable `lodging_trip_place_id`, `deleted_at`, timestamps, same-trip lodging FK, `UNIQUE(trip_id, date)`, and active day-order uniqueness.
- [ ] Existing trips get deterministic active `trip_days` for every date in `start_date..end_date`.
- [ ] `day_lodging_places` data is backfilled into `trip_days.lodging_trip_place_id`, then the separate table is removed or left unused only during a documented transition step.
- [ ] `itinerary_items` is renamed/re-anchored as `schedule_items` with `trip_day_id`, active order/rank uniqueness, version/arrive/skip semantics, and `deleted_at` soft delete.
- [ ] Public OpenAPI routes use `tripDayId`; date-addressed Day routes are removed in this cutover.
- [ ] Public schemas and request fields use `ScheduleItem`, `scheduleItems`, and `scheduleItemId`; `itineraryItemId` is not accepted by `CreateQuickExpenseRequest`.
- [ ] Trip detail returns contiguous active `TripDay` rows with `id`, `date`, `dayOrder`, and `lodgingPlace`.
- [ ] Day operations reject archived/nonexistent `tripDayId` and cross-trip or cross-day `scheduleItemId`.
- [ ] Expenses support `anchor_type = trip | trip_day | schedule_item` with DB/service constraints enforcing nullability and same-trip/same-day consistency.
- [ ] `expense_date` is preserved/backfilled from legacy `scheduled_date` and is not used as the anchor FK source.
- [ ] Confirmed date-range shrink archives excluded Days/items, clears lodging from active UX, detaches affected expenses to trip-level, and preserves amount/currency/payer/splits/date/place snapshot.
- [ ] Date-range expansion creates/reactivates missing active `trip_days` and recomputes contiguous active `day_order`.
- [ ] Normal trip/day reads hide archived Days and schedule items.
- [ ] Backfill anomaly handling preserves/report-first behavior for outside-range expenses, missing item references, duplicate Day slots, invalid lodging rows, and invariant violations.
- [ ] Migration rollout docs or PR notes identify one-way cutover risk, backup requirement, validation queries, and restore-from-backup rollback expectation.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Migration creates active trip days and backfills lodging/items/expenses | DB/storage | migration integration test + validation SQL | `pnpm --filter @i-um/api test` + test DB migration apply |
| Anchor constraints reject invalid trip/day/item combinations | DB/storage | storage repository tests | `pnpm --filter @i-um/api test` |
| Trip detail returns persistent `TripDay.id` and contiguous active order | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Day routes use `tripDayId` and reject archived/cross-trip IDs | API service/handler | trip service + server tests | `pnpm --filter @i-um/api test` |
| Schedule item create/update/reorder/arrive/skip/restore/delete preserve semantics under `schedule_items` | API/storage | trip repository/service/server tests | `pnpm --filter @i-um/api test` |
| Lodging set/clear writes `trip_days.lodging_trip_place_id` and enforces same-trip FK | API/storage | trip repository/service/server tests | `pnpm --filter @i-um/api test` |
| Quick expense uses `scheduleItemId` and writes schedule-item anchor fields | API/storage | expense/trip repository + server tests | `pnpm --filter @i-um/api test` |
| Trip range expansion creates/reactivates Days and recomputes active order | API service/storage | trip update tests | `pnpm --filter @i-um/api test` |
| Trip range shrink returns impact summary before confirmation, then archives/detaches correctly | API service/storage | trip update tests | `pnpm --filter @i-um/api test` |
| Archived Days/items are hidden from normal reads | API service/storage | trip detail/day list tests | `pnpm --filter @i-um/api test` |
| OpenAPI generated Go/TS types reflect `tripDayId` and `scheduleItemId` | Contract | generated verification | `pnpm generate && pnpm verify:generated` |
| Mobile consumes `TripDay.id`, dayId route params, and `scheduleItemId` generated types | Mobile | mobile unit/type tests | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Final repository gate | All | standard verification | `pnpm verify` |

## Regression Gaps

- Older mobile client compatibility: intentionally unsupported because #154 is a coordinated breaking cutover.
  - Risk: users with an old internal build may fail Day/expense actions after server deployment.
  - Follow-up: coordinate staging/internal build release notes and deploy order before production.
- Full expense re-attachment UI/API after shrink: deferred to #153/#52.
  - Risk: detached expenses remain active in DB but may not have full user-facing reattachment controls until follow-up lands.
  - Follow-up: #153 and #52.
- Public archived/history retrieval: intentionally out of scope.
  - Risk: support/admin cannot inspect archived Day/item context through public API.
  - Follow-up: create a separate support/admin issue if needed.
- Semantic down migration after production cutover: not required beyond restore-from-backup.
  - Risk: rollback requires operational restore, not simple app-level migration reversal.
  - Follow-up: deploy runbook must include backup/restore checkpoint.

## TDD Implementation Plan

1. Red: Add migration/backfill tests and validation queries for `trip_days`, `schedule_items`, lodging absorption, and expense anchors before implementing the migration.
   - Verify: `pnpm --filter @i-um/api test`
2. Green: Implement DB migration, sqlc query changes, repository mappings, and generated DB updates until migration/backfill tests pass.
   - Verify: test DB migration apply/status plus `pnpm --filter @i-um/api test`
3. Red: Update OpenAPI contract tests/handler tests to expect `TripDay.id`, `tripDayId` routes, `ScheduleItem`, `scheduleItems`, and `scheduleItemId`.
   - Verify: `pnpm generate && pnpm verify:generated && pnpm --filter @i-um/api test`
4. Green: Implement server handler/service/repository route cutover, active Day resolution, active/archived visibility, and schedule item behavior preserving current semantics.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`
5. Red: Add trip update tests for expansion and shrink impact/confirmation/archive/detach behavior.
   - Verify: `pnpm --filter @i-um/api test`
6. Green: Implement transactional range update logic, impact summary, explicit confirmation, active day-order recomputation, archive cascade, lodging clear/hide, and expense trip-level detach.
   - Verify: `pnpm --filter @i-um/api test`
7. Red: Add mobile tests/type failures for generated type rename and `tripDayId` navigation/view models.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
8. Green: Update mobile generated client usage, route params, view models, quick expense request construction, and copy for shrink confirmation.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
9. Refactor: Remove stale date-route/itinerary naming, unused `day_lodging_places` code paths, and duplicate compatibility shims not needed for the hard cutover.
   - Verify: `pnpm verify:generated && pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test`
10. Gate: Run generated, API, mobile, and migration verification before PR review.
   - Verify: `pnpm verify`

## Verification Record

### Automated Regression

- `pnpm generate`: not run (spec only)
- `pnpm verify:generated`: not run (spec only)
- `pnpm --filter @i-um/api test`: not run (spec only)
- `pnpm --filter @i-um/api build`: not run (spec only)
- `pnpm --filter @i-um/mobile test`: not run (spec only)
- `pnpm --filter @i-um/mobile typecheck`: not run (spec only)
- `pnpm verify`: not run (spec only)

### Manual Smoke

- Staging DB migration smoke: not run (spec only)
- Mobile Day navigation/quick expense smoke: not run (spec only)

## Release Notes

- This is a breaking server/mobile cutover: Day APIs use persistent `tripDayId`, itinerary naming becomes schedule item naming, and Day/lodging/expense data is re-anchored to persistent `trip_days`.
- Deploy with a DB backup, migration validation queries, generated client/server updates, and a coordinated internal mobile build.

## Open Questions

- None

## Follow-up Issues

- #153: expense relation/display cleanup, trip-level/day-level expense create/list/re-attachment UI/API, and final policy for place snapshot/trip_place_id deprecation.
- #52: expense edit/delete UX/API after anchor model lands.
