# Feature Slice: 트립 레벨 Tabs IA 도입

## Metadata

- GitHub Issue: #162
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #162 — [Mobile UI Refactor 5/6] 트립 레벨 Tabs IA 도입
- Depends on: #161 — closed/merged into `origin/develop` via PR #171
- Followed by: #163 — 홈 슬림화와 진행 중 여행 딥링크 적용
- Ouroboros/PM/Seed: Interview `interview_20260628_104228`; ambiguity score `0.07` returned by the MCP interview. Seed generation was attempted with `ouroboros_ouroboros_generate_seed` and repeatedly timed out, so no seed id/path is available.
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md` sections 2 and 4, `refactor/PROMPT.md` task 5, `refactor/apps/mobile/app/trips/[tripId]/_layout.tsx.example`
- Current mobile sources: `apps/mobile/app/_layout.tsx`, `apps/mobile/app/index.tsx`, `apps/mobile/app/trips/[tripId]/index.tsx`, `apps/mobile/app/trips/[tripId]/days/[date].tsx`, `apps/mobile/lib/navigation/BottomMenu.tsx`, `apps/mobile/lib/navigation/TripTabBar.tsx`, `apps/mobile/lib/trip-ui/AppBar.tsx`, `apps/mobile/lib/trip-ui/TripSwitcherSheet.tsx`
- Notes: #162 owns trip-scoped tab IA and route cleanup. #163 owns changing `/` into the slim home/active-trip redirect, so `/` remains functionally unchanged in #162 except for shared extraction needed by `/trips/{id}/today`.

## Goal

트립 내부의 자주 오가는 오늘·지도·일정·정산 화면을 push depth가 아닌 트립 레벨 Tabs로 묶어, 사용자가 전역 홈/목록에서 특정 여행에 들어온 뒤 여행 안에서는 탭으로 이동하도록 만든다.

기존 Day 상세, 여행 정보, 편집, 참여자, 장소 추가, 빠른 지출 같은 드문/상세 흐름은 탭 항목이 아니라 숨김 push/detail route로 유지하되, 명확한 back fallback과 공유 트립 AppBar를 제공한다.

## User Flow

1. 사용자가 기존 여행 목록/상세 링크, `/trips/{tripId}` 딥링크, 또는 여행 전환 Sheet를 통해 특정 여행에 진입한다.
2. 앱은 `/trips/{tripId}/today`를 트립의 canonical landing route로 열고, 트립명/참여자 preview가 들어간 공유 AppBar와 오늘·지도·일정·정산 TripTabBar를 표시한다.
3. 사용자는 오늘·지도·일정·정산을 탭으로 전환한다. 탭 전환은 hidden detail stack을 복원하거나 back stack을 늘리지 않고 각 tab root로 이동한다.
4. 사용자가 일정 tab에서 Day를 선택하면 기존 `/trips/{tripId}/days/{date}` 상세 route로 push된다. 상세 route에서는 TripTabBar가 숨겨지고 AppBar의 contextual back이 일정 tab으로 돌아갈 수 있다.
5. 사용자가 AppBar 제목을 눌러 여행 전환 Sheet를 열고 다른 여행을 선택하면, 현재 tab/detail 상태와 무관하게 `/trips/{newTripId}/today`로 `replace`된다.
6. 선택한 여행에 오늘 날짜에 해당하는 Day가 없으면 today/map/settle tab은 redirect하지 않고 각 surface의 unavailable state를 보여준다. primary CTA는 일정 tab, secondary CTA는 여행 정보 detail로 연결한다.

## Scope

- App UI: yes — `apps/mobile/app/trips/[tripId]/_layout.tsx`, `today.tsx`, `map.tsx`, `itinerary.tsx`, `settle.tsx`, hidden/detail route 정리
- App Logic: yes — trip route helpers, explicit-`tripId` Today orchestration/extraction, current-day resolver, tab unavailable state view models, hidden route back fallback helpers
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile helper/view-model route contract tests plus existing mobile regression tests and typecheck
- Deploy/Smoke: no staging deploy required; simulator/device navigation smoke required before implementation completion

## Out of Scope

- #163 scope: `/` 홈 슬림화, active-trip app launch redirect, global `BottomMenu` removal/redefinition outside the trip shell
- Preserving the current tab when switching trips; #162 always switches to `/trips/{newTripId}/today`
- New true map/provider features: route geometry, distance/time estimates, transport-mode inference, map legend, cross-day route browsing, native map provider integration beyond existing map URL/copy affordances
- New true settlement features: per-person balances, netting, transfer CTA, settlement completion, totals/grouping not already available from current day expense data
- Cross-day map or settlement browsing from map/settle root tabs
- Trip-level quick-expense entry from today/settle. Existing day-scoped quick-expense route behavior is preserved.
- New API/OpenAPI/server/DB/generated-code changes
- New dependencies, new design tokens, raw hex colors, or broad redesign of existing Day detail behavior

## Requirements

### UI / UX

#### Route contract

- Keep `apps/mobile/app/_layout.tsx` as the global `Stack`.
- Add a trip shell at `apps/mobile/app/trips/[tripId]/_layout.tsx` that owns the trip-scoped navigation world.
- The only visible tab roots are:
  - `/trips/{tripId}/today`
  - `/trips/{tripId}/map`
  - `/trips/{tripId}/itinerary`
  - `/trips/{tripId}/settle`
- Keep `/trips/{tripId}` as a backward-compatible alias that redirects/replaces to `/trips/{tripId}/today`.
- Move the existing trip-detail content currently in `apps/mobile/app/trips/[tripId]/index.tsx` to a real hidden route `/trips/{tripId}/detail`.
- Keep these routes as hidden/pushed detail routes, not tab items:
  - `/trips/{tripId}/detail`
  - `/trips/{tripId}/edit`
  - `/trips/{tripId}/participants`
  - `/trips/{tripId}/days/{date}`
  - `/trips/{tripId}/days/{date}/place-search`
  - `/trips/{tripId}/days/{date}/places/new`
  - `/trips/{tripId}/days/{date}/expenses/quick`
- Hidden/pushed routes render inside the trip shell with the shared AppBar and TripSwitcherSheet available, but TripTabBar hidden.
- If Expo Router implementation needs hidden `Tabs.Screen` entries or a nested stack to preserve URLs, the observable contract above wins over component placement.

#### Shared AppBar and TripSwitcherSheet

- All four root tabs share the same AppBar layout:
  - trip name from `getTripDetail(tripId).trip.name`
  - participant avatars/preview from available current API data (`participantSummary.previewNames` and/or `listTripParticipants`); no API change or synthetic participant color requirement
  - title press opens `TripSwitcherSheet`
  - left/back exits to prior pre-trip route when history exists; cold/deep-link fallback is `/`
- Hidden routes use the same shell AppBar with contextual back behavior. They do not own a separate global header.
- `TripSwitcherSheet` is mounted once at the trip shell level.
- Selecting another trip always closes current hidden/detail state and `router.replace`s to `/trips/{newTripId}/today`.
- Selecting the current trip only closes the sheet.
- The sheet list uses existing trip list data and marks the current `tripId` as selected.

#### Tab navigation semantics

- Use the existing `apps/mobile/lib/navigation/TripTabBar.tsx` pattern for labels/icons: `오늘`, `지도`, `일정`, `정산`.
- A root tab press navigates to that tab root without growing push history.
- Tapping an already active root tab is a no-op in #162.
- Tab navigation must not restore hidden/detail route state from another tab.
- Today tab content must not render the old global `BottomMenu`; `TripTabBar` is the only primary trip navigation.

#### `/trips/{tripId}/today`

- `/trips/{tripId}/today` is the canonical trip-scoped Today route.
- Extract/reuse the existing Today execution UI and helper behavior from `apps/mobile/app/index.tsx`, but parameterize it by explicit `tripId` instead of selecting the first ongoing trip as the route owner.
- `/` remains functionally unchanged in #162; if shared code is extracted, `/` should still expose the same behavior until #163 changes it.
- Day resolution uses only device/local calendar today matched against the selected trip’s `detail.days` via existing date helpers. Do not fall back to last selected day, nearest upcoming day, or nearest past day.
- If the selected trip has no calendar-today Day, render an in-tab unavailable state instead of redirecting:
  - primary CTA: `일정 보기` → `/trips/{tripId}/itinerary`
  - secondary CTA: `여행 정보 보기` → `/trips/{tripId}/detail`
- Preserve existing Today execution states and actions when a current Day exists: loading, auth, retryable error, empty itinerary, next place, skipped/recoverable places, completed day, navigation fallback, route preview eligibility, arrive/skip/restore behavior.
- Existing action routes that open the Day detail should use the hidden `/trips/{tripId}/days/{date}` route and return/fallback to itinerary where appropriate.

#### `/trips/{tripId}/itinerary`

- The itinerary tab is always available after trip detail loads, regardless of whether the trip has a calendar-today Day.
- Render a trip-level Day list/selector using existing trip day data and lodging summary view models.
- Do not auto-open today’s Day and do not embed a selected Day detail preview in #162.
- Tapping a Day row always pushes `/trips/{tripId}/days/{date}` as the existing full-screen Day detail surface.
- The existing Day detail route remains the only detailed day surface in #162.

#### `/trips/{tripId}/map`

- The map tab is scoped to the selected trip’s calendar-today Day only.
- If no current Day exists, render a map-specific unavailable state with:
  - primary CTA: `일정 보기` → `/trips/{tripId}/itinerary`
  - secondary CTA: `여행 정보 보기` → `/trips/{tripId}/detail`
- If a current Day exists, show a slim tab-specific presentation of existing itinerary/map-affordance data, not an embedded copy of `days/[date].tsx`.
- In-scope affordances are read-only current-day place/route summary plus existing per-place `지도` and `주소 복사` behavior from `apps/mobile/lib/trips/day-itinerary-map-actions.ts`.
- Preserve existing map URL, copy-address availability, helper text, feedback, and accessibility semantics.
- Do not add route geometry, native map provider work, distance/time estimates, transport summaries, cross-day map browsing, or new map APIs.

#### `/trips/{tripId}/settle`

- The settle tab is scoped to the selected trip’s calendar-today Day only.
- If no current Day exists, render settle-specific unavailable state with:
  - primary CTA: `일정 보기` → `/trips/{tripId}/itinerary`
  - secondary CTA: `여행 정보 보기` → `/trips/{tripId}/detail`
- If a current Day exists, show a slim tab-specific read-only current-day expense/settlement-entry surface using existing day expense data and `apps/mobile/lib/trips/day-expenses.ts` semantics where applicable.
- Preserve existing amount labels, payer/split detail lines, loading/error/empty/success meanings, and ordering when reusing day expense helpers.
- Do not add true settlement balances, netting, transfer/payment CTA, person-level summaries, new grouping/filtering, or trip-level quick-expense entry in #162.
- Existing day-scoped quick-expense under `/trips/{tripId}/days/{date}/expenses/quick` remains available from the Day detail flow.

#### Hidden route back/fallback matrix

Prefer real navigation history pop when available. When there is no prior in-shell history, use these fallbacks:

| Route | No-history fallback |
|---|---|
| `/trips/{tripId}/detail` | `/trips/{tripId}/today` |
| `/trips/{tripId}/edit` | `/trips/{tripId}/detail`, then `/trips/{tripId}/today` |
| `/trips/{tripId}/participants` | `/trips/{tripId}/detail`, then `/trips/{tripId}/today` |
| `/trips/{tripId}/days/{date}` | `/trips/{tripId}/itinerary` |
| `/trips/{tripId}/days/{date}/place-search` | owning `/trips/{tripId}/days/{date}`, then `/trips/{tripId}/itinerary` |
| `/trips/{tripId}/days/{date}/places/new` | owning `/trips/{tripId}/days/{date}`, then `/trips/{tripId}/itinerary` |
| `/trips/{tripId}/days/{date}/expenses/quick` | owning `/trips/{tripId}/days/{date}`, then `/trips/{tripId}/itinerary` |
| root tab with no pre-trip history | `/` |

- If an owning Day route cannot load because the date/trip is invalid or inaccessible, show that route’s existing not-found/error state with a CTA to itinerary rather than silently redirecting to today.
- Existing modal/overlay flows should return to their exact originating route after cancel/save/dismiss. If opened from a hidden route, return to that hidden route. Only use fallbacks when no origin/history exists.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- #162 changes mobile navigation IA and presentation only. It must not change trip status policy, itinerary ordering, lodging rules, map URL construction, expense split math, or settlement domain policy.
- The selected trip is explicit from `tripId`; do not choose another ongoing trip inside trip tab routes.
- Today/map/settle current-day resolution is strict local calendar today within the selected trip.
- Trip switching always collapses to the destination trip’s today root.
- `/` behavior remains unchanged until #163.
- Route helpers should make canonical paths explicit so old and new callers do not mix `/trips/{id}` detail semantics accidentally.

## Acceptance Criteria

- [x] AC-01: `docs/features/0162-trip-tabs-ia.md` contains the approved spec and TDD implementation plan.
- [x] AC-02: `apps/mobile/app/_layout.tsx` remains the global Stack.
- [x] AC-03: `apps/mobile/app/trips/[tripId]/_layout.tsx` introduces the trip shell with visible tabs for `today`, `map`, `itinerary`, and `settle` only.
- [x] AC-04: `/trips/{tripId}` redirects/replaces to `/trips/{tripId}/today`; old trip detail content is available at hidden `/trips/{tripId}/detail`.
- [x] AC-05: Existing trip detail/day callers and route helpers are updated to target `/detail`, `/today`, `/itinerary`, or `/days/{date}` intentionally.
- [x] AC-06: Root tab switching does not grow push history, tapping the active tab is a no-op, and hidden detail state is not restored by tab presses.
- [x] AC-07: Hidden routes render inside the trip shell with shared AppBar/TripSwitcherSheet available and TripTabBar hidden.
- [x] AC-08: Hidden route back behavior follows the fallback matrix when no prior history exists.
- [x] AC-09: Shared AppBar displays real trip name and participant preview data from current APIs, opens TripSwitcherSheet from the title, and uses tokenized styles only.
- [x] AC-10: TripSwitcherSheet is mounted once and switching trips always `replace`s to `/trips/{newTripId}/today`.
- [x] AC-11: `/trips/{tripId}/today` reuses/extracts current Today execution behavior for the explicit trip, removes the old `BottomMenu`, and preserves existing Today states/actions when a current Day exists.
- [x] AC-12: Today no-current-day state renders in place with `일정 보기` → itinerary and `여행 정보 보기` → detail; it does not redirect.
- [x] AC-13: `/trips/{tripId}/itinerary` renders a trip-level day list for all loaded trip days and pushes existing `/days/{date}` detail on row tap.
- [x] AC-14: `/trips/{tripId}/map` renders current-day map-affordance content when a current Day exists, preserves existing map/copy behavior, and otherwise shows map-specific unavailable state.
- [x] AC-15: `/trips/{tripId}/settle` renders current-day read-only expense/settlement-entry content when a current Day exists and otherwise shows settle-specific unavailable state.
- [x] AC-16: #162 does not add true map routing, true settlement/netting, cross-day map/settle browsing, trip-level quick expense, API changes, DB changes, new dependencies, raw hex colors, or new design tokens.
- [x] AC-17: Existing Day detail, place search/new place, quick expense, edit, and participant routes remain reachable and do not appear as tab items.
- [x] AC-18: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
- [ ] AC-19: Manual smoke confirms tab switching, Android/iOS back behavior, trip switching, direct `/trips/{id}` alias, direct hidden-route fallback, and existing Day/detail flows.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Canonical route helpers for today/detail/itinerary/map/settle/day detail preserve route contract | Mobile helper | new/updated `apps/mobile/lib/trips/*route*.test.mts` or adjacent route helper test | `pnpm --filter @i-um/mobile test` |
| Strict current-day resolution for explicit tripId and no fallback to nearest/last day | Mobile helper | new/updated Today trip-shell helper test | `pnpm --filter @i-um/mobile test` |
| Today unavailable state CTA routes and copy are deterministic | Mobile helper | new/updated `today-execution` or trip-tab state test | `pnpm --filter @i-um/mobile test` |
| Itinerary tab day list maps trip days and pushes `/days/{date}` | Mobile helper | new/updated day list/navigation helper test | `pnpm --filter @i-um/mobile test` |
| Map tab preserves Google Maps URL, copy-address disabled/helper/feedback semantics | Mobile helper | existing `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` plus new tab view-model tests | `pnpm --filter @i-um/mobile test` |
| Settle tab preserves day expense amount/detail/empty/error semantics | Mobile helper | existing/new `apps/mobile/lib/trips/day-expenses.test.mts` | `pnpm --filter @i-um/mobile test` |
| Hidden route fallback matrix is encoded in pure helper(s) | Mobile helper | new navigation fallback helper test | `pnpm --filter @i-um/mobile test` |
| Trip shell/screens compile with Expo Router route types/imports | Mobile type/static | trip shell and screen files | `pnpm --filter @i-um/mobile typecheck` |
| No API/DB/generated drift | Static review | Diff review | `git diff --name-only -- packages/api-contract apps/api apps/mobile/lib/trips/client.ts` |
| Final mobile gate | Mobile | mobile tests/types | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- The project does not currently have a full React Navigation/Expo Router e2e harness for asserting native back stack and tab history semantics.
  - Risk: tab/detail back behavior may differ on iOS, Android, and cold deep links.
  - Follow-up: manual simulator/device smoke for #162; consider navigation e2e harness later.
- AppBar/TripTabBar visual layout and safe-area behavior are not fully covered by unit tests.
  - Risk: header/tab spacing or hidden-route tab visibility may regress visually.
  - Follow-up: manual smoke on iOS/Android form factors.
- Map and settle tabs are intentionally MVP-limited to existing current-day affordances/data.
  - Risk: users may expect full map or true settlement behavior from the tab labels.
  - Follow-up: dedicated map/settlement product slices after semantics are approved.

## TDD Implementation Plan

1. Red: Add route contract/fallback helper tests for canonical tab paths, `/trips/{id}` alias behavior, `/detail`, hidden Day routes, and no-history fallback matrix.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Red: Add/extend Today helper tests for explicit `tripId` selection, strict calendar-today day resolution, and no-current-day unavailable CTA routes.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Add itinerary tab helper tests for day list view models and day-row route targets.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Red: Add map/settle tab state tests for current-day unavailable states and preservation of existing map action / day expense semantics.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Green: Implement pure route/current-day/view-model helpers first; keep route params, fetch orchestration, and navigation side effects in screens.
   - Verify: `pnpm --filter @i-um/mobile test`
6. Green: Add the trip shell `_layout.tsx`, four tab root screens, shared AppBar/TripSwitcherSheet wiring, and hidden-route tab hiding/back fallback behavior.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
7. Green: Extract/reuse current Today execution UI for `/trips/{id}/today` without changing `/` behavior; remove `BottomMenu` only from the trip Today route.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
8. Green: Move current trip-detail content to `/detail`, make `/trips/{id}` redirect to `/today`, and update route helpers/callers/tests.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
9. Refactor: Remove duplicate route/string logic, keep styling tokenized, and avoid broad Day screen rewrites beyond route/back integration.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
10. Gate: Run final mobile gates and complete manual smoke checklist.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (250 tests)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass

### Manual Smoke

- Tab switching/back/trip switch/deep-link hidden routes: not run — simulator/device smoke pending

## Release Notes

- 트립 내부에 오늘·지도·일정·정산 탭 구조를 도입해, 자주 오가는 여행 실행 화면을 push stack 대신 같은 트립 안의 탭으로 이동하도록 정리한다.

## Open Questions

- None. Ouroboros clarification fixed #162 to: canonical `/today`, explicit `/detail`, strict local-calendar current day, trip switch always to destination today, hidden route-specific back fallback, #163-owned home redirect/slimming.

## Follow-up Issues

- #163 — `/` 홈 슬림화와 진행 중 여행 딥링크 적용
- Future map slice — full route map/provider/cross-day map experience
- Future settlement slice — true balances/netting/payment workflow
