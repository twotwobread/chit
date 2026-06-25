# Feature Slice: F-035 숙소로 이동 버튼

## Metadata

- GitHub Issue: #35
- Status: Code Review
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #35 — `[Feature Slice] F-035 숙소로 이동 버튼`
- Ouroboros/PM/Seed: interview `interview_20260625_135036`, ambiguity `0.08`, seed `seed_067ac1ec5c64` (MCP generated; file path not emitted)
- Notes: Today 실행 화면의 현재 Day에 Day-level `lodgingPlace` 기반 `숙소로 이동` action을 추가한다. 출발지는 앱에서 직접 계산하지 않고 Google Maps의 현재 위치 기본 동작을 사용한다. 대표 숙소가 없을 때는 버튼을 숨기지 않고 disabled button과 안내 문구를 보여준다.

## Goal

여행 중 사용자가 Today 화면에서 언제든지 현재 위치 기준으로 오늘 Day의 대표 숙소까지 Google Maps 길찾기를 열 수 있다.

F-035는 #30의 Day별 `lodgingPlace`를 실행 화면의 복귀 action으로 연결하는 mobile-only slice다. 숙소 지정/해제, 이전 장소 기준 origin, 이동 모드 선택, 인앱 경로 요약은 후속 또는 별도 feature 범위로 유지한다.

## User Flow

1. 사용자가 로그인된 상태로 Today 화면(`/`)에 진입한다.
2. 앱은 기존 Today 로딩 흐름으로 진행 중 여행, 현재 Today Day, Day itinerary를 불러온다.
3. 현재 Today Day가 resolve된 화면 상태(`emptyItinerary`, `success`, `completed`, `recoverNeeded`)에서는 Day action 영역 마지막에 `숙소로 이동` action block을 보여준다.
4. 현재 Day에 `lodgingPlace`가 있으면 `숙소로 이동` 버튼은 활성 상태다.
5. 사용자가 `숙소로 이동`을 누르면 앱은 `lodgingPlace.name + lodgingPlace.address`를 목적지로 Google Maps 길찾기를 연다.
6. 앱은 origin을 지정하지 않는다. Google Maps가 현재 기기 위치를 출발지로 해석한다.
7. Google Maps를 열 수 없으면 기존 Today navigation fallback처럼 Google Maps 설치 화면을 열고, 최종 실패 시 fallback panel을 보여준다.
8. 현재 Day에 `lodgingPlace`가 없으면 `숙소로 이동`은 disabled 상태로 보이고 `오늘 일정에서 대표 숙소를 지정하면 바로 이동할 수 있어요.` 안내 문구를 함께 보여준다.

## Scope

- App UI: Yes — `apps/mobile/app/index.tsx` Today/Home screen의 현재 Day action 영역.
- Mobile domain/helpers: Yes — `apps/mobile/lib/trips/today-execution.ts` view model에 lodging navigation action state 추가, 필요 시 작은 lodging/navigation helper 재사용 또는 추출.
- API Contract: No API changes. Existing `TripDay.lodgingPlace`를 사용한다.
- API Server: No server changes.
- DB: No DB changes.
- Tests: Mobile view-model/action tests, existing Google Maps navigation helper tests, mobile typecheck.
- Deploy/Smoke: Internal build 또는 simulator/emulator에서 Today 숙소 이동 버튼과 Google Maps handoff smoke.

## Out of Scope

- Day 대표 숙소 지정/해제 API/UI 변경 — #30 범위.
- trip-level lodging destination 도입. F-035는 Day-level `lodgingPlace`만 사용한다.
- Day itinerary 화면, trip detail Day lodging summary, place row, 장소 상세, 기타 map entry surface에 `숙소로 이동` 추가.
- 일정상 이전 장소, 진행 중 장소, 선택 Day의 마지막 확정 장소, 전날 숙소를 origin으로 지정하는 길찾기 — #37 또는 후속 범위.
- 다음 장소 카드의 `길찾기` 자체 — #36 범위이며 F-035는 동일 navigation helper를 재사용한다.
- 도보/자동차/대중교통 모드 선택 — #38.
- 장소별 지도 열기/주소 복사 surface 확장 — #39.
- 인앱 경로 지도, ETA, 환승/도보 단계, route summary — #120.
- 앱 내부 위치 권한 요청, 현재 위치 좌표 수집/저장, Google Directions/Routes API 연동.
- 숙소 좌표/provider place id 저장 또는 Google Maps precision 개선.
- optional time/timeline 기반 현재 일정 계산 변경 — #95.

## Requirements

### UI / UX

- Screens: `apps/mobile/app/index.tsx` Today/Home screen only.
- Resolved current-Day states:
  - `emptyItinerary`: 오늘 일정에 장소가 없어도 current Day가 있고 `lodgingPlace`가 있으면 `숙소로 이동`이 활성화된다.
  - `success`: 다음 장소 카드와 기존 Day actions를 유지하고 Day action 목록 마지막에 `숙소로 이동`을 추가한다.
  - `completed`: 오늘 일정을 모두 완료해 다음 장소 카드가 없어도 `lodgingPlace`가 있으면 `숙소로 이동`이 활성화된다.
  - `recoverNeeded`: 모든 미완료 장소가 skipped 상태여도 `lodgingPlace`가 있으면 `숙소로 이동`이 활성화된다. 스킵 복구 action을 강제하지 않는다.
- Non-day states:
  - 로그인 필요, 진행 중 여행 없음, current Day unavailable, retryable load error 상태에서는 `숙소로 이동` action block을 보여주지 않는다.
- Placement:
  - `숙소로 이동`은 해당 state의 기존 Day action 목록 마지막에 배치한다.
  - `다른 진행 중인 여행은 내 여행에서 볼 수 있어요.` 같은 cross-trip notice는 Day action이 아니므로 기존 위치/역할을 유지한다.
- Enabled state:
  - Current Day `lodgingPlace`가 있으면 active button label은 `숙소로 이동`이다.
  - Button tap opens Google Maps directions using the lodging destination.
- Disabled state:
  - Current Day `lodgingPlace`가 없으면 disabled button label은 `숙소로 이동`이다.
  - Disabled helper copy: `오늘 일정에서 대표 숙소를 지정하면 바로 이동할 수 있어요.`
  - Disabled button tap must not call external navigation.
- Duplicate destination:
  - 다음 장소가 이미 대표 숙소라서 다음 장소 카드의 `길찾기`와 `숙소로 이동`이 같은 destination을 열어도 두 action을 모두 노출한다.
  - 의미는 `길찾기` = 다음 일정 이동, `숙소로 이동` = Day 대표 숙소 복귀로 구분한다.
- External navigation:
  - 앱은 새 위치 권한을 요청하지 않는다.
  - 앱은 Google Maps URL에 explicit origin을 넣지 않는다.
  - Google Maps가 현재 기기 위치를 출발지로 해석한다.
  - Google Maps 앱을 열 수 없으면 기존 Today navigation helper의 install fallback을 사용한다.
  - 최종 실패/fallback panel copy는 기존 Today navigation 실패 UX를 재사용한다.
- Copy:
  - Button label: `숙소로 이동`
  - Disabled helper: `오늘 일정에서 대표 숙소를 지정하면 바로 이동할 수 있어요.`
  - Existing final navigation failure message: `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.`
- Accessibility:
  - Active and disabled controls use `accessibilityRole="button"`.
  - Disabled control exposes disabled accessibility state.
  - Tap target and spacing follow existing Today `ActionButton` pattern.
- Design guardrails:
  - `.pi/rules/mobile-ui.md` and `apps/mobile/lib/design/theme.ts` apply.
  - Use theme tokens for color, spacing, radius, typography, and shadow.
  - Do not add raw hex colors or emoji to product UI.
  - Keep route component focused on orchestration/rendering; put state mapping in `apps/mobile/lib/**` helpers.

### API Contract

`No API changes.`

F-035 uses existing day lodging data already available through the contract:

```yaml
TripDay:
  lodgingPlace: TripPlaceSummary | null
```

Implementation should use the resolved current Today Day's `lodgingPlace` from the existing Today data load. `GET /trips/{tripId}` `days[]` and `GET /trips/{tripId}/days/{date}/itinerary` `day` both expose the same Day lodging concept under the current contract; F-035 must not add another endpoint just to open lodging navigation.

Destination query uses the selected `TripPlaceSummary`:

```text
trim(lodgingPlace.name) + " " + trim(lodgingPlace.address)
```

If a future contract allows blank address, fall back to the trimmed lodging name only. Current `TripPlaceSummary.address` remains required.

### DB Changes

`No DB changes.`

F-035 reads existing Day lodging state and does not persist navigation events, current location, route choices, or travel mode.

### Business Rules

- `숙소로 이동` is a Today execution Day-level action, not a place row action.
- The destination is the current Today Day's `lodgingPlace` from #30.
- Day lodging is a return/stay target and does not imply the Day starts at lodging.
- The action is visible only when Today has a resolved current Day state: `emptyItinerary`, `success`, `completed`, or `recoverNeeded`.
- If `lodgingPlace` exists, `숙소로 이동` is enabled regardless of itinerary item count or progress state.
- If `lodgingPlace` is missing, the action remains visible but disabled with the approved helper copy.
- If the next pending itinerary item is the same place as `lodgingPlace`, keep both next-place `길찾기` and Day-level `숙소로 이동` visible.
- F-035 does not infer origin from in-progress, arrived, skipped, previous, or previous-Day itinerary/lodging data.
- F-035 does not send origin coordinates or place strings to Google Maps.
- F-035 does not request location permission; Google Maps owns current-location resolution.
- F-035 does not force travel mode; Google Maps owns default mode until #38 changes that.
- F-035 does not mutate itinerary items, lodging selection, trip places, arrival/skipped state, or expense state.
- F-035 does not create a new API/server/DB dependency when current contract data is sufficient.

## Acceptance Criteria

- [x] AC-01: `docs/features/0035-go-to-lodging-button.md` contains the F-035 feature spec and TDD implementation plan with Ouroboros interview/seed metadata.
- [x] AC-02: Today execution current-Day states (`emptyItinerary`, `success`, `completed`, `recoverNeeded`) render a `숙소로 이동` action block.
- [x] AC-03: Today non-day states (login needed, no ongoing trip, unavailable current Day, retryable load error) do not render the `숙소로 이동` action block.
- [x] AC-04: When current Day `lodgingPlace` exists, `숙소로 이동` is enabled and uses `lodgingPlace.name` + `lodgingPlace.address` as the Google Maps destination.
- [x] AC-05: Enabled `숙소로 이동` opens Google Maps directions without an explicit origin parameter so Google Maps uses current device location.
- [x] AC-06: The i-um app does not request location permission or collect current coordinates for F-035.
- [x] AC-07: When current Day `lodgingPlace` is null, `숙소로 이동` remains visible but disabled.
- [x] AC-08: Disabled lodging action shows `오늘 일정에서 대표 숙소를 지정하면 바로 이동할 수 있어요.` and does not launch external navigation.
- [x] AC-09: If the next-place `길찾기` destination and `숙소로 이동` destination are the same lodging place, both actions remain visible.
- [x] AC-10: In completed state, `숙소로 이동` remains enabled when `lodgingPlace` exists even though the next-place card is absent.
- [x] AC-11: In recoverNeeded state, `숙소로 이동` remains enabled when `lodgingPlace` exists even though skipped-place recovery actions are available.
- [x] AC-12: The `숙소로 이동` action is appended after the existing state-specific Day actions and before unrelated notices where applicable.
- [x] AC-13: Google Maps unavailable/failure behavior reuses the existing Today navigation install fallback/failure panel behavior.
- [x] AC-14: F-035 introduces no OpenAPI, generated client, API server, or DB migration changes.
- [x] AC-15: F-035 does not add lodging navigation to Day itinerary, trip detail, place rows, or other map-opening surfaces.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02, AC-04, AC-10, AC-11: resolved current-Day states with `lodgingPlace` expose an enabled lodging navigation action with label/destination | Mobile view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-03: non-day Today states do not expose lodging navigation action state | Mobile view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-07, AC-08: resolved current-Day states without `lodgingPlace` expose disabled action + helper and no runnable navigation action | Mobile view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-09: next-place `길찾기` and `숙소로 이동` can coexist with the same lodging destination | Mobile view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-05, AC-06, AC-13: Google Maps URL/helper keeps destination-only current-location behavior and install/failure fallback | Mobile navigation helper | `apps/mobile/lib/trips/today-navigation.test.mts`, `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-12: Today UI wiring compiles with lodging action block rendered after existing Day actions | Mobile type integration | Expo/TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| AC-14, AC-15: no contract/server/DB/surface expansion | Static review/generated drift | OpenAPI routes, migrations, mobile routes | `pnpm verify:generated`; code review |
| External app handoff for active lodging destination | Manual smoke | Internal build / simulator-emulator smoke | See Manual Smoke below |

## Regression Gaps

- Exact React Native visual placement is not fully covered unless a stable component render test harness is introduced.
  - Risk: View model is correct but the button appears in the wrong visual order on one Today state.
  - Follow-up: Cover by typecheck plus manual smoke for `emptyItinerary`, `success`, `completed`, and `recoverNeeded` states; add component tests if the project adopts a stable RN render harness.
- Actual OS handoff to Google Maps/App Store/Play Store cannot be fully proven by unit tests.
  - Risk: URL scheme or store deep link behaves differently on a specific OS/device configuration.
  - Follow-up: Manual smoke on iOS and Android internal builds before release.

## TDD Implementation Plan

1. Red: Add Today lodging navigation view-model tests.
   - Add failing cases in `apps/mobile/lib/trips/today-execution.test.mts` for `emptyItinerary`, `success`, `completed`, and `recoverNeeded` with `lodgingPlace`.
   - Expect a visible enabled action with label `숙소로 이동` and destination from lodging name/address.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Red: Add disabled and hidden-state tests.
   - Expect the same resolved current-Day states without `lodgingPlace` to expose disabled state and helper copy.
   - Expect no lodging action in no-ongoing-trip, unavailable, and retryable-error view models; login UI remains outside the view model and is verified by screen wiring/typecheck.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Add duplicate-destination and no-next-place tests.
   - In `success`, set next item to the same place as `lodgingPlace` and expect both next-place `길찾기` and lodging `숙소로 이동` actions.
   - In `completed` and `recoverNeeded`, expect lodging action to remain enabled without a next-place card.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: Extend Today view model minimally.
   - Add a lodging navigation action/view model type, e.g. enabled `{ kind: 'navigate', label: '숙소로 이동', destination }` or equivalent disabled state.
   - Build it from the resolved current Today Day `lodgingPlace` without a new API request.
   - Attach it to `emptyItinerary`, `success`, `completed`, and `recoverNeeded` models.
   - Keep existing next-place, arrival, skip, restore, quick expense, and itinerary actions unchanged.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Green: Reuse existing Google Maps navigation helper.
   - Use `apps/mobile/lib/trips/today-navigation.ts` destination-only directions behavior.
   - Do not add explicit origin, location permission, travel mode, or route API calls.
   - Confirm existing helper tests still cover URL and install/failure fallback; add assertions only if the lodging action needs a new destination-shaping helper.
   - Verify: `pnpm --filter @i-um/mobile test`
6. Green: Update Today screen UI.
   - Render the lodging action block in each resolved current-Day state after existing Day actions and before unrelated notices.
   - Active state calls the existing `navigate` action handler.
   - Disabled state shows the helper and does not call `onAction`.
   - Reuse existing ActionButton/button styles and theme tokens.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
7. Refactor: Keep route component small.
   - Move copy/state mapping to `apps/mobile/lib/trips/**` if screen code starts duplicating logic.
   - Keep Today navigation fallback generic so both `길찾기` and `숙소로 이동` share the same failure path.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
8. Gate: Run relevant gates before PR.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck && pnpm verify:generated`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass — 196 tests.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass — generated artifacts remained in sync.

### Manual Smoke

- Today current Day with lodging in success state shows active `숙소로 이동` and opens Google Maps: not run — implementation/internal build required.
- Today current Day with no lodging shows disabled `숙소로 이동` and helper copy: not run — implementation/internal build required.
- Today completed state with lodging still opens Google Maps: not run — implementation/internal build required.
- Today recoverNeeded state with lodging still opens Google Maps while restore actions remain available: not run — implementation/internal build required.
- Google Maps unavailable install fallback/failure panel: not run — implementation/internal build/device setup required.

## Release Notes

- Today 화면에서 오늘 Day의 대표 숙소가 있으면 `숙소로 이동`으로 Google Maps 길찾기를 바로 열 수 있습니다.
- 대표 숙소가 아직 없으면 Today 화면에서 숙소 지정 필요 안내를 보여줍니다.

## Open Questions

- None

## Follow-up Issues

- #30: Day별 숙소 장소 지정. F-035 depends on `TripDay.lodgingPlace` from this model.
- #36: 다음 장소 길찾기. F-035 reuses the destination-only Google Maps behavior.
- #37: 이전 장소 기준 길찾기. F-035 explicitly does not use previous/active places as origin.
- #38: 이동 모드 선택.
- #39: 장소 지도 열기/주소 복사.
- #95: 시간 선택 가능한 일정 항목/타임라인.
- #120: 인앱 경로 지도/요약.
- #121: 길찾기 실패 대체 행동.
