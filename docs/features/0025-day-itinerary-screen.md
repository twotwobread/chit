# Feature Slice: F-025 Day별 일정 화면

## Metadata

- GitHub Issue: #25
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260622_143233`
- Seed: `seed_b5ad524ff07e`
- PM Document: N/A
- Notes: Ambiguity score `0.0765`. Ouroboros clarified F-025 as a minimal read-only Day itinerary screen. The selected Day is identified by `tripId + date`, reusing F-024 virtual Days and intentionally not creating a persistent `trip_days` table. The source of truth for rows is `itinerary_items` keyed by `trip_id + scheduled_date`, joined with `trip_places` for display fields.

## Goal

사용자가 여행 상세 화면의 Day를 눌러 해당 날짜의 방문 장소 목록을 순서대로 확인할 수 있다.

F-025는 Day별 장소 목록을 읽기 전용으로 보여주는 최소 vertical slice다. 장소 추가, 수정, 삭제, 순서 변경, 지도/길찾기, 도착/스킵 같은 실행 기능은 후속 feature에서 다룬다.

## Problem

- F-024에서 여행 기간에 맞춘 `Day 1`, `Day 2` 컨테이너는 보이지만, 특정 Day에 어떤 장소를 방문할지 보는 화면은 없다.
- 이후 장소 추가, 순서 변경, 오늘 실행 화면은 모두 Day별 장소 목록을 기반으로 한다.
- Day는 F-024 결정대로 `Trip` 날짜 범위에서 계산되는 가상 구조이므로, F-025도 persistent `trip_days` 없이 `tripId + date`로 Day 화면을 연다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}` 여행 상세 화면을 연다.
2. 상세 화면은 기존 `GET /trips/{tripId}` 응답의 `days[]`로 `여행 일정` 섹션을 보여준다.
3. 사용자가 특정 Day row를 누른다.
4. 앱은 `/trips/{tripId}/days/{date}` Day 일정 화면으로 이동한다.
5. Day 일정 화면은 generated client로 `GET /trips/{tripId}/days/{date}/itinerary`를 호출한다.
6. 서버는 인증된 사용자가 여행 참여자인지 확인하고, `date`가 여행 기간 안의 virtual Day인지 검증한다.
7. 장소가 있으면 앱은 `Day N`, 날짜, 그리고 방문 순서대로 장소 목록을 보여준다.
8. 장소가 없으면 앱은 Day 화면 안에서 empty state를 보여준다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: 기존 여행 상세 화면의 Day row를 누를 수 있게 하고, `/trips/{tripId}/days/{date}` 읽기 전용 Day 일정 화면을 추가한다.
- [x] API Contract: `GET /trips/{tripId}/days/{date}/itinerary` endpoint와 response/error schema를 OpenAPI에 정의한다.
- [x] API Server: Day itinerary 조회 handler/service/repository, participant authorization, date range validation, `dayOrder` 계산, empty/non-empty response를 구현한다.
- [x] DB: `trip_places`, `itinerary_items` read model을 위한 migration과 sqlc query를 추가한다. `trip_days` table은 만들지 않는다.
- [x] Generated Code: OpenAPI 기반 Go server artifact, TypeScript client/type, sqlc generated DB code를 갱신한다.
- [x] Tests: API validation/authorization/empty/non-empty test, repository sorting/filtering/join test, mobile view-model/route helper test를 추가한다.
- [ ] Deployment: local/staging 또는 internal build에서 detail Day tap → Day screen empty/non-empty state를 smoke 확인한다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- persistent `trip_days` table 또는 Day CRUD
- itinerary item 생성, 수정, 삭제 endpoint와 UI
- 장소 검색, 장소 선택, 장소 추가 CTA
- 장소 상세 화면 진입
- Day 안에서 장소 순서 변경 또는 drag reorder
- 방문 시간, 메모, 운영시간, 이동 시간 표시
- 지도, Google Maps 길찾기, 경로/거리 표시
- 도착/스킵 상태와 오늘 실행 화면
- 오프라인 cache, optimistic loading, pull-to-refresh
- direct deep link UX polish. Direct route는 동작할 수 있지만 이번 slice의 happy path는 여행 상세 Day row 진입이다.

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/index.tsx`
  - 기존 `여행 일정` 섹션의 Day row를 `Pressable`로 바꾼다.
  - Day row tap은 `/trips/{tripId}/days/{date}`로 이동한다.
  - Day row의 기존 `Day N`, 날짜 표시는 유지한다.

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 선택한 Day의 읽기 전용 장소 목록 화면을 제공한다.
  - 화면 진입 시 `GET /trips/{tripId}/days/{date}/itinerary`를 호출한다.
  - generated TypeScript client/type을 사용한다.

정확한 파일 구조는 구현 시 Expo Router 제약에 맞춰 조정할 수 있지만, route 의미는 `/trips/{tripId}/days/{date}`를 유지한다.

### Day Screen Content

성공 상태는 최소한 다음 정보를 보여준다.

- Header title: `Day <dayOrder>`
- Header subtitle: `<YYYY.MM.DD>`
- 각 장소 row:
  - 방문 순서번호: `itemOrder`
  - 장소명: `place.name`
  - 장소 타입 label: `관광지`, `식당`, `숙소`, `카페`, `쇼핑`, `기타`
  - 주소: `place.address`

표시하지 않는다.

- 방문 시간
- 메모
- 장소 상세 CTA
- 장소 추가 CTA
- 지도/길찾기 버튼
- 도착/스킵 상태

### States

- Loading: `일정을 불러오는 중...`을 표시한다.
- Empty: `items: []`이면 Day 화면 안에 아래 두 줄을 표시한다.
  - `아직 등록된 장소가 없어요.`
  - `장소 추가는 다음 기능에서 제공될 예정이에요.`
- Not Found / Forbidden: `403`, `404`, 여행 범위 밖 날짜는 non-retry 상태로 보여준다.
  - Title: `일정을 찾을 수 없어요.`
  - Helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`
  - Action: `여행 상세로` 또는 `홈으로`
- Retryable Error: network, `5xx`, unknown error는 retry 가능 상태로 보여준다.
  - Title: `일정을 불러올 수 없어요.`
  - Helper: `잠시 후 다시 시도해주세요.`
  - Action: `다시 시도`
- Success: header와 장소 목록을 표시한다.

### Copy / Labels

- Trip detail section title: `여행 일정`
- Day screen title: `Day <dayOrder>`
- Loading: `일정을 불러오는 중...`
- Empty title: `아직 등록된 장소가 없어요.`
- Empty helper: `장소 추가는 다음 기능에서 제공될 예정이에요.`
- Not found title: `일정을 찾을 수 없어요.`
- Not found helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`
- Generic error title: `일정을 불러올 수 없어요.`
- Generic error helper: `잠시 후 다시 시도해주세요.`
- Retry action: `다시 시도`
- Back action: `여행 상세로`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 trip detail의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- 장소 타입 label/color는 `theme.placeType`과 mobile helper를 통해 사용한다.
- 같은 카드/리스트 row 패턴이 반복되면 이번 변경에서 만든 중복만 정리하고, 범위를 벗어난 공용 primitive 리팩터링은 하지 않는다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips/{tripId}/days/{date}/itinerary
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

F-025에서는 기존 `GET /trips/{tripId}` detail 응답에 itinerary items를 추가하지 않는다. Detail은 Day 컨테이너 목록을 유지하고, Day 화면이 열릴 때 해당 날짜의 itinerary만 별도로 조회한다.

### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
```

### Response

HTTP status: `200`

```json
{
  "day": {
    "date": "2026-07-10",
    "dayOrder": 1
  },
  "items": [
    {
      "id": "itinerary_item_123",
      "itemOrder": 1,
      "place": {
        "id": "trip_place_123",
        "name": "우메다 공중정원",
        "placeType": "sights",
        "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
      }
    },
    {
      "id": "itinerary_item_456",
      "itemOrder": 2,
      "place": {
        "id": "trip_place_456",
        "name": "도톤보리",
        "placeType": "food",
        "address": "Dotonbori, Chuo Ward, Osaka"
      }
    }
  ]
}
```

Empty response for an in-range Day:

```json
{
  "day": {
    "date": "2026-07-10",
    "dayOrder": 1
  },
  "items": []
}
```

### Schema Notes

`TripDay` from F-024 is reused for `day`.

`TripPlaceType` enum:

```yaml
TripPlaceType:
  type: string
  enum:
    - sights
    - food
    - lodging
    - cafe
    - shopping
    - etc
```

`TripPlaceSummary` schema:

```yaml
TripPlaceSummary:
  type: object
  required:
    - id
    - name
    - placeType
    - address
  properties:
    id:
      type: string
    name:
      type: string
    placeType:
      $ref: '#/components/schemas/TripPlaceType'
    address:
      type: string
```

`DayItineraryItem` schema:

```yaml
DayItineraryItem:
  type: object
  required:
    - id
    - itemOrder
    - place
  properties:
    id:
      type: string
    itemOrder:
      type: integer
      minimum: 1
    place:
      $ref: '#/components/schemas/TripPlaceSummary'
```

`GetDayItineraryResponse` schema:

```yaml
GetDayItineraryResponse:
  type: object
  required:
    - day
    - items
  properties:
    day:
      $ref: '#/components/schemas/TripDay'
    items:
      type: array
      items:
        $ref: '#/components/schemas/DayItineraryItem'
```

Response rules:

- `day.date` equals the `date` path parameter after validation.
- `day.dayOrder` is calculated by the server as the 1-based date offset from `trip.startDate`.
- `items` is sorted by `itemOrder ASC`, then stable by `itinerary_items.id ASC` as a tie-breaker.
- `items: []` is a valid success response when the selected date is inside the trip date range.
- Date values are date-only `YYYY-MM-DD`. Mobile must not timezone-convert them.
- Place type labels are rendered by mobile from the API enum.

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

- `400 VALIDATION_ERROR`: invalid `tripId` format or invalid `date` format
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant of the trip
- `404 NOT_FOUND`: trip does not exist, or `date` is outside `trip.startDate`~`trip.endDate`
- `500 INTERNAL_ERROR`: unexpected server/data error

Mobile error mapping:

- `401`: login state or existing auth recovery flow
- `403`, `404`: `일정을 찾을 수 없어요.` non-retry state
- network, `5xx`, unknown: retryable error state with `다시 시도`

## DB Changes

F-025 introduces the minimum persistence model needed to read Day-specific itinerary rows. It intentionally does not create `trip_days`.

### Tables

#### `trip_places`

A place snapshot selected for a specific trip. F-025 only needs display fields for the read-only list.

Expected schema:

```sql
CREATE TABLE trip_places (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NOT NULL,
  place_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_places_name_length_check CHECK (char_length(name) BETWEEN 1 AND 120),
  CONSTRAINT trip_places_place_type_check CHECK (place_type IN ('sights', 'food', 'lodging', 'cafe', 'shopping', 'etc')),
  CONSTRAINT trip_places_id_trip_unique UNIQUE (id, trip_id)
);
```

#### `itinerary_items`

A scheduled visit row for a virtual Day identified by `trip_id + scheduled_date`.

Expected schema:

```sql
CREATE TABLE itinerary_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  scheduled_date date NOT NULL,
  trip_place_id uuid NOT NULL,
  item_order integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT itinerary_items_item_order_check CHECK (item_order >= 1),
  CONSTRAINT itinerary_items_trip_place_fk FOREIGN KEY (trip_place_id, trip_id) REFERENCES trip_places(id, trip_id) ON DELETE CASCADE,
  CONSTRAINT itinerary_items_trip_date_order_unique UNIQUE (trip_id, scheduled_date, item_order)
);
```

### Constraints / Indexes

- `trip_places.trip_id`: cascade delete when a trip is deleted.
- `trip_places_id_trip_unique`: allows composite FK from `itinerary_items` and prevents cross-trip place references.
- `itinerary_items(trip_id, scheduled_date, item_order)`: supports Day list lookup and deterministic ordering.
- `itinerary_items_trip_place_fk`: enforces that an itinerary item references a place from the same trip.

### Queries

Implementation can adjust query names to match sqlc conventions, but F-025 needs a query with this behavior.

```sql
-- name: ListItineraryItemsByTripAndDate :many
SELECT
  ii.id::text AS id,
  ii.item_order,
  tp.id::text AS trip_place_id,
  tp.name AS place_name,
  tp.place_type,
  tp.address
FROM itinerary_items ii
JOIN trip_places tp
  ON tp.id = ii.trip_place_id
 AND tp.trip_id = ii.trip_id
WHERE ii.trip_id = $1::uuid
  AND ii.scheduled_date = $2
ORDER BY ii.item_order ASC, ii.id ASC;
```

Existing trip queries can be reused for trip lookup, participant membership, and date range validation.

### Migration Notes

- Add a goose migration, expected name: `00004_create_itinerary_tables.sql` or equivalent next migration number.
- `trip_places` must be dropped after `itinerary_items` in rollback order.
- DB migration apply/rollback must be verified for this feature.
- F-025 does not provide a user-facing way to create `trip_places` or `itinerary_items`; non-empty automated/API tests can seed rows directly. User-facing creation is a follow-up feature.

## Business Rules

- Day identity is `tripId + date`; there is no `trip_day_id` in F-025.
- `GET /trips/{tripId}/days/{date}/itinerary` requires authentication.
- The authenticated user must be a participant of the trip.
- `date` must be a valid `YYYY-MM-DD` date-only string.
- If `date` is before `trip.startDate` or after `trip.endDate`, the virtual Day does not exist and the API returns `404 NOT_FOUND`.
- If `date` is inside the trip date range and no itinerary items exist, the API returns `200` with `items: []`.
- `day.dayOrder` is 1-based and calculated from `trip.startDate` by the server.
- Itinerary rows are ordered by `itemOrder ASC`.
- Each itinerary item must reference a `trip_places` row from the same trip.
- Mobile renders place type labels from the API enum using a helper; the API does not return Korean labels.
- Mobile renders date strings directly as date-only values and avoids `Date` timezone conversion for display.
- F-025 is read-only. It must not add hidden create/update/delete behavior.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 `AC-*` 행 또는 `Regression Gaps`와 연결한다.

- [x] AC-01: `docs/features/0025-day-itinerary-screen.md`에 feature spec + implementation plan이 작성되어 있고 Ouroboros source가 기록되어 있다.
- [x] AC-02: `packages/api-contract/openapi.yaml`에 authenticated `GET /trips/{tripId}/days/{date}/itinerary` endpoint와 `GetDayItineraryResponse` schema가 정의되어 있다.
- [x] AC-03: generated Go server artifact와 TypeScript client/type이 Day itinerary endpoint와 schemas를 포함하도록 갱신되어 있다.
- [x] AC-04: DB migration으로 `trip_places`와 `itinerary_items`가 생성되며 `trip_days` table은 생성되지 않는다.
- [x] AC-05: sqlc query는 `trip_id + scheduled_date`로 itinerary rows를 필터링하고 `itemOrder` 오름차순으로 반환하며 `trip_places` display fields를 join한다.
- [x] AC-06: 인증되지 않은 Day itinerary 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] AC-07: invalid `tripId` 또는 invalid `date` format은 `400 VALIDATION_ERROR`를 반환한다.
- [x] AC-08: 존재하지 않는 trip은 `404 NOT_FOUND`를 반환한다.
- [x] AC-09: authenticated user가 participant가 아닌 trip은 `403 FORBIDDEN`을 반환한다.
- [x] AC-10: 여행 기간 밖 `date`는 `404 NOT_FOUND`를 반환한다.
- [x] AC-11: 여행 기간 안 `date`에 itinerary item이 없으면 `200`과 `items: []`, server-calculated `day`를 반환한다.
- [x] AC-12: 여행 기간 안 `date`에 itinerary item이 있으면 `200`과 `day`, `items[]`를 반환하고 각 item은 `id`, `itemOrder`, `place.id`, `place.name`, `place.placeType`, `place.address`를 포함한다.
- [x] AC-13: API response의 `day.dayOrder`는 `trip.startDate` 기준 1-based offset이며 모바일은 이 값을 사용해 `Day N`을 렌더링한다.
- [x] AC-14: 모바일 여행 상세 화면의 Day row를 누르면 `/trips/{tripId}/days/{date}` route로 이동한다.
- [x] AC-15: Day 화면은 진입 시 generated client로 `GET /trips/{tripId}/days/{date}/itinerary`를 호출한다.
- [x] AC-16: Day 화면 success state는 `Day N`, `YYYY.MM.DD`, 그리고 `itemOrder` 순서의 장소명/장소 타입 label/주소를 표시한다.
- [x] AC-17: Day 화면은 `items: []`에서 지정된 두 줄 empty state를 표시한다.
- [x] AC-18: Day 화면은 `403`, `404`, 범위 밖 날짜 응답을 non-retry not-found state로 표시한다.
- [x] AC-19: Day 화면은 network, `5xx`, unknown error를 retryable error state로 표시하고 `다시 시도`가 동일 요청을 다시 실행한다.
- [x] AC-20: F-025 구현은 장소 추가/수정/삭제, 상세 진입, 순서 변경, 지도/길찾기, 도착/스킵, persistent `trip_days`를 포함하지 않는다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02, AC-03: OpenAPI endpoint/schema와 generated artifacts drift 없음 | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-04: `trip_places`, `itinerary_items` migration이 있고 `trip_days`를 만들지 않음 | DB migration | `apps/api/migrations/00004_create_itinerary_tables.sql` | `DATABASE_URL=... pnpm db:migrate && DATABASE_URL=... pnpm db:rollback && DATABASE_URL=... pnpm db:migrate` |
| AC-05: `scheduled_date` 필터, `itemOrder` 정렬, `trip_places` join field mapping | Repository/DB | `apps/api/internal/storage/trip_repository_test.go` 또는 itinerary repository test | `pnpm --filter @i-um/api test` |
| AC-06, AC-07, AC-08, AC-09, AC-10: auth, validation, not found, forbidden, out-of-range errors | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` 또는 itinerary service test | `pnpm --filter @i-um/api test` |
| AC-11, AC-12, AC-13: in-range empty/non-empty responses include server-calculated `day` and sorted item fields | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` 또는 itinerary service test | `pnpm --filter @i-um/api test` |
| AC-14: trip detail day row uses a tested route helper for `/trips/{tripId}/days/{date}` | Mobile logic | `apps/mobile/lib/trips/day-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-16: mobile helper formats `YYYY-MM-DD` as `YYYY.MM.DD`, maps place type enum to Korean label, and builds ordered row view models | Mobile logic | `apps/mobile/lib/trips/day-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-17, AC-18, AC-19: mobile state/view-model helper maps loading, success, empty, not-found, retryable-error states | Mobile state | `apps/mobile/lib/trips/day-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-15, AC-16: mobile screen consumes generated API types/client without hand-written duplicate response types | Mobile type/UI | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| AC-01 through AC-20: Full regression suite remains green | All | verify gate | `pnpm verify` |

## Regression Gaps

- AC-14 native tap/e2e navigation: the current mobile test setup uses Node-based helper tests and does not include a React Native component or Expo Router e2e harness that can press the actual Day row and assert the rendered next screen.
  - Automated coverage retained: route helper tests prove `tripId + date` route construction, and TypeScript gate proves the screen uses generated types.
  - Risk: a future UI wiring regression could break the actual Pressable tap while helper tests remain green.
  - Follow-up: add a mobile component/e2e test harness before relying on complex navigation interactions as a regression gate.

## TDD Implementation Plan

1. Red: Contract/API behavior tests
   - Add failing API tests for `400` invalid params, `401`, `403`, `404` missing trip, `404` out-of-range date, `200` empty, and `200` non-empty sorted items.
   - Verify: `pnpm --filter @i-um/api test` fails for missing endpoint/implementation.
2. Red: Repository/query tests
   - Add failing repository tests that seed `trip_places` and `itinerary_items`, then assert `scheduled_date` filtering, `itemOrder` ordering, and joined display fields.
   - Verify: `pnpm --filter @i-um/api test` fails before migration/query implementation.
3. Red: Mobile helper/state tests
   - Add failing `apps/mobile/lib/trips/day-itinerary.test.mts` for route construction, date formatting, place type labels, ordered row view models, empty/not-found/retryable state mapping, and retry intent.
   - Verify: `pnpm --filter @i-um/mobile test` fails before helper implementation.
4. Contract: Extend OpenAPI first
   - Add `GET /trips/{tripId}/days/{date}/itinerary`, `TripPlaceType`, `TripPlaceSummary`, `DayItineraryItem`, and `GetDayItineraryResponse` schemas.
   - Regenerate Go/TS artifacts with `pnpm generate`.
   - Verify: `pnpm verify:generated` passes after generated files are committed.
5. DB: Add migration and sqlc query
   - Add `trip_places` and `itinerary_items` migration without `trip_days`.
   - Add `ListItineraryItemsByTripAndDate` query and regenerate sqlc code.
   - Verify: DB migrate/rollback/migrate succeeds; repository tests compile and then pass.
6. Green: API server minimum implementation
   - Implement handler/service/repository flow for Day itinerary read.
   - Reuse existing auth context, trip lookup, participant authorization, and date-only range logic.
   - Calculate `day.dayOrder` on the server.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
7. Green: Mobile generated client and Day screen
   - Add generated-client helper for `getTripDayItinerary(tripId, date)`.
   - Add mobile view-model helpers and place type label mapping.
   - Make trip detail Day rows pressable with the route helper.
   - Add `/trips/[tripId]/days/[date]` screen with loading, empty, success, not-found, and retryable-error states.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
8. Refactor: Clean only duplication introduced by this feature
   - Keep UI aligned with existing trip detail card/list style and theme tokens.
   - Do not introduce unrelated shared primitives unless this change creates repeated local code.
   - Verify: rerun changed-layer tests.
9. Regression gate
   - Verify: `pnpm verify` passes.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

### Verification Results

- `pnpm install --frozen-lockfile`: pass
- Red check: `pnpm --filter @i-um/mobile test`: failed as expected before helper implementation because `day-itinerary` helper did not exist.
- Red check: `pnpm --filter @i-um/api test`: failed as expected before service/handler implementation because Day itinerary types and handler were missing.
- `pnpm generate`: pass
- `pnpm verify:generated`: pass
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; migration version 4 applied after verification.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback`: initial local run failed because the existing local goose history marked `00004` applied while the tables were absent; Down migration was made idempotent with `DROP TABLE IF EXISTS`, then rollback passed.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass; applied `00004_create_itinerary_tables.sql`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test`: pass; includes repository integration test for Day itinerary query.
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass
- Manual device/simulator smoke: not run in this implementation pass.
- Staging/internal build verification: not run in this implementation pass.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 앱에서 여행 상세 화면을 열고 `여행 일정` 섹션의 Day row를 누르면 Day 일정 화면으로 이동하는지 확인한다.
- [ ] 장소가 없는 Day는 `아직 등록된 장소가 없어요.` empty state를 보여주는지 확인한다.
- [ ] seeded/dev data로 장소 2개 이상이 있는 Day를 열면 `Day N`, 날짜, 순서번호, 장소명, 장소 타입, 주소가 순서대로 보이는지 확인한다.
- [ ] 범위 밖 날짜 direct route 또는 접근 불가능한 여행은 `일정을 찾을 수 없어요.` 상태를 보여주는지 확인한다.
- [ ] API를 일시적으로 실패시키거나 network error를 유도했을 때 retryable error와 `다시 시도`가 보이는지 확인한다.
- [ ] staging 또는 internal build에서 detail Day tap → Day itinerary empty/non-empty state happy path를 확인한다.

## Release Notes

```text
- 여행 상세의 Day를 눌러 해당 날짜의 방문 장소 목록을 확인할 수 있는 읽기 전용 Day 일정 화면을 추가한다.
- Day 일정 화면은 장소가 없을 때 빈 상태를 안내하고, 장소가 있으면 방문 순서대로 장소명, 타입, 주소를 보여준다.
```

## Open Questions

None for F-025 implementation. User approved starting from the Draft spec on 2026-06-22.

## Follow-up Issues

- TBD: Day별 장소 검색/추가 기능
- TBD: Day itinerary item 수정/삭제 기능
- TBD: Day 안에서 장소 순서 변경 기능
- TBD: 장소 상세 화면과 지도/Google Maps 길찾기 연결
- TBD: 오늘 실행 화면, 도착/스킵 상태, 남은 장소 목록
- TBD: 모바일 component/e2e test harness for Expo Router navigation
