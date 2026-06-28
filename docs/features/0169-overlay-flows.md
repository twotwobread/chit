# Feature Slice: 등록·수정·선택 플로우 BottomSheet 오버레이 전환 기준 + 첫 Slice

## Metadata

- GitHub Issue: #169
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #169 — [Mobile UI Refactor Follow-up] 등록·수정·선택 플로우 BottomSheet 오버레이 전환
- Spawned from: #160
- Related: #159, #162, #163, #175, #180
- Ouroboros/PM/Seed: `interview_20260628_174956` / `seed_f6ccecd0b30b` (ambiguity 0.12)
- Current sources: `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx`, `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`, `apps/mobile/lib/trip-ui/BottomSheet.tsx`, `apps/mobile/lib/trip-ui/QuickExpenseForm.tsx`, `apps/mobile/lib/trips/quick-expense.ts`

## Goal

모바일의 짧은 등록·수정·선택·확인 플로우를 언제 BottomSheet/Modal overlay로 전환할지 기준을 정하고, 첫 vertical slice로 Today 탭의 빠른 지출 등록 route push를 화면 소유 BottomSheet overlay로 줄인다.

## Overlay Conversion Rule

Use overlay only when the flow is:

- short and single-purpose;
- contextual to the current screen;
- not shareable/browser/deep-link critical;
- safe to close by dropping unsaved draft;
- able to refresh the owning screen after save;
- implementable with existing API/helper/form contracts.

Keep a route when the flow is:

- long or multi-step;
- an independent detail/edit surface;
- shareable, browser-addressable, or deep-link critical;
- dependent on back-stack/draft preservation;
- likely to need broader IA/API/domain policy changes.

## First Vertical Slice

- Convert Today tab quick-expense actions from `router.push(quickExpenseRoute)` to a non-navigating `BottomSheet` overlay.
- Preserve the existing `/trips/{tripId}/days/{date}/expenses/quick` route as the deep-link/fallback wrapper.
- Keep Day detail quick-expense entry as route push for now; migrate it in a follow-up after this pattern lands.

## Overlay Lifecycle Policy

- Open: screen-owned local state; no `router.push`.
- Backdrop/close/Android back: close overlay and drop unsaved draft.
- Loading: show inline loading state inside sheet.
- Validation: stay in sheet and show inline validation errors.
- Network/API error: stay in sheet with retry/close where applicable.
- Auth error: close sheet and move owning screen to existing auth state.
- Save success: close sheet, refresh owning screen in place, and show a short success message.
- Accessibility: use existing `BottomSheet` modal/backdrop semantics; owning screen remains route-stable.

## Scope

- App UI: yes — Today tab quick-expense action interception + sheet rendering
- Shared UI: yes — `QuickExpenseForm` can honor explicit `null` item/payer initial draft and decimal input
- Mobile helpers: yes — parse quick-expense routes for safe overlay interception
- API/DB/generated: no changes
- Existing quick-expense route: preserve unchanged as fallback/deep link

## Out of Scope

- Converting every route/form in one PR
- Removing quick-expense route wrappers
- Day detail quick-expense overlay conversion
- Place search/manual place add route conversion
- Trip tabs IA changes (#162)
- New BottomSheet dependencies
- API/DB/OpenAPI/generated changes

## Backlog Order

1. Day detail quick-expense entry overlay.
2. Short place/option selectors that do not require deep links.
3. Confirmation-only actions where existing custom modal behavior can be standardized.
4. Audit already-overlay flows (trip switching #159, companions/invite #180) against this policy.

## Acceptance Criteria

- [ ] Overlay/route criteria and backlog order are documented.
- [ ] Today quick-expense action opens a `BottomSheet` overlay instead of pushing the quick-expense route.
- [ ] Non-quick route actions still navigate normally.
- [ ] Existing quick-expense route remains available.
- [ ] Overlay loading/error/validation/auth/success lifecycle follows the policy above.
- [ ] Successful save closes the sheet, refreshes Today, and shows success feedback.
- [ ] No API/DB/generated/dependency changes.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Quick-expense route parsing for overlay interception | Unit | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing quick-expense request/money/split helpers | Unit | existing quick-expense tests | `pnpm --filter @i-um/mobile test` |
| Today overlay wiring and form props compile | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Theme/token rule | Static grep | touched files | `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" ...` |

## Regression Gaps

- Navigation stack behavior is not covered by automated UI tests.
  - Risk: future refactors could reintroduce route push.
  - Follow-up: manual smoke or navigation test harness.
- Device keyboard/focus behavior inside `BottomSheet` is not automated.
  - Risk: amount input ergonomics may need tuning.
  - Follow-up: manual Today quick-expense smoke.

## TDD Implementation Plan

1. Red: add tests for parsing quick-expense routes into overlay targets.
2. Green: implement route parser in `quick-expense.ts`.
3. Green: make `QuickExpenseForm` respect explicit null item/payer initial draft and decimal amount input.
4. Green: intercept Today quick-expense route actions and render a screen-owned `BottomSheet` using existing quick-expense API/helper contracts.
5. Gate: run tests/typecheck/lint/format and token grep.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (274 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/trips/[tripId]/(tabs)/today.tsx apps/mobile/lib/trip-ui/QuickExpenseForm.tsx apps/mobile/lib/trips/quick-expense.ts apps/mobile/lib/trips/quick-expense.test.mts`: pass (no matches)

### Manual Smoke

- Today quick-expense overlay open/close/save/error: not run — no device session available; automated gates passed

## Release Notes

- Team-facing: Today 탭의 지출 등록은 route push 없이 BottomSheet에서 처리된다. 기존 quick-expense route는 fallback/deep link로 유지된다.

## Open Questions

- None for this slice.

## Follow-up Issues

- Day detail quick-expense overlay conversion
- #169 follow-up backlog items listed above
