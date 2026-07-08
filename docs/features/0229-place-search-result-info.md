# Feature Slice: 지도 기반 일정 장소 검색/선택 UX

## Metadata

- GitHub Issue: #229
- Status: Approved for Implementation
- Created: 2026-07-04
- Updated: 2026-07-06
- Run: `.harness/runs/20260704-issue-229-place-search-info`

## Source

- Issue: #229 — `[일정] 장소 검색 결과에 추가 정보 표시 방안 논의`
- Product discussion decisions:
  - #229 is redefined from simple list enrichment to map-based place exploration/selection.
  - The UI uses an in-app map, category-aware markers, and a bottom sheet result list.
  - Address is not shown in result cards; the map position is the location signal.
  - One representative image is shown per place, lazy-loaded through the server.
  - Rating and review count are shown; review bodies and saved count are not shown.
  - Description is fetched only after selecting a place.
  - Images/details are controlled by the server to protect API keys and bound cost.
- Current sources:
  - `apps/api/internal/place/google_provider.go`
  - `apps/api/internal/place/service.go`
  - `apps/api/internal/server/place_handlers.go`
  - `packages/api-contract/openapi.yaml`
  - `apps/mobile/lib/places/google-search.ts`
  - `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`
  - `apps/mobile/lib/trip-ui/RouteMap.tsx`
  - `apps/mobile/lib/trip-ui/BottomSheet.tsx`
- External references:
  - Google Text Search (New): <https://developers.google.com/maps/documentation/places/web-service/text-search>
  - Google Place Details (New): <https://developers.google.com/maps/documentation/places/web-service/place-details>
  - Google Place Data Fields: <https://developers.google.com/maps/documentation/places/web-service/data-fields>
  - Google Place Photos (New): <https://developers.google.com/maps/documentation/places/web-service/place-photos>
  - Google Places usage/billing: <https://developers.google.com/maps/documentation/places/web-service/usage-and-billing>
  - Google pricing: <https://developers.google.com/maps/billing-and-pricing/pricing#places-pricing>

## Goal

일정에 추가할 장소를 고를 때 사용자가 충분한 판단 정보를 얻을 수 있도록, 현재의 단순 목록형 Google 장소 검색을 지도 기반 탐색/선택 화면으로 개편한다.

사용자는 검색 결과의 실제 위치를 지도 마커로 보고, 바텀시트 카드에서 대표 이미지/카테고리/평점/리뷰 수/영업 상태를 확인한 뒤, 관심 장소를 선택하면 지도 중심이 해당 장소로 이동하고 같은 목록 카드가 확장되어 설명과 추가 action을 확인한다.

## Current State

현재 서버는 Places API (New) Text Search를 사용한다.

```text
POST https://places.googleapis.com/v1/places:searchText
X-Goog-FieldMask: places.id,places.displayName,places.formattedAddress,places.primaryType
```

현재 OpenAPI `GooglePlaceSearchResult`는 다음 필드만 노출한다.

- `googlePlaceId`
- `displayName`
- `formattedAddress`
- `primaryType`

현재 모바일 일정 추가 검색 row는 다음 정보만 보여준다.

- 장소명
- 로컬 매핑 기반 카테고리 힌트
- 주소
- 추가 버튼

현재 API contract의 검색 limit은 `1..10`, 모바일 기본값은 `5`다.

## Target UX

### Screen structure

- 상단/전체 영역: in-app map
- 하단: handle drag/focus 가능한 bottom sheet result list
- 검색창: 장소명/키워드 검색
- 일정 생성 진입: 일정 상세 입력 화면에서 `장소 검색` 버튼을 눌러 이 지도 검색 화면에 진입한다. 지도 검색은 selector mode에서 장소 선택 후 상세 입력 화면으로 돌아가고, 저장은 상세 입력 화면에서 수행한다.
- 지도 action:
  - `현재 위치로 이동`
  - `이 지역에서 다시 검색`
- 결과 action:
  - result card tap
  - marker tap
  - 확장된 result card에서 `장소 추가`
  - 확장된 result card에서 `Google Maps`

### Search result card

카드는 주소를 표시하지 않는다. 지도 위치가 위치 정보 역할을 한다.

표시 정보:

- 대표 이미지 1장
- 장소명
- 한글 카테고리
- 평균 평점
- 리뷰 수
- optional `영업 중` / `영업 종료`

제외 정보:

- 주소
- 리뷰 원문
- 리뷰 요약
- 저장 수
- 여러 장 이미지 gallery

### Map behavior

- 검색 결과는 좌표가 있는 경우 marker로 표시한다.
- marker 색상/아이콘은 카테고리 그룹에 따라 다르게 표시한다.
- result card를 누르면:
  - 해당 marker를 하이라이트한다.
  - 지도 중심을 해당 장소로 이동한다.
  - 별도 detail sheet로 전환하지 않고 같은 목록 카드가 확장된다.
  - 현재 bottom sheet 크기(`minimized`/`expanded`/`full`)는 유지한다.
- marker를 누르면:
  - 동일하게 selection을 갱신한다.
  - bottom sheet는 `expanded`(middle)로 전환한다.
  - 목록 스크롤 위치를 선택된 장소 카드로 이동해 sheet를 늘렸을 때 해당 정보가 바로 보이게 한다.
- 지도 이동/확대만으로 자동 검색하지 않는다.
- 지도 이동 후 `이 지역에서 다시 검색` 버튼을 누를 때만 새 검색을 호출한다.
- 시트 handle을 누른 채 위/아래로 움직이면 시트 높이가 `minimized`/`expanded`/`full` 범위에서 부드럽게 따라오고, release 시 가까운 방향 상태로 snap된다.

### Selected inline expansion

선택한 장소에 대해서만 추가 정보를 가져오며, 별도 detail sheet 대신 선택된 result card가 목록 안에서 확장된다.

확장 카드 표시 정보:

- 대표 이미지 1장
- 장소명
- 카테고리
- 평점 / 리뷰 수
- optional 영업 상태
- description
- 같은 row의 왼쪽 `장소 추가` 버튼
- 같은 row의 오른쪽 `Google Maps` 버튼

Description은 Google `editorialSummary`를 우선 사용하고, 필요하면 Google이 제공하는 summary 계열 필드를 fallback 후보로 둔다. 모바일에는 단일 `description` 문자열만 노출한다. 사진/리뷰 안내 문구나 별도 리뷰 영역은 표시하지 않는다.

## Google Places Findings

Google Places API (New)는 FieldMask로 응답 필드와 비용 SKU가 결정된다. Google 문서에 따르면 Text Search/Place Details/Nearby Search는 FieldMask를 사용하고, 요청한 필드 중 가장 높은 SKU 기준으로 과금된다.

| 후보 정보        | Google field/API                                      | SKU impact               | v1 decision             |
| ---------------- | ----------------------------------------------------- | ------------------------ | ----------------------- |
| 장소명           | `places.displayName`                                  | Text Search Pro          | 사용                    |
| 좌표             | `places.location`                                     | Text Search Pro          | 사용                    |
| 카테고리         | `places.primaryType`, `places.primaryTypeDisplayName` | Text Search Pro          | 사용                    |
| Google Maps 링크 | `places.googleMapsUri`                                | Text Search Pro          | 사용                    |
| 평점             | `places.rating`                                       | Text Search Enterprise   | 사용                    |
| 리뷰 수          | `places.userRatingCount`                              | Text Search Enterprise   | 사용                    |
| 현재 영업 여부   | `places.currentOpeningHours.openNow`                  | Text Search Enterprise   | 사용, optional          |
| 사진 metadata    | `places.photos`                                       | Text Search Pro          | 대표 사진 후보로 사용   |
| 실제 사진 이미지 | Place Photos                                          | Place Details Photos SKU | lazy load, server proxy |
| description      | Place Details `editorialSummary` / summary 계열       | Enterprise + Atmosphere  | 선택 장소에만 호출      |
| 리뷰 원문        | `places.reviews`                                      | Enterprise + Atmosphere  | 제외                    |
| 리뷰 요약        | `places.reviewSummary`                                | Enterprise + Atmosphere  | 제외                    |

### Pricing snapshot

Research snapshot from Google pricing docs:

| SKU                                   |    Free cap | Price after cap |
| ------------------------------------- | ----------: | --------------: |
| Text Search Pro                       | 5,000/month |     $32 / 1,000 |
| Text Search Enterprise                | 1,000/month |     $35 / 1,000 |
| Text Search Enterprise + Atmosphere   | 1,000/month |     $40 / 1,000 |
| Place Details Photos                  | 1,000/month |      $7 / 1,000 |
| Place Details Enterprise + Atmosphere | 1,000/month |     $25 / 1,000 |

Interpretation:

- Moving search from Text Search Pro to Enterprise is a small per-search delta (`$32` → `$35` per 1,000) but lowers the free cap.
- The larger cost risk is extra per-session calls:
  - lazy-loaded photo requests,
  - selected-place description request.
- Therefore v1 controls cost through explicit search, result cap 10, lazy photo loading, selected-only description, and server-side rate/budget limits.

## Photo Policy

Google Place Photos docs warn:

- A `photo name` cannot be cached.
- It can expire.
- `authorAttributions` must be shown where required.

v1 policy:

- The server owns photo proxying.
- Mobile never receives or uses the Google Places API key.
- Search response may include a short-lived, signed `photoToken` plus attribution display data.
- Mobile requests images only through our authenticated photo endpoint.
- Photo tokens/images are not stored long-term in DB or cross-session cache.
- Mobile lazy-loads only visible/selected cards.
- Image failures fall back to category-colored placeholders.

## Cost Controls

- Default search limit: 10.
- API maximum search limit: 10.
- No auto-search on map pan/zoom.
- `이 지역에서 다시 검색` is explicit.
- Current-location move does not automatically search.
- Representative image: 1 per place maximum.
- Images are visible/selected-card lazy loads only.
- Description is selected-place-only.
- Server validates auth/participant context for search/details/photos.
- Server enforces size constraints for photo endpoint.
- Server may add per-user/per-trip/per-IP rate limits or daily budget guardrails.

## Scope

### In Scope

- API contract changes for map-biased search, rich search result metadata, selected details, and photo proxy.
- Server provider/service/handler changes for Google Text Search, Place Details, and Place Photos.
- Generated Go server and TypeScript client updates.
- Mobile map-first place search screen.
- Marker/list selection synchronization.
- Lazy representative image loading.
- Selected-only description loading.
- Current location button with permission handling.
- Manual map-region re-search button.
- Existing add-place persistence/duplicate confirmation flow preservation.
- Place-backed schedule title/memo/time persistence needed by the develop 일정 상세 입력 flow.

### Out of Scope

- Address display in result cards.
- Review bodies or review summaries.
- Saved counts.
- Multiple photos/gallery.
- Long-term Google photoName/image caching.
- Persisting rating/photo/description metadata.
- Automatic map-pan search.
- Autocomplete or Nearby Search migration.
- Global place management.

## API Contract

### Search Google Places

Existing endpoint remains:

```text
GET /trips/{tripId}/days/{tripDayId}/places/google/search
```

Add optional location bias params. Exact shape can be one of:

```text
latitude=<number>&longitude=<number>&radiusMeters=<number>
```

or an equivalent viewport representation if implementation chooses rectangle bias.

Rules:

- `limit` default becomes 10 for the new mobile UX.
- `limit` max remains 10.
- `radiusMeters` is clamped/validated according to Google Text Search constraints.
- Search without bias remains valid.

Response schema extends `GooglePlaceSearchResult`:

```yaml
GooglePlaceSearchResult:
  required:
    - googlePlaceId
    - displayName
    - primaryType
    - latitude
    - longitude
  properties:
    googlePlaceId: string
    displayName: string
    primaryType: string
    primaryTypeDisplayName: string?
    latitude: number
    longitude: number
    rating: number?
    userRatingCount: integer?
    openNow: boolean?
    googleMapsUri: string?
    photo:
      type: object?
      properties:
        token: string
        widthPx: integer?
        heightPx: integer?
        authorAttributions: array
```

`formattedAddress` may remain in the API response for backward compatibility/add fallback, but mobile result cards should not render it.

### Selected Place Details

Add endpoint:

```text
GET /trips/{tripId}/days/{tripDayId}/places/google/{googlePlaceId}/details
```

Response:

```yaml
GooglePlaceDetailsResponse:
  required:
    - googlePlaceId
  properties:
    googlePlaceId: string
    description: string?
```

Rules:

- Requires authenticated trip participant.
- Validates trip/day like search.
- Uses server Google Places key.
- Fetches description only for selected place.
- Maps missing description to `description: null`/omitted without failing the detail view.

### Photo Proxy

Add endpoint:

```text
GET /trips/{tripId}/days/{tripDayId}/places/google/photos/{photoToken}
```

Rules:

- Requires authenticated trip participant.
- Validates token expiry/signature/context.
- Enforces max width/height constraints suitable for thumbnails.
- Proxies or redirects the Google Place Photo response.
- Does not expose Google API key.
- Does not long-term cache `photoName` or image bytes.
- Returns a placeholder-safe error when invalid/expired/unavailable.

## API Server Requirements

- Extend `place.SearchInput` and `ProviderSearchInput` with optional location bias.
- Extend Google provider Text Search request body with `locationBias` when supplied.
- Prefer `languageCode=ko` for result display where safe.
- Extend provider response parsing for:
  - `location.latitude` / `location.longitude`
  - `primaryTypeDisplayName.text`
  - `rating`
  - `userRatingCount`
  - `currentOpeningHours.openNow`
  - `googleMapsUri`
  - first representative `photos[]` metadata and attribution
- Do not drop otherwise valid search results just because optional rating/open/photo fields are missing.
- Add Place Details provider method for selected description.
- Add Place Photo provider method or proxy function for token-backed image retrieval.
- Keep existing provider error mapping:
  - rate limit → 429
  - provider unavailable → 502
  - not found/forbidden/auth unchanged

## Mobile Requirements

- Use `react-native-maps` for the in-app map.
- Use existing `expo-location` permission pattern for current-location button.
- Use existing design tokens and shared components where possible.
- Introduce focused helper/view-model logic under `apps/mobile/lib/places` or adjacent trip-ui helpers.
- Screen file should orchestrate route params, API calls, map events, navigation, and composition.
- Result card should omit address.
- Marker and card selection should stay in sync.
- Lazy-load images only for visible/selected cards.
- Show required photo attribution where an image is displayed.
- Use category placeholder on missing/failing image.
- Preserve duplicate confirmation and return navigation.

### Google basemap note

`react-native-maps` already exists. If product requires Google basemap consistently on iOS/Android, implementation may need restricted Google Maps SDK keys in Expo config. These keys are separate from the server-only Google Places API key and must be platform-restricted.

## Acceptance Criteria

- [ ] AC-01: The add-place search screen renders an in-app map and bottom sheet result list.
- [ ] AC-02: Search defaults to and caps at 10 results.
- [ ] AC-03: Search can include map-region location bias and only re-searches on explicit submit / `이 지역에서 다시 검색`.
- [ ] AC-04: Results with coordinates are shown as category-aware map markers.
- [ ] AC-05: Tapping a result card selects the place, highlights the marker, centers the map, expands/updates the selected card inline in the result list, and keeps the current sheet size.
- [ ] AC-05a: Tapping a marker selects the place, highlights the marker, centers the map, opens the sheet to middle, and scroll-focuses the result list to the selected card.
- [ ] AC-06: Cards show representative image, place name, Korean category, rating, review count, and optional open/closed status; cards do not show address.
- [ ] AC-07: Representative images are loaded lazily through the server photo endpoint and fall back gracefully.
- [ ] AC-08: Required photo attribution is shown with images.
- [ ] AC-09: Description is fetched only for selected place, not for every search result.
- [ ] AC-10: Review bodies, review summaries, saved count, and multiple images are not displayed.
- [ ] AC-11: Current-location button handles permission grant/denial without auto-searching.
- [ ] AC-12: Existing add-place schedule persistence, duplicate confirmation, auth/not-found/provider error handling, and return navigation continue to work.
- [ ] AC-13: OpenAPI, generated clients, API tests/build, mobile tests/typecheck, and generated verification pass.

## Regression Test Plan

| Behavior / AC                                      | Layer               | Test File / Gate                                            | Command                                  |
| -------------------------------------------------- | ------------------- | ----------------------------------------------------------- | ---------------------------------------- |
| Contract response/endpoints                        | OpenAPI/generated   | generated diff verification                                 | `pnpm generate && pnpm verify:generated` |
| Text Search FieldMask/locationBias/result metadata | API provider        | `apps/api/internal/place/google_provider_test.go`           | `pnpm --filter @i-um/api test`           |
| Search service validation/default limit/auth/day   | API service/server  | `apps/api/internal/place`, `apps/api/internal/server` tests | `pnpm --filter @i-um/api test`           |
| Selected description endpoint                      | API provider/server | provider/server tests                                       | `pnpm --filter @i-um/api test`           |
| Photo token/proxy endpoint                         | API provider/server | provider/server tests                                       | `pnpm --filter @i-um/api test`           |
| Search card labels/no-address/optional metadata    | Mobile helper       | `apps/mobile/lib/places/google-search.test.mts`             | `pnpm --filter @i-um/mobile test`        |
| Marker/list selection and map re-search state      | Mobile helper       | new/updated mobile helper tests                             | `pnpm --filter @i-um/mobile test`        |
| Screen type integration                            | Mobile              | TypeScript                                                  | `pnpm --filter @i-um/mobile typecheck`   |
| Final repo gate                                    | Whole repo          | generated/lint/test/typecheck/build                         | `pnpm verify`                            |

## Regression Gaps

- Live Google field availability varies by place/region.
  - Risk: rating/open status/photo/description may be missing for some results.
  - Mitigation: optional-field omission and placeholders are required and tested.
- Billing impact cannot be proven by unit tests.
  - Risk: rich search/photo/description can increase usage cost.
  - Mitigation: explicit search, limit 10, lazy photos, selected-only description, server rate/budget guardrails.
- Exact map SDK provider behavior may differ by platform and key configuration.
  - Risk: default native map may not be Google basemap until platform keys are configured.
  - Mitigation: document key requirement and smoke on internal build.
- Photo caching/compliance needs careful implementation.
  - Risk: accidentally persisting `photoName` or image bytes too long.
  - Mitigation: token TTL/no long-term caching requirements and tests for cache headers/token expiry.

## Implementation Plan Summary

1. Contract/API first:
   - Extend OpenAPI search params/results.
   - Add selected details endpoint.
   - Add photo proxy endpoint.
   - Generate clients/server types.
2. API TDD:
   - Provider FieldMask/locationBias/metadata tests.
   - Details mapping tests.
   - Photo token/proxy validation tests.
   - Server handler/auth/error tests.
3. Mobile TDD:
   - Pure helper tests for result card view models, markers, selection state, map dirty/research, image lazy state, and selected inline description state.
4. Mobile UI:
   - Replace place-search screen with map + bottom sheet.
   - Connect explicit search, current location, re-search, marker/card selection, image lazy load, selected inline expansion, and existing add flow.
5. Verification:
   - Generated checks, API tests/build, mobile tests/typecheck, harness validation, final repo verify.

## Open Questions

None for v1. Future follow-ups may revisit review summaries, saved counts, full place detail page, or Autocomplete/Nearby Search if usage data justifies them.
