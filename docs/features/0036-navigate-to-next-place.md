# Feature Slice: F-036 다음 장소 길찾기

## Metadata

- GitHub Issue: #36
- Status: In Progress
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #36 — `[Feature Slice] F-036 다음 장소 길찾기`
- Ouroboros/PM/Seed: interview `interview_20260624_144346`, ambiguity `0.10`, seed `seed_2ca8f67025bf`
- Notes: Today 화면의 다음 장소 카드에 별도 `길찾기` 버튼을 추가하고, 버튼 탭 시 현재 위치에서 다음 장소까지 Google Maps 길찾기를 연다. 앱 내 경로 지도/요약은 후속 범위로 분리한다.

## Goal

여행 중 사용자가 Today 화면에서 다음 장소를 확인한 뒤, 이음 앱에서 위치 권한이나 경로 계산을 새로 거치지 않고 Google Maps 길찾기로 바로 이동한다.

## User Flow

1. 사용자가 Today 화면에서 진행 중인 여행의 다음 장소 카드를 본다.
2. 다음 장소 카드 안의 `길찾기` 버튼을 누른다.
3. Google Maps가 설치되어 있으면 현재 위치에서 다음 장소까지의 길찾기 화면이 열린다.
4. Google Maps가 설치되어 있지 않으면 iOS는 App Store, Android는 Play Store의 Google Maps 설치 화면으로 이동한다.

## Scope

- App UI: Yes — `apps/mobile/app/index.tsx` Today 다음 장소 카드에 `길찾기` 버튼 추가.
- Mobile domain/helpers: Yes — Today next-place view model/action and Google Maps directions/store fallback helper.
- API Contract: No API changes.
- API Server: No server changes.
- DB: No DB changes.
- Tests: Mobile unit tests for next-place action, directions URL building, and store fallback decision logic.
- Deploy/Smoke: Internal mobile build smoke on iOS/Android device or simulator/emulator where feasible.

## Out of Scope

- 이음 앱 내부 지도에 경로를 렌더링하는 기능 — follow-up #120.
- 이음 앱 내부 route summary, ETA, 대중교통 요약, 환승/도보 단계 표시 — follow-up #120.
- 도보/자동차/대중교통 등 이동수단 선택 UI — existing issue #38.
- 일정상 이전 장소/숙소를 origin으로 지정하는 길찾기 — existing issue #37.
- Google Directions/Routes API 연동, 외부 길찾기 API key/요금 처리 — follow-up #120에서 결정.
- API/server/DB/OpenAPI contract 변경 — F-036에는 없음; #120/#122에서 필요 시 다룸.
- 이음 앱의 신규 위치 권한 요청 — F-036에는 없음; #120에서 필요 여부 결정.
- 주소 복사 fallback — follow-up #121. 기존 Day itinerary row 주소 복사는 #39.
- 장소가 없는 schedule item 지원 — follow-up #122.

## Requirements

### UI / UX

- Screens: `apps/mobile/app/index.tsx` Today/Home screen.
- Success state:
  - Today next-place card displays the existing next place name, order, type, and address.
  - Add a dedicated button labeled `길찾기` inside the next-place card.
  - The whole next-place card must not become tappable; only the explicit button launches navigation.
- Non-success states:
  - Empty itinerary, completed itinerary, unavailable, retryable error, no ongoing trip, and login states do not show the `길찾기` button.
- External navigation:
  - Pressing `길찾기` opens Google Maps directions, not a Google Maps search results page.
  - The i-um app does not ask for location permission. Google Maps is responsible for resolving current location.
  - If Google Maps is unavailable, open the platform install page for Google Maps.
  - If even the install page cannot be opened, show a short failure message: `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.`
- Copy:
  - Button label: `길찾기`
  - Failure copy: `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.`
- Accessibility:
  - The `길찾기` control uses `accessibilityRole="button"`.
  - Button tap target follows existing Today action button sizing/padding patterns.

### API Contract

`No API changes.`

Existing `GET /trips/{tripId}/days/{date}/itinerary` already returns each `DayItineraryItem.place` with `name`, `address`, and `placeType`. F-036 uses `place.name + place.address` as the Google Maps destination query because the current contract has no coordinates or Google place id.

### DB Changes

`No DB changes.`

### Business Rules

- “다음 장소” means the next place-backed itinerary item/schedule item, not a raw `TripPlace`.
- With the current contract, the next place is the first pending itinerary item (`arrivedAt === null`) sorted by `itemOrder`.
- If optional schedule times from #95 exist before or during implementation, next-place selection should prefer current-time schedule logic for place-backed items, then fall back to `itemOrder` and arrival progress.
- Items without a place are excluded until a separate spec introduces non-place schedule items.
- Destination query is built from trimmed place name plus trimmed address. If address is blank in a future contract state, fall back to place name only.
- Do not pass an origin from i-um. Open Google Maps directions with destination only so Google Maps uses/resolves the user's current location.
- Do not force a travel mode. Google Maps owns mode choice and detailed route steps for this slice.
- Platform install fallback targets:
  - iOS: Google Maps App Store page (`id585027354`).
  - Android: Google Maps Play Store package (`com.google.android.apps.maps`).

## Acceptance Criteria

- [ ] Today success state with an eligible next place shows a separate `길찾기` button in the next-place card.
- [ ] Tapping `길찾기` opens Google Maps directions from current location to the next itinerary item destination using place name + address.
- [ ] The launch target is directions, not search results.
- [ ] The i-um app does not request new location permission for this flow.
- [ ] If Google Maps is unavailable, iOS opens the Google Maps App Store page and Android opens the Google Maps Play Store page.
- [ ] If external navigation and store fallback both fail, the user sees `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.`
- [ ] Empty itinerary, completed itinerary, unavailable, retryable error, no ongoing trip, and login states do not show the `길찾기` button.
- [ ] No OpenAPI, API server, generated client, or DB migration changes are made for this slice.
- [ ] The spec and implementation plan explicitly defer in-app route map/summary and transport-step detail to follow-up work.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Today success state exposes a `길찾기` action only for the next pending place-backed item | Mobile unit | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Empty/completed/error/no-trip states do not expose a navigation action | Mobile unit | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Google Maps directions URL uses destination name+address and no in-app origin/location permission | Mobile unit | New/updated helper test, e.g. `apps/mobile/lib/trips/today-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| iOS/Android unavailable-Google-Maps branches choose the platform store URL | Mobile unit | New/updated helper test, e.g. `apps/mobile/lib/trips/today-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| Today screen type integration remains valid | Mobile typecheck | Expo/TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| External app launch and store fallback work on devices | Manual smoke | Internal build / simulator-emulator smoke | See Manual Smoke below |

## Regression Gaps

- Actual OS handoff to Google Maps/App Store/Play Store: cannot be fully proven by unit tests because it depends on device-installed apps and platform store availability.
  - Risk: URL scheme or store deep link behaves differently on a specific OS version.
  - Follow-up: Manual smoke on iOS and Android internal builds before release.

## TDD Implementation Plan

1. Red: Add mobile unit tests for the Today view model.
   - Expect a Today success view model to include a next-place navigation action with label `길찾기` for the first pending item.
   - Expect completed, empty, unavailable, retryable error, no-ongoing-trip, and login-rendered states to have no navigation action.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Green: Extend `apps/mobile/lib/trips/today-execution.ts` minimally.
   - Add a Today navigation action type for the next place.
   - Attach it to `TodaySuccessViewModel.nextPlace` or a sibling action in the success model.
   - Keep existing arrival and schedule-opening actions unchanged.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Add helper tests for Google Maps directions and install fallback.
   - Cover destination query encoding from place name + address.
   - Cover address-blank fallback to place name only.
   - Cover iOS Google Maps URL and App Store target.
   - Cover Android Google Maps URL and Play Store target.
   - Cover final failure feedback when neither Google Maps nor store fallback can open.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: Implement a small mobile helper for external navigation.
   - Prefer an injectable helper signature so tests do not call real `Linking`.
   - Use Google Maps directions URL/scheme with destination only; do not include an i-um-origin coordinate or request location permission.
   - If Google Maps cannot open, open platform store URL.
   - Return or throw a typed failure state for the UI to display the failure copy.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Red: Add/adjust screen-level behavior tests only if the existing test setup supports it; otherwise keep UI wiring covered by typecheck and helper/view-model unit tests.
   - Verify: `pnpm --filter @i-um/mobile test`
6. Green: Update `apps/mobile/app/index.tsx` Today UI.
   - Render a `길찾기` button inside the next-place card.
   - Handle the new navigation action through the helper.
   - Show failure copy when both Google Maps and store fallback fail.
   - Preserve `도착했어요` and `오늘 일정 보기` behavior.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
7. Refactor: Reuse existing theme tokens and action button patterns; keep URL building outside the screen component.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
8. Gate: Run the relevant mobile gates before PR.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass — 163 tests.
- `pnpm --filter @i-um/mobile typecheck`: pass.

### Manual Smoke

- iOS with Google Maps installed: not run — requires device/internal build smoke.
- Android with Google Maps installed: not run — requires device/internal build smoke.
- iOS without Google Maps opens App Store: not run — requires device/internal build smoke.
- Android without Google Maps opens Play Store: not run — requires device/internal build smoke.

## Release Notes

- Today 화면의 다음 장소 카드에서 `길찾기`를 눌러 Google Maps 길찾기로 바로 이동할 수 있게 한다.
- Google Maps가 설치되어 있지 않으면 플랫폼 스토어의 Google Maps 설치 화면으로 안내한다.

## Open Questions

- None

## Follow-up Issues

- #37: 이전 장소 기준 길찾기.
- #38: 이동 모드 선택.
- #95: 시간 선택 가능한 일정 항목/타임라인. F-036은 #95가 도입되기 전까지 순서/도착 상태 기준을 사용한다.
- #120: 인앱 경로 지도/요약.
- #121: 길찾기 실패 대체 행동.
- #122: 장소 없는 일정 항목 지원.
- #39: 장소 지도 열기/주소 복사. 이미 존재하는 Day itinerary row 동작이며, F-036의 Today 실패 fallback은 #121에서 별도 판단한다.
