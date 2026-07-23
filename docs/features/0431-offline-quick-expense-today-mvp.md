# Feature Slice: #431 Today 빠른 지출 오프라인/저장 신뢰 MVP

## Metadata

- GitHub Issue: #431
- Status: Implemented
- Created: 2026-07-23
- Run: `.harness/runs/20260723-issue-431-offline-quick-expense`
- MVP scope: Today bottom sheet quick expense only
- Follow-up: #442 expands the same model to general/full expense entry screens

## Goal

여행 중 Today 화면에서 빠른 지출을 입력할 때 네트워크, 앱 중단, sheet dismiss, 세션 만료 때문에 기록이 사라지지 않게 한다.

## Product decisions

- #431 MVP는 Today 탭 bottom sheet quick expense만 대상으로 한다.
- 일반/full quick expense 화면 확장은 #442로 분리한다.
- 로컬 persistence는 SQLite 없이 `@react-native-async-storage/async-storage` 기반 key-value queue/draft로 구현한다.
- 서버 중복 방지는 `clientMutationId`를 사용한다.
- Today quick expense memo는 create 요청에 포함해 create 후 update 2-step 저장을 제거한다.
- Auth/session cleanup은 local unsynced expense queue를 삭제하지 않는다.

## Scope

### In

- Today quick expense draft autosave/restore.
- Today quick expense local pending create queue.
- Pending/syncing/failed 상태 표시.
- Failed sync retry/edit/delete recovery.
- Connectivity/app foreground/Today focus/session recovery 시 pending sync trigger.
- API idempotency for `POST /trips/{tripId}/days/{tripDayId}/expenses/quick`.
- `clientMutationId` reconciliation in `Expense` DTO.
- DB nullable `expenses.client_mutation_id` and partial unique index.

### Out

- 전체 앱 offline-first 전환.
- 일반/full quick expense 화면 확장 (#442).
- 지출 수정/삭제 offline queue.
- 영수증 이미지 바이너리 장기 오프라인 업로드 보장.
- 임의 일정/장소 conflict resolution.

## Requirements

### Draft preservation

- Today sheet form changes are persisted to device-local storage.
- Draft keys include current user, trip, and Today day context so users do not see another user's draft.
- App background and sheet close must preserve dirty draft.
- Successful durable enqueue clears the draft only after the pending record is written.

### Pending create queue

- Save flow is enqueue-first:
  1. validate form,
  2. generate `localId` and `clientMutationId`,
  3. write pending record to AsyncStorage,
  4. close sheet / update Today UI,
  5. trigger sync.
- The pending queue is source of truth; React state is only a UI cache.
- Queue records store ownerUserId, tripId, tripDayId, request payload, display summary, status, retry count, and timestamps.
- Sync only uploads records for the current authenticated user.

### Status and recovery copy

- `pending`: `동기화 대기`
- `syncing`: `동기화 중`
- `failed`: `확인 필요`

Failed rows expose:

- `다시 시도`
- `수정`
- `삭제`

### API idempotency

- `CreateQuickExpenseRequest.clientMutationId` is optional for backward compatibility.
- When present, server stores it on `expenses.client_mutation_id`.
- `(trip_id, created_by, client_mutation_id)` must be unique for non-null keys.
- Repeating the same key returns the existing expense and does not create another expense, split set, or notification.
- `Expense.clientMutationId` is nullable and lets mobile reconcile local pending records with server rows.

### Memo create

- `CreateQuickExpenseRequest.memo` is optional/null.
- Today quick expense sends memo in create request.
- Today quick expense no longer needs a follow-up `updateExpense` call solely for memo.

## Acceptance criteria

- [x] User can save a Today quick expense without network and see it retained locally as pending.
- [x] Pending expense state is visible and understandable in Today spend UI.
- [x] Sync retry does not duplicate expenses.
- [x] Failed sync provides retry/edit/delete recovery actions.
- [x] Backgrounding or accidental sheet dismissal does not lose the current draft.
- [x] Auth/session recovery does not silently discard local unsynced records.
- [x] Existing route-based/full quick expense behavior remains in scope only for generated type compatibility.

## Test plan

| Behavior | Layer | Command |
|---|---|---|
| Quick expense request includes memo/clientMutationId and validation remains compatible | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Today draft store saves/restores owner-scoped draft | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Pending queue enqueue-first/status transitions/reconciliation | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Today spend summary includes pending without duplicate server rows | Mobile helper | `pnpm --filter @i-um/mobile test` |
| Server duplicate `clientMutationId` returns existing expense only | API repository/service | `CGO_ENABLED=0 pnpm --filter @i-um/api test` |
| OpenAPI/generated outputs in sync | Generated | `pnpm generate && pnpm verify:generated` |
| Mobile screens compile | Mobile | `pnpm --filter @i-um/mobile typecheck` |
| API builds | API | `CGO_ENABLED=0 pnpm --filter @i-um/api build` |

## Verification notes

- Local baseline mobile test needs `EXPO_PUBLIC_RECEIPT_OCR_MODE` unset because the local `.env` fixture mode intentionally changes receipt OCR fixture expectations.
- Local Go tests need `CGO_ENABLED=0` because the current macOS environment aborts CGO-built test binaries with `missing LC_UUID load command`.

## Implementation notes

- Failed delete is a direct local-delete action in the Today recovery card; a separate confirmation modal can be added later if product wants an extra destructive confirmation step.
- Pending and failed unsynced items are included in Today spend totals unless a server expense with the same `clientMutationId` is already present.

## Open questions

- None blocking.
