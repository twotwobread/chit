# Feature Slice: 홈 슬림화와 진행 중 여행 딥링크 적용

## Metadata

- GitHub Issue: #163
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-28
- Updated: 2026-07-04
- Superseded behavior: Issue #221 changes ordinary root `/` entry to render Home instead of auto-redirecting to an ongoing trip Today page.

## Source

- Issue: #163 — [Mobile UI Refactor 6/6] 홈 슬림화와 진행 중 여행 딥링크 적용
- Depends on: #162 — 트립 레벨 Tabs IA 도입, closed/merged into `origin/develop` via PR #172
- Ouroboros/PM/Seed: Interview `interview_20260628_122754`; ambiguity score `0.096` (`0.10` in seed output); Seed `seed_d692f3803df3` (MCP output, no local seed file path)
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md` sections 2-4, `refactor/PROMPT.md` task 6
- Current mobile sources: `apps/mobile/app/index.tsx`, `apps/mobile/app/mypage.tsx`, `apps/mobile/app/trips/[tripId]/_layout.tsx`, `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx`, `apps/mobile/lib/navigation/BottomMenu.tsx`, `apps/mobile/lib/trips/status.ts`, `apps/mobile/lib/trips/mypage.ts`, `apps/mobile/lib/trips/routes.ts`
- Notes: #162 already owns the trip shell and canonical `/trips/{tripId}/today`. #163 owns changing `/` from Today execution into slim Home plus active-trip root redirect.

## Supersession Note

As of issue #221, the active-trip redirect portion of this #163 spec is no longer current behavior. Ordinary root `/` entry renders the Home management surface even when an ongoing trip exists; the ongoing trip remains available through the pinned Home resume CTA and explicit `/trips/{id}/today` routes. The rest of this document records the original #163 implementation context and remains useful only where it does not conflict with #221.

## Goal

앱 실행 또는 일반적인 루트(`/`) 진입 시 진행 중 여행이 있으면 사용자를 해당 여행의 `/trips/{id}/today`로 바로 보내고, 진행 중 여행이 없거나 사용자가 명시적으로 홈을 선택한 경우에는 여행 전환/관리 중심의 슬림 홈을 보여준다.

`apps/mobile/app/index.tsx`는 더 이상 오늘 실행 로직을 소유하지 않고, 인증/여행 목록 상태와 홈 관리 UI만 조립한다.

## User Flow

1. 사용자가 앱을 실행하거나 딥링크/새 평가로 `/`에 일반 진입한다.
2. 앱은 세션을 확인하고, 로그인 상태라면 여행 목록 조회가 끝날 때까지 루트 loading/error 상태를 명시적으로 보여준다.
3. 여행 목록 조회 성공 후 기존 진행 중 판단 정책으로 현재 여행을 선택한다.
   - 진행 중 여행이 있으면 `/trips/{tripId}/today`로 `replace`한다.
   - 진행 중 여행이 없으면 슬림 홈을 렌더링한다.
4. 진행 중 여행 화면에 자동 진입한 사용자는 트립 shell AppBar의 명시적 `홈` affordance를 눌러 슬림 홈으로 나갈 수 있다.
5. 사용자가 명시적으로 홈에 들어온 경우, 이번 navigation action에 한해 active-trip redirect를 우회하고 홈 관리 화면을 유지한다.
6. 홈의 진행 중 여행 핀/CTA는 `/trips/{tripId}/today`로 여행을 재개한다. 일반 여행 row는 `/trips/{tripId}/detail`로 관리/상세 화면을 연다.
7. 홈과 마이페이지에서는 축소된 전역 BottomMenu가 `홈 / 마이`로 동작한다. 트립 화면에서는 BottomMenu를 표시하지 않고 #162의 TripTabBar와 AppBar affordance만 사용한다.

## Scope

- App UI: yes — `apps/mobile/app/index.tsx`, `apps/mobile/app/mypage.tsx`의 Home/My navigation integration, `apps/mobile/app/trips/[tripId]/_layout.tsx` AppBar Home affordance, `apps/mobile/lib/navigation/BottomMenu.tsx`
- App Logic: yes — root redirect decision helper, one-shot explicit Home intent handling, home trip-list view model/deduped grouping, route destination helpers if needed
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile helper/view-model/navigation contract tests plus typecheck
- Deploy/Smoke: no staging deploy required; simulator/device smoke required before implementation completion

## Out of Scope

- Changing trip status policy. 진행 중 판단은 기존 `apps/mobile/lib/trips/status.ts`의 `groupTripsByStatus` / `selectCurrentTrip` policy를 유지한다.
- Redesigning My Page. `mypage.tsx`는 existing access path와 reduced BottomMenu semantics만 맞춘다.
- Changing #162 trip tab IA: `today`, `map`, `itinerary`, `settle` TripTabBar behavior remains intact.
- Adding new APIs, OpenAPI schemas, server behavior, DB migrations, generated code, or new dependencies.
- Reworking Today execution UI/actions. `/trips/{tripId}/(tabs)/today.tsx` remains the owner of execution behavior.
- Adding persistent user preference for staying on Home while an ongoing trip exists.
- Creating a separate public Home route for management. Observable destination remains `/`.

## Requirements

### UI / UX

#### Root `/` entry contract

- `apps/mobile/app/index.tsx` becomes the root Home/redirect orchestrator, not a Today execution screen.
- Remove Today execution ownership from `index.tsx`, including selected-trip execution loading, route preview, arrive/skip/restore/navigation action handling, and old Today content rendering.
- Ordinary root entry means app launch, cold/fresh root evaluation, reload/remount, auth restore, or external/deep link to `/` without an explicit in-app Home intent.
- Ordinary logged-in root entry must block on trip-list resolution before rendering Home:
  - loading: show root-level loading copy such as `여행을 확인하는 중...`; do not render Home shell or BottomMenu yet.
  - error before redirect decision: show dedicated retry-only root error; do not expose Home/My navigation until trip-list fetch succeeds.
  - success with current trip: `router.replace(tripTodayPath(currentTrip.id))` or equivalent replace redirect.
  - success without current trip: render slim Home.
- Logged-out/missing/corrupt session remains explicit:
  - show login-required state and CTA to `/login`.
  - do not try to fetch trips.
  - do not show Today execution UI.
- Use existing trip-list API behavior (`listMyTrips`) and auth/session behavior; do not add API changes.

#### Explicit Home intent and one-shot bypass

- Explicit Home intent is created only by an in-app user action that clearly means Home/management:
  - Trip shell AppBar `홈` affordance from root trip tabs.
  - Reduced BottomMenu `홈` from My Page.
  - Any future in-app Home CTA introduced for this same management purpose.
- Explicit Home intent bypasses active-trip redirect for that navigation action only.
- The bypass must not be persisted as a session preference.
- A later fresh evaluation of `/` — app restart, reload, deep link to `/`, remount without explicit intent, or auth restore — must re-apply active-trip redirect if an ongoing trip exists.
- Implementation may encode explicit intent through a private in-app navigation signal/helper. Do not make a public deep-link query contract the product source of truth.
- Once Home is rendered from an explicit intent, same-screen trip-list refreshes should not immediately bounce the user back to `/today`; the bypass is consumed for that mounted Home visit.

#### Slim Home surface

- Home is a trip-switching/management surface, not a mandatory execution gate.
- Home states must be explicit:
  - loading: trip list loading inside Home when reached by explicit Home intent or when no redirect decision is needed.
  - logged-out: login CTA.
  - empty: no trips; show create-trip CTA to `/trips/new`.
  - error: trip list error with retry.
  - populated: current trip pin when applicable plus grouped trip list.
- Home header/copy should communicate management, not execution. Example intent:
  - title: `홈`
  - subtitle: `내 여행을 확인하고 관리해요.`
- If a current/ongoing trip exists and Home is intentionally opened:
  - show a pinned current-trip section/card at the top.
  - the pinned card is the resume action and navigates to `/trips/{tripId}/today`.
  - copy should clearly indicate current trip/resume, e.g. `진행 중인 여행`, `여행 이어가기`.
- Deduplicate the pinned current trip from the grouped list below.
  - The pinned current trip appears only in the current-trip section.
  - The grouped list focuses on remaining trips, especially upcoming and past items.
  - If there are other ongoing trips besides the pinned first current trip, they may appear in the grouped `진행 중인 여행` section as ordinary management rows.
- Ordinary grouped trip rows navigate to `/trips/{tripId}/detail` via `tripDetailPath`, not the `/trips/{tripId}` alias.
- Preserve existing trip row essentials from My Page patterns:
  - trip name
  - date range
  - default currency
  - role label
  - participant count label
- Use existing grouping/sorting policy from `apps/mobile/lib/trips/status.ts`.

#### Reduced BottomMenu

- Keep a reduced two-item BottomMenu only on management surfaces:
  - `/` Home
  - `/mypage` when My Page is in its ready/management state
- BottomMenu labels and semantics are:
  - `홈` → slim Home at `/`
  - `마이` → `/mypage`
- Remove/rename the old `오늘` label from global BottomMenu. The global BottomMenu must not imply `/trips/{id}/today`.
- Pressing `홈` while already on Home is a no-op.
- Pressing `홈` from My Page while an ongoing trip exists is an explicit Home intent and opens slim Home directly, not an ordinary root launch redirect.
- Pressing `마이` from Home opens My Page.
- Do not show BottomMenu on trip shell, trip execution tabs, trip detail/edit/participants, Day detail, or nested trip routes.
- Do not stack BottomMenu under #162 TripTabBar.

#### Trip shell Home affordance

- After active-trip auto-redirect, the trip screen must expose a visible way to intentionally open Home.
- On trip root tabs (`/trips/{id}/today`, `/map`, `/itinerary`, `/settle`), the shared AppBar left control should be an explicit Home affordance, not an ambiguous back-only control.
  - Accessibility label/copy should say `홈` or `홈으로`.
  - Pressing it opens slim Home with explicit one-shot bypass semantics.
- Hidden/detail trip routes should preserve #162 contextual back/fallback behavior unless implementation can also expose Home without breaking back behavior.
- Trip root tabs keep TripTabBar for Today/Map/Itinerary/Settle.
- Trip screens do not show the reduced global BottomMenu.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- Ongoing/current trip selection uses the existing local-date status policy: `startDate <= today <= endDate`.
- If multiple ongoing trips exist, select the first trip according to the existing `groupTripsByStatus` ongoing sort order.
- Root redirect target is always the selected trip’s canonical today route: `/trips/{tripId}/today`.
- `/trips/{tripId}` remains #162’s alias to `/trips/{tripId}/today`; Home list rows must use explicit `/detail` for management.
- Explicit Home intent is one-shot and in-app only; it is not a stored preference and not a product-level public URL mode.
- #163 must not change Today execution action semantics, trip tab route semantics, map/settle/itinerary behavior, or My Page profile/settings behavior.
- Styling must use mobile design tokens/shared primitives where practical; no new raw hex colors in screen code.

## Acceptance Criteria

- [x] AC-01: `docs/features/0163-home-active-trip-redirect.md` contains the spec and TDD implementation plan for #163.
- [x] AC-02: `apps/mobile/app/index.tsx` no longer owns Today execution loading/actions/route preview/rendering and instead owns root redirect plus slim Home orchestration.
- [x] AC-03: Ordinary logged-in `/` entry shows a blocking loading state while trip list resolution is pending and does not flash the Home shell before redirect.
- [x] AC-04: Ordinary logged-in `/` entry shows a retry-only root error state if trip-list resolution fails before redirect/Home decision.
- [x] AC-05: Ordinary logged-in `/` entry redirects/replaces to `/trips/{id}/today` when existing status helpers select an ongoing trip.
- [x] AC-06: Ordinary logged-in `/` entry renders slim Home when no ongoing trip exists.
- [x] AC-07: Logged-out/missing/corrupt session root states remain explicit with login CTA and no trip execution UI.
- [x] AC-08: Explicit Home intent from trip AppBar opens slim Home even when an ongoing trip exists.
- [x] AC-09: Explicit Home intent from My Page `홈` BottomMenu opens slim Home even when an ongoing trip exists.
- [x] AC-10: Explicit Home bypass is one-shot/in-app only; later fresh `/` evaluation redirects again when an ongoing trip exists.
- [x] AC-11: Slim Home renders loading, empty, error, and populated states explicitly.
- [x] AC-12: Slim Home populated state shows a pinned current-trip resume card when an ongoing trip exists and Home is intentionally opened.
- [x] AC-13: The pinned current-trip card navigates to `/trips/{id}/today`.
- [x] AC-14: The pinned current trip is omitted from the grouped Home list below.
- [x] AC-15: Ordinary grouped Home trip rows navigate to `/trips/{id}/detail`.
- [x] AC-16: Reduced BottomMenu is relabeled to `홈 / 마이`, routes to `/` and `/mypage`, and no longer uses the global `오늘` label.
- [x] AC-17: Reduced BottomMenu is shown only on Home/My management surfaces and is absent from trip shell/execution/detail screens.
- [x] AC-18: Trip root tabs keep #162 TripTabBar and expose an AppBar Home affordance that does not add a second bottom navigation layer.
- [x] AC-19: My Page itself is not redesigned beyond the reduced navigation label/target behavior needed by #163.
- [x] AC-20: No API contract, server, DB, generated-code, or trip-status-policy changes are introduced.
- [x] AC-21: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
- [ ] AC-22: Manual smoke covers logged-out, ordinary launch with/without ongoing trip, explicit Home bypass, My→Home, current-trip resume, grouped row detail, and BottomMenu absence on trip screens.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Existing status policy selects ongoing trips without policy changes | Mobile helper | existing/updated `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| Root decision separates ordinary entry from explicit Home intent | Mobile helper | new `apps/mobile/lib/trips/home-root.test.mts` or adjacent helper test | `pnpm --filter @i-um/mobile test` |
| Ordinary root loading/error/redirect/Home outcomes are deterministic | Mobile helper | new root state/view-model tests | `pnpm --filter @i-um/mobile test` |
| One-shot explicit Home bypass does not become session-sticky | Mobile helper | new root intent helper tests | `pnpm --filter @i-um/mobile test` |
| Home populated view model shows pinned current trip and dedupes grouped list | Mobile helper | new/updated `apps/mobile/lib/trips/home.test.mts` or `mypage.test.mts` extraction tests | `pnpm --filter @i-um/mobile test` |
| Pinned current card routes to `/today`; ordinary rows route to `/detail` | Mobile helper | Home view-model/route target tests | `pnpm --filter @i-um/mobile test` |
| BottomMenu labels/targets are Home/My and no `오늘` global label remains | Mobile helper/static | BottomMenu config/helper tests plus static review | `pnpm --filter @i-um/mobile test` |
| Trip shell root-tab AppBar Home affordance route and hidden-route back preservation are explicit | Mobile helper/static | route/back helper tests or focused component integration by type/static review | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |
| `index.tsx` no longer imports Today execution/map route preview execution dependencies | Static review | diff/import review | `git diff -- apps/mobile/app/index.tsx` |
| No API/DB/generated drift | Static review | diff review | `git diff --name-only -- packages/api-contract apps/api apps/mobile/lib/trips/client.ts` |
| Final mobile gate | Mobile | mobile tests/types | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- The project does not currently have a full Expo Router/native e2e harness for proving cold launch, deep link, remount, and one-shot in-app navigation intent behavior end to end.
  - Risk: the internal bypass signal could persist too long or be lost too early on device.
  - Follow-up: manual simulator/device smoke for ordinary launch, My→Home, trip AppBar Home, reload/remount, and deep link to `/`.
- BottomMenu and AppBar visual placement/labels are not fully covered by unit tests.
  - Risk: duplicated navigation could reappear visually even if helpers pass.
  - Follow-up: manual smoke on trip root tabs and management screens.
- My Page remains intentionally not redesigned.
  - Risk: Home and My Page trip-list presentations may temporarily differ in layout polish.
  - Follow-up: future My Page design pass only if product requests it.

## TDD Implementation Plan

1. Red: Add root decision helper tests for ordinary entry states:
   - missing/corrupt session → login state
   - logged-in trip-list loading → blocking loading
   - trip-list error → retry-only root error
   - ongoing trip → redirect target `tripTodayPath(id)`
   - no ongoing trip → render Home
   - Verify: `pnpm --filter @i-um/mobile test`
2. Red: Add explicit Home intent tests:
   - trip AppBar Home / My Page Home intent bypasses redirect when ongoing trip exists
   - bypass is one-shot and not persisted across fresh root evaluations
   - same mounted explicit Home visit does not bounce on ordinary list refresh
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Add Home view-model tests:
   - current trip pin uses existing ongoing selection/sort
   - pinned current trip route is `/trips/{id}/today`
   - pinned current trip is omitted from grouped list
   - ordinary row routes are `/trips/{id}/detail`
   - empty/error/loading/populated copy/action model is explicit
   - Verify: `pnpm --filter @i-um/mobile test`
4. Red: Add/update BottomMenu/navigation contract tests or helper snapshots:
   - labels are `홈` and `마이`
   - Home target is explicit Home intent to `/`
   - My target is `/mypage`
   - no global `오늘` label remains
   - Verify: `pnpm --filter @i-um/mobile test`
5. Green: Extract pure root/Home helpers in `apps/mobile/lib/trips/**` using existing `groupTripsByStatus`, `selectCurrentTrip`, route helpers, and My Page label helpers where practical.
   - Verify: `pnpm --filter @i-um/mobile test`
6. Green: Rewrite `apps/mobile/app/index.tsx` to remove Today execution imports/state/actions/rendering and compose root redirect plus slim Home states.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
7. Green: Update `BottomMenu` to Home/My labels and explicit Home intent routing, then wire it only on Home/My management surfaces.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
8. Green: Update trip shell AppBar behavior so root trip tabs expose explicit Home affordance while hidden/detail route back fallback remains aligned with #162.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
9. Refactor: Remove duplicate Home/My trip-list helpers, keep styles tokenized, and ensure `mypage.tsx` is not redesigned beyond navigation changes.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
10. Gate: Run final mobile checks and complete manual smoke checklist.
    - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (261 tests)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `git diff --check`: pass

### Manual Smoke

- Root launch / explicit Home bypass / BottomMenu labels / trip AppBar Home: not run — simulator/device smoke pending

## Release Notes

- 앱 시작 시 진행 중 여행이 있으면 바로 오늘 탭으로 진입하고, 홈은 여행을 관리하거나 전환할 때 명시적으로 여는 슬림한 여행 목록 화면으로 정리한다.

## Open Questions

- None. Ouroboros clarification fixed the redirect scope, one-shot Home bypass, BottomMenu placement/labels, Home current-trip pin/deduplication, and route destinations.

## Follow-up Issues

- Future navigation e2e harness — cold launch/deep link/remount and one-shot Home intent regression coverage
