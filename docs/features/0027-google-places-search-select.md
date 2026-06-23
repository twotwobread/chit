# Feature Slice: F-027 Google Places 장소 검색

## Metadata

- GitHub Issue: #27
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260623_020433`
- Seed: `seed_60c88e6ff775`
- PM Document: N/A
- Notes: Ambiguity score `0.095`. Ouroboros clarified F-027 as a Day-scoped Google Places search-only MVP. The original issue title/goal mentions search/select and `TripPlace` snapshot saving, but the approved F-027 slice intentionally stops at search result display. Result selection, `TripPlace` persistence, and Day itinerary insertion are deferred to follow-up work.

## Goal

사용자가 특정 Day 일정 화면에서 Google Places 기반 장소 검색을 수행하고, 장소명/주소/유형 hint가 포함된 검색 결과 목록을 확인할 수 있다.

F-027은 검색 capability를 Day 맥락에 붙이는 최소 vertical slice다. 장소 선택, `TripPlace` 저장, 특정 Day에 일정 장소로 추가하는 동작은 이번 기능에서 하지 않는다.

## Problem

- F-026으로 사용자가 장소를 직접 추가할 수 있지만, 장소명/주소를 모를 때 검색 기반으로 후보를 찾을 수 없다.
- 이후 Google Places 결과 선택 및 저장 흐름은 먼저 안전한 검색 API와 앱 화면이 있어야 작게 붙일 수 있다.
- 모바일 앱이 Google API key를 직접 들고 Google Places를 호출하면 secret 노출 위험이 있다.
- Day 맥락에서 검색을 열어야 후속 선택/저장 기능이 같은 `tripId + date` 컨텍스트를 재사용할 수 있다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 앱은 기존 `GET /trips/{tripId}/days/{date}/itinerary`로 Day header와 현재 장소 목록을 보여준다.
3. 사용자가 `장소 검색`을 누른다.
4. 앱이 `/trips/{tripId}/days/{date}/place-search` 화면을 연다.
5. 사용자가 장소명을 입력한다.
6. 검색어가 trim 후 2글자 미만이면 앱은 API를 호출하지 않고 `두 글자 이상 입력해 주세요.`를 보여준다.
7. 사용자가 2글자 이상 검색어로 `검색`을 누른다.
8. 앱은 generated API client로 `GET /trips/{tripId}/days/{date}/places/google/search`를 호출한다.
9. 서버는 인증된 사용자가 trip participant인지 확인하고, `date`가 trip 기간 안인지 검증한다.
10. 서버는 server-side `GOOGLE_PLACES_API_KEY`로 Google Places Text Search를 1회 호출한다.
11. 앱은 검색 결과의 장소명, 주소, 유형 hint를 목록으로 표시한다.
12. 사용자는 결과 row를 볼 수 있다. row tap/save/add 동작은 F-027에서 제공하지 않는다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: Day 일정 화면의 `장소 검색` 진입점, `/trips/{tripId}/days/{date}/place-search` 검색 화면, initial/min-query/loading/empty/error/success 상태
- [x] API Contract: authenticated `GET /trips/{tripId}/days/{date}/places/google/search` endpoint와 Google search result schemas
- [x] API Server: participant authorization, date range validation, Google Places server-side provider adapter, query/limit validation, provider error mapping
- [x] DB: No DB changes. 기존 `trip_places`, `itinerary_items` table에 row를 생성하지 않는다.
- [x] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type 갱신
- [x] Tests: OpenAPI/generated drift, API handler/service/provider tests, mobile search state/route tests, mobile typecheck
- [ ] Deployment: API server `GOOGLE_PLACES_API_KEY` env/secret 필요. Mobile에는 Google secret을 넣지 않는다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 검색 결과 선택 후 `TripPlace` 저장
- 검색 결과를 특정 Day의 `itinerary_items`로 추가
- F-026 `POST /trips/{tripId}/days/{date}/itinerary-items` 호출 또는 재사용
- `trip_places`, `itinerary_items`, provider cache table 생성/수정
- 장소 직접 추가 (#26)
- 장소 수정/삭제 (#28)
- 일정 순서 변경 (#29)
- 숙소 장소 지정 (#30)
- Google Places autocomplete
- 최근 검색어
- 페이징, 더보기, 무한 스크롤
- Google Place details 조회
- Google Places 사진, 리뷰, 평점, 영업시간, 전화번호, 웹사이트 저장/표시
- 앱 내부 지도/길찾기 또는 Google Maps URL 연결
- trip detail/today/settlement 조회 시 provider API 자동 호출
- Google provider account/billing 생성 자동화

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - F-025/F-026 Day 일정 화면에 `장소 검색` CTA를 추가한다.
  - 장소가 없는 empty state와 장소가 있는 success state 모두에서 검색 화면에 진입할 수 있어야 한다.
  - F-026의 `장소 추가` CTA가 존재하는 경우, `장소 검색`은 별도 action으로 제공한다. F-027에서 두 action을 통합하지 않는다.

- `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`
  - Google Places 검색 input, `검색` action, 결과 목록을 제공한다.
  - route 의미는 `/trips/{tripId}/days/{date}/place-search`를 유지한다.
  - generated TypeScript client/type을 사용해 i-um API를 호출한다.
  - 결과 row tap/save/add CTA는 제공하지 않는다.

### Search Form

- 장소 이름 검색 input
  - trim 후 2글자 이상일 때만 검색 가능하다.
  - F-027은 explicit `검색` action으로 요청 1회를 보낸다.
  - 자동완성, debounce 기반 연속 호출, 최근 검색은 제공하지 않는다.
- 검색 결과 row
  - 장소명
  - 주소
  - Google primary type 기반 유형 hint
  - `googlePlaceId`는 API response에 포함하지만 화면에 반드시 노출하지 않는다.

### States

- Initial: 검색 전에는 `장소 이름을 검색해 보세요.` helper를 보여준다.
- Min query: trim 후 2글자 미만이면 API를 호출하지 않고 `두 글자 이상 입력해 주세요.`를 보여준다.
- Loading: 검색 중 `장소를 검색하는 중...`을 표시하고 `검색` action을 중복 실행할 수 없게 한다.
- Empty: 결과가 없으면 `검색 결과가 없어요. 다른 이름으로 검색해 주세요.`를 표시한다.
- Error: provider/network 오류 시 `장소를 검색할 수 없어요. 잠시 후 다시 시도해 주세요.`와 retry action을 표시한다.
- Success: 장소명, 주소, 유형 hint를 결과 목록으로 표시한다.
- Not Found / Forbidden: direct route나 API가 `403`/`404`를 반환하면 `일정을 찾을 수 없어요.` 상태를 보여준다.

### Copy / Labels

- Day screen CTA: `장소 검색`
- Screen title: `장소 검색`
- Screen helper: `이 Day에 추가할 후보 장소를 검색해 보세요.`
- Input label: `장소 이름`
- Input placeholder: `예: 도톤보리, 우메다 카페`
- Search action: `검색`
- Initial helper: `장소 이름을 검색해 보세요.`
- Min query helper: `두 글자 이상 입력해 주세요.`
- Loading: `장소를 검색하는 중...`
- Empty: `검색 결과가 없어요. 다른 이름으로 검색해 주세요.`
- Error: `장소를 검색할 수 없어요. 잠시 후 다시 시도해 주세요.`
- Retry: `다시 시도`
- Not found title: `일정을 찾을 수 없어요.`
- Not found helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`
- Back action: `Day 일정으로`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 Day 일정 화면의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- 버튼/입력/card 패턴이 두 번째 이상 반복되면 이번 변경에서 만든 중복만 공용 primitive로 정리한다. 범위를 벗어난 전체 UI refactor는 하지 않는다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips/{tripId}/days/{date}/places/google/search
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다. Trip participant만 호출할 수 있으며 `date`는 trip 기간 안이어야 한다.

### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
```

### Query Parameters

```text
query: string, required, trim 후 최소 2자, 최대 120자
limit: integer, optional, default 5, min 1, max 10
```

F-027은 pagination token이나 cursor parameter를 받지 않는다.

### Response

HTTP status: `200`

Schema name: `SearchGooglePlacesResponse`

```json
{
  "results": [
    {
      "googlePlaceId": "ChIJ...",
      "displayName": "도톤보리",
      "formattedAddress": "1 Chome Dotonbori, Chuo Ward, Osaka, Japan",
      "primaryType": "tourist_attraction"
    }
  ]
}
```

Schema name: `GooglePlaceSearchResult`

```text
googlePlaceId: string, required
displayName: string, required
formattedAddress: string, required
primaryType: string, required
```

Response notes:

- Search response is for display only and is not persisted.
- Server requests only needed Google fields through a field mask: place id, display name, formatted address, primary type.
- F-027 does not return latitude/longitude because it does not save or map a place yet.
- Mobile maps `primaryType` to a user-facing type hint. Unknown Google primary types may display a generic `장소` hint.

### Google Provider Integration

Recommended provider call uses Google Places API Text Search server-side from the API server.

```text
POST https://places.googleapis.com/v1/places:searchText
```

Provider request behavior:

- API key is read from server-side `GOOGLE_PLACES_API_KEY`.
- The key is not sent to or stored in the mobile app.
- Request uses the user's trimmed `query` as text query.
- Request caps result count with the validated `limit`.
- Request field mask includes only `places.id`, `places.displayName`, `places.formattedAddress`, `places.primaryType` or equivalent fields for the chosen Google Places API version.

### Errors

공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid place search request",
    "details": []
  }
}
```

- `400 VALIDATION_ERROR`: invalid `tripId`, invalid `date`, too-short/too-long `query`, invalid `limit`
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant of the trip
- `404 NOT_FOUND`: trip does not exist, or `date` is outside `trip.startDate`~`trip.endDate`
- `429 PLACE_PROVIDER_RATE_LIMITED`: Google Places rate/quota limit
- `502 PLACE_PROVIDER_UNAVAILABLE`: Google Places unavailable, denied, malformed provider response, or API key not configured
- `500 INTERNAL_ERROR`: unexpected server/data error

## DB Changes

No DB changes.

F-027 does not create or update `trip_places`, `itinerary_items`, or provider cache tables. Search results are not persisted.

### Tables

No new tables.

### Constraints / Indexes

No new constraints or indexes.

### Migration Notes

- No goose migration should be added for F-027.
- Existing F-025/F-026 tables remain unchanged.

## Business Rules

- Only authenticated trip participants can search Google Places in a Day context.
- `date` must be a valid `YYYY-MM-DD` date inside the trip's start/end date range.
- Mobile never calls Google Places directly and never stores the Google API key.
- Mobile does not call the i-um search API when the trimmed query is shorter than 2 characters.
- Server also enforces query validation even if mobile validation is bypassed.
- Server caps result count to 10.
- Search is a one-shot text search request. F-027 does not provide autocomplete, pagination, recent searches, or place details.
- Search results are display-only and are not persisted.
- No `TripPlace` snapshot is created in F-027.
- No `itinerary_items` row is created in F-027.
- Result row interaction is intentionally inert or absent in F-027. Tapping a result must not save or navigate to a place detail.
- Google rich details such as rating, photos, reviews, opening hours, phone, website, and location coordinates are not requested or returned.
- If `GOOGLE_PLACES_API_KEY` is missing, the API returns a provider-unavailable error rather than exposing a broken UI as saved data.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 자동화 테스트와 연결한다.

- [x] AC-01: Day 일정 화면에서 `장소 검색` action으로 `/trips/{tripId}/days/{date}/place-search`에 진입할 수 있다.
- [x] AC-02: 검색 화면은 initial 상태에서 `장소 이름을 검색해 보세요.`를 표시한다.
- [x] AC-03: 검색어가 trim 후 2글자 미만이면 mobile은 API를 호출하지 않고 `두 글자 이상 입력해 주세요.`를 표시한다.
- [x] AC-04: valid query submit 중 mobile은 loading 상태를 표시하고 중복 검색을 막는다.
- [x] AC-05: `packages/api-contract/openapi.yaml`에 authenticated `GET /trips/{tripId}/days/{date}/places/google/search` endpoint와 response schema가 정의되어 있다.
- [x] AC-06: generated Go server artifact와 TypeScript client/type이 search endpoint/schema를 포함한다.
- [x] AC-07: mobile은 generated TypeScript client를 사용해 i-um search endpoint를 호출하고 Google API key를 포함하지 않는다.
- [x] AC-08: 인증되지 않은 search 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] AC-09: invalid `tripId`, invalid `date`, invalid `query`, invalid `limit`은 `400 VALIDATION_ERROR`를 반환한다.
- [x] AC-10: 존재하지 않는 trip은 `404 NOT_FOUND`를 반환한다.
- [x] AC-11: participant가 아닌 authenticated user의 search 요청은 `403 FORBIDDEN`을 반환한다.
- [x] AC-12: 여행 기간 밖 `date`는 `404 NOT_FOUND`를 반환한다.
- [x] AC-13: valid participant/date/query search는 Google provider adapter를 통해 `googlePlaceId`, `displayName`, `formattedAddress`, `primaryType` 결과 목록을 반환한다.
- [x] AC-14: search 결과가 비어 있으면 mobile은 empty 상태를 표시한다.
- [x] AC-15: provider 오류, API key 미설정, network/unknown 오류는 retry 가능한 error 상태로 표시된다.
- [x] AC-16: provider rate/quota limit은 common error format의 `PLACE_PROVIDER_RATE_LIMITED`로 매핑된다.
- [x] AC-17: mobile 결과 row는 장소명, 주소, Google primary type 기반 유형 hint를 표시한다.
- [x] AC-18: F-027은 `TripPlace`/`ItineraryItem`을 생성하지 않고 DB migration을 추가하지 않는다.
- [x] AC-19: F-027은 결과 tap/save/add, Day 선택, 장소 저장, 지도/길찾기, autocomplete, pagination, place details를 구현하지 않는다.

## Regression Test Plan

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-05, AC-06: OpenAPI search endpoint/schema and generated artifacts are in sync | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-08, AC-09, AC-10, AC-11, AC-12: auth, validation, not found, forbidden, out-of-range errors | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/place/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-13: valid provider result mapping and Google field extraction | API provider/service | `apps/api/internal/place/google_provider_test.go`, `apps/api/internal/place/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-15, AC-16: missing key/provider errors/rate limits map to common error format | API handler/provider | `apps/api/internal/server/server_test.go`, `apps/api/internal/place/google_provider_test.go` | `pnpm --filter @i-um/api test` |
| AC-01: Day search route helper builds `/trips/{tripId}/days/{date}/place-search` | Mobile logic | `apps/mobile/lib/places/google-search.test.mts` or route helper test | `pnpm --filter @i-um/mobile test` |
| AC-02, AC-03, AC-04, AC-14, AC-15: mobile search state helper maps initial/min/loading/empty/error states | Mobile logic/state | `apps/mobile/lib/places/google-search.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-07, AC-17: mobile generated-client helper and row view-model include displayName/address/type hint without Google key | Mobile logic/type | `apps/mobile/lib/places/google-search.test.mts`, TypeScript gate | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| AC-18, AC-19: no DB migration/persistence/save endpoint or unsupported UX added | Contract/DB/static review | `apps/api/migrations`, OpenAPI generated drift | `pnpm verify:generated` |
| AC-01 through AC-19: full suite remains green | All | verify gate | `pnpm verify` |

## Regression Gaps

- Native text input/render interaction is not covered by the current pure Node mobile test setup.
  - Automated coverage retained: pure route/state/view-model tests and TypeScript integration.
  - Risk: a screen wiring regression may require simulator/internal build smoke to detect.
  - Follow-up: add mobile component/e2e harness in a later testing slice.
- Live Google Places behavior is not called in CI.
  - Automated coverage retained: fake HTTP/provider fixture tests.
  - Risk: API key/billing/provider field-mask issues may appear only in staging smoke.
  - Follow-up: staging secret setup/manual smoke before release.

## TDD Implementation Plan

1. Red: Contract/API behavior tests
   - Add failing API handler/service tests for unauthenticated, invalid params, missing trip, non-participant, out-of-range date, valid empty/non-empty search, provider unavailable, and provider rate limit.
   - Verify: `pnpm --filter @i-um/api test` fails before implementation.
2. Red: Provider adapter tests
   - Add failing provider tests for request field mask/key handling, successful Google response mapping, malformed provider response, missing key, quota/rate limit, and unavailable errors.
   - Verify: `pnpm --filter @i-um/api test` fails before implementation.
3. Red: Mobile search route/state tests
   - Add failing tests for route construction, min-query no-call intent, loading/empty/error/success state mapping, retry intent, and primary type label/view-model mapping.
   - Verify: `pnpm --filter @i-um/mobile test` fails before implementation.
4. Contract: OpenAPI first
   - Add `GET /trips/{tripId}/days/{date}/places/google/search`, `GooglePlaceSearchResult`, and `SearchGooglePlacesResponse` schemas.
   - Regenerate Go server artifacts and TypeScript client/types.
   - Verify: `pnpm generate && pnpm verify:generated` passes.
5. Green: API implementation
   - Add place search service/provider, reuse existing auth context/trip lookup/participant authorization/date-only range logic, wire server handler, and map provider errors to common error format.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
6. Green: Mobile implementation
   - Add generated-client search helper, Day screen `장소 검색` CTA, `/trips/{tripId}/days/{date}/place-search` screen, and pure state/view-model helpers.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
7. Refactor
   - Remove duplication introduced by F-027 only. Keep unrelated UI/API code unchanged.
   - Verify: relevant API/mobile tests pass.
8. Regression gate
   - Verify: `pnpm verify`.
9. Deployment/manual smoke
   - Configure `GOOGLE_PLACES_API_KEY` in local/staging API environment.
   - Verify Day screen → place search → results/empty/error paths in simulator/internal build.

## Verification Plan

### Automated Regression

```text
pnpm generate
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

DB migration verification is not required for F-027 because there are no DB changes. Existing migration regression remains covered by `pnpm verify` and API tests.

### Implementation Verification (2026-06-23)

```text
pnpm --filter @i-um/api test
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify:generated
pnpm --filter @i-um/api build
pnpm verify
```

All commands passed locally in `.worktrees/F027-google-places-search-select`. Manual smoke and staging/internal build verification remain pending because they require a configured `GOOGLE_PLACES_API_KEY` environment and app runtime.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] API server에 `GOOGLE_PLACES_API_KEY`가 설정된 환경에서 앱을 실행한다.
- [ ] Day 일정 화면에서 `장소 검색`을 누르면 `/trips/{tripId}/days/{date}/place-search` 화면이 열린다.
- [ ] 검색 전 `장소 이름을 검색해 보세요.`가 보인다.
- [ ] 2글자 미만 검색어에서는 API 호출 없이 `두 글자 이상 입력해 주세요.` helper가 보인다.
- [ ] `도톤보리` 같은 검색어로 장소명/주소/유형 hint 결과 목록이 보인다.
- [ ] 결과가 없는 검색어는 empty state를 보여준다.
- [ ] provider/API key 오류 환경에서는 retryable error와 `다시 시도`가 보인다.
- [ ] 결과를 탭해도 저장/Day 추가/상세 진입 동작이 발생하지 않는다.
- [ ] staging 또는 internal build에서 검색 happy path를 확인한다.

## Release Notes

```text
- Day 일정 화면에서 Google Places 기반 장소 검색 결과를 확인할 수 있습니다.
- Google Places 호출은 서버를 통해 처리되어 앱에 Google API key가 포함되지 않습니다.
- 검색 결과 선택과 일정 추가는 후속 기능에서 제공됩니다.
```

## Open Questions

None for F-027 search-only implementation.

## Follow-up Issues

- #28: 일정 장소 수정/삭제
- #29: 일정 순서 변경
- #30: 숙소 장소 지정
- TBD: Google Places 검색 결과를 선택해 `TripPlace` 스냅샷으로 저장하고 현재 Day에 추가하는 후속 feature
- TBD: 저장된 장소의 좌표/지도/길찾기 연동 feature
