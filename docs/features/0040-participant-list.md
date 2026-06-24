# Feature Slice: F-040 참여자 목록

## Metadata

- GitHub Issue: #40
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260623_140219`
- Seed: `seed_323628db30f8`
- PM Document: N/A
- Notes: Ambiguity score `0.067`. Ouroboros clarified F-040 as a one-week read-only participant list slice: authenticated trip participants can open a participant list from trip detail and see each current participant's display name and localized role badge. Invite/share/copy actions, invite acceptance, participant removal, role changes, pending invitees, and list mechanics are out of scope.

## Goal

여행 참여자가 여행 상세 화면에서 현재 여행에 참여 중인 사람들과 각자의 역할을 확인할 수 있다.

F-040은 동행자 협업 기능의 첫 번째 읽기 전용 slice다. 기존 여행 상세의 참여자 요약에서 전체 참여자 목록 화면으로 진입하고, API는 현재 accepted/current `trip_participants` 목록만 privacy-minimal 형태로 반환한다.

## Problem

- F-021 여행 상세는 참여자 수와 일부 이름 preview만 보여주기 때문에 전체 동행자와 역할을 확인할 수 없다.
- 협업, 지출, 정산 기능이 늘어날수록 사용자는 이 여행을 함께 보는 사람이 누구인지 먼저 확인할 수 있어야 한다.
- `trip_participants` 데이터는 이미 존재하므로 초대/관리 기능을 만들기 전에 읽기 전용 목록부터 안전하게 노출할 수 있다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}` 여행 상세 화면을 연다.
2. 상세 화면은 기존 `GET /trips/{tripId}` 응답의 참여자 요약을 보여준다.
3. 사용자가 `참여자 모두 보기`를 누른다.
4. 앱은 `/trips/{tripId}/participants` 화면으로 이동한다.
5. 참여자 목록 화면은 generated API client로 `GET /trips/{tripId}/participants`를 호출한다.
6. 서버는 인증, `tripId` 형식, trip 존재 여부, current participant 권한을 확인한다.
7. 접근 가능하면 앱은 owner first, joined order의 참여자 목록을 표시한다.
8. 각 row는 참여자 표시명과 `주최자` 또는 `동행자` badge만 보여준다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 여행 상세 화면의 `참여자 모두 보기` 진입점
- [ ] App UI: `/trips/{tripId}/participants` 읽기 전용 참여자 목록 화면
- [ ] App UI: 참여자 row의 `displayName`과 localized role badge(`주최자`, `동행자`) 표시
- [ ] App UI: 참여자 목록 loading, success, auth/error/retry 상태
- [ ] API Contract: authenticated `GET /trips/{tripId}/participants` endpoint와 privacy-minimal response schema
- [ ] API Server: trip existence check, participant authorization, deterministic participant ordering, common error mapping
- [ ] DB: 기존 `trips`, `trip_participants` table을 조회하는 sqlc query 추가. 새 schema migration은 예상하지 않는다
- [ ] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API auth/validation/not-found/forbidden/happy ordering tests, repository query test, mobile role/list state tests, generated drift/typecheck
- [ ] Deployment: staging 또는 internal build에서 owner-only trip과 owner/member test data의 참여자 목록 happy path 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 초대 링크 card, 초대 링크 생성, 복사, 메시지 공유 (#41)
- 초대 링크 수락, 로그인 handoff, 초대 후 마이페이지 반영 (#42~#44)
- pending invitee 표시 또는 pending invitee count 포함
- 참여자 제거, role 변경, Owner 이전, role management UI (#45)
- 참여자별 profile 편집, 표시명 변경, avatar/image 표시
- 지출/정산용 payer/split participant selector 확장
- realtime participant updates, push notification, in-app notification
- pagination, search, filter, sort option, manual reorder
- response-level aggregate count/meta field. 필요하면 mobile이 `participants.length`로 계산한다
- `userId` 또는 `tripId`를 participant list response body에 노출하는 것
- joinedAt을 모바일 row에 표시하는 것
- full collaboration tab/navigation 구조 개편

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/index.tsx`
  - 기존 참여자 요약 영역에 `참여자 모두 보기` action을 추가한다.
  - 기존 여행 상세 loading/error/success 흐름은 유지한다.
  - action은 `/trips/{tripId}/participants`로 이동한다.
- `apps/mobile/app/trips/[tripId]/participants.tsx`
  - 읽기 전용 참여자 목록 화면을 제공한다.
  - 상단 title은 `참여자`를 사용한다.
  - 뒤로가기 또는 기존 navigation affordance로 여행 상세로 돌아갈 수 있어야 한다.

정확한 파일 구조는 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, route 의미는 `/trips/{tripId}/participants`를 유지한다.

### Participant Row Content

각 row는 MVP에서 다음만 표시한다.

- `displayName`
- role badge
  - `owner` → `주최자`
  - `member` → `동행자`

`joinedAt`은 API contract에는 포함하지만 MVP UI에는 표시하지 않는다.

### States

- Loading: `참여자를 불러오는 중...`을 표시한다.
- Empty: 정상 product state로 취급하지 않는다. 접근 가능한 trip은 최소 Owner participant를 가져야 한다. 방어적 fallback을 구현할 수 있지만 acceptance criterion은 아니다.
- Error:
  - `401 UNAUTHORIZED`: `다시 로그인해주세요.` 안내를 제공한다.
  - `400 VALIDATION_ERROR`: `잘못된 여행 주소예요.` 안내와 safe navigation action을 제공한다.
  - `403 FORBIDDEN` / `404 NOT_FOUND`: 기존 상세 화면과 같은 안전한 문구 `여행을 찾을 수 없어요.`를 보여주고 `홈으로` 또는 뒤로가기 action을 제공한다.
  - network/unknown error: `참여자 목록을 불러올 수 없어요. 잠시 후 다시 시도해주세요.`와 `다시 시도` action을 제공한다.
- Success: 참여자 row list를 owner first order로 표시한다.

### Copy / Labels

- Detail action: `참여자 모두 보기`
- Screen title: `참여자`
- Loading: `참여자를 불러오는 중...`
- Owner role badge: `주최자`
- Member role badge: `동행자`
- Invalid trip: `잘못된 여행 주소예요.`
- Not found/forbidden title: `여행을 찾을 수 없어요.`
- Not found/forbidden helper: `삭제되었거나 접근할 수 없는 여행이에요.`
- Generic error: `참여자 목록을 불러올 수 없어요. 잠시 후 다시 시도해주세요.`
- Retry action: `다시 시도`
- Home action: `홈으로`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- role badge/list row 패턴이 다른 화면에서도 필요해지면 공용 primitive로 추출한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips/{tripId}/participants
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

### Path Parameters

```text
tripId: string
```

`tripId`는 서버 내부 id 형식에 맞는 string이다. 현재 DB 구현이 UUID라면 유효하지 않은 UUID 형식은 `400 VALIDATION_ERROR`로 처리한다.

### Request

No request body.

### Response

HTTP status: `200`

```json
{
  "participants": [
    {
      "participantId": "participant_1",
      "displayName": "민수",
      "role": "owner",
      "joinedAt": "2026-06-21T15:00:00Z"
    },
    {
      "participantId": "participant_2",
      "displayName": "지영",
      "role": "member",
      "joinedAt": "2026-06-22T09:00:00Z"
    }
  ]
}
```

### Schema

```yaml
TripParticipantListItem:
  type: object
  required:
    - participantId
    - displayName
    - role
    - joinedAt
  properties:
    participantId:
      type: string
    displayName:
      type: string
    role:
      $ref: '#/components/schemas/TripParticipantRole'
    joinedAt:
      type: string
      format: date-time

ListTripParticipantsResponse:
  type: object
  required:
    - participants
  properties:
    participants:
      type: array
      items:
        $ref: '#/components/schemas/TripParticipantListItem'
```

Schema notes:

- `TripParticipantRole`은 기존 lowercase enum `owner | member`를 그대로 재사용한다.
- Response body는 privacy-minimal display DTO다.
- `userId`와 `tripId`는 response body에 포함하지 않는다.
- `participantId`는 stable row key와 deterministic ordering tie-breaker로 사용한다.
- `joinedAt`은 API ordering/debugging/future use를 위해 반환하지만 MVP 모바일 UI에는 표시하지 않는다.
- `participants`는 accepted/current `trip_participants` rows만 포함한다.
- 별도 `count`, `meta`, pagination cursor를 제공하지 않는다.

### Ordering

Server response order is deterministic:

```text
owner first,
joinedAt ASC,
participantId ASC
```

SQL 기준으로는 기존 `trip_participants` table에서 다음 의미를 유지한다.

```sql
ORDER BY
  CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
  joined_at ASC,
  id ASC;
```

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

Trip does not exist:

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

Authenticated user is not a current participant of the trip:

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

Validation/authorization precedence:

1. Missing/invalid auth token → `401 UNAUTHORIZED`
2. Invalid `tripId` format → `400 VALIDATION_ERROR`
3. Valid `tripId` but trip row does not exist → `404 NOT_FOUND`
4. Trip exists but authenticated user is not a current participant → `403 FORBIDDEN`
5. Current participant → `200 OK`

## DB Changes

No schema migration.

### Tables

- `trips`: trip existence check에 사용한다.
- `trip_participants`: membership authorization과 participant list source로 사용한다.

### Constraints / Indexes

F-019에서 추가된 다음 index/constraint를 재사용한다.

- `trip_participants_trip_user_unique`: 같은 사용자가 같은 여행에 중복 참여하지 않게 한다.
- `trip_participants_trip_id_idx`: participant list 조회와 count/preview 조회에 사용한다.
- `trip_participants_user_id_idx`: current user membership 조회에 사용한다.
- `trip_participants_role_check`: role을 `owner`, `member`로 제한한다.

### Query / sqlc Notes

새 sqlc query를 추가한다.

```sql
-- name: ListTripParticipantsByTripID :many
SELECT
  id,
  display_name,
  role,
  joined_at
FROM trip_participants
WHERE trip_id = $1::uuid
ORDER BY
  CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
  joined_at ASC,
  id ASC;
```

구현은 기존 또는 새 query를 통해 다음을 확인한다.

- `tripId` UUID parsing / validation
- trip row existence
- authenticated user의 current participant membership
- participant list 조회

### Migration Notes

- 새 goose migration은 예상하지 않는다.
- sqlc query 추가 후 generated DB code를 갱신한다.
- 기존 migration apply/rollback 경로가 계속 통과해야 한다.

## Business Rules

- `GET /trips/{tripId}/participants`는 인증된 사용자만 호출할 수 있다.
- 서버는 request body나 query parameter에서 user id, role, sort, filter 값을 받지 않는다.
- authenticated user가 해당 trip의 current participant일 때만 목록을 볼 수 있다.
- 현재 accepted/current `trip_participants` rows만 반환한다.
- pending invitee, expired invite, removed participant는 F-040 response에 포함하지 않는다.
- 접근 가능한 trip의 participant list가 0명인 상태는 F-040에서 불가능한 invariant로 본다.
- display name은 `trip_participants.display_name` 스냅샷을 사용한다.
- role enum은 기존 lowercase `owner | member`만 사용한다.
- 모바일은 role을 `owner` → `주최자`, `member` → `동행자`로 변환한다.
- 서버 응답 순서는 owner first, `joined_at ASC`, `id ASC`다.
- F-040은 participant 데이터를 수정하지 않는다.

## Acceptance Criteria

- [x] `docs/features/0040-participant-list.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] 여행 상세 화면의 참여자 요약에서 `참여자 모두 보기`로 `/trips/{tripId}/participants`에 진입할 수 있다.
- [x] `packages/api-contract/openapi.yaml`에 authenticated `GET /trips/{tripId}/participants` endpoint와 request/response/error schema가 정의되어 있다.
- [x] generated Go server artifact와 TypeScript client/type이 participant list endpoint/types를 포함하도록 갱신되어 있다.
- [x] 인증되지 않은 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] 유효하지 않은 `tripId` 형식은 `400 VALIDATION_ERROR`를 반환한다.
- [x] 존재하지 않는 trip은 `404 NOT_FOUND`를 반환한다.
- [x] trip은 존재하지만 authenticated user가 current participant가 아니면 `403 FORBIDDEN`을 반환한다.
- [x] current participant의 valid 요청은 `200`과 `{ participants: [...] }`를 반환한다.
- [x] 각 participant item은 `participantId`, `displayName`, `role`, `joinedAt`만 포함한다.
- [x] participant list response는 `userId`, `tripId`, pending invite, aggregate count/meta를 포함하지 않는다.
- [x] participant list는 owner first, `joinedAt ASC`, `participantId ASC` 순서로 정렬된다.
- [x] participant list 화면은 generated TypeScript client를 사용해 `GET /trips/{tripId}/participants`를 호출한다.
- [x] participant list 화면은 loading 상태에 `참여자를 불러오는 중...`을 표시한다.
- [x] success 상태의 각 row는 `displayName`과 localized role badge만 표시한다.
- [x] 모바일은 `owner`를 `주최자`, `member`를 `동행자`로 표시한다.
- [x] 모바일 row는 `joinedAt`을 표시하지 않는다.
- [x] `403`/`404`에서는 안전한 not-found 문구와 navigation action을 제공한다.
- [x] network/unknown error에서는 retry action을 제공한다.
- [x] F-040 구현은 초대 링크 생성/공유/수락, pending invite 표시, 참여자 제거, role 변경, pagination/search/filter를 포함하지 않는다.
- [x] API tests, repository query tests, mobile tests, generated artifact consistency check, typecheck가 통과한다.
- [ ] staging 또는 internal build에서 participant list happy path와 safe error path를 확인하고 결과를 기록한다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI includes `GET /trips/{tripId}/participants`, minimal response DTO, and generated artifacts have no drift | Contract / Generated | `packages/api-contract/openapi.yaml`, generated Go/TS artifacts | `pnpm verify:generated` |
| Missing auth returns `401` | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Invalid `tripId` returns `400 VALIDATION_ERROR` | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Missing trip returns `404 NOT_FOUND` | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Existing trip with non-participant caller returns `403 FORBIDDEN` | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Current participant receives only `participantId`, `displayName`, `role`, `joinedAt` fields | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Participants are ordered owner first, `joinedAt ASC`, `participantId ASC` | API service/repository | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` |
| Repository query reads existing `trip_participants` without schema migration | DB / Repository | `apps/api/internal/storage/trip_repository_test.go` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` |
| Mobile maps roles to `주최자` / `동행자` and keeps `joinedAt` out of row view model | Mobile logic/state | `apps/mobile/lib/trips/participants.test.mts` | `pnpm --filter @i-um/mobile test` |
| Participant screen uses generated client types and handles loading/success/error states | Mobile typecheck / state | `apps/mobile/app/trips/[tripId]/participants.tsx`, `apps/mobile/lib/trips/participants.test.mts` | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Full repo regression gate remains green | CI gate | `pnpm verify` | `pnpm verify` |

## Regression Gaps

- None. Mobile route rendering is covered by TypeScript typecheck, and participant row/error-state behavior is covered by pure helper tests.

## TDD Implementation Plan

Red-Green-Refactor 순서로 작성한다. 구현 계획보다 실패 테스트와 회귀 테스트 게이트를 먼저 고정한다.

1. Red: API handler/service tests 작성
   - 작업: `GET /trips/{tripId}/participants`의 `401`, invalid id `400`, missing trip `404`, non-participant `403`, happy path response shape/order test를 추가한다.
   - Verify: `pnpm --filter @i-um/api test`가 endpoint/handler/service 미구현으로 실패한다.
2. Red: Repository ordering test 작성
   - 작업: owner/member 여러 명의 `trip_participants` seed data로 owner first, `joined_at ASC`, `id ASC` order를 검증하는 storage test를 추가한다.
   - Verify: `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test`가 query/repository 미구현으로 실패한다.
3. Red: Mobile participant list helper/state tests 작성
   - 작업: role label mapping, list item view model, joinedAt 미표시, retryable error state를 검증하는 `apps/mobile/lib/trips/participants.test.mts`를 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현으로 실패한다.
4. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `GET /trips/{tripId}/participants`, `TripParticipantListItem`, `ListTripParticipantsResponse`를 추가한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 endpoint/types가 포함된다.
5. DB/sqlc query와 repository 구현
   - 작업: `ListTripParticipantsByTripID` query와 repository method를 추가한다. 새 migration은 추가하지 않는다.
   - Verify: repository ordering test가 통과한다.
6. API service/handler 구현
   - 작업: 인증 context, tripId validation, trip existence, participant authorization, list 조회, common error mapping을 구현한다.
   - Verify: API handler/service tests가 통과한다.
7. Mobile client/helper 구현
   - 작업: generated client를 사용하는 `listTripParticipants(tripId)` helper와 role/view-model helper를 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 통과한다.
8. Mobile UI 구현
   - 작업: 여행 상세의 `참여자 모두 보기` 진입점과 `/trips/{tripId}/participants` screen의 loading/success/error/retry 상태를 구현한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`가 통과하고 Expo dev/internal build에서 route 진입이 가능하다.
9. Refactor and generated drift check
   - 작업: 중복 role badge/list row 스타일이 생기면 기존 디자인 토큰 기반 helper/primitive로만 정리한다. Spec 밖 기능은 추가하지 않는다.
   - Verify: `pnpm verify:generated`, `pnpm --filter @i-um/api test`, `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck`를 재실행한다.
10. Regression gate and smoke
    - 작업: 전체 검증과 staging/internal smoke 결과를 완료 보고에 기록한다.
    - Verify: `pnpm verify` 통과, manual smoke 결과 기록.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm install --frozen-lockfile
pnpm generate
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

DB repository test 또는 migration baseline 확인이 필요한 경우:

```text
pnpm db:up
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
```

새 migration이 추가되지 않는 것이 기본 계획이므로 `db:rollback`은 기존 baseline 검증 목적일 때만 수행한다.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Owner 계정으로 여행 상세 화면에 진입하면 참여자 요약 영역에서 `참여자 모두 보기` action이 보인다.
- [ ] `참여자 모두 보기`를 누르면 `/trips/{tripId}/participants` 화면으로 이동한다.
- [ ] Owner-only trip은 `주최자` badge가 있는 Owner 1명 row를 보여준다.
- [ ] Owner + Member test data에서는 Owner가 먼저 보이고 Member가 joined order로 보인다.
- [ ] Member 계정으로 같은 여행에 접근해도 참여자 목록을 볼 수 있다.
- [ ] Non-participant 또는 stale/deleted trip 접근은 안전한 not-found/error state를 보여준다.
- [ ] 초대 링크 생성/복사/공유, 참여자 제거, role 변경 UI가 표시되지 않는다.
- [ ] staging 또는 internal build에서 happy path와 safe error path를 확인한다.

## Release Notes

```text
- 여행 상세에서 전체 참여자 목록을 열고 각 참여자의 역할을 확인할 수 있게 한다.
- 참여자 목록은 읽기 전용이며 초대/관리 기능은 후속 기능에서 제공한다.
```

## Open Questions

- None. F-040은 읽기 전용 participant list로 scope를 고정한다.

## Follow-up Issues

- #41: 초대 링크 생성
- #42: 초대 링크 수락
- #43: 초대 링크 로그인 handoff
- #44: 초대 후 마이페이지 반영
- #45: 참여자 제거
- #46: 공동 일정 편집 반영
