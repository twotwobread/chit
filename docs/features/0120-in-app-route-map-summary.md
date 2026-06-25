# Feature Slice: F-120 인앱 경로 지도/요약

## Metadata

- GitHub Issue: #120
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #120 — `[Feature Slice] F-120 인앱 경로 지도/요약`
- Ouroboros/PM/Seed: interview `interview_20260625_132042`, ambiguity `0.08`, seed `seed_a4517f4ae741`
- Notes: #36의 외부 Google Maps `길찾기`를 유지하면서, Today 다음 장소의 `도착했어요` action 근처에 현재 위치 기준 인앱 route preview를 추가한다. #37 이전 장소 origin 길찾기는 현재 위치 기반 실행 흐름에 맞지 않아 `not planned`로 닫았고, F-120은 이전 장소/숙소 origin을 사용하지 않는다.

## Goal

여행 중 사용자가 Today 화면에서 다음 장소로 이동하기 전에 이음 앱 안에서 대략적인 경로, 예상 소요 시간, 거리, 대중교통 요약을 확인한다. 상세 단계와 실제 내비게이션은 계속 Google Maps로 이어서 확인한다.

## User Flow

1. 사용자가 Today 화면에서 진행 중인 여행의 다음 장소 카드를 본다.
2. 앱은 현재 위치 권한을 확인하고, 다음 장소가 Google-backed routable place이면 서버에 route preview를 요청한다.
3. `도착했어요` 버튼 위 또는 근처의 compact route preview 카드에 지도 polyline, 예상 시간, 거리, `대중교통` mode label, coarse summary가 표시된다.
4. 사용자가 자세한 경로가 필요하면 기존 `길찾기`/`Google Maps에서 자세히` CTA를 눌러 Google Maps로 이동한다.
5. 사용자가 장소에 도착하면 `도착했어요`를 누르고, 앱은 기존 도착 처리 후 route preview state를 새 다음 장소 기준으로 clear/refresh한다.

## Scope

- App UI: Yes — `apps/mobile/app/index.tsx` Today success next-place/arrival area에 compact route preview card 추가, 위치 권한/unsupported/unavailable/retry states 추가.
- Mobile domain/helpers: Yes — route preview view model/state, location permission orchestration, session cache, API request mapping, map polyline presentation helper.
- Mobile dependencies/config: Yes — Expo-compatible location permission package and embedded map renderer를 추가한다. Map rendering key가 필요한 경우 제한된 map display key만 모바일에 사용하고, route provider key는 모바일에 두지 않는다.
- API Contract: Yes — routable Google-backed place metadata 노출, route preview endpoint 추가, manual place create endpoint deprecated/blocked policy 반영.
- API Server: Yes — route preview handler/service, server-side Google route provider abstraction, fake provider tests, manual create blocking/guard.
- DB: No new route/location persistence. Existing `trip_places` Google metadata columns from #94 (`provider`, `google_place_id`, `latitude`, `longitude`) are reused; SQL projections are expanded as needed.
- Tests: OpenAPI/generated, API service/provider/handler, mobile route preview state/cache/API mapping, Today view model/UI wiring typecheck, existing #36 Google Maps handoff regression.
- Deploy/Smoke: Staging API with provider secret + internal mobile build smoke on iOS/Android device where feasible.

## Out of Scope

- Turn-by-turn navigation, live navigation, step-by-step transit instructions, per-step walking/transit details inside i-um.
- User-selectable travel mode UI or persisted mode preference — #38.
- Previous place/lodging origin for Today route preview or directions — #37 is closed/not planned for this flow.
- Itinerary planning route preview between arbitrary Day items.
- Continuous foreground/background route refresh, live current-location dot, route deviation detection, ETA recalculation loops.
- Fare display, exact departure/arrival time promises, walking-time breakdown, route alternatives, route optimization.
- Persisting precise current location, route result, polyline, or route cache in DB or durable device storage.
- Client-side geocoding/address lookup for route preview.
- Backfilling existing legacy manual places to Google places.
- Richer external-navigation fallback taxonomy beyond the existing #36/#121 behavior.

## Requirements

### UI / UX

- Screens: `apps/mobile/app/index.tsx` Today/Home screen.
- Placement:
  - Show the route preview card in Today success state for the current next place, directly above or near the `도착했어요` button.
  - The preview must not push the primary destination and arrival actions into an unclear state; use a compact card.
- Happy state:
  - Display an embedded non-primary-interaction map area with origin marker, destination marker, route polyline, and viewport fitted to show the route.
  - Display total duration, total distance, mode label `대중교통`, and a coarse summary line.
  - If transit transfer count is available, show `환승 N회`; if unavailable, show a graceful mode-only summary such as `환승 정보 없음` without failing the card.
  - Show `Google Maps에서 자세히` or reuse the existing `길찾기` CTA for detailed navigation.
- Permission/loading states:
  - Before permission resolution, show a small loading/skeleton state: `경로 미리보기를 준비하고 있어요.`
  - If current-location permission is denied, unavailable, or times out, show an inline recoverable state and keep Google Maps handoff available.
  - Suggested permission copy: `현재 위치 권한이 필요해요.` / `권한을 허용하면 다음 장소까지의 예상 경로를 볼 수 있어요.`
- Unsupported place state:
  - Legacy manual places or places missing `routablePlace` show a clear unsupported state instead of attempting geocoding.
  - Suggested copy: `정확한 지도 장소가 필요해요.` / `Google 장소로 추가된 일정에서 경로 미리보기를 볼 수 있어요.`
- Provider/unavailable states:
  - Provider errors, timeout, no route, bad metadata, and map rendering failure show inline route preview unavailable state with `다시 시도`.
  - Suggested copy: `경로 미리보기를 불러올 수 없어요.` / `잠시 후 다시 시도하거나 Google Maps에서 자세히 확인해주세요.`
- Non-blocking behavior:
  - Preview loading/failure/unsupported states must not block `길찾기`, `도착했어요`, `지출 등록`, `오늘 일정 보기`, or retrying the Today data load.
  - On `도착했어요` success, clear the old preview immediately and fetch/reuse preview for the new next item only after the Today view model updates.
- Accessibility:
  - Retry and Google Maps controls use `accessibilityRole="button"`.
  - The map is decorative/summary-level for MVP; provide text summary so the route preview remains understandable without interacting with the map.

### API Contract

OpenAPI is updated before implementation.

#### Routable place metadata

Extend `TripPlaceSummary` with a nullable `routablePlace` object so clients can detect Google-backed route eligibility without geocoding text addresses.

```yaml
TripPlaceSummary:
  required:
    - id
    - name
    - placeType
    - address
    - routablePlace
  properties:
    routablePlace:
      allOf:
        - $ref: '#/components/schemas/RoutablePlace'
      nullable: true

RoutablePlace:
  type: object
  required:
    - provider
    - googlePlaceId
    - latitude
    - longitude
  properties:
    provider:
      type: string
      enum: [google]
    googlePlaceId:
      type: string
    latitude:
      type: number
      format: double
      minimum: -90
      maximum: 90
    longitude:
      type: number
      format: double
      minimum: -180
      maximum: 180
```

Manual legacy places return `routablePlace: null`.

#### Route preview endpoint

```text
POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/route-preview
```

Request:

```yaml
CreateRoutePreviewRequest:
  type: object
  required:
    - origin
  properties:
    origin:
      $ref: '#/components/schemas/GeoPoint'

GeoPoint:
  type: object
  required:
    - latitude
    - longitude
  properties:
    latitude:
      type: number
      format: double
      minimum: -90
      maximum: 90
    longitude:
      type: number
      format: double
      minimum: -180
      maximum: 180
```

Response:

```yaml
RoutePreviewResponse:
  type: object
  required:
    - itemId
    - mode
    - summary
    - map
    - generatedAt
  properties:
    itemId:
      type: string
    mode:
      type: string
      enum: [transit]
    summary:
      $ref: '#/components/schemas/RoutePreviewSummary'
    map:
      allOf:
        - $ref: '#/components/schemas/RoutePreviewMap'
      nullable: true
      description: Nullable only for summary-only fallback when provider summary succeeds but geometry is unavailable.
    generatedAt:
      type: string
      format: date-time

RoutePreviewSummary:
  type: object
  required:
    - durationSeconds
    - distanceMeters
    - summaryText
    - transferCount
  properties:
    durationSeconds:
      type: integer
      minimum: 0
    distanceMeters:
      type: integer
      minimum: 0
    summaryText:
      type: string
      description: Coarse Korean summary, e.g. 환승 1회 or 환승 정보 없음. Mobile derives the `대중교통` label from top-level mode=transit.
    transferCount:
      type: integer
      nullable: true
      minimum: 0

RoutePreviewMap:
  type: object
  required:
    - encodedPolyline
    - origin
    - destination
    - bounds
  properties:
    encodedPolyline:
      type: string
    origin:
      $ref: '#/components/schemas/GeoPoint'
    destination:
      $ref: '#/components/schemas/GeoPoint'
    bounds:
      $ref: '#/components/schemas/GeoBounds'

GeoBounds:
  type: object
  required:
    - northeast
    - southwest
  properties:
    northeast:
      $ref: '#/components/schemas/GeoPoint'
    southwest:
      $ref: '#/components/schemas/GeoPoint'
```

Endpoint behavior:

- Auth required; owner/member trip participants can request previews.
- `date` must be a valid virtual Day in the trip.
- `itemId` must belong to the selected Day and be the first pending item when called from Today; stale/non-first-pending targets return conflict.
- Destination must be Google-backed and have non-null routable metadata.
- Request `origin` must be current device location acquired by the mobile app after user permission. The server validates coordinate ranges but does not persist the origin.
- The server requests a single fixed mode: `transit`.
- The server proxies provider calls through a route-provider abstraction. Mobile never calls Google Routes/Directions directly.

Errors:

- `400 VALIDATION_ERROR`: invalid IDs/date/body/coordinates.
- `401 UNAUTHORIZED`: missing/invalid auth.
- `403 FORBIDDEN`: authenticated user is not a participant.
- `404 NOT_FOUND`: trip/day/item not found.
- `404 ROUTE_NOT_FOUND`: provider cannot find a route for the origin/destination/mode.
- `409 ROUTE_PREVIEW_STALE_ITEM`: target item is not the current first pending item.
- `409 ROUTE_PREVIEW_UNSUPPORTED_PLACE`: destination is legacy manual or missing routable metadata.
- `429 ROUTE_PROVIDER_RATE_LIMITED`: route provider rate limited.
- `502 ROUTE_PROVIDER_UNAVAILABLE`: route provider unavailable, timeout, or returned unusable required route data.
- `500 INTERNAL_ERROR`: unexpected error.

#### Manual place creation policy

F-120 codifies that newly added schedule places must be Google-backed to support map/route features.

- The mobile app must not expose manual place registration from Day itinerary or direct route access.
- The existing manual create endpoint `POST /trips/{tripId}/days/{date}/itinerary-items` should be marked deprecated and blocked for normal app use with a deterministic error such as `410 MANUAL_PLACE_CREATION_DISABLED`, while legacy manual rows remain readable.
- Existing legacy manual places are not deleted, merged, or backfilled in F-120.

### DB Changes

No new DB persistence is required for route preview.

- Reuse existing `trip_places` Google metadata from #94:
  - `provider`
  - `google_place_id`
  - `latitude`
  - `longitude`
- Expand SQL queries and repository/domain mapping so itinerary item place summaries can return `routablePlace` when the linked `trip_places` row is Google-backed.
- Do not add route result tables, current-location tables, route cache tables, polyline columns, or route history columns.
- Do not backfill manual rows.
- If an environment lacks #94 Google metadata migration, F-120 is blocked until that migration is present; do not create a second incompatible metadata model.

### Business Rules

- “다음 장소” remains the Today next pending place-backed itinerary item/schedule item. With the current contract, this is the first `arrivedAt === null` item sorted by order/rank.
- If #95 optional schedule times land before F-120 implementation, next-place selection should use the approved Today current/next schedule logic from #95/#31 and preserve F-120 route preview placement.
- Preview origin is current device location only. Do not use previous itinerary item, previous Day lodging, current Day lodging, or trip lodging as fallback origin.
- Destination route computation uses stored routable Google metadata, not `place.name + address` geocoding.
- Fixed MVP travel mode is transit/public transportation. F-120 does not add mode selection or mode persistence.
- Detailed route steps and live navigation are delegated to Google Maps through the existing external handoff.
- Preview state is tied to the current next item. Arrival success, next-item change, logout, trip/day change, or Today data reload clears stale preview state.
- Fetch policy:
  - Fetch when Today success view for a new next item becomes visible and current-location permission is granted.
  - Provide explicit retry.
  - On app foreground/screen focus, reuse session cache unless the next item changed or the user taps retry.
  - Do not continuously refresh on every location update.
  - Do not background refresh.
- Caching/privacy:
  - Client may cache only in memory for the current screen session, keyed by next item, destination routable metadata, mode, and a coarse/rounded origin bucket.
  - Server may optionally use short-lived process-memory cache keyed by coarse origin, destination, and mode; tests must not depend on cache hits.
  - No route preview result or precise current-location-derived data is persisted in DB or durable device storage.
- Manual place policy:
  - New user-facing schedule places must be Google-backed.
  - Legacy manual places remain visible/editable as existing data, but route preview is unsupported for them.
  - F-120 does not attempt to geocode manual text address or silently attach a Google place.

## Acceptance Criteria

- [ ] Today success state for a Google-backed next place shows a compact route preview card above or near `도착했어요`.
- [ ] On route preview success, the card renders origin marker, destination marker, route polyline, and fitted viewport in an embedded map.
- [ ] On route preview success, the card shows total duration, total distance, mode label `대중교통`, and a coarse route summary line.
- [ ] Transfer count is shown when provider data supports it; when unavailable, the card degrades to a clear mode-only/`환승 정보 없음` summary without failing.
- [ ] The preview card always keeps a Google Maps detailed navigation CTA available.
- [ ] The preview uses current device location as origin and never uses previous place/lodging origin.
- [ ] Location permission denied/unavailable/timeout shows an inline recoverable state and does not call the route preview endpoint.
- [ ] Provider errors, no-route responses, bad metadata, or timeouts show inline `경로 미리보기를 불러올 수 없어요.` state with `다시 시도` and preserve Today actions.
- [ ] Legacy manual or missing-routable-metadata destinations show `정확한 지도 장소가 필요해요.` unsupported state and do not trigger client-side geocoding.
- [ ] Existing `길찾기`, `도착했어요`, `지출 등록`, and `오늘 일정 보기` actions remain usable during preview loading/failure/unsupported states.
- [ ] `도착했어요` success clears stale preview for the arrived item and refreshes/reuses preview only for the new next item.
- [ ] Mobile route preview calls go through i-um API; no paid route provider key or direct route provider call is shipped in mobile code.
- [ ] API server uses a route-provider abstraction with deterministic fake-provider coverage.
- [ ] OpenAPI exposes `routablePlace` metadata and route preview request/response/error schemas before implementation.
- [ ] Newly surfaced schedule place registration is Google-backed only; manual direct registration is removed/blocked for normal app use while legacy rows remain readable.
- [ ] No DB or durable device persistence is added for current location, route preview result, route polyline, or route cache.
- [ ] Session cache avoids duplicate preview calls for the same next item, coarse origin bucket, destination, and mode within one Today view session.
- [ ] Existing #36 Google Maps external handoff and fallback behavior remains covered and unchanged except for optional CTA placement/copy reuse.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI includes `routablePlace`, route preview endpoint, schemas, and manual-create deprecation/block response | Contract/generated | `packages/api-contract/openapi.yaml`, generated Go/TS | `pnpm generate && pnpm verify:generated` |
| SQL/repository maps Google-backed itinerary places to `routablePlace` and legacy manual places to null | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Route preview service validates auth, participant, date, first-pending item, coordinate ranges, fixed transit mode, unsupported manual place, and no persistence | API service | `apps/api/internal/trip/*route*_test.go` or route domain tests | `pnpm --filter @i-um/api test` |
| Fake route provider maps success, no route, rate limit, unavailable/timeout, missing geometry summary-only fallback | API service/provider | `apps/api/internal/route/*_test.go` or equivalent | `pnpm --filter @i-um/api test` |
| Route preview handler maps 200/400/401/403/404/409/429/502 errors and never exposes provider key | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Manual create endpoint/screen is blocked or redirected for normal app use while legacy manual rows remain readable | API/mobile | server tests + mobile route/helper tests | `pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test` |
| Today view model exposes route-preview eligibility and preserves existing next-place/arrival/Google Maps actions | Mobile unit | `apps/mobile/lib/trips/today-execution*.test.mts` | `pnpm --filter @i-um/mobile test` |
| Route preview mobile helper maps permission/loading/success/unsupported/unavailable/retry states and request bodies | Mobile unit | New `apps/mobile/lib/trips/today-route-preview.test.mts` | `pnpm --filter @i-um/mobile test` |
| Session cache reuses same next item/coarse origin/destination/mode and clears on item change/arrival success | Mobile unit | `apps/mobile/lib/trips/today-route-preview.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing Google Maps handoff URL/store/failure fallback behavior remains unchanged | Mobile unit | `apps/mobile/lib/trips/today-navigation*.test.mts` | `pnpm --filter @i-um/mobile test` |
| Today screen composes route preview card without type/style regressions | Mobile typecheck | Expo/TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| Full generated/API/mobile gate before PR | All | generated/API/mobile | `pnpm verify` |

## Regression Gaps

- Real current-location permission prompt and OS settings flow cannot be fully proven by unit tests.
  - Risk: iOS/Android permission copy or blocked permission state differs from local test doubles.
  - Follow-up: internal build smoke on iOS/Android.
- Embedded map rendering, route polyline visual fit, and map SDK key restrictions require device/internal build verification.
  - Risk: map appears blank, route line is not visible, or Android/iOS map provider config differs.
  - Follow-up: internal build smoke with a known Google-backed itinerary place.
- Real Google route provider behavior, billing, field masks, rate limits, and staging secret wiring require staging smoke.
  - Risk: fake-provider tests pass while deployed provider config fails.
  - Follow-up: staging API smoke with provider secret and a controlled route.

## TDD Implementation Plan

1. Red: Contract and generated drift
   - Add OpenAPI schemas for `RoutablePlace`, `GeoPoint`, `GeoBounds`, `CreateRoutePreviewRequest`, `RoutePreviewResponse`, route summary/map schemas, and route provider error responses.
   - Add `routablePlace` as required nullable field on `TripPlaceSummary`.
   - Add `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/route-preview`.
   - Mark/block manual create endpoint policy in OpenAPI.
   - Verify: `pnpm generate && pnpm verify:generated`

2. Red: Repository/domain metadata projection
   - Add failing repository tests that Google-backed itinerary items/lodging summaries map provider, Google place id, latitude, and longitude into domain `TripPlaceSummary.RoutablePlace`, while manual rows map null.
   - Update SQL selects/repository/domain/server mappers minimally.
   - Verify: `pnpm --filter @i-um/api test`

3. Red: API route preview service and provider abstraction
   - Add fake route provider tests for success, summary-only missing geometry, unsupported manual destination, stale/non-first-pending item, no route, rate limit, provider timeout/unavailable, and coordinate validation.
   - Assert fixed transit mode and that no current location/route result persistence repository method exists or is called.
   - Verify: `pnpm --filter @i-um/api test`

4. Green: API implementation
   - Add route provider interface and Google provider implementation using server-side provider key and field masks for duration, distance, polyline/bounds, and coarse transit summary data.
   - Add service method that authorizes participant, validates Day/item/current first pending state, reads routable destination metadata, calls provider, and maps typed errors.
   - Add handler and server error mapping.
   - Add optional short-lived in-process cache only if implementation remains small; otherwise omit server cache for MVP.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`

5. Red/Green: Manual creation block
   - Add server/mobile tests that normal manual create attempts are blocked or redirected according to the OpenAPI policy, while existing manual rows still render in Day/Today and route preview marks them unsupported.
   - Remove or redirect direct manual screen route from normal mobile navigation.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test`

6. Red: Mobile route preview state/helpers
   - Add `apps/mobile/lib/trips/today-route-preview.test.mts` for permission states, eligibility, request mapping, response-to-view-model formatting, summary-only fallback, unsupported manual state, provider errors, retry labels, and cache clear/reuse behavior.
   - Verify: `pnpm --filter @i-um/mobile test`

7. Green: Mobile route preview helpers/client
   - Add generated client wrapper for route preview endpoint.
   - Add location permission/current-position adapter with injectable test doubles.
   - Add session cache keyed by next item, destination routable metadata, fixed `transit` mode, and coarse origin bucket.
   - Keep formatting/copy/state mapping outside the screen component.
   - Verify: `pnpm --filter @i-um/mobile test`

8. Green: Today UI integration
   - Add Expo-compatible location/map dependencies and permission copy/config.
   - Render compact route preview card in `apps/mobile/app/index.tsx` near `도착했어요`.
   - Render map marker/polyline happy path, summary-only fallback, permission-needed, unsupported, unavailable, loading, and retry states.
   - Preserve existing #36 `길찾기` behavior and arrival/quick expense/schedule actions.
   - Clear stale preview on arrival success and next item changes.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`

9. Refactor
   - Keep route preview API/provider/state mapping in small domain helpers (`apps/api/internal/route` or equivalent, `apps/mobile/lib/trips/today-route-preview.ts`).
   - Reuse theme tokens/shared primitives; avoid raw colors and heavy screen-local logic.
   - Keep provider-specific response parsing behind server provider abstraction.
   - Verify: targeted API/mobile tests and typecheck.

10. Gate and smoke
    - Verify generated artifacts and full regression gates.
    - Verify no route/current-location persistence migration was added accidentally.
    - Run staging provider smoke and internal build smoke before release.
    - Commands:
      - `pnpm generate`
      - `pnpm verify:generated`
      - `pnpm --filter @i-um/api test`
      - `pnpm --filter @i-um/api build`
      - `pnpm --filter @i-um/mobile test`
      - `pnpm --filter @i-um/mobile typecheck`
      - `pnpm verify`

## Verification Record

### Automated Regression

- `pnpm generate`: pass — via `pnpm verify:generated`.
- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.

### Manual Smoke

- Today route preview with real current location and Google-backed next place: not run — requires implementation + internal build.
- Permission denied/unavailable state: not run — requires implementation + internal build.
- Staging Google route provider secret/config: not run — requires implementation + staging deploy.
- Existing Google Maps detailed navigation CTA: not run — requires implementation + internal build regression smoke.

## Release Notes

- Today 화면에서 다음 장소로 이동하기 전 이음 앱 안에서 예상 이동 시간, 거리, 대중교통 요약, route map preview를 확인할 수 있게 한다.
- 상세 경로와 실제 내비게이션은 계속 Google Maps로 이어서 확인한다.
- 경로 기능의 정확도를 위해 새 일정 장소 등록은 Google-backed place 중심으로 정리하고, legacy manual 장소는 preview 미지원 상태로 안내한다.

## Open Questions

- None

## Follow-up Issues

- #38: 이동 모드 선택. F-120은 고정 `대중교통` mode만 사용한다.
- #95: 시간 선택 가능한 일정 항목/타임라인. F-120은 현재 Today next-place selection을 따르며, #95가 먼저 구현되면 그 selection helper를 재사용한다.
- Future: itinerary planning view에서 장소 간 route preview를 제공할지 별도 검토.
- Future: Google-backed place replacement/linking flow for legacy manual places, if users need to repair old data.
- Future: richer in-app route details, alternatives, fare, exact departure/arrival time, or live navigation if product direction expands beyond MVP.
