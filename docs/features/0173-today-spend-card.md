# Feature Slice: 오늘 탭 지출 요약 카드

## Metadata

- GitHub Issue: #173
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #173 — [Mobile UI Refactor follow-up] 오늘 탭 지출 요약 카드 추가
- Follow-up to: #163
- Depends on: #175 `TodaySpendCard`, #169 Today quick-expense overlay interception
- Ouroboros/PM/Seed: `interview_20260628_181225` / `seed_46b551727d44` (ambiguity 0.13)
- Current sources: `apps/mobile/app/trips/[tripId]/(tabs)/today.tsx`, `apps/mobile/lib/trip-ui/TodaySpendCard.tsx`, `apps/mobile/lib/trips/day-expenses.ts`, `apps/mobile/lib/trips/quick-expense.ts`

## Goal

Today 탭의 다음 장소 hero 아래에 amber `TodaySpendCard`를 표시해 오늘 지출 합계와 `지출 등록` CTA를 제공한다. 기존 `오늘 일정 바로가기` 카드는 제거하고, Today의 길찾기/도착/스킵/복구 동작은 보존한다.

## Behavior

- Today에 현재 Day가 있고 success/completed 상태이면 `TodaySpendCard`를 표시한다.
- 지출이 없으면 trip default currency 기준 `0` 금액을 표시한다.
- 지출이 있으면 `listDayExpenses(tripId, dayId)`의 `amountMinor`를 통화별로 합산한다.
- 다중 통화가 있으면 환산하지 않고 deterministic per-currency breakdown을 표시한다.
  - Trip default currency가 있으면 primary로 먼저 표시한다.
  - 나머지는 currency code 순서로 보조 금액 라인에 표시한다.
- `paidByMeAmount`는 현재 사용자와 payer/participant의 신뢰 가능한 매핑이 없으므로 표시하지 않는다.
- review status API가 없으므로 `needsReviewCount`는 0이며 badge는 숨긴다.
- CTA는 기존 quick expense route/action을 사용한다. Today에서는 #169 overlay interception에 의해 BottomSheet가 열린다.

## Scope

- App UI: yes — Today tab hero 아래 spend card 표시 및 old shortcut card 제거
- Shared UI: yes — `TodaySpendCard` supports extra per-currency amount labels
- Mobile helpers: yes — today spend summary view model
- API/DB/generated: no changes

## Out of Scope

- True settlement/netting
- Paid-by-me computation without reliable current-user participant mapping
- Review/confirmation badge beyond 0/hidden
- Currency conversion/exchange rates
- Home/Mypage/Trip IA changes
- API/DB/OpenAPI/generated changes

## Acceptance Criteria

- [ ] Today success state shows amber spend summary below hero card.
- [ ] Existing `오늘 일정 바로가기` card is removed from Today success state.
- [ ] No-expense today shows `0` amount and `지출 등록` CTA.
- [ ] Expenses are summed using existing money amount rules.
- [ ] Multi-currency expenses are shown as per-currency totals without conversion.
- [ ] CTA reuses existing quick expense action/route.
- [ ] 길찾기/도착/스킵/복구 behavior remains unchanged.
- [ ] API/DB/generated code unchanged.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Zero-expense summary uses trip default currency | Unit | `apps/mobile/lib/trips/today-spend.test.mts` | `pnpm --filter @i-um/mobile test` |
| Per-currency no-conversion totals/order | Unit | `apps/mobile/lib/trips/today-spend.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing Today action view models | Unit | existing `today-execution` tests | `pnpm --filter @i-um/mobile test` |
| Today UI wiring compiles | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Theme/token rule | Static grep | touched files | `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" ...` |

## Regression Gaps

- Visual placement below hero is not covered by automated render tests.
  - Risk: spacing/card prominence may need device tuning.
  - Follow-up: manual smoke.
- Paid-by-me remains omitted until participant identity mapping is explicit.
  - Risk: users may expect personal spend later.
  - Follow-up: separate spec once API/session mapping is reliable.

## TDD Implementation Plan

1. Red: add today spend summary helper tests for zero-expense and multi-currency cases.
2. Green: implement summary helper without currency conversion.
3. Green: extend `TodaySpendCard` for secondary currency labels.
4. Green: load today expenses in Today tab, render card below hero/completed state, remove old success shortcut card.
5. Gate: run tests/typecheck/lint/format and token grep.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (277 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/trips/[tripId]/(tabs)/today.tsx apps/mobile/lib/trip-ui/TodaySpendCard.tsx apps/mobile/lib/trips/today-spend.ts apps/mobile/lib/trips/today-spend.test.mts`: pass (no matches)

### Manual Smoke

- Today spend card no-expense/expense/CTA: not run — no device session available; automated gates passed

## Release Notes

- Team-facing: Today 탭에서 오늘 지출 요약과 지출 등록 CTA를 바로 확인할 수 있다. 다중 통화는 환산 없이 통화별로 표시한다.

## Open Questions

- None for this slice.

## Follow-up Issues

- Paid-by-me amount once reliable user/participant mapping is available
- Review-needed badge if API status is added
