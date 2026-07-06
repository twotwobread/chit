# Feature Slice: F-230 장소 선택 후 일정 상세 입력

## Metadata

- GitHub Issue: #230
- Status: Approved
- Created: 2026-07-04
- Updated: 2026-07-06

## Source

- Issue: #230 — `[일정] 장소 선택 후 일정 상세 정보를 입력할 수 있도록 개선`
- Harness run: `.harness/runs/F230-schedule-detail-entry`
- Canonical spec: `.harness/runs/F230-schedule-detail-entry/artifacts/feature.spec.md`
- Spec review: Approved

## Goal

사용자는 Day 일정에서 장소를 선택하자마자 즉시 일정이 추가되는 대신, 일정 제목과 선택 입력 정보를 확인한 뒤 저장할 수 있다.

시간은 선택 입력이다. 사용자는 시간 없이 “어디 갈지”만 먼저 추가하고, 나중에 시간이나 순서를 조정할 수 있다.

## Product Decisions

- `일정 추가`는 상세 입력 폼을 먼저 연다.
- 상세 입력 폼에서 `장소 검색`을 누르면 장소 검색 페이지로 이동한다.
- 장소 검색 결과를 선택하면 상세 입력 폼으로 돌아와 선택된 장소 정보가 채워진다.
- 일정 제목은 필수다.
- 장소 선택 시 일정 제목 기본값은 선택된 장소명이다.
- 선택된 장소명/주소/장소 타입/Google 정보는 읽기 전용이다.
- 사용자가 수정할 수 있는 정보는 일정 제목, 시작 시간, 종료 시간, 메모다.
- 시작/종료 시간은 선택 입력이다.
- 시간은 기본적으로 `시간 미정` 상태이며, 사용자가 `시간 추가`를 누르면 현재 시각을 기본값으로 오전/오후·시·분 wheel picker에서 선택한다.
- 비용/예약 필드는 이번 범위에서 제외한다.
  - 비용은 정산 기반 지출 기능에서 다룬다.
  - 예약은 현재 단계에서는 시간/메모로 충분하다.

## User Flow

1. 사용자가 Day 일정 화면에서 `일정 추가`를 누른다.
2. 앱은 place-backed 일정 상세 입력 폼을 연다.
3. 사용자가 `장소 검색`을 누른다.
4. 앱은 기존 Google 장소 검색 페이지를 selector mode로 연다.
5. 사용자가 검색 결과를 선택한다.
6. 앱은 상세 입력 폼으로 돌아와 선택된 장소 카드와 기본 제목을 채운다.
7. 사용자는 필수 일정 제목을 확인/수정하고, 필요하면 시작 시간/종료 시간/메모를 입력한다.
8. 사용자가 저장한다.
9. 서버는 Google-backed 장소 snapshot/reuse 및 duplicate confirmation 규칙을 유지하면서 place-backed schedule item을 생성한다.
10. 저장 성공 후 앱은 Day 일정 화면으로 돌아가고 새 일정이 마지막 순서에 보인다.

## Scope

- App UI: Yes
  - Day itinerary add-place entrypoint.
  - Place-backed schedule detail form.
  - Google place search selector mode.
  - Day itinerary row display update.
- API Contract: Yes
  - Place-backed schedule details in `ScheduleItem`.
  - Create Google place schedule item request accepts title/time/memo.
- API Server: Yes
  - Validation, persistence, duplicate confirmation, response mapping.
- DB: Yes
  - Persist place-backed schedule title/memo separately from `trip_places` snapshot.
- Generated Code: Yes
- Tests: API service/storage/server, mobile helper/display/route tests.

## Out of Scope

- 비용, 예상 지출, 정산, 결제자, 분할 정보.
- 예약 여부/예약번호 전용 필드.
- 선택된 Google 장소명/주소/장소 타입 직접 수정.
- 시간 필수화.
- 경로 최적화, 자동 체류시간/이동시간 추천, 캘린더 드래그 앤 드롭.
- 기존 edit/delete/reorder/lodging/map/settlement flow 제거.

## Requirements

### UI / UX

- 상세 입력 폼 제목: `일정 상세 입력`.
- 필수 필드:
  - `일정 제목`
  - `장소`
- 선택 필드:
  - `시작 시간`
  - `종료 시간`
  - `메모`
- 장소 미선택 상태:
  - `장소 검색` CTA를 보여준다.
  - 저장은 disabled 또는 validation message로 막는다.
- 장소 선택 상태:
  - 장소명, 주소, 유형 hint를 read-only card로 보여준다.
  - `장소 다시 검색`으로 다른 장소를 선택할 수 있다.
- 제목 기본값:
  - 장소 선택 후 제목이 비어 있거나 자동 채움 상태이면 장소명으로 채운다.
  - 사용자가 직접 수정한 제목은 시간/메모 변경으로 덮어쓰지 않는다.
- 시간:
  - 둘 다 비워두면 시간 미정/순서형 일정으로 저장한다.
  - 기본 상태에서는 텍스트 입력을 노출하지 않고 `시간 추가` CTA를 보여준다.
  - `시간 추가`를 누르면 현재 시각을 기본값으로 시작 시간이 채워지고, 오전/오후·시·분 wheel picker로 수정한다.
  - 종료 시간은 별도 `종료 시간 추가` CTA로 선택 입력한다.
  - 종료 시간만 입력하면 validation error.
  - 종료 시간은 시작 시간보다 늦어야 한다.
- 메모:
  - 선택 입력.
  - 저장 후 일정 상세/관련 표시에서 사용할 수 있게 응답에 포함한다.

### API Contract

- `ScheduleItem`에 place-backed schedule detail을 추가한다.
  - 추천 shape: `placeSchedule: PlaceScheduleItemDetails | null`.
  - `itemType=place`이면 `placeSchedule`과 `place`가 있어야 한다.
  - `itemType=non_place`이면 `placeSchedule=null`이다.
- `PlaceScheduleItemDetails`:
  - `title`: required, trimmed, 1..120.
  - `memo`: nullable, trimmed, max 1000.
- `CreateGooglePlaceScheduleItemRequest`:
  - existing `googlePlaceId`, `duplicateConfirmed` 유지.
  - add required `title`.
  - add optional `startTime`, `endTime`, `memo`.
- Time validation uses existing `HH:mm` and end-after-start rules.

### DB

- Add place-backed schedule fields to `schedule_items`:
  - `place_title text`
  - `place_memo text`
- Backfill existing place-backed rows from linked `trip_places.name`.
- Update constraints:
  - place rows require `trip_place_id` and `place_title`.
  - non-place rows keep existing non-place required fields and must not set place-backed detail fields.
  - memo max length and title max/nonblank constraints are enforced by service and DB where practical.

## Acceptance Criteria

- [ ] AC-01: From the Day itinerary screen, `일정 추가` opens the place-backed detail form, not the immediate Google search create flow.
- [ ] AC-02: The detail form requires a nonblank schedule title and a selected Google place before save.
- [ ] AC-03: `시작 시간` and `종료 시간` are optional; saving with both blank creates an untimed/order-only schedule item.
- [ ] AC-04: If `종료 시간` is entered, `시작 시간` is required and `종료 시간` must be later than `시작 시간`.
- [ ] AC-05: The detail form lets the user open the Google place-search page; choosing a result returns to the form and fills the selected-place card.
- [ ] AC-06: Selected place name/address/type/provider fields are read-only in the detail form; only the schedule title, time fields, and memo can be edited.
- [ ] AC-07: When a place is first selected, the form title defaults to the selected place display name; later manual title edits are preserved.
- [ ] AC-08: Saving creates one place-backed schedule item that preserves Google-backed place reuse/snapshot behavior and appends at the end of the selected Day.
- [ ] AC-09: Same-Day duplicate Google place save returns the existing confirmation message; confirming saves with the same title/time/memo values.
- [ ] AC-10: After save success, the app returns to the Day itinerary view and the new item appears with the schedule title as its primary label.
- [ ] AC-11: Existing place-backed items without an explicit schedule title remain readable by falling back/backfilling to the place name.
- [ ] AC-12: Existing edit, delete, reorder, lodging, map/address, Today, and settlement-linked expense flows remain compatible.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Contract/generation for new request/response fields | Contract | OpenAPI generated files | `pnpm generate && pnpm verify:generated` |
| Title/time/memo validation and duplicate confirmation detail preservation | API service | `apps/api/internal/place/service_test.go` | `pnpm --filter @i-um/api test -- ./internal/place` |
| Persist place title/memo/time and backfilled mapping | API storage/DB | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test -- ./internal/storage` |
| Handler accepts new request fields and maps response | API server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test -- ./internal/server` |
| Detail form validation, route param preservation, selector return | Mobile helpers | `apps/mobile/lib/places/place-schedule-detail.test.mts`, `apps/mobile/lib/places/google-search.test.mts` | `pnpm --filter @i-um/mobile test` |
| Place-backed rows use schedule title as primary label | Mobile helpers | `apps/mobile/lib/trips/day-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile compile | Mobile | TypeScript | `pnpm --filter @i-um/mobile typecheck` |

## Implementation Plan

1. Red: add API tests for create request title/time/memo validation and persistence.
2. Update OpenAPI, migration, SQL, and generated code.
3. Green: implement API validation, repository insert/map, and response mapping.
4. Red: add mobile helper tests for detail form validation and selector routing.
5. Green: implement detail form helpers, selector route helpers, and generated-client call changes.
6. Red/green: update UI screens and display helpers.
7. Run generated, API, mobile, and worktree isolation checks.

## Verification

- `pnpm generate`
- `pnpm verify:generated`
- `pnpm --filter @i-um/api test`
- `pnpm --filter @i-um/api build`
- `pnpm --filter @i-um/mobile test`
- `pnpm --filter @i-um/mobile typecheck`
- `pnpm harness:check-worktree-isolation`

## Notes

- This feature intentionally does not add cost/reservation fields.
- Time is not required. 시간 미정/순서형 일정 is a supported first-class state.
