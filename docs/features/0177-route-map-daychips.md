# Feature Slice: 지도 탭 RouteMap·DayChips 이관

## Metadata

- GitHub Issue: #177
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #177 — [Mobile UI Refactor follow-up] 지도 탭 RouteMap·DayChips 이관
- Depends on: #175, #176 merged into `origin/develop`
- Ouroboros/PM/Seed: `interview_20260628_163633` / `seed_1bf39613cab9` (ambiguity 0.11)
- Current sources: `apps/mobile/app/trips/[tripId]/(tabs)/map.tsx`, `apps/mobile/lib/trip-ui/RouteMap.tsx`, `DayChips.tsx`, `apps/mobile/lib/trips/day-itinerary.ts`, `day-itinerary-map-actions.ts`, `trip-tabs.ts`

## Goal

지도 탭에서 Day를 route push 없이 인라인 선택하고, 선택한 Day의 유효한 routable 좌표를 `RouteMap` 핀/경로선으로 보여준다. 기존 장소 목록, `지도` 열기, `주소 복사` 액션과 feedback은 그대로 유지한다.

## User Flow

1. 사용자가 지도 탭을 연다.
2. 앱은 여행의 오늘 날짜 Day가 있으면 그 Day를, 없으면 첫 Day를 선택한다.
3. 사용자가 Day chip을 누르면 같은 탭에서 지도와 장소 목록이 선택 Day 기준으로 갱신된다.
4. 좌표가 있는 장소는 지도 핀/경로선으로 보이고, 좌표가 없는 장소도 목록과 기존 액션은 유지된다.

## Scope

- App UI: yes — update `apps/mobile/app/trips/[tripId]/(tabs)/map.tsx`
- Mobile helpers: yes — add/update view-model helpers for day chip selection and RouteMap input derivation
- API Contract/API Server/DB: no changes
- Tests: mobile helper tests for initial day resolution, day chips, routable marker derivation, status mapping
- Deploy/Smoke: dev/internal map smoke recommended later; not required for PR gate

## Out of Scope

- New map APIs, directions geometry, route optimization, distance/time estimation, geocoding, or provider-policy changes
- API/OpenAPI/server/DB/generated code changes
- Day detail route action changes outside this map tab
- Map marker tap ↔ list highlight/scroll synchronization
- Persisting last selected Day across app sessions
- Collapsing duplicate coordinates/places

## Requirements

### UI / UX

- Initial selected day: calendar-current trip day if present, otherwise the first trip day.
- If trip has zero days, hide DayChips and use the existing unavailable tab path with itinerary/detail actions.
- DayChips selection is local screen state and never pushes a route.
- On DayChip press, RouteMap and list content switch in place to the selected day.
- RouteMap receives only selected-day items with valid finite `routablePlace.latitude/longitude`.
- RouteMap draws no polyline with fewer than two valid coordinates.
- Schedule list renders all selected-day items in original order, including missing-coordinate/non-routable items.
- Existing row actions from `buildDayItineraryMapRowActions` remain the source of truth for map open/address copy labels, disabled state, URL, and feedback.
- Marker status maps existing item state: arrived → `done`, skipped → `skipped`, otherwise `todo`.
- Duplicate coordinates render as separate markers in itinerary order.
- No custom map interaction logic; native marker callout behavior is enough.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- `RouteMap` is presentational only. It must not request location permission, fetch routes, geocode, or own provider setup.
- Map fallback for selected Day with no valid coordinates should not hide the list.
- Existing Today/Itinerary/Day detail behavior remains unchanged.

## Acceptance Criteria

- [ ] Map tab opens with current calendar Day selected when available, otherwise first Day.
- [ ] Day chips switch map and list in place without route push.
- [ ] RouteMap markers include only valid selected-day routable coordinates and preserve duplicate itinerary items.
- [ ] No polyline is rendered unless at least two valid coordinates exist.
- [ ] Selected-day list still renders all schedule items and preserves existing map/copy actions and feedback.
- [ ] Selected Day with no valid coordinates shows RouteMap fallback while list remains visible.
- [ ] Trip with zero days uses existing unavailable path and hides DayChips.
- [ ] API/DB/generated code are unchanged.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Initial day and chip view-model resolution | Unit | `apps/mobile/lib/trips/trip-map.test.mts` | `pnpm --filter @i-um/mobile test` |
| Routable marker derivation/status/duplicates | Unit | `apps/mobile/lib/trips/trip-map.test.mts`, `day-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing map/copy actions unchanged | Unit | existing `day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Screen composition and RouteMap props compile | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- Native map rendering/provider smoke is not automated in this PR.
  - Risk: provider/API-key/dev-build configuration issues may appear on device.
  - Follow-up: internal/dev build smoke for #177 map tab after merge.
- Visual map/list alignment and marker overlap for duplicate coordinates is not snapshot-tested.
  - Risk: overlapping markers may require later visual affordance.
  - Follow-up: manual map smoke with duplicate and no-coordinate cases.

## TDD Implementation Plan

1. Red: add helper tests for selected-day resolution, DayChip generation, marker derivation, and coordinate filtering.
2. Green: update day itinerary view models to carry routable coordinates and status; add map tab helper functions.
3. Green: refactor map tab state to load trip days, resolve selected day, render `DayChips`, `RouteMap`, and existing list/actions for selected day.
4. Refactor: keep screen orchestration narrow and avoid new map/provider behavior.
5. Gate: run mobile tests, typecheck, lint/format, and raw-color grep for touched files.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (270 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/trips/[tripId]/(tabs)/map.tsx apps/mobile/lib/trips/trip-map.ts apps/mobile/lib/trip-ui/RouteMap.tsx`: pass (no matches)

### Manual Smoke

- Map tab current-day/first-day selection, Day switching, coordinate/no-coordinate cases: not run — native/device map smoke deferred to follow-up manual verification

## Release Notes

- Team-facing: 지도 탭이 DayChips와 RouteMap 기반으로 선택 Day의 지도 핀/동선을 보여주며 기존 지도/주소 복사 액션은 유지된다.

## Open Questions

- None.

## Follow-up Issues

- #178 — 일정 탭 DayChips·타임라인 전환
- #179 — 정산 탭 컴포넌트 기반 화면 구성
