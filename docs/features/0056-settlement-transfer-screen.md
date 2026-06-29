# Feature Slice: F-056 최종 송금 결과 화면

## Metadata

- GitHub Issue: #56
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #56 — [[Feature Slice] F-056 최종 송금 결과 화면](https://github.com/twotwobread/i-um/issues/56)
- Ouroboros/PM/Seed: Interview `interview_20260629_164244`, Seed `seed_3324bf2b7f6a`
- Ambiguity Score: `0.0815`
- Notes:
  - #55 is merged and provides authoritative `GET /trips/{tripId}/settlement` plus generated mobile `getTripSettlement`.
  - Current mobile Settle tab still renders today's expense placeholder content.
  - #57 owns person-by-person settlement summaries, #58 owns cross-currency principles, and #59 owns MyPage settlement aggregation.
  - Issue body references `docs/delivery/*`, but those files are stale/missing in the current repository. Follow `.harness` workflow/rules.

## Goal

여행 참여자는 정산 탭에서 서버가 계산한 최종 송금 안내를 확인할 수 있다.

화면은 `GET /trips/{tripId}/settlement`의 `suggestedTransfers`를 그대로 렌더링하며, 클라이언트에서 정산 금액을 다시 계산하거나 송금 완료/결제 상태를 관리하지 않는다.

## User Flow

### View final transfer instructions

1. 인증된 현재 여행 참여자가 여행의 정산 탭을 연다.
2. 앱은 `getTripSettlement(tripId)`로 서버 정산 결과를 조회한다.
3. 앱은 송금이 필요한 통화별 섹션만 표시한다.
4. 각 섹션은 서버가 반환한 순서 그대로 `누가 → 누구에게 → 얼마`를 보여준다.
5. 사용자는 읽기 전용 결과를 확인한다.

### No transfers needed

1. 서버 응답의 `currencySummaries`가 비어 있거나 모든 `suggestedTransfers`가 비어 있다.
2. 앱은 오류가 아닌 빈 정산 상태를 표시한다.
3. 오늘 여행 Day route를 계산할 수 있으면 Day 상세로 이동하는 액션을 제공한다.

### Settlement calculation unavailable

1. 앱이 정산 API를 호출한다.
2. API가 `409 SETTLEMENT_DATA_INCONSISTENT`를 반환한다.
3. 앱은 정산 전용 오류 copy와 retry 액션을 표시한다.

## Scope

- App UI: Yes
  - Replace `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx` placeholder with the transfer result screen.
  - Add/update mobile settlement helper/view-model code.
- API Contract: No planned changes
  - Consume existing `GET /trips/{tripId}/settlement` from #55.
- API Server: No planned changes.
- DB: No changes.
- Tests: Mobile helper/view-model tests, mobile typecheck, and final repo gates.
- Deploy/Smoke: Manual smoke or internal build verification when feasible because #56 is user-visible UI.

## Out of Scope

- Person-by-person paid/share/net summary cards or detailed balance explanation (#57).
- FX conversion, representative currency, cross-currency netting, or broad cross-currency policy/copy (#58).
- MyPage settlement aggregation (#59).
- 송금 완료, paid/unpaid status, payment confirmation, bank/account details, copy/share actions, notifications, persisted settlement runs, settlement history, or audit logs.
- API/DB changes unless a blocking gap is found in #55's contract.
- Client-side settlement math beyond formatting server-provided integer minor units.

## Requirements

### UI / UX

- Screen path: `apps/mobile/app/trips/[tripId]/(tabs)/settle.tsx`.
- Header:
  - Title remains `정산`.
  - Helper should communicate that the screen shows who should send money to whom.
- Loading:
  - On initial entry, focus/re-entry, and retry, show the existing full-screen/content-card loading state.
  - No pull-to-refresh or background stale-while-revalidate is required in v1.
- Success with transfers:
  - Render one section per server-returned currency summary that has at least one `suggestedTransfer`.
  - Preserve `currencySummaries` order exactly.
  - Preserve each `suggestedTransfers` order exactly.
  - Do not client-sort sections or rows.
  - Each section shows currency label/code and the count of transfers in that currency.
  - The screen shows lightweight global summary copy with total rendered transfer count.
  - Each row uses a read-only transfer row that displays sender display name, receiver display name, amount, and currency.
  - Rows are non-tappable.
  - No bottom CTA or completion action is shown.
- No-transfer empty state:
  - Trigger when `currencySummaries` is empty or all `suggestedTransfers` arrays are empty.
  - Title: `보낼 정산이 없어요.`
  - Helper: `모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.`
  - If today's trip/day detail route is available, provide a primary action to view today's schedule/details.
  - This state is not an error.
- Errors:
  - `401` or invalid refresh/session uses the existing login prompt behavior.
  - `400`, `403`, and `404` use the existing trip not-found/inaccessible state.
  - `409 SETTLEMENT_DATA_INCONSISTENT` shows:
    - Title: `정산을 계산할 수 없어요.`
    - Helper: `지출 내역을 다시 확인한 뒤 시도해주세요.`
    - Retry action.
  - Other API/loading failures show a retryable error state card.

### API Contract

No API changes planned.

The screen consumes the existing #55 endpoint:

```text
GET /trips/{tripId}/settlement
```

Relevant response fields:

- `currencySummaries[].currency`
- `currencySummaries[].suggestedTransfers[]`
- `suggestedTransfers[].fromParticipant.displayName`
- `suggestedTransfers[].toParticipant.displayName`
- `suggestedTransfers[].amountMinor`

### DB Changes

No DB changes.

### Business Rules

- Server settlement data is the source of truth.
- The mobile app must not compute paid/share/net balances for the final result screen.
- The mobile app may format `amountMinor` for display.
- Strict per-currency display only; no FX conversion or cross-currency netting.
- Currency sections and transfer rows must preserve server order.
- Currency summaries with zero transfers are omitted from the success list.
- If every currency summary is omitted, show the no-transfer empty state.
- The v1 screen is read-only and cannot mark settlement as complete.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0056-settlement-transfer-screen.md`.
- [x] AC-02: Settle tab uses `getTripSettlement(tripId)` instead of today's expense-list placeholder content.
- [x] AC-03: The screen fetches on initial entry, focus/re-entry, and retry.
- [x] AC-04: Loading/refetch renders the existing loading state pattern.
- [x] AC-05: Happy path renders one visible section per API currency summary with at least one transfer.
- [x] AC-06: Currency section order matches API `currencySummaries` order.
- [x] AC-07: Transfer row order matches API `suggestedTransfers` order within each currency.
- [x] AC-08: Each visible section displays currency label/code and per-currency transfer count.
- [x] AC-09: The screen displays lightweight global total transfer count copy.
- [x] AC-10: Each transfer row displays sender, receiver, amount, and currency.
- [x] AC-11: Transfer rows are read-only/non-tappable and no completion/copy/share/account/bottom CTA exists.
- [x] AC-12: Empty/no-transfer response shows `보낼 정산이 없어요.` and `모든 지출이 이미 맞춰졌거나 아직 정산할 지출이 없어요.`.
- [x] AC-13: No-transfer state includes a Day-detail action only when today's route can be resolved.
- [x] AC-14: `401`/invalid auth maps to the existing login state.
- [x] AC-15: `400`/`403`/`404` map to the existing not-found/inaccessible state.
- [x] AC-16: `409 SETTLEMENT_DATA_INCONSISTENT` maps to settlement-specific retryable copy.
- [x] AC-17: Generic loading/API failures show a retryable error state.
- [x] AC-18: Mobile tests cover happy path, no-transfer, ordering preservation, retry, and mapped error states.
- [x] AC-19: No API server or DB change is introduced unless a documented blocking contract gap is found.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| API response maps to visible currency transfer sections without sorting | Mobile helper | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| No-transfer empty state and optional Day route action | Mobile helper/screen logic | `apps/mobile/lib/trips/settlement.test.mts` | `pnpm --filter @i-um/mobile test` |
| Error mapping for auth, not-found, 409, and generic retryable failures | Mobile helper/screen logic | `apps/mobile/lib/trips/settlement.test.mts` or settle tab tests | `pnpm --filter @i-um/mobile test` |
| Settle tab/client integration type safety | Mobile app | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Final repo gates | Whole repo | generated/lint/format/tests/build/typecheck | `pnpm verify` |

## Regression Gaps

- Full end-to-end device verification depends on available seeded settlement data or an internal build environment.
  - Risk: visual spacing/accessibility issues may be missed by helper tests.
  - Follow-up: run manual smoke/internal build before release when feasible.

## TDD Implementation Plan

1. Red: Add mobile settlement view-model tests
   - Cover transfer section filtering, order preservation, global/per-section counts, no-transfer empty state, day-route action availability, and error copy mapping.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
2. Green: Implement mobile settlement helper/view-model
   - Consume generated #55 response types.
   - Format server-provided amounts and build read-only transfer rows without sorting.
   - Verify: `pnpm --filter @i-um/mobile test`.
3. Red/Green: Replace Settle tab placeholder
   - Fetch `getTripSettlement` on focus/retry.
   - Render loading, transfer sections, no-transfer, auth/not-found, 409, and generic retry states.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
4. Refactor: Keep UI consistent with existing design primitives
   - Reuse `TripStateCard`, `TripListCard`, `TransferRow`, and existing route/error helpers.
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
- `pnpm --filter @i-um/mobile test`: pass (291 tests).
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass after rerunning sequentially; an earlier parallel run conflicted with generated-file refresh.
- `pnpm format:check`: pass after Prettier formatting.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- Not run — no simulator/internal build smoke was requested or available in this agent session. The UI slice is covered by helper tests and typecheck; visual/device smoke remains recommended before release.

## Release Notes

- 정산 탭에서 서버가 계산한 최종 송금 안내를 읽기 전용으로 보여준다.

## Open Questions

- None after Ouroboros clarification.

## Follow-up Issues

- #57 — 사람별 결제/부담 요약.
- #58 — 통화별 정산 원칙 적용.
- #59 — 마이페이지 내 정산 요약.
