# Feature Slice: F-012 계정 삭제

## Metadata

- GitHub Issue: #12
- Status: Implementation Complete (local)
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #12 `[Feature Slice] F-012 계정 삭제`
- Ouroboros Interview Session: `interview_20260624_084915`
- Ouroboros Seed: `seed_7a811326f764`
- Ambiguity Score: `0.06`
- Notes: Ouroboros clarified account deletion policy, confirmation UX, transactional semantics, data anonymization, trip ownership transfer, invite deactivation, session invalidation, re-signup behavior, and observable success criteria for App Store submission readiness.

## Readiness / Status Gate

- Spec was approved by the user on 2026-06-24 and implemented in `feature/F-012-delete-account`.
- Material product/API/DB/mobile decisions are closed for this slice.
- Locked policy: deletion is immediate/final, uses current i-um session plus explicit confirmation, requires no Apple/Kakao re-auth in MVP, and runs all server-side deletion/anonymization work all-or-nothing in one DB transaction.

## Goal

사용자가 앱 안에서 자신의 i-um 계정을 삭제할 수 있다.

계정 삭제가 성공하면 사용자는 즉시 비로그인 상태가 되고, i-um 로그인 정보와 프로필 개인정보는 제거된다. 혼자 만든 여행은 삭제되고, 함께 쓰던 여행은 남은 참여자가 계속 사용할 수 있도록 삭제 사용자를 `탈퇴한 사용자`로 익명화한다.

## Problem

- App Store 제출 대응을 위해 앱 안에서 계정 삭제 기능이 필요하다.
- 현재 앱은 로그아웃, 내 프로필 조회, 내 이름 수정은 지원하지만 i-um 계정 삭제를 지원하지 않는다.
- i-um의 `users` row는 `trips.created_by`, `trip_participants.user_id`, `trip_invites.created_by`에서 참조되므로 단순 user hard delete는 FK 제약과 공유 여행 데이터 손실을 만든다.
- 계정 삭제는 auth/session/identity, 사용자 PII, 여행 참여 관계, Owner 권한, 초대 링크가 얽힌 파괴적 작업이므로 구현 전 정확한 정책과 검증 기준이 필요하다.

## User Flow

1. 사용자가 로그인한 상태로 `마이페이지` → `계정 관리` 화면을 연다.
2. 앱은 계정 화면의 위험 영역에 `계정 삭제` action을 보여준다.
3. 사용자가 `계정 삭제`를 누른다.
4. 앱은 삭제 결과를 설명하는 확인 UI를 보여준다.
5. 사용자가 `취소`를 누르면 API를 호출하지 않고 계정 화면으로 돌아간다.
6. 사용자가 `삭제하기`를 누르면 앱은 generated client로 `DELETE /me`를 호출한다.
7. 서버는 bearer access token을 검증하고 현재 active user를 찾는다.
8. 서버는 하나의 DB transaction에서 다음 작업을 all-or-nothing으로 수행한다.
   - auth identity/session 삭제
   - 사용자 PII 제거와 `users.deleted_at` 설정
   - solo/effectively solo trip hard delete
   - shared trip의 삭제 사용자 participant 익명화
   - 삭제 사용자가 Owner였던 shared trip의 Owner를 가장 먼저 참여한 남은 active participant에게 이전
   - 삭제 사용자가 만든 active invite 비활성화
9. 서버가 `204 No Content`를 반환한다.
10. 앱은 local i-um session, API bearer token, provider local session cleanup을 best-effort로 정리한다.
11. 앱은 `/login`으로 replace/reset 이동한다.
12. 사용자는 뒤로가기로 계정/마이페이지 등 인증 화면에 돌아갈 수 없다.
13. 같은 Apple/Kakao provider로 다시 로그인하면 이전 계정과 연결되지 않고 새 i-um user로 가입된다.

## Scope

- App UI: yes, `apps/mobile/app/account.tsx`에 계정 삭제 위험 영역, confirmation UI, deleting/error 상태 추가
- API Contract: yes, canonical `DELETE /me` endpoint와 `204/401/500` response contract 추가
- API Server: yes, auth handler/service/repository에 current account deletion 추가
- DB: yes, `users.deleted_at` migration, account deletion transaction query 추가
- Mobile API Integration: yes, generated `deleteMe` operation을 사용하는 auth helper 추가
- Tests: API/server/storage transaction tests, token invalidation tests, mobile helper/flow tests, generated drift, migration verification
- Deploy/Smoke: needed, staging 또는 internal build에서 계정 삭제 happy path와 same-provider re-signup smoke 확인

## Out of Scope

- Apple ID, Kakao account, KakaoTalk account 자체 삭제
- Apple/Kakao provider token server-side revocation
- 계정 삭제 직전 Apple/Kakao 재인증 요구
- 삭제 유예 기간, undo, 복구 기능
- 삭제 전 data export/download
- 삭제 reason 수집, analytics, 운영 audit table
- 관리자 계정 삭제 도구
- email/support/web form 기반 계정 삭제 요청 workflow
- 공유 여행 전체 hard delete
- 탈퇴한 사용자의 shared trip participant row 완전 제거
- 다른 참여자에게 push/in-app/email 알림
- 수동 Owner 이전 UI 또는 role 관리 UI
- participant self-leave
- `DELETE /auth/me` compatibility alias
- `GET /auth/me` deprecation/removal policy 변경
- provider unlink UI 변경
- 로그아웃(#9), 내 이름 수정(#11) behavior 변경

## Requirements

### UI / UX

#### Screens

- `apps/mobile/app/account.tsx`
  - 기존 내 이름 수정, provider linking, logout flow를 유지한다.
  - 계정 화면 하단에 destructive/danger section을 추가한다.
  - 로그인된 ready 상태에서만 `계정 삭제`를 누를 수 있다.
  - 삭제 중에는 중복 입력을 막거나 동일 흐름으로 coalesce한다.
- `/login`
  - 삭제 성공 후 replace/reset 방식으로 진입하는 비로그인 완료 상태다.

#### Confirmation Behavior

- `계정 삭제`를 누르면 confirmation UI를 연다.
- Confirmation UI는 native `Alert` 또는 project token을 쓰는 inline/modal UI 중 현재 앱 구조에 맞는 최소 구현을 사용한다.
- `취소`는 confirmation UI만 닫고 API를 호출하지 않는다.
- `삭제하기`를 누른 뒤에만 `DELETE /me`를 호출한다.
- 삭제 요청 중에는 confirm/delete action을 비활성화한다.
- 삭제 성공 후 계정 화면에 머물지 않고 `/login`으로 replace/reset 이동한다.
- 삭제 실패 시 계정 화면에 머물고 retry 가능하게 한다.
- 구현 복잡도를 크게 늘리지 않는다면 `위 내용을 확인했어요` 체크박스를 둘 수 있지만, MVP 필수 조건은 명확한 경고 문구와 최종 `삭제하기` 확인이다.

#### States

- Ready: `계정 삭제` action을 누를 수 있다.
- Confirming: 삭제 결과와 되돌릴 수 없음을 설명하고 `취소`, `삭제하기`를 제공한다.
- Deleting: `계정을 삭제하는 중...`을 표시하고 중복 제출을 막는다.
- Success: local auth cleanup 후 `/login`으로 replace/reset 이동한다.
- Auth error: `401 UNAUTHORIZED` 또는 invalid refresh token은 기존 로그인 필요 흐름처럼 `다시 로그인해주세요.`를 보여준다.
- Transaction/server/network error: local session을 유지하고 `지금은 계정을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`를 보여준다.
- Provider cleanup failure after confirmed server success: i-um local cleanup과 `/login` 이동을 막지 않는다.

#### Copy / Labels

- Danger section title: `계정 삭제`
- Delete CTA: `계정 삭제`
- Confirmation title: `계정을 삭제할까요?`
- Confirmation body:

```text
계정을 삭제하면 로그인 정보와 프로필이 삭제돼요.
혼자 만든 여행은 함께 삭제돼요.
함께 쓰던 여행은 유지되고 내 정보는 탈퇴한 사용자로 표시돼요.
내가 만든 초대 링크는 비활성화돼요.
같은 Apple 또는 Kakao로 다시 로그인해도 새 계정으로 시작돼요.
이 작업은 되돌릴 수 없어요.
```

- Cancel: `취소`
- Confirm delete: `삭제하기`
- Deleting: `계정을 삭제하는 중...`
- Auth error: `다시 로그인해주세요.`
- Retryable failure: `지금은 계정을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`
- Optional success message if login route supports it: `계정이 삭제되었습니다.`

#### Design Requirements

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- destructive action은 기존 danger style 또는 `theme.color.danger`를 사용한다.
- Screen code는 route/API/navigation orchestration을 담당하고, deletion helper/error mapping/confirmation state는 `apps/mobile/lib/auth/**`의 작은 helper로 분리한다.

### API Contract

OpenAPI source of truth인 `packages/api-contract/openapi.yaml`을 먼저 수정한다.

```text
DELETE /me
```

- OperationId: `deleteMe`
- Tags: `Auth`
- Security: bearer access token required
- No `DELETE /auth/me` alias in this slice

#### Request

No request body.

F-012에서는 delete reason, confirmation token, dry-run flag, cascade flag를 받지 않는다. 삭제 확인은 모바일 UI 책임이며 서버는 authenticated current user 삭제만 처리한다.

#### Success Response

HTTP status: `204 No Content`

No response body.

#### Response Precedence

1. Missing/invalid bearer token, revoked/deleted/missing session: `401 UNAUTHORIZED`
2. Authenticated active user deletion succeeds: `204 No Content`
3. Authenticated context가 user를 찾지 못하거나 이미 삭제된 user를 가리키면 `401 UNAUTHORIZED`
4. Unexpected server/storage error: `500 INTERNAL_ERROR`

삭제 성공 후 같은 access token 또는 refresh token으로 재시도하면 session row가 없어졌거나 user가 deleted 상태이므로 `401 UNAUTHORIZED` 또는 `INVALID_REFRESH_TOKEN` 계열 실패가 반환된다.

#### Errors

Unauthorized:

HTTP status: `401`

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "unauthorized",
    "details": []
  }
}
```

Unexpected server error:

HTTP status: `500`

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "details": []
  }
}
```

### DB Changes

F-012 uses logical user deletion/anonymization plus hard delete for private auth/session/solo-trip data.

#### Migration

Add goose migration, e.g.:

```text
apps/api/migrations/00008_add_user_deleted_at.sql
```

Expected schema change:

```sql
ALTER TABLE users ADD COLUMN deleted_at timestamptz NULL;

CREATE INDEX users_deleted_at_idx
  ON users (deleted_at)
  WHERE deleted_at IS NOT NULL;
```

Migration rollback drops the index and column. Migration rollback is not an account-delete undo mechanism and does not restore operationally deleted account data.

#### Tables / Data Handling

- `users`
  - Keep the row as a tombstone because retained shared trip/invite rows need FK integrity.
  - Set `deleted_at = now()`.
  - Set `display_name = '탈퇴한 사용자'`.
  - Set `email = NULL`, `email_normalized = NULL`, `email_verified = false`, `avatar_url = NULL`.
  - Update `updated_at = now()`.
- `auth_identities`
  - Hard-delete all rows for the user.
  - This removes provider subject/email/profile snapshots and lets the same provider sign up as a new i-um user later.
- `auth_sessions`
  - Hard-delete all rows for the user.
  - Existing access tokens fail because their `sid` no longer resolves to an active session.
  - Existing refresh tokens fail because their hash row no longer exists.
- `trips` and trip-scoped tables
  - Hard-delete solo/effectively solo trips where the deleting user is the only active participant.
  - For future-proofing after `users.deleted_at`, active participant means participant joined to a `users` row where `deleted_at IS NULL` before the current deletion is applied.
  - Existing `ON DELETE CASCADE` removes trip participants, invites, places, lodging rows, and itinerary items for deleted trips.
  - Retain shared trips where at least one other active participant exists.
- `trip_participants`
  - For retained shared trips, update the deleting user's `display_name` snapshot to `탈퇴한 사용자`.
  - If the deleting user was Owner, set their retained participant role to `member` after transferring ownership so a retained trip has one active Owner.
  - Select Owner successor from remaining active participants by earliest `joined_at`, then `id` as tie-breaker.
  - Update the successor participant role to `owner`.
- `trips.created_by`
  - For shared trips whose Owner is transferred, update `trips.created_by` to the successor user id because existing detail/UI behavior may use `createdBy` as Owner signal.
  - For trips where the deleting user was not Owner, leave `created_by` unchanged.
- `trip_invites`
  - Solo/effectively solo trip deletion cascades those trip invites.
  - For retained shared trips, deactivate active invites created by the deleting user by setting `deactivated_at = now()`.
  - Invites created by other users are unchanged.
- `auth_identities.email_normalized` and `users.email_normalized`
  - Deleted account email data is removed, so future same-provider or same-email signup is not blocked by the deleted account.

#### Query / sqlc Changes

Add or update sqlc queries in `apps/api/queries/auth.sql` or a small account-deletion query file:

- `GetUserByID` filters `deleted_at IS NULL` for auth/current-user reads.
- `UpdateUserDisplayName` filters `deleted_at IS NULL`.
- `FindIdentityByProviderSubject` joins only active users.
- `FindUserByVerifiedIdentityEmail` joins only active users.
- `GetActiveUserForUpdate` locks the active user row before deletion.
- `ListRetainedSharedTripsForAccountDeletion` finds trips where the deleting user participates and at least one other active participant remains.
- `ListSoloTripsForAccountDeletion` finds trips where the deleting user is the only active participant.
- `TransferOwnedSharedTripsForAccountDeletion` updates successor participant role and `trips.created_by` for retained shared trips where the deleting user is Owner.
- `AnonymizeTripParticipantsByUserID` updates retained participant display names and demotes the deleted Owner participant when needed.
- `DeactivateActiveInvitesCreatedByUserID` deactivates retained active invites created by the user.
- `DeleteSoloTripsByUserID` hard-deletes solo/effectively solo trips.
- `DeleteAuthIdentitiesByUserID` removes provider identities.
- `DeleteAuthSessionsByUserID` removes sessions.
- `MarkUserDeleted` wipes PII and marks `deleted_at`.

The repository should execute these operations in one DB transaction with one consistent `now` timestamp.

### Business Rules

- Only an authenticated active user can delete their own account.
- Account deletion is immediate and final. There is no grace period, undo, or recovery in this slice.
- The delete authority is the current i-um bearer session plus explicit in-app confirmation.
- Apple/Kakao reauthentication is not required in this MVP.
- `DELETE /me` is the canonical account deletion endpoint.
- `DELETE /auth/me` is not added.
- Account deletion must be all-or-nothing in one DB transaction.
- If any server-side deletion/anonymization step fails, account deletion is not completed.
- On transaction failure, mobile local session remains and the user can retry.
- After account deletion succeeds, all i-um sessions for that user are invalid.
- The deleted account cannot call `GET /me`, `PATCH /me`, `GET /trips`, or any authenticated endpoint with old tokens.
- Provider identities are removed. Logging in later with the same Apple/Kakao provider creates a new i-um user and does not reconnect old retained shared trips.
- User PII stored in `users`, `auth_identities`, and `auth_sessions` is removed or anonymized.
- Solo/effectively solo trips are treated as private user content and are hard-deleted.
- Shared trips are retained for remaining participants.
- Deleted users are shown as `탈퇴한 사용자` in retained shared trip participant context.
- Shared trips owned by the deleted user transfer ownership to the earliest remaining active participant.
- Active invite links created by the deleted user are deactivated so a deleted account's invite link does not remain usable.
- External Apple/Kakao accounts are not deleted by i-um.
- Provider-local cleanup on device is best-effort and must not block successful i-um account deletion completion after confirmed server success.
- Server logs and client errors must not include raw access tokens, refresh tokens, provider tokens, provider subjects, or email addresses.

## Acceptance Criteria

- [ ] `docs/features/0012-delete-account.md` exists and records the Ouroboros source, scope, regression plan, TDD plan, and verification plan for #12.
- [ ] OpenAPI defines canonical authenticated `DELETE /me` with `204 No Content`, `401`, and `500` responses.
- [ ] No `DELETE /auth/me` compatibility alias is added.
- [ ] Go server interface and TypeScript API client are regenerated from OpenAPI.
- [ ] DB migration adds `users.deleted_at` and generated `apps/api/schema.sql` is updated.
- [ ] Account deletion runs all server-side side effects inside one DB transaction.
- [ ] Transaction includes auth identity deletion, auth session deletion, user PII wipe/anonymization, solo/effectively solo trip deletion, shared trip owner transfer, shared participant anonymization, and active invite deactivation.
- [ ] If any transaction step fails, none of the deletion/anonymization side effects are committed.
- [ ] `DELETE /me` deletes all `auth_identities` rows for the current user.
- [ ] `DELETE /me` deletes all `auth_sessions` rows for the current user.
- [ ] Deleted user's old access token is rejected by `GET /me` with `401 UNAUTHORIZED` after deletion.
- [ ] Deleted user's old refresh token is rejected by `POST /auth/token/refresh` with `INVALID_REFRESH_TOKEN` or `401` after deletion.
- [ ] `DELETE /me` wipes `users.email`, `users.email_normalized`, `users.avatar_url`, and provider identity profile snapshots.
- [ ] `DELETE /me` sets `users.deleted_at` and replaces `users.display_name` with `탈퇴한 사용자`.
- [ ] Auth/current-user queries do not return users where `deleted_at IS NOT NULL`.
- [ ] Same Apple/Kakao provider can sign up again after deletion without colliding with old `auth_identities`.
- [ ] Same Apple/Kakao provider re-login after deletion creates a new i-um user id.
- [ ] Deleted account's previous display name, email, and avatar are no longer exposed in app UI or API responses.
- [ ] Solo/effectively solo trips from the deleted user are no longer visible in trip list or trip detail.
- [ ] Shared trips remain visible and functional for remaining participants.
- [ ] Retained shared trip participant snapshots for the deleted user show `탈퇴한 사용자`.
- [ ] Shared trips owned by the deleted user transfer Owner role to the earliest remaining active participant.
- [ ] Shared trips whose Owner is transferred also update `trips.created_by` to the successor user id.
- [ ] Active invites created by the deleted user in retained shared trips are deactivated.
- [ ] Account screen shows a discoverable `계정 삭제` action while logged in.
- [ ] Tapping `계정 삭제` opens confirmation UI and does not call the API until `삭제하기` is confirmed.
- [ ] Confirmation UI includes required irreversible deletion, solo trip deletion, shared trip anonymization, invite deactivation, and new-account-on-relogin copy.
- [ ] Delete in-progress state prevents duplicate API calls or coalesces duplicate taps.
- [ ] Successful mobile deletion clears local stored session, clears configured API bearer token, best-effort clears provider local sessions, and navigates to `/login` with replace/reset semantics.
- [ ] After mobile deletion success, back navigation cannot return to account/mypage authenticated screens.
- [ ] Network/5xx/transaction deletion failure keeps the local session and shows `지금은 계정을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`.
- [ ] Auth failure during deletion shows existing login-required behavior.
- [ ] API/server/storage tests cover success, unauthorized, token invalidation, PII wipe, identity/session removal, rollback on injected failure, solo trip deletion, shared trip anonymization, owner transfer, invite deactivation, and provider re-signup behavior.
- [ ] Mobile tests cover delete helper refresh retry, success cleanup, failure local-session retention, duplicate-tap/coalesce, and confirmation state helper behavior.
- [ ] Generated drift, DB migration apply/rollback, API tests/build, mobile tests/typecheck, and full `pnpm verify` pass.
- [ ] Staging/internal or local dev-auth smoke confirms account deletion happy path and same-provider re-signup as a new user.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| `DELETE /me` is present in OpenAPI with auth security, `204`, `401`, `500`, and no `DELETE /auth/me` alias | API contract/generated | `packages/api-contract/openapi.yaml` and generated artifacts | `pnpm verify:generated` |
| DB schema adds `users.deleted_at`; migration applies, rolls back, and reapplies | DB migration | `apps/api/migrations/00008_add_user_deleted_at.sql`, `apps/api/schema.sql` | DB migration commands in Verification Plan |
| Account deletion rejects missing/invalid auth context | API service/handler | `apps/api/internal/auth/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Account deletion removes identities/sessions, marks user deleted, wipes PII, and hides deleted user from `Me`/display-name update | API service/repository | `apps/api/internal/auth/service_test.go`, `apps/api/internal/storage/auth_repository_test.go` or server integration tests | `pnpm --filter @i-um/api test` |
| Old access token fails on `GET /me` and old refresh token fails on `POST /auth/token/refresh` after deletion | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Deletion transaction rolls back all side effects when an injected repository step fails | API repository/service | `apps/api/internal/storage/auth_repository_test.go` or `apps/api/internal/auth/service_test.go` with fake repo | `pnpm --filter @i-um/api test` |
| Solo/effectively solo trips are hard-deleted with dependent trip rows cascaded | API repository/server | `apps/api/internal/server/server_test.go` or storage integration test | `pnpm --filter @i-um/api test` |
| Shared trips remain available to remaining participants and show deleted user's participant display name as `탈퇴한 사용자` | API repository/server | `apps/api/internal/server/server_test.go` or trip repository integration test | `pnpm --filter @i-um/api test` |
| Shared trips owned by deleted user transfer Owner role and `trips.created_by` to earliest remaining active participant | API repository/server | `apps/api/internal/server/server_test.go` or storage integration test | `pnpm --filter @i-um/api test` |
| Active invites created by deleted user are deactivated for retained shared trips | API repository/server | `apps/api/internal/server/server_test.go` or trip repository integration test | `pnpm --filter @i-um/api test` |
| Same Apple/Kakao provider can sign up again as a new i-um user after deletion | API auth service/server | `apps/api/internal/auth/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Mobile `deleteAccountWithRefresh` uses generated `deleteMe`, configures bearer token, refreshes once on 401, clears local/provider/API auth only after success, and preserves local session on retryable failure | Mobile auth helper | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile delete flow prevents/coalesces duplicate taps and replace/resets to `/login` after success | Mobile flow helper | `apps/mobile/lib/auth/account-deletion-flow.test.mts` | `pnpm --filter @i-um/mobile test` |
| Confirmation helper does not call API before explicit confirm and maps copy/states correctly | Mobile pure logic | `apps/mobile/lib/auth/account-deletion.test.mts` or flow test | `pnpm --filter @i-um/mobile test` |
| Account screen remains type-safe with generated `deleteMe` and existing name/link/logout flows | Mobile typecheck | `apps/mobile/app/account.tsx`, auth helper | `pnpm --filter @i-um/mobile typecheck` |
| Full project regression remains green | Full gate | repository verification gate | `pnpm verify` |

## Regression Gaps

- React Native component-level rendering of the final account deletion confirmation UI may not be fully automated if the project still lacks a component/render test harness.
  - Risk: visual layout, accessibility label, or native Alert button wiring regressions may require manual smoke to catch.
  - Follow-up: introduce a React Native component test harness before adding more destructive account-management flows.

## TDD Implementation Plan

Expected file mapping for implementation:

| Concern | Expected path |
|---|---|
| OpenAPI contract | `packages/api-contract/openapi.yaml` |
| API handler/server tests | `apps/api/internal/server/server_test.go` |
| API handler implementation | `apps/api/internal/server/auth_handlers.go` |
| API service tests | `apps/api/internal/auth/service_test.go` |
| API service/repository interface | `apps/api/internal/auth/service.go`, `apps/api/internal/auth/types.go` |
| API storage adapter | `apps/api/internal/storage/auth_repository.go` |
| DB migration/schema | `apps/api/migrations/00008_add_user_deleted_at.sql`, `apps/api/schema.sql` |
| SQL query/generated DB code | `apps/api/queries/auth.sql` or account deletion query file, `apps/api/internal/db/*.go` |
| Generated OpenAPI code | `apps/api/internal/openapi/server.gen.go`, `packages/api-contract/gen/ts/**` |
| Mobile auth helper/tests | `apps/mobile/lib/auth/client.ts`, `apps/mobile/lib/auth/client.test.mts` |
| Mobile deletion flow/helper/tests | `apps/mobile/lib/auth/account-deletion-flow.ts`, `apps/mobile/lib/auth/account-deletion-flow.test.mts` or equivalent |
| Account delete UI | `apps/mobile/app/account.tsx` |

1. Red: API/server behavior tests
   - Add failing tests for authenticated `DELETE /me` success, missing/invalid bearer `401`, old access token rejection after deletion, old refresh token rejection after deletion, and no response body on success.
   - Verify: `pnpm --filter @i-um/api test` fails before implementation.
2. Red: contract/deprecation expectation
   - Add/update OpenAPI expectations so `DELETE /me` exists and `DELETE /auth/me` does not.
   - Verify: `pnpm verify:generated` fails until OpenAPI and generated artifacts are updated.
3. Red: DB/repository deletion policy tests
   - Add failing tests for identity/session deletion, PII wipe, `deleted_at`, active-user query filtering, solo/effectively solo trip hard delete, shared trip participant anonymization, owner transfer, invite deactivation, provider re-signup, and rollback on injected failure.
   - Use fixtures with one solo trip, one shared trip where deleted user is member, and one shared trip where deleted user is owner.
   - Verify: `pnpm --filter @i-um/api test` fails until migration/query/repository behavior exists.
4. Green: OpenAPI-first contract and generated code
   - Add `DELETE /me` with operationId `deleteMe`, bearer auth, `204`, `401`, `500`.
   - Regenerate Go OpenAPI server code and TypeScript client/types.
   - Verify: `pnpm generate` and `pnpm verify:generated` pass after generated artifacts are committed.
5. Green: DB migration and sqlc queries
   - Add `users.deleted_at` migration and update `apps/api/schema.sql`.
   - Update auth/current-user queries to ignore deleted users.
   - Add account deletion transaction queries, including successor owner selection and `trips.created_by` update.
   - Regenerate sqlc code.
   - Verify migration apply/status/rollback/re-apply against local test DB.
6. Green: API service/repository/handler
   - Add repository interface method such as `DeleteAccount(ctx, userID, now)` that executes the all-or-nothing DB transaction.
   - Add `Service.DeleteAccount(ctx, authContext)` that validates auth context and delegates transaction policy to repository.
   - Add `DeleteMe` handler using existing `requireAuth` and common error mapping.
   - Map deleted/missing active user to `UNAUTHORIZED`.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
7. Red: mobile auth helper tests
   - Add failing tests for `deleteAccountWithRefresh`: generated `deleteMe` call, bearer configuration, one refresh retry on 401, success local/provider/API auth cleanup, retryable failure retaining local session, and auth failure behavior matching existing auth patterns.
   - Verify: `pnpm --filter @i-um/mobile test` fails until helper exists.
8. Red: mobile delete flow/confirmation tests
   - Add failing tests for duplicate-tap/coalesce, explicit confirm before API call, cancel no-op, success navigation replace `/login`, and error state mapping.
   - Verify: `pnpm --filter @i-um/mobile test` fails until flow/helper exists.
9. Green: mobile helper and account UI
   - Implement generated-client `deleteAccountWithRefresh` and local cleanup behavior.
   - Add deletion flow helper if needed to keep `account.tsx` small.
   - Add account screen danger section and confirmation UI using theme tokens.
   - Preserve existing display-name edit, provider linking, logout, and back behavior.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
10. Refactor: privacy and duplication cleanup
    - Extract repeated local auth cleanup code from logout/delete only if it reduces duplication without broad refactor.
    - Ensure logs/errors do not include tokens, provider subjects, or email.
    - Ensure no raw design values were introduced.
    - Verify targeted API/mobile tests still pass.
11. Regression gate
    - Run generated, API, mobile, DB migration, and full verification gates.
    - Update this spec's Verification Record or completion report with pass/fail results and manual smoke status.
12. Manual smoke
    - Use local dev auth or staging/internal build to delete an account, confirm login reset, confirm same provider creates a new user, and confirm solo trip removal/shared-trip anonymization/owner transfer where test data allows.

## Verification Record

### Automated Regression

- `pnpm generate`: pass
- `pnpm verify:generated`: pass
- `pnpm --filter @i-um/api test`: pass
- `cd apps/api && go test -count=1 ./internal/storage`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass
- DB migration apply/status/rollback/re-apply: pass (`pnpm db:migrate`, `pnpm db:status`, `pnpm db:rollback`, `pnpm db:migrate`)

### Manual Smoke

- Account deletion device/simulator smoke: not run; pending manual device/staging verification
- Staging/internal build smoke: not run; pending deploy/internal build verification

## Verification Plan

### Automated Regression

```text
pnpm generate
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

DB 포함 검증:

```text
pnpm db:up
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
```

If the local script names differ in the implementation worktree, use the existing project DB migration scripts and record the exact commands/results.

### Manual Smoke

- [ ] Log in with local dev OAuth or real Apple/Kakao provider in an approved staging/internal environment.
- [ ] Open `마이페이지` → `계정 관리`.
- [ ] Tap `계정 삭제` and confirm the warning copy is shown.
- [ ] Tap `취소` and confirm no account deletion API call is made and the user remains logged in.
- [ ] Tap `계정 삭제` again, confirm with `삭제하기`, and wait for completion.
- [ ] Confirm the app navigates to `/login` and back navigation cannot show authenticated account/mypage screens.
- [ ] Restart the app and confirm the deleted account session is not restored.
- [ ] Try the old access token and refresh token in a controlled test environment and confirm they fail.
- [ ] Log in again with the same provider and confirm a new i-um user id is created.
- [ ] Create a solo trip before deletion and confirm it disappears after deletion/re-login.
- [ ] If shared-trip test data exists, confirm another participant can still open the shared trip and sees the deleted participant as `탈퇴한 사용자`.
- [ ] If deleted user owned a shared trip, confirm Owner transferred to the earliest remaining participant.
- [ ] Confirm an active invite created by the deleted user no longer works or is marked inactive in controlled test data.
- [ ] Confirm public staging/prod does not enable dev OAuth as a substitute for provider/session verification.

## Release Notes

```text
- 계정 화면에서 사용자가 i-um 계정을 삭제할 수 있게 한다.
- 계정 삭제 시 로그인 정보와 프로필 PII를 삭제하고 모든 i-um 세션을 무효화한다.
- 혼자 만든 여행은 삭제하고, 함께 쓰던 여행에는 탈퇴한 사용자로 익명화해 남긴다.
- 삭제 사용자가 공유 여행 Owner였으면 남은 참여자에게 Owner를 자동 이전한다.
```

## Open Questions

- None.

Resolved by Ouroboros interview:

- 계정 삭제는 즉시 최종 처리이며 유예/복구 기간은 없다.
- 현재 i-um 로그인 세션과 명시적 확인으로 삭제를 실행하며 Apple/Kakao 재인증은 MVP 범위 밖이다.
- auth identities/sessions는 hard delete하고, users row는 tombstone으로 보존하되 PII를 제거하고 `deleted_at`을 설정한다.
- solo/effectively solo trip은 hard delete한다.
- shared trip은 유지하고 삭제 사용자를 `탈퇴한 사용자`로 익명화한다.
- 삭제 사용자가 shared trip Owner였으면 가장 먼저 참여한 남은 active participant에게 Owner를 자동 이전한다.
- 삭제 사용자가 만든 active invite는 비활성화한다.
- 모든 서버-side 삭제/익명화 작업은 하나의 DB transaction에서 all-or-nothing으로 처리한다.
- 삭제 성공 후 기존 access/refresh token은 모두 무효화된다.
- 같은 Apple/Kakao provider 재로그인은 새 i-um user를 만든다.

## Follow-up Issues

- TBD: Apple/Kakao provider token revocation or provider re-auth flow if App Store review requires it.
- TBD: Account data export/download before deletion if product/legal requirements expand.
- TBD: Admin/audit tooling for account deletion operations if operational requirements expand.
- TBD: React Native component test harness for destructive confirmation UI if more account-management destructive flows are added.
