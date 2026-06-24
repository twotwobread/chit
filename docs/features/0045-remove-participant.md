# Feature Slice: F-045 참여자 제거

## Metadata

- GitHub Issue: #45
- Status: In Progress
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #45 — [Feature Slice] F-045 참여자 제거
- Issue URL: https://github.com/twotwobread/i-um/issues/45
- Ouroboros Interview: `interview_20260624_142320`
- Ouroboros Ambiguity Score: `0.09`
- Ouroboros Seed: `seed_acbdd9aaf981`
- Notes: Ouroboros clarified immediate access revocation, member-only removal, re-invite eligibility, owner-side confirmation UI, and uniform `404 NOT_FOUND` handling for non-removable targets.

## Goal

여행 Owner가 참여자 목록에서 Member를 제거할 수 있다.

제거된 Member는 즉시 해당 여행의 목록, 상세, 일정, 참여자 화면 등 모든 접근 권한을 잃고, 이후 유효한 초대 링크를 다시 받아야 재참여할 수 있다.

## User Flow

1. Owner가 로그인된 상태로 여행 상세 화면에서 `참여자 모두 보기`를 누른다.
2. 앱은 `/trips/{tripId}/participants` 화면에서 현재 참여자 목록을 불러온다.
3. Owner에게만 `member` row의 `제거` 액션이 보인다. `owner` row에는 제거 액션이 보이지 않는다.
4. Owner가 Member row의 `제거`를 누른다.
5. 앱은 확인 모달을 보여준다.
6. Owner가 `제거하기`를 누르면 앱은 `DELETE /trips/{tripId}/participants/{participantId}`를 호출한다.
7. 서버는 요청자가 해당 여행의 Owner인지, 제거 대상이 해당 여행의 current `member`인지 확인한 뒤 `trip_participants` row를 삭제한다.
8. 성공하면 앱은 해당 Member row를 즉시 목록에서 제거한다.
9. 제거된 사용자는 다음 앱/API 접근부터 해당 여행을 볼 수 없고, 여행 목록에도 더 이상 표시되지 않는다.
10. 제거된 사용자가 나중에 유효한 초대 링크를 수락하면 새 Member participant로 재참여할 수 있다.

## Scope

- App UI: Yes — `apps/mobile/app/trips/[tripId]/participants.tsx`에 owner-only member 제거 액션, 확인 모달, 제거 중/실패 상태를 추가한다.
- Mobile domain helpers: Yes — `apps/mobile/lib/trips/participants.ts`에 removable row view model과 제거 실패 메시지/상태 helper를 추가한다.
- Mobile API client: Yes — `apps/mobile/lib/trips/client.ts`에 generated client를 감싼 `removeTripParticipant(tripId, participantId)` wrapper를 추가한다.
- API Contract: Yes — `DELETE /trips/{tripId}/participants/{participantId}` endpoint를 OpenAPI에 추가한다.
- API Server: Yes — handler, mapper/error mapping, trip service method, repository method, sqlc query를 추가한다.
- DB: Query only — 기존 `trip_participants` table을 사용한다. 새 schema migration은 예상하지 않는다.
- Generated Code: Yes — OpenAPI Go server interface/TS client/types와 sqlc generated DB code를 갱신한다.
- Tests: Yes — API service/server/storage regression, mobile helper tests, generated drift/typecheck.
- Deploy/Smoke: Needed — staging API 또는 Expo internal build에서 owner removal flow와 removed-member access loss를 확인한다.

## Out of Scope

- Owner 제거, Owner 자기 자신 제거, Owner 이전, 다중 Owner 관리.
- Member가 스스로 여행을 나가는 기능.
- 제거 사유 입력, 감사 로그, 알림, push/in-app notification.
- 제거된 사용자에게 읽기 전용 히스토리 또는 과거 여행 보관 화면 제공.
- 제거된 사용자의 재초대 금지, 승인 절차, blocklist.
- pending invitee 취소/만료/관리.
- 참여자 role 변경 UI/API.
- 실시간 동기화. 제거 직후 다른 기기의 화면은 다음 refresh/API 접근에서 권한 없음으로 수렴하면 된다.
- Trip content 삭제. 여행, 일정, 장소 등 공유 여행 데이터는 유지되고 participant membership만 제거한다.

## Requirements

### UI / UX

- Screens:
  - `apps/mobile/app/trips/[tripId]/participants.tsx`
  - `apps/mobile/lib/trips/participants.ts`
  - `apps/mobile/lib/trips/client.ts`
- Visibility:
  - 현재 로그인 사용자가 여행 Owner일 때만 제거 UI를 노출한다.
  - 제거 UI는 `role === 'member'`인 row에만 노출한다.
  - `role === 'owner'` row에는 제거 UI를 노출하지 않는다.
  - Member 사용자에게는 어떤 row에도 제거 UI를 노출하지 않는다.
- Confirmation:
  - `제거`를 누르면 확인 모달을 표시한다.
  - 확인 전에는 API를 호출하지 않는다.
  - 취소하면 모달을 닫고 목록을 변경하지 않는다.
- Success:
  - `204 No Content` 성공 후 대상 row를 즉시 현재 목록에서 제거한다.
  - 화면 전체를 강제로 이탈시키지 않는다.
  - 초대 링크 card와 남은 참여자 목록은 유지한다.
- Loading / busy:
  - 제거 요청 중에는 같은 대상의 중복 submit을 막는다.
  - 가능하면 해당 row 또는 confirm action에 busy state를 표시한다.
- Error:
  - 제거 실패 시 target 존재 여부, 이미 제거됨, wrong-trip 여부를 구분해 노출하지 않는다.
  - 기본 실패 copy는 `참여자를 제거할 수 없어요. 잠시 후 다시 시도해주세요.`를 사용한다.
  - 인증 만료는 기존 앱 auth 패턴에 따라 `다시 로그인해주세요.` 또는 로그인 이동을 제공할 수 있다.
  - 실패 시 목록에서 row를 제거하지 않는다. 이미 서버에서 제거되어 `404`가 온 경우에도 UI는 generic failure 후 다음 refresh에서 최신 목록으로 수렴한다.
- Copy:
  - Row action: `제거`
  - Modal title: `<displayName>님을 여행에서 제거할까요?`
  - Modal body: `제거되면 이 여행 목록과 일정에 더 이상 접근할 수 없어요. 다시 초대하면 재참여할 수 있어요.`
  - Cancel action: `취소`
  - Confirm action: `제거하기`
  - Busy: `참여자를 제거하는 중...`
  - Generic failure: `참여자를 제거할 수 없어요. 잠시 후 다시 시도해주세요.`
- Design:
  - `.pi/rules/mobile-ui.md`를 따른다.
  - `theme` token과 기존 `Card`, `PrimaryButton`, `SecondaryButton` 등 shared primitives를 우선 사용한다.
  - 제품 UI에 emoji나 raw hex color를 추가하지 않는다.

### API Contract

OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에 먼저 정의한다.

```text
DELETE /trips/{tripId}/participants/{participantId}
```

- Operation ID: `removeTripParticipant`
- Authentication: bearer token required.
- Path parameters:
  - `tripId: string` — 현재 DB 구현 기준 UUID 형식. 유효하지 않으면 `400 VALIDATION_ERROR`.
  - `participantId: string` — `TripParticipantListItem.participantId` 값. 현재 DB 구현 기준 UUID 형식. 유효하지 않으면 `400 VALIDATION_ERROR`.
- Request body: none.
- Success response:
  - `204 No Content`
  - Empty body.
- Error responses:
  - `400 VALIDATION_ERROR`: malformed `tripId` or `participantId`.
  - `401 UNAUTHORIZED`: missing/invalid auth.
  - `403 FORBIDDEN`: authenticated user is not the trip Owner.
  - `404 NOT_FOUND`: trip not found, target participant is not a current removable Member in this trip, target is already removed, target does not exist, target belongs to another trip, or target is an Owner.
  - `500 INTERNAL_ERROR`: unexpected server error.

Error response body uses the existing `ErrorResponse` schema. For `404`, the server must not distinguish already removed / nonexistent / wrong-trip / owner target in a way the mobile UI depends on.

### DB Changes

No schema migration is planned.

Use the existing `trip_participants` table:

- `id uuid PRIMARY KEY`
- `trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE`
- `user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE`
- `role text NOT NULL CHECK (role IN ('owner', 'member'))`
- unique `(trip_id, user_id)`
- indexes on `user_id` and `trip_id`

Add a sqlc query that deletes only a current Member participant in the requested trip, for example:

```sql
-- name: DeleteTripMemberParticipant :one
DELETE FROM trip_participants
WHERE trip_id = $1::uuid
  AND id = $2::uuid
  AND role = 'member'
RETURNING id::text, user_id::text;
```

Expected effects:

- Removed Member no longer matches membership checks based on `trip_participants`.
- Removed Member no longer sees the trip in `ListTripsByParticipantUser` because that list joins through `trip_participants`.
- Removed Member can rejoin later through `AcceptTripInvite`, which can create a new `(trip_id, user_id)` row because the previous row was deleted.
- Shared trip content remains intact.

### Business Rules

- Only an authenticated trip Owner can remove a participant.
- Only `member` participants are removable.
- Owner participants are never removable through this feature.
- A Member cannot remove any participant.
- A non-participant cannot remove any participant.
- Removing a Member deletes that user's `trip_participants` membership row for the trip.
- Access revocation is immediate from the next authorization check.
- Removed users do not get read-only history access.
- Removed users may rejoin later through any valid invite link for the trip.
- Existing active invite links are not invalidated by removing a Member.
- Already removed, nonexistent, wrong-trip, and owner-as-target participant IDs return `404 NOT_FOUND` for an Owner request.
- The operation is not idempotent: the first successful removal returns `204`; a retry after success returns `404 NOT_FOUND`.

## Acceptance Criteria

- [ ] Owner sees `제거` only on Member rows in `/trips/{tripId}/participants`.
- [ ] Owner does not see a remove action on the Owner row.
- [ ] Member users do not see remove actions on participant rows.
- [ ] Tapping `제거` opens a confirmation modal and does not call the API until `제거하기` is pressed.
- [ ] Canceling the modal leaves the participant list unchanged.
- [ ] Confirming removal calls `DELETE /trips/{tripId}/participants/{participantId}`.
- [ ] Successful removal returns `204 No Content` and removes the row from the owner’s visible list immediately.
- [ ] The removed user loses access to trip list/detail/itinerary/participants on subsequent API/app access.
- [ ] The removed user can rejoin by accepting a valid invite link and then appears as a Member again.
- [ ] Non-owner removal attempts return `403 FORBIDDEN` and do not delete any participant.
- [ ] Attempts to remove Owner, already removed participant, nonexistent participant, or another trip's participant return `404 NOT_FOUND`.
- [ ] Malformed `tripId` or `participantId` returns `400 VALIDATION_ERROR`.
- [ ] Mobile removal failures show a generic failure message and do not reveal whether the target was missing, already removed, or wrong-trip.
- [ ] No DB schema migration is required; generated code is in sync after OpenAPI/sqlc changes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI exposes `DELETE /trips/{tripId}/participants/{participantId}` and generated clients are current | Contract/generated | `packages/api-contract/openapi.yaml`, generated Go/TS artifacts | `pnpm generate && pnpm verify:generated` |
| Owner can remove Member and removed row is deleted | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Non-owner is forbidden, Owner target/missing/wrong-trip/already removed are `ErrNotFound`/`404` | API service/server | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Repository deletes only `(trip_id, participant_id, role=member)` and leaves Owner/other trip rows intact | Storage/sqlc | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Removed user no longer sees/accesses trip; re-accepting invite creates a new Member row | API integration-ish | `apps/api/internal/server/server_test.go` or `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| API builds after handler/interface/repository changes | API build | Go build gate | `pnpm --filter @i-um/api build` |
| Participant row view model marks only owner-visible Member rows as removable | Mobile unit | `apps/mobile/lib/trips/participants.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile removal failure copy is generic for 400/403/404/unknown failures | Mobile unit | `apps/mobile/lib/trips/participants.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile screen compiles with generated `removeTripParticipant` client wrapper and modal state | Mobile typecheck | Expo/TS gate | `pnpm --filter @i-um/mobile typecheck` |
| Full repo gate before PR completion | All | Repo verification | `pnpm verify` |

## Regression Gaps

- Native modal/button interaction in `apps/mobile/app/trips/[tripId]/participants.tsx`: current mobile regression style primarily covers helper logic and typecheck, not full Expo component interaction.
  - Risk: modal wiring or busy state could regress despite helper tests.
  - Follow-up: manual internal-build smoke for owner confirm/cancel/success/failure paths in this feature; consider adding React Native component tests in a future testing-improvement issue.
- Cross-device real-time removal propagation: this slice only requires next API/app access to enforce revocation.
  - Risk: a removed user's already-open screen may display stale data until refresh/navigation/API call.
  - Follow-up: realtime refresh/notification is out of scope and should be handled by a future collaboration sync issue if needed.

## TDD Implementation Plan

1. Red: API contract and generated drift
   - Add failing/updated OpenAPI expectation for `DELETE /trips/{tripId}/participants/{participantId}`.
   - Run: `pnpm verify:generated` and confirm generated artifacts are stale until regeneration.
2. Red: API domain/service tests
   - Add service tests for happy path, unauthenticated, malformed IDs, missing trip, non-owner forbidden, missing/wrong-trip/already removed target, and owner-as-target not found.
   - Run: `pnpm --filter @i-um/api test`.
3. Red: storage tests
   - Add repository test for deleting only a Member in the target trip and preserving Owner/other-trip participants.
   - Add rejoin coverage if not fully covered at server level.
   - Run: `pnpm --filter @i-um/api test`.
4. Green: contract + generated code
   - Update `packages/api-contract/openapi.yaml`.
   - Run `pnpm generate` to refresh OpenAPI Go/TS artifacts.
   - Run: `pnpm verify:generated`.
5. Green: API implementation
   - Add sqlc delete query and regenerate sqlc output through `pnpm generate`.
   - Extend `trip.Repository` and storage implementation with `DeleteTripMemberParticipant`.
   - Add `Service.RemoveParticipant(ctx, userID, tripID, participantID)` with validation, trip existence, owner authorization, member-only deletion, and `ErrNotFound` mapping for non-removable targets.
   - Add API handler method and route implementation from generated interface.
   - Run: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
6. Red: mobile helper tests
   - Extend `apps/mobile/lib/trips/participants.test.mts` for removable row view model and generic removal failure copy.
   - Run: `pnpm --filter @i-um/mobile test`.
7. Green: mobile implementation
   - Add `removeTripParticipant` client wrapper using generated `TripsService.removeTripParticipant`.
   - Extend participant screen state for confirming/removing/error.
   - Render `제거` only for owner-visible Member rows.
   - Add confirmation modal using existing design tokens/shared primitives.
   - On success, remove the row locally.
   - Run: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
8. Refactor
   - Keep row formatting/removable logic in `apps/mobile/lib/trips/participants.ts`.
   - Keep server business rules in `apps/api/internal/trip/service.go`, not handlers.
   - Ensure error mapping remains consistent with existing `ErrorResponse` style.
   - Run relevant API/mobile tests again.
9. Gate
   - Run: `pnpm verify`.
   - If long logs fail, save full output to a log file and report only the failing tail.

## Verification Record

### Automated Regression

- `pnpm verify:generated`: Pass.
- `pnpm --filter @i-um/api test`: Pass.
- `pnpm --filter @i-um/api build`: Pass.
- `pnpm --filter @i-um/mobile test`: Pass.
- `pnpm --filter @i-um/mobile typecheck`: Pass.
- `pnpm verify`: Pass.

### Manual Smoke

- Owner removes Member in internal build/staging: Not run — no staging/internal build smoke requested yet.
- Removed Member loses trip list/detail/itinerary/participants access after refresh: Not run — no staging/internal build smoke requested yet.
- Removed Member rejoins by accepting a valid invite link: Not run — no staging/internal build smoke requested yet.

## Release Notes

- 여행 Owner가 참여자 목록에서 동행자를 제거할 수 있게 된다.
- 제거된 동행자는 해당 여행에 더 이상 접근할 수 없으며, 다시 참여하려면 초대 링크를 새로 수락해야 한다.

## Open Questions

- None

## Follow-up Issues

- Consider a separate `leave trip` feature for Members who want to leave by themselves.
- Consider participant management enhancements such as Owner transfer, role changes, removal audit log, and notifications.
- Consider real-time stale-screen handling if collaboration usage requires immediate cross-device UI updates.
