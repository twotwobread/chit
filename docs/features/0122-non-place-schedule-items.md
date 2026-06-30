# Feature Slice: F-122 장소 없는 일정 항목 지원

## Metadata

- GitHub Issue: #122
- Status: Implemented
- Created: 2026-06-30
- Updated: 2026-06-30

## Source

- Issue: #122 — [[Feature Slice] F-122 장소 없는 일정 항목 지원](https://github.com/twotwobread/i-um/issues/122)
- Ouroboros interview: `interview_20260630_012952`
- Ouroboros seed: `seed_fb93924c2c7f`
- Ambiguity after clarification: `0.10`
- Related specs:
  - `docs/features/0095-schedule-item-time-timeline.md`
  - `docs/features/0036-navigate-to-next-place.md`

## Goal

사용자는 특정 장소 하나에 묶이지 않는 이동/휴식/메모/알림 일정 항목을 Day 일정과 Today 실행 흐름에서 직접 생성하고 관리할 수 있다.

장소 없는 항목은 기존 일정 항목과 같은 순서/시간/완료 상태 흐름에 참여하되, 길찾기/지도/장소 액션은 명확히 비활성 또는 미노출된다.

## Product Decisions

- First PR supports exactly four non-place categories:
  - `transport` — 이동
  - `rest` — 휴식
  - `memo` — 메모
  - `reminder` — 알림
- Non-place items reuse existing schedule item order, time, status, delete, reorder, skip, restore behavior.
- `item_order` / `rank` remains authoritative for Day order, Today execution order, untimed placement, and same-time ties.
- Optional `startTime` / `endTime` are labels/timeline anchors only.
- Transport details are plain text in this PR; origin/destination are not linked `TripPlace`s.
- While a non-place item is the current Today item, Today does not navigate to a later place-backed item.
- There is no completed-items section in Today; completed non-place items are represented by progression and the final completed state.

## Scope

- App UI: Yes
  - Day detail create/edit/delete/reorder/timeline rendering for non-place items.
  - Today current/skipped/completed flow support for non-place items.
- API Contract: Yes
  - `ScheduleItem` item-type discriminator and non-place details.
  - New create endpoint for non-place schedule items.
  - Update request fields for non-place edits.
- API Server: Yes
  - Validation, auth, persistence, response mapping.
- DB: Yes
  - Migrate `schedule_items` to support nullable `trip_place_id` and non-place detail columns.
- Generated Code: Yes.
- Tests: API storage/service/server and mobile helper/typecheck/regression tests.
- Deploy/Smoke: Internal/staging smoke should verify Day and Today flows before rollout when available.

## Out of Scope

- Automatic flight/train/bus import.
- Calendar sync.
- Notifications or alarms.
- Google Places search for transport origin/destination.
- Linked `TripPlace` origin/destination for transport details.
- Route preview, map integration, or Google Maps navigation for non-place items.
- Broad templates or recurring schedule item creation.
- Expense model changes for non-place item anchoring.
- Current-time based Today selection rewrite.

## Requirements

### Data Model

`ScheduleItem` becomes an item-type-aware model:

```text
ScheduleItem
├── itemType: place | non_place
├── place: TripPlaceSummary | null
└── nonPlace: NonPlaceScheduleItemDetails | null
```

Rules:

- `itemType=place` requires `place` and must have `nonPlace=null`.
- `itemType=non_place` requires `nonPlace` and must have `place=null`.
- Existing place-backed rows remain place-backed.
- Non-place rows reuse existing:
  - `itemOrder`
  - `rank`
  - `version`
  - `startTime` / `endTime`
  - `arrivedAt` / `skippedAt`
  - delete/reorder/status transition behavior

### Non-place Fields

Common fields:

| Field | Rule |
|---|---|
| `category` | required enum: `transport`, `rest`, `memo`, `reminder` |
| `title` | required trimmed string, 1..120 |
| `memo` | optional trimmed string, max 1000 |
| `link` | optional trimmed `http`/`https` URL, max 500 |
| `startTime` | optional `HH:mm` |
| `endTime` | optional `HH:mm`, requires `startTime`, must be later than `startTime` |

Transport-only fields:

| Field | Rule |
|---|---|
| `transportMode` | required for `transport`; enum `flight`, `train`, `bus`, `ferry`, `other` |
| `referenceNumber` | optional, max 80 |
| `bookingReference` | optional, max 80 |
| `originText` | optional, max 200 |
| `destinationText` | optional, max 200 |
| `terminalText` | optional, max 120 |
| `gateText` | optional, max 80 |

Non-transport categories must not submit transport-only fields.

### API Contract

Add:

```text
POST /trips/{tripId}/days/{tripDayId}/schedule-items/non-place
```

Request: `CreateNonPlaceScheduleItemRequest`

Response: `CreateNonPlaceScheduleItemResponse`

Extend:

- `ScheduleItem`
  - `itemType`
  - nullable `place`
  - nullable `nonPlace`
- `UpdateScheduleItemRequest`
  - optional non-place fields for editing non-place items

Patch semantics:

- Absent field: unchanged.
- Required non-place fields (`category`, `title`, `transportMode` for transport): validate after applying the patch.
- Optional string fields: `""` clears the field.
- `startTime` / `endTime`: preserve F-095 clear semantics.

### DB

Add a migration after `00017_add_schedule_item_times.sql`.

Expected schema changes:

- Make `schedule_items.trip_place_id` nullable.
- Add `item_kind` text with values `place` / `non_place`.
- Add non-place detail columns:
  - `non_place_category`
  - `non_place_title`
  - `non_place_memo`
  - `non_place_link`
  - `transport_mode`
  - `transport_reference_number`
  - `transport_booking_reference`
  - `transport_origin_text`
  - `transport_destination_text`
  - `transport_terminal_text`
  - `transport_gate_text`
- Add constraints for exactly-one backing model and category-specific transport rules where feasible.

### Day UI

- Add a Day action such as `장소 없는 일정 추가`.
- Create/edit form:
  - Category selector labels: `이동`, `휴식`, `메모`, `알림`.
  - Transport mode labels: `비행기`, `기차`, `버스`, `페리`, `기타`.
  - Common fields: title, time fields, memo, link.
  - Transport fields visible only for `이동`.
- Day rows:
  - Every non-place row shows category badge, title, time label when present, and status badge when arrived/skipped.
  - Transport row shows mode and best origin/destination route subtitle when present.
  - Rest/memo/reminder row shows memo preview only when present.
  - Empty optional fields are hidden.
- Hide place-only actions for non-place rows:
  - lodging set/clear
  - map open
  - address copy
- Keep common actions:
  - edit
  - delete
  - reorder

### Today UI

- Non-place items participate in the same pending/arrived/skipped flow.
- Current non-place item card shows:
  - category
  - title
  - time
  - relevant optional details
  - `완료`/arrived action
  - skip action
- Transport current card shows mode, route, terminal, gate, reference number, and booking reference when present.
- Rest/memo/reminder current cards show memo when present.
- If no optional details exist in the expanded current card, show `세부 정보 없음`.
- Do not show navigation/travel-mode/route-preview for a current non-place item.
- Do not use a later place-backed item as the Today navigation target until the current non-place item is completed or skipped.
- Skipped section includes skipped non-place items with category, title, optional time, and restore action; optional details stay hidden for compactness.
- Today quick expense from a current non-place item should open day-level quick expense without inferred schedule item id.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist and spec review is approved before implementation.
- [x] AC-02: Existing place-backed schedule items continue to list, edit, delete, reorder, mark arrived, skip, restore, and render after migration.
- [x] AC-03: Users can create non-place schedule items in all four categories.
- [x] AC-04: Users can edit, delete, and reorder non-place items in the same Day screen flow as place-backed items.
- [x] AC-05: Day rows for every non-place item show category badge, title, optional time label, and arrived/skipped status badge when applicable.
- [x] AC-06: Transport Day rows show mode and origin/destination route subtitle plus compact reference/terminal/gate metadata when present.
- [x] AC-07: Rest/memo/reminder Day rows show memo preview only when present and otherwise hide optional detail rows.
- [x] AC-08: Day create/edit forms show only fields relevant to the selected category.
- [x] AC-09: Non-place items use existing `item_order`/`rank` for Day ordering, Today execution order, untimed placement, and same-time tie breaks.
- [x] AC-10: Today current non-place item shows category, title, time, relevant details, complete action, and skip action.
- [x] AC-11: Completing/skipping/restoring non-place items uses existing status endpoints and advances Today correctly.
- [x] AC-12: Today does not expose navigation, route preview, or map actions while a non-place item is current.
- [x] AC-13: Today skipped section includes skipped non-place items with compact restore rows.
- [x] AC-14: Validation rejects invalid category/title/time/link/category-field combinations.
- [x] AC-15: API contract/server, DB, generated code, mobile UI, and regression tests are updated as a vertical slice.
- [x] AC-16: No automatic transport integration, map/route preview, calendar sync, notifications, or templates are introduced.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Contract/generated clients | Contract | OpenAPI generation | `pnpm verify:generated` |
| DB persistence and migration | API storage/DB | repository tests + migration checks | `pnpm --filter @i-um/api test` |
| API validation and response mapping | API service/server | `apps/api/internal/trip`, `apps/api/internal/server` tests | `pnpm --filter @i-um/api test` |
| Day row/create/edit helpers | Mobile helper | `apps/mobile/lib/trips/*` tests | `pnpm --filter @i-um/mobile test` |
| Today non-place execution flow | Mobile helper | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Type integration | Mobile | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full internal build smoke may be unavailable in the implementation session.
  - Risk: complex Day/Today form layout issues may be missed by helper tests.
  - Follow-up: run internal build smoke before rollout when feasible.

## Verification Record

### Automated Regression

- `pnpm verify:generated` — pass
- `pnpm --filter @i-um/api test` — pass
- `pnpm --filter @i-um/api build` — pass
- `pnpm --filter @i-um/mobile test` — pass
- `pnpm --filter @i-um/mobile typecheck` — pass
- `pnpm lint` — pass
- `pnpm format:check` — pass
- `pnpm verify` — pass
- `git diff --check` — pass
- DB migration `db:rollback && db:migrate` — pass

### Manual Smoke

- Not run in this session; internal/staging smoke remains recommended before rollout.

## Release Notes

- Adds manually managed non-place schedule items for transport, rest, memo, and reminder entries.
- Non-place items appear in Day and Today flows but do not expose navigation actions.

## Open Questions

- None blocking after Ouroboros clarification.

## Follow-up Issues

- Auto flight/train/bus integration.
- Calendar sync.
- Notifications/alarms for reminder items.
- Linked place origin/destination or route preview for transport items.
- Broad schedule templates.
