# Feature Slice: F-054 직접 금액 분할

## Metadata

- GitHub Issue: #54
- Status: Implemented
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #54 — [[Feature Slice] F-054 직접 금액 분할](https://github.com/twotwobread/i-um/issues/54)
- Ouroboros/PM/Seed: Interview `interview_20260629_144343`, Seed `seed_8e9f13f5878f`
- Ambiguity Score: `0.1345`
- Notes:
  - Existing quick expense API is `POST /trips/{tripId}/days/{tripDayId}/expenses/quick`.
  - Existing quick create and edit requests use `participantIds` for selected-participant equal split.
  - Current `ExpenseSplitPolicy` supports only `equal`; F-054 extends it with `manual`.
  - Current persistence already has `expenses.split_policy` and `expense_splits`; only the `split_policy` DB check constraint needs to broaden for manual.
  - Issue body references `docs/delivery/*`, but those files are not present in the current repository. Follow `.harness` workflow/rules for delivery gates.

## Goal

사용자는 빠른 지출 등록과 기존 지출 수정에서 균등 분할 대신 참여자별 부담 금액을 직접 입력할 수 있다.

시스템은 직접 입력 금액의 합계가 총 지출 금액과 정확히 일치할 때만 저장하고, 저장된 `expense.splits`를 사용자에게 최종 결과로 보여준다.

## User Flow

### Quick expense create with manual split

1. 사용자가 Today 또는 Day 화면에서 `지출 등록`을 연다.
2. 앱은 기존처럼 장소, 금액, 결제자, 분할 설정을 보여준다.
3. 기본 분할 방식은 기존 동작과 동일하게 `균등 분할`이다.
4. 사용자가 분할 방식을 `직접 입력`으로 바꾼다.
5. 앱은 현재 여행 참여자 목록과 각 참여자의 부담 금액 입력칸을 보여준다.
6. 처음 `직접 입력`으로 전환할 때 앱은 현재 균등 분할 preview 값을 manual draft로 채워 합계가 맞는 상태에서 시작한다.
7. 사용자가 참여자별 금액을 수정한다.
   - 빈 값 또는 `0`은 부담 없음으로 취급하고 request에서 제외한다.
   - 결제자도 부담 금액이 `0`이면 request에서 제외할 수 있다.
8. 앱은 manual draft 합계와 총 지출 금액을 비교해 mismatch 상태를 보여준다.
9. 합계가 정확히 일치하면 `저장하기`가 가능해진다.
10. 서버는 manual payload를 검증하고, 입력된 참여자에게만 `expense_splits` rows를 저장한다.
11. 앱은 저장 성공 후 서버 응답 `expense.splitPolicy`와 `expense.splits` 기준으로 `실제 저장된 분할` summary를 보여준다.

### Edit an existing expense with manual split

1. 사용자가 Day 지출 목록에서 기존 지출을 연다.
2. 편집 화면은 서버 응답의 `splitPolicy`와 `splits`를 기준으로 현재 분할 방식을 표시한다.
3. 기존 지출이 `equal`이면 균등 분할 UI로 시작하고, 사용자는 `직접 입력`으로 전환할 수 있다.
4. 기존 지출이 `manual`이면 저장된 manual split rows를 각 참여자 입력칸에 채운다.
5. 사용자는 금액, 결제자, 메모, 연결 장소와 함께 분할 방식을 수정한다.
6. 총 지출 금액을 변경해도 manual 입력값은 자동 변경되지 않는다.
7. manual 합계가 총액과 다르면 저장이 차단되고 사용자가 직접 입력값을 고친다.
8. 저장 성공 시 서버는 선택한 `splitPolicy`와 split rows를 갱신하고 편집 화면은 Day 목록으로 돌아간다.

## Scope

- App UI: Yes
  - Quick expense screen: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
  - Expense edit screen: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/[expenseId]/edit.tsx`
  - Helpers: `apps/mobile/lib/trips/quick-expense.ts`, `apps/mobile/lib/trips/expense-edit.ts`, shared split helper/component if useful.
- API Contract: Yes
  - Extend `CreateQuickExpenseRequest`, `UpdateExpenseRequest`, `ExpenseSplitPolicy`.
  - Add manual split request schema.
- API Server: Yes
  - Validate equal/manual payload combinations.
  - Persist equal or manual split rows according to `splitPolicy`.
- DB: Yes, small constraint migration
  - Extend `expenses.split_policy` check constraint to allow `manual`.
- Tests: Yes
  - Contract/generated, API service/handler/repository, mobile helper/typecheck.
- Deploy/Smoke: Needed before closing implementation
  - Internal build or staging smoke for manual create and manual edit.

## Out of Scope

- Percent, ratio, weighted, or share-count split inputs.
- Automatic correction, residual balancing, or assigning a mismatch to a participant.
- Split templates, remembering last split settings, or recurring presets.
- Settlement summary, debt netting, transfer/payment confirmation, or paid status.
- Receipt/image/category support.
- Editing currency or scheduled date.
- Persisting zero-amount manual split rows for participants with no burden.
- API preview endpoint for manual split validation.

## Requirements

### UI / UX

#### Common split mode control

- Add a split mode control to quick create and edit screens.
- Labels:
  - `균등 분할`
  - `직접 입력`
- Default for new quick expenses: `균등 분할`.
- Existing expenses initialize from server response `expense.splitPolicy`.
- The selected policy controls request shape and validation.

#### Equal mode

- Keep existing F-053 behavior.
- Show `분할 대상` participant selector.
- Use selected `participantIds` to build equal split preview.
- Payer may be excluded from equal split target.
- At least 1 split participant is required.
- Request sends `splitPolicy: "equal"` and `participantIds`.
- Request must not send manual `splits`.

#### Manual mode

- Show current trip participants as rows with amount inputs.
- Row label: participant display name, using existing blank-name fallback.
- Amount input uses the trip/expense currency rules:
  - KRW/JPY: integers only.
  - USD/EUR: up to 2 decimals.
  - API payload stores integer `amountMinor` only.
- Blank value or `0` means the participant has no burden and is omitted from the request.
- Submitted manual split rows must have `amountMinor >= 1`.
- At least 1 positive manual split row is required.
- The payer does not need to appear in manual splits.
- UI shows a manual sum summary:
  - Total expense amount.
  - Manual split sum.
  - Remaining/over amount when mismatched.
- Validation copy:
  - Sum mismatch: `분할 금액의 합계가 총 지출 금액과 같아야 해요.`
  - No positive manual rows: `분할할 금액을 1명 이상 입력해주세요.`
  - Invalid participant amount: existing amount validation style, e.g. `금액을 1 이상 입력해주세요.`
- Save is disabled while manual sum does not exactly equal total `amountMinor`.
- Save is disabled when manual rows are empty even if total amount is valid.

#### Switching behavior

- `equal -> manual`:
  - First transition initializes manual draft from current equal preview/saved split rows so the sum starts valid.
  - If the user already edited manual values during this screen session, switching back to manual restores that draft instead of overwriting it.
- `manual -> equal`:
  - Keep manual draft in local state; do not discard typed values during the same screen session.
- Total amount changes in manual mode:
  - Keep participant-level manual inputs unchanged.
  - Show mismatch validation if the existing sum no longer equals the new total.
  - Do not auto-reset, auto-recalculate, or auto-correct manual inputs.
- Participant list refresh while editing:
  - Preserve draft values for participant IDs still present.
  - New participants start blank in manual mode.
  - Removed/non-current participants cannot be submitted.

#### Saved result authority

- Pre-save preview/draft is local and only for user editing.
- Server save result is authoritative.
- Post-save summary and edit detail display `response.expense.splitPolicy` and `response.expense.splits`.
- Do not recompute saved manual split rows locally for final display.

### API Contract

Update existing endpoints:

```text
POST /trips/{tripId}/days/{tripDayId}/expenses/quick
PATCH /trips/{tripId}/days/{tripDayId}/expenses/{expenseId}
```

#### Split policy enum

```yaml
ExpenseSplitPolicy:
  type: string
  enum:
    - equal
    - manual
```

#### Manual split input schema

```yaml
ManualExpenseSplitInput:
  type: object
  additionalProperties: false
  required:
    - participantId
    - amountMinor
  properties:
    participantId:
      type: string
      description: Current trip participant who has a positive manual burden.
    amountMinor:
      type: integer
      format: int64
      minimum: 1
      description: Positive burden amount in currency minor units.
```

#### `CreateQuickExpenseRequest`

```yaml
CreateQuickExpenseRequest:
  type: object
  additionalProperties: false
  required:
    - scheduleItemId
    - amountMinor
    - payerParticipantId
    - splitPolicy
  properties:
    scheduleItemId:
      type: string
    amountMinor:
      type: integer
      format: int64
      minimum: 1
    payerParticipantId:
      type: string
    splitPolicy:
      $ref: '#/components/schemas/ExpenseSplitPolicy'
    participantIds:
      type: array
      minItems: 1
      uniqueItems: true
      items:
        type: string
      description: Required only when splitPolicy is equal. Must be omitted for manual.
    splits:
      type: array
      minItems: 1
      items:
        $ref: '#/components/schemas/ManualExpenseSplitInput'
      description: Required only when splitPolicy is manual. Must be omitted for equal.
```

#### `UpdateExpenseRequest`

```yaml
UpdateExpenseRequest:
  type: object
  additionalProperties: false
  required:
    - amountMinor
    - payerParticipantId
    - memo
    - scheduleItemId
    - splitPolicy
  properties:
    amountMinor:
      type: integer
      format: int64
      minimum: 1
    payerParticipantId:
      type: string
    memo:
      type: string
      nullable: true
      maxLength: 240
    scheduleItemId:
      type: string
      nullable: true
    splitPolicy:
      $ref: '#/components/schemas/ExpenseSplitPolicy'
    participantIds:
      type: array
      minItems: 1
      uniqueItems: true
      items:
        type: string
      description: Required only when splitPolicy is equal. Must be omitted for manual.
    splits:
      type: array
      minItems: 1
      items:
        $ref: '#/components/schemas/ManualExpenseSplitInput'
      description: Required only when splitPolicy is manual. Must be omitted for equal.
```

#### API validation and errors

- `400 VALIDATION_ERROR`:
  - Missing or invalid `splitPolicy`.
  - `splitPolicy: equal` with missing/empty/duplicate/malformed `participantIds`.
  - `splitPolicy: equal` with `splits` present.
  - `splitPolicy: manual` with missing/empty/malformed `splits`.
  - `splitPolicy: manual` with `participantIds` present.
  - Manual split duplicate participant IDs.
  - Manual split `amountMinor < 1`.
  - Manual split sum does not exactly equal request `amountMinor`.
  - Any equal/manual split participant is not a current accepted participant of the target trip.
- `401 UNAUTHORIZED`: unchanged.
- `403 FORBIDDEN`: authenticated user is not a participant of the trip.
- `404 NOT_FOUND`: trip, trip day, expense, schedule item, or payer not found according to existing endpoint behavior.
- `409 CONFLICT`: participant/schedule/expense state changes during transaction.
- `500`: unexpected server error.

### DB Changes

Add a goose migration to broaden the existing split policy check:

```sql
ALTER TABLE expenses
  DROP CONSTRAINT IF EXISTS expenses_split_policy_check;

ALTER TABLE expenses
  ADD CONSTRAINT expenses_split_policy_check
  CHECK (split_policy IN ('equal', 'manual'));
```

Down migration should restore the previous `equal`-only constraint after normalizing or rejecting manual rows as appropriate for rollback in local/test environments. For production rollback, document risk because manual rows cannot be represented by the old constraint without data handling.

No new tables are needed:

- `expenses.split_policy` stores `equal` or `manual`.
- `expense_splits` stores persisted split rows for both policies.
- Equal mode persists allocated rows from the selected participant set.
- Manual mode persists only submitted positive manual split rows.
- Omitted participants have 0 burden and no `expense_splits` row.

### Business Rules

#### Shared rules

- Only authenticated current trip participants can create/edit expenses.
- Payer must be a current participant of the same trip.
- Split target/burden participants must be current participants of the same trip.
- Payer and split burden are independent:
  - payer may be omitted from equal `participantIds`;
  - payer may be omitted from manual `splits`.
- Money is stored and validated as integer minor units only.
- Request array order is not authoritative for persisted display order.
- Persisted `split_order` is deterministic by current participant order: `joinedAt ASC`, then `participantId ASC` among selected/submitted split participants.

#### Equal split policy

- `splitPolicy` must be `equal`.
- `participantIds` is required, non-empty, unique, and current-trip-only.
- `splits` must be omitted.
- Allocation uses the existing deterministic equal split rule across the selected participant IDs.
- Existing F-053 behavior remains unchanged except for adding explicit `splitPolicy: "equal"`.

#### Manual split policy

- `splitPolicy` must be `manual`.
- `splits` is required and non-empty.
- `participantIds` must be omitted.
- Each submitted manual split has:
  - valid participant ID;
  - current trip participant;
  - unique participant ID within the request;
  - `amountMinor >= 1`.
- `sum(splits.amountMinor)` must exactly equal request `amountMinor`.
- Server must not auto-correct, auto-balance, or allocate remainder for manual requests.
- Server inserts manual split amounts as submitted, ordered deterministically for display.
- Participants not present in `splits` have 0 burden and no persisted split row.

#### Edit behavior

- Existing equal expenses can be saved as equal or switched to manual.
- Existing manual expenses can be saved as manual or switched to equal.
- Updating amount/payer/memo/schedule item and split policy happens in one transaction.
- Save failures keep the user on the edit screen.
- Delete behavior remains unchanged.

## Acceptance Criteria

- [x] AC-01: Feature spec and TDD implementation plan exist at `docs/features/0054-manual-amount-split.md`.
- [x] AC-02: OpenAPI defines `ExpenseSplitPolicy` values `equal` and `manual`.
- [x] AC-03: `CreateQuickExpenseRequest` and `UpdateExpenseRequest` require `splitPolicy`.
- [x] AC-04: Equal create/update requests continue using `participantIds` and reject `splits` in the same payload.
- [x] AC-05: Manual create/update requests use `splits[{participantId, amountMinor}]` as the single source of truth and reject `participantIds` in the same payload.
- [x] AC-06: Manual requests reject missing/empty/malformed/duplicate split participants, non-current participants, and non-positive manual amounts.
- [x] AC-07: Manual create/update rejects requests whose split sum does not exactly equal total `amountMinor`.
- [x] AC-08: Manual create/update persists `expenses.split_policy = 'manual'` and does not run equal allocation.
- [x] AC-09: Participants omitted from manual `splits` have no persisted `expense_splits` row.
- [x] AC-10: Quick expense UI provides `균등 분할` and `직접 입력` modes.
- [x] AC-11: Quick expense manual mode blocks save until manual split sum exactly matches total amount.
- [x] AC-12: Quick expense total amount changes in manual mode preserve entered participant amounts and show mismatch validation.
- [x] AC-13: Expense edit UI loads existing `splitPolicy`, supports switching equal/manual, and saves the selected configuration.
- [x] AC-14: Existing manual expenses initialize edit rows from server-returned `expense.splits`.
- [x] AC-15: Saved summaries and edit detail use server-returned `expense.splitPolicy` and `expense.splits`.
- [x] AC-16: Payer can be omitted from manual splits and still create/update if manual sum matches total.
- [x] AC-17: API/mobile tests cover equal compatibility, manual exact-sum success, mismatch rejection, contradictory payload rejection, omitted participants, edit switching, and total-change preservation.
- [x] AC-18: DB migration apply/status/rollback/re-apply is verified against a test database or documented if local DB state blocks it.

## Regression Test Plan

| Behavior / AC                                                                                              | Layer               | Test File / Gate                                                                           | Command                                                  |
| ---------------------------------------------------------------------------------------------------------- | ------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| OpenAPI splitPolicy/manual schemas and generated code stay in sync                                         | Contract/generated  | `packages/api-contract/openapi.yaml`, generated server/client                              | `pnpm generate && pnpm verify:generated`                 |
| Equal create/update payloads remain compatible with selected `participantIds`                              | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go`        | `pnpm --filter @i-um/api test`                           |
| Manual create/update succeeds when split sum exactly equals total                                          | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go`        | `pnpm --filter @i-um/api test`                           |
| Manual create/update rejects mismatch, duplicate IDs, non-current participants, and contradictory payloads | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go`        | `pnpm --filter @i-um/api test`                           |
| Repository persists manual split_policy and exact split rows without equal allocation                      | API storage         | `apps/api/internal/storage/trip_repository_test.go` or handler-backed integration coverage | `pnpm --filter @i-um/api test`                           |
| DB constraint allows manual and rejects unsupported split_policy                                           | DB migration/schema | `apps/api/migrations/*`, `apps/api/schema.sql`                                             | migration apply/status/rollback/re-apply against test DB |
| Quick expense helper builds equal/manual requests and validates manual sums                                | Mobile helper       | `apps/mobile/lib/trips/quick-expense.test.mts`                                             | `pnpm --filter @i-um/mobile test`                        |
| Edit helper initializes from equal/manual server state and preserves manual draft on total change          | Mobile helper       | `apps/mobile/lib/trips/expense-edit.test.mts`                                              | `pnpm --filter @i-um/mobile test`                        |
| Quick expense and edit screens compile with generated request types                                        | Mobile typecheck    | Expo Router/mobile TS                                                                      | `pnpm --filter @i-um/mobile typecheck`                   |
| Final changed-surface gate                                                                                 | Whole repo          | generated + API + mobile                                                                   | `pnpm verify`                                            |

## Regression Gaps

- No automated React Native E2E is planned for visually validating per-participant manual amount inputs.
  - Risk: helper tests/typecheck can miss keyboard behavior, scrolling, or confusing mismatch copy on a device.
  - Follow-up: internal build/staging smoke before closing implementation.
- Manual split rollback needs care because older DB constraint cannot represent `manual` rows.
  - Risk: rolling back after manual rows exist requires policy/data handling.
  - Follow-up: migration down should be safe for local/test; production rollback plan must be documented before deploy.

## TDD Implementation Plan

1. Red: API contract and generated expectations
   - Extend OpenAPI with `manual` split policy, `ManualExpenseSplitInput`, and policy-specific request fields.
   - Run generation/verification to expose generated type and server interface changes.
   - Verify: `pnpm generate && pnpm verify:generated`.
2. Red: API service validation tests
   - Add tests for equal payload compatibility with required `splitPolicy: "equal"`.
   - Add tests for manual exact-sum success in create and update.
   - Add tests rejecting manual sum mismatch, empty splits, duplicate participant IDs, malformed IDs, non-current participant IDs, `amountMinor < 1`, manual with `participantIds`, and equal with `splits`.
   - Add tests proving payer can be omitted from manual splits.
   - Verify: `pnpm --filter @i-um/api test` should fail.
3. Green: API domain/service changes
   - Add domain input types for split policy and manual split records.
   - Validate request shape in service, not handler.
   - Keep equal allocation behavior behind `splitPolicy == equal`.
   - Add manual split validation and exact-sum check.
   - Verify: `pnpm --filter @i-um/api test`.
4. Red: DB/storage tests
   - Add migration broadening `expenses_split_policy_check` to include `manual`.
   - Add or update storage tests proving manual policy is persisted and only submitted manual split rows are inserted.
   - Verify: `pnpm verify:generated && pnpm --filter @i-um/api test` should fail until storage is complete.
5. Green: Repository persistence
   - Update create/update records to carry split policy and manual split rows.
   - In create/update transactions, sort submitted manual participants deterministically and insert submitted amounts as-is.
   - Delete/recreate split rows on update as current edit flow does.
   - Update mappers so response `expense.splitPolicy` and `expense.splits` reflect DB rows.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
6. Red: Mobile helper tests for quick expense
   - Add tests for split mode state, equal request builder, manual request builder, blank/zero omission, exact sum validation, mismatch copy, equal->manual initialization, and total-change preservation.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
7. Green: Mobile quick expense implementation
   - Add split policy state and manual draft state.
   - Reuse existing money parser/formatter and participant ordering helpers.
   - Add manual amount inputs and sum summary.
   - Build generated API request according to selected policy.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
8. Red: Mobile edit helper tests
   - Add tests for initializing edit from `expense.splitPolicy` and `expense.splits`.
   - Add tests for switching equal/manual, preserving manual draft, and building update requests.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
9. Green: Mobile edit implementation
   - Reuse the split configuration helper/component in the edit screen.
   - Ensure amount changes do not mutate manual draft values.
   - Save selected policy and fields in `UpdateExpenseRequest`.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
10. Refactor and consistency
    - Keep business rules in service, persistence details in repository, and UI state logic in mobile helpers.
    - Avoid raw colors; use design tokens/shared primitives.
    - Keep Korean copy short and action-oriented.
    - Verify targeted API/mobile tests again.
11. Gate: final verification before PR/staging
    - `pnpm verify:generated`
    - `pnpm --filter @i-um/api test`
    - `pnpm --filter @i-um/api build`
    - `pnpm --filter @i-um/mobile test`
    - `pnpm --filter @i-um/mobile typecheck`
    - DB migration apply/status/rollback/re-apply against a test database.
    - `pnpm verify` if environment/time allows.
12. Manual smoke
    - Quick create manual happy path: enter total and participant amounts that match, save, confirm summary rows.
    - Quick create mismatch: change total after entering manual rows, confirm save is blocked until fixed.
    - Edit existing equal -> manual: switch, adjust amounts, save, confirm Day list/edit detail reflect manual rows.
    - Edit existing manual -> equal: switch, save, confirm equal split rows.
    - Payer omitted from manual split: save successfully when sum matches total.

## Verification Record

### Automated Regression

- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass.
- `pnpm verify`: pass.
- `git diff --check`: pass.

### Manual Smoke

- DB migration smoke against local `postgres://localhost:5432/ium`: `db:migrate`, `db:status`, `db:rollback`, `db:status`, `db:migrate`, `db:status` all passed; final DB version is 16.
- Device/internal build UI smoke not run in this local implementation session.

## Release Notes

- 빠른 지출 등록과 지출 수정에서 참여자별 부담 금액을 직접 입력할 수 있게 한다.
- 직접 입력 분할은 입력 금액의 합계가 총 지출 금액과 정확히 같을 때만 저장된다.

## Open Questions

- None blocking for F-054 after Ouroboros clarification.

## Follow-up Issues

- Percent/ratio/weighted split policies if product later needs them.
- Split templates or saved presets if users repeat the same manual distribution often.
- Production rollback/data handling plan if manual split rows are deployed and then the `split_policy` constraint must be reverted.
