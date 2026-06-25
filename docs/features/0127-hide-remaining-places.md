# Feature Slice: F-127 Today 남은 장소 비노출

## Metadata

- GitHub Issue: #127
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #127 — 오늘 화면이 다음 장소 이후 모든 남은 장소를 노출함
- Ouroboros/PM/Seed: Interview `interview_20260625_133816`, Seed `seed_68763c19d8d4`, ambiguity score `0.0335`
- Notes: #32에서 도입한 Today `남은 장소` 목록 UX를 의도적으로 축소한다. Today는 “지금 다음에 갈 곳”에 집중하고, 다음 장소 이후 전체 일정은 기존 `오늘 일정 보기` CTA로만 진입한다.

## Goal

Today 화면에서 다음 장소가 있을 때 장소 상세는 `다음 장소` 카드 1개만 노출한다. 다음 장소 이후의 모든 장소 목록, 요약, 빈 상태 문구는 Today에서 제거하고 전체 Day 일정 확인은 기존 `오늘 일정 보기` CTA로 유지한다.

## Problem

현재 Today 성공 상태는 `다음 장소` 카드 아래 `남은 장소` 섹션에 다음 장소 이후의 pending 장소들을 모두 펼쳐 보여준다. 여행 실행 중 사용자는 “지금 무엇을 해야 하는지”에 집중해야 하므로, 후속 장소 전체 목록은 Today가 아니라 Day itinerary 화면에서 확인하는 편이 낫다.

## User Flow

1. 사용자가 로그인된 상태로 Today route `/`에 진입한다.
2. 앱은 기존 Today 실행 로직으로 오늘 진행 중인 여행, current Day, `nextPlace`를 결정한다.
3. `nextPlace`가 있으면 Today는 기존처럼 `다음 장소` 카드와 길찾기/지출 등록/도착 처리 등 핵심 액션을 보여준다.
4. 앱은 다음 장소 이후 장소가 0개, 1개, 여러 개 중 어느 경우든 `남은 장소` 섹션을 렌더링하지 않는다.
5. 사용자가 전체 Day 일정을 보고 싶으면 기존 `오늘 일정 보기` CTA를 누른다.
6. 앱은 기존 CTA 동작 그대로 current Day itinerary 화면으로 이동한다.

## Scope

- App UI: yes — `apps/mobile/app/index.tsx` Today success state에서 `RemainingPlacesSection` 렌더링과 관련 보조 UI 제거
- App Logic: yes — `apps/mobile/lib/trips/today-execution.ts`의 `TodaySuccessViewModel` 성공 payload에서 `remainingSection` 제거
- API Contract: no — OpenAPI 변경 없음
- API Server: no — Go handler/service/repository 변경 없음
- DB: no — migration/query/schema 변경 없음
- Tests: yes — `apps/mobile/lib/trips/today-execution.test.mts`와 영향받는 fixture/snapshot/consumer 업데이트
- Deploy/Smoke: implementation 완료 후 mobile local 또는 simulator smoke 권장, staging/internal deploy 필수 아님

## Out of Scope

- `nextPlace` 선택, 정렬, 필터링 규칙 변경
- `다음 장소` 카드의 카피, 스타일, 위치, 길찾기/도착/지출 액션 변경
- 기존 `오늘 일정 보기` CTA의 라벨, 스타일, 노출 조건, route destination, navigation 동작 변경
- 다음 장소 이후 장소 수를 요약하는 새 문구, badge, helper panel, count chip 추가
- no ongoing trip, empty itinerary, completed, unavailable, retryable error, auth/loading 등 비성공 또는 no-next Today 상태 변경
- Day itinerary 화면의 장소 목록 UX 변경
- API/OpenAPI, generated client/server, DB migration/sqlc query 변경
- analytics/accessibility/testID 대체 이벤트나 대체 식별자 추가

## Requirements

### UI / UX

- Screens: `apps/mobile/app/index.tsx`
- Today success state with `nextPlace`:
  - 유지: `다음 장소` 카드, 기존 핵심 액션, navigation fallback이 떠야 하는 경우의 기존 fallback, 기존 `오늘 일정 보기` CTA, multiple ongoing notice.
  - 제거: `남은 장소` section 전체.
  - 제거 대상에는 section title, empty/helper copy, count summary, dividers, list rows, section 전용 spacing/style, section 전용 accessibility label/testID/analytics/logging이 포함된다.
  - 다음 장소 이후 장소가 0개인지 1개 이상인지에 따라 UI 구조, 문구, badge, 간격이 달라지면 안 된다.
  - 제거한 자리를 다른 콘텐츠로 대체하지 않는다. 기존 vertical flow가 자연스럽게 접히도록 한다.
- Copy:
  - 새 user-visible copy 없음.
  - 기존 `남은 장소`, `<N>곳 남았어요`, `다음 장소 이후 남은 장소가 없어요.`, `도착하면 오늘 일정이 끝나요.`는 Today 성공 상태에서 더 이상 노출하지 않는다.
- Design:
  - 별도 visual rebalance를 범위에 포함하지 않는다.
  - 남는 UI가 수정될 경우 `apps/mobile/lib/design/theme.ts` token과 기존 Today spacing/card/button pattern을 유지한다.
  - raw hex color, 임의 spacing/radius, emoji/decorative unicode를 추가하지 않는다.

### API Contract

No API changes.

Existing mobile client calls and route contracts remain unchanged:

```text
GET /trips
GET /trips/{tripId}
GET /trips/{tripId}/days/{date}/itinerary
```

### DB Changes

No DB changes.

- No goose migration.
- No sqlc query change.
- No generated DB artifact change.

### Business Rules

- Today success view model publicly exposes one detailed place: `nextPlace`.
- `TodaySuccessViewModel` must not expose `remainingSection` or any other public payload that enumerates places after `nextPlace`.
- This is not UI-only hiding. The success contract itself changes so later-place list data is not computed/passed for Today presentation.
- 다음 장소 이후 장소 수와 무관하게 Today success visible structure is identical.
- 기존 `오늘 일정 보기` CTA remains the only full Day itinerary entry point.
- If section-specific accessibility labels, hints, testIDs, analytics, or logging exist, remove them with the section. Do not add replacement identifiers/events for the removed section.
- Any shared selector/helper/fixture/snapshot/mobile consumer affected by the success type change may receive minimal compile/test repair only.
- No user-visible behavior changes outside the Today success state removal described here.

## Acceptance Criteria

- [x] AC-01: `TodaySuccessViewModel` no longer contains `remainingSection` or another public subsequent-place list payload.
- [x] AC-02: Today success state with `nextPlace` shows the next-place card and existing core actions.
- [x] AC-03: Today success state does not render `남은 장소` title, remaining count, remaining row list, empty copy, helper copy, or section-specific divider/spacing.
- [x] AC-04: The visible Today success structure is the same whether there are zero, one, or multiple places after `nextPlace`.
- [x] AC-05: Existing `오늘 일정 보기` CTA remains visible and keeps its current label, style, route target, navigation behavior, and exposure condition.
- [x] AC-06: Existing `nextPlace` selection/sorting/filtering and next-place card action composition are unchanged.
- [x] AC-07: no-next and non-success Today states keep existing view model shape, copy, and UX except for minimal compile fallout from removing `remainingSection` on success.
- [x] AC-08: Affected mobile unit tests/fixtures/snapshots/consumers are updated to assert the new success contract and no longer expect remaining-list rows or empty state.
- [x] AC-09: No API contract, Go API server, DB migration/query, or generated artifact changes are introduced.
- [x] AC-10: No replacement summary copy, badge, analytics event, testID, or accessibility identifier is added for the removed section.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-01, AC-08: success view model no longer exposes `remainingSection` | Mobile logic/type | `apps/mobile/lib/trips/today-execution.test.mts`; TypeScript | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |
| AC-02, AC-04, AC-06: first pending item still maps to `nextPlace` and existing actions regardless of subsequent item count | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-03, AC-04: one-item and multi-item success states no longer produce/render remaining section or empty copy | Mobile logic/UI compile | `today-execution` tests plus `apps/mobile/app/index.tsx` typecheck | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |
| AC-05: `오늘 일정 보기` CTA contract remains unchanged | Mobile logic | Existing/updated Today execution tests | `pnpm --filter @i-um/mobile test` |
| AC-07: empty/completed/unavailable/retryable/no-ongoing Today states remain unchanged | Mobile logic | Existing Today execution tests | `pnpm --filter @i-um/mobile test` |
| AC-09: API/OpenAPI/DB/generated artifacts remain untouched | Contract/API/DB drift | generated and targeted diff gate | `pnpm verify:generated`; `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts` |
| AC-10: removed section has no replacement instrumentation/copy | Static review/type | Today screen diff review + typecheck | `pnpm --filter @i-um/mobile typecheck` |
| Full regression | Workspace | all configured gates | `pnpm verify` |

## Regression Gaps

- Native render absence for the removed section is not fully automated in the current Node-only mobile test setup.
  - Risk: JSX could accidentally keep or reintroduce `RemainingPlacesSection` while pure view-model tests still pass if it is fed differently.
  - Follow-up: PR review must inspect `apps/mobile/app/index.tsx`; add RN component/render tests if the project introduces renderer-level mobile testing.
- Accessibility labels/testIDs/analytics for the removed section may not have dedicated automated assertions if no such instrumentation exists today.
  - Risk: stale identifiers or events could remain unused in code.
  - Follow-up: implementation must search for remaining-section-specific identifiers/events and remove or document absence in PR notes.

## TDD Implementation Plan

1. Red: update Today success view-model tests for multi-item itinerary
   - Change the current test that expects subsequent items in `remainingSection` so it instead asserts the first pending item is still `nextPlace` and `remainingSection` is absent from the success payload.
   - Verify: `pnpm --filter @i-um/mobile test` fails because current code still exposes `remainingSection`.
2. Red: add/adjust one-item success test
   - Replace the current empty remaining-section expectation with an assertion that no `남은 장소`/empty-state payload exists even when there are zero subsequent places.
   - Verify: `pnpm --filter @i-um/mobile test` fails for the old empty remaining section.
3. Red: preserve CTA and non-target states
   - Keep or strengthen assertions for `primaryAction: { label: '오늘 일정 보기', route: ... }`, completed state, empty itinerary state, unavailable/retryable states, and multiple ongoing notice.
   - Verify: `pnpm --filter @i-um/mobile test` shows only the intentional remaining-section failures.
4. Green: remove remaining-section contract from Today helper
   - Remove `remainingSection` from `TodaySuccessViewModel`.
   - Stop calling `buildRemainingSection(pendingItems.slice(1))` and delete unused `TodayRemainingSectionViewModel`/row types/helper if no longer referenced.
   - Keep `nextPlace`, `arrivalAction`, `quickExpenseAction`, `primaryAction`, and `multipleOngoingTripNotice` behavior unchanged.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
5. Green: remove UI section wiring
   - Remove `RemainingPlacesSection` usage from `apps/mobile/app/index.tsx`.
   - Delete the component and unused remaining-section styles if they have no other consumers.
   - Do not add replacement copy/panel/badge/spacing.
   - Verify: `pnpm --filter @i-um/mobile typecheck` passes.
6. Refactor: minimal fallout cleanup
   - Update affected fixtures/snapshots/shared consumers only as needed for the new success type.
   - Search for section-specific labels/testIDs/analytics/logging and remove any stale code.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
7. Regression gate
   - Verify: `pnpm verify:generated`.
   - Verify: `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`.
   - Verify: `pnpm verify`.

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: pass — worktree dependencies installed after initial test command reported missing `node_modules`.
- Red check `pnpm --filter @i-um/mobile test`: failed as expected after test update because current code still exposed `remainingSection` in 3 Today execution tests.
- `pnpm --filter @i-um/mobile test`: pass — 204 tests.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass.
- `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`: pass.
- `rg -n "RemainingPlacesSection|remainingSection|TodayRemaining|remaining[A-Z]|남은 장소|다음 장소 이후|곳 남았어요|도착하면 오늘 일정이 끝나요|testID|analytics|logEvent" apps/mobile -g '!node_modules'`: pass — only updated test assertions mention `remainingSection` absence.
- `git diff --check`: pass.
- `pnpm verify`: pass.

### Manual Smoke

- Today success with one itinerary item: not run — no simulator/device smoke in this environment.
- Today success with multiple itinerary items: not run — no simulator/device smoke in this environment.
- `오늘 일정 보기` CTA navigation: not run — no simulator/device smoke in this environment.

## Verification Plan

Implementation completion should run:

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify:generated
git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts
pnpm verify
```

Manual smoke after implementation:

- [ ] 오늘 진행 중인 여행 + 오늘 itinerary 1개: 다음 장소 카드와 기존 액션/`오늘 일정 보기` CTA만 보이고 `남은 장소` empty copy가 보이지 않는다.
- [ ] 오늘 진행 중인 여행 + 오늘 itinerary 3개 이상: 첫 pending 장소만 다음 장소 카드에 보이고, 이후 장소명/주소/개수는 Today에 보이지 않는다.
- [ ] `오늘 일정 보기` CTA를 누르면 기존 Day itinerary 화면으로 이동하고 전체 장소를 볼 수 있다.
- [ ] 오늘 일정 없음/모든 일정 완료/에러/no ongoing states는 기존 UX가 유지된다.

## Release Notes

- Today 화면에서 다음 장소 이후의 남은 장소 목록을 펼쳐 보여주지 않도록 정리합니다.
- 전체 오늘 일정은 기존 `오늘 일정 보기` 버튼으로 확인합니다.

## Open Questions

- None. Ouroboros clarification completed with ambiguity score `0.0335`.

## Follow-up Issues

- None.
