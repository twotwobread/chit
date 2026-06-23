# Feature Slice: F-030 Day별 숙소 장소 지정

## Metadata

- GitHub Issue: #30
- Status: Code Review
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Initial Interview Session: `interview_20260623_111922`
- Ambiguity Review Session: `interview_20260623_123644`
- Seed: N/A
- PM Document: N/A
- Notes: Initial ambiguity score `0.09`. Follow-up product discussion on 2026-06-23 changed the scope from one trip-level lodging place to Day-level lodging targets and clarified that current `itinerary_items` should evolve as schedule items. F-030 remains focused on lodging target selection; optional time/timeline scheduling is split to #95 and standalone lodging-place registration/selection is split to #96. Ouroboros ambiguity review reached `0.06` and confirmed API idempotency, out-of-range date handling, silent cascade clear, last-write-wins replacement, and non-optimistic mobile update behavior.

## Goal

사용자가 특정 Day에 복귀하거나 숙박할 숙소 장소를 지정/해제할 수 있다.

F-030은 `Day -> lodging TripPlace`를 저장하고 앱/API에서 표시하는 기반을 만든다. 시간표 기반 일정 편집, 숙소 장소 별도 등록, 실제 Google Maps 길찾기/숙소로 이동 버튼은 후속 feature에서 다룬다.

## Problem

- 2박 3일 여행에서 숙소가 바뀔 수 있으므로 trip 전체에 숙소 1개만 저장하면 Day별 숙소 복귀 흐름을 표현할 수 없다.
- 숙소는 장소이지만 반드시 그 Day 일정의 첫 번째/마지막 방문 row가 아니다.
- 사용자는 `관광지 -> 숙소 휴식 -> 다시 외출 -> 숙소 복귀`처럼 같은 숙소 장소를 여러 일정 항목에서 참조할 수 있어야 한다.
- 현재 `TripPlace`는 “어디인가”이고 `itinerary_items`는 “해당 Day에 어떤 순서로 배치된 일정 항목”이다. F-030은 이 구조를 유지하면서 숙소 target만 Day별로 추가한다.

## Product Model Decision

F-030 기준 모델은 다음과 같다.

```text
TripPlace = 장소 스냅샷. 이름, 주소, 장소 타입 등 “어디인가”.
ItineraryItem = ScheduleItem의 초기 형태. 특정 Day에 어떤 장소를 어떤 순서로 배치했는가.
DayLodging = 특정 Day의 숙박/복귀 target. TripPlace를 참조하지만 ItineraryItem일 필요는 없다.
```

중요한 분리:

- 장소에 시간을 저장하지 않는다.
- 일정/스케줄 시간은 후속 #95에서 `itinerary_items` 또는 schedule item 모델에 optional로 추가한다.
- 숙소 지정은 `placeType = lodging`과 다르다. 숙소 target은 별도 Day-level reference다.
- Day lodging이 지정되어도 그 Day의 첫 일정이나 출발지가 자동으로 숙소가 되지는 않는다.
- Day 2의 첫 출발지는 Day 1 숙소일 수 있고, Day 2의 복귀 target은 Day 2 숙소일 수 있다. 이 origin/destination 결정은 #35~#37에서 다룬다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 앱은 `GET /trips/{tripId}/days/{date}/itinerary`로 Day 일정과 해당 Day의 `lodgingPlace`를 가져온다.
3. 사용자가 기존 Day 일정 row에서 `숙소로 지정` action을 누른다.
4. 앱은 generated client로 `PUT /trips/{tripId}/days/{date}/lodging-place`를 호출해 해당 row의 `place.id`를 Day lodging target으로 저장한다.
5. 서버는 인증, 여행 참여자 권한, trip 존재 여부, date가 trip 범위 안인지, `tripPlaceId`가 같은 trip에 속하는지 검증한다.
6. 저장 성공 후 앱은 Day itinerary를 다시 불러오거나 응답을 반영해 같은 `trip_place`를 참조하는 row에 `대표 숙소` badge를 표시한다.
7. 여행 상세 화면은 각 Day row에서 해당 Day의 lodging summary를 보여줄 수 있다.
8. 같은 Day에 이미 숙소가 지정된 상태에서 다른 row를 `숙소로 지정`하면 확인 dialog 없이 즉시 해당 Day 숙소를 새 장소로 교체한다.
9. 사용자가 선택된 row의 `숙소 해제` action을 누르면 앱은 `DELETE /trips/{tripId}/days/{date}/lodging-place`를 호출하고, 이후 해당 Day의 숙소 badge/summary가 사라진다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: Day 일정 row의 `숙소로 지정`/`숙소 해제` action, `대표 숙소` badge, trip detail Day row의 Day별 lodging summary 표시
- [ ] API Contract: authenticated `PUT /trips/{tripId}/days/{date}/lodging-place`, `DELETE /trips/{tripId}/days/{date}/lodging-place`, Day lodging summary response, `DayItineraryItem.isLodging`
- [ ] API Server: set/clear Day lodging handler/service/repository, participant authorization, date range validation, same-trip `tripPlaceId` validation, trip detail/day itinerary lodging mapping
- [ ] DB: Day별 숙소 target을 저장하는 `day_lodging_places` table migration 또는 동등한 same-trip FK persistence
- [ ] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API validation/authorization/set/replace/clear behavior, DB same-trip/cascade behavior, mobile lodging state/action helpers, generated/typecheck gates
- [ ] Deployment: local/staging 또는 internal build에서 Day row 숙소 지정/해제와 trip detail Day lodging summary smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 시작/종료 시간, 30분 단위 타임라인, 시간 미정 영역 등 시간 기반 일정 UX (#95)
- 숙소를 방문 일정 row 없이 별도로 직접 등록하거나 trip place list에서 선택하는 전용 숙소 등록/선택 흐름 (#96)
- 오늘 실행 화면의 `숙소로 이동` 버튼 구현 (#35)
- Google Maps URL 생성, 길찾기 실행, 이동 모드 선택 (#36~#39)
- 현재 위치, 이전 schedule item, 전날 숙소를 origin으로 결정하는 로직 (#35~#37)
- 여러 숙소를 한 Day에 동시에 지정하는 기능
- 체크인/체크아웃 기간, 예약번호, 전화번호, 숙박비/정산 연결
- `trip_places.place_type` 자동 변경
- itinerary item 생성/삭제/순서 변경/Day 이동
- 장소 좌표 저장/보강
- 실시간 공동 편집 push/polling 또는 conflict presence (#46)

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 기존 Day 일정 row에 숙소 지정 상태와 row action을 추가한다.
  - 숙소로 지정되지 않은 row에는 `숙소로 지정` action을 보여준다.
  - 현재 Day lodging으로 선택된 `trip_place`를 참조하는 row에는 `대표 숙소` badge와 `숙소 해제` action을 보여준다.
  - 같은 `trip_place`를 여러 itinerary item이 참조하면 해당 Day에서 보이는 모든 matching row에 `대표 숙소` badge를 보여준다.
  - 저장/해제 중에는 해당 action을 중복 실행할 수 없게 한다.
  - 성공 후 Day itinerary를 refetch하거나 equivalent local state update로 badge/action을 최신 상태로 만든다.
  - F-030에서는 숙소 등록 전용 화면을 추가하지 않는다. 숙소로 지정할 장소는 기존 Day row의 `place.id`를 사용한다.

- `apps/mobile/app/trips/[tripId]/index.tsx`
  - 여행 상세의 Day list에서 Day별 lodging summary를 표시한다.
  - Day에 숙소가 지정되어 있으면 최소한 장소명을 보여준다. 공간이 허용되면 주소도 보여준다.
  - Day에 숙소가 없으면 Day row 안에서 별도 empty copy를 강제하지 않는다. 구현 시 기존 density에 맞춰 숨김 또는 짧은 helper를 선택한다.
  - F-030에서는 trip detail에서 숙소를 선택/해제하는 별도 action을 추가하지 않는다.

### States

- Loading: 기존 Day itinerary/trip detail loading state를 유지한다.
- Empty Day: 장소가 없는 Day에서는 row 기반 숙소 지정 action이 없다.
- Success: 선택된 row는 `대표 숙소` badge를 표시한다.
- Setting/Clearing: `숙소로 지정 중...` 또는 disabled action으로 중복 실행을 막는다.
- Replace: 같은 Day에서 다른 row의 `숙소로 지정`을 누르면 confirmation/undo 없이 요청한다. Optimistic update는 하지 않고, 요청 성공 후 refetch 또는 response 반영으로 Day lodging을 교체한다.
- Clear Success: 해당 Day의 `lodgingPlace = null` 상태가 되고 badge/summary가 사라진다.
- Not Found / Forbidden: `403`, `404`는 기존 non-retry state를 사용한다.
- Retryable Error: network, `5xx`, unknown error는 retry 가능한 mutation error로 보여주고 기존 Day itinerary state는 유지한다.

### Copy / Labels

- Row badge: `대표 숙소`
- Row action: `숙소로 지정`
- Selected row action: `숙소 해제`
- Trip detail label: `숙소`
- Setting: `숙소로 지정 중...`
- Clearing: `숙소 해제 중...`
- Generic mutation error: `숙소 정보를 저장할 수 없어요. 잠시 후 다시 시도해주세요.`
- Not found title: `일정을 찾을 수 없어요.`
- Not found helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 숙소 badge는 임의 unicode icon 없이 text badge 또는 기존 line-icon source가 있을 때만 icon으로 표현한다.
- 기존 Day itinerary card/list row 패턴과 trip detail card 스타일을 유지한다.
- 같은 action/badge helper가 반복되면 F-030에서 추가한 중복만 작은 helper로 추출한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
PUT /trips/{tripId}/days/{date}/lodging-place
DELETE /trips/{tripId}/days/{date}/lodging-place
```

Authenticated endpoints. `Authorization: Bearer <accessToken>`이 필요하다. 여행 참여자라면 owner/member 모두 Day lodging을 지정/해제할 수 있다.

### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
```

### PUT Request

Schema name: `SetDayLodgingPlaceRequest`

```json
{
  "tripPlaceId": "trip_place_123"
}
```

Schema notes:

- `tripPlaceId`: required string. DB 내부 구현은 UUID string을 기대한다.
- `date`는 trip `startDate`~`endDate` 범위 안이어야 한다.
- `tripPlaceId`는 같은 `tripId`에 속한 existing `trip_places.id`여야 한다.
- F-030 mobile UI는 Day itinerary row의 `item.place.id`만 전송한다.
- API는 후속 #96을 위해 same-trip existing `trip_places`라면 해당 Day row에 보이지 않는 place도 저장할 수 있게 해도 된다. 단, F-030 UI는 row 기반으로 제한한다.

### PUT Response

HTTP status: `200`

Schema name: `SetDayLodgingPlaceResponse`

```json
{
  "day": {
    "date": "2026-07-10",
    "dayOrder": 1,
    "lodgingPlace": {
      "id": "trip_place_123",
      "name": "호텔 니코 오사카",
      "placeType": "lodging",
      "address": "1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka"
    }
  },
  "lodgingPlace": {
    "id": "trip_place_123",
    "name": "호텔 니코 오사카",
    "placeType": "lodging",
    "address": "1 Chome-3-3 Nishi-Shinsaibashi, Chuo Ward, Osaka"
  }
}
```

Response rules:

- `day.date` equals the validated `date` path parameter.
- `day.dayOrder` is calculated by the server from trip start date.
- `lodgingPlace` is the latest `TripPlaceSummary` for the saved Day lodging target.
- If the selected Day already has lodging, the new `tripPlaceId` immediately replaces it.
- Setting the same place again returns idempotent `200` success.
- `PUT` returns only Day-level lodging summary data, not the full Day itinerary items. Clients refetch `GET /trips/{tripId}/days/{date}/itinerary` when they need the latest full row list.
- Concurrent valid set requests are last-write-wins. F-030 does not introduce a lodging-specific conflict response.

### DELETE Response

HTTP status: `204`

No response body.

Clear rules:

- The selected Day lodging reference is deleted.
- Calling clear for a Day with no lodging is `204` no-op if trip/date exist and user is authorized.

### Existing Response Updates

`TripDay` gains nullable `lodgingPlace`:

```yaml
TripDay:
  required:
    - date
    - dayOrder
    - lodgingPlace
  properties:
    date:
      type: string
      format: date
    dayOrder:
      type: integer
      minimum: 1
    lodgingPlace:
      allOf:
        - $ref: '#/components/schemas/TripPlaceSummary'
      nullable: true
```

This affects `GET /trips/{tripId}` `days[]` and `GET /trips/{tripId}/days/{date}/itinerary` `day`.

`DayItineraryItem` gains required `isLodging`:

```yaml
DayItineraryItem:
  required:
    - id
    - itemOrder
    - version
    - isLodging
    - place
  properties:
    isLodging:
      type: boolean
```

This affects all responses containing `DayItineraryItem`, including:

- `GET /trips/{tripId}/days/{date}/itinerary`
- `POST /trips/{tripId}/days/{date}/itinerary-items`
- `PATCH /trips/{tripId}/days/{date}/itinerary/items/{itemId}`
- `PATCH /trips/{tripId}/days/{date}/itinerary-items/order`

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

- `400 VALIDATION_ERROR`: invalid `tripId`, invalid `date` format, missing/invalid `tripPlaceId`, malformed JSON
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant of the trip
- `404 NOT_FOUND`: trip does not exist, `date` is outside trip range, or `tripPlaceId` does not exist in the selected trip
- `500 INTERNAL_ERROR`: unexpected server/data error

Mobile error mapping:

- `400`: safe mutation failure; keep current screen state and show generic mutation error
- `401`: existing auth recovery/login flow
- `403`, `404`: existing non-retry not-found/access state when the Day/trip is unavailable
- network, `5xx`, unknown: retryable mutation error with the action enabled again

## DB Changes

F-030 persists Day-level lodging selection without mutating `trip_places.place_type` or `itinerary_items`.

### Tables

Recommended migration name: `00006_create_day_lodging_places.sql` or equivalent next goose number.

```sql
CREATE TABLE day_lodging_places (
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  lodging_date date NOT NULL,
  trip_place_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (trip_id, lodging_date),
  CONSTRAINT day_lodging_places_trip_place_fk
    FOREIGN KEY (trip_place_id, trip_id)
    REFERENCES trip_places(id, trip_id)
    ON DELETE CASCADE
);

CREATE INDEX day_lodging_places_trip_place_id_idx
  ON day_lodging_places (trip_place_id);
```

Rationale:

- `(trip_id, lodging_date)` enforces at most one lodging target per Day.
- No row means no lodging selected for that Day.
- Composite FK enforces that the selected `trip_place` belongs to the same trip.
- `ON DELETE CASCADE` clears Day lodging rows when the referenced `trip_places` row is deleted.
- Date range cannot be enforced by a simple FK to virtual Days, so the service validates `lodging_date` against `trips.start_date` and `trips.end_date`.

### Constraints / Indexes

- `day_lodging_places PRIMARY KEY (trip_id, lodging_date)`: at most one active lodging per Day.
- `day_lodging_places_trip_place_fk`: selected place must belong to the same trip.
- `day_lodging_places_trip_place_id_idx`: supports lookup/cleanup by selected place.

### Queries

Implementation can adjust query names to match sqlc conventions, but F-030 needs behavior equivalent to:

```sql
-- name: UpsertDayLodgingPlace :one
INSERT INTO day_lodging_places (trip_id, lodging_date, trip_place_id)
VALUES ($1::uuid, $2, $3::uuid)
ON CONFLICT (trip_id, lodging_date) DO UPDATE
SET trip_place_id = EXCLUDED.trip_place_id,
    updated_at = now()
RETURNING trip_id::text, lodging_date, trip_place_id::text;
```

```sql
-- name: DeleteDayLodgingPlace :exec
DELETE FROM day_lodging_places
WHERE trip_id = $1::uuid
  AND lodging_date = $2;
```

```sql
-- name: GetDayLodgingPlaceByTripAndDate :one
SELECT
  tp.id::text AS id,
  tp.name,
  tp.place_type,
  tp.address
FROM day_lodging_places dlp
JOIN trip_places tp
  ON tp.id = dlp.trip_place_id
 AND tp.trip_id = dlp.trip_id
WHERE dlp.trip_id = $1::uuid
  AND dlp.lodging_date = $2;
```

`GET /trips/{tripId}` Day generation should left join Day lodging by generated virtual Day date.

`ListItineraryItemsByTripAndDate` should add an `is_lodging` projection:

```sql
SELECT
  ii.id::text AS id,
  ii.version,
  row_number() OVER (ORDER BY ii.rank ASC, ii.id ASC)::int AS item_order,
  (dlp.trip_place_id IS NOT NULL) AS is_lodging,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
LEFT JOIN day_lodging_places dlp
  ON dlp.trip_id = ii.trip_id
 AND dlp.lodging_date = ii.scheduled_date
 AND dlp.trip_place_id = ii.trip_place_id
WHERE ii.trip_id = $1::uuid
  AND ii.scheduled_date = $2
ORDER BY ii.rank ASC, ii.id ASC;
```

### Migration Notes

- Up migration creates `day_lodging_places` after `trip_places` exists.
- Down migration drops `day_lodging_places` only.
- DB migration apply/status/rollback/apply verification is required.
- F-030 does not rename `itinerary_items` to `schedule_items`.

## Business Rules

- A Day has zero or one lodging target.
- No lodging selected is a valid state.
- Setting/clearing Day lodging requires authentication and trip participant membership.
- Owner-only restriction is not applied in F-030; owner and member can both set/clear Day lodging, matching MVP collaborative itinerary editing.
- The selected lodging target must be an existing `trip_places` row belonging to the trip.
- The selected date must be inside `trip.startDate` through `trip.endDate`.
- F-030 mobile exposes selection from existing Day itinerary rows only.
- Setting a new lodging for the same Day immediately replaces the previous lodging without confirmation.
- Concurrent valid set requests for the same Day use last-write-wins; F-030 does not return `409 CONFLICT` for lodging replacement races.
- Repeating set with the same `tripPlaceId` is semantically idempotent. The spec does not constrain whether audit `updated_at` changes.
- Clearing Day lodging is explicit via `숙소 해제` and leaves the underlying place and itinerary items unchanged.
- Clearing when no lodging is selected is an idempotent `204` success.
- Clearing lodging is always allowed; no lodging selected is valid regardless of itinerary contents, duplicate rows, or prior lodging history.
- If the referenced `trip_places` row is deleted, all Day lodging rows pointing to it are silently cleared. F-030 has no tombstone/event UI for this case; subsequent reads show `lodgingPlace: null` and `isLodging: false`.
- If one itinerary item is deleted but the same `trip_place` remains in `trip_places`, the Day lodging selection remains.
- The selected `trip_place` keeps its original `placeType`; F-030 never mutates `trip_places.place_type`.
- If the selected place's name/address/placeType is edited through F-028, the Day lodging summary and badges reflect the latest snapshot.
- Any visible Day itinerary row backed by that Day's selected `trip_place` has `isLodging = true` and shows `대표 숙소`.
- If the Day lodging target is a same-trip `TripPlace` that is not present in that Day's itinerary rows, trip detail still displays the Day lodging summary and the Day itinerary screen simply has no row-level lodging badge.
- A lodging target does not imply that the first schedule item starts from lodging.
- F-030 does not create/delete places, create/delete itinerary items, change item order, change rank/version, move items between Days, add optional time fields, or add Google Maps navigation.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 자동화 테스트와 연결한다.

- [ ] AC-01: `docs/features/0030-set-lodging-place.md`에 Day별 숙소 장소 지정 feature spec + implementation plan이 작성되어 있고 Ouroboros/source notes가 기록되어 있다.
- [ ] AC-02: `packages/api-contract/openapi.yaml`에 authenticated `PUT /trips/{tripId}/days/{date}/lodging-place` endpoint와 request/response schema가 정의되어 있다.
- [ ] AC-03: `packages/api-contract/openapi.yaml`에 authenticated `DELETE /trips/{tripId}/days/{date}/lodging-place` endpoint가 정의되어 있다.
- [ ] AC-04: `TripDay` 또는 equivalent day summary response는 nullable `lodgingPlace` summary를 포함한다.
- [ ] AC-05: `DayItineraryItem`은 required `isLodging` boolean을 포함한다.
- [ ] AC-06: generated Go server artifact와 TypeScript client/type이 lodging endpoints와 updated schemas를 포함하도록 갱신되어 있다.
- [ ] AC-07: DB migration은 Day별 숙소 target persistence를 추가하고 same-trip selected place constraint를 보장한다.
- [ ] AC-08: selected `trip_places` row가 삭제되면 해당 place를 참조하는 Day lodging rows가 tombstone 없이 자동으로 clear되고 subsequent read는 `lodgingPlace: null`과 `isLodging: false`를 반환한다.
- [ ] AC-09: 인증되지 않은 set/clear 요청은 `401 UNAUTHORIZED`를 반환한다.
- [ ] AC-10: invalid `tripId`, invalid `date` format, missing/invalid `tripPlaceId`, malformed JSON은 `400 VALIDATION_ERROR`를 반환한다.
- [ ] AC-11: 존재하지 않는 trip 또는 여행 기간 밖 `date`는 set/clear에서 `404 NOT_FOUND`를 반환한다.
- [ ] AC-12: participant가 아닌 authenticated user의 set/clear 요청은 `403 FORBIDDEN`을 반환한다.
- [ ] AC-13: `tripPlaceId`가 selected trip에 속하지 않으면 set 요청은 `404 NOT_FOUND`를 반환하고 Day lodging selection을 변경하지 않는다.
- [ ] AC-14: valid participant set 요청은 `200`과 selected Day/lodging summary를 반환하며 full itinerary item list를 응답하지 않는다.
- [ ] AC-15: 같은 Day에서 다른 place를 set하면 기존 Day lodging selection이 confirmation/undo 없이 새 place로 교체되고, 모바일은 요청 성공 후 refetch 또는 response 반영으로 UI를 갱신한다.
- [ ] AC-16: 같은 Day에 같은 place를 다시 set하면 semantic idempotent `200` success로 처리되며 place type/order/rank/version/time side effect가 없다. Audit timestamp 변경 여부는 고정하지 않는다.
- [ ] AC-17: 여러 클라이언트가 같은 Day에 서로 다른 lodging을 set하면 last-write-wins로 처리되고 lodging-specific `409 CONFLICT`를 반환하지 않는다.
- [ ] AC-18: clear 요청은 `204`를 반환하고 해당 Day lodging selection을 null 상태로 만든다.
- [ ] AC-19: lodging이 없는 Day의 clear 요청은 권한이 있으면 `204` no-op으로 처리된다.
- [ ] AC-20: `GET /trips/{tripId}`는 Day별 lodging이 있으면 latest place summary를, 없으면 `lodgingPlace: null` equivalent를 반환한다. 선택된 `TripPlace`가 해당 Day itinerary row에 없어도 Day summary는 lodging을 표시한다.
- [ ] AC-21: `GET /trips/{tripId}/days/{date}/itinerary`는 selected `trip_place`를 참조하는 해당 Day의 모든 row에 `isLodging: true`를 반환하고 다른 row에는 `false`를 반환한다.
- [ ] AC-22: lodging set/clear는 `placeType`, itinerary row 생성/삭제, 순서/rank/version, scheduled date, optional time fields를 변경하지 않는다.
- [ ] AC-23: 모바일 Day 일정 화면은 non-selected row에 `숙소로 지정`, selected row에 `대표 숙소` badge와 `숙소 해제`를 제공한다.
- [ ] AC-24: 모바일 trip detail은 Day별 lodging summary를 표시하고, F-030에서는 trip detail에서 숙소 선택/해제 action을 제공하지 않는다.
- [ ] AC-25: 모바일은 generated TypeScript client/types로 set/clear와 updated day/detail response를 사용한다.
- [ ] AC-26: F-030 구현은 시간표 기반 일정 UI, 숙소 장소 별도 등록, 숙소 복귀 버튼, Google Maps 길찾기, 좌표 저장, 여러 숙소/날짜별 숙박 기간 관리를 포함하지 않는다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02, AC-03, AC-04, AC-05, AC-06: OpenAPI endpoints/schemas and generated artifacts are in sync | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-07, AC-08: migration creates one lodging selection per Day, enforces same-trip selected place, and silently clears on selected place delete | DB migration/repository | `apps/api/migrations/00006_create_day_lodging_places.sql`, `apps/api/internal/storage/trip_repository_test.go` | `DATABASE_URL=... pnpm db:migrate && DATABASE_URL=... pnpm db:status && DATABASE_URL=... pnpm db:rollback && DATABASE_URL=... pnpm db:migrate`; `pnpm --filter @i-um/api test` |
| AC-09, AC-10, AC-11, AC-12, AC-13: auth, validation, not found, forbidden, cross-trip place errors | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-14, AC-15, AC-16, AC-17, AC-18, AC-19: valid set response shape, replace, semantic idempotent set, last-write-wins, clear, idempotent clear | API service/repository | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-20: trip detail returns latest nullable Day lodging summary even when selected place is not present in that Day's itinerary rows | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-21, AC-22: day itinerary maps `isLodging` for every row with selected `trip_place` and does not alter order/type/version | Repository/service | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-23: mobile row helper maps `isLodging` to `대표 숙소`, `숙소로 지정`, and `숙소 해제` view state | Mobile logic/state | `apps/mobile/lib/trips/lodging-place.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-24: mobile trip detail helper maps nullable Day lodging summary to display state without selection action | Mobile logic/state | `apps/mobile/lib/trips/lodging-place.test.mts` or trip detail helper test | `pnpm --filter @i-um/mobile test` |
| AC-25: mobile screen/client consumes generated API client/types without hand-written duplicate contract types | Mobile type/UI | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| AC-26: scoped exclusions remain unimplemented | Static review/generated drift | OpenAPI routes, mobile routes, DB migrations | `pnpm verify:generated` |
| All ACs: full regression gate remains green | All | workspace verify | `pnpm verify` |

## Regression Gaps

- Native row action interaction end-to-end is not fully covered by the current pure Node mobile test setup.
  - Automated coverage retained: mobile helper/state tests cover badge/action mapping, mutation request intent, and generated type integration; API tests cover persisted behavior.
  - Risk: a screen wiring regression could break the actual tap/action flow while helper tests remain green.
  - Follow-up: add a mobile component/e2e harness for Day itinerary row actions.

## TDD Implementation Plan

1. Red: Contract/API handler tests
   - Add failing tests for `PUT /trips/{tripId}/days/{date}/lodging-place` and `DELETE /trips/{tripId}/days/{date}/lodging-place`: `401`, invalid params/body, missing trip, out-of-range date, forbidden participant, cross-trip/nonexistent `tripPlaceId`, valid set response shape without full itinerary, replace, semantic idempotent set, last-write-wins replacement, clear, and idempotent clear.
   - Verify: `pnpm --filter @i-um/api test` fails before endpoints/types are implemented.
2. Red: Repository and migration tests
   - Add failing repository tests for same-trip Day lodging persistence, one-row-per-Day replacement, semantic same-place upsert behavior, trip detail Day lodging summary lookup even when the selected place has no row on that Day, Day itinerary `isLodging` mapping, and silent cascade clear when selected `trip_places` row is deleted.
   - Verify: `DATABASE_URL=... pnpm --filter @i-um/api test` fails before migration/query implementation.
3. Red: Mobile lodging helper/state tests
   - Add failing `apps/mobile/lib/trips/lodging-place.test.mts` for row badge/action mapping, trip detail Day lodging summary state, set/clear submit state, no optimistic replacement before request success, mutation failure mapping, and generated request shape.
   - Verify: `pnpm --filter @i-um/mobile test` fails before helper implementation.
4. Contract: OpenAPI first
   - Add Day lodging set/clear endpoints, `SetDayLodgingPlaceRequest`, `SetDayLodgingPlaceResponse`, Day summary `lodgingPlace`, and `DayItineraryItem.isLodging`.
   - Regenerate Go/TypeScript artifacts.
   - Verify: `pnpm generate && pnpm verify:generated` passes.
5. DB migration and sqlc queries
   - Add `day_lodging_places` migration with same-trip composite FK and cascade clearing.
   - Add sqlc queries for upsert, delete, Day lodging summary lookup, trip detail Day list mapping, and Day itinerary `is_lodging` projection.
   - Verify: DB migrate/status/rollback/migrate and repository tests compile.
6. Green: API implementation
   - Add trip service methods for setting and clearing Day lodging.
   - Reuse existing auth context, trip lookup, date range validation, participant authorization, common error mapping, and place summary mapping.
   - Ensure set/clear has no side effects on place type, itinerary items, order, rank, version, or future optional time fields.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
7. Green: Mobile implementation
   - Add generated-client wrappers for set/clear Day lodging.
   - Extend Day itinerary view model with `isLodging`, badge/action state, setting/clearing mutation state, and refetch behavior.
   - Extend trip detail Day list rendering for nullable Day lodging summary without adding a selection surface.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
8. Refactor
   - Remove only duplication introduced by F-030. Keep unrelated Day/add/search/edit/reorder UI unchanged.
   - Verify related API/mobile tests pass.
9. Regression gate
   - Verify: `pnpm verify`.
10. Manual smoke
   - Verify Day 화면 with 1+ places → `숙소로 지정` → badge appears → trip detail Day lodging summary appears → another row replaces Day lodging → `숙소 해제` clears summary/badge.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm generate
pnpm verify:generated
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

### Manual Smoke

아래 항목은 실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 장소가 있는 Day 일정 화면을 열고 각 row에 `숙소로 지정` action이 보이는지 확인한다.
- [ ] 한 row를 `숙소로 지정`하면 해당 row에 `대표 숙소` badge와 `숙소 해제` action이 보이는지 확인한다.
- [ ] 여행 상세 화면에서 해당 Day row에 lodging name summary가 보이는지 확인한다.
- [ ] 같은 Day에서 다른 row를 `숙소로 지정`하면 기존 badge가 사라지고 새 row에 badge가 이동하는지 확인한다.
- [ ] `숙소 해제`를 누르면 해당 Day의 badge와 trip detail lodging summary가 사라지는지 확인한다.
- [ ] 같은 `trip_place`가 한 Day의 여러 row에 보이는 test/dev data에서 모든 matching row에 `대표 숙소` badge가 표시되는지 확인한다.
- [ ] selected lodging place의 마지막 itinerary item을 삭제하더라도 `trip_places`가 남아 있으면 Day lodging이 유지되는지 확인한다.
- [ ] selected lodging `trip_places` row 삭제/cascade 상황에서는 Day lodging summary가 사라지는지 확인한다.
- [ ] API/network error를 유도했을 때 기존 화면 상태가 유지되고 retry 가능한 error copy가 보이는지 확인한다.
- [ ] staging 또는 internal build에서 set/replace/clear happy path를 확인한다.

## Release Notes

```text
- Day별로 대표 숙소 장소를 지정하거나 해제할 수 있습니다.
- Day 일정 화면과 여행 상세의 Day 목록에서 현재 Day의 대표 숙소가 표시됩니다.
- 숙소 복귀와 Google Maps 길찾기 기능에서 사용할 Day lodging target 기반을 추가합니다.
```

## Open Questions

None for F-030. Implementation started after explicit user approval on 2026-06-23.

## Follow-up Issues

- #95: 시간 선택 가능한 일정 항목/타임라인. `itinerary_items`를 optional time을 가진 schedule item으로 확장하고 30분 단위 일정 UI를 제공한다.
- #96: 숙소 장소 별도 등록/선택. 숙소를 itinerary row로 추가하지 않아도 `trip_places`에 저장하고 Day lodging으로 지정할 수 있게 한다.
- #35: 오늘 실행 화면의 숙소로 이동 버튼
- #36: 다음 장소 길찾기 / Google Maps URL 연결
- #37: 이전 schedule item 또는 전날 숙소 기준 길찾기
- #39: 장소 지도 열기/주소 복사
- #46: 공동 일정 편집 반영. 다른 참여자의 lodging 변경을 화면에 반영/안내하는 UX를 다룬다.
- TBD: 여러 숙소, 날짜별 숙박 기간, 체크인/체크아웃 관리
- TBD: lodging target에 좌표/provider place id를 연결한 Google Maps precision 개선
- TBD: Mobile component/e2e test harness for Day itinerary row actions
