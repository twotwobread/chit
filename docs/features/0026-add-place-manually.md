# Feature Slice: F-026 장소 직접 추가

## Metadata

- GitHub Issue: #26
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260622_151952`
- Seed: `seed_c58e0ce95a37`
- PM Document: N/A
- Notes: Ambiguity score `0.118`. Ouroboros clarified F-026 as a minimum Day-specific manual place addition slice. A single save action creates both the `trip_places` snapshot and the same-Day `itinerary_items` row. Duplicate same-Day manual additions are allowed. Place type uses exactly the F-025 enum: `sights`, `food`, `lodging`, `cafe`, `shopping`, `etc`.

## Goal

사용자가 특정 Day 일정 화면에서 장소명, 주소, 장소 타입을 직접 입력해 해당 Day의 방문 장소로 추가할 수 있다.

F-026은 F-025 읽기 전용 Day 일정 화면에 첫 번째 쓰기 흐름을 붙이는 최소 vertical slice다. 장소 검색, Google Places 선택, 좌표, 지도, 일정 순서 변경, 장소 수정/삭제, 오늘 실행 화면은 후속 기능에서 다룬다.

## Problem

- F-025에서는 Day별 방문 장소 목록을 볼 수 있지만, 사용자가 앱에서 장소를 추가할 수 없다.
- MVP의 일정 등록 흐름은 사용자가 여행 날짜별 방문 장소를 직접 구성할 수 있어야 한다.
- Google Places 검색/선택이 준비되기 전에도 사용자가 장소명과 주소를 알고 있으면 수동으로 일정을 만들 수 있어야 한다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 앱은 기존 `GET /trips/{tripId}/days/{date}/itinerary`로 Day header와 현재 장소 목록을 보여준다.
3. 사용자가 `장소 추가`를 누른다.
4. 앱은 `/trips/{tripId}/days/{date}/places/new` 장소 직접 추가 화면을 연다.
5. 사용자가 장소명, 주소, 장소 타입을 입력한다.
6. 사용자가 `저장`을 누른다.
7. 앱은 generated client로 `POST /trips/{tripId}/days/{date}/itinerary-items`를 호출한다.
8. 서버는 인증, 참여자 권한, 날짜 범위, request body를 검증한다.
9. 서버는 하나의 transaction 안에서 `trip_places` row와 같은 Day의 `itinerary_items` row를 생성한다.
10. 저장에 성공하면 앱은 Day 일정 화면으로 돌아가고 새 장소가 해당 Day 목록의 마지막 순서로 보인다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: Day 일정 화면의 `장소 추가` CTA, `/trips/{tripId}/days/{date}/places/new` 장소 직접 추가 화면, form validation, submit loading/error/success flow
- [x] API Contract: authenticated `POST /trips/{tripId}/days/{date}/itinerary-items` endpoint, request/response/error schema
- [x] API Server: manual place create handler/service/repository, participant authorization, date range validation, transaction 처리, append order 계산
- [x] DB: 기존 F-025 `trip_places`, `itinerary_items` table 재사용. 새 table은 만들지 않는다.
- [x] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type 갱신, sqlc generated DB code 갱신
- [x] Tests: API validation/authorization/create behavior, repository transaction/order behavior, mobile form/view-model/route tests, generated/typecheck gates
- [ ] Deployment: local/staging 또는 internal build에서 Day 화면 → 장소 직접 추가 → Day 목록 반영 smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- Google Places 장소 검색/선택 (#27)
- 좌표, provider place id, provider cache 저장
- 지도 표시, 경로/거리/이동 시간 표시
- 장소 상세 화면 진입
- 장소 수정/삭제 (#28)
- Day 안에서 장소 순서 변경 또는 drag reorder (#29)
- 방문 시간, 영업시간, 메모, 예약 정보 입력
- 도착/스킵 상태와 오늘 실행 화면 (#31~#35)
- 숙소 장소 지정 전용 흐름 (#30)
- 중복 장소 감지/차단
- 오프라인 queue, optimistic create, pull-to-refresh 고도화
- 변경자 표시, 상세 변경 이력, 실시간 공동 편집 표시

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - F-025 Day 일정 화면에 `장소 추가` CTA를 추가한다.
  - 장소가 없는 empty state에서도 `장소 추가`를 실행할 수 있어야 한다.
  - 장소가 있는 success state에서도 같은 CTA를 제공한다.
  - 저장 성공 후 돌아왔을 때 기존 focus/refetch 또는 명시적 reload로 새 장소를 표시한다.

- `apps/mobile/app/trips/[tripId]/days/[date]/places/new.tsx`
  - 장소 직접 추가 화면을 제공한다.
  - path 구조는 Expo Router 제약에 맞춰 구현 시 조정할 수 있지만 route 의미는 `/trips/{tripId}/days/{date}/places/new`를 유지한다.
  - generated TypeScript client/type을 사용해 submit한다.

### Add Form Content

필드는 최소한 다음만 포함한다.

- 장소명: text input
- 주소: text input
- 장소 타입: chip 또는 picker
  - `sights`: `관광지`
  - `food`: `식당`
  - `lodging`: `숙소`
  - `cafe`: `카페`
  - `shopping`: `쇼핑`
  - `etc`: `기타`

표시하지 않는다.

- 장소 검색 input
- 좌표 input
- 지도 pin 선택
- 방문 시간
- 메모
- 장소 이미지
- Google Places attribution

### States

- Loading: 추가 화면 자체는 route param 기반이므로 초기 remote loading은 필요 없다. Submit 중에는 `저장 중...` 또는 disabled primary button을 보여준다.
- Validation Error: 저장 전 또는 API `400 VALIDATION_ERROR`에서 field-level helper text를 보여준다.
- Submit Success: Day 일정 화면으로 돌아가고 새 장소가 목록 마지막에 보인다.
- Auth Error: `401`은 기존 auth recovery 또는 `다시 로그인해주세요.` 상태를 사용한다.
- Not Found / Forbidden: `403`, `404`, 범위 밖 날짜는 non-retry 상태로 보여준다.
  - Title: `일정을 찾을 수 없어요.`
  - Helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`
  - Action: `여행 상세로`
- Retryable Error: network, `5xx`, unknown error는 form 값을 유지한 채 retry 가능 상태로 보여준다.
  - Title: `장소를 저장할 수 없어요.`
  - Helper: `잠시 후 다시 시도해주세요.`
  - Action: `다시 시도`

### Copy / Labels

- Day screen CTA: `장소 추가`
- Add screen title: `장소 직접 추가`
- Add screen helper: `이 Day에 방문할 장소를 직접 입력해요.`
- Name label: `장소명`
- Name placeholder: `예: 우메다 공중정원`
- Address label: `주소`
- Address placeholder: `예: 1 Chome-1-88 Oyodonaka, Kita Ward, Osaka`
- Type label: `장소 타입`
- Save action: `저장`
- Submit loading: `저장 중...`
- Name required error: `장소명을 입력해주세요.`
- Address required error: `주소를 입력해주세요.`
- Type required error: `장소 타입을 선택해주세요.`
- Generic submit error: `장소를 저장할 수 없어요. 잠시 후 다시 시도해주세요.`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 Day 일정 화면의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- 장소 타입 label은 F-025 mobile helper를 재사용하거나, 중복이 생기면 공용 helper로 이동한다.
- 버튼/입력/card 패턴이 두 번째 이상 반복되면 이번 변경에서 만든 중복만 공용 primitive로 정리한다. 범위를 벗어난 전체 UI refactor는 하지 않는다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
POST /trips/{tripId}/days/{date}/itinerary-items
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

F-026에서는 기존 `GET /trips/{tripId}/days/{date}/itinerary` response shape를 변경하지 않는다. 저장 성공 후 Day 화면은 기존 GET endpoint로 새 목록을 다시 조회할 수 있다.

### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
```

### Request

Schema name: `CreateManualDayItineraryItemRequest`

```json
{
  "name": "우메다 공중정원",
  "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka",
  "placeType": "sights"
}
```

Schema notes:

- `name`: required string, trimmed by server, `minLength: 1`, `maxLength: 120`
- `address`: required string, trimmed by server, `minLength: 1`, `maxLength: 240`
- `placeType`: required `TripPlaceType`
- `additionalProperties: false`

### Response

HTTP status: `201`

Schema name: `CreateManualDayItineraryItemResponse`

```json
{
  "day": {
    "date": "2026-07-10",
    "dayOrder": 1
  },
  "item": {
    "id": "itinerary_item_789",
    "itemOrder": 3,
    "place": {
      "id": "trip_place_789",
      "name": "우메다 공중정원",
      "placeType": "sights",
      "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
    }
  }
}
```

Response rules:

- `day.date` equals the validated `date` path parameter.
- `day.dayOrder` is calculated by the server as the 1-based date offset from `trip.startDate`.
- `item.place.name` and `item.place.address` are the trimmed values stored in `trip_places`.
- `item.place.placeType` is the stored `TripPlaceType` enum value.
- `item.itemOrder` is appended as `max(existing item_order for tripId + date) + 1`.
- If the selected Day has no existing items, the first created item has `itemOrder = 1`.

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

- `400 VALIDATION_ERROR`: invalid `tripId`, invalid `date`, missing/blank/too-long `name`, missing/blank/too-long `address`, invalid `placeType`
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant of the trip
- `404 NOT_FOUND`: trip does not exist, or `date` is outside `trip.startDate`~`trip.endDate`
- `409 CONFLICT`: append order conflicts because of a concurrent create and the server cannot safely retry
- `500 INTERNAL_ERROR`: unexpected server/data error

Mobile error mapping:

- `400`: field-level validation state when possible, otherwise generic validation message
- `401`: auth state or login recovery
- `403`, `404`: `일정을 찾을 수 없어요.` non-retry state
- `409`, network, `5xx`, unknown: retryable submit error with form values preserved

## DB Changes

No new table is expected.

F-026 reuses the F-025 persistence model:

- `trip_places`: one manually entered place snapshot for the trip
- `itinerary_items`: one scheduled visit row for a virtual Day identified by `trip_id + scheduled_date`

### Tables

- `trip_places`: insert `trip_id`, trimmed `name`, trimmed `address`, `place_type`
- `itinerary_items`: insert `trip_id`, `scheduled_date`, created `trip_place_id`, appended `item_order`

### Constraints / Indexes

Existing F-025 constraints are reused.

- `trip_places_name_length_check`: enforces place name length at DB level.
- `trip_places_place_type_check`: enforces the closed place type enum at DB level.
- `trip_places_id_trip_unique`: supports same-trip FK from itinerary item to place.
- `itinerary_items_trip_place_fk`: prevents cross-trip place references.
- `itinerary_items_trip_date_order_unique`: prevents duplicate item order in the same Day.

F-026 does not add a unique constraint on `name`, `address`, or `place_type`. Duplicate manual additions are allowed.

### Queries

Implementation can adjust query names to match sqlc conventions, but F-026 needs repository behavior equivalent to:

```sql
-- name: CreateTripPlace :one
INSERT INTO trip_places (trip_id, name, address, place_type)
VALUES ($1::uuid, $2, $3, $4)
RETURNING id::text, name, place_type, address;
```

```sql
-- name: CreateItineraryItemAtEnd :one
INSERT INTO itinerary_items (trip_id, scheduled_date, trip_place_id, item_order)
VALUES (
  $1::uuid,
  $2,
  $3::uuid,
  (
    SELECT COALESCE(MAX(item_order), 0) + 1
    FROM itinerary_items
    WHERE trip_id = $1::uuid
      AND scheduled_date = $2
  )
)
RETURNING id::text, item_order;
```

The actual implementation should run place insert and itinerary item insert in one DB transaction through the repository/storage transaction pattern. If itinerary item creation fails, the created `trip_places` row must roll back and must not remain orphaned.

### Migration Notes

- No migration is expected for F-026.
- sqlc query changes require generated DB code refresh.
- Existing F-025 migration apply/rollback should continue to pass.

## Business Rules

- Day identity remains `tripId + date`; there is no `trip_day_id`.
- `POST /trips/{tripId}/days/{date}/itinerary-items` requires authentication.
- Any authenticated trip participant can manually add a place to the trip itinerary. Owner-only restriction is not applied in F-026.
- `date` must be a valid date-only `YYYY-MM-DD` string.
- If `date` is outside `trip.startDate`~`trip.endDate`, the virtual Day does not exist and the API returns `404 NOT_FOUND`.
- `name` is trimmed before validation and storage. Empty after trim is invalid. Max length is 120 characters.
- `address` is trimmed before validation and storage. Empty after trim is invalid. Max length is 240 characters.
- `placeType` must be exactly one of `sights`, `food`, `lodging`, `cafe`, `shopping`, `etc`.
- Place type Korean labels are rendered on mobile; the API stores and returns enum values only.
- One successful save creates exactly one `trip_places` row and one linked `itinerary_items` row.
- The new itinerary item is appended to the end of the selected Day using `max(item_order) + 1`.
- Duplicate places on the same Day are allowed. The server does not compare name/address/type to block duplicates.
- Date values are date-only strings. Mobile must not timezone-convert them for display or request construction.
- F-026 does not create provider/cache/coordinate data. A manually added place has only the fields supported by the current F-025 `trip_places` table.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 `AC-*` 행 또는 `Regression Gaps`와 연결한다.

- [x] AC-01: `docs/features/0026-add-place-manually.md`에 feature spec + implementation plan이 작성되어 있고 Ouroboros source가 기록되어 있다.
- [x] AC-02: `packages/api-contract/openapi.yaml`에 authenticated `POST /trips/{tripId}/days/{date}/itinerary-items` endpoint와 request/response/error schema가 정의되어 있다.
- [x] AC-03: generated Go server artifact와 TypeScript client/type이 manual place add endpoint와 schemas를 포함하도록 갱신되어 있다.
- [x] AC-04: F-026은 새 `trip_days` table이나 새 장소 master table을 만들지 않고 F-025 `trip_places`, `itinerary_items`를 재사용한다.
- [x] AC-05: 인증되지 않은 manual add 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] AC-06: invalid `tripId` 또는 invalid `date` format은 `400 VALIDATION_ERROR`를 반환한다.
- [x] AC-07: 존재하지 않는 trip은 `404 NOT_FOUND`를 반환한다.
- [x] AC-08: authenticated user가 participant가 아닌 trip은 `403 FORBIDDEN`을 반환한다.
- [x] AC-09: 여행 기간 밖 `date`는 `404 NOT_FOUND`를 반환한다.
- [x] AC-10: blank 또는 too-long `name`은 `400 VALIDATION_ERROR`를 반환하고 DB row를 만들지 않는다.
- [x] AC-11: blank 또는 too-long `address`는 `400 VALIDATION_ERROR`를 반환하고 DB row를 만들지 않는다.
- [x] AC-12: unsupported `placeType`은 `400 VALIDATION_ERROR`를 반환하고 DB row를 만들지 않는다.
- [x] AC-13: valid participant request는 `201`과 server-calculated `day`, created `item`을 반환한다.
- [x] AC-14: valid create는 하나의 transaction 안에서 `trip_places` row와 linked `itinerary_items` row를 함께 생성한다.
- [x] AC-15: 새 item은 selected Day의 기존 마지막 순서 뒤에 append되어 `itemOrder = max(existing itemOrder) + 1`이 된다.
- [x] AC-16: selected Day에 기존 item이 없으면 새 item의 `itemOrder`는 `1`이다.
- [x] AC-17: 같은 Day에 같은 name/address/type으로 여러 번 저장할 수 있고, 각각 별도 itinerary item으로 추가된다.
- [x] AC-18: 모바일 Day 일정 화면은 empty/success state 모두에서 `장소 추가` CTA를 제공한다.
- [x] AC-19: 모바일 장소 직접 추가 화면은 장소명, 주소, 장소 타입 입력을 제공하고 F-025 place type enum과 Korean labels를 사용한다.
- [x] AC-20: 모바일은 blank name/address 또는 미선택 place type을 submit 전에 사용자에게 validation message로 알려준다.
- [x] AC-21: 모바일 submit은 generated TypeScript client로 `POST /trips/{tripId}/days/{date}/itinerary-items`를 호출한다.
- [x] AC-22: 저장 성공 후 Day 일정 화면으로 돌아가며 새 장소가 기존 `GET /trips/{tripId}/days/{date}/itinerary` 목록에 마지막 순서로 보인다.
- [x] AC-23: submit 중에는 중복 저장을 방지하도록 save action이 disabled 또는 loading 상태가 된다.
- [x] AC-24: retryable submit error에서는 입력값을 유지하고 다시 시도할 수 있다.
- [x] AC-25: F-026 구현은 Google Places, 좌표, 지도, 순서 변경, 장소 수정/삭제, 방문 시간, 메모, 오늘 실행 화면을 포함하지 않는다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02, AC-03: OpenAPI endpoint/schema와 generated artifacts drift 없음 | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-04, AC-25: F-025 tables are reused and no `trip_days` or place master table is introduced | Contract/DB | migration/schema review plus generated drift gate | `pnpm verify:generated` |
| AC-05, AC-06, AC-07, AC-08, AC-09: auth, path validation, not found, forbidden, out-of-range errors | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-10, AC-11, AC-12: body validation rejects blank/too-long name/address and invalid placeType without writes | API service/repository | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-13, AC-14: valid create returns `201` and creates one place plus one linked itinerary item in a transaction | API handler/service/repository | `apps/api/internal/server/server_test.go`, `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-15, AC-16: append order is `max(item_order)+1`, with first item order `1` | Repository/DB | `apps/api/internal/storage/trip_repository_test.go` or itinerary repository test | `pnpm --filter @i-um/api test` |
| AC-17: duplicate same-Day manual additions are allowed as separate itinerary items | API service/repository | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-18, AC-22: Day screen exposes an add route and can refetch existing GET itinerary after save | Mobile logic/state | `apps/mobile/lib/trips/day-itinerary.test.mts` or `manual-place.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-19, AC-20: form helper validates name/address/type and maps enum labels | Mobile logic | `apps/mobile/lib/trips/manual-place.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-21, AC-23, AC-24: submit helper/state uses generated payload shape, disables duplicate submit, preserves values on retryable error | Mobile state/type | `apps/mobile/lib/trips/manual-place.test.mts`, TypeScript gate | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| AC-21, AC-22: mobile screen consumes generated API client/types without hand-written duplicate response types | Mobile type/UI | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| Existing F-025 migration remains valid even without new F-026 migration | DB migration | `apps/api/migrations/00004_create_itinerary_tables.sql` | `DATABASE_URL=... pnpm db:migrate && DATABASE_URL=... pnpm db:rollback && DATABASE_URL=... pnpm db:migrate` |
| AC-01 through AC-25: Full regression suite remains green | All | verify gate | `pnpm verify` |

## Regression Gaps

- Native end-to-end navigation and refetch sequence: the current mobile test setup uses Node-based helper tests and TypeScript gates, not a React Native component/e2e harness that can press `장소 추가`, fill the form, submit, navigate back, and assert the rendered Day list.
  - Automated coverage retained: API tests prove persisted create behavior; mobile helper/state tests prove route, validation, submit state, and generated types; TypeScript gate proves screen integration compiles.
  - Risk: a future UI wiring regression could break actual tap/form/navigation while helper tests remain green.
  - Follow-up: add a mobile component/e2e test harness before relying on complex Expo Router form flows as a regression gate.

## TDD Implementation Plan

1. Red: API service/handler tests for manual add behavior
   - Add failing tests for `401`, invalid path params, `403`, missing trip, out-of-range date, body validation, valid create, duplicate allowed, and append order behavior.
   - Verify: `pnpm --filter @i-um/api test` fails because endpoint/service behavior does not exist.
2. Red: Repository transaction/query tests
   - Add failing repository tests that seed a trip and existing itinerary items, create a manual place, and assert one `trip_places` row plus one linked `itinerary_items` row with the expected `itemOrder`.
   - Include a failure-path test where invalid input or repository error does not leave an orphan `trip_places` row if practical in the existing test harness.
   - Verify: `pnpm --filter @i-um/api test` fails before queries/repository implementation.
3. Red: Mobile form/state helper tests
   - Add failing `apps/mobile/lib/trips/manual-place.test.mts` for route construction, trim/validation, place type labels, payload building, submit disabled/loading state, retryable error state preserving form values, and success navigation intent.
   - Verify: `pnpm --filter @i-um/mobile test` fails before helper implementation.
4. Contract: Extend OpenAPI first
   - Add `POST /trips/{tripId}/days/{date}/itinerary-items`, `CreateManualDayItineraryItemRequest`, and `CreateManualDayItineraryItemResponse` schemas.
   - Reuse existing `TripDay`, `TripPlaceType`, `TripPlaceSummary`, and `DayItineraryItem` schemas where possible.
   - Regenerate Go/TS artifacts with `pnpm generate`.
   - Verify: `pnpm verify:generated` passes after generated files are committed.
5. DB/sqlc: Add create queries without schema migration
   - Add sqlc queries for creating `trip_places` and appending `itinerary_items`.
   - Implement repository transaction behavior using existing storage patterns.
   - Verify: repository tests compile and pass; existing migration apply/rollback still passes.
6. Green: API server minimum implementation
   - Implement handler/service/repository flow for manual Day itinerary item creation.
   - Reuse existing auth context, trip lookup, participant authorization, date-only range logic, and common error mapping.
   - Trim and validate request fields in service before repository writes.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
7. Green: Mobile generated client and add place UI
   - Add generated-client helper for creating a manual Day itinerary item.
   - Add mobile form/view-model helpers and reuse place type label mapping.
   - Add `장소 추가` CTA to Day screen empty/success states.
   - Add `/trips/[tripId]/days/[date]/places/new` screen with validation, submit loading, field/server errors, retryable errors, and success navigation back to the Day screen.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
8. Refactor: Clean only duplication introduced by this feature
   - Keep UI aligned with existing Day itinerary card/list style and theme tokens.
   - Extract/reuse only helpers or primitives made necessary by F-026.
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

- Red check: `pnpm --filter @i-um/api test`: failed as expected before implementation because `CreateManualDayItineraryItem*` domain types and service method were missing.
- Red check: `pnpm --filter @i-um/mobile test`: initially failed because this new worktree had no installed `node_modules` and could not resolve `tsx`; dependencies were restored before green verification.
- `pnpm install --frozen-lockfile`: pass
- `pnpm generate`: pass
- `pnpm verify:generated`: pass
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; local DB was at migration version 4.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback`: pass; rolled back F-025 `00004_create_itinerary_tables.sql`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass; reapplied migration version 4.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test`: pass; includes DB-backed repository test for manual place create + append order.
- `pnpm verify`: pass
- Manual device/simulator smoke: not run in this implementation pass.
- Staging/internal build verification: not run in this implementation pass.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 앱에서 여행 상세 → Day row tap → Day 일정 화면 진입을 확인한다.
- [ ] 장소가 없는 Day에서 `장소 추가` CTA가 보이고 장소 직접 추가 화면으로 이동하는지 확인한다.
- [ ] 장소명, 주소, 타입을 비워둔 상태에서 저장하면 각각 validation message가 보이는지 확인한다.
- [ ] valid 장소명/주소/타입으로 저장하면 Day 일정 화면으로 돌아가고 새 장소가 마지막 순서로 보이는지 확인한다.
- [ ] 같은 장소명/주소/타입을 한 번 더 저장하면 duplicate 차단 없이 별도 row로 추가되는지 확인한다.
- [ ] network/API 오류를 유도했을 때 form 입력값이 유지되고 `다시 시도`가 가능한지 확인한다.
- [ ] 접근 불가능한 여행 또는 범위 밖 날짜 direct route에서 safe not-found 상태를 보여주는지 확인한다.
- [ ] staging 또는 internal build에서 Day 화면 → 장소 직접 추가 → Day 목록 반영 happy path를 확인한다.

## Release Notes

```text
- Day 일정 화면에서 장소명, 주소, 타입을 직접 입력해 방문 장소를 추가할 수 있게 한다.
- 직접 추가한 장소는 선택한 Day의 일정 목록 마지막에 바로 표시된다.
```

## Open Questions

None. User approved implementation on 2026-06-23 by requesting `기능 구현 시작`.

Resolved by Ouroboros interview:

- 저장 1회로 `trip_places`와 `itinerary_items`를 함께 생성한다.
- 장소명/주소/타입 누락 또는 invalid 값은 validation으로 막는다.
- 같은 Day의 중복 수동 추가는 허용한다.
- 장소 타입은 F-025 enum `sights`, `food`, `lodging`, `cafe`, `shopping`, `etc`를 그대로 사용한다.

## Follow-up Issues

- #27: Google Places 장소 검색/선택
- #28: 일정 장소 수정/삭제
- #29: 일정 순서 변경
- #30: 숙소 장소 지정
- #31: 오늘 실행 화면 기본
- #32: 남은 장소 목록
- #33: 도착 처리
- #34: 스킵 처리
- #35: 숙소로 이동 버튼
- TBD: 모바일 component/e2e test harness for Expo Router form/navigation flows
