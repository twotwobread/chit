# Feature Slice: F-021 여행 상세 기본 화면

## Metadata

- GitHub Issue: #21
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260621_162926`
- Seed: `seed_3b8c4d4f4004`
- PM Document: N/A
- Notes: Ambiguity score `0.097`. Scope was clarified as the minimum detail-view slice: add a concrete entry from the F-019 create-trip success state, fetch authenticated trip detail with participant authorization, and show trip name, period, default currency, and a compact participant summary. Mypage/list entry remains #20; trip-day generation remains #24.

## Goal

사용자가 생성한 여행의 상세 기본 화면에서 여행 이름, 기간, 기본 통화, 참여자 요약을 확인할 수 있다.

F-021은 여행 상세 화면의 최소 vertical slice다. 여행 목록에서 진입하는 흐름은 #20에서 다루고, 이번 slice는 F-019 생성 성공 상태의 `여행 상세 보기` 액션과 직접 접근 가능한 `/trips/{tripId}` 상세 route를 제공한다.

## Problem

- 여행 생성 후 사용자가 방금 만든 여행의 기본 정보를 확인할 목적지가 없다.
- 이후 일정, 동행자, 지출, 정산 기능이 모두 여행 상세 맥락 아래에 붙어야 하므로 안정적인 상세 route와 조회 API가 먼저 필요하다.
- 여행 상세는 참여자만 볼 수 있어야 하며, 존재하지 않거나 접근할 수 없는 여행은 안전한 오류 경험을 제공해야 한다.

## User Flow

1. 사용자가 로그인된 상태에서 F-019 여행 생성 화면으로 여행을 만든다.
2. 생성 성공 상태에서 앱이 `여행 상세 보기` 액션을 보여준다.
3. 사용자가 `여행 상세 보기`를 누른다.
4. 앱이 생성 응답의 `trip.id`로 `/trips/{tripId}` route를 연다.
5. 상세 화면은 generated API client로 `GET /trips/{tripId}`를 호출한다.
6. 서버는 인증된 user가 해당 여행의 `trip_participants` row를 가진 참여자인지 확인한다.
7. 접근 가능하면 앱이 여행 이름, 기간, 기본 통화, 참여자 요약을 보여준다.
8. 다른 future flow가 valid `tripId`를 제공하는 경우에도 같은 `/trips/{tripId}` route로 상세 화면을 열 수 있다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: `/trips/{tripId}` 여행 상세 기본 화면, F-019 생성 성공 상태의 `여행 상세 보기` 진입점, loading/error/success 상태
- [ ] API Contract: 인증된 `GET /trips/{tripId}` endpoint, path parameter, response/error schema
- [ ] API Server: trip detail handler/service/repository, participant authorization, not found/forbidden/unauthorized handling
- [ ] DB: 기존 `trips`, `trip_participants` table을 조회하는 sqlc query 추가. 새 table/migration은 예상하지 않는다.
- [ ] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type 갱신
- [ ] Tests: API authorization/detail 조회 test, generated consistency check, mobile typecheck
- [ ] Deployment: staging API와 internal build 또는 equivalent smoke verification에서 생성 후 상세 진입 happy path 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 생성된 여행을 마이페이지/내 여행 목록에 표시하거나 목록 row에서 상세로 진입하는 흐름 (#20)
- 여행 기간에 맞춰 Day 1, Day 2 구조를 생성하는 동작 (#24)
- 여행 수정/삭제 (#22, #23)
- 초대 링크 생성, 초대 수락, 참여자 제거, full 참여자 목록/관리 UI
- 참여자 role badge, `나`, `여행 만든 사람` 등 상세 역할 표시
- 일정 장소, 지도, 오늘 실행 화면, 지출, 정산 기능
- 오프라인 cache, optimistic detail loading, pull-to-refresh
- inaccessible trip의 존재 여부를 사용자에게 자세히 노출하는 UI

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/new.tsx`: 생성 성공 상태에 `여행 상세 보기` secondary 또는 primary action을 추가한다. 이 액션은 생성 응답의 `trip.id`로 `/trips/{tripId}` route를 연다.
- `apps/mobile/app/trips/[tripId]/index.tsx`: 여행 상세 기본 화면을 제공한다.

정확한 파일 구조는 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, route는 future flow가 재사용할 수 있게 `/trips/{tripId}` 의미를 유지한다.

### Detail Content

상세 화면 success state는 최소한 다음 정보를 보여준다.

- 여행 이름: `trip.name`
- 기간: `trip.startDate`와 `trip.endDate`
- 기본 통화: `trip.defaultCurrency`
- 참여자 요약: participant count + compact name preview

권장 표시 예시:

```text
오사카 3박 4일
2026.07.10 ~ 2026.07.13
기본 통화 JPY
참여자 4명 · 민수, 지영, 현우 외 1명
```

### States

- Loading: 상세 조회 중 `여행 정보를 불러오는 중...`을 표시한다.
- Empty: valid trip detail에는 별도 empty state가 필요 없다. 참여자 0명은 정상 데이터로 만들지 않지만, 방어적으로 `참여자 0명`을 표시할 수 있다.
- Error:
  - `401 UNAUTHORIZED`: 로그인 화면으로 이동하거나 `다시 로그인해주세요.` 안내를 제공한다.
  - `403 FORBIDDEN` / `404 NOT_FOUND`: 같은 안전한 문구 `여행을 찾을 수 없어요.`를 보여주고 `홈으로` 또는 뒤로가기 액션을 제공한다.
  - network/unknown error: `여행 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.`와 `다시 시도` 액션을 제공한다.
- Success: 상세 기본 정보를 card 중심으로 보여준다.

### Copy / Labels

- Create success action: `여행 상세 보기`
- Screen title: `여행 상세`
- Loading: `여행 정보를 불러오는 중...`
- Period label: `기간`
- Currency label: `기본 통화`
- Participant label: `참여자`
- Not found/forbidden title: `여행을 찾을 수 없어요.`
- Not found/forbidden helper: `삭제되었거나 접근할 수 없는 여행이에요.`
- Generic error: `여행 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.`
- Retry action: `다시 시도`
- Home action: `홈으로`

### Design Guardrails

- `docs/design/README.md`와 `apps/mobile/lib/design/theme.ts`의 color, spacing, radius, typography token을 사용한다.
- 화면 코드는 raw hex color나 arbitrary spacing/radius 값을 추가하지 않는다.
- 제품 UI에는 emoji를 사용하지 않는다.
- 상세 화면은 warm off-white background, white card, subtle border/shadow의 기존 디자인 방향을 따른다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips/{tripId}
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

### Path Parameters

```text
tripId: string
```

`tripId`는 서버 내부 id 형식에 맞는 string이다. 현재 DB 구현이 UUID라면 유효하지 않은 UUID 형식은 `400 VALIDATION_ERROR`로 처리한다.

### Response

HTTP status: `200`

```json
{
  "trip": {
    "id": "trip_123",
    "name": "오사카 3박 4일",
    "startDate": "2026-07-10",
    "endDate": "2026-07-13",
    "defaultCurrency": "JPY",
    "createdBy": "user_123",
    "createdAt": "2026-06-21T15:00:00Z",
    "updatedAt": "2026-06-21T15:00:00Z"
  },
  "participantSummary": {
    "totalCount": 4,
    "previewNames": ["민수", "지영", "현우"],
    "overflowCount": 1
  }
}
```

Schema notes:

- `trip`: existing `Trip` schema를 재사용한다.
- `participantSummary.totalCount`: 해당 여행의 전체 participant 수다.
- `participantSummary.previewNames`: 화면 preview에 사용할 display name 목록이며 최대 3개다.
- `participantSummary.overflowCount`: `max(totalCount - previewNames.length, 0)`이다.
- mobile은 `totalCount`, `previewNames`, `overflowCount`로 `참여자 4명 · 민수, 지영, 현우 외 1명` 같은 사용자 문구를 만든다.

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

Forbidden when the authenticated user is not a participant:

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

No DB schema changes are expected.

### Tables

- `trips`: 여행 이름, 시작일, 종료일, 기본 통화 조회에 사용한다.
- `trip_participants`: 접근 권한 확인, participant count, participant preview name 조회에 사용한다.

### Queries

구현 시 sqlc query는 기존 구조에 맞춰 이름을 조정할 수 있지만 다음 동작을 지원해야 한다.

- `GetTripByID`: `trips.id`로 trip row를 조회한다.
- `GetTripParticipantMembership`: `trip_id`, `user_id`로 authenticated user가 참여자인지 확인한다.
- `CountTripParticipantsByTripID`: 전체 participant 수를 계산한다.
- `ListTripParticipantPreviewByTripID`: participant preview name 최대 3개를 deterministic order로 조회한다.

Participant preview order:

```sql
ORDER BY
  CASE WHEN role = 'owner' THEN 0 ELSE 1 END,
  joined_at ASC,
  id ASC
LIMIT 3
```

### Constraints / Indexes

F-019에서 추가된 다음 index/constraint를 재사용한다.

- `trip_participants_trip_user_unique`: 같은 사용자가 같은 여행에 중복 참여하지 않게 한다.
- `trip_participants_trip_id_idx`: participant count/preview 조회에 사용한다.
- `trip_participants_user_id_idx`: membership 조회와 future list 조회에 사용한다.

새 index는 F-021에서 기본적으로 추가하지 않는다. 구현 중 query plan상 필요가 확인되면 spec을 업데이트한 뒤 migration을 추가한다.

### Migration Notes

- 새 migration은 예상하지 않는다.
- sqlc query 추가 후 generated DB code를 갱신한다.
- 기존 migration 적용/rollback이 계속 통과해야 한다.

## Business Rules

- `GET /trips/{tripId}`는 인증된 사용자만 호출할 수 있다.
- 서버는 request body에서 user id를 받지 않고 access token의 current user id를 사용한다.
- authenticated user가 해당 여행의 `trip_participants` row를 가지고 있어야 trip detail을 볼 수 있다.
- `tripId` 형식이 유효하지 않으면 `VALIDATION_ERROR`를 반환한다.
- trip row가 없으면 `NOT_FOUND`를 반환한다.
- trip row는 있지만 authenticated user가 participant가 아니면 `FORBIDDEN`을 반환한다.
- mobile UI는 `FORBIDDEN`과 `NOT_FOUND`를 같은 안전한 실패 상태로 보여준다.
- participant summary는 `trip_participants.display_name` 스냅샷을 사용한다. 현재 user profile의 최신 이름으로 다시 계산하지 않는다.
- participant summary ordering은 owner first, 그다음 `joined_at ASC`, 그다음 `id ASC`다.
- 1~3명은 모든 preview display name을 보여준다.
- 4명 이상은 첫 3명 display name과 `외 N명`을 보여준다.
- display name은 trim 후 사용한다. legacy/defensive case로 빈 값이 있으면 `여행자`로 표시한다.
- F-021은 상세 기본 정보를 읽기만 하며 trip, participant, itinerary 데이터를 수정하지 않는다.

## Acceptance Criteria

- [x] `docs/features/0021-trip-detail-basic-screen.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] `packages/api-contract/openapi.yaml`에 인증된 `GET /trips/{tripId}` endpoint와 request/response/error schema가 정의되어 있다.
- [x] generated Go server artifact와 TypeScript client/type이 `GET /trips/{tripId}`를 포함하도록 갱신되어 있다.
- [x] API는 인증되지 않은 `GET /trips/{tripId}` 요청에 `401 UNAUTHORIZED`를 반환한다.
- [x] API는 유효하지 않은 `tripId` 형식에 `400 VALIDATION_ERROR`를 반환한다.
- [x] API는 존재하지 않는 trip에 `404 NOT_FOUND`를 반환한다.
- [x] API는 authenticated user가 participant가 아닌 trip에 `403 FORBIDDEN`을 반환한다.
- [x] API는 authenticated participant의 valid trip 요청에 `200`과 `trip`, `participantSummary`를 반환한다.
- [x] `participantSummary.totalCount`는 해당 여행의 전체 participant 수다.
- [x] `participantSummary.previewNames`는 owner first, `joined_at ASC`, `id ASC` 순서에서 최대 3명이다.
- [x] `participantSummary.overflowCount`는 `totalCount - previewNames.length`이며 음수가 아니다.
- [x] mobile 상세 화면은 generated TypeScript client를 사용해 `GET /trips/{tripId}`를 호출한다.
- [x] F-019 생성 성공 상태에 `여행 상세 보기` 액션이 있고, 생성된 `trip.id`로 `/trips/{tripId}`를 연다.
- [x] `/trips/{tripId}` 상세 화면은 여행 이름, 기간, 기본 통화, 참여자 요약을 보여준다.
- [x] 참여자 1~3명은 이름을 모두 표시하고, 4명 이상은 첫 3명과 `외 N명`을 표시한다.
- [x] 상세 화면은 loading 상태를 표시한다.
- [x] 상세 화면은 `403`과 `404`를 같은 `여행을 찾을 수 없어요.` 실패 상태로 표시한다.
- [x] 상세 화면은 network/unknown error에서 `다시 시도`가 가능하다.
- [x] F-021 구현은 마이페이지/내 여행 목록 entry (#20), trip-day generation (#24), trip edit/delete, invite/participant management를 포함하지 않는다.
- [x] API tests, generated artifact consistency check, mobile typecheck가 통과한다.
- [ ] staging 또는 internal build에서 authenticated create-trip → `여행 상세 보기` → detail 표시 happy path를 확인하고 결과를 기록한다.

## Implementation Plan

1. Spec approval and worktree 준비
   - 작업: 이 문서의 open questions가 없는지 확인하고 승인 후 `scripts/worktree-create F021 trip-detail-basic-screen`로 구현 worktree를 만든다.
   - Verify: worktree가 `.worktrees/F021-trip-detail-basic-screen`에 생성되고 branch가 feature 규칙을 따른다.

2. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `GET /trips/{tripId}`, `GetTripDetailResponse`, `TripParticipantSummary`, `400/401/403/404/500` error responses를 추가한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 trip detail endpoint/types가 포함된다.

3. DB/sqlc query 추가
   - 작업: 기존 `trips`, `trip_participants` table을 사용하는 membership, trip lookup, participant count, participant preview query를 추가한다. 새 migration은 추가하지 않는다.
   - Verify: `pnpm generate`가 sqlc code를 갱신하고 `pnpm --filter @i-um/api test`에서 repository/service query compile이 통과한다.

4. API trip detail domain 구현
   - 작업: 기존 trip service/repository/server 구조에 `GetTripDetail` 흐름을 추가하고 current user participant 권한을 확인한다.
   - Verify: service/handler tests에서 happy path, unauthorized, invalid id, not found, forbidden case가 통과한다.

5. Server route wiring과 error mapping
   - 작업: generated OpenAPI interface에 맞춰 `GET /trips/{tripId}` handler를 등록하고 공통 error format으로 validation/unauthorized/forbidden/not found/internal error를 반환한다.
   - Verify: local API smoke request에서 participant token은 `200`, non-participant token은 `403`, missing trip은 `404`를 반환한다.

6. Mobile generated client helper 추가
   - 작업: `apps/mobile/lib/trips/client.ts` 또는 기존 위치에 generated client를 사용하는 `getTripDetail(tripId)` helper를 추가한다.
   - Verify: hand-written duplicate API type 없이 `pnpm --filter @i-um/mobile typecheck`가 통과한다.

7. Mobile detail screen 구현
   - 작업: `/trips/{tripId}` screen을 추가하고 loading, success, generic 403/404 failure, retryable generic error 상태를 구현한다.
   - Verify: simulator/emulator/local device에서 valid `tripId` direct route가 상세 정보를 표시한다.

8. Create-trip success entry 연결
   - 작업: F-019 생성 성공 상태에 `여행 상세 보기` action을 추가하고 생성된 `trip.id`로 상세 route를 연다.
   - Verify: 앱에서 새 여행 생성 후 `여행 상세 보기`를 누르면 방금 생성한 여행 상세가 표시된다.

9. Repository verification 통합
   - 작업: generated drift, Go test/build, mobile typecheck를 모두 통과하도록 정리한다.
   - Verify: `pnpm verify`가 통과한다.

10. Staging/internal smoke verification
    - 작업: staging API 배포 또는 equivalent environment에서 authenticated create-trip → detail view happy path를 확인한다.
    - Verify: 완료 보고에 staging/internal build 검증 결과, API URL/build link 또는 제한사항을 기록한다.

## Verification Plan

### Automated

```text
pnpm install --frozen-lockfile
pnpm generate
pnpm verify
```

DB 포함 검증:

```text
pnpm db:up
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
```

API 검증:

```text
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api build
```

Contract/generated consistency:

```text
pnpm generate
git diff --exit-code -- apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts
```

Mobile 검증:

```text
pnpm --filter @i-um/mobile typecheck
```

### Verification Results

- `pnpm install --frozen-lockfile`: pass
- `pnpm generate`: pass
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass
- `pnpm db:up`: fail in this worktree because local port `5432` was already allocated. The failed F-021 compose container/network/volume were cleaned up with `docker compose down -v`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass against the existing local DB. Migration version 3 is applied.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass, no migrations to run; current version 3.
- Local API smoke with `AUTH_ALLOW_DEV_OAUTH=true`: pass. Dev OAuth login succeeded, authenticated `POST /trips` created a trip, and authenticated `GET /trips/{tripId}` returned the created trip detail with participant summary.
- Mobile runtime check on simulator/emulator/physical device: not run in this environment. TypeScript integration with generated client passed.
- Staging/internal build verification: not run in this implementation pass.

### Manual

- [ ] 로그인된 사용자가 새 여행을 만든 뒤 성공 상태에서 `여행 상세 보기`를 볼 수 있다.
- [ ] `여행 상세 보기`를 누르면 `/trips/{tripId}` 상세 화면이 열린다.
- [ ] 상세 화면 loading 중 `여행 정보를 불러오는 중...`이 표시된다.
- [ ] valid trip detail에 여행 이름, 기간, 기본 통화, 참여자 요약이 표시된다.
- [ ] 참여자 1명 trip은 `참여자 1명 · 민수`처럼 이름 하나만 표시된다.
- [ ] 참여자 4명 이상 test data에서는 `참여자 4명 · A, B, C 외 1명` 형태로 보인다.
- [ ] 존재하지 않는 `tripId`는 `여행을 찾을 수 없어요.` 상태와 safe navigation action을 보여준다.
- [ ] participant가 아닌 사용자로 접근하면 `여행을 찾을 수 없어요.` 상태와 safe navigation action을 보여준다.
- [ ] network/unknown error에서는 `다시 시도`를 누를 수 있다.
- [ ] F-021 완료 조건으로 마이페이지/내 여행 목록 진입을 주장하지 않는다.
- [ ] staging 또는 internal build에서 authenticated create-trip → detail happy path를 확인한다.

## Release Notes

```text
- 여행 생성 후 `여행 상세 보기`로 방금 만든 여행의 기본 정보를 확인할 수 있다.
- 여행 상세 기본 화면에서 여행 이름, 기간, 기본 통화, 참여자 요약을 보여준다.
- 여행 상세 조회는 여행 참여자만 접근할 수 있다.
```

## Open Questions

None for implementation after Ouroboros clarification. User approved implementation on 2026-06-22.

Resolved by Ouroboros interview:

- F-021은 concrete entry path를 포함한다. F-019 생성 성공 상태에 `여행 상세 보기`를 추가한다.
- F-020 마이페이지/내 여행 목록 entry는 F-021에서 구현하지 않는다.
- 참여자 요약은 count + compact name preview로 제한한다.
- 1~3명은 모든 이름을 표시하고, 4명 이상은 첫 3명과 `외 N명`을 표시한다.
- API는 `401`, `403`, `404`를 구분하지만 mobile은 `403`과 `404`를 같은 안전한 failure state로 보여준다.
- participant ordering은 owner first, `joined_at ASC`, `id ASC`다.
- display name은 `trip_participants.display_name` 스냅샷을 trim해서 사용하고, 빈 값은 방어적으로 `여행자`로 표시한다.

## Follow-up Issues

- #20: 여행 생성 후 마이페이지 반영 / 내 여행 목록에서 상세 진입
- #22: 여행 수정
- #23: 여행 삭제
- #24: 여행 기간 기반 Day 생성
- #40~#43: 동행자 초대, 초대 수락, 참여자 목록/관리
