# Feature Slice: F-095 시간 선택 가능한 일정 항목/타임라인

## Metadata

- GitHub Issue: #95
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #95 — [[Feature Slice] F-095 시간 선택 가능한 일정 항목/타임라인](https://github.com/twotwobread/i-um/issues/95)
- Ouroboros/PM/Seed: Not used; issue body contains the product decisions and this PR narrows to a normal vertical slice.
- Notes:
  - Existing mobile timeline segment helpers already support `startTime`/`endTime` input, but API data does not expose times yet.
  - #122 owns place-less schedule items; do not include them here.
  - Today execution can keep current order/progress behavior in this slice; current-time selection can be a later execution issue if needed.
  - Spec review verdict: Approved.

## Goal

사용자는 기존 Day 일정 항목에 선택적으로 시작/종료 시간을 입력할 수 있다.

시간이 있는 항목은 일정 타임라인의 앵커로 표시하고, 시간이 없는 항목은 기존 순서 기반 일정으로 유지하며 임의 duration을 부여하지 않는다.

## User Flow

### Add time to an existing schedule item

1. 사용자가 Day 상세 화면에서 일정 항목 편집을 연다.
2. 사용자는 시작 시간과 선택적 종료 시간을 `HH:mm` 형식으로 입력한다.
3. 앱은 유효성 검사를 통과한 변경만 저장한다.
4. 서버는 schedule item time fields를 저장하고 최신 항목을 반환한다.
5. Day 상세/일정 탭은 시간 있는 항목을 timeline anchor로 표시한다.

### Keep order-only items

1. 사용자가 시간 없이 장소만 추가하거나 기존 시간 값을 비운다.
2. 서버는 `startTime/endTime = null` 응답 상태를 허용한다.
3. 앱은 해당 항목을 시간 미정/순서형 항목으로 유지한다.
4. 기존 reorder, lodging, expense, Today order/progress flows는 계속 동작한다.

### Invalid time input

1. 사용자가 잘못된 시간 형식, 종료만 입력, 또는 시작보다 빠른 종료 시간을 입력한다.
2. 앱은 저장 전에 field validation copy를 표시한다.
3. 서버도 동일한 invalid update를 `400` validation error로 거부한다.

## Scope

- App UI: Yes
  - Extend Day detail item edit UI and itinerary timeline mapping.
- API Contract: Yes
  - Add nullable `startTime` / `endTime` to `ScheduleItem` and optional set/clear fields to update request.
- API Server: Yes
  - Validate, persist, and return time fields.
- DB: Yes
  - Add nullable time columns and check constraint to `schedule_items`.
- Tests: API service/repository/handler tests, generated contract checks, mobile helper tests/typecheck, final repo gates.
- Deploy/Smoke: Manual smoke or internal build verification when feasible because this is user-visible UI.

## Out of Scope

- Place-less schedule items (#122).
- Route optimization, automatic stay duration, travel-time estimation, or automatic time suggestions.
- Required time entry for every item.
- Fake duration/portion for untimed items.
- Broad Today execution current-time rewrite.
- Calendar drag/drop or full 24-hour calendar editor.

## Requirements

### UI / UX

- Screens:
  - `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - `apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx`
- Day detail edit form:
  - Add optional `시작 시간` and `종료 시간` fields.
  - Accept `HH:mm` 24-hour text input.
  - Users can clear both fields to return to order-only mode.
  - `endTime` may be blank when `startTime` exists.
  - `endTime` without `startTime` is invalid.
  - `endTime <= startTime` is invalid.
- Timeline display:
  - Timed items with `startTime` are anchors.
  - Untimed items remain in API/order order and group into `시간 미정` runs between anchors.
  - Do not assign fake duration to untimed items.
  - If `endTime` exists and is after `startTime`, show duration label through existing timeline helpers.
- Compatibility:
  - Existing Day reorder still uses rank/item order.
  - Existing lodging/map/delete/edit actions remain available.

### API Contract

Add to `ScheduleItem`:

```yaml
startTime:
  type: string
  nullable: true
  pattern: '^([01]\\d|2[0-3]):[0-5]\\d$'
endTime:
  type: string
  nullable: true
  pattern: '^([01]\\d|2[0-3]):[0-5]\\d$'
```

Add optional `startTime` and `endTime` to `UpdateScheduleItemRequest`.

Rules:

- Both absent means unchanged on update.
- `HH:mm` sets a time value.
- Empty string clears that field.
- Clearing `startTime` also clears `endTime`.
- `endTime` requires `startTime` after applying the update.
- `endTime` must be later than `startTime`.

Note: update uses empty string for clear because the current Go OpenAPI generator maps optional nullable PATCH fields to `*string`, which cannot distinguish absent from explicit `null`.

### DB Changes

Add migration:

- `schedule_items.start_time time NULL`
- `schedule_items.end_time time NULL`
- check constraint: `end_time IS NULL OR (start_time IS NOT NULL AND end_time > start_time)`

Update generated `apps/api/schema.sql`.

### Business Rules

- Time fields are optional.
- `item_order`/`rank` remains the ordering source for untimed items and timed tie-breaking.
- Timed items do not remove or reorder untimed items automatically.
- No fake duration is created for untimed items.
- Place-backed schedule item model remains the only item kind in this slice.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0095-schedule-item-time-timeline.md`.
- [x] AC-02: DB migration adds nullable `start_time`/`end_time` with check constraint and generated schema is updated.
- [x] AC-03: OpenAPI and generated code expose nullable `startTime`/`endTime` on `ScheduleItem`.
- [x] AC-04: `UpdateScheduleItemRequest` can set optional time fields and clear them with empty strings.
- [x] AC-05: API rejects invalid time format, end-only time, and end-before/equal-start requests.
- [x] AC-06: API list/update responses include persisted time fields.
- [x] AC-07: Existing order-only items remain valid and render as untimed items.
- [x] AC-08: Day detail edit form lets users set, edit, and clear optional times.
- [x] AC-09: Itinerary timeline maps timed items to anchors and untimed items to ordered runs without fake duration.
- [x] AC-10: Existing reorder/lodging/map/delete/expense/Today order-based flows remain compatible.
- [x] AC-11: No place-less items, route optimization, automatic duration estimation, or broad Today rewrite is introduced.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Contract and generated code | Contract | OpenAPI generation | `pnpm generate && pnpm verify:generated` |
| DB/query persistence of times | API storage | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| API validation and response mapping | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Mobile edit validation/request building | Mobile helper | `apps/mobile/lib/trips/day-itinerary-edit.test.mts` | `pnpm --filter @i-um/mobile test` |
| Timeline anchor/untimed mapping | Mobile helper | `apps/mobile/lib/trips/itinerary-tab.test.mts` | `pnpm --filter @i-um/mobile test` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full device smoke depends on simulator/internal build availability.
  - Risk: time input keyboard/layout issues may be missed by helper tests.
  - Follow-up: run manual smoke/internal build before release when feasible.

## TDD Implementation Plan

1. Red: API contract/storage/service tests
   - Add tests for nullable times, update validation, set/clear behavior, and response fields.
   - Verify targeted API tests fail before implementation.
2. Green: DB/API implementation
   - Add migration/schema/query fields/OpenAPI/generation/service validation/mappers.
   - Verify `pnpm generate && pnpm --filter @i-um/api test`.
3. Red/Green: Mobile helper/UI
   - Add edit-form and timeline mapping tests.
   - Add Day detail edit fields and timeline mapping.
   - Verify mobile tests and typecheck.
4. Final gates
   - Run generated/API/mobile/lint/format/verify/diff checks.

## Verification Record

### Automated Regression

- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Not run in this session. UI behavior is covered by helper/typecheck tests; device-level time input layout remains a release smoke item.

## Release Notes

- Adds optional schedule item times so Day itineraries can mix timed anchors with order-only items.

## Open Questions

- None.

## Follow-up Issues

- #122: Place-less schedule items.
- Today current-time selection using schedule anchors remains outside this slice unless prioritized separately.
