# Feature Slice: F-306 일반 지출 등록과 현장 정산 완료 지출 분리

## Metadata

- GitHub Issue: #306
- Status: Implemented
- Created: 2026-07-15
- Updated: 2026-07-15

## Goal

여행 중 현장에서 이미 정산이 끝난 지출도 이음에 기록할 수 있게 한다. 이 지출은 지출 내역과 총 사용 금액에는 남아야 하지만, 최종 정산 금액과 송금 제안에는 다시 포함되면 안 된다.

## Product Decisions

- 지출마다 `최종 정산에 포함` 여부를 명시적으로 저장한다.
- 기본값은 기존 동작과 호환되도록 `포함`이다.
- 사용자가 `현장 정산 완료` / `최종 정산에서 제외`로 표시한 지출은 지출 내역과 총 사용 금액에는 남지만, 사람별 balance와 최종 송금 제안에는 포함하지 않는다.
- MVP에서는 공금/공동 지갑 계정이나 참여자가 아닌 payer 모델을 추가하지 않는다.
- 송금 완료 상태, 정산 실행/결제 확인, 정산 히스토리 테이블은 이 범위가 아니다.

## Scope

### In

- DB/API representation for whether an expense is included in final settlement.
- Default/backfill existing expenses as included.
- Settlement-tab general expense create/edit UI for inclusion/exclusion.
- Today quick expense create UI for inclusion/exclusion.
- Expense list/detail state that identifies excluded/on-site-settled expenses.
- Settlement calculation and MyPage settlement summary exclude marked expenses.
- Expense lists, details, and total spend/history aggregates continue to include marked expenses.
- API contract, generated artifacts, API tests, and mobile tests/typecheck updates.

### Out

- Public-fund/shared-wallet account model.
- Transfer completion, payment confirmation, bank/account integration.
- Settlement run storage, audit log, notifications.
- Receipt/OCR, budget analytics, category overhaul.

## UX Requirements

### Create/edit controls

- Use a default-on control labeled `최종 정산에 포함` or equivalent.
- When off, explain that the expense is already settled on-site and will remain in total spend/history while excluded from final settlement.
- Today quick expense uses the same default and meaning as settlement-tab general expense.
- Edit screens load the saved value and allow changing it.

### List/detail display

- Expense rows or details clearly show excluded state with Korean copy such as `정산 제외` or `현장 정산 완료`.
- Do not hide excluded expenses from history or total spend views.
- Keep copy short and avoid confusing `총 사용 금액` with `정산 대상 금액`.

## API Changes

Use a positive boolean field:

```text
includeInSettlement: boolean
```

Request behavior:

- Add optional `includeInSettlement` to expense create/update request schemas for settlement-tab general expense, day expense edit, and Today quick expense creation.
- Create requests default omitted values to `true` for backward compatibility.
- Update requests preserve the existing value when omitted so older clients do not accidentally re-include an excluded expense.

Response behavior:

- Add required `includeInSettlement` to expense row/detail/create/update response schemas so clients can render state consistently.

## DB Changes

Add a goose migration:

```sql
ALTER TABLE expenses
  ADD COLUMN include_in_settlement boolean NOT NULL DEFAULT true;
```

Existing rows are included by default so current settlement results do not change after migration.

## Settlement Behavior

- `GET /trips/{tripId}/settlement` reads only expenses where `include_in_settlement = true` for:
  - `totalPaidMinor`
  - `totalShareMinor`
  - `balances`
  - `suggestedTransfers`
- `GET /me/settlement-summary` uses the same settlement-eligible filter.
- Expense history/list/detail and total spending aggregates do not apply this filter.

## Acceptance Criteria

- [x] AC-01: New expenses default to `최종 정산에 포함`.
- [x] AC-02: Users can save a new settlement-tab general expense as `최종 정산에서 제외(현장 정산 완료)`.
- [x] AC-03: Users can save a new Today quick expense as `최종 정산에서 제외(현장 정산 완료)`.
- [x] AC-04: Users can edit an existing expense and change included/excluded state.
- [x] AC-05: Excluded expenses remain visible in expense lists, expense details, and total spend aggregates.
- [x] AC-06: Excluded expenses are omitted from `GET /trips/{tripId}/settlement` `totalPaidMinor`, `totalShareMinor`, `balances`, and `suggestedTransfers`.
- [x] AC-07: MyPage settlement summary ignores excluded expenses.
- [x] AC-08: Expense list rows or details clearly identify excluded/on-site-settled expenses.
- [x] AC-09: Existing persisted expenses are included after migration/default/backfill.
- [x] AC-10: API/DB/mobile tests cover create, update, listing/detail display state, and settlement calculation differences.

## Regression Test Plan

| Behavior | Layer | Command |
|---|---|---|
| OpenAPI and generated clients include `includeInSettlement` | Contract/generated | `pnpm generate && pnpm verify:generated` |
| DB default/backfill keeps existing rows included | API DB/migration | `pnpm --filter @i-um/api test` |
| Create default true and create false persist correctly | API handler/service/storage | `pnpm --filter @i-um/api test` |
| Update toggles included/excluded state | API handler/service/storage | `pnpm --filter @i-um/api test` |
| List/detail responses expose excluded state without hiding rows | API/mobile helpers | `pnpm --filter @i-um/api test`; `pnpm --filter @i-um/mobile test` |
| Settlement and MyPage summary exclude marked expenses | API settlement tests | `pnpm --filter @i-um/api test` |
| Mobile create/edit request builders and row/detail display models handle state | Mobile helpers | `pnpm --filter @i-um/mobile test` |
| Mobile screens compile | Mobile typecheck | `pnpm --filter @i-um/mobile typecheck` |

## Open Questions

None.

## Follow-up Issues

- Shared wallet/public-fund account model.
- Transfer completion/payment confirmation.
- Settlement run/audit history.
- Receipt/OCR and budget analytics.
