# Feature Slice: F-121 길찾기 실패 대체 행동

## Metadata

- GitHub Issue: #121
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #121 — `[Feature Slice] F-121 길찾기 실패 대체 행동`
- Ouroboros/PM/Seed: interview `interview_20260625_034154`, ambiguity `0.10` (seed metadata `0.103`), seed `seed_b3d66b0ed63c`
- Notes: F-036 adds Today next-place `길찾기` and store fallback, then defers the terminal failure recovery to #121. The user confirmed the fallback panel actions and state transitions during Ouroboros clarification.

## Goal

Google Maps 길찾기와 플랫폼 스토어 설치 화면을 모두 열 수 없는 예외 상황에서도 사용자가 목적지 정보를 잃지 않고 복사, 재시도, 오늘 일정 이동 중 다음 행동을 선택할 수 있게 한다.

## User Flow

1. 사용자가 Today 화면의 다음 장소 카드에서 `길찾기`를 누른다.
2. 앱은 기존 F-036 흐름대로 Google Maps 길찾기를 열고, 실패하면 플랫폼 스토어의 Google Maps 설치 화면을 연다.
3. 길찾기와 스토어 열기가 모두 실패하면 다음 장소 카드 아래에 inline fallback panel이 표시된다.
4. 사용자는 fallback panel에서 `장소 정보 복사`, `다시 시도`, `오늘 일정 보기` 중 하나를 선택한다.
5. 복사 성공/실패 feedback은 panel 안에 표시되고 panel은 유지된다. 재시도 성공 시 외부 앱/스토어 handoff가 일어나며, 재시도 실패 시 같은 panel이 유지된다.

## Scope

- App UI: Yes — `apps/mobile/app/index.tsx` Today 다음 장소 카드 아래 navigation failure fallback panel.
- Mobile domain/helpers: Yes — Today navigation/fallback helper or view-state helper for copy payload, panel state, retry state, and feedback copy.
- API Contract: No API changes.
- API Server: No server changes.
- DB: No DB changes.
- Tests: Mobile unit tests for terminal failure fallback state, copy payload composition, retry state, and reset rules; mobile typecheck.
- Deploy/Smoke: Internal mobile build smoke on iOS/Android where feasible.

## Out of Scope

- F-036의 Google Maps directions URL, platform store URL, location-permission policy, or travel-mode behavior 변경.
- Day itinerary row의 `지도` / `주소 복사` UI 변경 — existing #39 scope.
- Today remaining places list에 지도/복사 row action 추가.
- Apple Maps, Naver Map, KakaoMap 등 provider selection 또는 provider fallback chain.
- In-app route map/summary, ETA, transport steps — follow-up #120.
- API/server/DB/OpenAPI contract 변경.

## Requirements

### UI / UX

- Screens: `apps/mobile/app/index.tsx` Today/Home screen.
- Trigger:
  - Show the fallback panel only when both external attempts fail:
    1. Google Maps directions launch fails.
    2. Platform store install page launch also fails.
  - If directions opens or store opens, do not show this fallback panel.
- Placement:
  - Render the fallback panel inline under the Today next-place card, replacing the current single failure-text-only behavior.
  - Keep it before the remaining places section so recovery actions stay near the failed `길찾기` context.
- Panel copy and actions:
  - Failure message: `길찾기를 열 수 없어요. 잠시 후 다시 시도해 주세요.`
  - Primary action: `장소 정보 복사`
  - Secondary action: `다시 시도`
  - Additional link/action: `오늘 일정 보기`
- `장소 정보 복사`:
  - Copies destination information, not a URL.
  - Copy payload is a one-line string built from non-empty trimmed destination fields joined by one space.
  - If both fields exist: `<placeName> <address>`.
  - If only `placeName` exists: `<placeName>`.
  - If only `address` exists: `<address>`.
  - If both fields are empty after trim, the copy action is disabled and must not trigger clipboard side effects.
  - On success, keep the panel visible and show `장소 정보를 복사했어요.`
  - On failure, keep the panel visible and show `장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.`
- `다시 시도`:
  - Re-runs the same Today next-place external navigation attempt for the same destination.
  - Keep the panel visible while retrying.
  - Disable the retry control and label it `다시 시도 중...` while pending.
  - If directions or store opens successfully, no separate in-app success panel is required.
  - If retry fails again, keep the same fallback panel visible with the same actions.
- `오늘 일정 보기`:
  - Navigates to the existing today Day itinerary route for the selected trip/day.
  - When the user later returns to Today, reset/hide the fallback panel until the user taps `길찾기` and both external attempts fail again.
- Non-success states:
  - Empty itinerary, completed itinerary, unavailable, retryable error, no ongoing trip, loading, and login states do not show this fallback panel.
- Accessibility:
  - All fallback controls use `accessibilityRole="button"` where applicable.
  - Disabled copy/retry controls expose disabled state through React Native accessibility state.
  - No hidden gesture or long-press-only recovery path is allowed.
- Visual style:
  - Use existing theme tokens and Today action/button/card patterns.
  - Do not add raw hex colors in screen code.

### API Contract

`No API changes.`

Existing mobile data already has the next-place destination through Today view model fields derived from `GET /trips/{tripId}/days/{date}/itinerary`: `place.name` and `place.address`.

### DB Changes

`No DB changes.`

### Business Rules

- This slice starts only after F-036's terminal failure point: Google Maps directions launch and platform store launch both fail.
- A directions failure followed by a successful store handoff is not considered a #121 fallback state.
- The fallback panel is scoped to the current Today next place only, not every remaining place row.
- The copy payload uses the same destination information source as Today `길찾기`; it does not fetch fresh data from the API.
- `장소 정보 복사` copies plain text destination information and never copies a Google Maps URL, store URL, or internal route.
- Copy payload composition must trim fields before deciding whether each field is present.
- If no copyable destination text exists, `장소 정보 복사` is disabled and clipboard must not be called.
- `다시 시도` retries external navigation only; it does not mark the item arrived, reorder itinerary items, or reload all Today data by itself.
- `오늘 일정 보기` should use the existing Today day itinerary route/action so route construction remains consistent with current Today behavior.
- Returning to Today through the normal focus/reload path resets the panel because terminal failure state is local UI state, not persisted trip state.
- Reuse existing mobile clipboard patterns where practical. If `expo-clipboard` is already available through #39, use it instead of adding another dependency.

## Acceptance Criteria

- [ ] The feature spec and TDD implementation plan are reviewed before implementation starts.
- [ ] Today success state shows the fallback panel only after Google Maps directions and platform store launch both fail.
- [ ] The fallback panel appears under the next-place card and includes `장소 정보 복사`, `다시 시도`, and `오늘 일정 보기` actions.
- [ ] `장소 정보 복사` is the primary action and copies one-line destination text composed from trimmed non-empty `placeName` and `address` fields.
- [ ] Copy success shows `장소 정보를 복사했어요.` and keeps the fallback panel visible.
- [ ] Copy failure shows `장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.` and keeps the fallback panel visible.
- [ ] If both destination fields are empty after trim, the copy action is disabled and clipboard is not called.
- [ ] `다시 시도` re-runs the same navigation attempt, keeps the panel visible while pending, disables itself, and shows `다시 시도 중...`.
- [ ] If retry fails again, the fallback panel remains visible with the same recovery actions.
- [ ] `오늘 일정 보기` navigates to the existing today Day itinerary screen, and returning to Today resets/hides the fallback panel until another terminal navigation failure occurs.
- [ ] Empty itinerary, completed itinerary, unavailable, retryable error, no ongoing trip, loading, and login states do not show the fallback panel.
- [ ] No OpenAPI, API server, generated client, or DB migration changes are made for this slice.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Terminal failure after directions and store failures maps to a visible Today fallback panel state | Mobile unit logic | `apps/mobile/lib/trips/today-navigation.test.mts` or new `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| Directions success or store success does not create the #121 fallback panel state | Mobile unit logic | `apps/mobile/lib/trips/today-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| Copy payload is one-line `placeName address`, with place-only, address-only, and both-empty defensive cases | Mobile unit logic | `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| Both-empty destination disables copy and does not call clipboard | Mobile unit logic | `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| Copy success/failure feedback maps to exact user-visible copy while keeping panel visible | Mobile unit logic | `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| Retry pending state disables the retry action and labels it `다시 시도 중...`; repeated failure keeps panel visible | Mobile unit logic | `apps/mobile/lib/trips/today-navigation-fallback.test.mts` | `pnpm --filter @i-um/mobile test` |
| `오늘 일정 보기` uses the existing today Day itinerary route and panel state resets on Today reload/focus | Mobile unit logic / typecheck | `apps/mobile/lib/trips/today-execution.test.mts` plus screen state helper test if extracted | `pnpm --filter @i-um/mobile test` |
| Today screen wiring remains type-safe after adding fallback state, Clipboard usage, and UI controls | Mobile typecheck | Expo/TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| Device-level Linking and Clipboard behavior works in internal builds | Manual smoke | iOS/Android internal build | See Manual Smoke below |

## Regression Gaps

- Actual OS `Linking.openURL` handoff failure and platform store failure cannot be fully proven by the pure Node mobile test runner.
  - Risk: a device/OS version may report success/failure differently from mocked `Linking` behavior.
  - Follow-up: force or mock failure paths during internal build smoke before release.
- Native clipboard write success/failure cannot be fully proven without device runtime.
  - Risk: clipboard permission/runtime behavior differs on a target OS version.
  - Follow-up: internal build smoke covers normal copy success and, where practical, an injected/forced copy failure build path.

## TDD Implementation Plan

1. Red: Add mobile unit tests for Today navigation fallback state.
   - Cover terminal failure only after both directions and store attempts fail.
   - Cover no fallback state when directions opens or store opens.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Green: Extend `apps/mobile/lib/trips/today-navigation.ts` or add a small `today-navigation-fallback.ts` helper.
   - Keep external launch URL behavior from F-036 unchanged.
   - Return/build a fallback view state only for terminal failure.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Add copy payload and copy action state tests.
   - Cover both-present, place-only, address-only, and both-empty destination cases.
   - Cover no clipboard side effect when copy is disabled.
   - Cover success/failure feedback messages.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: Implement the pure copy/fallback helper.
   - Compose one-line payload from trimmed non-empty fields.
   - Expose `장소 정보 복사`, disabled copy state, and exact feedback copy.
   - Reuse existing Expo clipboard dependency/patterns in screen wiring.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Red: Add retry/reset behavior tests around the helper state.
   - Cover retry pending label `다시 시도 중...` and disabled state.
   - Cover repeated terminal failure keeps the panel visible.
   - Cover reset when Today reload/focus initializes local fallback state.
   - Verify: `pnpm --filter @i-um/mobile test`
6. Green: Wire `apps/mobile/app/index.tsx`.
   - Replace the single `navigationError` text path with a local fallback panel state.
   - Import and call Clipboard only from the fallback copy action.
   - Reuse the existing Today day route/action for `오늘 일정 보기`.
   - Reset fallback state on Today load/focus and after routing to today itinerary.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
7. Refactor: Keep URL building, copy payload composition, and panel state mapping outside the screen component.
   - Reuse theme tokens and existing Today action button patterns.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
8. Gate: Run the relevant mobile gates before PR.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`

## Verification Plan

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
```

Run broader `pnpm verify` before merge if the implementation touches shared package configuration, dependencies, generated artifacts, or non-mobile code.

### Manual Smoke

```text
1. Open an internal iOS/Android build with an ongoing trip and a Today next place.
2. Tap `길찾기` in a normal environment and confirm Google Maps directions or store fallback behavior remains unchanged.
3. Force/mock both directions and store launch failures.
4. Confirm the fallback panel appears under the next-place card with `장소 정보 복사`, `다시 시도`, and `오늘 일정 보기`.
5. Tap `장소 정보 복사` and confirm the clipboard receives one-line `장소명 주소` text and shows `장소 정보를 복사했어요.`.
6. Force clipboard failure if practical and confirm `장소 정보를 복사할 수 없어요. 잠시 후 다시 시도해주세요.`.
7. Tap `다시 시도` while failure is forced and confirm the button shows `다시 시도 중...`, then the same panel remains after failure.
8. Tap `오늘 일정 보기`, navigate to the day itinerary screen, return to Today, and confirm the fallback panel is hidden until `길찾기` fails again.
```

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: pass — worktree dependency setup.
- `pnpm --filter @i-um/mobile test`: pass — 171 tests.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Internal iOS/Android smoke: not run — requires device/internal build.

## Release Notes

- Today 다음 장소 `길찾기`가 Google Maps와 스토어를 모두 열지 못하면, 장소 정보를 복사하거나 다시 시도하거나 오늘 일정 화면으로 이동할 수 있는 fallback panel을 제공한다.

## Open Questions

- None

## Follow-up Issues

- #36: 다음 장소 길찾기 기본 흐름.
- #39: Day itinerary row 지도 열기/주소 복사.
- #120: 인앱 경로 지도/요약.
