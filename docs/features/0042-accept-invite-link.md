# Feature Slice: F-042 초대 링크 수락

## Metadata

- GitHub Issue: #42
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #42
- Ouroboros/PM/Seed: Interview `interview_20260624_132118`; ambiguity score `0.062`; Seed generation attempted via MCP but timed out, so no seed artifact was produced.
- Notes: Ouroboros clarified F-042 as a logged-in invite-acceptance slice. Invite links remain reusable until expiry, acceptance is idempotent, login handoff is deferred to #43, and invited-trip mypage reflection is deferred to #44.

## Goal

로그인한 사용자가 받은 초대 링크를 열어 여행에 `member`로 참여할 수 있다.

F-042는 F-041에서 생성된 `/invite/{token}` 링크의 앱 내 수락 동작을 완성한다. 유효한 링크를 로그인 상태로 열면 서버가 `trip_participants`를 생성하거나 이미 참여 중인 상태를 확인하고, 앱은 해당 여행 상세로 이동할 수 있게 한다.

## User Flow

1. 수신자가 F-041로 공유된 `inviteUrl`을 눌러 앱의 `/invite/{token}` 화면을 연다.
2. 앱은 route token을 확인하고 저장된 로그인 세션을 확인한다.
3. 로그인되어 있지 않으면 앱은 수락 API를 호출하지 않고 로그인 안내와 `로그인하기` CTA를 보여준다.
4. 로그인되어 있으면 앱은 generated client로 `POST /invites/{token}/accept`를 호출한다.
5. 서버는 인증, token 형식, token 존재 여부, 만료/비활성화 여부를 확인한다.
6. 아직 해당 여행 참여자가 아니면 서버는 현재 사용자 표시명을 snapshot으로 `trip_participants`에 `member` row를 생성한다.
7. 이미 `member`이거나 `owner`이면 서버는 새 row를 만들지 않고 idempotent success를 반환한다.
8. 앱은 신규 참여, 이미 참여 중, 주최자 본인, 만료, 무효, 로그인 필요, 재시도 가능 오류 상태에 맞는 메시지와 CTA를 보여준다.
9. 신규 참여 또는 이미 참여 중인 사용자가 `여행 보기`를 누르면 앱은 `/trips/{tripId}` 여행 상세로 이동한다.

## Scope

- App UI: yes — `apps/mobile/app/invite/[token].tsx` placeholder를 invite accept 화면으로 전환
- App Logic: yes — `apps/mobile/lib/trips/invite.ts`에 token validation, accept response/error-to-view-state helper 추가
- API Contract: yes — `POST /invites/{token}/accept`, `AcceptTripInviteResponse`, invite-specific error responses
- API Server: yes — handler/service/repository accept flow, error mapping, generated OpenAPI server glue
- DB: no schema migration expected — existing `trip_invites`, `trips`, `users`, `trip_participants`를 사용; sqlc queries/generated DB code는 추가
- Generated Code: yes — OpenAPI TS client/types, Go server interface, sqlc generated code
- Tests: yes — API service/handler/repository tests, mobile helper tests, generated drift/typecheck gates
- Deploy/Smoke: needed — staging 또는 internal build에서 invite create → logged-in accept → trip detail/participants 확인

## Out of Scope

- 비로그인 사용자가 로그인 후 원래 invite로 자동 복귀하는 handoff (#43)
- 초대받은 여행이 마이페이지 목록에 즉시 반영되는 UI acceptance (#44)
- 참여자 제거 (#45)
- invite revoke/regenerate UI, single-use invite, invite use-count, rate limit, pending invitee 표시
- Web fallback에서 초대 수락 처리. F-041 web fallback은 계속 설치 안내만 제공한다.
- Owner 이전, role 변경, member 초대 권한 설정
- push/in-app notification, analytics/event tracking

## Requirements

### UI / UX

#### Screens

- `apps/mobile/app/invite/[token].tsx`
  - F-041 placeholder copy를 제거하고 실제 수락 상태 화면으로 전환한다.
  - 화면 진입 시 route token을 읽는다. 배열 param이면 첫 값을 사용하고, 빈 값은 invalid 상태로 처리한다.
  - 저장된 세션이 없거나 corrupt이면 accept API를 호출하지 않는다.
  - 저장된 세션이 있으면 `acceptTripInvite(token)` client wrapper를 호출한다.
  - 중복 호출을 막기 위해 loading 중 retry/CTA를 비활성화한다.
  - 화면 스타일은 `theme` token과 shared `Card`, `PrimaryButton`, `SecondaryButton` 등 기존 primitive를 사용한다.

#### States and Copy

| State | Title / Message | CTA |
|---|---|---|
| Loading | `초대 링크를 확인하고 있어요.` | none |
| Logged out / session missing | `로그인이 필요합니다.` / `로그인 후 초대 링크를 다시 열어주세요.` | `로그인하기` → `/login`; secondary `홈으로` |
| New member accepted | `여행에 참여했어요.` / `<tripName> 여행을 함께 볼 수 있어요.` | `여행 보기` → `/trips/{tripId}` |
| Existing member | `이미 참여 중인 여행이에요.` / `<tripName> 여행으로 이동할 수 있어요.` | `여행 보기` → `/trips/{tripId}` |
| Owner already | `이미 주최자로 참여 중인 여행이에요.` / `<tripName> 여행으로 이동할 수 있어요.` | `여행 보기` → `/trips/{tripId}` |
| Expired/deactivated token | `초대 링크가 만료됐어요.` / `주최자에게 새 링크를 요청해주세요.` | `홈으로` |
| Invalid/not found token | `초대 링크를 확인할 수 없어요.` / `링크가 잘못되었거나 더 이상 사용할 수 없어요.` | `홈으로` |
| Retryable network/5xx | `초대 링크를 확인할 수 없어요.` / `잠시 후 다시 시도해주세요.` | `다시 시도`; secondary `홈으로` |
| 401 after stored session | `다시 로그인해주세요.` / `로그인 후 초대 링크를 다시 열어주세요.` | `로그인하기` → `/login` |

#### Navigation

- Success 계열은 화면에 결과를 보여준 뒤 사용자가 `여행 보기`를 눌렀을 때 ``router.replace(`/trips/${tripId}`)``로 이동한다.
- Logged-out CTA는 `/login`으로 이동하되, #42에서는 return URL이나 pending invite token을 저장하지 않는다. 로그인 후 invite로 복귀하는 기능은 #43에서 구현한다.
- `홈으로`는 `/`로 이동한다.

#### Mobile helpers

`apps/mobile/lib/trips/invite.ts` 또는 동등 파일에 pure helper를 둔다.

- token 형식 helper: `isInviteTokenFormatValid(token)`
- accept response view model: `toInviteAcceptViewModel(response)`
- accept error view model/message mapping: `getInviteAcceptErrorMessage(error)` 또는 equivalent
- route state builder: stored session 상태, malformed token, API response/error를 screen state로 변환하는 로직은 가능한 한 테스트 가능한 helper로 분리한다.

### API Contract

OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에 먼저 추가한다. 앱은 generated TypeScript client/type만 사용한다.

```text
POST /invites/{token}/accept
```

- Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.
- Request body 없음.
- Tag는 기존 `Trips` 또는 collaboration/invites에 해당하는 기존 OpenAPI grouping을 따른다.
- `operationId`: `acceptTripInvite`

#### Path Parameters

```yaml
token:
  type: string
  minLength: 32
  maxLength: 128
  pattern: '^[A-Za-z0-9_-]+$'
```

Malformed token은 `400 VALIDATION_ERROR`다. 형식은 유효하지만 row가 없으면 `404 INVITE_NOT_FOUND`다.

#### Success Response

HTTP status: `200`

```json
{
  "tripId": "trip_123",
  "tripName": "제주 여행",
  "role": "member",
  "alreadyAccepted": false
}
```

`AcceptTripInviteResponse`:

```yaml
AcceptTripInviteResponse:
  type: object
  required:
    - tripId
    - tripName
    - role
    - alreadyAccepted
  properties:
    tripId:
      type: string
    tripName:
      type: string
    role:
      $ref: '#/components/schemas/TripParticipantRole'
    alreadyAccepted:
      type: boolean
      description: false when this request created a new member participant; true when the user was already a participant.
```

Success cases:

| Case | HTTP | `role` | `alreadyAccepted` | Mutation |
|---|---:|---|---:|---|
| New participant | 200 | `member` | `false` | Insert `trip_participants` row |
| Existing member | 200 | `member` | `true` | No-op |
| Owner opens own invite | 200 | `owner` | `true` | No-op |

#### Error Responses

All errors use the common `ErrorResponse` shape.

| HTTP | Code | Meaning |
|---:|---|---|
| 400 | `VALIDATION_ERROR` | token path param is empty/malformed |
| 401 | `UNAUTHORIZED` | missing/invalid access token |
| 404 | `INVITE_NOT_FOUND` | token format is valid but no invite row exists |
| 410 | `INVITE_EXPIRED` | invite row exists but `expires_at <= now` or `deactivated_at IS NOT NULL` |
| 500 | `INTERNAL_ERROR` | unexpected server error |

Example expired response:

```json
{
  "error": {
    "code": "INVITE_EXPIRED",
    "message": "invite expired",
    "details": []
  }
}
```

### DB Changes

No schema migration is expected for F-042.

Existing schema supports the slice:

- `trip_invites.token` is unique and indexed.
- `trip_invites.trip_id` references `trips(id)` with `ON DELETE CASCADE`.
- `trip_invites.expires_at` and `deactivated_at` define active/expired state.
- `trip_participants` already stores `trip_id`, `user_id`, `role`, `display_name`, `joined_at`.
- `trip_participants_trip_user_unique` enforces idempotency at the DB level.

Required query/repository additions:

- Lookup invite by token inside a transaction, including `trip_id`, `trip_name`, `expires_at`, `deactivated_at`.
- Lookup current user display name from `users` by authenticated user id.
- Lookup existing participant role for `trip_id + user_id`.
- Insert member participant with role `member` and display name snapshot from `users.display_name`.
- Handle unique constraint race on `(trip_id, user_id)` by re-reading participant role and returning `alreadyAccepted: true`.

### Business Rules

- Invite links are reusable by multiple users until expiry or deactivation.
- Accepting an invite does not deactivate the invite token.
- Acceptance is idempotent for an already participating user.
- A logged-in non-participant with a valid active invite becomes a `member`.
- The invite creator/Owner can open their own link; this returns success with `role: owner`, `alreadyAccepted: true`.
- New member `display_name` is a snapshot of the current `users.display_name` at acceptance time.
- Blank user display names should reuse the existing participant fallback policy (`여행자`) if service-level normalization is needed.
- Expired means `expires_at <= now`. Deactivated means `deactivated_at IS NOT NULL`. Both map to `410 INVITE_EXPIRED`.
- Missing token row maps to `404 INVITE_NOT_FOUND`, not `trip not found`.
- Deleted trips should normally remove invite rows by cascade; if encountered through a race, return a safe not-found/expired class error rather than leaking internals.
- Server must not log raw invite token values in normal request logs.

## Acceptance Criteria

- [x] AC-01: `docs/features/0042-accept-invite-link.md` contains the approved feature spec and TDD implementation plan.
- [x] AC-02: `packages/api-contract/openapi.yaml` defines authenticated `POST /invites/{token}/accept` with `AcceptTripInviteResponse` and 400/401/404/410/500 error responses.
- [x] AC-03: Generated Go server artifacts and TypeScript client/types include `acceptTripInvite` and `AcceptTripInviteResponse`.
- [x] AC-04: Logged-out or missing/corrupt-session mobile users opening `/invite/{token}` do not call the accept API and see login guidance that says to reopen the invite after login.
- [x] AC-05: A logged-in non-participant opening a valid active invite can accept it, creating exactly one `trip_participants` row with role `member` and current user display-name snapshot.
- [x] AC-06: Accepting the same active invite by the same new member again returns `200`, `alreadyAccepted: true`, and does not create a duplicate participant row.
- [x] AC-07: Existing `member` and `owner` participants opening a valid invite receive `200` with the correct `role` and `alreadyAccepted: true`.
- [x] AC-08: Successful accept responses include `tripId` and `tripName`; the mobile success state exposes `여행 보기` that navigates to `/trips/{tripId}`.
- [x] AC-09: Malformed token, missing token row, expired/deactivated token, and unauthenticated request return `400`, `404`, `410`, and `401` respectively with documented error codes.
- [x] AC-10: API acceptance is race-safe: concurrent accepts for the same user/trip cannot create duplicate participants and return idempotent success after unique constraint conflict.
- [x] AC-11: `/invite/{token}` mobile screen shows loading, success, already-member, owner-already, login-needed, expired, invalid, retryable-error states with the copy defined in this spec.
- [x] AC-12: F-042 does not implement login return handoff (#43), mypage reflection acceptance (#44), invite revoke/regenerate, single-use invite, or pending invitee UI.
- [ ] AC-13: Staging or internal build smoke verifies Owner creates invite → logged-in second user opens link → accepts → opens trip detail → appears in participant list.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI endpoint/schema generated | Contract/generated | `packages/api-contract/openapi.yaml`, generated TS/Go | `pnpm generate && pnpm verify:generated` |
| Service accepts valid invite for new member | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Service idempotency for member/owner and reusable invite | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Expired/deactivated/missing/malformed/auth errors | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Repository transaction inserts member and handles unique conflict | API storage | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Handler maps 200/400/401/404/410 responses | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Mobile accept response/error maps to route view model/copy | Mobile helper | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile generated client usage and route type safety | Mobile typecheck | `apps/mobile/app/invite/[token].tsx`, `apps/mobile/lib/trips/client.ts` | `pnpm --filter @i-um/mobile typecheck` |
| Final integrated gate | Repo | all relevant generated/API/mobile gates | `pnpm verify` |

## Regression Gaps

- Full Expo Router deep-link UI automation is not currently covered by a component/e2e test harness.
  - Risk: route param parsing or navigation CTA could regress despite helper/type tests.
  - Follow-up: add mobile route/e2e harness when the project introduces UI integration tests; for F-042 cover with internal build smoke.

## TDD Implementation Plan

1. Red: API contract
   - Add failing OpenAPI/generated expectation for `POST /invites/{token}/accept` and `AcceptTripInviteResponse`.
   - Verify: `pnpm generate && pnpm verify:generated` should fail until generated files are updated.

2. Green: Contract generation
   - Update `packages/api-contract/openapi.yaml` with endpoint, schema, and error responses.
   - Regenerate TS client and Go OpenAPI server artifacts.
   - Verify: `pnpm verify:generated`.

3. Red: Domain service behavior
   - Add service tests for new-member accept, existing member idempotency, owner already, reusable invite not deactivated, malformed token, missing token, expired/deactivated token, and auth required.
   - Verify: `pnpm --filter @i-um/api test` fails.

4. Green: Domain types/service/repository interface
   - Add `AcceptTripInvite` service method, result types, repository interface methods, token validation, invite-specific errors, and business rules.
   - Keep transaction/storage implementation stubbed or fake-backed enough for service tests.
   - Verify: `pnpm --filter @i-um/api test`.

5. Red: Repository persistence
   - Add storage tests for active token lookup + member insert, no duplicate on second accept, unique-conflict race fallback, expired/deactivated rejection, and user display-name snapshot.
   - Verify: `pnpm --filter @i-um/api test` fails for storage cases.

6. Green: SQL/sqlc repository implementation
   - Add sqlc queries for invite lookup by token, participant role lookup/re-read, user display-name lookup if not reusable, and member participant insert.
   - Implement transaction and unique constraint handling in `apps/api/internal/storage/trip_repository.go`.
   - Regenerate sqlc DB code.
   - Verify: `pnpm generate && pnpm --filter @i-um/api test`.

7. Red: HTTP handler/error mapping
   - Add server handler tests for 200 new member, 200 already member/owner, 400 malformed token, 401 unauthorized, 404 invite not found, 410 expired.
   - Verify: `pnpm --filter @i-um/api test` fails.

8. Green: Handler/mappers/router
   - Implement generated server method `AcceptTripInvite`, response mapper, and `writeTripInviteAcceptError` mapping.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.

9. Red: Mobile helper state
   - Add mobile tests for token validation, accept response to success/already/owner copy, error mapping for 400/404/410/401/5xx/network, and logged-out state copy.
   - Verify: `pnpm --filter @i-um/mobile test` fails.

10. Green: Mobile client/helper/screen
    - Add `acceptTripInvite(token)` wrapper in `apps/mobile/lib/trips/client.ts` using generated client and `getMeWithRefresh()`.
    - Replace placeholder route with accept screen states and navigation CTAs.
    - Clear corrupt/invalid sessions consistently with existing auth handling.
    - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.

11. Refactor
    - Remove obsolete `invitePlaceholderMessage` test/copy or replace it with accept-screen helper tests.
    - Keep display formatting/error mapping in helpers, not inline screen code.
    - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test`.

12. Gate
    - Run final generated, API, and mobile checks.
    - Verify: `pnpm verify`.

## Verification Record

### Automated Regression

- `pnpm verify:generated`: pass
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass

### Manual Smoke

- Owner creates invite link in staging/internal build: not run — staging/internal smoke not requested yet
- Logged-in second user opens `/invite/{token}` and accepts: not run — staging/internal smoke not requested yet
- Accepted user opens trip detail and appears in participant list: not run — staging/internal smoke not requested yet
- Logged-out invite opens login-needed state without API call: not run — staging/internal smoke not requested yet
- Expired/invalid token states: not run — staging/internal smoke not requested yet

## Release Notes

- 초대 링크를 받은 로그인 사용자가 앱에서 링크를 열어 여행에 참여할 수 있게 한다.
- 이미 참여 중인 사용자는 오류 없이 해당 여행으로 이동할 수 있다.
- 비로그인 사용자의 로그인 후 자동 복귀는 후속 #43에서 제공한다.

## Open Questions

- None for F-042 MVP.

## Follow-up Issues

- #43: 초대 링크 로그인 handoff
- #44: 초대 후 마이페이지 반영
- #45: 참여자 제거
- Follow-up TBD: invite revoke/regenerate, single-use/use-count/rate-limit policy, pending invitee UI
