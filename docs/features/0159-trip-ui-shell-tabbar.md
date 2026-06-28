# Feature Slice: 트립 UI 셸 컴포넌트와 탭바 추가

## Metadata

- GitHub Issue: #159
- Status: In Progress
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #159 — [Mobile UI Refactor 2/6] 트립 UI 셸 컴포넌트와 탭바 추가
- Depends on: #158 — Mobile UI 디자인 프리미티브 추가, merged into `origin/develop`
- Ouroboros/PM/Seed: `interview_20260628_064457` / `seed_d559bd113390` (ambiguity 0.08; MCP generated seed, no local seed file path returned)
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md` sections 1, 2, 4, 5, `refactor/PROMPT.md` task 2, `refactor/apps/mobile/lib/trip-ui/*`, `refactor/apps/mobile/lib/navigation/TripTabBar.tsx`
- Current mobile sources: `apps/mobile/lib/design/theme.ts`, `apps/mobile/lib/design/index.ts`, `apps/mobile/lib/design/primitives.tsx`, `apps/mobile/lib/navigation/BottomMenu.tsx`, `apps/mobile/package.json`, `apps/mobile/tsconfig.json`
- Notes: `refactor/` scaffold is a starting point only. #159 ports and adapts the trip-level shell components to the real repo, but keeps them disconnected from screens and from `app/trips/[tripId]/_layout.tsx`.

## Goal

트립 실행 화면 리팩토링에 필요한 trip-level UI 셸 컴포넌트와 `TripTabBar` scaffold를 실제 모바일 코드베이스에 추가한다. 이번 단계는 후속 오늘/지도/일정/정산 화면 이관의 기반만 만드는 작업이며, 기존 화면 UI·동작·네비게이션에는 사용자-visible 변화가 없어야 한다.

## User Flow

1. 사용자는 기존 앱 화면과 기존 `BottomMenu`를 평소처럼 사용한다.
2. 앱은 기존 화면/라우팅/데이터 로딩을 그대로 유지하고 새 trip UI 컴포넌트는 아직 렌더링하지 않는다.
3. 개발자는 후속 #160~#162 작업에서 `apps/mobile/lib/trip-ui/*`와 `apps/mobile/lib/navigation/TripTabBar.tsx`를 import해 트립 실행 화면과 탭 IA를 조립할 수 있다.

## Scope

- App UI: yes — add `apps/mobile/lib/trip-ui/AppBar.tsx`, `NextPlaceHeroCard.tsx`, `BottomSheet.tsx`, `TripSwitcherSheet.tsx`, and `apps/mobile/lib/navigation/TripTabBar.tsx`
- Dependencies: yes — add `lucide-react-native` and `react-native-svg` as direct mobile dependencies; this was explicitly approved during spec clarification
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile typecheck/test/lint gates plus explicit regression gaps for RN visual/interaction smoke until components are screen-mounted
- Deploy/Smoke: not needed; additive scaffold only and not connected to screens

## Out of Scope

- Connecting new components to `app/trips/[tripId]/_layout.tsx`, `today.tsx`, `days/[date].tsx`, or any existing screen
- Creating the trip-level Expo Router `Tabs` layout (#162)
- Refactoring the Today execution screen to use `NextPlaceHeroCard` (#160)
- Migrating map/itinerary/settle screens (#161)
- Home redirect/slimming or active-trip deep link behavior (#163)
- Changing existing `apps/mobile/lib/navigation/BottomMenu.tsx` behavior
- Adding new design tokens or hardcoded raw colors in screen/component code
- Introducing `@gorhom/bottom-sheet` or other sheet/animation dependencies
- API/OpenAPI/server/DB/generated code changes

## Requirements

### UI / UX

- Screens: none. This PR must not modify `apps/mobile/app/**` screen files.
- Public component paths:
  - `apps/mobile/lib/trip-ui/AppBar.tsx`
  - `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx`
  - `apps/mobile/lib/trip-ui/BottomSheet.tsx`
  - `apps/mobile/lib/trip-ui/TripSwitcherSheet.tsx`
  - `apps/mobile/lib/navigation/TripTabBar.tsx`
- Copy: Korean-first, short, action-oriented copy. Required labels include `홈으로`, `닫기`, `여행 전환`, `진행 중`, `새 여행 만들기`, `NEXT · 다음 장소`, `길찾기`, `도착`, `건너뛰기`, `숙소로`, and route fallback copy such as `경로 정보를 준비 중이에요`.
- Accessibility:
  - Pressable actions use `accessibilityRole` and `accessibilityLabel` where the visible label is not enough.
  - Selected tab/current-trip states set `accessibilityState={{ selected: true }}`.
  - Modal close/backdrop controls expose a `닫기` label.
- Visual tokens:
  - Use `theme.*` and #158 primitives as the design source of truth.
  - Do not add new design tokens.
  - Do not add raw hex or raw `rgba(...)` literals. For overlays or translucent effects, use existing token colors with safe RN opacity/layering, or use an existing opaque token color.

### Dependency Policy

- `lucide-react-native` and `react-native-svg` are approved for #159 and must be added as direct dependencies of `@i-um/mobile`.
- Add dependency changes separately enough in the implementation history/PR description that reviewers can identify them.
- Use an Expo-compatible install flow, for example from the repo root:

```bash
pnpm --filter @i-um/mobile exec expo install lucide-react-native react-native-svg
```

- The implementation must update `apps/mobile/package.json` and `pnpm-lock.yaml` consistently.
- All Lucide icon colors must come from `theme.*`; no hardcoded icon colors.
- Do not add `@react-navigation/bottom-tabs` as a direct dependency unless typecheck proves it is required. Prefer Expo Router-compatible typing. If a type-only `BottomTabBarProps` import from `@react-navigation/bottom-tabs` is used, document that it is the prop shape passed by Expo Router `Tabs` and keep it type-only.

### Component Contracts

#### `AppBar`

Role: trip-level top bar with home/back action, trip title switch trigger, optional caption, and companion avatars.

Expected public props:

```ts
type AppBarMember = { name: string; color?: string };

type AppBarProps = {
  tripName: string;
  caption?: string;
  members?: AppBarMember[];
  onPressTitle?: () => void;
  onBack?: () => void;
};
```

Contract:

- Renders a left home/back button with label `홈으로`.
- Calls `onBack` when provided; otherwise may default to `router.replace('/')` so the scaffold has a safe home behavior when mounted later.
- Renders `tripName` centered and single-line.
- If `onPressTitle` is provided, the title area is pressable and calls it. If omitted, the title renders safely without a misleading active control.
- If `caption` is provided, render it below the title. If omitted, omit the caption row.
- If `members` is empty or omitted, render no avatars but preserve layout without crashing.
- Use #158 `AvatarGroup` for avatars.
- Use Lucide icons for back/title affordances with theme colors only.

#### `NextPlaceHeroCard`

Role: presentational dark-green hero card for the next place in Today execution, including route preview placeholder, travel mode segmented control, and primary/secondary actions.

Expected public types and props:

```ts
type NextPlace = {
  order: number;
  type: keyof typeof theme.placeType;
  name: string;
  address: string;
  legText: string;
  openText?: string;
};

type NextPlaceHeroCardProps = {
  place: NextPlace;
  travelMode: string;
  travelOptions?: string[];
  onTravelMode: (value: string) => void;
  routeChip?: string;
  onNavigate: () => void;
  onArrive: () => void;
  onSkip: () => void;
  onLodging: () => void;
};
```

Contract:

- Uses #158 `PlacePin` and `SegmentedControl`.
- Default `travelOptions` are `['대중교통', '도보', '자동차']` unless the caller passes options.
- `openText` is optional. If absent, omit the opening-hours metadata row.
- `routeChip` is optional. If absent, the route preview area must not crash and should show safe fallback copy such as `경로 정보를 준비 중이에요` or omit only the chip while retaining layout.
- The route preview is a token-based placeholder, not a real map and not a new map dependency.
- `길찾기`, `도착`, `건너뛰기`, and `숙소로` actions call only the corresponding props.
- All icons, backgrounds, borders, and text colors use `theme.*` tokens.

#### `BottomSheet`

Role: zero-extra-dependency modal bottom sheet shell for quick overlays.

Expected public props:

```ts
type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  showCloseButton?: boolean;
};
```

Contract:

- Uses React Native `Modal` with `transparent` and slide-style presentation.
- Opening/closing the sheet is controlled by `visible`; opening the sheet must not push a route or grow the back stack.
- Renders `children` inside the sheet only through the overlay shell.
- Calls `onClose` from backdrop tap, Android `onRequestClose`, and an accessible close button when `showCloseButton !== false`.
- Uses `useSafeAreaInsets` for bottom padding.
- Uses token-based scrim/sheet/grabber/close styling with no raw color literals.

#### `TripSwitcherSheet`

Role: modal overlay opened from `AppBar` title to switch active trips without increasing navigation depth.

Expected public types and props:

```ts
import type { Href } from 'expo-router';

type SwitchableTrip = {
  id: string;
  name: string;
  dates: string;
  color?: string;
  current?: boolean;
};

type TripSwitcherSheetProps = {
  visible: boolean;
  trips: SwitchableTrip[];
  onClose: () => void;
  hrefForTrip?: (id: string) => Href;
  onPressCreateTrip?: () => void;
};
```

Contract:

- Uses React Native `Modal` with a top/dropdown overlay style.
- Sheet open/close is overlay-only and must not push a route.
- Backdrop tap, Android `onRequestClose`, and explicit close button call `onClose`.
- Empty `trips` renders a safe empty state such as `전환할 여행이 없어요` plus `새 여행 만들기`; it must not crash.
- Current trip row renders selected/current styling, `진행 중` badge, selected accessibility state, and check icon.
- Pressing the current trip only closes or keeps the sheet stable; it must not call `router.replace` for the current trip.
- Pressing a non-current trip calls `onClose()` and then `router.replace(hrefForTrip(id))`.
- Default `hrefForTrip` is `/trips/${id}/today`.
- `새 여행 만들기` contract is intentionally hybrid for this scaffold:
  - always call `onClose()` first;
  - if `onPressCreateTrip` is provided, call it;
  - otherwise fallback to `router.push('/trips/new')`.
- If later screen orchestration needs less router coupling, this can be narrowed to callback-only in a follow-up refactor.
- Trip color values may come from data props, but component-authored fallback colors must use `theme.*`.

#### `TripTabBar`

Role: custom Expo Router `Tabs` tab bar for trip-level lateral screens: 오늘·지도·일정·정산.

Expected route labels/icons:

| route.name | Label | Icon intent |
|---|---|---|
| `today` | `오늘` | compass/current execution |
| `map` | `지도` | map |
| `itinerary` | `일정` | ordered list |
| `settle` | `정산` | wallet |

Contract:

- Accepts the prop shape supplied to Expo Router `Tabs` custom `tabBar`.
- Emits `tabPress` with `canPreventDefault: true` before navigation.
- If not focused and the event is not prevented, calls `navigation.navigate(route.name)`.
- Applies selected visual state and `accessibilityState={{ selected: focused }}`.
- Uses fallback label `route.name` and a safe fallback icon for unknown route names.
- Uses `useSafeAreaInsets` for bottom padding.
- Does not modify or replace existing `BottomMenu`.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- #159 is additive scaffold work. It must compile, but no existing app route should import or render the new components yet.
- #158 primitives are the first reuse target. Prefer imports from `../design` public exports where possible.
- `apps/mobile/lib/design/theme.ts` remains the design source of truth.
- `apps/mobile/tsconfig.json` is strict and has no path aliases; use relative imports.
- Overlay components (`BottomSheet`, `TripSwitcherSheet`) are UI overlays, not screens. Opening/closing overlays must not affect browser/native back stack.
- Trip switching uses `router.replace` to stay at the same navigation depth; creating a new trip uses `router.push('/trips/new')` fallback because it starts a separate creation flow.
- Existing `BottomMenu` behavior must remain unchanged.

## Acceptance Criteria

- [ ] `apps/mobile/lib/trip-ui/AppBar.tsx` is added and exports `AppBar` with the contract above.
- [ ] `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx` is added and exports `NextPlaceHeroCard` plus its public `NextPlace` type.
- [ ] `apps/mobile/lib/trip-ui/BottomSheet.tsx` is added and exports `BottomSheet`.
- [ ] `apps/mobile/lib/trip-ui/TripSwitcherSheet.tsx` is added and exports `TripSwitcherSheet` plus `SwitchableTrip`.
- [ ] `apps/mobile/lib/navigation/TripTabBar.tsx` is added and exports `TripTabBar`.
- [ ] `lucide-react-native` and `react-native-svg` are direct dependencies of `@i-um/mobile`, with lockfile updated.
- [ ] All new component imports match the real repo structure and strict TypeScript config; no path aliases are introduced.
- [ ] New components use `theme.*` and #158 primitives; no new design tokens or raw hex/`rgba(...)` literals are added.
- [ ] `AppBar` supports back/home action, title press, optional caption, and optional/empty avatar members without crashing.
- [ ] `NextPlaceHeroCard` accepts next place, travel mode toggle, and 길찾기/도착/건너뛰기/숙소로 handlers as props, and safely handles missing `openText`/`routeChip`.
- [ ] `BottomSheet` and `TripSwitcherSheet` are Modal overlays with backdrop/close/onRequestClose dismissal and do not require route pushes for open/close.
- [ ] `TripSwitcherSheet` handles empty trips, current trip selection, non-current trip `router.replace`, and create-trip callback/fallback behavior.
- [ ] `TripTabBar` handles tab press emission, navigation, selected accessibility state, safe-area padding, and unknown-route fallback.
- [ ] Existing `apps/mobile/lib/navigation/BottomMenu.tsx` behavior is unchanged.
- [ ] No `apps/mobile/app/**` screen file is modified.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.
- [ ] Preferably `pnpm --filter @i-um/mobile lint` and `pnpm --filter @i-um/mobile format:check` pass.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Existing mobile domain behavior unchanged | Mobile tests | existing `apps/mobile/lib/**/*.test.mts` suite | `pnpm --filter @i-um/mobile test` |
| New component files, Lucide/SVG deps, Expo Router types, and relative imports compile | Mobile typecheck | TypeScript compile over `apps/mobile/lib/**/*.tsx` | `pnpm --filter @i-um/mobile typecheck` |
| Token/style/import conventions and unused imports are clean | Mobile lint | ESLint | `pnpm --filter @i-um/mobile lint` |
| Formatting is stable | Mobile format | Prettier check | `pnpm --filter @i-um/mobile format:check` |
| Existing app screens remain unmodified | Code review gate | `apps/mobile/app/**` diff | `git diff --name-only -- apps/mobile/app` |
| Existing `BottomMenu` behavior remains unmodified | Code review gate | `BottomMenu.tsx` diff | `git diff -- apps/mobile/lib/navigation/BottomMenu.tsx` |
| No raw color literals or new tokens in new scaffold | Code review gate | targeted grep/diff review | `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/lib/trip-ui apps/mobile/lib/navigation/TripTabBar.tsx` |

## Regression Gaps

- RN component visual parity and layout for `AppBar`, `NextPlaceHeroCard`, `BottomSheet`, `TripSwitcherSheet`, and `TripTabBar`: the repo currently has no RN component renderer/snapshot test infrastructure, and #159 intentionally does not mount the components in screens.
  - Risk: spacing, icon alignment, Modal layering, or contrast issues may only appear once #160/#162 mounts the components.
  - Follow-up: perform simulator/manual smoke when #160 connects Today UI and when #162 introduces the trip-level Tabs layout.
- Overlay back-stack behavior cannot be fully proven until a screen owns `visible` state and opens the sheets.
  - Risk: a future integration could accidentally wrap overlays in routes or call push for open/close.
  - Follow-up: #162 integration should include manual navigation smoke: open/close sheet, Android back/onRequestClose, switch trip, and back-stack check.
- `TripTabBar` tab navigation cannot be exercised until `app/trips/[tripId]/_layout.tsx` declares the Tabs.
  - Risk: route names or params may need adjustment during #162.
  - Follow-up: #162 should add the actual Tabs layout and simulator smoke for 오늘↔지도↔일정↔정산.

## TDD Implementation Plan

1. Red: introduce compile pressure before implementation.
   - Add or stage minimal imports for the planned new files/scaffold so `pnpm --filter @i-um/mobile typecheck` fails on missing `lucide-react-native`/new modules before dependency install.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
2. Green: add approved dependencies.
   - Install `lucide-react-native` and `react-native-svg` as direct mobile dependencies using an Expo-compatible command.
   - Commit/describe dependency changes separately from component implementation when practical.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
3. Green: add scaffold files with real repo adaptation.
   - Create `apps/mobile/lib/trip-ui/`.
   - Port `AppBar`, `NextPlaceHeroCard`, `BottomSheet`, and `TripSwitcherSheet` from `refactor/` as starting code.
   - Add `apps/mobile/lib/navigation/TripTabBar.tsx` without changing `BottomMenu.tsx`.
   - Replace path aliases with relative imports and import primitives/theme from actual `apps/mobile/lib/design` public exports.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
4. Refactor: enforce contracts and edge states.
   - Remove scaffold raw hex/`rgba(...)` literals and map all component-authored colors to `theme.*`.
   - Add optional-state handling for `AppBar` members/caption/title press, `NextPlaceHeroCard` `openText`/`routeChip`, empty `TripSwitcherSheet`, current-trip no-replace, create-trip callback/fallback, and `TripTabBar` unknown routes.
   - Verify: `pnpm --filter @i-um/mobile lint`
5. Regression: ensure additive/no-screen behavior.
   - Verify: `git diff --name-only -- apps/mobile/app` returns no changed files.
   - Verify: `git diff -- apps/mobile/lib/navigation/BottomMenu.tsx` shows no behavior change.
   - Verify: `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/lib/trip-ui apps/mobile/lib/navigation/TripTabBar.tsx` returns no matches or only documented false positives from comments if any.
6. Gate: run final mobile checks.
   - Verify: `pnpm --filter @i-um/mobile test`
   - Verify: `pnpm --filter @i-um/mobile typecheck`
   - Preferably verify: `pnpm --filter @i-um/mobile lint`
   - Preferably verify: `pnpm --filter @i-um/mobile format:check`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (238 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/lib/trip-ui apps/mobile/lib/navigation/TripTabBar.tsx`: pass (no matches)

### Manual Smoke

- Existing screens: pass by diff review — `git diff --name-only -- apps/mobile/app` returned no changed files
- Existing `BottomMenu`: pass by diff review — `git diff -- apps/mobile/lib/navigation/BottomMenu.tsx` returned no changes
- Overlay behavior: not run — components are intentionally not mounted in screens until #160/#162

## Release Notes

- Team-facing: mobile UI 리팩토링 2단계로 트립 실행 셸 컴포넌트와 trip-level tab bar scaffold를 추가할 준비가 되었다. 구현 후에도 이번 단계에서는 기존 화면에 연결하지 않으므로 사용자-visible 변화는 없어야 한다.

## Open Questions

- None for #159 implementation scope.

## Follow-up Issues

- #160 — 오늘 실행 화면 컴포넌트 조립형 리팩토링
- #161 — 지도·일정·정산 화면 UI 순차 이관
- #162 — 트립 레벨 Tabs IA 도입
- #163 — 홈 슬림화와 진행 중 여행 딥링크 적용
- Future optional refactor: if `TripSwitcherSheet` router fallback becomes too coupled after integration, narrow `새 여행 만들기` to callback-only ownership in the mounting screen.
