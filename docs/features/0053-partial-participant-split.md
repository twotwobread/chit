# Feature Slice: F-053 일부 인원 분할

## Metadata

- GitHub Issue: #53
- Status: Implemented (pending staging/internal smoke)
- Created: 2026-06-27
- Updated: 2026-06-27

## Source

- Issue: #53 — [[Feature Slice] F-053 일부 인원 분할](https://github.com/twotwobread/i-um/issues/53)
- Ouroboros/PM/Seed: Interview `interview_20260627_090342`, Seed `seed_343bd4a780d6` (MCP generated; file path not provided)
- Ambiguity Score: `0.19`
- Notes:
  - Existing quick expense save endpoint is `POST /trips/{tripId}/days/{date}/expenses/quick`.
  - Current `CreateQuickExpenseRequest` has `itineraryItemId`, `amountMinor`, and `payerParticipantId`; it always splits across all current trip participants.
  - Existing mobile quick expense UI already loads current trip participants and shows a full-participant equal-split preview.
  - Existing DB tables `expenses` and `expense_splits` can persist a subset of split rows; no schema change is expected.

## Goal

사용자는 빠른 지출 등록에서 전체 참여자 대신 원하는 참여자만 골라 1/N 분할 대상으로 포함할 수 있다.

시스템은 명시적으로 제출된 현재 여행 참여자 subset만 대상으로 기존 deterministic equal split 규칙을 적용하고, 저장 결과를 서버 응답 기준으로 보여준다.

## User Flow

1. 사용자가 Today 화면 또는 Day 화면에서 `지출 등록`을 연다.
2. 앱은 장소, 금액, 결제자 입력/선택과 함께 `분할 대상` 참여자 목록을 보여준다.
3. 최초 진입 시 모든 현재 여행 참여자가 분할 대상으로 선택되어 있다.
4. 사용자는 일부 참여자를 선택 해제하거나 다시 선택한다.
   - 결제자도 사용자가 원하면 분할 대상에서 제외할 수 있다.
   - 최소 1명은 분할 대상으로 선택되어야 한다.
5. 앱은 선택된 참여자만 기준으로 `기본 1/N 분할` preview를 갱신한다.
6. 사용자가 `저장하기`를 누르면 앱은 선택된 `participantIds`를 quick expense request에 포함해 전송한다.
7. 서버는 요청의 `participantIds`가 현재 해당 여행의 accepted participant인지 검증하고, 선택된 참여자에게만 split rows를 생성한다.
8. 앱은 저장 성공 후 서버 응답 `expense.splits` 기준으로 `실제 저장된 분할` summary를 보여준다.

## Scope

- App UI: Yes
  - `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`에 분할 대상 multi-select UI를 추가한다.
  - `apps/mobile/lib/trips/quick-expense.ts`에 선택 상태, preview, request-building helper를 둔다.
- API Contract: Yes
  - Extend `CreateQuickExpenseRequest` with required `participantIds: string[]`.
- API Server: Yes
  - Validate required/non-empty/unique/current-trip participant IDs.
  - Allocate equal splits only across selected participants.
- DB: No schema migration expected
  - Existing `expense_splits` rows represent the selected subset.
- Tests: Yes
  - Contract/generated checks, API service/handler/repository regression tests, mobile helper tests, mobile typecheck.
- Deploy/Smoke: Needed before closing implementation
  - Staging or internal build smoke for selecting a subset, excluding payer, and one-person split.

## Out of Scope

- Manual per-person amounts, custom percentages, or weighted split ratios.
- Settlement summary, balance calculation, transfer/payment confirmation, or debt netting.
- New expense detail/edit/delete behavior.
- A new participant lookup endpoint or split preview API.
- Persisting split templates or remembering a user's last split target selection.
- Changing trip participant invite/remove policy.
- Backward-compatible fallback that treats omitted `participantIds` as all participants.

## Requirements

### UI / UX

#### Screens

- Quick expense screen: `apps/mobile/app/trips/[tripId]/days/[date]/expenses/quick.tsx`
  - Continue loading trip detail, Day itinerary, and current trip participants before showing the form.
  - Add a `분할 대상` section near the payer/split preview area.
  - Show current accepted trip participants from `GET /trips/{tripId}/participants` as selectable rows/chips.
  - Default selected state: all loaded participants selected.
  - Tapping a participant toggles inclusion in the split target.
  - Changing the selected payer must not force that payer into the split target.
  - Payer exclusion is allowed; the UI must not show an error when the selected payer is unchecked.
  - If zero participants are selected, disable `저장하기` and show validation copy.
  - If only one participant exists or only one participant is selected, allow save and preview a single split row for the full amount.
  - Preview rows and post-save summary rows use existing money formatting.

#### Copy

- Section title: `분할 대상`
- Section helper: `체크한 사람에게만 아래 금액으로 나눠져요. 결제자도 제외할 수 있어요.`
- Zero-selection validation: `분할할 사람을 1명 이상 선택해주세요.`
- Preview title: `기본 1/N 분할`
- Preview helper: `저장하면 선택한 참여자에게 아래 금액으로 나눠져요.`
- Saved summary title: `실제 저장된 분할`
- Saved summary helper: `서버에 저장된 결과 기준이에요.`

#### States

- Loading: keep the existing loading state while trip/day/participant data loads.
- Empty participants: keep save blocked; show the existing participant-load failure helper if no participants are available.
- Invalid amount: do not show stale preview amounts.
- Zero selected split participants: save disabled and validation copy visible.
- Server validation failure (`400`): tell the user to check amount/place/participants and reload if needed.
- Conflict (`409`): keep existing refresh-and-retry behavior for itinerary or participant changes during creation.

### API Contract

Extend the existing quick expense save endpoint:

```text
POST /trips/{tripId}/days/{date}/expenses/quick
```

`CreateQuickExpenseRequest` becomes:

```yaml
CreateQuickExpenseRequest:
  type: object
  additionalProperties: false
  required:
    - itineraryItemId
    - amountMinor
    - payerParticipantId
    - participantIds
  properties:
    itineraryItemId:
      type: string
      description: Required itinerary item for the selected Day. Must belong to tripId/date.
    amountMinor:
      type: integer
      format: int64
      minimum: 1
      description: Positive amount in currency minor units.
    payerParticipantId:
      type: string
      description: Active trip participant who paid the expense.
    participantIds:
      type: array
      minItems: 1
      uniqueItems: true
      items:
        type: string
      description: Current accepted trip participants selected as equal split targets.
```

Response remains `CreateQuickExpenseResponse` with `expense.splits` as the source of truth for saved rows.

#### API errors

- `400 VALIDATION_ERROR`
  - `participantIds` omitted.
  - `participantIds` empty.
  - Any `participantIds` entry is not a valid UUID.
  - Any duplicate participant ID appears in `participantIds`.
  - Any submitted participant ID is not a current accepted participant of the target trip.
- `401 UNAUTHORIZED`: unchanged.
- `403 FORBIDDEN`: authenticated user is not a participant of the trip.
- `404 NOT_FOUND`: trip, virtual day, itinerary item, or payer participant not found, following existing quick expense behavior.
- `409 CONFLICT`: itinerary or participant state changes during transaction after validation, following existing race-condition behavior.

### DB Changes

No DB migration is planned.

Existing persistence is sufficient:

- `expenses` stores the expense header.
- `expense_splits` stores one row per selected split participant.
- A selected subset is represented by creating fewer `expense_splits` rows.
- Existing nullable historical `expense_splits.participant_id` behavior remains unchanged for retained history after participant deletes.

### Business Rules

#### Split target

- `participantIds` is required for every quick expense creation request.
- Omitted `participantIds` must not fall back to all participants.
- The split target is exactly the submitted selected participant set after validation.
- Every submitted split participant must be a current accepted participant of the same trip.
- Duplicate participant IDs are invalid; the server must reject the request rather than deduplicating.
- At least 1 split participant is required.
- Exactly 1 split participant is allowed.
- The payer must still be a current participant, but does not need to be included in `participantIds`.
- Owner/member roles do not affect split eligibility or amount.

#### Allocation rule

Apply the existing equal-split allocation rule to the selected participant subset:

1. Reject `amountMinor < 1`.
2. Reject if selected participant count is 0.
3. Sort selected participants by `joinedAt ASC`, then `participantId ASC`.
4. Let `n = selected participant count`.
5. Let `base = amountMinor / n` using integer division.
6. Let `remainder = amountMinor % n`.
7. Assign `base + 1` minor unit to the first `remainder` selected participants in sorted order.
8. Assign `base` minor units to the rest.
9. Allow split amount `0` when `amountMinor < n`.
10. The sum of all split amounts must equal `amountMinor`.

Request array order does not control persisted split order; `split_order` remains deterministic from `joinedAt ASC, participantId ASC` among selected participants.

#### Preview vs saved result

- Mobile preview uses the currently loaded participant list and selected IDs.
- Server save is authoritative.
- If participant state changes after screen load, server validation or conflict handling determines the final result.
- The post-save summary must display `response.expense.splits`, not recompute from local preview state.

## Acceptance Criteria

- [x] AC-01: Feature spec and implementation plan exist at `docs/features/0053-partial-participant-split.md`.
- [x] AC-02: `CreateQuickExpenseRequest` requires `participantIds` with `minItems: 1` and `uniqueItems: true` in OpenAPI.
- [x] AC-03: Mobile quick expense UI shows a `분할 대상` selector populated from current trip participants.
- [x] AC-04: Initial split target selection includes all loaded participants.
- [x] AC-05: User can exclude the selected payer from `participantIds` and still save if at least one split participant remains selected.
- [x] AC-06: User can save with exactly one selected split participant, and that participant receives the full amount.
- [x] AC-07: Mobile preview and request payload update when participants are toggled.
- [x] AC-08: Mobile prevents submit with zero selected split participants and shows validation copy.
- [x] AC-09: API returns `400` when `participantIds` is omitted, empty, malformed, or duplicated.
- [x] AC-10: API returns `400` when any `participantIds` value is not a current accepted participant of the target trip.
- [x] AC-11: Server creates `expense_splits` only for submitted selected participants.
- [x] AC-12: Server equal-split allocation preserves existing order/remainder/zero-share behavior for the selected subset.
- [x] AC-13: Save success UI shows `실제 저장된 분할` from server response splits.
- [x] AC-14: No DB migration, new endpoint, custom split amount, or omitted-field fallback is introduced.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI requires `participantIds` and generated types stay in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated server/client | `pnpm generate && pnpm verify:generated` |
| Service rejects missing/empty/malformed/duplicate split participant IDs | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Service allows payer-excluded and one-person split requests | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Handler maps omitted/invalid `participantIds` to `400` | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Repository validates selected participants against current trip participants | API repository/handler | `apps/api/internal/storage/trip_repository.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Repository persists splits only for selected participants | API repository/handler | `apps/api/internal/server/server_test.go` or repository integration coverage | `pnpm --filter @i-um/api test` |
| Mobile defaults all participants selected and toggles subset selection | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile request builder includes required `participantIds` and rejects zero selection | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile preview uses only selected participants and permits payer exclusion | Mobile helper | `apps/mobile/lib/trips/quick-expense.test.mts` | `pnpm --filter @i-um/mobile test` |
| Quick expense screen compiles with generated request type | Mobile typecheck | Expo Router/mobile TS | `pnpm --filter @i-um/mobile typecheck` |
| Final changed-surface gate | Whole repo | generated + API + mobile | `pnpm verify` |

## Regression Gaps

- No automated React Native E2E is planned for visually confirming participant toggle interactions.
  - Risk: selector spacing/accessibility issues could be missed by helper tests and typecheck.
  - Follow-up: verify in staging/internal build smoke before closing implementation.
- No dedicated DB migration verification is needed because this feature does not change schema.
  - Risk: repository-level participant subset behavior still relies on handler/API integration coverage.
  - Follow-up: add repository integration coverage if an expense repository test harness is introduced during implementation.

## TDD Implementation Plan

1. Red: contract and generated-type expectations
   - Add `participantIds` to OpenAPI `CreateQuickExpenseRequest` as required, `minItems: 1`, `uniqueItems: true`.
   - Run generation and observe compile/test failures where request structs/types are missing the new field.
   - Verify: `pnpm generate && pnpm verify:generated`.
2. Red: API validation tests
   - Add service tests for omitted/empty, malformed, duplicate participant IDs.
   - Add service/handler tests for invalid non-current participant IDs returning `400`.
   - Add tests for payer excluded from split participants and exactly one split participant succeeding.
   - Verify: `pnpm --filter @i-um/api test`.
3. Green: API service/handler request plumbing
   - Add `SplitParticipantIDs` or equivalent to quick expense input/record types.
   - Validate required non-empty UUID list and duplicate IDs before repository call.
   - Map validation failures to existing quick expense `400` response.
   - Verify: `pnpm --filter @i-um/api test`.
4. Green: repository subset split persistence
   - Fetch selected participant rows for the target trip and ensure every submitted ID exists in current participants.
   - Pass only selected participant rows into existing `AllocateEqualExpenseSplits`.
   - Preserve split order by `joined_at ASC, id ASC`.
   - Keep payer validation independent from split target validation.
   - Verify: `pnpm --filter @i-um/api test`.
5. Red: mobile helper tests
   - Add tests for default all-selected split state, toggling participants, payer exclusion, one-person split preview, zero-selection validation, and request payload `participantIds`.
   - Verify: `pnpm --filter @i-um/mobile test`.
6. Green: mobile UI/helper implementation
   - Add selected split participant state in the quick expense screen and initialize it to all loaded participant IDs.
   - Add `분할 대상` multi-select UI using existing design primitives/tokens.
   - Update preview helper to filter participants by selected IDs.
   - Update request builder to require and send `participantIds`.
   - Disable save and show validation copy when selected count is 0.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck`.
7. Refactor: keep split allocation parity clear
   - Reuse existing allocation helpers where possible.
   - Avoid duplicate screen-local sorting/formatting logic outside `apps/mobile/lib/trips/quick-expense.ts`.
   - Keep handler thin and business validation in service/repository.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test`.
8. Gate: final verification before PR/merge
   - Run generated, API, mobile, and repo verification gates.
   - Verify: `pnpm verify`.

## Verification Record

### Automated Regression

- `pnpm generate`: pass (2026-06-27)
- `pnpm verify:generated`: pass (2026-06-27)
- `pnpm --filter @i-um/api test`: pass (2026-06-27)
- `pnpm --filter @i-um/api build`: pass (2026-06-27)
- `pnpm --filter @i-um/mobile test`: pass (2026-06-27)
- `pnpm --filter @i-um/mobile typecheck`: pass (2026-06-27)
- `pnpm lint`: pass (2026-06-27)
- `pnpm format:check`: pass (2026-06-27)
- `pnpm verify`: pass (2026-06-27)

### Manual Smoke

- Quick expense with subset split participants: Not run — requires staging/internal build smoke.
- Quick expense excluding payer from split participants: Not run — requires staging/internal build smoke.
- Quick expense with exactly one split participant: Not run — requires staging/internal build smoke.

## Release Notes

- 빠른 지출 등록에서 분할 대상 참여자를 직접 선택할 수 있도록 한다. 기본은 전체 참여자이며, 결제자도 필요하면 분할 대상에서 제외할 수 있다.

## Open Questions

- None

## Follow-up Issues

- None
