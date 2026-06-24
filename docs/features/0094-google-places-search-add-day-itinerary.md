# Feature Slice: F-094 Google Places 검색 결과로 Day 장소 등록

## Metadata

- GitHub Issue: #94
- Status: In Progress
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #94
- Ouroboros/PM/Seed: Interview `interview_20260624_125632`, Seed `seed_7b26df8396ef`, ambiguity `0.069`
- Notes: Google Places 검색 결과 선택으로 `trip_places`에 Google-backed 장소를 저장/재사용하고, 현재 `tripId + date`의 Day itinerary item을 생성하는 범위로 확정했다. 모바일은 Google API key를 보유하거나 Google API를 직접 호출하지 않는다.

## Goal

사용자가 Day 일정에서 Google Places 검색 결과의 `추가` action을 눌러 해당 장소를 현재 Day 일정 장소로 등록할 수 있다.

Google-backed 장소는 여행 단위에서 `googlePlaceId`로 중복 저장을 방지하고 재사용하되, 같은 Day에 같은 장소를 일정 항목으로 한 번 더 넣는 것은 사용자 확인 후 허용한다.

## Problem / Current State

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 현재 `장소 검색`은 `buildGooglePlaceSearchRoute(tripId, date)`로 이동하고, `장소 추가`는 `buildManualPlaceRoute(tripId, date)`로 이동한다.
  - Day 장소 등록 UX가 검색 기반 등록과 수동 등록으로 분리되어 있다.
- `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`
  - Google 검색 결과는 카드로 표시만 되고, 결과 선택/저장/Day 추가 동작이 없다.
- `apps/mobile/app/trips/[tripId]/days/[date]/places/new.tsx`
  - 기존 manual flow는 장소명/주소/타입만 입력하며 좌표를 보장하지 않는다.
- `packages/api-contract/openapi.yaml`
  - `GET /trips/{tripId}/days/{date}/places/google/search`는 검색 결과만 반환한다.
  - `POST /trips/{tripId}/days/{date}/itinerary-items`는 manual `name/address/placeType` 등록만 정의한다.
- `apps/api/migrations/00004_create_itinerary_tables.sql` / `apps/api/schema.sql`
  - `trip_places`는 `name`, `address`, `place_type`만 저장하고 Google provider identity, 좌표, raw type metadata가 없다.
- `docs/features/0027-google-places-search-select.md`
  - F-027은 검색 결과 표시까지만 완료했고, 결과 선택/저장/Day insertion은 후속 범위로 남겼다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 앱은 기존 `GET /trips/{tripId}/days/{date}/itinerary`로 Day header와 현재 장소 목록을 보여준다.
3. 사용자가 `장소 추가`를 누른다.
4. 앱은 Google Places 검색 화면 `/trips/{tripId}/days/{date}/place-search`를 연다.
5. 사용자가 장소명을 입력하고 `검색`을 누른다.
6. 앱은 generated API client로 `GET /trips/{tripId}/days/{date}/places/google/search`를 호출한다.
7. 서버는 인증된 trip participant와 trip 기간 내 `date`를 검증한 뒤 server-side Google Places API로 검색한다.
8. 앱은 검색 결과 카드에 장소명, 주소, 유형 hint, 명시적 `추가` action을 보여준다.
9. 사용자가 `추가`를 누른다.
10. 앱은 generated API client로 `POST /trips/{tripId}/days/{date}/places/google/itinerary-items`를 호출한다.
11. 서버는 `googlePlaceId`가 같은 trip에 이미 저장되어 있으면 기존 Google-backed `trip_place`를 재사용한다.
12. 서버는 같은 trip에 저장된 Google-backed 장소가 없으면 Google Place Details를 server-side로 조회해 이름/주소/좌표/type snapshot을 저장한다.
13. 같은 Day에 같은 Google place가 이미 있지 않으면 서버는 Day list 끝에 새 itinerary item을 append한다.
14. 저장에 성공하면 앱은 Day 일정 화면으로 돌아가고, Day 화면은 refetch되어 추가된 장소가 목록 마지막에 보인다.
15. 같은 Day에 같은 Google place가 이미 있으면 서버는 confirmation-required conflict를 반환하고, 앱은 `이미 이 Day에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?` confirmation을 보여준다.
16. 사용자가 `한 번 더 추가`를 누르면 앱은 `duplicateConfirmed: true`로 다시 요청하고, 서버는 기존 `trip_place`를 재사용해 새 itinerary item을 Day list 끝에 append한다.
17. 사용자가 `취소`를 누르면 새 itinerary item을 만들지 않고 검색 결과 화면에 머문다.

## Scope

- App UI: Yes
  - `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`
  - supporting helpers under `apps/mobile/lib/places/**` and `apps/mobile/lib/trips/**`
- API Contract: Yes
  - Add Google-result Day itinerary create endpoint and request/response schemas.
  - Keep existing manual endpoint for legacy/internal use.
- API Server: Yes
  - Handler/service/provider/repository support for Google-backed place persistence, reuse, duplicate confirmation, and itinerary append.
- DB: Yes
  - Add Google provider metadata columns/constraints/indexes to `trip_places`.
- Tests: Yes
  - API handler/service/repository tests, mobile state/client/route tests, generated drift/typecheck gates.
- Deploy/Smoke: Needed
  - Staging or internal build happy path with server-side `GOOGLE_PLACES_API_KEY` configured.

## Out of Scope

- Mobile에서 Google API key 보유 또는 Google Places 직접 호출.
- Manual direct entry를 #94 Day `장소 추가` fallback으로 노출.
- 사용자가 위도/경도를 수동 입력하는 UX.
- 기존 manual endpoint/screen 삭제. 기존 코드는 legacy/internal로 남길 수 있다.
- Manual place와 Google-backed place의 fuzzy merge, one-time backfill, dedup migration.
- Google provider metadata refresh/update 정책.
- Google Maps URL 또는 directions URL DB 저장.
- Rating, photos, opening hours, phone, website 저장/표시.
- 검색 autocomplete, 최근 검색어, pagination, 무한 스크롤.
- 지도/길찾기 화면, 경로/거리/이동시간 계산.
- 방문 시간, 메모, 예약 정보.
- Standalone lodging-place registration (#96).
- 같은 장소를 다른 Day로 이동하거나 여러 Day에 한 번에 추가.

## Requirements

### UI / UX

#### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - surfaced Day place registration action은 `장소 추가` 하나로 정리한다.
  - `장소 추가`는 Google Places 검색 화면으로 이동한다.
  - 기존 `장소 검색` 별도 CTA와 manual direct add CTA를 동시에 노출하지 않는다.
  - empty state helper는 검색 기반 추가에 맞게 갱신한다.
  - 저장 성공 후 돌아오면 기존 focus/refetch 또는 명시적 reload로 최신 Day itinerary를 보여준다.

- `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`
  - route 의미는 `/trips/{tripId}/days/{date}/place-search`를 유지한다.
  - 검색 input, `검색` action, 결과 list, result별 `추가` action을 제공한다.
  - generated TypeScript client/type을 사용한다.
  - 검색 결과가 없을 때 manual direct entry fallback을 보여주지 않는다.
  - result card는 최소 장소명, 주소, 유형 hint, `추가` action을 표시한다.

#### Save Interaction

- 일반 결과:
  - result card의 `추가`를 누르면 바로 저장 요청을 보낸다.
  - 저장 중에는 해당 result 또는 전체 result action을 disabled 처리하고 `추가 중...`을 보여 duplicate submit을 막는다.
- 같은 Day duplicate:
  - 서버가 confirmation-required conflict를 반환하면 confirmation panel/modal을 보여준다.
  - Copy: `이미 이 Day에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?`
  - Actions: `한 번 더 추가`, `취소`
  - `한 번 더 추가`는 `duplicateConfirmed: true`로 재요청한다.
  - `취소`는 API를 호출하지 않고 confirmation을 닫는다.
- 성공:
  - Day 일정 화면으로 돌아간다.
  - 추가된 item은 기존 default creation ordering rule에 따라 Day list 마지막에 보인다.

#### States

- Initial: `장소 이름을 검색해 보세요.`
- Min query: trim 후 2글자 미만이면 API를 호출하지 않고 `두 글자 이상 입력해 주세요.`
- Search loading: `장소를 검색하는 중...`; 검색 중 중복 검색 방지.
- Search empty: `검색 결과가 없어요. 다른 이름으로 검색해 주세요.`
- Search provider/network error: `장소를 검색할 수 없어요. 잠시 후 다시 시도해 주세요.` + `다시 시도`
- Add loading: `추가 중...`; duplicate submit 방지.
- Add stale/incomplete/provider/validation/network error:
  - 검색 결과 화면에 머문다.
  - `장소를 추가할 수 없어요. 다시 검색한 뒤 시도해 주세요.`를 보여준다.
  - 사용자는 재검색하거나 다른 결과를 선택할 수 있다.
- Auth error:
  - `401` 또는 refresh 실패는 기존 login recovery를 사용해 `/login`으로 이동한다.
- Forbidden / Not Found:
  - `403`, `404`, 범위 밖 날짜는 non-retry 상태로 보여준다.
  - Title: `일정을 찾을 수 없어요.`
  - Helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`
  - Action: `Day 일정으로` 또는 `여행 상세로` 중 화면 맥락에 맞는 기존 action을 사용한다.
- Conflict:
  - `DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED`는 duplicate confirmation으로 처리한다.
  - append order/rank `CONFLICT`는 retryable add error로 처리한다.

#### Copy / Labels

- Day screen CTA: `장소 추가`
- Search screen title: `장소 추가`
- Search screen helper: `이 Day에 추가할 장소를 검색해 보세요.`
- Input label: `장소 이름`
- Input placeholder: `예: 도톤보리, 우메다 카페`
- Search action: `검색`
- Result add action: `추가`
- Result add loading: `추가 중...`
- Duplicate confirmation: `이미 이 Day에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?`
- Duplicate confirm action: `한 번 더 추가`
- Cancel action: `취소`
- Add error: `장소를 추가할 수 없어요. 다시 검색한 뒤 시도해 주세요.`
- Back action: `Day 일정으로`

#### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 Day 일정 화면의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- 버튼/list/card 패턴이 반복되면 이번 변경에서 만든 중복만 공용 primitive 또는 helper로 정리한다. 범위를 벗어난 전체 UI refactor는 하지 않는다.

### API Contract

OpenAPI source of truth는 `packages/api-contract/openapi.yaml`이다. OpenAPI 변경 후 Go server interface와 TypeScript client/types를 regenerate한다.

#### Existing Search Endpoint

```text
GET /trips/{tripId}/days/{date}/places/google/search
```

- 계속 server-side Google Places search만 수행한다.
- 모바일은 Google API key를 보유하지 않는다.
- #94 저장 flow는 검색 response의 `googlePlaceId`를 사용해 save endpoint를 호출한다.
- 검색 response는 기존 display fields를 유지한다.

#### New Create Endpoint

```text
POST /trips/{tripId}/days/{date}/places/google/itinerary-items
```

Operation ID: `createGooglePlaceDayItineraryItem`

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다. Trip participant만 호출할 수 있으며 `date`는 trip 기간 안이어야 한다.

##### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
```

##### Request

Schema name: `CreateGooglePlaceDayItineraryItemRequest`

```json
{
  "googlePlaceId": "ChIJ...",
  "duplicateConfirmed": false
}
```

- `googlePlaceId`: required, trim 후 non-empty, max 255.
- `duplicateConfirmed`: required boolean.
  - `false`: same-Day duplicate이면 confirmation-required conflict를 반환한다.
  - `true`: same-Day duplicate도 의도적 중복으로 append한다.

##### Response

HTTP status: `201`

Schema name: `CreateGooglePlaceDayItineraryItemResponse`

```json
{
  "day": {
    "date": "2026-07-11",
    "dayOrder": 2,
    "lodgingPlace": null
  },
  "item": {
    "id": "...",
    "itemOrder": 4,
    "version": 1,
    "isLodging": false,
    "place": {
      "id": "...",
      "name": "도톤보리",
      "placeType": "sights",
      "address": "1 Chome Dotonbori, Chuo Ward, Osaka, Japan"
    }
  }
}
```

Response shape mirrors manual create response so Day 화면 can reuse existing view-model mapping.

##### Errors

- `400 VALIDATION_ERROR`: invalid `tripId`, invalid `date`, blank/too-long `googlePlaceId`, or invalid body.
- `401 UNAUTHORIZED`: missing/invalid auth.
- `403 FORBIDDEN`: authenticated user is not a trip participant.
- `404 NOT_FOUND`: trip not found or virtual day out of range.
- `409 DUPLICATE_DAY_PLACE_CONFIRMATION_REQUIRED`: same Google-backed place already has an itinerary item on this Day and `duplicateConfirmed` is `false`.
  - Error details should include at least `googlePlaceId` and existing `tripPlaceId` when available.
- `409 CONFLICT`: concurrent append/order conflict.
- `429 PLACE_PROVIDER_RATE_LIMITED`: Google provider rate limit.
- `502 PLACE_PROVIDER_UNAVAILABLE`: Google provider unavailable, selected provider place no longer resolvable, or provider returned unusable required metadata such as missing coordinates.
- `500 INTERNAL_ERROR`: unexpected error.

### DB Changes

Migration: `apps/api/migrations/00010_add_google_place_metadata_to_trip_places.sql`

Extend `trip_places` instead of adding a separate provider cache table.

Suggested columns:

```sql
ALTER TABLE trip_places
  ADD COLUMN provider text NOT NULL DEFAULT 'manual',
  ADD COLUMN google_place_id text,
  ADD COLUMN latitude double precision,
  ADD COLUMN longitude double precision,
  ADD COLUMN google_primary_type text,
  ADD COLUMN google_types text[] NOT NULL DEFAULT ARRAY[]::text[];
```

Constraints/indexes:

- `provider IN ('manual', 'google')`
- For `provider = 'google'`:
  - `google_place_id` is non-empty and max 255.
  - `latitude` is not null and between `-90` and `90`.
  - `longitude` is not null and between `-180` and `180`.
  - `google_primary_type` is non-empty.
  - `google_types` has at least one value.
- For `provider = 'manual'`:
  - existing rows default to `provider = 'manual'`.
  - Google metadata fields remain null/empty.
  - manual rows are not deduplicated by name/address.
- Partial unique index:

```sql
CREATE UNIQUE INDEX trip_places_trip_google_place_unique
  ON trip_places (trip_id, google_place_id)
  WHERE provider = 'google';
```

No DB column stores Google Maps URL, directions URL, rating, photos, phone, website, or opening hours.

`apps/api/schema.sql` must be regenerated/updated after migrations.

### Business Rules

- Mobile never calls Google Places directly and never stores a Google API key.
- `trip_places` place identity and `itinerary_items` schedule entries are separate.
- Same trip + same `googlePlaceId` maps to one Google-backed `trip_place` record.
- Same Day may contain multiple `itinerary_items` pointing to the same `trip_place`, but only after user confirmation.
- Confirmed same-Day duplicate uses existing default append ordering: new item goes to the end of that Day list.
- Existing manual places without `googlePlaceId` are not merged, linked, or backfilled in #94.
- If a manual place and a Google-backed place represent the same real-world place, both records may coexist.
- When creating a new Google-backed `trip_place`, the server resolves current provider details by `googlePlaceId` and persists the initial snapshot:
  - `provider = google`
  - `google_place_id`
  - `name` from Google display name
  - `address` from Google formatted address
  - `latitude`
  - `longitude`
  - `google_primary_type`
  - `google_types`
  - mapped internal `place_type`
- Existing Google-backed `trip_place` snapshots are reused as-is. #94 does not refresh metadata on reuse.
- `TripPlaceType` mapping:
  - Use `primaryType` first.
  - If `primaryType` is unmapped, scan raw Google types in provider order.
  - If no type maps confidently, default to `etc`.
  - No edit-before-save step in #94. Existing Day item edit flow may be used later if the type is wrong.
- Initial mapping table:
  - `lodging`: `lodging`, `hotel`, `motel`, `resort_hotel`, `guest_house`, `hostel`, `bed_and_breakfast`
  - `cafe`: `cafe`, `coffee_shop`
  - `food`: `restaurant`, `meal_takeaway`, `meal_delivery`, `bakery`, `bar`, `food`
  - `shopping`: `shopping_mall`, `store`, `department_store`, `clothing_store`, `supermarket`, `convenience_store`
  - `sights`: `tourist_attraction`, `museum`, `park`, `art_gallery`, `amusement_park`, `zoo`, `aquarium`, `landmark`, `historical_landmark`, `place_of_worship`
  - otherwise `etc`
- Google Maps/directions URLs are assembled at runtime when needed from current origin plus stored destination `latitude`, `longitude`, and/or `googlePlaceId`; no URL generation requires a Google API call.

## Acceptance Criteria

- [ ] Feature spec is reviewed and approved before implementation starts.
- [ ] Day screen surfaced place registration has a single `장소 추가` action that opens the Google Places search/select add flow.
- [ ] Existing manual direct add screen/endpoint is not exposed as #94 Day add fallback.
- [ ] Search result cards show an explicit `추가` action.
- [ ] Pressing `추가` for a new Google result creates a Day itinerary item for the current `tripId + date`.
- [ ] If the selected Google place already exists for the trip, the existing Google-backed `trip_place` is reused instead of creating another place row.
- [ ] If the selected Google place already exists on the same Day and `duplicateConfirmed` is false, the user sees `이미 이 Day에 추가된 장소입니다. 같은 장소를 한 번 더 일정에 추가할까요?` with `한 번 더 추가` and `취소`.
- [ ] Confirming same-Day duplicate creates a distinct new itinerary item at the end of the Day list.
- [ ] Google-backed `trip_places` persist `provider`, `googlePlaceId`, display name/name snapshot, formatted address/address snapshot, latitude, longitude, primary type, raw Google types, and mapped internal `placeType`.
- [ ] Google Maps URL, directions URL, rating, and photos are not persisted.
- [ ] `TripPlaceType` is auto-mapped from Google types and defaults to `etc` when unmapped.
- [ ] Manual-first places without `googlePlaceId` are not merged or backfilled in #94.
- [ ] Successful add returns to Day screen and the Day list refresh shows the new item.
- [ ] Search/add loading, duplicate submit prevention, empty, provider/network error, auth, forbidden, not-found, duplicate confirmation, and stale/incomplete provider states are handled.
- [ ] OpenAPI, generated Go server artifacts, generated TS client/types, migrations/schema, sqlc queries/generated code, API server, and mobile code are updated only for the approved scope.
- [ ] Staging or internal build verifies Day 일정 → 장소 추가 → 검색 → 결과 추가 → Day 목록 반영 happy path.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI and generated code include Google add endpoint/request/response | Contract/generated | `packages/api-contract/openapi.yaml`, generated Go/TS | `pnpm generate && pnpm verify:generated` |
| DB migration adds Google metadata constraints and partial unique index | DB | `apps/api/migrations/00010_add_google_place_metadata_to_trip_places.sql`, repository integration tests | `pnpm db:migrate && pnpm db:status && pnpm db:rollback && pnpm db:migrate` with test `DATABASE_URL` |
| Google place details maps provider snapshot to internal `TripPlaceType` | API service | `apps/api/internal/place/service_test.go` or `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Validation/auth/forbidden/not-found/provider errors for create endpoint | API handler/service | `apps/api/internal/server/server_test.go`, service tests | `pnpm --filter @i-um/api test` |
| New Google place creates `trip_place` and appends itinerary item | Repository/API | `apps/api/internal/storage/trip_repository_test.go`, server tests | `pnpm --filter @i-um/api test` |
| Same trip + same `googlePlaceId` reuses one `trip_place` | Repository/API | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Same-Day duplicate requires confirmation, then confirmed request appends a new item | API service/server | service tests, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Day screen `장소 추가` routes to Google search and no longer exposes manual add as surfaced fallback | Mobile unit/view-model | `apps/mobile/lib/places/*.test.mts`, route/helper tests | `pnpm --filter @i-um/mobile test` |
| Search result `추가` request mapping and duplicate confirmation state | Mobile unit | `apps/mobile/lib/places/google-search*.test.mts` or new helper test | `pnpm --filter @i-um/mobile test` |
| Save success returns to Day and refreshes list via focus/refetch | Mobile type/state | mobile helper/screen behavior where testable | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Full project gates | All | generated/api/mobile | `pnpm verify` |

## Regression Gaps

- Staging/internal build happy path with real Google provider and deployed secrets is manual smoke rather than automated regression.
  - Risk: environment-specific Google API key, billing, or Cloud Run secret wiring can fail despite fake-provider tests passing.
  - Follow-up: keep as release smoke gate for #94; no separate automation issue required yet.

## TDD Implementation Plan

1. Red: Contract and generated drift
   - Add failing expectations for `createGooglePlaceDayItineraryItem` request/response in OpenAPI and generated client/server usage.
   - Verify: `pnpm generate && pnpm verify:generated`

2. Red: DB persistence and constraints
   - Add migration for Google metadata columns, coordinate checks, provider check, and partial unique index.
   - Add repository tests that fail until Google-backed `trip_place` create/reuse and same-Day append are implemented.
   - Verify: `pnpm --filter @i-um/api test`

3. Red: API service/provider behavior
   - Add fake Google provider details tests for success, missing coordinates, provider unavailable/rate-limited, type mapping fallback, participant/date validation, manual non-merge, and duplicate confirmation.
   - Verify: `pnpm --filter @i-um/api test`

4. Green: API implementation
   - Add provider details method using server-side Google Places details field mask: id, displayName, formattedAddress, location, primaryType, types.
   - Add service method for Google result save: validate request, auth/date checks, existing Google-backed place reuse, details lookup for new places, type mapping, duplicate confirmation rule.
   - Add repository transaction to create-or-reuse Google `trip_place` and append itinerary item at end.
   - Add handler/error mapping for `201`, duplicate-confirmation `409`, provider errors, validation/auth/forbidden/not-found/conflict.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`

5. Red: Mobile add flow state
   - Add helper tests for add submit state, duplicate-confirmation state, request body mapping, save error copy, and Day route after success.
   - Verify: `pnpm --filter @i-um/mobile test`

6. Green: Mobile implementation
   - Change Day screen surfaced `장소 추가` action to route to Google search.
   - Add `createGooglePlaceDayItineraryItem` mobile client helper.
   - Add result card `추가`, add loading/disabled state, duplicate confirmation UI, error UI, auth/not-found handling, and success navigation back to Day.
   - Keep manual add route/screen unlinked from #94 Day add UX.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`

7. Refactor
   - Move repeated search/add state, error mapping, type hint, and route helpers into `apps/mobile/lib/places/**` or existing trip helpers.
   - Keep raw styling values out of screens; reuse theme tokens and shared primitives where practical.
   - Verify: targeted API/mobile tests and typecheck.

8. Gate
   - Verify generated artifacts and full regression gates.
   - Verify DB migration apply/status/rollback/re-apply on a test database.
   - Verify staging/internal happy path after deploy/build.
   - Commands:
     - `pnpm verify:generated`
     - `pnpm --filter @i-um/api test`
     - `pnpm --filter @i-um/api build`
     - `pnpm --filter @i-um/mobile test`
     - `pnpm --filter @i-um/mobile typecheck`
     - `pnpm verify`

## Verification Record

### Automated Regression

- `pnpm generate`: Pass.
- `pnpm verify:generated`: Pass.
- `pnpm --filter @i-um/api test`: Pass.
- `pnpm --filter @i-um/api build`: Pass.
- `pnpm --filter @i-um/mobile test`: Pass.
- `pnpm --filter @i-um/mobile typecheck`: Pass.
- `pnpm --filter @i-um/api db:rollback && pnpm --filter @i-um/api db:migrate && pnpm --filter @i-um/api db:status`: Pass.
- `pnpm verify`: Pass.

### Manual Smoke

- Day 일정 → 장소 추가 → 검색 → 결과 추가 → Day 목록 반영: Not run; staging/internal build not deployed for this implementation pass.

## Release Notes

- Day 일정에서 Google Places 검색 결과를 선택해 장소를 추가할 수 있도록 설계한다.
- Google-backed 장소는 여행 단위로 재사용하고 좌표를 저장해 향후 지도/길찾기 기능의 destination source로 사용할 수 있게 한다.

## Open Questions

- None

## Follow-up Issues

- #96: standalone lodging-place registration.
- Future map/directions slice: stored destination `latitude`, `longitude`, and `googlePlaceId`를 사용해 origin-dependent URL/route를 런타임 조립한다.
- Future provider enrichment slice: rating/photos/opening hours/Google attribution/cache/refresh policy.
- Future manual coordinate fallback, if needed: manual text entry가 아니라 지도 pin 선택 또는 좌표를 보장하는 UX로 별도 설계한다.
