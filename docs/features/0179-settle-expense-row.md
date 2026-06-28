# Feature Slice: 정산 탭 ExpenseRow 이관

## Metadata

- GitHub Issue: #179
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #179 — [Mobile UI Refactor follow-up] 정산 탭 컴포넌트 기반 화면 구성
- Depends on: #175 merged into `origin/develop`
- Ouroboros/PM/Seed: `interview_20260628_171114` / `seed_82919c8a0bf3` (ambiguity 0.11)
- Current sources: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`, `apps/mobile/lib/trips/day-expenses.ts`, `apps/mobile/lib/trip-ui/ExpenseRow.tsx`

## Goal

정산 탭의 현재 today-expense list 동작을 유지하면서 지출 row 렌더링을 #175 `ExpenseRow`로 이관한다. true settlement balance/transfer UI는 #55~#58 계산 source-of-truth와 통화/참여자 정책이 승인될 때까지 사용자에게 표시하지 않는다.

## Scope

- App UI: yes — `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx` success list rows use `ExpenseRow` when safe
- Mobile helpers: yes — expose row fields needed by `ExpenseRow` while preserving existing amount/detail labels
- API/DB/generated: no changes
- Tests: update `day-expenses` helper tests for row fields and existing formatting

## Out of Scope

- `SettlementBalanceCard` or `TransferRow` screen connection
- Local netting/transfer suggestions as authoritative user-facing settlement results
- Multi-currency conversion or settlement-complete state
- Participant fallback/deleted participant policy changes
- API/OpenAPI/server/DB/generated code changes

## Acceptance Criteria

- [ ] Current settle tab loading/auth/not-found/error/unavailable/empty states are preserved.
- [ ] Current success list information remains equivalent: title, payer, split summary, amount/currency.
- [ ] Success list rows use `ExpenseRow` for all currently supported day expense rows.
- [ ] Minor presentation differences from shared row spacing/icon treatment are allowed.
- [ ] `SettlementBalanceCard`/`TransferRow` remain unmounted until #55~#58.
- [ ] No API/DB/generated code changes.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Day expense row labels/amounts for ExpenseRow | Unit | `apps/mobile/lib/trips/day-expenses.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing day expense empty/failure behavior | Unit | existing day-expenses tests | `pnpm --filter @i-um/mobile test` |
| Settle tab + ExpenseRow props compile | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- True settlement balance/transfer smoke is not applicable; those components remain unmounted.
  - Risk: future #55~#58 integration still needs product/API decisions.
  - Follow-up: settlement API/policy specs.
- Device visual smoke for row spacing is not automated.
  - Risk: row icon/wrapping may need later tuning.
  - Follow-up: manual settle tab smoke with expenses.

## TDD Implementation Plan

1. Red: update `day-expenses` tests for numeric amount/currency, payer label, split label, and category fallback used by `ExpenseRow`.
2. Green: extend `DayExpenseRowViewModel` with backward-compatible fields while keeping existing labels.
3. Green: swap settle tab `ListRow` expense rows to `ExpenseRow`.
4. Gate: run mobile tests/typecheck/lint/format.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (272 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx apps/mobile/lib/trips/day-expenses.ts apps/mobile/lib/trip-ui/ExpenseRow.tsx`: pass (no matches)

### Manual Smoke

- Settle tab with/without expenses: not run — manual smoke deferred; helper tests and typecheck cover row data mapping

## Release Notes

- Team-facing: 정산 탭의 기존 오늘 지출 목록 row가 shared `ExpenseRow` 기반으로 정리된다. 실제 정산 금액/송금 결과는 아직 표시하지 않는다.

## Open Questions

- None for this safe refactor slice.

## Follow-up Issues

- #55~#58 — true settlement API/policy/summary/transfer work
- #173 — today spend card
