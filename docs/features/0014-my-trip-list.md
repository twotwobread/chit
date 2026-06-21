# Feature Slice: F-014 내가 참여 중인 여행 목록

## Metadata

- GitHub Issue: #14
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260621_163901`
- Seed: `seed_c913e865c223`
- PM Document: N/A
- Notes: Ambiguity score `0.08`. Ouroboros clarified F-014 as the smallest shippable My Trips list: authenticated users see a flat list of trips where they are an Owner or Member participant, ordered by `updatedAt` descending. Status grouping, current trip highlighting, role/participant count metadata, and pagination are deferred. After #21 landed on `develop`, the user requested that F-014 rows navigate to the existing trip detail route.

Context clarified before drafting:

- F-013 already owns the authenticated `마이페이지` shell, profile summary, settings section, bottom menu, and `새 여행 만들기` CTA.
- F-014 replaces the placeholder `내 여행` content with a real server-backed trip list.
- F-019 provides the `trips` and `trip_participants` foundations and authenticated trip creation.
- F-014 should use `GET /trips` for the authenticated user's participated trips.
- F-014 returns all matching trips for MVP. Pagination/cursors/max count are not introduced.
- F-014 list rows show only trip name and travel date range in the mobile UI.

## Goal

로그인한 사용자가 마이페이지의 `내 여행` 섹션에서 Owner 또는 Member로 참여 중인 여행 목록을 확인할 수 있다.

F-014는 실제 여행 목록 조회와 표시를 검증하는 최소 vertical slice다. 여행 상태별 구분, 현재 여행 강조, 역할/참여자 수 표시는 후속 feature에서 다룬다. 여행 상세 화면 자체는 #21에서 제공하며, F-014는 목록 row를 기존 상세 route에 연결한다.

## Problem

- F-013의 마이페이지에는 `내 여행` 섹션이 있지만 실제 참여 여행 목록을 보여주지 않는다.
- 여행 생성, 일정, 동행자, 지출, 정산 기능은 사용자가 먼저 자신이 참여 중인 여행을 찾을 수 있어야 자연스럽게 이어진다.
- F-019에서 생성된 `trips`와 `trip_participants` 데이터를 사용자가 앱에서 확인할 수 있는 read path가 필요하다.

## User Flow

1. 사용자가 로그인한 상태로 하단 메뉴의 `마이`를 눌러 마이페이지를 연다.
2. 앱은 기존 F-013 흐름대로 현재 사용자 정보를 확인한다.
3. 앱은 `내 여행` 섹션 안에서 section-local loading 상태를 보여주며 generated API client로 `GET /trips`를 호출한다.
4. 서버는 authenticated user가 `trip_participants`에 Owner 또는 Member로 참여 중인 모든 여행을 조회한다.
5. 참여 여행이 있으면 앱은 `내 여행` 섹션에 여행명과 여행 날짜 범위만 포함한 flat list를 표시한다.
6. 참여 여행이 없으면 앱은 `내 여행` 섹션 안에 empty state와 `새 여행 만들기` CTA를 표시한다.
7. 목록 조회에 실패하면 앱은 프로필/설정 섹션은 유지한 채 `내 여행` 섹션 안에 inline error와 `다시 시도` CTA를 표시한다.
8. session이 없거나 refresh가 실패하면 기존 F-013 login-required/session-clearing 흐름을 따른다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: F-013 마이페이지의 `내 여행` 섹션을 실제 여행 목록으로 교체
- [ ] App UI: 여행 목록 section-local loading/empty/error/success 상태
- [ ] App UI: 여행 row는 여행명과 여행 날짜 범위만 표시하고 기존 상세 route로 이동
- [ ] App UI: 기존 `새 여행 만들기` CTA 유지
- [ ] API Contract: 인증된 `GET /trips` endpoint와 `ListTripsResponse`/`TripListItem` schema
- [ ] API Server: authenticated user 기준 참여 여행 목록 handler/service/repository 구현
- [ ] DB: 새 migration 없음. 기존 `trips`, `trip_participants`를 조회하는 sqlc query 추가
- [ ] Generated Code: OpenAPI 기반 Go server artifact, TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API auth/filtering/order/empty-state test, mobile typecheck, generated artifact consistency check
- [ ] Deployment: staging 또는 internal build에서 authenticated my trips happy path와 empty/error 상태 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 여행 상태별 구분 또는 tab/section 분리 (#15)
- 현재 진행 중인 여행 바로가기나 강조 카드 (#16)
- 여행 카드에 내 역할, 참여자 수, Owner/Member badge 표시 (#17)
- 여행 상세 화면 자체 구현 (#21에서 제공)
- 여행 생성 성공 후 자동으로 마이페이지로 이동하거나 목록을 invalidate/refresh하는 create-flow 변경 (#20)
- 여행 수정/삭제 (#22, #23)
- 초대 수락 후 마이페이지 반영 (#44)
- 참여자 목록 조회 또는 초대 기능 (#40~#43)
- pagination, cursor, page size parameter, pull-to-refresh 고도화
- mock 여행 데이터, fake count, fake role 표시
- `홈`, `마이` 외 navigation 구조 개편

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx` 또는 현재 마이페이지 route
  - 기존 header, profile summary, settings section, bottom menu는 유지한다.
  - `내 여행` 섹션의 placeholder copy를 실제 `GET /trips` 결과 기반 UI로 교체한다.
  - `내 여행` 목록 조회 상태는 section-local로 처리한다. 여행 목록 loading/error가 프로필 요약이나 설정 섹션을 숨기지 않는다.
- `apps/mobile/app/trips/new.tsx` 또는 기존 여행 생성 route
  - F-014에서는 수정하지 않는다.
  - `새 여행 만들기` CTA의 기존 route 연결만 유지한다.

### My Trips Section

- Section title: `내 여행`
- List type: single flat list
- Row fields:
  - 여행 이름
  - 여행 날짜 범위
- Row date format:
  - `YYYY.MM.DD - YYYY.MM.DD`
  - 예: `2026.07.10 - 2026.07.13`
- Row action:
  - row를 누르면 기존 #21 상세 route인 `/trips/{tripId}`로 이동한다.
  - row에는 별도 상세 진입 copy나 추가 metadata를 표시하지 않는다.
- Create CTA:
  - 기존 `새 여행 만들기` CTA를 유지한다.
  - 목록이 비어 있으면 empty state 안에 CTA를 표시한다.
  - 목록이 있으면 섹션 하단 또는 header action으로 CTA를 제공할 수 있다. 단, 목록 row보다 시각적으로 과하게 강조하지 않는다.

### Layout

- 디자인 기준은 `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 기존 F-013 마이페이지 card 패턴을 유지한다.
- 화면 코드에 raw hex color, 임의 spacing/radius 값을 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 새로운 반복 row 스타일이 필요하면 최소 구현 후 반복이 커질 때 `ListRow` 등 primitive로 승격한다.

### States

- Loading:
  - `내 여행` 섹션 안에서만 표시한다.
  - Copy: `여행 목록을 불러오는 중...`
  - 별도 skeleton system을 만들지 않고 기존 token 기반 text/loading placeholder를 사용한다.
- Empty:
  - `내 여행` 섹션 title 아래에 표시한다.
  - Empty title: `아직 참여 중인 여행이 없어요.`
  - Helper: `새 여행을 만들고 여정을 이어가요.`
  - CTA: `새 여행 만들기`
  - fake/sample trip은 표시하지 않는다.
- Error:
  - `내 여행` 섹션 안에서만 inline error를 표시한다.
  - Copy: `여행 목록을 불러올 수 없어요. 다시 시도해주세요.`
  - Retry CTA: `다시 시도`
  - 프로필 요약과 설정 섹션은 계속 표시한다.
- Login required:
  - session이 없거나 refresh token이 invalid/revoked이면 기존 F-013 login-required state를 사용한다.
  - 저장된 session을 정리하고 `로그인하기` CTA를 제공한다.
- Success:
  - 참여 중인 여행을 정렬 순서대로 표시한다.
  - 각 row는 여행 이름과 여행 날짜 범위만 표시한다.

### Copy / Labels

- Section title: `내 여행`
- Loading: `여행 목록을 불러오는 중...`
- Empty title: `아직 참여 중인 여행이 없어요.`
- Empty helper: `새 여행을 만들고 여정을 이어가요.`
- Create trip CTA: `새 여행 만들기`
- Error: `여행 목록을 불러올 수 없어요. 다시 시도해주세요.`
- Retry CTA: `다시 시도`

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

### Request

No request body.

F-014에서는 query parameter를 받지 않는다.

- No `limit`
- No `cursor`
- No `status`
- No `role`
- No `includeParticipants`

### Response

HTTP status: `200`

```json
{
  "trips": [
    {
      "id": "trip_123",
      "name": "오사카 3박 4일",
      "startDate": "2026-07-10",
      "endDate": "2026-07-13",
      "defaultCurrency": "JPY",
      "createdAt": "2026-06-21T15:00:00Z",
      "updatedAt": "2026-06-21T15:00:00Z"
    }
  ]
}
```

Empty response:

```json
{
  "trips": []
}
```

Schema notes:

- `trips`: all trips where the authenticated user has a `trip_participants` row with role `owner` or `member`
- `id`: string trip id
- `name`: trip name
- `startDate`: string, format `date`, `YYYY-MM-DD`
- `endDate`: string, format `date`, `YYYY-MM-DD`
- `defaultCurrency`: enum `KRW | JPY | USD | EUR`
- `createdAt`: ISO 8601 timestamp
- `updatedAt`: ISO 8601 timestamp
- Response order: `updatedAt DESC`, then `createdAt DESC`, then `id DESC` as deterministic tie breaker
- F-014 returns all matching trips without pagination or fixed maximum count

### Errors

공통 에러 포맷을 따른다.

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

## DB Changes

No DB schema changes expected.

F-014 uses the existing tables from F-019:

### Tables

- `trips`: 여행 기본 정보
- `trip_participants`: user가 어떤 여행에 어떤 role로 참여하는지 나타내는 membership

### Query

Add a sqlc query equivalent to:

```sql
SELECT
  t.id::text,
  t.name,
  t.start_date,
  t.end_date,
  t.default_currency,
  t.created_at,
  t.updated_at
FROM trips t
JOIN trip_participants tp ON tp.trip_id = t.id
WHERE tp.user_id = $1::uuid
  AND tp.role IN ('owner', 'member')
ORDER BY t.updated_at DESC, t.created_at DESC, t.id DESC;
```

### Constraints / Indexes

Expected existing constraints/indexes from F-019:

- `trip_participants_trip_user_unique`: prevents duplicate membership for the same trip/user
- `trip_participants_user_id_idx`: supports my trip list lookup by authenticated user
- `trip_participants_trip_id_idx`: supports trip participant joins
- `trips_date_range_check`: preserves valid trip date range
- `trips_default_currency_check`: preserves supported currency values

If an implementation branch does not include the F-019 migration/indexes, F-014 should be based on a branch where F-019 is already present rather than recreating trip schema in this feature.

### Migration Notes

- No goose migration should be added only for F-014 if F-019 schema is present.
- sqlc generated DB code must be updated after adding the list query.
- The list query should not load participants, counts, roles, itinerary, expenses, or settlements.

## Business Rules

- `GET /trips` is authenticated.
- The authenticated user id comes from the access token/session, not from request query/body.
- A trip is visible if and only if the authenticated user has a `trip_participants` row for that trip with role `owner` or `member`.
- Trips where the user is not a participant must never be returned.
- F-014 does not distinguish Owner and Member in the mobile UI.
- F-014 does not return participant count or role metadata for display.
- F-014 does not group trips by upcoming/ongoing/past status.
- F-014 does not compute a current trip.
- F-014 returns all matching trips for MVP and does not support pagination.
- Sorting is deterministic: `updatedAt DESC`, then `createdAt DESC`, then `id DESC`.
- The mobile app must use the generated TypeScript client, not hand-written duplicate API types.
- A trip-list fetch failure is section-local and must not hide profile/settings sections.
- Authentication failure follows the existing session-clearing/login-required behavior.

## Acceptance Criteria

- [x] `packages/api-contract/openapi.yaml` defines authenticated `GET /trips` with `ListTripsResponse` and `TripListItem` schemas.
- [x] `GET /trips` has no request body and no pagination/status/role/include query parameters in F-014.
- [x] Generated Go OpenAPI server artifact and generated TypeScript client include the trip list operation and types.
- [x] API server requires authentication for `GET /trips`.
- [x] Unauthenticated `GET /trips` returns `401 UNAUTHORIZED` with the common error format.
- [x] Authenticated `GET /trips` returns `200` with a `trips` array.
- [x] The response includes only trips where the authenticated user has a `trip_participants` row as `owner` or `member`.
- [x] Trips where the authenticated user is not a participant are not returned by the DB query.
- [x] A user with no participated trips receives `{"trips": []}`.
- [x] Returned trips are ordered by `updatedAt DESC`, then `createdAt DESC`, then `id DESC`.
- [x] Each returned item includes `id`, `name`, `startDate`, `endDate`, `defaultCurrency`, `createdAt`, and `updatedAt`.
- [x] F-014 does not return participant count, role display metadata, status grouping metadata, or current-trip metadata.
- [x] The DB layer uses existing `trips` and `trip_participants` tables without adding a new migration when F-019 schema is present.
- [x] sqlc query/generated DB code support listing trips by authenticated participant user id.
- [x] 마이페이지 `내 여행` 섹션 calls the generated client-backed trip list helper.
- [x] 여행 목록 loading 중에는 `내 여행` 섹션 안에 `여행 목록을 불러오는 중...`이 표시되고 프로필/설정 섹션은 유지된다.
- [x] 참여 여행이 없으면 `내 여행` 섹션 안에 `아직 참여 중인 여행이 없어요.`, `새 여행을 만들고 여정을 이어가요.`, `새 여행 만들기` CTA가 표시된다.
- [x] 참여 여행이 있으면 각 row에 여행 이름과 `YYYY.MM.DD - YYYY.MM.DD` 날짜 범위만 표시된다.
- [x] 여행 row를 누르면 기존 상세 route `/trips/{tripId}`로 이동한다.
- [x] 여행 row에는 Owner/Member role, participant count, status label, current-trip badge, 별도 상세 진입 copy가 표시되지 않는다.
- [x] 목록 조회 실패 시 `내 여행` 섹션 안에 `여행 목록을 불러올 수 없어요. 다시 시도해주세요.`와 `다시 시도` CTA가 표시된다.
- [x] 목록 조회 실패는 프로필 요약과 설정 섹션을 숨기지 않는다.
- [x] session이 없거나 refresh token이 invalid/revoked이면 기존 login-required/session-clearing 흐름으로 전환된다.
- [x] 기존 `새 여행 만들기`, `계정 관리`, `로그아웃`, 하단 `홈`/`마이` 흐름이 깨지지 않는다.
- [x] API tests, generated artifact consistency check, API build, mobile typecheck가 통과한다.
- [ ] staging 또는 internal build에서 authenticated my trips happy path와 empty state를 확인하고 결과를 기록한다.

## Implementation Plan

1. Spec approval 및 worktree 준비
   - 작업: 이 문서의 scope/out of scope를 검토하고 승인 후 `scripts/worktree-create F014 my-trip-list`로 구현 worktree를 만든다.
   - Verify: worktree가 `.worktrees/F014-my-trip-list`에 생성되고 branch가 feature 규칙을 따른다.

2. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`의 `/trips`에 authenticated `get` operation을 추가하고 `ListTripsResponse`, `TripListItem` schemas를 정의한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 `GET /trips` operation/types가 포함된다.

3. DB query 추가
   - 작업: `apps/api/queries/trips.sql`에 authenticated participant user id 기준 trip list sqlc query를 추가한다.
   - Verify: `pnpm --filter @i-um/api generate`가 성공하고 generated DB code에 list query가 포함된다.

4. API trip list service/repository 구현
   - 작업: `trip.Service`에 list method를 추가하고 repository가 `trip_participants.user_id` membership 기준으로 trips를 조회하게 한다.
   - Verify: service/repository tests에서 member/owner 포함, non-participant 제외, empty list, sorting이 통과한다.

5. Server handler와 route wiring
   - 작업: generated OpenAPI interface에 맞춰 `GET /trips` handler를 구현하고 `requireAuth`와 공통 error mapping을 사용한다.
   - Verify: handler/server tests에서 unauthorized `401`, authenticated empty `200`, authenticated populated `200`을 검증한다.

6. Mobile generated client helper 추가
   - 작업: `apps/mobile/lib/trips/client.ts` 또는 동등 위치에 `listMyTrips` helper를 추가하고 existing auth refresh helper와 generated `TripsService`를 사용한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`가 통과하고 hand-written duplicate API type이 없다.

7. My Page `내 여행` 섹션 구현
   - 작업: F-013 마이페이지 shell을 유지하면서 `내 여행` 섹션에 section-local loading/empty/error/success state와 retry를 추가한다.
   - Verify: 프로필/설정이 여행 목록 loading/error 때문에 숨겨지지 않고, row에는 이름/날짜 범위만 표시되며 row tap은 `/trips/{tripId}`로 이동한다.

8. Repository verification 통합
   - 작업: generated drift, Go test/build, mobile typecheck를 모두 통과하도록 정리한다.
   - Verify: `pnpm verify`가 통과한다.

9. Staging/internal smoke verification
   - 작업: staging API 또는 equivalent internal 환경에서 authenticated user로 empty state와 populated list를 확인한다.
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

### Manual

- [ ] local API에서 `AUTH_ALLOW_DEV_OAUTH=true`로 dev OAuth 로그인을 한다.
- [ ] 참여 여행이 없는 사용자로 마이페이지에 진입하면 `내 여행` 섹션 empty state가 표시된다.
- [ ] `새 여행 만들기` CTA를 누르면 기존 여행 생성 화면으로 이동한다.
- [ ] 참여 여행이 있는 사용자로 마이페이지에 진입하면 여행명과 날짜 범위만 표시된 flat list가 보인다.
- [ ] 여러 여행이 있으면 `updatedAt DESC`, `createdAt DESC`, `id DESC` 순서로 표시된다.
- [ ] 다른 사용자가 참여한 여행은 현재 사용자 목록에 표시되지 않는다.
- [ ] API/network 오류 상황에서 `내 여행` 섹션에 inline error와 `다시 시도` CTA가 표시되고 프로필/설정은 유지된다.
- [ ] 저장된 session이 없거나 refresh token이 invalid/revoked이면 로그인 필요 상태로 전환된다.
- [ ] 여행 row에 role, participant count, status label, current-trip badge, 별도 상세 진입 copy가 보이지 않는다.
- [ ] 여행 row를 누르면 기존 여행 상세 화면으로 이동한다.
- [ ] staging 또는 internal build에서 authenticated my trips happy path와 empty state를 확인한다.

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- initial `pnpm generate`: fail before install because `openapi` CLI was unavailable in the fresh worktree; resolved by installing workspace dependencies.
- `pnpm generate`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass.
- `pnpm verify`: pass.
- `pnpm db:up`: fail in this worktree because local port `5432` was already allocated by an existing DB container. The failed F-014 compose container/network/volume were cleaned up with `docker compose down -v`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass against the existing local DB; no migrations to run, current version 3.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; migrations `00001` through `00003` applied.
- Manual mobile runtime check on simulator/emulator/physical device: not run in this environment.
- Staging/internal build verification: not run in this implementation pass.

## Release Notes

```text
- 마이페이지 `내 여행` 섹션에서 로그인한 사용자가 참여 중인 여행 목록을 확인할 수 있게 한다.
- 참여 여행이 없을 때는 `새 여행 만들기`로 이어지는 empty state를 제공한다.
- 여행 row에서 기존 상세 화면으로 이동할 수 있다.
- 여행 상태 구분, 현재 여행 강조, 역할/참여자 수는 후속 기능에서 제공한다.
```

## Open Questions

None for implementation after Ouroboros clarification.

Spec approved for implementation by user request on 2026-06-22.

## Follow-up Issues

- #15: 여행 상태별 구분
- #16: 현재 여행 바로가기
- #17: 여행 내 역할/참여자 수 표시
- #20: 여행 생성 후 마이페이지 반영
- #40: 참여자 목록
- #44: 초대 후 마이페이지 반영
