# Feature Slice: F-310 한국 여행지 Naver Maps 길찾기 handoff

## Metadata

- GitHub Issue: #310
- Status: Approved
- Created: 2026-07-15
- Source run: `.harness/runs/20260715-issue-310-naver-maps-korea`

## Goal

Google Maps에서 국내 자동차/도보 길찾기 handoff가 신뢰 가능하지 않은 문제를 해결하기 위해, 여행 목적지가 한국으로만 구성된 여행의 Today 길찾기/숙소 이동은 Naver Maps 앱 길찾기로 연동한다.

비한국/혼합/판정 불가 여행은 기존 Google Maps 동작을 유지한다. 이번 구현은 외부 앱 URL handoff만 사용하며 Naver Cloud Maps SDK/API, 서버 경로 계산, 유료 API 연동을 도입하지 않는다.

## Scope

### In

- Mobile Today/Home 다음 장소 `길찾기` action의 외부 지도 provider 선택.
- Mobile Today/Home `숙소로 이동` action의 동일 provider 선택.
- `trip.destinations[].countryCode`가 모두 `KR`인 여행을 한국 여행으로 판정.
- 한국 여행이고 대상 장소에 `routablePlace.latitude/longitude`가 있으면 Naver Maps route URL scheme 사용.
- Naver Maps route mode mapping:
  - `transit` → `public`
  - `walking` → `walk`
  - `driving` → `car`
- Naver Maps app open 실패 시 플랫폼별 Naver Maps store URL fallback.
- Naver route에 필요한 좌표가 없는 legacy/manual 장소는 기존 Google Maps destination-only 길찾기로 fallback.
- URL/deep-link helper tests and Today view-model/provider-selection tests.

### Out

- Naver Cloud Maps SDK/API, paid Directions API, API key setup, or server-side route calculation.
- In-app navigation, ETA/distance/route-step calculation, or CarPlay integration inside i-um.
- Day itinerary row `지도`, edit panel `지도에서 보기`, 지도 탭, or bookmark map actions.
- API contract, generated client, DB schema, or migration changes.
- Provider chooser UI or per-user map-provider setting.

## Requirements

- A trip with at least one destination and every `trip.destinations[].countryCode` equal to `KR` is classified as `naverMaps` for Today navigation.
- A trip with any non-KR destination, no destinations, or missing/blank country code is classified as `googleMaps`.
- In a KR trip, Today next-place `길찾기` action carries provider `naverMaps`, selected travel mode, and destination coordinates when the next place has `routablePlace`.
- In a KR trip, `숙소로 이동` carries provider `naverMaps`, selected travel mode, and lodging coordinates when the lodging place has `routablePlace`.
- Naver route URLs use no i-um origin and map `transit`, `walking`, `driving` to Naver route modes `public`, `walk`, `car` respectively.
- If `naverMaps` is requested but destination coordinates are unavailable, the launcher falls back to existing Google Maps destination-only directions rather than constructing an invalid Naver route.
- If Naver Maps directions cannot be opened, the launcher opens the platform Naver Maps install/store page; if that also fails, existing failure copy `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.` is returned.
- Existing Google Maps URL behavior for non-KR trips remains unchanged, including travel-mode mapping and Google install fallback.
- No API contract, generated client, server, DB, Naver Cloud SDK/API, or paid route API changes are made.

## Implementation notes

- Use structural `countryCode` data already present on `GetTripDetailResponse.trip.destinations`.
- Use `TripPlaceSummary.routablePlace.latitude/longitude` for Naver route destination coordinates.
- Keep Google destination query behavior unchanged: trimmed `placeName + address`, no origin.
- Add provider to `TodayNavigateAction` instead of inferring provider inside the controller at tap time; this keeps state/view-model tests deterministic.
- Preserve selected travel-mode selector semantics from F-038.
- Use a constant Naver URL appname derived from the app identity (`com.twotwobread.ium`) unless platform config later provides a runtime bundle id.

## Acceptance Criteria

- [ ] AC-01: KR-only trips resolve Today navigation provider to `naverMaps`.
- [ ] AC-02: Non-KR, mixed, empty, or unknown destination sets resolve to `googleMaps`.
- [ ] AC-03: KR Today next-place `길찾기` uses Naver provider and coordinates when available.
- [ ] AC-04: KR `숙소로 이동` uses Naver provider and coordinates when available.
- [ ] AC-05: Naver route URL maps `transit/public`, `walking/walk`, and `driving/car` correctly.
- [ ] AC-06: Naver route URL includes destination latitude, longitude, destination name, and appname; it does not use i-um origin.
- [ ] AC-07: Missing coordinates fall back to existing Google Maps destination-only directions.
- [ ] AC-08: Naver app open failure falls back to Naver Maps store URL, then existing failure copy.
- [ ] AC-09: Non-KR Google Maps behavior remains unchanged.
- [ ] AC-10: No API/DB/generated/server/Naver Cloud paid API changes.
- [ ] AC-11: Automated mobile tests cover provider selection, URL mapping, Today action threading, fallback, and regression behavior.
- [ ] AC-12: Manual iOS/Android Naver Maps route smoke is recorded; CarPlay is noted as a manual environment gap if not available.

## Test Plan

- `pnpm --filter @i-um/mobile test`
- `pnpm --filter @i-um/mobile typecheck`
- Manual smoke: iOS/Android with Naver Maps installed, KR trip with coordinates, `자동차` selected, tap `길찾기`, verify Naver Maps opens route/navigation entry.
