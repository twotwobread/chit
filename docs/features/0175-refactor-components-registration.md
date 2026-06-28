# Feature Slice: 추가 refactor 컴포넌트 등록

## Metadata

- GitHub Issue: #175
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #175 — [Mobile UI Refactor foundation] 추가 프리미티브 점검 및 refactor 컴포넌트 등록
- Depends on: #158, #159 (merged into `origin/develop`)
- Ouroboros/PM/Seed: `interview_20260628_151108` (ambiguity 0.06); Seed generation attempted, MCP timed out before returning a seed id/path
- User direction: proceed without waking the user; choose the best implementation decisions when trade-offs appear
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md` sections 1, 3, 5, and listed `refactor/apps/mobile/...` scaffold files
- Current mobile sources: `apps/mobile/lib/design/theme.ts`, `apps/mobile/lib/design/primitives.tsx`, `apps/mobile/lib/trip-ui/*`, `apps/mobile/lib/navigation/TripTabBar.tsx`, `apps/mobile/package.json`
- Notes: this is a compile-only foundation slice. New components are registered in the real repo but are not imported or rendered by existing screens yet.

## Goal

후속 홈/계정/지도/일정/정산/오버레이 이관 이슈가 공통 UI를 안정적으로 import할 수 있도록 `refactor/`의 추가 컴포넌트와 순수 유틸을 실제 모바일 코드베이스에 등록한다. 이번 단계는 화면 연결 없이 타입 안전한 foundation만 추가하므로 사용자-visible 화면/네비게이션/데이터 로딩 변화가 없어야 한다.

## User Flow

1. 사용자는 기존 앱 화면을 평소처럼 사용한다.
2. 앱은 기존 화면, 탭, 데이터 로딩, 액션 동작을 그대로 유지한다.
3. 개발자는 후속 #176~#180/#169/#173 작업에서 새 `home-ui`, `account-ui`, `trip-ui`, `trips/settlement` exports를 직접 import해 화면 이관을 진행한다.

## Scope

- App UI: yes — add compile-safe component files under `apps/mobile/lib/trip-ui`, `apps/mobile/lib/home-ui`, `apps/mobile/lib/account-ui`; optionally extend `AppBar` avatar press contract backward-compatibly
- Mobile domain/util: yes — add pure `apps/mobile/lib/trips/settlement.ts` and unit tests
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile helper tests, typecheck, existing test suite, lint/format where practical
- Deploy/Smoke: not needed; components are intentionally unmounted

## Out of Scope

- Importing/rendering the new components from `apps/mobile/app/**`
- Changing Home, Mypage, Today, Map, Itinerary, Settle, participant, or quick-expense screen behavior
- API/OpenAPI/server/DB/generated code changes
- New design tokens, raw color literals, arbitrary token additions, or new dependencies
- New route geometry, geocoding, route optimization, current-location permission, map provider configuration, or device map smoke
- True settlement source-of-truth decisions; this slice only adds deterministic local helpers for future UI composition
- New product features such as notification settings, default currency, account linking, settlement completion, or participant policy changes

## Requirements

### UI / UX

- Screens: none. `apps/mobile/app/**` must not change.
- States: unmounted components must be safe for empty input and must not crash when mounted later with missing optional data.
- Copy: Korean-first, short, action-oriented. Money follows the mobile UI rule: comma separators and Korean suffix (`18,500원`, `3,200엔`) through `AmountText` or shared formatter behavior.
- Accessibility: pressable chips/cards/rows/sheet actions expose role/state/labels where visible text is insufficient.
- Visual tokens: use `theme.*` and #158 primitives. Component-authored raw hex/`rgba(...)` literals are forbidden.

### Registration Policy

- Registration means files exist at the issue-listed real paths and compile by direct import.
- Do not invent new registry/barrel files. Update an index only if an owning folder index already exists and TypeScript requires it.
- Public contracts are hybrid view-model contracts: preserve reusable props/callbacks needed by follow-up screen hookup, but adapt to current repo primitives, strict TypeScript, existing helper shapes, and mobile UI rules.
- Do not leave `refactor/` mock data, hard-coded sample state, or scaffold-only comments as public API.

### Component Contracts

#### `apps/mobile/lib/trip-ui/TodaySpendCard.tsx`

- Exports `TodaySpendCard` and `TodaySpendCardProps`.
- Props: numeric `totalAmount`, optional numeric `paidByMeAmount`, `currency`, optional `needsReviewCount`, required `onPressAdd`.
- Uses `AmountText` for displayed amounts; no preformatted money props.
- If `paidByMeAmount` is absent, omit that line rather than inventing a value.
- Shows optional `확인 필요 N` badge only when count is positive.
- Add CTA copy: `지출 등록` or `지출 추가`.

#### `apps/mobile/lib/trip-ui/DayChips.tsx`

- Exports `DayChips`, `DayChip`, `DayChipsProps`.
- Controlled single-selection contract: `days: DayChip[]`, `selectedDayId: string`, `onSelectDay(dayId: string)`.
- `DayChip` is UI-local view model: stable `id`, `label`, optional `dateLabel`, optional `statusLabel`.
- No route push; selection is caller-owned inline state.
- Empty `days` renders a tokenized empty/fallback row rather than crashing.

#### `apps/mobile/lib/trip-ui/ItineraryTimeline.tsx`

- Exports `ItineraryTimeline`, `ItineraryTimelineItem`, `ItineraryTimelineSegment`, `buildItinerarySegments`.
- Accepts UI-local item view models, not generated API/domain types.
- `buildItinerarySegments(items)` preserves caller order and does not sort. Timed items become anchor segments in input order. Each contiguous untimed run before, between, or after anchors becomes one untimed segment. Equal-time order is caller order.
- Renderer supports optional `onPressItem` and `onPressTime` callbacks.
- Empty `items` renders tokenized copy such as `아직 등록된 일정이 없어요`.
- Time editing itself remains a follow-up screen/API concern.

#### `apps/mobile/lib/trip-ui/SettlementBalanceCard.tsx`

- Exports `SettlementBalanceCard` and props.
- Props are numeric `netAmount`, `paidAmount`, `shareAmount`, and `currency`.
- Uses `AmountText`; no preformatted money props.
- `netAmount > 0` means 받을 금액, `< 0` means 보낼 금액, `0` means 정산 완료.

#### `apps/mobile/lib/trip-ui/TransferRow.tsx`

- Exports `TransferRow` and props.
- Display-only final transfer row with `fromName`, `toName`, optional colors, numeric `amount`, and `currency`.
- Uses `Avatar` and `AmountText`; no optional row press in this slice.

#### `apps/mobile/lib/trip-ui/ExpenseRow.tsx`

- Exports `ExpenseRow`, `ExpenseCategory`, and props.
- Props include title, category, payer label, split label, numeric amount/currency, optional review badge, and optional `onPress`.
- Category colors come from `theme.*`/`theme.placeType`; unknown category safely falls back to `etc`.

#### `apps/mobile/lib/trip-ui/RouteMap.tsx`

- Exports `RouteMap`, marker/polyline prop types.
- Presentational/data-driven only: accepts markers/coordinates/optional polyline/style/empty copy. No permissions, current-location ownership, recenter, geocoding, fetching, or map interaction hooks.
- Does not mount `MapView` when no valid coordinates are available. Renders a tokenized fallback surface and keeps caller `style` applied.
- Coordinates with missing/non-finite latitude/longitude are excluded from markers/polylines.
- When valid coordinates exist, renders markers and optional done/upcoming polylines using `react-native-maps`, which is already a mobile dependency.

#### `apps/mobile/lib/trip-ui/QuickExpenseForm.tsx`

- Exports `QuickExpenseForm`, view-model option types, draft/submit types.
- Hybrid UI-local state: initial values/options from props, local draft state, typed `onChange?` and `onSave` payloads.
- Required public fields: amount, currency, schedule item/place option, payer participant id, split participant ids.
- Out of scope fields: title/category/note/date-time.
- Performs only local required-field/amount parse validation; no API submission or async ownership. Optional `submitting`/`errorMessage` props may display caller state.

#### `apps/mobile/lib/trip-ui/TimeEditForm.tsx`

- Exports `TimeEditForm`, `TimeEditDraft`/payload types.
- Hybrid UI-local state with initial `mode`, `startTime`, optional `endTime`, typed `onChange?`, `onSave`, optional `onCancel`.
- Payload supports `mode: 'timed' | 'untimed'`, `startTime`, `endTime`. No label editing or day reassignment.
- No date picker dependency. Time fields are simple typed controls until a future picker issue.

#### `apps/mobile/lib/trip-ui/CompanionsSheet.tsx`

- Exports `CompanionsSheet`, `InviteCard`, `ParticipantRow`, `Participant`/prop types.
- Owns its overlay shell with controlled `visible` and `onClose`.
- Display-only participant list plus immediate action callbacks: `onCopyInvite`, `onKakaoShare`, optional `onRemoveParticipant`.
- No participant selection model and no final confirm flow.
- Empty participants render safe copy and invite actions when available.

#### `apps/mobile/lib/trips/settlement.ts`

- Exports minimal pure helper types and functions for deterministic UI composition.
- Money model: integer display/minor units, currency-agnostic; callers keep one currency group at a time.
- Public helper set: net balance calculation per participant and transfer suggestion/minimization with deterministic ordering/rounding.
- No extra grouping/sorting/summary selectors.

#### `apps/mobile/lib/home-ui/TripCards.tsx`

- Exports named leaf components and prop types only: `ActiveTripCard`, `UpcomingTripRow`, `PastTripRow`.
- Components are pressable cards/rows with view-model props. No list composite and no list-empty state.
- Active card supports progress and member avatars; upcoming/past rows support status/date/member labels.

#### `apps/mobile/lib/account-ui/AccountRows.tsx`

- Exports named components and prop types only: `ProfileCard`, `StatRow`, `SettingsList`, `SettingRow`.
- `ProfileCard` has optional `onEdit`; `SettingRow` has optional `onPress`; `StatRow` is display-only.
- Provider colors use `theme.providerColor`; no raw Kakao/Apple colors.
- No extra section header/divider helpers.

#### `apps/mobile/lib/trip-ui/AppBar.tsx` extension

- Add optional `onPressMembers?: () => void` while preserving the existing `members` shape.
- When absent, avatar group remains visually identical and non-pressable.
- When present, the existing avatar cluster becomes one button press target with Korean accessibility label and pressed opacity/hitSlop only; no new visual affordance.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- New components are additive foundations and must not change screen imports/route behavior.
- `apps/mobile/lib/design/theme.ts` remains the design source of truth.
- Use #158 `AmountText`, `Avatar`, `AvatarGroup`, `Badge`, `Chip`, `PlacePin`, `PlaceTag`, `SegmentedControl`, and `ListRow` before duplicating primitives.
- Do not add dependencies. Existing `lucide-react-native`, `react-native-svg`, and `react-native-maps` may be used.
- `RouteMap` native provider/dev-build verification is intentionally deferred to a map integration issue.
- Settlement helpers must not be shown as authoritative user-facing true settlement before #55~#58 source-of-truth decisions.

## Acceptance Criteria

- [ ] All issue-listed component/util files exist at the real paths and compile.
- [ ] `AppBar` supports optional avatar cluster press without changing default behavior.
- [ ] No `apps/mobile/app/**` file imports or renders the new components in this slice.
- [ ] New components use `theme.*` and #158 primitives; no component-authored raw hex/`rgba(...)` literals are introduced.
- [ ] Public money props use numeric amount + currency code; no preformatted money string props are required for new money components.
- [ ] `RouteMap` safely handles empty/missing/invalid coordinates with a fallback surface and does not mount native map content in that case.
- [ ] `buildItinerarySegments` has deterministic public behavior for timed anchors and contiguous untimed runs.
- [ ] `settlement.ts` has deterministic unit coverage for balances and transfer suggestions.
- [ ] Existing mobile tests pass.
- [ ] Mobile typecheck passes.
- [ ] Preferably mobile lint and format checks pass.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Existing mobile behavior unchanged | Mobile tests | existing suite | `pnpm --filter @i-um/mobile test` |
| New components and direct imports compile | Mobile typecheck | TypeScript compile | `pnpm --filter @i-um/mobile typecheck` |
| `buildItinerarySegments` grouping is deterministic | Unit | `apps/mobile/lib/trip-ui/ItineraryTimeline.test.mts` | `pnpm --filter @i-um/mobile test` |
| Settlement helpers are deterministic | Unit | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing screens remain unmodified | Code review gate | `apps/mobile/app/**` diff | `git diff --name-only -- apps/mobile/app` |
| No raw colors in new scaffold | Code review gate | targeted grep | `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/lib/trip-ui apps/mobile/lib/home-ui apps/mobile/lib/account-ui` |

## Regression Gaps

- RN visual parity and render-level behavior for the unmounted presentational components: this slice intentionally does not connect components to screens and the repo has no component renderer/snapshot test setup.
  - Risk: spacing, wrapping, Modal layering, or map provider details may need adjustment during follow-up integration.
  - Follow-up: #176~#180/#169/#173 should smoke the components when each screen mounts them.
- `RouteMap` native map provider behavior and device rendering: compile-only registration cannot prove native map display.
  - Risk: provider/API-key/dev-build setup issues may surface later.
  - Follow-up: #177 map tab integration should include dev/internal build smoke and fallback verification.
- Form interaction validation beyond local required fields: `QuickExpenseForm` and `TimeEditForm` are not wired to live API flows here.
  - Risk: route wrappers may need small callback/error-state adjustments.
  - Follow-up: #169/#173 integration should cover save/cancel/loading/error smoke.

## TDD Implementation Plan

1. Red: add tests for `buildItinerarySegments` and settlement helper behavior before adding implementation files.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Green: register the issue-listed component/util files by adapting `refactor/` scaffold to current `theme.*`, #158 primitives, strict TS, and no-screen import constraints.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
3. Green: add optional `AppBar.onPressMembers` without changing default avatar rendering.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
4. Refactor: remove scaffold-only comments, raw colors, preformatted money public props, sample defaults, and unused imports.
   - Verify: `pnpm --filter @i-um/mobile lint`
5. Regression gates:
   - Verify: `git diff --name-only -- apps/mobile/app`
   - Verify: `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/lib/trip-ui apps/mobile/lib/home-ui apps/mobile/lib/account-ui`
   - Verify: `pnpm --filter @i-um/mobile test`
   - Verify: `pnpm --filter @i-um/mobile typecheck`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (267 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `git diff --name-only -- apps/mobile/app`: pass (no changed files)
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/lib/trip-ui apps/mobile/lib/home-ui apps/mobile/lib/account-ui`: pass (no matches)

### Manual Smoke

- Existing screens: pass by diff review — `apps/mobile/app/**` has no changed files
- Native map display: not run — intentionally deferred to #177

## Release Notes

- Team-facing: mobile UI 리팩토링 후속 작업에서 사용할 홈/계정/지도/일정/정산/오버레이 foundation 컴포넌트와 정산 순수 유틸을 등록한다. 이번 단계에서는 기존 화면에 연결하지 않아 사용자-visible 변화가 없어야 한다.

## Open Questions

- None. The user delegated implementation trade-off decisions to the agent for this sequence.

## Follow-up Issues

- #176 — 홈·마이페이지 UI 컴포넌트 이관
- #177 — 지도 탭 RouteMap·DayChips 이관
- #178 — 일정 탭 DayChips·타임라인 전환
- #179 — 정산 탭 컴포넌트 기반 화면 구성
- #180 — AppBar 동행자 Sheet 연결
- #169 — 등록·수정·선택 플로우 BottomSheet 오버레이 전환
- #173 — 오늘 탭 지출 요약 카드 추가
