# Feature Slice: F-020 여행 생성 후 마이페이지 반영

## Metadata

- GitHub Issue: #20
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260621_171939`
- Seed: `seed_b95ed6542445`
- PM Document: N/A
- Notes: Ambiguity score `0.0775`. Ouroboros clarified that F-020 should stay as the minimum slice for reflecting a newly created trip in My Page: My Trips shows all trips where the authenticated user is a participant, refreshes on My Page open/return, places the newly created trip at the top, and opens the existing trip detail screen when tapped. Status sections, current-trip highlighting, role display, participant count, pagination, search, filters, and manual pull-to-refresh are out of scope.

## Goal

사용자가 여행을 생성한 뒤 마이페이지로 돌아오면, 방금 만든 여행이 `내 여행` 목록 상단에 바로 표시되고 해당 여행을 눌러 기존 여행 상세 화면으로 이동할 수 있다.

F-020은 생성된 여행이 사용자에게 다시 보이는 최소 연결 slice다. 실제 목록은 mock이 아니라 인증된 사용자가 Owner 또는 Member로 참여 중인 여행 목록을 API에서 조회한다.

## Problem

- F-019에서 여행 생성은 가능하지만, 생성한 여행이 마이페이지의 `내 여행` 섹션에 실제 목록으로 반영되지 않는다.
- F-013의 마이페이지는 `내 여행` shell과 `새 여행 만들기` CTA만 제공하므로, 사용자가 만든 여행을 다시 찾을 수 있는 경로가 부족하다.
- F-021의 여행 상세 화면은 존재하지만, 마이페이지 목록에서 상세로 진입하는 연결이 없다.

## User Flow

1. 사용자가 로그인된 상태로 `새 여행 만들기` 화면에서 여행을 생성한다.
2. 생성 성공 상태에서 앱은 기존 `여행 상세 보기`와 함께 `마이페이지에서 보기` 액션을 제공한다.
3. 사용자가 `마이페이지에서 보기`를 누르거나 이후 마이페이지를 다시 연다.
4. 마이페이지는 인증된 사용자의 `내 여행` 목록을 자동으로 조회한다.
5. 방금 생성한 여행이 목록 상단에 표시된다.
6. 사용자가 여행 카드를 누른다.
7. 앱은 기존 `/trips/{tripId}` 여행 상세 화면으로 이동한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 마이페이지 `내 여행` 섹션을 실제 API 기반 목록으로 전환
- [ ] App UI: `내 여행` loading/empty/error/success 상태
- [ ] App UI: 여행 생성 성공 상태에서 `마이페이지에서 보기` 액션 추가
- [ ] App UI: 여행 카드 탭 시 기존 `/trips/{tripId}` 상세 화면으로 이동
- [ ] API Contract: 인증된 `GET /trips` 내 여행 목록 endpoint와 response/error schema
- [ ] API Server: authenticated user가 참여 중인 여행 목록 조회 handler/service/repository
- [ ] DB: 기존 `trips`, `trip_participants`를 조회하는 sqlc query 추가. 새 schema migration은 예상하지 않는다
- [ ] Generated Code: OpenAPI 기반 Go server artifact, TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API list 조회/정렬/인증 test, mobile typecheck, generated artifact consistency check
- [ ] Deployment: staging 또는 internal build에서 create trip → mypage list → detail 진입 happy path 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 여행 상태별 섹션 구분: 진행 중/예정/지난 여행 (#15)
- 오늘 날짜 기준 현재 여행 상단 강조 (#16)
- 여행 카드에 내 역할 또는 참여자 수 표시 (#17)
- 여행 목적지, 대표 이미지, 장소 수, 일정 진행률 표시
- pagination, `더보기`, search, filter
- manual pull-to-refresh
- 여행 수정/삭제 (#22, #23)
- 여행 기간 기반 Day 생성 (#24)
- 동행자 초대, 초대 수락, 참여자 목록/관리 (#40~#43)
- 새 여행 생성 직후 상세 화면 자동 이동을 강제하는 동작. 기존 `여행 상세 보기` 액션은 유지한다
- 오프라인 cache, optimistic list insert, background sync

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/new.tsx`
  - 생성 성공 상태에 `마이페이지에서 보기` 액션을 추가한다.
  - 이 액션은 `/mypage`로 이동한다.
  - 기존 `여행 상세 보기`, `새 여행 만들기`, `홈으로` 흐름은 불필요하게 깨지 않는다.
- `apps/mobile/app/mypage.tsx`
  - `내 여행` 섹션을 실제 참여 여행 목록으로 표시한다.
  - 마이페이지가 열리거나 다시 focus될 때 목록을 자동 조회한다.
  - 하단 메뉴의 `마이` selected 상태는 유지한다.
- `apps/mobile/app/trips/[tripId]/index.tsx`
  - F-021의 기존 여행 상세 화면을 재사용한다.

정확한 구현 파일 구조는 기존 Expo Router 구조에 맞춰 조정할 수 있지만, 사용자 흐름과 route 의미는 유지한다.

### My Trips Item Content

각 여행 카드는 최소한 다음 정보만 표시한다.

- 여행 이름: `trip.name`
- 기간: `trip.startDate`와 `trip.endDate`
- 기본 통화: `trip.defaultCurrency`

표시하지 않는다.

- 진행 중/예정/지난 여행 상태
- 현재 여행 badge 또는 강조 UI
- 내 역할 (`Owner`, `Member`)
- 참여자 수 또는 참여자 이름
- 목적지, 이미지, 장소/일정/지출 요약

### States

`내 여행` 섹션은 다음 상태를 명시적으로 처리한다.

- Loading: `내 여행을 불러오는 중...`
- Empty: `아직 여행이 없어요.`와 `새 여행 만들기` CTA를 표시한다.
- Error: `내 여행을 불러올 수 없어요.`와 `다시 시도` CTA를 표시한다.
- Success: 전체 참여 여행 목록을 카드 리스트로 표시한다.

마이페이지의 프로필/설정 섹션은 F-013의 동작을 유지한다. `내 여행` 목록 조회 실패가 계정 관리/로그아웃 진입점을 불필요하게 막지 않도록 구현할 수 있다.

### Copy / Labels

- My trips section title: `내 여행`
- Loading: `내 여행을 불러오는 중...`
- Empty: `아직 여행이 없어요.`
- Empty helper: `새 여행을 만들고 여정을 이어가요.`
- Error: `내 여행을 불러올 수 없어요.`
- Retry CTA: `다시 시도`
- Create trip CTA: `새 여행 만들기`
- Create success mypage action: `마이페이지에서 보기`
- Trip period label: `<startDate> ~ <endDate>`
- Currency label: `기본 통화 <currency>`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 목록 카드는 기존 마이페이지 card 패턴과 맞춘다: warm off-white background, white card, subtle border, 낮은 shadow.
- 반복되는 list row/card 패턴이 커지면 후속으로 reusable primitive 승격을 검토하되, F-020에서는 필요한 최소 구현만 한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

F-019의 `POST /trips`와 같은 path에 list operation을 추가한다.

### Request

No request body.

F-020에서는 query parameter를 제공하지 않는다.

- No pagination
- No limit
- No cursor
- No status filter
- No search

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
      "joinedAt": "2026-06-22T10:00:00Z",
      "createdAt": "2026-06-22T10:00:00Z"
    }
  ]
}
```

Schema notes:

- `trips`: authenticated user가 `trip_participants`로 참여 중인 전체 여행 목록이다.
- `id`: 기존 `/trips/{tripId}` 상세 route로 이동할 때 사용한다.
- `name`, `startDate`, `endDate`, `defaultCurrency`: 마이페이지 카드 표시용 필드다.
- `joinedAt`: authenticated user가 해당 여행에 참여한 시각이며 primary sort key다. 화면에는 표시하지 않는다.
- `createdAt`: deterministic ordering과 필요 시 future UI에 사용 가능한 보조 필드다. F-020 화면에는 표시하지 않는다.
- `role`, `participantCount`, `previewNames`는 F-020 response에 포함하지 않는다.

### Ordering

서버는 다음 순서로 정렬된 목록을 반환한다.

```text
trip_participants.joined_at DESC,
trips.created_at DESC,
trips.id DESC
```

방금 생성한 여행은 Owner participant도 같은 transaction에서 생성되므로, 마이페이지 재조회 시 목록 상단에 표시되어야 한다.

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

No DB schema changes are expected.

### Tables

- `trips`: 여행 이름, 기간, 기본 통화, 생성 시각 조회에 사용한다.
- `trip_participants`: authenticated user의 참여 여행 필터링과 `joined_at` 정렬에 사용한다.

### Queries

구현 시 sqlc query 이름은 기존 구조에 맞춰 조정할 수 있지만 다음 동작을 지원해야 한다.

- `ListTripsForUser`: authenticated user id로 참여 중인 전체 여행 목록을 조회한다.

Expected query shape:

```sql
SELECT
  t.id::text,
  t.name,
  t.start_date,
  t.end_date,
  t.default_currency,
  tp.joined_at,
  t.created_at
FROM trip_participants tp
JOIN trips t ON t.id = tp.trip_id
WHERE tp.user_id = $1::uuid
ORDER BY
  tp.joined_at DESC,
  t.created_at DESC,
  t.id DESC;
```

### Constraints / Indexes

F-019에서 추가된 다음 index/constraint를 재사용한다.

- `trip_participants_trip_user_unique`: 같은 사용자가 같은 여행에 중복 참여하지 않게 한다.
- `trip_participants_user_id_idx`: user 기준 참여 여행 목록 조회에 사용한다.
- `trip_participants_trip_id_idx`: 기존 상세/참여자 조회 흐름에 사용한다.

F-020에서는 새 index를 기본적으로 추가하지 않는다. 구현 중 query plan상 필요가 확인되면 spec을 업데이트한 뒤 migration을 추가한다.

### Migration Notes

- 새 migration은 예상하지 않는다.
- sqlc query 추가 후 generated DB code를 갱신한다.
- 기존 migration 적용/rollback 경로가 계속 통과해야 한다.

## Business Rules

- `GET /trips`는 인증된 사용자만 호출할 수 있다.
- 서버는 request body나 query에서 user id를 받지 않고 access token의 current user id를 사용한다.
- `내 여행`은 `trips.created_by` 기준이 아니라 `trip_participants.user_id` 기준이다.
- Owner와 Member 모두 목록에 포함한다.
- F-020에서는 role을 response/UI에 표시하지 않는다.
- 목록은 전체 참여 여행을 반환하며 pagination, limit, cursor, search, filter를 제공하지 않는다.
- 목록 정렬은 `joined_at DESC`, `created_at DESC`, `id DESC`다.
- 마이페이지는 화면이 열리거나 다시 focus될 때 `내 여행` 목록을 자동 조회한다.
- 여행 생성 성공 후 `마이페이지에서 보기`로 이동하면 새 여행이 목록 상단에 보여야 한다.
- 모바일은 생성 성공 후 local optimistic insert만으로 완료 처리하지 않고, 마이페이지 진입 시 API 재조회 결과를 보여준다.
- 여행 카드를 누르면 기존 `/trips/{tripId}` 상세 화면으로 이동한다.
- `403/404` 상세 접근 실패 처리는 F-021 상세 화면의 기존 안전 실패 상태를 재사용한다.
- Empty state는 인증된 user가 참여 중인 여행이 0개일 때만 표시한다.
- API 오류와 empty state를 혼동하지 않는다.

## Acceptance Criteria

- [x] `docs/features/0020-created-trip-in-mypage.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] F-020은 생성된 여행의 마이페이지 반영 최소 slice로 정의되며 #15~#17 범위를 흡수하지 않는다.
- [x] `packages/api-contract/openapi.yaml`에 인증된 `GET /trips` endpoint와 response/error schema가 정의되어 있다.
- [x] generated Go server artifact와 TypeScript client/type이 `GET /trips`를 포함하도록 갱신되어 있다.
- [x] API는 인증되지 않은 `GET /trips` 요청에 `401 UNAUTHORIZED`를 반환한다.
- [x] API는 authenticated user가 `trip_participants`로 참여 중인 모든 여행을 반환한다.
- [x] Owner와 Member role의 여행이 모두 목록에 포함된다.
- [x] API는 `trips.created_by`가 아니라 `trip_participants.user_id` 기준으로 목록을 조회한다.
- [x] API 응답은 `joined_at DESC`, `created_at DESC`, `id DESC` 순서로 정렬된다.
- [x] F-019로 방금 생성한 여행은 마이페이지 재조회 후 목록 상단에 표시된다.
- [x] API 응답 item은 F-020에 필요한 `id`, `name`, `startDate`, `endDate`, `defaultCurrency`, `joinedAt`, `createdAt`를 포함한다.
- [x] API 응답 item은 role, participant count, participant preview names를 포함하지 않는다.
- [x] 마이페이지 `내 여행` 섹션은 generated TypeScript client를 사용해 `GET /trips`를 호출한다.
- [x] 마이페이지가 열리거나 다시 focus될 때 `내 여행` 목록을 자동 조회한다.
- [x] `내 여행` loading 상태에 `내 여행을 불러오는 중...`이 표시된다.
- [x] 참여 중인 여행이 없으면 `아직 여행이 없어요.`와 `새 여행 만들기` CTA가 표시된다.
- [x] 목록 조회 실패 시 `내 여행을 불러올 수 없어요.`와 `다시 시도` CTA가 표시된다.
- [x] success 상태에서는 전체 참여 여행 목록이 카드 리스트로 표시된다.
- [x] 각 여행 카드는 여행 이름, 기간, 기본 통화만 표시한다.
- [x] 여행 카드를 누르면 기존 `/trips/{tripId}` 상세 화면으로 이동한다.
- [x] 여행 생성 성공 상태에 `마이페이지에서 보기` 액션이 있고 `/mypage`로 이동한다.
- [x] F-020은 pagination, 더보기, search, filter, manual pull-to-refresh를 구현하지 않는다.
- [x] F-020은 상태별 섹션, 현재 여행 강조, 내 역할/참여자 수 표시를 구현하지 않는다.
- [x] API tests, generated artifact consistency check, mobile typecheck가 통과한다.
- [ ] staging 또는 internal build에서 authenticated create-trip → mypage list 상단 표시 → detail 진입 happy path를 확인하고 결과를 기록한다.

## Implementation Plan

1. Spec approval and worktree 준비
   - 작업: 이 문서의 open questions가 없는지 확인하고 승인 후 `scripts/worktree-create F020 created-trip-in-mypage`로 구현 worktree를 만든다.
   - Verify: worktree가 `.worktrees/F020-created-trip-in-mypage`에 생성되고 branch가 feature 규칙을 따른다.

2. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`의 `/trips` path에 authenticated `GET /trips` operation을 추가하고 `ListTripsResponse`, `MyTripListItem` schema와 `401/500` error response를 정의한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 list trips endpoint/types가 포함된다.

3. DB/sqlc query 추가
   - 작업: 기존 `trips`, `trip_participants` table을 join하는 `ListTripsForUser` query를 추가한다. 새 migration은 추가하지 않는다.
   - Verify: `pnpm generate`가 sqlc code를 갱신하고 generated query가 `joined_at DESC`, `created_at DESC`, `id DESC` 정렬을 보존한다.

4. API trip list domain 구현
   - 작업: 기존 trip repository/service/handler 구조에 authenticated user의 참여 여행 목록 조회 흐름을 추가한다.
   - Include: current user id 기반 조회, owner/member 모두 포함, full list 반환, 공통 error format.
   - Verify: API tests에서 unauthorized, empty list, single created owner trip, member trip inclusion, ordering case가 통과한다.

5. Server route wiring과 error mapping
   - 작업: generated OpenAPI interface에 맞춰 `GET /trips` handler를 등록하고 `401/500`을 공통 error response로 반환한다.
   - Verify: local API smoke에서 missing token은 `401`, dev auth token의 신규 계정은 `200 { trips: [] }`, 여행 생성 후 같은 token은 `200` 목록 상단에 생성 여행을 반환한다.

6. Mobile generated client helper 추가
   - 작업: `apps/mobile/lib/trips/client.ts` 또는 기존 위치에 generated client를 사용하는 `listTrips()` helper를 추가한다.
   - Verify: hand-written duplicate API type 없이 `pnpm --filter @i-um/mobile typecheck`가 통과한다.

7. Mypage `내 여행` 섹션 구현
   - 작업: `apps/mobile/app/mypage.tsx`의 `내 여행` 섹션을 실제 API 목록으로 전환하고 loading/empty/error/success 상태를 구현한다.
   - Include: 마이페이지 mount/focus 시 자동 조회, retry action, empty state의 `새 여행 만들기`, card tap의 `/trips/{tripId}` 이동.
   - Verify: 앱에서 마이페이지 진입 시 목록 조회가 실행되고, 여행 카드에 이름/기간/기본 통화만 표시된다.

8. Create-trip success entry 연결
   - 작업: `apps/mobile/app/trips/new.tsx` 생성 성공 상태에 `마이페이지에서 보기` action을 추가한다.
   - Verify: 새 여행 생성 후 `마이페이지에서 보기`를 누르면 `/mypage`로 이동하고 방금 만든 여행이 목록 상단에 표시된다.

9. Repository verification 통합
   - 작업: generated drift, Go test/build, mobile typecheck를 모두 통과하도록 정리한다.
   - Verify: `pnpm verify`가 통과한다.

10. Staging/internal smoke verification
    - 작업: staging API 배포 또는 equivalent environment에서 authenticated create-trip → mypage list → detail view happy path를 확인한다.
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

- `pnpm install --frozen-lockfile`: pass.
- `pnpm generate`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass through `pnpm verify`.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.
- `pnpm db:up`: fail in this worktree because local port `5432` was already allocated. The failed F-020 compose container/network/volume were cleaned up with `docker compose down -v`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass against the existing local DB; no migrations to run, current version 3.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; migrations `00001` through `00003` applied.
- Local API smoke with `AUTH_ALLOW_DEV_OAUTH=true`: pass. Dev OAuth login succeeded, authenticated `POST /trips` created a trip, and authenticated `GET /trips` returned the created trip at the top with `joinedAt` and without `updatedAt`.
- Mobile runtime check on simulator/emulator/physical device: not run in this environment. TypeScript integration with generated client passed.
- Staging/internal build verification: not run in this implementation pass.

### Manual

- [ ] local API에서 `AUTH_ALLOW_DEV_OAUTH=true`로 dev OAuth 로그인을 한다.
- [ ] 신규 또는 여행이 없는 계정으로 마이페이지에 진입하면 `아직 여행이 없어요.`와 `새 여행 만들기`가 보인다.
- [ ] `새 여행 만들기`에서 valid trip을 생성한다.
- [ ] 생성 성공 상태에서 `마이페이지에서 보기`를 누른다.
- [ ] 마이페이지 `내 여행` 목록에 방금 만든 여행이 상단에 표시된다.
- [ ] 여행 카드에는 이름, 기간, 기본 통화만 표시된다.
- [ ] 여행 카드에 상태, 현재 여행 강조, role, participant count가 표시되지 않는다.
- [ ] 여행 카드를 누르면 기존 여행 상세 화면으로 이동한다.
- [ ] API 오류 상황에서 `내 여행을 불러올 수 없어요.`와 `다시 시도`가 보인다.
- [ ] `다시 시도`를 누르면 목록 조회가 다시 실행된다.
- [ ] staging 또는 internal build에서 authenticated happy path를 확인한다.

## Release Notes

```text
- 여행 생성 후 마이페이지의 `내 여행` 목록에서 방금 만든 여행을 바로 확인할 수 있다.
- `내 여행` 목록의 여행 카드를 눌러 기존 여행 상세 화면으로 이동할 수 있다.
- 여행 상태 구분, 현재 여행 강조, 역할/참여자 수 표시는 후속 기능에서 제공한다.
```

## Open Questions

None for implementation after Ouroboros clarification.

Spec approved for implementation by user request on 2026-06-22.

Resolved by Ouroboros interview:

- F-020은 최소 created-trip-to-mypage slice로 유지한다.
- My Trips는 authenticated user가 Owner 또는 Member로 참여 중인 모든 여행을 표시한다.
- 마이페이지 진입/복귀 시 목록을 자동 재조회한다.
- 새로 생성한 여행은 목록 상단에 즉시 표시되어야 한다.
- 정렬은 `joined_at DESC`, `created_at DESC`, `id DESC`다.
- 카드에는 여행 이름, 기간, 기본 통화만 표시한다.
- loading/empty/error/success 상태를 명시한다.
- 전체 목록을 불러오며 pagination/search/filter/pull-to-refresh는 제외한다.

## Follow-up Issues

- #15: 여행 상태별 구분
- #16: 현재 여행 바로가기
- #17: 여행 내 역할/참여자 수 표시
- #21: 여행 상세 기본 화면
- #22: 여행 수정
- #23: 여행 삭제
- #24: 여행 기간 기반 Day 생성
- #40~#43: 동행자 초대, 초대 수락, 참여자 목록/관리
