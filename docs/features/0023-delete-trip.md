# Feature Slice: F-023 여행 삭제

## Metadata

- GitHub Issue: #23
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260622_053252`
- Seed: `seed_e045e4814d01`
- PM Document: N/A
- Notes: Ambiguity score `0.08`. Ouroboros clarified F-023 as an Owner-only destructive delete slice: `DELETE /trips/{tripId}` hard-deletes the trip for all participants, uses deterministic `401 -> 400 -> 404 -> 403 -> 204` response precedence, removes trip-scoped dependent data atomically, and does not include undo/archive/trash, participant self-leave, notifications, or audit history. User request on 2026-06-22 approved proceeding with implementation under the destructive delete-for-everyone assumption.

## Goal

Owner가 여행 상세 화면에서 여행을 삭제할 수 있고, 삭제된 여행은 모든 참여자의 목록과 상세 진입점에서 더 이상 사용할 수 없다.

F-023은 여행 삭제 자체를 검증하는 최소 vertical slice다. 복구, 보관, 참여자별 나가기, 알림, 감사 로그는 후속 기능에서 다룬다.

## Problem

- F-019~F-022로 여행 생성, 목록, 상세, 수정은 가능하지만 잘못 만든 여행을 제거할 방법이 없다.
- MVP 권한 모델은 Owner에게 여행 삭제 권한을 부여하지만, API 계약과 모바일 확인 흐름이 아직 없다.
- 삭제는 되돌리기 어려운 파괴적 동작이므로 권한, 응답 precedence, dependent data 처리, stale client UX를 구현 전에 고정해야 한다.

## User Flow

1. Owner가 로그인된 상태에서 `/trips/{tripId}` 여행 상세 화면을 연다.
2. 앱은 Owner에게만 `여행 삭제` 액션을 보여준다.
3. Owner가 `여행 삭제`를 누른다.
4. 앱은 삭제가 모든 참여자에게 적용되고 되돌릴 수 없다는 확인 UI를 보여준다.
5. Owner가 확인 UI에서 `삭제하기`를 누른다.
6. 앱은 generated API client로 `DELETE /trips/{tripId}`를 호출한다.
7. 서버는 인증, `tripId` 형식, trip 존재 여부, Owner 권한 순서로 검증한다.
8. Owner 권한이 확인되면 서버는 trip row와 trip-scoped dependent rows를 atomic하게 삭제하고 `204 No Content`를 반환한다.
9. 앱은 삭제 성공 후 `/mypage`로 이동한다.
10. 마이페이지는 기존 focus reload로 `GET /trips`를 다시 호출하고 삭제된 여행을 목록에서 제거한다.
11. 다른 참여자가 stale 목록을 보고 있으면 다음 목록 refresh 때 삭제된 여행이 조용히 사라진다.
12. 다른 참여자가 stale 상세 화면이나 deep link를 열면 기존 safe not-found 상태를 보여주고 마이페이지 또는 홈으로 돌아갈 수 있게 한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 여행 상세 화면의 Owner-only `여행 삭제` 액션
- [ ] App UI: 파괴적 삭제 확인 UI, deleting 상태, delete error 상태, 성공 후 `/mypage` 이동
- [ ] App UI: stale detail/deep link에서 기존 safe not-found 상태 재사용
- [ ] API Contract: 인증된 `DELETE /trips/{tripId}` endpoint, `204/400/401/403/404/500` response contract
- [ ] API Server: delete handler/service/repository, Owner authorization, deterministic error mapping
- [ ] DB: trip hard delete query, current trip-scoped dependent rows cascade/no-orphan 검증, 필요한 경우 migration 보강
- [ ] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type 갱신
- [ ] Tests: API auth/validation/not-found/forbidden/success/retry/no-orphan test, mobile delete flow logic/typecheck, generated consistency
- [ ] Deployment: staging 또는 internal build에서 Owner delete happy path와 stale/non-owner failure path 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- soft delete, archive, trash, undo, restore
- 삭제 이력 화면, 운영 audit table, user-visible deletion history
- 삭제 전 export/download
- Owner가 sole participant일 때만 삭제 가능하도록 제한하는 규칙
- Member의 여행 나가기 또는 participant self-leave
- 참여자 제거, role 변경, Owner 이전, 초대/참여자 관리 (#40~#46)
- 다른 참여자에게 push notification, in-app notification, email/message 알림 발송
- 마이페이지 목록 row에서 바로 삭제하는 shortcut
- bulk delete
- 삭제된 trip을 기준으로 지출/정산 기록을 보존하거나 별도 recovery store에 복사하는 동작
- 관리자 override 삭제
- offline delete queue 또는 optimistic delete

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/index.tsx`
  - 성공 상태에서 Owner에게 `여행 삭제` 액션을 제공한다.
  - F-023 시점에는 F-019 Owner가 `trip.createdBy`와 동일하므로, 앱은 current user id와 `detail.trip.createdBy`를 비교해 action 노출을 결정할 수 있다.
  - 서버의 Owner authorization이 최종 권한 판단이다. 직접 API 호출이나 stale UI는 `DELETE`에서 다시 검증한다.
  - `여행 정보 수정` 액션이 있는 경우 삭제 액션은 더 낮은 우선순위의 destructive action으로 배치한다.
- Delete confirmation UI
  - native `Alert` 또는 project token을 쓰는 modal/sheet 중 현재 앱 구조에 맞는 최소 구현을 사용한다.
  - 확인 UI는 삭제가 모든 참여자에게 적용되고 되돌릴 수 없음을 명확히 알려야 한다.
  - 확인 전에는 API 호출을 시작하지 않는다.
- `apps/mobile/app/mypage.tsx`
  - F-023에서 별도 optimistic update를 요구하지 않는다.
  - 삭제 성공 후 `/mypage`로 이동하면 기존 focus 기반 `GET /trips` reload로 삭제된 여행이 목록에서 사라져야 한다.
- `apps/mobile/app/trips/[tripId]/index.tsx` stale path
  - 삭제된 trip의 stale detail/deep link는 기존 `400/403/404` safe not-found 상태를 재사용한다.

정확한 파일명은 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, route 의미는 `/trips/{tripId}` detail에서 삭제하고 성공 후 `/mypage`로 돌아가는 흐름을 유지한다.

### Confirmation Behavior

- `여행 삭제` 버튼을 누르면 confirmation UI를 연다.
- `취소`는 confirmation UI만 닫고 trip data를 변경하지 않는다.
- `삭제하기`는 `DELETE /trips/{tripId}`를 호출한다.
- 삭제 요청 중에는 중복 제출을 막는다.
- 삭제 성공 후에는 detail screen에 머물지 않고 `/mypage`로 replace 또는 동등한 navigation을 수행한다.
- 삭제 실패 시 detail screen에 머물고 retry 가능하게 한다.

### States

- Success/idle
  - Owner에게 `여행 삭제` action이 보인다.
  - non-owner에게는 delete action이 보이지 않는다. 단, 서버 권한 검증이 최종 보안 경계다.
- Confirmation
  - Title: `여행을 삭제할까요?`
  - Body: `이 여행은 모든 참여자에게서 삭제되고 되돌릴 수 없어요.`
  - Cancel action: `취소`
  - Confirm action: `삭제하기`
- Deleting
  - Copy: `여행을 삭제하는 중...`
  - `삭제하기` 중복 입력을 막는다.
- Delete success
  - `/mypage`로 이동한다.
  - 마이페이지 `내 여행` 목록에서 삭제된 trip이 더 이상 표시되지 않는다.
- Delete auth error
  - `401 UNAUTHORIZED` 또는 invalid refresh token은 기존 재로그인 흐름을 따른다.
  - Copy: `다시 로그인해주세요.`
- Delete forbidden/not-found
  - `403 FORBIDDEN`과 `404 NOT_FOUND`는 같은 safe failure copy를 보여준다.
  - Copy: `여행을 삭제할 수 없어요. 삭제되었거나 접근할 수 없는 여행이에요.`
- Delete validation error
  - malformed `tripId`는 safe not-found 상태 또는 동일한 delete failure copy로 처리한다.
- Delete generic error
  - Copy: `여행을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`
  - Retry 가능해야 한다.
- Stale list
  - 다음 `GET /trips` refresh에서 삭제된 trip이 조용히 사라진다.
- Stale detail/deep link
  - `여행을 찾을 수 없어요.`와 `삭제되었거나 접근할 수 없는 여행이에요.`를 보여주고 마이페이지 또는 홈으로 이동할 수 있게 한다.

### Copy / Labels

- Delete action: `여행 삭제`
- Confirmation title: `여행을 삭제할까요?`
- Confirmation body: `이 여행은 모든 참여자에게서 삭제되고 되돌릴 수 없어요.`
- Confirm delete: `삭제하기`
- Cancel: `취소`
- Deleting: `여행을 삭제하는 중...`
- Auth error: `다시 로그인해주세요.`
- Delete safe failure: `여행을 삭제할 수 없어요. 삭제되었거나 접근할 수 없는 여행이에요.`
- Delete generic error: `여행을 삭제할 수 없어요. 잠시 후 다시 시도해주세요.`
- Stale not found title: `여행을 찾을 수 없어요.`
- Stale not found helper: `삭제되었거나 접근할 수 없는 여행이에요.`
- Retry action: `다시 시도`
- My Page action: `마이페이지로`
- Home action: `홈으로`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- destructive action은 `theme.color.danger`를 사용한다.
- 버튼/card/modal 패턴이 반복되면 기존 앱 패턴을 재사용한다. primitive 추출 자체가 F-023 범위를 키우면 후속으로 분리한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
DELETE /trips/{tripId}
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

F-023 delete entry는 기존 detail endpoint를 함께 사용한다.

```text
GET /trips/{tripId}
```

### Path Parameters

```text
tripId: string
```

`tripId`는 서버 내부 id 형식에 맞는 string이다. 현재 DB 구현이 UUID라면 유효하지 않은 UUID 형식은 `400 VALIDATION_ERROR`로 처리한다.

### Request

No request body.

F-023에서는 delete reason, confirmation token, dry-run flag, cascade flag를 받지 않는다.

### Response

Successful delete:

HTTP status: `204 No Content`

No response body.

A later authenticated retry for the same well-formed, already-deleted `tripId` returns `404 NOT_FOUND`.

### Response Precedence

서버는 여러 실패 조건이 동시에 가능해 보여도 다음 순서를 지킨다.

1. Missing/invalid auth: `401 UNAUTHORIZED`
2. Authenticated request with malformed `tripId`: `400 VALIDATION_ERROR`
3. Well-formed but missing trip: `404 NOT_FOUND`
4. Existing trip where authenticated user is not Owner: `403 FORBIDDEN`
   - Member and non-participant callers both `403`이다.
5. Existing trip where authenticated user is Owner: `204 No Content`

이 precedence는 기존 `GET /trips/{tripId}`의 id validation, not found, forbidden 분리와 맞춘다. 모바일은 `403`과 `404`를 같은 safe failure copy로 표시한다.

### Errors

공통 에러 포맷을 따른다.

Invalid `tripId`:

HTTP status: `400`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid trip id",
    "details": []
  }
}
```

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

Authenticated user is not the trip Owner:

HTTP status: `403`

```json
{
  "error": {
    "code": "FORBIDDEN",
    "message": "forbidden",
    "details": []
  }
}
```

Trip not found:

HTTP status: `404`

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "trip not found",
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

## DB Changes

No DB schema changes are expected on the current F-023 base if only `trips` and `trip_participants` are trip-scoped tables. F-019 already defines `trip_participants.trip_id REFERENCES trips(id) ON DELETE CASCADE`.

If the implementation branch contains additional trip-scoped tables without safe cascade or equivalent transactional delete behavior, F-023 must add or adjust migrations before implementation is considered safe.

### Tables

- `trips`: Owner delete removes the trip row.
- `trip_participants`: rows for the deleted trip are removed by existing `ON DELETE CASCADE`.
- Future or already-present trip-scoped tables must also be deleted with the trip if they exist on the implementation branch:
  - `trip_invites`
  - `trip_days`
  - `trip_places`
  - `itinerary_items`
  - `expenses`
  - `expense_splits`
  - settlement snapshot rows, if any are introduced

Global identity records are preserved:

- `users`
- `auth_identities`
- `auth_sessions`
- provider/global cache tables not scoped to a single trip

### Queries

구현 시 sqlc query 이름은 기존 구조에 맞춰 조정할 수 있지만 다음 동작을 지원해야 한다.

- `GetTripByID`: existing trip 여부를 확인한다.
- `GetTripParticipantRole` 또는 existing `IsTripOwner` repository path: authenticated user가 해당 trip의 `owner` role인지 확인한다.
- `DeleteTripByID`: trip row를 삭제하고 deleted id 또는 affected row count를 반환한다.

Expected delete shape:

```sql
DELETE FROM trips
WHERE id = $1::uuid
RETURNING id::text;
```

권장 구현은 service/repository에서 transaction 또는 race-safe query sequence를 사용해 다음 observable behavior를 보장하는 것이다.

1. malformed id는 DB delete 전에 `VALIDATION_ERROR`다.
2. trip이 없으면 `NOT_FOUND`다.
3. trip이 있지만 caller가 Owner가 아니면 `FORBIDDEN`이고 delete query를 실행하지 않는다.
4. Owner delete는 trip row와 trip-scoped dependent rows를 atomic하게 제거한다.
5. concurrent delete 등으로 final delete affected row가 0이면 `NOT_FOUND`로 매핑한다.

### Constraints / Indexes

F-019/F-022에서 추가된 다음 constraint/index/query path를 재사용한다.

- `trip_participants_trip_user_unique`: user의 trip membership/role 확인에 사용한다.
- `trip_participants_trip_id_idx`, `trip_participants_user_id_idx`: owner check 및 dependent row verification에 사용한다.
- `trip_participants.trip_id ON DELETE CASCADE`: trip 삭제 시 participant rows 제거에 사용한다.

F-023에서는 새 index를 기본적으로 추가하지 않는다. 구현 중 dependent table cascade 보강이나 query plan상 필요가 확인되면 spec을 업데이트한 뒤 migration을 추가한다.

### Migration Notes

- 현재 base에서는 새 migration을 예상하지 않는다.
- 구현 branch에 trip-scoped dependent table이 추가되어 있고 `ON DELETE CASCADE` 또는 명시적 transactional delete가 없으면 migration 또는 delete query 보강이 필요하다.
- sqlc delete query 추가 후 generated DB code를 갱신한다.
- 기존 migration 적용/rollback 경로가 계속 통과해야 한다.

## Business Rules

- `DELETE /trips/{tripId}`는 인증된 사용자만 호출할 수 있다.
- authenticated user가 해당 여행의 `trip_participants.role = 'owner'`일 때만 삭제할 수 있다.
- request body나 query parameter에서 user id, role, cascade 여부를 받지 않는다.
- `tripId` 형식이 유효하지 않으면 `VALIDATION_ERROR`를 반환한다.
- trip row가 없으면 `NOT_FOUND`를 반환한다.
- trip row는 있지만 authenticated user가 Owner가 아니면 `FORBIDDEN`을 반환한다.
- Owner는 Member가 남아 있어도 trip을 삭제할 수 있다.
- 삭제는 모든 참여자에게 적용된다. 삭제된 trip은 어느 참여자의 `GET /trips` 목록에도 나타나지 않는다.
- 삭제는 hard delete다. archive/trash/restore/undo 경로를 만들지 않는다.
- 삭제 성공 response는 `204 No Content`이며 body가 없다.
- 첫 Owner delete 성공 후 같은 `tripId`에 대한 후속 authenticated retry는 `404 NOT_FOUND`다.
- Trip row와 현재 implementation branch의 모든 trip-scoped dependent rows는 atomic하게 삭제되어야 한다.
- 삭제 실패 시 partial deletion이나 orphaned trip-scoped row가 남으면 안 된다.
- `users`, `auth_identities`, `auth_sessions` 등 global identity/auth records는 삭제하지 않는다.
- Push/in-app notification과 audit trail은 F-023 acceptance criteria가 아니다.
- 모바일은 generated TypeScript client를 사용해 delete를 호출한다.
- 모바일은 confirmation 전 API를 호출하지 않는다.
- 모바일은 `403`과 `404`를 같은 safe failure state로 보여준다.
- stale list는 다음 refresh에서 삭제된 trip을 제거한다.
- stale detail/deep link는 existing safe not-found UX를 사용한다.

## Acceptance Criteria

- [x] `docs/features/0023-delete-trip.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] F-023 spec은 product owner가 승인하기 전 `Ready`로 이동하지 않는다.
- [x] Owner는 Member가 남아 있어도 trip을 삭제할 수 있고, 삭제는 모든 참여자에게 적용된다.
- [x] 여행 상세 화면에서 Owner에게 `여행 삭제` 진입점이 표시된다.
- [x] non-owner에게 delete action이 노출되지 않거나, 직접 요청 시 서버에서 안전하게 차단된다.
- [x] `여행 삭제`를 누르면 삭제가 모든 참여자에게 적용되고 되돌릴 수 없다는 confirmation UI가 표시된다.
- [x] confirmation에서 `취소`를 누르면 API 호출 없이 detail 화면에 머문다.
- [x] confirmation에서 `삭제하기`를 누르면 generated client로 `DELETE /trips/{tripId}`를 호출한다.
- [x] 삭제 요청 중에는 `여행을 삭제하는 중...`이 표시되고 중복 제출이 막힌다.
- [x] 삭제 성공 후 앱은 `/mypage`로 이동한다.
- [x] 마이페이지는 focus reload로 삭제된 trip을 `내 여행` 목록에서 제거한다.
- [x] stale detail/deep link는 `여행을 찾을 수 없어요.` safe not-found 상태를 표시한다.
- [x] `packages/api-contract/openapi.yaml`에 인증된 `DELETE /trips/{tripId}` endpoint와 `204/400/401/403/404/500` responses가 정의되어 있다.
- [x] generated Go server artifact와 TypeScript client/type이 `DELETE /trips/{tripId}`를 포함하도록 갱신되어 있다.
- [x] `DELETE /trips/{tripId}`는 request body를 받지 않는다.
- [x] 인증되지 않은 delete 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] 유효하지 않은 `tripId` 형식은 authenticated request에서 `400 VALIDATION_ERROR`를 반환한다.
- [x] 존재하지 않는 well-formed trip은 `404 NOT_FOUND`를 반환한다.
- [x] existing trip에 대해 Member 또는 non-participant가 delete를 시도하면 `403 FORBIDDEN`을 반환하고 데이터가 삭제되지 않는다.
- [x] Owner의 valid delete 요청은 `204 No Content`를 반환하고 response body가 없다.
- [x] Owner delete 성공 후 같은 `tripId`로 다시 authenticated delete를 호출하면 `404 NOT_FOUND`를 반환한다.
- [x] 삭제된 trip은 같은 사용자의 `GET /trips` 목록에 더 이상 포함되지 않는다.
- [x] 삭제된 trip에 대한 `GET /trips/{tripId}`는 `404 NOT_FOUND`를 반환한다.
- [x] 삭제는 trip row와 모든 현재 trip-scoped dependent rows를 atomic하게 제거한다.
- [x] current implementation branch의 trip-scoped tables에 orphaned rows가 남지 않는다.
- [x] global `users`, `auth_identities`, `auth_sessions` records는 삭제되지 않는다.
- [x] F-023 구현은 undo/archive/trash/restore, participant self-leave, notifications, audit trail, bulk delete를 포함하지 않는다.
- [x] API tests, DB/no-orphan checks, mobile tests/typecheck, generated artifact consistency check가 통과한다.
- [ ] staging 또는 internal build에서 Owner delete happy path, non-owner forbidden path, stale detail/list behavior를 확인하고 결과를 기록한다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| `DELETE /trips/{tripId}` contract and generated clients stay in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| Owner valid delete returns `204 No Content` with no body | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` |
| `DELETE` requires authentication before trip id validation | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| authenticated malformed `tripId` returns `400 VALIDATION_ERROR` | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| missing well-formed trip returns `404 NOT_FOUND` | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Member and non-participant callers receive `403 FORBIDDEN` and data is not deleted | API service/repository | `apps/api/internal/trip/service_test.go` and/or integration handler test | `pnpm --filter @i-um/api test` |
| delete retry after prior Owner success returns `404 NOT_FOUND` | API handler/service | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| deleted trip no longer appears in `GET /trips` and `GET /trips/{tripId}` returns `404` | API handler/repository | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| trip-scoped dependent rows are removed and no orphaned rows remain | DB/repository integration | storage/repository integration test or API integration test against local DB | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` |
| delete is atomic: failure before authorization or failed delete leaves trip and dependent rows unchanged | API service/repository | `apps/api/internal/trip/service_test.go` and/or storage tests | `pnpm --filter @i-um/api test` |
| mobile delete flow requires confirmation, blocks duplicate submit, maps `204` to `/mypage`, maps `403/404` to safe failure | Mobile logic/state | `apps/mobile/lib/trips/delete-flow.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| mobile client uses generated `TripsService` for delete | Mobile type/gate | TypeScript compile and generated type references | `pnpm --filter @i-um/mobile typecheck` |
| trip detail route exposes Owner-only delete action and stale deleted detail shows safe not-found state | Mobile state/navigation smoke plus typecheck | component/state tests if router mocking exists; otherwise regression gap/manual smoke | `pnpm --filter @i-um/mobile test` + Manual Smoke |
| existing create/list/detail/update flows are not broken | Full regression | API build/test, mobile test/typecheck, generated drift | `pnpm verify` |

## Regression Gaps

- Native confirmation UI and Expo Router navigation from detail to My Page may not be fully covered unless component/router tests are added during implementation.
  - Risk: delete API and state helpers pass while the actual confirmation or `router.replace('/mypage')` behavior regresses on device.
  - Follow-up: Record staging/internal build smoke result in this feature; add component/router tests if the project introduces a stable React Native render test harness.
- No-orphan coverage only applies to trip-scoped tables present on the implementation branch.
  - Risk: a future trip-scoped table added after F-023 could miss cascade behavior.
  - Follow-up: Every future migration adding trip-scoped data must define delete semantics and add migration/query tests.

## TDD Implementation Plan

1. Red: API delete behavior tests
   - 작업: `DELETE /trips/{tripId}` handler/service tests를 먼저 추가한다. Include: Owner success `204`, auth required, invalid id, not found, member forbidden/no delete, non-participant forbidden/no delete, retry after success returns `404`, no response body.
   - Verify: `pnpm --filter @i-um/api test`가 `DELETE` 미구현으로 실패한다.

2. Red: DB/no-orphan and atomicity tests
   - 작업: current schema의 `trips` + `trip_participants` 기준으로 delete 후 dependent rows가 없어지는지, forbidden/not-found failure에서 rows가 보존되는지 검증하는 repository/integration test를 추가한다.
   - Verify: `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test`가 delete query 미구현으로 실패한다.

3. Red: Mobile delete flow logic tests
   - 작업: confirmation-required state, deleting 중 중복 제출 방지, `204` success navigation intent, `401` auth state, `403/404` safe failure, generic retryable error를 순수 함수/상태 helper test로 작성한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현으로 실패한다.

4. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `DELETE /trips/{tripId}`, `204/400/401/403/404/500` responses를 추가한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 delete trip endpoint가 포함된다.

5. DB/sqlc query 추가
   - 작업: `DeleteTripByID` query를 추가한다. current branch 외 trip-scoped dependent tables가 있으면 cascade migration 또는 explicit transactional delete path를 추가한다.
   - Verify: `pnpm generate`가 sqlc code를 갱신하고 API compile이 query drift 없이 진행된다.

6. API trip delete domain 구현
   - 작업: service에서 auth/id validation, trip existence check, Owner authorization, atomic delete, retry/not-found behavior, no-orphan guarantee를 구현한다.
   - Verify: `pnpm --filter @i-um/api test`의 F-023 service/repository tests가 통과한다.

7. Server route wiring과 error mapping
   - 작업: generated OpenAPI interface에 맞춰 `DELETE /trips/{tripId}` handler를 등록하고 공통 error format으로 `400/401/403/404/500`을 반환한다. Success는 `204` no body로 반환한다.
   - Verify: `pnpm --filter @i-um/api test`와 `pnpm --filter @i-um/api build`가 통과한다.

8. Mobile generated client helper 추가
   - 작업: `apps/mobile/lib/trips/client.ts` 또는 기존 위치에 generated client를 사용하는 `deleteTrip(tripId)` helper를 추가한다.
   - Verify: hand-written duplicate API type 없이 `pnpm --filter @i-um/mobile typecheck`가 통과한다.

9. Mobile detail delete flow 구현
   - 작업: 상세 화면 Owner-only `여행 삭제` entry, confirmation UI, deleting/error states, success `/mypage` navigation을 구현한다. Existing safe not-found state를 stale/deleted detail에 재사용한다.
   - Verify: `pnpm --filter @i-um/mobile test`와 `pnpm --filter @i-um/mobile typecheck`가 통과한다.

10. Repository verification 통합
    - 작업: generated drift, Go test/build, mobile test/typecheck를 모두 통과하도록 정리한다.
    - Verify: `pnpm verify`가 통과한다.

11. Staging/internal smoke verification
    - 작업: staging API 배포 또는 equivalent environment에서 Owner delete happy path, non-owner forbidden path, stale list/detail behavior를 확인한다.
    - Verify: 완료 보고에 staging/internal build 검증 결과, API URL/build link 또는 제한사항을 기록한다.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm install --frozen-lockfile
pnpm generate
pnpm verify:generated
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api build
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

Contract/generated consistency:

```text
pnpm generate
git diff --exit-code -- apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts
```

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- `pnpm generate`: pass.
- Initial Red `pnpm --filter @i-um/api test`: expected fail before implementation because `Service.Delete` and `DELETE /trips/{tripId}` route were missing.
- Initial Red `pnpm --filter @i-um/mobile test`: expected fail before dependency install/helper implementation because the fresh worktree had no installed `tsx` dependency and delete-flow helper was not implemented.
- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test`: pass, including storage integration coverage for trip delete and participant cascade.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.
- `pnpm db:up`: fail in this worktree because local port `5432` was already allocated. The failed F-023 compose container/network/volume were cleaned up with `docker compose down -v`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass against the existing local DB; no migrations to run before rollback, current version 3.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; migrations `00001` through `00003` applied.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback`: pass, rolled back `00003_create_trips.sql`.
- rollback 후 `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass, reapplied `00003_create_trips.sql`.
- Mobile runtime check on simulator/emulator/physical device: not run in this environment. TypeScript integration with generated client and mobile delete-flow regression tests passed.
- Staging/internal build verification: not run in this implementation pass.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Owner 계정으로 여행 상세 화면에 진입하면 `여행 삭제` action이 보인다.
- [ ] non-owner 계정으로 같은 여행 상세 화면에 진입하면 `여행 삭제` action이 보이지 않는다.
- [ ] `여행 삭제`를 누르면 모든 참여자에게서 삭제되고 되돌릴 수 없다는 confirmation UI가 보인다.
- [ ] confirmation에서 `취소`를 누르면 API 호출 없이 detail 화면에 머문다.
- [ ] confirmation에서 `삭제하기`를 누르면 `여행을 삭제하는 중...`이 보이고 중복 제출이 막힌다.
- [ ] 삭제 성공 후 `/mypage`로 이동하고 삭제된 여행이 `내 여행` 목록에 보이지 않는다.
- [ ] 삭제된 여행 deep link 또는 stale detail은 `여행을 찾을 수 없어요.` 상태를 보여준다.
- [ ] Member 또는 non-participant가 직접 API delete를 시도하면 `403`이고 trip은 유지된다.
- [ ] 같은 Owner token으로 삭제 성공 후 같은 `tripId`를 다시 delete하면 `404`다.
- [ ] 참여자 알림, undo/archive/trash, audit history가 표시되지 않는다.
- [ ] staging 또는 internal build에서 Owner delete happy path와 stale/non-owner failure path를 확인한다.

## Release Notes

```text
- 여행 Owner가 여행 상세 화면에서 여행을 영구 삭제할 수 있게 한다.
- 삭제된 여행은 모든 참여자의 내 여행 목록과 상세 진입점에서 더 이상 사용할 수 없다.
- 삭제는 되돌릴 수 없으며, 보관/복구/알림 기능은 후속에서 다룬다.
```

## Open Questions

None for implementation after Ouroboros clarification and user approval to proceed on 2026-06-22.

Resolved by Ouroboros interview:

- Owner delete는 sole participant 조건 없이 허용한다.
- Delete는 모든 참여자에게 적용되는 hard delete다.
- API response precedence는 `401 -> 400 -> 404 -> 403 -> 204`다.
- 첫 Owner delete 성공은 `204`, 이후 retry는 `404`다.
- Trip-scoped dependent data는 atomic하게 삭제하고 global user/auth records는 보존한다.
- Stale lists are refreshed through `GET /trips`; stale details/deep links use safe not-found UX.
- Notifications and operational audit/restore are out of scope.

## Follow-up Issues

- #40~#46: 동행자 초대, 초대 수락, 참여자 목록/관리, 참여자 제거/role 관련 기능
- TBD: Member self-leave / 여행 나가기
- TBD: trip archive/restore or audit history if product later requires recovery/compliance behavior
- TBD: participant notification when destructive trip changes happen
