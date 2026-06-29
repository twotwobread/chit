# Feature Slice: F-058 통화별 정산 원칙 적용

## Metadata

- GitHub Issue: #58
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #58 — [[Feature Slice] F-058 통화별 정산 원칙 적용](https://github.com/twotwobread/i-um/issues/58)
- Ouroboros/PM/Seed: Not used; `micro-spec-author` selected for a small, local, low-ambiguity UI-policy slice.
- Notes:
  - #55 is merged and already calculates settlement strictly per currency.
  - #56/#57 are merged and already render transfer/balance data in separate currency sections.
  - #59 owns MyPage settlement aggregation.
  - Issue body references `docs/delivery/*`, but those references are stale for agent process; follow `.harness` workflow/rules.
  - Spec review verdict: Approved.

## Goal

MVP 정산은 한 통화로만 발생한 여행이면 단일 통화 정산으로, 여러 통화가 섞인 여행이면 통화별 별도 정산으로 표시한다.

앱은 환율 변환, 대표 통화 환산, 통화 간 상계를 하지 않는다는 원칙을 정산 탭에서 명확히 알려준다.

## User Flow

### Single visible settlement currency

1. 사용자가 정산 탭을 연다.
2. 서버 응답에서 표시할 balance 또는 transfer가 있는 통화가 하나뿐이다.
3. 앱은 해당 통화 기준으로 정산한다는 안내를 보여준다.
4. 앱은 기존 사람별 요약과 송금 안내를 그대로 표시한다.

### Multiple visible settlement currencies

1. 사용자가 정산 탭을 연다.
2. 서버 응답에서 표시할 balance 또는 transfer가 있는 통화가 둘 이상이다.
3. 앱은 통화별로 따로 정산하며 환율 변환을 하지 않는다는 안내를 보여준다.
4. 앱은 기존 사람별 요약과 송금 안내를 통화별 섹션으로 그대로 표시한다.

### Empty settlement

1. 서버 응답에 표시할 balance 또는 transfer가 없다.
2. 앱은 기존 no-transfer empty state를 유지한다.
3. 통화 원칙 안내는 표시하지 않는다.

## Scope

- App UI: Yes
  - Extend `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`.
  - Extend mobile settlement helper/view-model code.
- API Contract: No changes.
- API Server: No changes.
- DB: No changes.
- Tests: Mobile helper/view-model tests, mobile typecheck, and final repo gates.
- Deploy/Smoke: Manual smoke or internal build verification when feasible because this is user-visible UI copy.

## Out of Scope

- FX conversion or exchange-rate lookup.
- Representative/base currency selection.
- Cross-currency netting or combining balances across currencies.
- API/DB changes.
- MyPage settlement aggregation (#59).
- Payment completion, bank/account/copy/share actions, notifications, persisted settlement runs, settlement history, or audit logs.

## Requirements

### UI / UX

- Screen path: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`.
- Success state with visible settlement currencies:
  - Show a short currency-rule notice near the top of the result.
  - A visible settlement currency is a server `currencySummaries` row where `balances.length > 0` or `suggestedTransfers.length > 0`.
  - Preserve the API order of visible currencies when composing notice copy.
- Single visible currency copy:
  - Title: `한 통화로 정산해요.`
  - Helper: `<CURRENCY> 기준으로 결제/부담과 송금 안내를 보여줘요.`
- Multiple visible currency copy:
  - Title: `통화별로 따로 정산해요.`
  - Helper: `환율 변환 없이 <CURRENCY_LIST> 금액을 각각 계산해 보여줘요.`
  - `<CURRENCY_LIST>` uses visible currency codes in API order, joined by `, `.
- Empty state:
  - Do not show the currency-rule notice when no settlement currency has balances or transfers.
  - Preserve existing no-transfer copy from #56/#57.
- Existing settlement content:
  - Person summary sections and transfer sections remain read-only.
  - Currency/row order remains server order.
  - No new CTA is introduced.

### API Contract

No API changes.

The screen consumes the existing #55 endpoint:

```text
GET /trips/{tripId}/settlement
```

Relevant response fields:

- `currencySummaries[].currency`
- `currencySummaries[].balances[]`
- `currencySummaries[].suggestedTransfers[]`

### DB Changes

No DB changes.

### Business Rules

- Server settlement data is the source of truth.
- The mobile app must not compute exchange rates, representative currency totals, or cross-currency net balances.
- The mobile app may derive display-only currency-rule copy from the presence and order of server currency summaries.
- Empty currency summaries do not affect the rule notice.
- Strict per-currency display remains the MVP rule.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0058-currency-settlement-rule.md`.
- [x] AC-02: Settle tab success state shows a currency-rule notice when at least one visible settlement currency exists.
- [x] AC-03: Single visible currency notice uses `한 통화로 정산해요.` and names that currency.
- [x] AC-04: Multiple visible currency notice uses `통화별로 따로 정산해요.`.
- [x] AC-05: Multiple visible currency helper explicitly says `환율 변환 없이`.
- [x] AC-06: Visible currencies are derived only from server summaries with balances or suggested transfers.
- [x] AC-07: Visible currency order in the notice matches API `currencySummaries` order.
- [x] AC-08: The app does not convert, combine, sort, or net amounts across currencies.
- [x] AC-09: Existing balance and transfer sections continue to preserve server order and read-only behavior.
- [x] AC-10: Empty/no-transfer state remains unchanged when there are no visible settlement currencies.
- [x] AC-11: Mobile tests cover single-currency notice, multi-currency notice, and ignoring empty currency summaries.
- [x] AC-12: No API server, OpenAPI, generated code, or DB change is introduced.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Single-currency rule notice | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Multi-currency rule notice and API-order currency list | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Empty currency summaries ignored for rule-copy selection | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Settle tab notice rendering type safety | Mobile app | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full end-to-end device verification depends on available seeded multi-currency settlement data or an internal build environment.
  - Risk: visual spacing/copy wrapping issues may be missed by helper tests.
  - Follow-up: run manual smoke/internal build before release when feasible.

## TDD Implementation Plan

1. Red: Add mobile settlement view-model tests
   - Cover single visible currency notice, multiple visible currency notice, and ignoring empty currency summaries.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
2. Green: Implement currency-rule notice view-model
   - Derive visible currencies from server summaries with balances or suggested transfers.
   - Do not sort or combine currencies.
   - Verify: `pnpm --filter @i-um/mobile test`.
3. Green: Render notice on the Settle tab
   - Add a compact read-only notice card in success state.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
4. Refactor: Keep UI consistent with existing design primitives
   - Reuse `TripListCard` and design tokens.
   - Verify: `pnpm lint && pnpm format:check`.
5. Gate: final verification before PR
   - `pnpm verify:generated`
   - `pnpm --filter @i-um/api test`
   - `pnpm --filter @i-um/api build`
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - `pnpm lint`
   - `pnpm format:check`
   - `pnpm verify`
   - `git diff --check`

## Verification Record

### Automated Regression

- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass (295 tests).
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Not run — no simulator/internal build smoke was requested or available in this agent session. The UI copy is covered by helper tests and typecheck; visual/device smoke remains recommended before release.

## Release Notes

- Adds explicit settlement copy that multi-currency trips are settled per currency without FX conversion.

## Open Questions

- None.

## Follow-up Issues

- #59: MyPage settlement aggregation.
