# Feature Slice: F-038 이동 모드 선택

## Metadata

- GitHub Issue: #38
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #38 — `[Feature Slice] F-038 이동 모드 선택`
- Ouroboros/PM/Seed: interview `interview_20260625_132635`, ambiguity `0.07` (seed metadata `0.066`), seed `seed_70a34a3107ea`
- Notes: F-038은 현재 배포 범위를 모바일 Today/Home의 기존 `길찾기` 흐름으로 제한하되, 후속 #120 인앱 경로 지도/요약이 재사용할 travel-mode enum, 기본값, device-local persistence semantics를 함께 확정한다.

## Goal

여행 중 사용자가 Today 화면의 다음 장소로 이동하기 전에 `대중교통`, `도보`, `자동차` 중 원하는 이동 모드를 고르고, 선택한 모드로 Google Maps 길찾기를 바로 열 수 있게 한다.

동시에 후속 #120 인앱 경로 지도/요약이 다시 정의하지 않아도 되는 공통 travel-mode model을 모바일 클라이언트에 만든다.

## User Flow

1. 사용자가 모바일 앱의 Today/Home 화면에서 진행 중인 여행의 다음 장소 카드를 본다.
2. 다음 장소 카드 안에서 `대중교통`, `도보`, `자동차` segmented selector를 본다.
3. 첫 사용 또는 저장값이 없으면 `대중교통`이 선택되어 있다.
4. 사용자가 원하는 이동 모드를 탭하면 선택 상태가 즉시 바뀐다.
5. 사용자가 `길찾기`를 누른다.
6. 앱은 다음 장소 destination-only Google Maps directions를 열고, 가능한 경우 선택한 이동 모드 parameter를 함께 전달한다.
7. 선택한 이동 모드는 device-local 저장소에 저장되어 다음 Today `길찾기`와 후속 #120에서 재사용된다.

## Scope

- App UI: Yes — `apps/mobile/app/index.tsx` Today/Home next-place card의 `길찾기` action 주변에 inline segmented selector 추가.
- Mobile domain/helpers: Yes — shared travel-mode enum/default/labels/persistence helper, Today view model/action wiring, Google Maps launcher mode parameter mapping.
- API Contract: No API changes.
- API Server: No server changes.
- DB: No DB changes.
- Tests: Mobile unit tests for mode enum/default/storage behavior, Today view model visibility/action state, Google Maps URL/mode mapping, fallback behavior, and accessibility-facing selector state.
- Deploy/Smoke: Internal mobile build or simulator/device smoke for iOS/Android Google Maps handoff and local persistence.

## Out of Scope

- #120 인앱 경로 지도, route summary, ETA, 거리, 환승/도보 step 표시 구현.
- Google Directions/Routes API 연동, API key/요금/쿼터, route caching/storage 정책.
- 이음 앱이 origin을 계산하거나 현재 위치 권한을 요청하는 기능.
- 이전 장소/숙소를 origin으로 지정하는 길찾기. #37 코멘트에 따라 장소 간 이동 정보와 인앱 요약은 #120에서 다룬다.
- Day itinerary row의 `지도`/`주소 복사` 동작 변경. #39의 `지도`는 Google Maps search이며 F-038 directions mode selector와 분리한다.
- OpenAPI, API server, DB migration, generated client 변경.
- 계정/서버 동기화 travel-mode preference.
- Web/non-mobile product behavior 변경.
- 새 analytics/event tracking.
- 자전거, 택시, rideshare 등 추가 이동 모드.

## Requirements

### UI / UX

- Screens: `apps/mobile/app/index.tsx` Today/Home screen.
- Visibility:
  - Today success state에서 active next-place `길찾기` action이 있을 때만 selector를 표시한다.
  - Empty itinerary, completed itinerary, unavailable, retryable error, no ongoing trip, login-required 등 no-navigation state에서는 selector를 완전히 숨긴다.
  - Hidden state에 disabled selector나 placeholder copy를 노출하지 않는다.
- Placement:
  - Selector는 next-place card 안에서 다음 장소 정보와 `길찾기` button 사이 또는 `길찾기` button 바로 위에 배치한다.
  - 다음 장소 card 전체를 tappable로 바꾸지 않는다. 이동 모드 선택과 `길찾기`는 명시적 control로만 동작한다.
- Options and copy:
  - `대중교통` → canonical mode `transit`
  - `도보` → canonical mode `walking`
  - `자동차` → canonical mode `driving`
  - Existing `길찾기` button label은 유지한다.
  - Existing final failure copy `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.`는 유지한다.
  - Persistence write failure는 사용자에게 별도 error copy를 보여주지 않는다.
- Default and instant apply:
  - Valid persisted mode가 없으면 `대중교통`을 선택한다.
  - Segment tap은 별도 저장/적용 CTA 없이 즉시 current UI state와 다음 `길찾기` launch mode를 바꾼다.
- Accessibility:
  - Selector와 각 option은 React Native accessibility semantics로 label과 selected state를 전달한다.
  - 각 option의 visible label은 assistive tech에서도 구분되어야 한다.
  - 선택된 option은 `accessibilityState={{ selected: true }}` 또는 동등한 selected-state semantics를 제공한다.
  - 별도 custom announcement는 요구하지 않는다.
- Visual style:
  - Warm/calm Today screen style을 유지하고 `apps/mobile/lib/design/theme.ts` token 또는 shared primitive를 사용한다.
  - Raw hex color를 screen code에 추가하지 않는다.

### API Contract

`No API changes.`

Existing `GET /trips/{tripId}/days/{date}/itinerary` response already provides the next-place destination source through `DayItineraryItem.place.name` and `DayItineraryItem.place.address`. F-038 does not add coordinates, origin, provider place id, or route summary fields to the contract.

### DB Changes

`No DB changes.`

Travel-mode preference is stored only in mobile device-local app storage. It is not a server-side user preference.

### Business Rules

- Canonical shared enum is exactly:
  - `transit`
  - `walking`
  - `driving`
- Default mode is always `transit` / `대중교통` when:
  - no saved value exists,
  - saved value is invalid,
  - saved value cannot be read,
  - storage is corrupt,
  - the app is newly installed or running on a new device.
- Persistence scope is device-local only:
  - not synced by login account,
  - not shared across devices,
  - not guaranteed across reinstall.
- Persistence write failure rule:
  - Keep the newly selected mode in memory/current UI state.
  - Apply it to the current/next `길찾기` launch.
  - Do not block navigation.
  - Do not show a storage-error message.
  - On later screen/app reload, use the last successfully persisted valid mode if present, otherwise `transit`.
- F-038 preserves F-036 navigation contract:
  - destination is built from trimmed `place.name` + trimmed `place.address`, falling back to place name only if address is blank in a future contract state,
  - no i-um-provided origin,
  - no new location permission prompt,
  - Google Maps is responsible for current-location resolution,
  - existing Google Maps install/store/final failure behavior remains intact.
- Mode launch fallback order:
  1. Exact selected mode when the existing launch target supports a mode parameter.
  2. Generic destination directions without a mode parameter when exact mode cannot be honored by that target.
  3. Existing F-036 install/store fallback and final failure message if directions cannot be opened.
- The app must never silently substitute another explicit mode. Example: if `transit` cannot be encoded for a target, do not send explicit `driving`; use generic directions instead.
- Google Maps mapping guidance for implementation tests:

| Canonical mode | Label | iOS Google Maps scheme | Android existing navigation target | Web/generic directions target |
|---|---|---|---|---|
| `transit` | `대중교통` | `directionsmode=transit` if supported | exact mode only if supported; otherwise generic directions without explicit mode | `travelmode=transit` if web/generic URL is used |
| `walking` | `도보` | `directionsmode=walking` if supported | supported walking mode parameter such as `mode=w` | `travelmode=walking` if web/generic URL is used |
| `driving` | `자동차` | `directionsmode=driving` if supported | supported driving mode parameter such as `mode=d` | `travelmode=driving` if web/generic URL is used |

- Keep app-vs-web target strategy otherwise unchanged from F-036; F-038 adds selected-mode handling to the existing launcher rather than redesigning target selection.
- #120 must reuse the same shared mobile travel-mode enum, default, device-local persistence semantics, and storage/helper service. #120 may define its own UI placement, route summary presentation, origin/permission policy, API provider, and caching rules in its own spec.
- No analytics/event tracking is required or added in F-038.

## Acceptance Criteria

- [ ] F-038 defines shared travel-mode semantics while current ship scope remains mobile Today/Home `길찾기` only.
- [ ] The canonical mode enum is `transit | walking | driving` and labels are `대중교통 | 도보 | 자동차`.
- [ ] Today success state with an active next-place `길찾기` action shows an inline segmented selector in the next-place card.
- [ ] First use, missing storage, invalid storage, corrupt storage, new install, and new device all select `대중교통` by default.
- [ ] Tapping a segment immediately changes the selected UI state and determines the next `길찾기` launch mode without a separate save/apply CTA.
- [ ] Selected mode is persisted to device-local storage for later Today launches and future #120 reuse.
- [ ] If persistence write fails, the just-selected in-memory mode still applies to the current/next launch, navigation is not blocked, and no storage-error copy is shown.
- [ ] Empty itinerary, completed itinerary, unavailable, retryable error, no ongoing trip, login-required, and any no-navigation state do not render the selector.
- [ ] `길찾기` continues to open destination-only Google Maps directions using place name + address and does not request an i-um location permission.
- [ ] When the existing launch target supports the selected mode, the outbound Google Maps URL/deep link includes the exact selected mode parameter.
- [ ] When the launch target cannot honor the exact selected mode, the app opens generic destination directions without an explicit mode parameter rather than blocking.
- [ ] The app never substitutes a different explicit mode than the user selected.
- [ ] Existing F-036 install/store fallback and final failure copy remain unchanged when directions cannot be opened.
- [ ] Selector options expose accessible labels and selected-state semantics to assistive technology.
- [ ] No OpenAPI, API server, generated client, or DB migration changes are made.
- [ ] No new analytics/event tracking is added.
- [ ] #120 is documented as a required consumer of the same shared mobile travel-mode enum/default/persistence helper, without implementing #120 in this slice.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Canonical enum, labels, default `transit`, valid/invalid/corrupt storage read behavior | Mobile unit | `apps/mobile/lib/trips/travel-mode.test.mts` or equivalent shared settings helper test | `pnpm --filter @i-um/mobile test` |
| Persistence write failure keeps current in-memory selection and does not block launch intent | Mobile unit | `apps/mobile/lib/trips/travel-mode.test.mts` | `pnpm --filter @i-um/mobile test` |
| Today success state exposes travel-mode selector and navigate action with selected mode | Mobile view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Non-success/no-navigation states do not expose selector or travel-mode action | Mobile view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Google Maps directions URL/deep link includes exact supported mode parameters and preserves destination-only/no-origin behavior | Mobile unit | `apps/mobile/lib/trips/today-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| Unsupported exact mode falls back to generic destination directions without substituting another explicit mode | Mobile unit | `apps/mobile/lib/trips/today-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing install/store/final failure behavior remains unchanged after mode handling is added | Mobile unit | `apps/mobile/lib/trips/today-navigation.test.mts`, `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| Selector labels and selected-state semantics are exposed through a pure selector/view model helper or screen wiring where practical | Mobile unit/type | `apps/mobile/lib/trips/travel-mode.test.mts` plus screen typecheck | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Today screen integration compiles with travel-mode state/loading/writes and existing arrival/navigation fallback behavior | Mobile typecheck | Expo/TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| External app handoff and device-local persistence work on devices | Manual smoke | iOS/Android internal build or simulator/emulator | See Manual Smoke below |

## Regression Gaps

- Actual Google Maps mode honoring cannot be fully proven by unit tests because Google Maps app/web may interpret URL schemes differently by platform and version.
  - Risk: A platform may open directions but ignore the selected mode parameter.
  - Follow-up: Manual iOS/Android smoke before marking Done; #120 may revisit provider/API behavior for in-app summaries.
- React Native assistive-tech behavior cannot be fully proven by pure helper tests if no screen renderer is available.
  - Risk: Selected-state semantics may compile but need device VoiceOver/TalkBack confirmation.
  - Follow-up: Manual accessibility smoke for selector labels and selected state on internal build.

## TDD Implementation Plan

1. Red: shared travel-mode helper tests
   - Add failing tests for enum validation, Korean labels, default `transit`, valid saved value read, invalid/corrupt read fallback, and storage delete/cleanup if matching existing storage pattern.
   - Add failing tests for write success and write failure behavior: in-memory selected mode remains active even when persistence rejects.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Green: implement shared mobile travel-mode helper/service
   - Add a small helper such as `apps/mobile/lib/trips/travel-mode.ts` with `TravelMode = 'transit' | 'walking' | 'driving'`, labels, default, validator, injectable store interface, `readTravelModePreference`, and `saveTravelModePreference`/state reducer helpers.
   - Use an existing device-local storage mechanism/pattern; do not add backend sync.
   - Keep storage key/shape centralized so #120 can reuse it.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Today view model/action tests
   - Extend Today success-state tests to expect selector/options with selected `transit` by default or injected mode, accessible labels/selected state in the render model, and `navigationAction.travelMode` matching the current selection.
   - Expect empty/completed/error/no-trip states to have no selector or travel-mode action.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: extend Today domain/view model minimally
   - Thread selected travel mode into `buildTodayExecutionViewModel` or an adjacent Today action builder.
   - Add selector view model only in success state next-place card.
   - Preserve arrival, quick expense, remaining list, and `오늘 일정 보기` behavior.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Red: Google Maps launcher mode-mapping tests
   - Add failing tests for exact mode parameter mapping where supported, destination-only URLs, no origin parameter, no location permission dependency, generic no-mode fallback when selected mode is unsupported by the target, and no cross-mode substitution.
   - Keep existing F-036 install/store/final failure tests passing expectations.
   - Verify: `pnpm --filter @i-um/mobile test`
6. Green: update navigation launcher helper
   - Extend `apps/mobile/lib/trips/today-navigation.ts` to accept selected `TravelMode`.
   - Add selected-mode params to existing platform targets where supported.
   - Return or expose launch metadata in tests so exact-mode vs generic fallback can be asserted without real `Linking`.
   - Preserve install/store fallback and failure copy.
   - Verify: `pnpm --filter @i-um/mobile test`
7. Red: screen state/wiring tests where practical, otherwise rely on helper tests + typecheck
   - If existing test setup supports screen/component testing, assert selector rendering, tap updates selected mode, `길찾기` uses latest selected mode, and storage-write failure does not show user error.
   - If not practical, keep these covered by helper/view-model tests and TypeScript wiring.
   - Verify: `pnpm --filter @i-um/mobile test`
8. Green: update Today/Home screen UI
   - Read persisted travel mode on screen load/focus and initialize default `transit` for missing/corrupt values.
   - Render segmented selector inside next-place card only in success state.
   - On segment tap, update local state immediately and attempt device-local save.
   - Pass current selected mode to navigation launcher on `길찾기`.
   - Use theme tokens/shared primitives and accessibility selected-state semantics.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
9. Refactor: consolidate reusable setting for #120
   - Ensure storage key, enum, labels, default, and read/write helpers are not embedded inside `index.tsx`.
   - Ensure #120 can import the shared helper without depending on Today screen internals.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
10. Gate: final mobile verification before PR
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass — 194 tests including travel-mode preference, Today selector state, and Google Maps mode mapping coverage.
- `pnpm --filter @i-um/mobile typecheck`: pass.

### Manual Smoke

- iOS: selector default/persistence and each mode launch to Google Maps directions — not run; requires internal build or simulator/device smoke.
- Android: selector default/persistence and each mode launch to Google Maps directions — not run; requires internal build or simulator/device smoke.
- iOS/Android without Google Maps or failing deep link: existing install/store/failure behavior remains intact — not run; requires internal build or controlled simulator/emulator setup.
- VoiceOver/TalkBack selected-state semantics for `대중교통`, `도보`, `자동차` — not run; requires device/manual accessibility smoke.

## Release Notes

- Today 화면의 다음 장소 카드에서 `대중교통`, `도보`, `자동차` 이동 모드를 선택한 뒤 `길찾기`를 열 수 있게 한다.
- 마지막으로 선택한 이동 모드는 이 기기에 저장되어 다음 길찾기에서도 유지된다.
- 인앱 경로 지도/요약은 후속 #120에서 같은 이동 모드 설정을 재사용해 별도로 구현한다.

## Open Questions

- None

## Follow-up Issues

- #120: 인앱 경로 지도/요약. F-038의 shared travel-mode enum/default/persistence helper를 재사용해야 한다.
- #36: 다음 장소 길찾기. F-038은 #36의 destination-only Google Maps launch behavior 위에 mode selection만 추가한다.
- #39: 장소 지도 열기/주소 복사. F-038과 별개인 Google Maps search row action이다.
- #121: 길찾기 실패 대체 행동. F-038은 기존 F-036 fallback을 유지하고 fallback UX 자체를 확장하지 않는다.
