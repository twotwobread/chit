# Feature Slice: 홈·마이페이지 UI 컴포넌트 이관

## Metadata

- GitHub Issue: #176
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #176 — [Mobile UI Refactor follow-up] 홈·마이페이지 UI 컴포넌트 이관
- Depends on: #175 — additional refactor components registered in `origin/develop`
- Ouroboros/PM/Seed: `interview_20260628_161026` (ambiguity 0.06); Seed generation attempted, MCP timed out before returning a seed id/path
- User direction: proceed through spec → implementation → PR → merge; choose best decisions without waking the user
- Current sources: `apps/mobile/app/index.tsx`, `apps/mobile/app/mypage.tsx`, `apps/mobile/lib/trips/home.ts`, `apps/mobile/lib/trips/mypage.ts`, `apps/mobile/lib/app-info/legal.ts`, `apps/mobile/lib/home-ui/TripCards.tsx`, `apps/mobile/lib/account-ui/AccountRows.tsx`
- Notes: preserve current behavior/information architecture first; allow minor presentational differences from #175 shared components.

## Goal

#175에서 등록한 홈/계정 UI 컴포넌트를 실제 Home/Mypage populated/ready 상태에 연결해 화면 내 중복 card/row styling을 줄인다. 기존 redirect, route, legal link, logout, trip grouping/sorting, empty/loading/error/auth states는 그대로 유지한다.

## User Flow

1. 사용자는 홈에서 기존처럼 진행 중 여행 redirect 또는 명시적 홈 방문을 경험한다.
2. 홈 populated state에서는 현재/예정/지난 여행 카드가 shared `home-ui/TripCards` 컴포넌트로 렌더링되지만, 섹션/라벨/CTA/destination은 기존과 동등하다.
3. 사용자는 마이페이지에서 프로필, 내 여행, 설정/법적 링크/로그아웃을 기존처럼 사용한다.
4. Mypage ready state의 프로필/설정/legal/account rows는 shared `account-ui/AccountRows` 컴포넌트로 렌더링되며 기존 이동/열기/로그아웃 동작은 보존된다.

## Scope

- App UI: yes — update `apps/mobile/app/index.tsx`, `apps/mobile/app/mypage.tsx` to compose #175 shared components
- Mobile view models: yes — move reusable date/currency/meta label shaping into `apps/mobile/lib/trips/home.ts` / `mypage.ts` where it affects grouping/counts/labels/section visibility
- Shared components: yes — add backward-compatible generic optional props only if required to preserve current information architecture
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: update/add mobile helper tests for new display labels and preserved grouping/dedupe
- Deploy/Smoke: manual smoke recommended after merge; no staging/internal build required

## Out of Scope

- Changing Home active-trip redirect, explicit Home intent, BottomMenu semantics, trip grouping/sorting, or destinations
- Adding new Mypage features such as notifications, default currency editing, account-link management, or new account actions
- Changing logout/account deletion/legal link policies
- API/OpenAPI/server/DB/generated code changes
- Pixel-faithful preservation of current card visuals; behavior/information equivalence is the acceptance source of truth
- Broad style cleanup unrelated to duplicated Home/Mypage card/row patterns

## Requirements

### UI / UX

- Home loading/root error/needs-login/home-error/empty states keep the existing copy and actions.
- Home populated state:
  - Current trip shortcut remains pinned only during explicit Home visits and deduped from grouped sections exactly as #163.
  - Current trip tap still navigates to `/trips/{id}/today`.
  - Grouped trip rows still navigate to hidden trip detail via `tripDetailPath`.
  - Existing labels remain represented: date range, default currency, role, participant count, and current trip CTA copy.
  - Use `ActiveTripCard`, `UpcomingTripRow`, and `PastTripRow` according to trip status where applicable.
- Mypage ready state:
  - Profile area uses `ProfileCard`; display-name fallback and provider summary semantics are preserved.
  - Trip list keeps loading/error/empty/populated behavior; populated rows may reuse `TripCards` if information/destinations remain equivalent.
  - Settings/legal/account/logout rows use `SettingsList`/`SettingRow` where possible.
  - Legal link opening disabled/error state remains tied to `openLegalLink` and `LegalLinkOpenState`.
  - Logout duplicate-submit guard and copy remain unchanged.
- Use `theme.*` and #175 shared components. Do not add raw hex colors.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- Existing behavior/information equivalence wins over shared component defaults.
- Add optional props to shared components only for generic reusable needs; keep screen-only semantics in thin screen composition/adapters.
- Screen files should orchestrate fetch/session/navigation and compose shared components; display shaping for labels/counts/date/currency belongs in `lib/trips/home.ts` or `mypage.ts` when testable.

## Acceptance Criteria

- [ ] Home populated state uses `ActiveTripCard`, `UpcomingTripRow`, and/or `PastTripRow` from `apps/mobile/lib/home-ui/TripCards.tsx` for current/grouped trip cards.
- [ ] Mypage ready state uses `ProfileCard`, `SettingsList`, and `SettingRow` from `apps/mobile/lib/account-ui/AccountRows.tsx`; `StatRow` is used when stats are available or remains unused if no current stat content exists.
- [ ] Existing Home loading/auth/error/empty states and CTA routes are preserved.
- [ ] Home current-trip pin dedupe, active-trip redirect, explicit Home bypass, and grouped-list destinations remain #163-equivalent.
- [ ] Existing Mypage login-required/error/loading states, legal link open/error state, account route, and logout flow are preserved.
- [ ] Screen-local duplicate trip/profile/settings row styling is reduced.
- [ ] No API/DB/generated code changes and no new raw hex/style tokens.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.
- [ ] Preferably `pnpm --filter @i-um/mobile lint` and `format:check` pass.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Home redirect/explicit-home/current-trip dedupe unchanged | Unit | `apps/mobile/lib/trips/home.test.mts` | `pnpm --filter @i-um/mobile test` |
| Home/Mypage reusable labels for card composition | Unit | `apps/mobile/lib/trips/home.test.mts`, `mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| Legal link helper behavior unchanged | Unit | existing `apps/mobile/lib/app-info/*.test.mts` | `pnpm --filter @i-um/mobile test` |
| New screen composition and shared component props compile | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| No raw colors in touched UI | Code review gate | targeted grep/diff | `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/index.tsx apps/mobile/app/mypage.tsx apps/mobile/lib/home-ui apps/mobile/lib/account-ui` |

## Regression Gaps

- Exact visual parity of Home/Mypage cards is not automated; this PR intentionally permits minor presentational differences from shared components.
  - Risk: spacing/hierarchy may need small follow-up tuning.
  - Follow-up: manual smoke Home/Mypage populated states after merge.
- Logout/legal link flows are preserved by helper tests and code review but not device-smoked here.
  - Risk: external Linking/native auth behavior can only be fully verified on device.
  - Follow-up: manual smoke: legal links, logout, login-required state.

## TDD Implementation Plan

1. Red: extend `home.ts`/`mypage.ts` tests for reusable display labels needed by `TripCards`/`AccountRows` composition.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Green: add date/currency/meta label fields to view models and backward-compatible generic props to `TripCards` only if needed.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Green: refactor `app/index.tsx` populated state to use `TripCards`; preserve non-populated states and routes.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
4. Green: refactor `app/mypage.tsx` ready-state profile/settings/legal/account/logout rows to use `AccountRows`; preserve trip section states and logout/legal behavior.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
5. Refactor: remove now-unused duplicated styles and helper functions from screens.
   - Verify: `pnpm --filter @i-um/mobile lint`
6. Gate: run final tests/typecheck/format and targeted raw-color grep.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (267 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/index.tsx apps/mobile/app/mypage.tsx apps/mobile/lib/home-ui apps/mobile/lib/account-ui`: pass (no matches)

### Manual Smoke

- Home redirect bypass/current trip/trip detail: not run — device/manual smoke deferred; behavior covered by helper tests and route-preserving code review
- Mypage legal links/logout/login-required state: not run — device/manual smoke deferred; helper logic and existing routes preserved

## Release Notes

- Team-facing: Home/Mypage populated UI now composes the shared #175 home/account row primitives while preserving existing routing and state behavior.

## Open Questions

- None. User delegated trade-off decisions to the agent.

## Follow-up Issues

- #177, #178, #179, #180, #169, #173 proceed after this branch is merged.
