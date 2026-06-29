# Feature Slice: F-057 사람별 결제/부담 요약

## Metadata

- GitHub Issue: #57
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #57 — [[Feature Slice] F-057 사람별 결제/부담 요약](https://github.com/twotwobread/i-um/issues/57)
- Ouroboros/PM/Seed: Not used; `micro-spec-author` selected for a small, local, low-ambiguity UI slice.
- Notes:
  - #55 is merged and provides authoritative `GET /trips/{tripId}/settlement` plus `currencySummaries[].balances`.
  - #56 is merged and the Settle tab already fetches settlement data and renders final transfer instructions.
  - #58 owns cross-currency principles and #59 owns MyPage aggregation.
  - Issue body references `docs/delivery/*`, but those references are stale for agent process; follow `.harness` workflow/rules.
  - Spec review verdict: Approved.

## Goal

여행 참여자는 정산 탭에서 통화별로 각 참여자의 총 결제 금액, 총 부담 금액, 차액을 확인할 수 있다.

앱은 서버가 계산한 `balances` rows를 그대로 표시하며 클라이언트에서 지출/분할/송금 데이터를 다시 계산하지 않는다.

## User Flow

### View participant balance summary

1. 인증된 현재 여행 참여자가 여행의 정산 탭을 연다.
2. 앱은 기존 #56 흐름처럼 `getTripSettlement(tripId)`를 호출한다.
3. 앱은 응답의 `currencySummaries[].balances`를 통화별 사람 요약 섹션으로 표시한다.
4. 사용자는 각 사람의 결제 금액, 부담 금액, 받을/보낼/차액 없음 상태를 확인한다.
5. 송금 제안이 있으면 기존 #56 최종 송금 안내도 함께 확인한다.

### Balanced participants with no transfers

1. 서버 응답에 참여자 balance rows는 있지만 `suggestedTransfers`가 비어 있다.
2. 앱은 사람별 요약을 표시한다.
3. 앱은 기존 no-transfer copy/card도 표시해 별도로 보낼 정산이 없음을 알려준다.

### Empty settlement

1. 서버 응답의 `currencySummaries`가 비어 있거나 표시할 balance/transfer row가 없다.
2. 앱은 기존 #56 no-transfer empty state를 유지한다.

## Scope

- App UI: Yes
  - Extend `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`.
  - Extend mobile settlement helper/view-model code.
- API Contract: No planned changes
  - Consume existing `GET /trips/{tripId}/settlement` from #55.
- API Server: No planned changes.
- DB: No changes.
- Tests: Mobile helper/view-model tests, mobile typecheck, and final repo gates.
- Deploy/Smoke: Manual smoke or internal build verification when feasible because this is user-visible UI.

## Out of Scope

- API/DB changes unless a blocking #55 contract gap is found.
- Recomputing paid/share/net values on the client.
- FX conversion, representative currency, cross-currency netting, or broad cross-currency policy/copy (#58).
- MyPage settlement aggregation (#59).
- 송금 완료, paid/unpaid status, payment confirmation, bank/account details, copy/share actions, notifications, persisted settlement runs, settlement history, or audit logs.
- Person detail drill-downs, expense-level explanations, or expandable balance breakdowns.

## Requirements

### UI / UX

- Screen path: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`.
- Header:
  - Title remains `정산`.
  - Helper may mention both person summaries and transfer guidance.
- Loading/error/auth/not-found:
  - Preserve #56 behavior and copy.
- Success with balance rows:
  - Render one person summary section per server-returned currency summary that has at least one `balances` row.
  - Preserve `currencySummaries` order exactly.
  - Preserve each `balances` order exactly.
  - Do not client-sort sections or participant rows.
  - Each section shows currency label/code and participant count.
  - Each participant row shows:
    - participant display name;
    - removed-member label when `participantStatus` is `removed`;
    - total paid amount;
    - total share amount;
    - net result.
  - Net result copy:
    - `netMinor > 0`: `받을 금액` using absolute formatted amount.
    - `netMinor < 0`: `보낼 금액` using absolute formatted amount.
    - `netMinor === 0`: `차액 없음` with zero formatted amount.
  - Multiple currencies are shown as separate sections.
- Transfer instructions:
  - Preserve existing #56 transfer sections and read-only row behavior.
  - Person summary sections should not alter or re-sort transfer sections.
- No-transfer with balances:
  - If there are balance sections but no transfer sections, show the balance sections and the existing no-transfer copy/card.
- Empty/no rows:
  - If there are no balance sections and no transfer sections, show the existing #56 empty state:
    - Title: `보낼 정산이 없어요.`
    - Helper: `모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.`

### API Contract

No API changes planned.

The screen consumes the existing #55 endpoint:

```text
GET /trips/{tripId}/settlement
```

Relevant response fields:

- `currencySummaries[].currency`
- `currencySummaries[].balances[]`
- `balances[].participant.displayName`
- `balances[].participant.participantStatus`
- `balances[].paidMinor`
- `balances[].shareMinor`
- `balances[].netMinor`
- `currencySummaries[].suggestedTransfers[]` for the existing #56 transfer list

### DB Changes

No DB changes.

### Business Rules

- Server settlement data is the source of truth.
- The mobile app must not compute paid/share/net balances from expenses, splits, or transfer rows.
- The mobile app may format API-provided minor-unit amounts.
- Strict per-currency display only; no FX conversion or cross-currency netting.
- Currency sections, balance rows, and transfer rows must preserve server order.
- Removed or historical participant snapshots remain visible using the server display name.
- The v1 summary is read-only and cannot mark settlement as complete.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0057-participant-balance-summary.md`.
- [x] AC-02: Settle tab renders person-by-person balance summaries from `getTripSettlement(tripId)`.
- [x] AC-03: One balance section is shown per API currency summary with at least one `balances` row.
- [x] AC-04: Balance section order matches API `currencySummaries` order.
- [x] AC-05: Participant row order matches API `balances` order.
- [x] AC-06: Each participant row displays display name, paid amount, share amount, and net result.
- [x] AC-07: Positive, negative, and zero net values use receive/send/no-difference labels respectively.
- [x] AC-08: Removed participant snapshots remain visible with a lightweight removed-member label.
- [x] AC-09: Multiple currencies are shown separately without conversion or netting.
- [x] AC-10: Existing #56 transfer sections remain read-only and preserve `suggestedTransfers` order.
- [x] AC-11: If balances exist but transfers do not, the screen shows balances plus no-transfer copy/card.
- [x] AC-12: If no balances or transfers exist, the existing no-transfer empty state remains.
- [x] AC-13: Loading/auth/not-found/409/generic error states remain mapped as in #56.
- [x] AC-14: Mobile tests cover ordering, net label variants, removed participant labeling, multi-currency separation, and no-transfer-with-balances.
- [x] AC-15: No API server, OpenAPI, generated code, or DB change is introduced unless documented as a blocking gap.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| API balances map to visible currency person sections without sorting | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Positive/negative/zero net copy and absolute amount formatting | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Removed participant label | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Balances with no transfers still show no-transfer copy/card | Mobile helper/screen logic | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Settle tab/client integration type safety | Mobile app | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full end-to-end device verification depends on available seeded settlement data or an internal build environment.
  - Risk: visual spacing/accessibility issues may be missed by helper tests.
  - Follow-up: run manual smoke/internal build before release when feasible.

## TDD Implementation Plan

1. Red: Add mobile settlement view-model tests
   - Cover balance section filtering, order preservation, participant count, positive/negative/zero net copy, removed participant labels, and no-transfer-with-balances.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
2. Green: Implement mobile balance summary view-model
   - Consume generated #55 response types.
   - Format server-provided amounts and net labels without deriving values.
   - Verify: `pnpm --filter @i-um/mobile test`.
3. Green: Render balance sections on the Settle tab
   - Add read-only person rows/cards alongside existing transfer sections.
   - Preserve #56 error/no-transfer behavior.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
4. Refactor: Keep UI consistent with existing design primitives
   - Reuse `TripListCard`, `TripStateCard`, and design tokens.
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
- `pnpm --filter @i-um/mobile test`: pass (293 tests).
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Not run — no simulator/internal build smoke was requested or available in this agent session. The UI slice is covered by helper tests and typecheck; visual/device smoke remains recommended before release.

## Release Notes

- Adds read-only person-by-person settlement summaries to the trip Settle tab.

## Open Questions

- None.

## Follow-up Issues

- #58: Cross-currency settlement principles.
- #59: MyPage settlement aggregation.
