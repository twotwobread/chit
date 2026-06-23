# Feature Slice: F-028 일정 장소 수정/삭제

## Metadata

- GitHub Issue: #28
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260623_053753`
- Seed: `seed_834221b6bb1c`
- PM Document: N/A
- Notes: Ambiguity score `0.07`. Ouroboros clarified F-028 as a minimal vertical slice for editing and deleting an existing Day itinerary row from the Day itinerary screen. The selected row is identified by `DayItineraryItem.id` under the existing virtual Day resource. Edit updates the linked `trip_places` snapshot fields `name`, `address`, and `placeType`. Delete removes the selected `itinerary_items` row and cleans up the linked `trip_places` row only when no remaining itinerary item references it. Google Places replacement, new place creation, item order editing, moving an item to another Day, maps, execution status, and collaboration conflict resolution are out of scope.

## Goal

사용자가 Day별 일정 화면에서 이미 등록된 장소의 이름, 주소, 타입을 수정하거나 해당 Day 일정에서 장소를 삭제할 수 있다.

F-028은 F-025의 읽기 전용 Day 일정 화면에 최소한의 수정/삭제 동작을 붙이는 vertical slice다. 일정 row의 순서 변경은 F-029에서 다루며, 새 장소 추가나 Google Places 검색/선택은 이 slice에 포함하지 않는다.

## Problem

- F-025에서는 Day별 장소 목록을 볼 수 있지만 잘못 입력한 장소명, 주소, 타입을 고칠 수 없다.
- 잘못 추가했거나 더 이상 방문하지 않을 장소를 Day 일정에서 제거할 수 없다.
- 이후 순서 변경, 지도, 오늘 실행 화면이 붙기 전에 기본 일정 데이터의 수정/삭제 흐름이 필요하다.

## Assumptions

- F-028은 기존 `trip_places`와 `itinerary_items` 모델을 사용한다.
- Day는 F-024/F-025 결정대로 `tripId + date`로 식별되는 virtual Day이며 `trip_days` table은 만들지 않는다.
- 기존 itinerary item은 F-026 직접 추가 기능 또는 개발/테스트 seed data를 통해 존재할 수 있다. F-028은 새 장소 생성 UI/API를 추가하지 않는다.
- 현재 MVP에서는 인증된 여행 참여자가 Day itinerary mutation을 수행할 수 있다. 역할별 편집 권한 정책이 필요해지면 후속 협업 feature에서 조정한다.

## User Flow

### Edit

1. 사용자가 로그인된 상태에서 여행 상세 화면을 연다.
2. 사용자가 특정 Day row를 눌러 `/trips/{tripId}/days/{date}` Day 일정 화면으로 이동한다.
3. 앱은 기존 `GET /trips/{tripId}/days/{date}/itinerary` 응답으로 장소 목록을 보여준다.
4. 사용자가 장소 row의 `수정` action을 누른다.
5. 앱은 장소명, 주소, 장소 타입이 채워진 수정 UI를 보여준다.
6. 사용자가 값을 수정하고 `저장`을 누른다.
7. 앱은 generated client로 `PATCH /trips/{tripId}/days/{date}/itinerary/items/{itemId}`를 호출한다.
8. 서버는 인증, 참여자 권한, 여행 존재 여부, 날짜 범위, item 소속, request validation을 확인한다.
9. 서버는 선택한 `itinerary_items` row가 참조하는 `trip_places` snapshot을 업데이트하고 updated item을 반환한다.
10. 앱은 Day itinerary를 refetch하거나 반환된 item으로 화면을 갱신하고 수정 UI를 닫는다.

### Delete

1. 사용자가 Day 일정 화면에서 장소 row의 `삭제` action을 누른다.
2. 앱은 삭제 확인 UI를 보여준다.
3. 사용자가 `삭제`를 확정한다.
4. 앱은 generated client로 `DELETE /trips/{tripId}/days/{date}/itinerary/items/{itemId}`를 호출한다.
5. 서버는 인증, 참여자 권한, 여행 존재 여부, 날짜 범위, item 소속을 확인한다.
6. 서버는 선택한 `itinerary_items` row를 삭제한다.
7. 서버는 연결된 `trip_places` row를 더 이상 참조하는 itinerary item이 없을 때만 삭제한다.
8. 앱은 Day itinerary를 refetch해서 삭제된 row가 사라진 목록 또는 empty state를 보여준다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: Day 일정 화면의 장소 row에 `수정`, `삭제` action 추가
- [x] App UI: 장소명, 주소, 장소 타입 수정 UI와 삭제 확인 UI 추가
- [x] API Contract: Day itinerary item update/delete endpoint와 request/response schema 정의
- [x] API Server: update/delete handler, service validation, repository/sqlc query 구현
- [x] DB: No schema migration. Existing `trip_places`, `itinerary_items` schema를 유지하고 mutation query만 추가
- [x] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type 갱신, sqlc generated DB code 갱신
- [x] Tests: API validation/authorization/success behavior, repository mutation/orphan cleanup, mobile form/state/helper tests
- [ ] Deployment: local/staging 또는 internal build에서 Day item edit/delete happy path smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 새 장소 추가 UI/API
- Google Places 검색, 선택, 외부 place id 저장, 좌표 저장
- 장소를 다른 Day로 이동하는 기능
- `itemOrder` 직접 수정, drag reorder, 수동 순서 변경
- 삭제 후 순서 번호를 사용자가 조정하는 UX. 순서 변경은 F-029에서 다룬다
- 메모, 방문 시간, 운영시간, 예상 체류 시간, 이동 시간 입력
- 지도, 길찾기, 주소 복사
- 도착/스킵 상태와 오늘 실행 화면
- 공동 편집 conflict resolution, optimistic locking, 실시간 동기화
- persistent `trip_days` table
- trip-level place library 관리 화면 또는 별도 `trip_place` resource 노출
- offline cache, optimistic update, undo toast

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 기존 Day itinerary list의 각 장소 row에 `수정`, `삭제` action을 제공한다.
  - `수정`은 현재 row의 장소명, 주소, 장소 타입을 편집하는 UI를 연다.
  - `삭제`는 즉시 삭제하지 않고 확인 UI를 먼저 보여준다.
  - 저장/삭제 성공 후 같은 Day itinerary를 갱신한다.
  - generated TypeScript client/type을 사용한다.

정확한 UI 형태는 구현 시 React Native 제약에 맞춰 조정할 수 있다. 단, 별도 화면이든 같은 화면의 modal/panel이든 사용자 흐름과 copy는 유지한다.

### Editable Fields

- 장소명: `name`
- 주소: `address`
- 장소 타입: `placeType`
  - `sights` → `관광지`
  - `food` → `식당`
  - `lodging` → `숙소`
  - `cafe` → `카페`
  - `shopping` → `쇼핑`
  - `etc` → `기타`

### States

- Loading: 기존 Day itinerary loading state를 유지한다.
- Edit form loading/saving: 저장 중에는 중복 제출을 막고 저장 action을 disabled 처리한다.
- Delete confirming: 삭제 전 확인 UI를 보여준다.
- Delete loading: 삭제 중에는 중복 제출을 막는다.
- Empty: 삭제 후 `items: []`이면 기존 empty state를 보여준다.
- Validation error: 사용자가 고칠 수 있는 입력 오류는 form 안에 짧은 한국어 copy로 보여준다.
- Not Found / Forbidden: item이 이미 삭제되었거나 접근할 수 없으면 Day itinerary를 refetch하고 필요 시 기존 non-retry 상태를 보여준다.
- Retryable Error: network, `5xx`, unknown error는 다시 시도 가능한 상태로 보여준다.
- Success: 수정/삭제 후 최신 Day 장소 목록을 보여준다.

### Copy / Labels

- Row action: `수정`
- Row action: `삭제`
- Edit title: `장소 수정`
- Field label: `장소명`
- Field label: `주소`
- Field label: `장소 타입`
- Save action: `저장`
- Cancel action: `취소`
- Delete confirm title: `이 장소를 삭제할까요?`
- Delete confirm helper: `이 Day 일정에서만 삭제돼요.`
- Delete confirm action: `삭제`
- Saving: `저장 중...`
- Deleting: `삭제 중...`
- Validation name empty: `장소명을 입력해주세요.`
- Validation address empty: `주소를 입력해주세요.`
- Generic mutation error: `장소 정보를 저장할 수 없어요. 잠시 후 다시 시도해주세요.`
- Generic delete error: `장소를 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 Day itinerary의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- 삭제 action은 `theme.color.danger` 의미를 사용한다.
- 장소 타입 label/color는 기존 `theme.placeType`과 helper를 재사용한다.
- 같은 버튼/카드/list row 패턴 중복이 이번 변경에서 두 번째로 생기면 공용 primitive 승격을 검토하되, 범위 밖 리팩터링은 하지 않는다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
PATCH /trips/{tripId}/days/{date}/itinerary/items/{itemId}
DELETE /trips/{tripId}/days/{date}/itinerary/items/{itemId}
```

Authenticated endpoints. `Authorization: Bearer <accessToken>`이 필요하다.

두 endpoint 모두 F-025의 existing Day itinerary resource 하위에 둔다. F-028에서는 별도 `trip_places` resource를 노출하지 않는다.

### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
itemId: string
```

### PATCH Request

`PATCH`는 existing trip update와 같은 partial update semantics를 따른다.

```json
{
  "name": "우메다 공중정원",
  "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka",
  "placeType": "sights"
}
```

Schema notes:

- `additionalProperties: false`
- `minProperties: 1`
- All fields are optional, but at least one of `name`, `address`, `placeType` must be present.
- Omitted fields remain unchanged.
- `name`: string, trim before validation, length 1..120 after trimming.
- `address`: string, trim before validation, length 1..300 after trimming.
- `placeType`: existing `TripPlaceType` enum.

Recommended schema name:

```yaml
UpdateDayItineraryItemRequest:
  type: object
  additionalProperties: false
  minProperties: 1
  properties:
    name:
      type: string
      minLength: 1
      maxLength: 120
    address:
      type: string
      minLength: 1
      maxLength: 300
    placeType:
      $ref: '#/components/schemas/TripPlaceType'
```

### PATCH Response

HTTP status: `200`

```json
{
  "item": {
    "id": "itinerary_item_123",
    "itemOrder": 2,
    "place": {
      "id": "trip_place_123",
      "name": "우메다 공중정원",
      "placeType": "sights",
      "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
    }
  }
}
```

Recommended schema name:

```yaml
UpdateDayItineraryItemResponse:
  type: object
  required:
    - item
  properties:
    item:
      $ref: '#/components/schemas/DayItineraryItem'
```

Response rules:

- `item.id` equals the `itemId` path parameter.
- `item.itemOrder` is unchanged by edit.
- `item.place.id` is the linked `trip_places.id`.
- `item.place.name`, `item.place.address`, and `item.place.placeType` reflect the saved snapshot after trimming/validation.

### DELETE Response

HTTP status: `204`

No response body.

DELETE success rules:

- The selected `itinerary_items` row is removed.
- Other `itinerary_items` rows that reference the same `trip_places` row remain intact.
- The linked `trip_places` row is removed only when no remaining itinerary item references it.
- F-028 does not expose a response that returns the updated Day list. Mobile refetches `GET /trips/{tripId}/days/{date}/itinerary` after success.

### Errors

공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "message",
    "details": []
  }
}
```

- `400 VALIDATION_ERROR`: invalid `tripId`, invalid `date`, invalid `itemId`, empty PATCH body, unknown JSON field, invalid field value, unsupported `placeType`
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant of the trip
- `404 NOT_FOUND`: trip does not exist, `date` is outside `trip.startDate`~`trip.endDate`, or `itemId` does not belong to the trip and selected date
- `500 INTERNAL_ERROR`: unexpected server/data error

Mobile error mapping:

- `401`: existing login recovery flow
- `400`: form validation or non-retry request error depending on source
- `403`, `404`: refetch Day itinerary and show non-retry not-found/access state if the Day itself is unavailable
- network, `5xx`, unknown: retryable mutation error with `다시 시도` or staying in edit/delete UI

## DB Changes

No DB schema migration.

F-028 uses the existing tables from F-025:

- `trip_places`: shared place snapshot fields `name`, `address`, `place_type`
- `itinerary_items`: scheduled Day row keyed by `trip_id`, `scheduled_date`, and linked `trip_place_id`

### Tables

No table changes.

### Constraints / Indexes

No new constraints or indexes are required for the minimal slice.

Existing constraints remain source of truth:

- `trip_places_name_length_check`: `char_length(name) BETWEEN 1 AND 120`
- `trip_places_place_type_check`: allowed place types
- `itinerary_items_trip_place_fk`: item references a place from the same trip
- `itinerary_items_trip_date_order_unique`: one order value per trip/date

### Queries

Implementation can adjust query names to match sqlc conventions, but F-028 needs query behavior equivalent to:

```sql
-- name: GetItineraryItemByTripDateAndID :one
SELECT
  ii.id::text AS id,
  ii.item_order,
  ii.trip_place_id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
WHERE ii.trip_id = $1::uuid
  AND ii.scheduled_date = $2
  AND ii.id = $3::uuid;
```

```sql
-- name: UpdateTripPlaceSnapshot :one
UPDATE trip_places
SET
  name = $3,
  address = $4,
  place_type = $5,
  updated_at = now()
WHERE trip_id = $1::uuid
  AND id = $2::uuid
RETURNING
  id::text,
  name,
  place_type,
  address;
```

```sql
-- name: DeleteItineraryItemByTripDateAndID :one
DELETE FROM itinerary_items
WHERE trip_id = $1::uuid
  AND scheduled_date = $2
  AND id = $3::uuid
RETURNING trip_place_id::text;
```

```sql
-- name: CountItineraryItemsByTripPlaceID :one
SELECT count(*)::int
FROM itinerary_items
WHERE trip_id = $1::uuid
  AND trip_place_id = $2::uuid;
```

```sql
-- name: DeleteTripPlaceByID :exec
DELETE FROM trip_places
WHERE trip_id = $1::uuid
  AND id = $2::uuid;
```

### Repository Notes

- PATCH should resolve the selected itinerary item by `tripId + date + itemId` before updating its linked `trip_place`.
- PATCH should return the updated item in `DayItineraryItem` shape.
- DELETE should run item deletion and orphan cleanup in a transaction.
- DELETE should not delete `trip_places` when any remaining `itinerary_items` row references it.
- If the delete target no longer exists, repository/service should surface `ErrNotFound`.

### Migration Notes

- No goose migration is expected.
- DB verification should still run existing migration status and regression tests.

## Business Rules

- Day identity remains `tripId + date`; there is no `trip_day_id`.
- The selected mutation target is the `itinerary_items.id` exposed as `DayItineraryItem.id`.
- Mutation endpoints require authentication.
- The authenticated user must be a participant of the trip.
- `tripId` and `itemId` must be valid IDs, and `date` must be a valid date-only `YYYY-MM-DD` string.
- `date` must be inside `trip.startDate`~`trip.endDate`; otherwise the virtual Day does not exist.
- `itemId` must belong to the same `tripId` and selected `scheduled_date`; otherwise return `404 NOT_FOUND`.
- PATCH updates only `name`, `address`, and `placeType` on the linked `trip_places` snapshot.
- PATCH does not modify `itemOrder`, `scheduledDate`, `tripId`, `itemId`, or `tripPlaceId`.
- PATCH omitted fields remain unchanged.
- Server trims leading/trailing whitespace for `name` and `address` before validation and storage.
- Server rejects empty or over-limit `name`/`address`, unsupported `placeType`, empty body, and unknown JSON fields with `400 VALIDATION_ERROR`.
- Updating one item changes the shared `trip_places` snapshot. If multiple itinerary items reference the same `trip_places` row, all of those rows show the updated place info on subsequent reads.
- DELETE removes only the selected `itinerary_items` row from the selected Day.
- DELETE removes the linked `trip_places` row only if no remaining itinerary item references it.
- DELETE does not manually reorder remaining `itemOrder` values in F-028. Arbitrary or user-visible order editing is F-029.
- Mobile refetches the Day itinerary after successful mutation to avoid stale local list state.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 `AC-*` 행 또는 `Regression Gaps`와 연결한다.

- [x] AC-01: `docs/features/0028-update-delete-itinerary-place.md`에 feature spec + implementation plan이 작성되어 있고 Ouroboros source가 기록되어 있다.
- [x] AC-02: `packages/api-contract/openapi.yaml`에 authenticated `PATCH /trips/{tripId}/days/{date}/itinerary/items/{itemId}` endpoint, request schema, and response schema가 정의되어 있다.
- [x] AC-03: `packages/api-contract/openapi.yaml`에 authenticated `DELETE /trips/{tripId}/days/{date}/itinerary/items/{itemId}` endpoint가 정의되어 있다.
- [x] AC-04: generated Go server artifact와 TypeScript client/type이 update/delete Day itinerary item endpoints와 schemas를 포함하도록 갱신되어 있다.
- [x] AC-05: F-028은 DB schema migration을 추가하지 않고 기존 `trip_places`/`itinerary_items` 모델을 유지한다.
- [x] AC-06: PATCH는 `name`, `address`, `placeType` 중 하나 이상을 받는 partial update이며 omitted fields를 기존 값으로 유지한다.
- [x] AC-07: PATCH는 `name`과 `address`의 leading/trailing whitespace를 trim한 뒤 저장한다.
- [x] AC-08: PATCH는 empty body, unknown field, empty/too-long `name`, empty/too-long `address`, unsupported `placeType`을 `400 VALIDATION_ERROR`로 거절한다.
- [x] AC-09: 인증되지 않은 PATCH/DELETE 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] AC-10: invalid `tripId`, invalid `date`, invalid `itemId`는 `400 VALIDATION_ERROR`를 반환한다.
- [x] AC-11: 존재하지 않는 trip 또는 여행 기간 밖 `date`는 `404 NOT_FOUND`를 반환한다.
- [x] AC-12: authenticated user가 participant가 아닌 trip의 item을 수정/삭제하면 `403 FORBIDDEN`을 반환한다.
- [x] AC-13: selected `itemId`가 해당 `tripId + date`에 속하지 않으면 PATCH/DELETE는 `404 NOT_FOUND`를 반환한다.
- [x] AC-14: PATCH 성공 시 `200`과 updated `DayItineraryItem`을 반환하며 `itemOrder`와 `item.id`는 변경되지 않는다.
- [x] AC-15: 같은 `trip_place`를 여러 itinerary item이 참조하면 PATCH 후 모든 참조 row가 업데이트된 place snapshot을 보여준다.
- [x] AC-16: DELETE 성공 시 `204`를 반환하고 selected Day의 subsequent GET response에서 해당 item이 사라진다.
- [x] AC-17: DELETE는 같은 `trip_place`를 참조하는 다른 itinerary item을 삭제하지 않는다.
- [x] AC-18: DELETE는 더 이상 참조되지 않는 `trip_place` row를 orphan cleanup으로 삭제한다.
- [x] AC-19: 모바일 Day 일정 화면은 각 장소 row에 `수정`, `삭제` action을 제공한다.
- [x] AC-20: 모바일 수정 UI는 현재 장소명, 주소, 타입으로 초기화되고 validation을 통과한 변경만 저장할 수 있다.
- [x] AC-21: 모바일은 generated client로 PATCH/DELETE를 호출하고 성공 후 Day itinerary를 갱신한다.
- [x] AC-22: 모바일 삭제는 확인 UI를 거치며, 삭제 후 장소가 없으면 기존 empty state를 표시한다.
- [x] AC-23: F-028 구현은 새 장소 추가, Google Places 선택, 순서 변경, Day 이동, 지도/길찾기, 도착/스킵, persistent `trip_days`를 포함하지 않는다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02, AC-03, AC-04: OpenAPI endpoints/schemas and generated artifacts drift 없음 | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-05: DB schema migration 없이 query/sqlc 변경만 포함됨 | DB/generated | migrations unchanged, sqlc generated drift | `pnpm verify:generated` |
| AC-06, AC-07, AC-14: PATCH partial update merges omitted fields, trims text, returns updated item without changing `itemOrder` | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-08, AC-10: PATCH validation for empty body, unknown fields, invalid IDs/date, empty/too-long text, unsupported type | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-09, AC-11, AC-12, AC-13: auth, missing trip, out-of-range Day, forbidden participant, item-not-in-Day errors | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-15: editing linked `trip_place` propagates to all itinerary rows that reference it | Repository/service | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-16, AC-17, AC-18: DELETE removes selected item, preserves other references, orphan-cleans unreferenced place in a transaction | Repository/service/handler | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-19, AC-20: mobile view-model/form helper exposes editable row state, validates fields, and builds partial PATCH request | Mobile logic/state | `apps/mobile/lib/trips/day-itinerary-edit.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-21, AC-22: mobile mutation state maps saving/deleting/success/error and delete confirmation/refetch intent | Mobile logic/state | `apps/mobile/lib/trips/day-itinerary-edit.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-21: mobile screen consumes generated API client/types without handwritten duplicate response types | Mobile type/UI | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| AC-01 through AC-23: Full regression suite remains green | All | verify gate | `pnpm verify` |

## Regression Gaps

- Native edit/delete UI interaction end-to-end: the current mobile test setup uses Node-based helper/state tests and does not include a React Native component or Expo Router e2e harness that can press the actual row actions, fill the form, confirm deletion, and assert the rendered refetched list.
  - Automated coverage retained: mobile helper/state tests cover form validation, request construction, mutation states, and refetch intent; API tests cover actual persisted mutation behavior.
  - Risk: a future UI wiring regression could break the actual Pressable/modal flow while helper tests remain green.
  - Follow-up: add a mobile component/e2e test harness before relying on complex mutation UI interactions as a regression gate.

## TDD Implementation Plan

1. Red: Contract/API handler tests
   - Add failing handler tests for PATCH/DELETE success, `401`, `400` invalid params/body, `403`, `404` missing trip, `404` out-of-range date, and `404` item not in selected Day.
   - Verify: `pnpm --filter @i-um/api test` fails because endpoints/types are not implemented.
2. Red: Service tests
   - Add failing service tests for partial PATCH merge, text trimming, validation failures, shared `trip_place` propagation, DELETE selected item, DELETE preserving other references, and orphan cleanup intent.
   - Verify: `pnpm --filter @i-um/api test` fails before service/repository methods exist.
3. Red: Repository/sqlc tests
   - Add failing repository tests that seed `trip_places` and `itinerary_items`, then assert update-by-item, delete-by-item, shared reference preservation, and orphan cleanup behavior.
   - Verify: `DATABASE_URL=... pnpm --filter @i-um/api test` fails before queries/generated DB code exist.
4. Red: Mobile helper/state tests
   - Add failing `apps/mobile/lib/trips/day-itinerary-edit.test.mts` for edit form initialization, validation, partial request building, delete confirmation state, mutation error mapping, and refetch intent after success.
   - Verify: `pnpm --filter @i-um/mobile test` fails before helper implementation.
5. Contract: Extend OpenAPI first
   - Add PATCH/DELETE item endpoints under `/trips/{tripId}/days/{date}/itinerary/items/{itemId}`.
   - Add `UpdateDayItineraryItemRequest` and `UpdateDayItineraryItemResponse` schemas.
   - Regenerate Go/TS artifacts with `pnpm generate`.
   - Verify: `pnpm verify:generated` passes after generated files are committed.
6. DB/query: Add sqlc mutation queries
   - Add item lookup, trip_place update, itinerary item delete, reference count, and orphan place delete queries to `apps/api/queries/trips.sql` or an itinerary-specific query file.
   - Regenerate sqlc code.
   - Verify: `pnpm verify:generated` and repository tests compile.
7. Green: API server minimum implementation
   - Add trip domain input/result types and repository interface methods.
   - Implement service validation using existing auth, participant membership, trip lookup, date range validation, and place type validation patterns.
   - Implement PATCH update and DELETE transaction/orphan cleanup in repository.
   - Add handler methods and OpenAPI response mapping.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
8. Green: Mobile UI/generated client integration
   - Add generated-client wrappers for update/delete Day itinerary item.
   - Add edit/delete helper/state module.
   - Update Day itinerary screen row actions, edit UI, delete confirmation UI, saving/deleting states, error copy, and success refetch.
   - Use theme tokens and existing place type label helper.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
9. Refactor: Clean only duplication introduced by this feature
   - Keep UI aligned with existing Day itinerary card/list style.
   - Avoid unrelated app-wide primitive extraction unless this feature duplicates the same component pattern locally.
   - Verify: rerun changed-layer tests.
10. Regression gate
   - Verify: `pnpm verify` passes.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

DB schema migration이 추가되지 않는 것이 기대값이다. 구현 중 schema migration이 필요해지면 spec을 먼저 업데이트하고 아래 검증을 추가한다.

```text
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
```

### Verification Results

- Red check: `pnpm --filter @i-um/api test`: failed as expected before implementation because `UpdateDayItineraryItem*` types and service/repository methods did not exist.
- Red check: `pnpm --filter @i-um/mobile test`: initially failed because the new `day-itinerary-edit` helper did not exist and `DayItineraryRowViewModel` did not expose `placeType`.
- `pnpm install --frozen-lockfile`: pass; worktree dependencies installed.
- `pnpm generate`: pass; OpenAPI Go/TS artifacts and sqlc DB code regenerated.
- `pnpm verify:generated`: pass.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; migrations 00001 through 00004 applied.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.
- Manual device/simulator smoke: not run in this implementation pass.
- Staging/internal build verification: not run in this implementation pass.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 앱에서 장소가 있는 Day 일정 화면을 열고 장소 row에 `수정`, `삭제` action이 보이는지 확인한다.
- [ ] `수정`을 눌러 장소명, 주소, 타입을 변경하고 저장하면 같은 Day 화면에서 변경된 값이 보이는지 확인한다.
- [ ] 저장 중 중복 제출이 막히는지 확인한다.
- [ ] 빈 장소명 또는 빈 주소에서 validation copy가 보이고 API 요청이 나가지 않는지 확인한다.
- [ ] `삭제`를 누르면 확인 UI가 먼저 보이고, 취소하면 목록이 유지되는지 확인한다.
- [ ] 삭제를 확정하면 해당 row가 Day 목록에서 사라지는지 확인한다.
- [ ] 마지막 장소를 삭제하면 기존 empty state가 보이는지 확인한다.
- [ ] API/network error를 유도했을 때 retryable mutation error copy가 보이는지 확인한다.
- [ ] staging 또는 internal build에서 edit/delete happy path를 확인한다.

## Release Notes

```text
- Day 일정 화면에서 등록된 장소의 이름, 주소, 타입을 수정할 수 있다.
- Day 일정 화면에서 더 이상 방문하지 않을 장소를 삭제할 수 있다.
```

## Open Questions

- None. User approved implementation from the Draft spec on 2026-06-23.

## Follow-up Issues

- #27: Google Places 장소 검색/선택
- #29: 일정 순서 변경
- #30: 숙소 장소 지정
- #36: 다음 장소 길찾기
- #39: 장소 지도 열기/주소 복사
- #46: 공동 일정 편집 반영
- TBD: Mobile component/e2e test harness for Day itinerary mutation UI
