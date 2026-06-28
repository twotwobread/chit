# Feature Slice: Today 실행 화면 컴포넌트 조립형 리팩토링

## Metadata

- GitHub Issue: #160
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #160 — [Mobile UI Refactor 3/6] 오늘 실행 화면 컴포넌트 조립형 리팩토링
- Depends on: #159 — 트립 UI 셸 컴포넌트와 탭바 추가, merged into `origin/develop`
- Related completed refactors: #153, #154
- Follow-up split from this spec: #169 — 등록·수정·선택 플로우 BottomSheet 오버레이 전환
- Ouroboros/PM/Seed: Interview `interview_20260628_082059` (ambiguity 0.06). Seed generation attempted via MCP but timed out; CLI fallback also failed because the configured Codex model was unsupported for the account, so no seed artifact was produced.
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md` sections 1, 3, 4, `refactor/PROMPT.md` task 3, `refactor/apps/mobile/app/trips/[tripId]/today.tsx.example`
- Current mobile sources: `apps/mobile/app/index.tsx`, `apps/mobile/lib/trips/today-execution.ts`, `apps/mobile/lib/trips/today-navigation.ts`, `apps/mobile/lib/trips/today-route-preview.ts`, `apps/mobile/lib/trips/travel-mode.ts`, `apps/mobile/lib/trips/quick-expense.ts`, `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx`, `apps/mobile/lib/trip-ui/BottomSheet.tsx`, `apps/mobile/lib/design/primitives.tsx`
- Notes: #160 refactors the current root Today surface in place. It does not move Today into `/trips/[tripId]/today.tsx`, does not introduce trip-level Tabs, and does not convert quick expense to BottomSheet.

## Goal

여행 실행 중인 사용자가 root Today 화면에서 다음 장소와 즉시 필요한 액션을 더 명확한 token-based hero/UI 조립으로 볼 수 있게 한다.

이번 slice는 `apps/mobile/app/index.tsx`의 populated Today success/execution presentation을 #158 design primitives와 #159 `NextPlaceHeroCard` 중심으로 정리하되, 기존 데이터 로딩, 상태 분기, navigation/action 동작은 회귀 없이 유지한다.

## User Flow

1. 사용자가 로그인된 상태로 앱 root `/`에 진입한다.
2. 앱은 기존 Today load flow로 세션, 진행 중 여행, 오늘 Day, Day itinerary, route preview, travel mode를 처리한다.
3. 진행 가능한 다음 장소가 있으면 사용자는 `NextPlaceHeroCard` 중심의 다음 장소 hero를 본다.
4. 사용자는 기존과 동일하게 이동수단을 바꾸고, 길찾기, 도착, 건너뛰기, 숙소로 이동, 지출 등록, 오늘 일정 보기, 스킵 장소 복구를 수행할 수 있다.
5. 경로 미리보기 상세 카드와 navigation fallback은 기존 위치/동작을 유지하고, hero는 compact route summary/fallback chip만 보여준다.
6. 로딩, 로그인 필요, 진행 중 여행 없음, 빈 일정, 완료, 복구 필요, 에러 상태는 기존 copy와 behavior를 유지한다.

## Scope

- App UI: yes — current root Today screen `apps/mobile/app/index.tsx` success/execution presentation
- App Logic: yes — small Today-scoped prop-shaping/presentational helpers only, likely in `apps/mobile/lib/trips/**` or local Today components
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile helper/domain tests for prop-shaping, route chip, travel mode adapter, and preserved action contracts where practical; typecheck for screen integration
- Deploy/Smoke: no staging deploy required; manual simulator/device smoke recommended for Today flows

## Out of Scope

- Moving Today from `apps/mobile/app/index.tsx` to `apps/mobile/app/trips/[tripId]/today.tsx`
- Splitting `apps/mobile/app/trips/[tripId]/days/[date].tsx` or moving toward the future days/tabs file structure
- Trip-level Tabs IA or `app/trips/[tripId]/_layout.tsx` integration (#162)
- Home slimming, active-trip redirect, or deep link behavior (#163)
- Map, itinerary, or settlement screen refactors (#161/#162)
- Quick expense BottomSheet/panel extraction (#169). #160 keeps the existing route-push flow.
- Adding a Today expense total/summary if the current Today data does not already provide equivalent real values
- New API calls, OpenAPI changes, server changes, DB changes, generated code changes
- New dependencies or replacement of `react-native-maps` route preview behavior
- Opportunistic redesign of loading/auth/error/empty/completed states
- Copy polish outside explicitly approved `NextPlaceHeroCard` labels and route chip summary/fallback
- New design tokens, raw hex colors, arbitrary spacing/radius/font values

## Requirements

### UI / UX

#### Screen and state boundary

- Target screen is the current root Today surface: `apps/mobile/app/index.tsx`.
- #160 must not create or route users to `/trips/[tripId]/today.tsx`.
- Token/component refactor is required for the populated Today `success` / execution presentation.
- Loading, session missing/corrupt, auth, no-ongoing-trip, retryable error, unavailable, empty itinerary, completed, and recover-needed state branching must preserve current behavior and visible copy. Minimal wrapper/style changes are allowed only when required for compile/integration.
- If there is no actionable next place, do not render `NextPlaceHeroCard`; preserve the current non-hero state behavior.

#### Next place hero

- The actionable next-place success state must render the next stop through `NextPlaceHeroCard`.
- The hero must be backed by real Today view-model data, not `refactor/` mock state.
- Required data mapping:
  - `place.name` from current `viewModel.nextPlace.placeName`
  - `place.address` from current `viewModel.nextPlace.address`
  - `place.order` from the schedule item order. If the existing Today view model lacks numeric order/type keys, add backward-compatible fields such as `order` and `placeType` while preserving existing `orderLabel` / `placeTypeLabel`.
  - `place.type` from the canonical trip place type key, using `theme.placeType` as the visual source.
  - `place.legText` must use existing route/context data only. If there is no existing real leg text, use a safe Today-scoped fallback that does not imply unavailable data, or omit/keep a neutral copy through a backward-compatible component prop if necessary.
- `NextPlaceHeroCard` labels from #159 (`NEXT · 다음 장소`, `길찾기`, `도착`, `건너뛰기`, `숙소로`) are allowed even if they differ from older root Today button labels.
- Existing next-place controls must remain available and map to existing actions:
  - `길찾기` → current `viewModel.nextPlace.navigationAction`
  - `도착` → current `viewModel.arrivalAction`
  - `건너뛰기` → current `viewModel.skipAction`
  - `숙소로` → current `viewModel.lodgingNavigationAction.action` when available
- Current duplicate-tap protection/loading semantics for arrival/skip must be preserved. If `NextPlaceHeroCard` cannot express disabled/loading states, add small backward-compatible optional props or keep the affected action in a separate Today-specific fragment and document the checklist gap. Do not weaken duplicate-tap protection.
- Current lodging disabled/helper semantics must be preserved. If the hero exposes `숙소로` while lodging is unavailable, it must be disabled or the existing helper surface must remain available.

#### Travel mode adapter

- Internal travel mode values and semantics remain unchanged:
  - `transit`
  - `walking`
  - `driving`
- Defaults, ordering, persistence key, and navigation behavior remain unchanged.
- Add a display-label adapter for `NextPlaceHeroCard` / `SegmentedControl`:
  - selected value shown as `대중교통`, `도보`, or `자동차`
  - `onTravelMode(label)` maps back to the internal `TravelMode` before calling existing `handleTravelModeSelect`
- Unknown labels must be ignored or safely mapped without corrupting stored travel mode.

#### Route chip and detailed route preview

- The rich route preview remains a separate card/surface in its current section. It remains the sole owner of:
  - route preview loading state
  - permission-needed state
  - unsupported/unavailable/error states
  - retry action
  - `Google Maps에서 자세히` detail action
  - `MapView`, `Marker`, and `Polyline` rendering
- `NextPlaceHeroCard.routeChip` is passive summary/fallback text only. It must not introduce new retry/detail/fallback controls beyond the hero's existing `길찾기` CTA.
- Route chip rules:
  - If route preview success has mode + duration + distance, show `mode · duration · distance` such as `대중교통 · 약 14분 · 2.4km`.
  - If route preview success has mode + duration but no distance, show `mode · duration`.
  - If route preview data is loading, idle, unsupported, unavailable, permission-needed, mode-only, or otherwise insufficient, show fallback copy: `경로 정보를 준비 중이에요`.
- The hero CTA always calls the existing navigation action, regardless of route preview chip state.

#### Section ordering and component fit

- Preserve current root `/` Today success-state information hierarchy and section ordering unless a change is internal to `NextPlaceHeroCard`.
- Natural token/component visual differences are allowed; behavior, copy, control availability, state boundaries, and hierarchy are not allowed to drift.
- Prefer #158/#159 components where they fit cleanly:
  - `NextPlaceHeroCard` for next-place hero
  - `Pill` for Day/progress pill-like labels where natural
  - `Badge` for status markers where natural
  - `PlacePin` for place/order markers where natural
  - `ListRow` for place/restore/list rows where natural
- If a surface does not map cleanly to a primitive without awkward props or behavior drift, keep a Today-specific bespoke fragment and document the component checklist gap.
- Small Today-scoped adapter/wrapper components are allowed for prop shaping and layout glue.
- Small backward-compatible prop additions to #158/#159 components are allowed only when needed to preserve Today parity. Do not remove or rename existing props, defaults, or exports.

#### Quick expense and expense summary

- Quick expense must keep the current route-push flow through the existing `buildQuickExpenseRoute` / quick expense screen.
- Do not mount quick expense inside `BottomSheet` in #160.
- Document BottomSheet extraction as follow-up #169.
- Do not add a Today expense total query, derived placeholder, zero amount, or summary card.
- Render `AmountText` / expense summary only if equivalent real data is already present in the current Today view model without new fetching, derivation, or API shape changes. Current repo facts indicate it is not present, so omission is expected.

#### Copy and accessibility

- Preserve current visible Korean copy, accessibility labels, helper text, and feedback messages, except:
  - labels already owned by #159 `NextPlaceHeroCard`
  - the route chip summary/fallback copy specified above
- Pressable controls must keep meaningful `accessibilityRole`, disabled state, and labels/hints where currently present.
- Modal or sheet behavior must not change in this issue.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- Today remains the root `/` authenticated home surface for #160.
- Existing Today selection rules, current date handling, ongoing-trip selection, route preview eligibility, travel-mode storage, navigation fallback, arrival/skip/restore mutation behavior, and quick-expense route construction remain the source of truth.
- #160 is a UI composition refactor. It must not change trip/day/schedule/expense domain policy.
- `apps/mobile/lib/design/theme.ts` remains the design token source of truth.
- Use generated API types/client already used by the screen. Do not add mock-only state or duplicate API contract assumptions.

## Acceptance Criteria

- [x] AC-01: `docs/features/0160-today-execution-components.md` contains the approved spec and TDD implementation plan.
- [x] AC-02: Root Today remains implemented at `apps/mobile/app/index.tsx`; #160 does not add or route to `/trips/[tripId]/today.tsx`.
- [x] AC-03: Populated Today success state renders the next actionable place through `NextPlaceHeroCard` using real Today view-model data.
- [x] AC-04: The hero maps canonical schedule order and place type to `NextPlaceHeroCard` / `PlacePin` without relying on mock state or display labels as the source of truth.
- [x] AC-05: Travel mode selection keeps internal values `transit` / `walking` / `driving`, existing order/default/storage/navigation semantics, and only adds a display-label adapter for the hero.
- [x] AC-06: Hero `길찾기`, `도착`, `건너뛰기`, and `숙소로` controls preserve existing action targets, disabled/loading protections, and unavailable lodging handling.
- [x] AC-07: The rich route preview card remains a separate surface and preserves loading, success map, permission-needed, unsupported, unavailable, retry, and detail action behavior.
- [x] AC-08: Hero `routeChip` follows the specified summary/fallback rules and remains passive text only.
- [x] AC-09: Quick expense keeps the existing route-push flow; no BottomSheet extraction or shared panel extraction is implemented in #160.
- [x] AC-10: No new Today expense summary, placeholder amount, zero amount, new data load, API endpoint, API call, DB change, or contract change is added.
- [x] AC-11: Loading, session/auth, no-ongoing-trip, retryable error, unavailable, empty itinerary, completed, and recover-needed states preserve current copy, behavior, and state branching except for compile-required wrapper changes.
- [x] AC-12: Skipped/restorable rows, navigation fallback panel, action error, Day itinerary CTA, lodging surface, and multiple-ongoing notice preserve current visibility rules, ordering, labels, and behavior.
- [x] AC-13: Success-state UI uses #158/#159 primitives/components where they fit naturally, and any intentionally bespoke retained fragment is documented in the component checklist/regression gaps.
- [x] AC-14: Screen files remain orchestration/composition-focused; new formatting, travel-mode label mapping, route-chip building, or prop-shaping logic lives in tested helper(s) or small Today-scoped adapters.
- [x] AC-15: No raw hex colors, arbitrary design tokens, or new dependencies are introduced.
- [x] AC-16: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.

## Component Usage Checklist

| Surface | Required target | Notes |
|---|---|---|
| Next actionable place | `NextPlaceHeroCard` | Required for success/execution state |
| Place/order marker inside hero | `PlacePin` via `NextPlaceHeroCard` | Requires canonical place type key and numeric order |
| Travel mode | `NextPlaceHeroCard` + `SegmentedControl` | Use display-label adapter; internal values unchanged |
| Route chip | `NextPlaceHeroCard.routeChip` | Passive summary/fallback only |
| Rich route preview | Existing card may remain bespoke | Must preserve `MapView` and retry/detail behavior |
| Skipped/restorable rows | Prefer `ListRow` / `PlacePin` where natural | Keep bespoke if drag/action/accessibility parity is cleaner |
| Status markers | Prefer `Badge` / `Pill` where natural | No copy drift |
| Lodging navigation | Use hero action only if disabled/helper parity is preserved; otherwise keep existing surface | No behavior weakening |
| Quick expense trigger | Existing route action | BottomSheet out of scope (#169) |
| Expense summary | Omit unless real existing Today data is already available | No new data load/placeholder |

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Today view model still exposes success actions, order/type data needed by hero, quick expense route, completed/recover states | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Travel mode label adapter preserves internal `TravelMode` values/order/default and safely maps labels back | Mobile helper | `apps/mobile/lib/trips/travel-mode.test.mts` or new Today UI helper test | `pnpm --filter @i-um/mobile test` |
| Route chip helper formats success summary and fallback states | Mobile helper | `apps/mobile/lib/trips/today-route-preview.test.mts` or new Today UI helper test | `pnpm --filter @i-um/mobile test` |
| Quick expense remains route-based and unchanged | Mobile logic/static | Existing `today-execution` quick expense assertions plus screen review | `pnpm --filter @i-um/mobile test`; `git diff -- apps/mobile/app/index.tsx` review |
| Route preview remains separate and action owner behavior compiles | Mobile type/static | `apps/mobile/app/index.tsx`, `today-route-preview` tests | `pnpm --filter @i-um/mobile typecheck`; `pnpm --filter @i-um/mobile test` |
| No API/DB/generated drift | Static review | Diff review | `git diff --name-only -- packages/api-contract apps/api apps/mobile/lib/trips/client.ts` |
| Token/style/import conventions clean | Mobile lint | ESLint | `pnpm --filter @i-um/mobile lint` |
| Final mobile gate | Mobile | all relevant mobile tests/types | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- Full RN render/visual parity for the Today success screen is not automated in the current repo.
  - Risk: `NextPlaceHeroCard` spacing, control grouping, or contrast issues may only appear on device/simulator.
  - Follow-up: cover with manual smoke for #160 and broader visual pass during #162/#163.
- Press behavior for hero controls may not be fully automated without RN component tests.
  - Risk: disabled/loading edge states could regress if not covered by helper tests/typecheck.
  - Follow-up: manual smoke arrival/skip duplicate tap, lodging unavailable/available, and navigation CTA; add component/e2e harness later if project adopts one.
- Quick expense BottomSheet conversion is intentionally not automated in #160 because it is out of scope.
  - Risk: route-push flow remains less aligned with the desired overlay IA.
  - Follow-up: #169.
- Today expense summary/`AmountText` is omitted because current Today data does not include equivalent real totals.
  - Risk: the refactor does not fully match the mock example's money card.
  - Follow-up: add a separate expense summary slice after source-of-truth data is defined.

## TDD Implementation Plan

1. Red: component/adapter expectations for Today hero data
   - Add or update mobile helper tests so the success Today view model/adapter exposes canonical `order` and `placeType` needed by `NextPlaceHeroCard` while preserving existing `orderLabel` and `placeTypeLabel` assertions.
   - Verify: `pnpm --filter @i-um/mobile test` fails before implementation.

2. Green: add backward-compatible Today view-model fields or local prop adapter
   - Add minimal fields/helper mapping from real schedule item data to hero props.
   - Do not change existing action routes or old view-model fields.
   - Verify: `pnpm --filter @i-um/mobile test`.

3. Red: travel-mode display adapter tests
   - Add tests for `transit`/`walking`/`driving` → `대중교통`/`도보`/`자동차` and label → internal mode conversion.
   - Include unknown label safety.
   - Verify: `pnpm --filter @i-um/mobile test` fails before helper implementation.

4. Green: travel-mode adapter helper
   - Implement helper in `apps/mobile/lib/trips/travel-mode.ts` or a Today-scoped UI helper.
   - Preserve storage/default/order semantics.
   - Verify: `pnpm --filter @i-um/mobile test`.

5. Red: route chip helper tests
   - Add tests for success `mode · duration · distance`, success `mode · duration`, and fallback `경로 정보를 준비 중이에요` for non-success/insufficient states.
   - Verify: `pnpm --filter @i-um/mobile test` fails before helper implementation.

6. Green: route chip helper
   - Implement pure helper using `TodayRoutePreviewState` / `TodayRoutePreviewViewModel` only.
   - Keep rich route preview card behavior untouched.
   - Verify: `pnpm --filter @i-um/mobile test`.

7. Green: screen assembly with `NextPlaceHeroCard`
   - Replace the current manual next-place card in `apps/mobile/app/index.tsx` success state with `NextPlaceHeroCard` plus small local wrappers as needed.
   - Wire existing handlers: navigation, arrival, skip, lodging, travel mode.
   - Add backward-compatible props to `NextPlaceHeroCard` only if needed for disabled/loading/helper parity.
   - Keep quick expense route push, navigation fallback, skipped section, action error, rich route preview card, Day itinerary CTA, lodging helper, and multiple-ongoing notice behavior intact.
   - Verify: `pnpm --filter @i-um/mobile typecheck`.

8. Refactor: clean Today-scoped presentation fragments
   - Extract small local components/helpers only for presentational assembly and prop shaping.
   - Move formatting/mapping helpers to `apps/mobile/lib/**` where they are pure and testable.
   - Do not move data loading or route ownership out of `app/index.tsx` unless required by type safety.
   - Verify: `pnpm --filter @i-um/mobile lint`.

9. Regression: no out-of-scope drift
   - Review diff to confirm no OpenAPI/API/DB/generated route restructuring.
   - Verify: `git diff --name-only -- packages/api-contract apps/api apps/mobile/app/trips apps/mobile/lib/trips/client.ts`.
   - Verify no raw colors in touched files with a targeted grep.

10. Gate
    - Run final mobile checks.
    - Verify: `pnpm --filter @i-um/mobile test`.
    - Verify: `pnpm --filter @i-um/mobile typecheck`.
    - Preferably verify: `pnpm --filter @i-um/mobile lint`.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (239 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `git diff --check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/index.tsx apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx apps/mobile/lib/trips/today-execution.ts apps/mobile/lib/trips/today-route-preview.ts apps/mobile/lib/trips/travel-mode.ts`: pass (no matches)

### Manual Smoke

- Today success with next place: not run — simulator/device smoke not run in this environment
- Travel mode change: not run — simulator/device smoke not run in this environment
- Hero 길찾기: not run — simulator/device smoke not run in this environment
- Route preview loading/success/error/retry/detail: not run — simulator/device smoke not run in this environment
- Arrival/skip duplicate-tap protection: not run — simulator/device smoke not run in this environment
- Skipped restore: not run — simulator/device smoke not run in this environment
- Lodging unavailable/available navigation: not run — simulator/device smoke not run in this environment
- Quick expense route open/back: not run — simulator/device smoke not run in this environment
- Non-success states: not run — simulator/device smoke not run in this environment

## Release Notes

- Team-facing: Today 실행 화면의 populated success presentation을 `NextPlaceHeroCard`와 디자인 프리미티브 중심으로 정리해 후속 트립 탭/화면 이관의 UI 조립 패턴을 검증한다.
- User-facing: 다음 장소와 실행 액션이 더 명확한 카드 중심 UI로 보이지만, 기존 Today 기능과 이동 흐름은 유지된다.

## Open Questions

- None for #160 implementation scope.

## Follow-up Issues

- #169 — 등록·수정·선택 플로우 BottomSheet 오버레이 전환
- #161 — 지도·일정·정산 화면 UI 순차 이관
- #162 — 트립 레벨 Tabs IA 도입
- #163 — 홈 슬림화와 진행 중 여행 딥링크 적용
- Future TBD — Today expense summary source-of-truth and `AmountText` money card once real Today expense totals are defined
