# Feature Slice: F-019 여행 생성

## Metadata

- GitHub Issue: #19
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-21
- Updated: 2026-06-21

## Ouroboros Source

- Interview Session: `interview_20260621_145014`
- Seed: `seed_1c2628195a0e`
- PM Document: N/A
- Notes: Ambiguity score `0.088`. Scope was clarified as the minimum create-trip slice: authenticated user creates a `Trip`, the server creates the Owner `TripParticipant`, and the mobile create screen shows an in-screen success state. Created-trip list reflection, trip detail navigation, and trip-day generation are deferred to #20, #21, and #24.

## Goal

사용자가 로그인된 상태에서 여행 이름, 시작일, 종료일, 기본 통화를 입력해 새 여행을 생성할 수 있다.

F-019는 여행 생성 자체를 검증하는 최소 vertical slice다. 생성된 여행을 목록에 표시하거나 상세 화면으로 이동하거나 Day 구조를 생성하는 동작은 후속 feature에서 다룬다.

## Problem

- MVP의 일정, 동행자, 지출, 정산 기능은 모두 여행이라는 상위 맥락이 먼저 있어야 한다.
- 현재 인증된 사용자가 소유한 여행을 생성하는 API/DB/UI 흐름이 없다.
- 이후 여행 목록, 여행 상세, Day별 일정 생성 feature가 안전하게 이어지려면 `trips`와 Owner `trip_participants` 생성 규칙을 먼저 고정해야 한다.

## User Flow

1. 사용자가 로그인 후 홈 또는 현재 진입점에서 `새 여행 만들기`를 누른다.
2. 앱이 여행 생성 화면을 연다.
3. 사용자가 여행 이름, 시작일, 종료일, 기본 통화를 입력한다.
4. 사용자가 `여행 만들기`를 누른다.
5. 앱이 generated API client로 `POST /trips`를 호출한다.
6. 서버는 인증된 user를 기준으로 `trips` row와 Owner `trip_participants` row를 같은 transaction에서 생성한다.
7. 생성이 성공하면 앱은 같은 생성 화면 안에서 `여행이 만들어졌어요.` 성공 상태와 생성된 여행 요약을 보여준다.
8. 사용자는 `새 여행 만들기`로 폼을 초기화하거나 `홈으로` 돌아갈 수 있다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 여행 생성 화면, 홈 또는 현재 인증 후 화면의 `새 여행 만들기` 진입점, loading/error/success 상태
- [ ] API Contract: 인증된 `POST /trips` endpoint, request/response/error schema
- [ ] API Server: trip handler/service/repository, 인증 user 기반 생성, validation, transaction 처리
- [ ] DB: `trips`, `trip_participants` migration, constraint/index, sqlc query
- [ ] Generated Code: OpenAPI 기반 Go server artifact, TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API validation/service/handler test, DB migration/sqlc compile check, mobile typecheck
- [ ] Deployment: staging API migration/deploy와 internal build 또는 equivalent smoke verification

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 생성된 여행을 마이페이지/내 여행 목록에 표시하는 동작 (#20)
- 여행 상세 기본 화면으로 이동하거나 상세 화면을 구현하는 동작 (#21)
- 여행 기간에 맞춰 Day 1, Day 2 구조를 생성하는 동작 (#24)
- 여행 수정/삭제 (#22, #23)
- 동행자 초대, 초대 수락, 참여자 목록 (#40~#43)
- 여행별 참여자 표시명 입력 또는 수정
- 일정 장소 추가, 장소 검색, Google Maps 연결
- 지출/정산 기능
- 오프라인 생성 queue 또는 optimistic create

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx` 또는 현재 인증 후 홈 화면: `새 여행 만들기` 진입점을 제공한다.
- `apps/mobile/app/trips/new.tsx` 또는 동등한 Expo Router 경로: 여행 생성 폼과 성공 상태를 제공한다.

정확한 route 파일명은 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, 사용자 흐름과 상태는 유지한다.

### Form Fields

- 여행 이름
  - Label: `여행 이름`
  - Placeholder: `예: 오사카 3박 4일`
- 시작일
  - Label: `시작일`
  - `react-native-calendars` 기반 월간 캘린더 선택
  - 커스텀 헤더에서 년도와 월을 각각 선택할 수 있다.
  - 오늘 이전 날짜는 선택할 수 없다.
- 종료일
  - Label: `종료일`
  - `react-native-calendars` 기반 월간 캘린더 선택
  - 커스텀 헤더에서 년도와 월을 각각 선택할 수 있다.
  - 오늘 이전 날짜는 선택할 수 없다.
  - 시작일이 선택된 경우 시작일 이전 날짜도 선택할 수 없다.
- 기본 통화
  - Label: `기본 통화`
  - Options: `KRW`, `JPY`, `USD`, `EUR`

F-019 날짜 입력은 직접 텍스트 입력이 아니라 앱 내 월간 캘린더 기반 선택으로 제공한다. 캘린더에서는 오늘 이전 날짜를 disabled 처리한다. 월 이동은 이전/다음 버튼과 년/월 선택 헤더를 함께 제공한다.

### States

- Loading: 생성 요청 중 `여행 만드는 중...`을 표시하고 submit button을 중복 입력할 수 없게 한다.
- Empty: 별도 empty state는 필요 없다. 초기 상태는 빈 폼이다.
- Error: validation 또는 API 오류 시 화면 안에 오류 문구를 표시하고 사용자가 수정 후 다시 제출할 수 있게 한다.
- Success: 생성 성공 시 같은 화면 안에서 성공 상태로 전환한다.

### Copy / Labels

- Screen title: `새 여행 만들기`
- Screen subtitle: `이름과 기간만 정하면 바로 시작할 수 있어요.`
- Submit: `여행 만들기`
- Submitting: `여행 만드는 중...`
- Success title: `여행이 만들어졌어요.`
- Reset action: `새 여행 만들기`
- Home action: `홈으로`
- Generic error: `여행을 만들 수 없어요. 입력 내용을 확인하고 다시 시도해주세요.`
- Name validation: `여행 이름을 입력해주세요.`
- Date format validation: `날짜는 YYYY-MM-DD 형식으로 입력해주세요.`
- Date range validation: `종료일은 시작일보다 빠를 수 없어요.`
- Past date validation: `오늘 또는 이후 날짜를 선택해주세요.`
- Calendar helper: `오늘 이전 날짜는 선택할 수 없어요.`
- Calendar header controls: `<YYYY>년`, `<M>월`, `이전`, `다음`
- Currency validation: `지원하는 통화를 선택해주세요.`

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
POST /trips
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

### Request

HTTP status: request body required

```json
{
  "name": "오사카 3박 4일",
  "startDate": "2026-07-10",
  "endDate": "2026-07-13",
  "defaultCurrency": "JPY"
}
```

Schema notes:

- `name`: string, server trims leading/trailing whitespace, 1..80 chars after trim
- `startDate`: string, format `date`, `YYYY-MM-DD`, today or later
- `endDate`: string, format `date`, `YYYY-MM-DD`, today or later and not before `startDate`
- `defaultCurrency`: enum `KRW | JPY | USD | EUR`

### Response

HTTP status: `201`

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
  "ownerParticipant": {
    "id": "participant_123",
    "tripId": "trip_123",
    "userId": "user_123",
    "role": "owner",
    "displayName": "민수",
    "joinedAt": "2026-06-21T15:00:00Z"
  }
}
```

### Errors

공통 에러 포맷을 따른다.

Validation error:

HTTP status: `400`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid trip request",
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

### Tables

#### `trips`

하나의 여행 단위다.

예상 schema:

```sql
CREATE TABLE trips (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  default_currency text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trips_name_length_check CHECK (char_length(name) BETWEEN 1 AND 80),
  CONSTRAINT trips_date_range_check CHECK (start_date <= end_date),
  CONSTRAINT trips_default_currency_check CHECK (default_currency IN ('KRW', 'JPY', 'USD', 'EUR'))
);
```

#### `trip_participants`

여행에 참여한 사용자다. F-019에서는 여행 생성자를 Owner participant로 자동 생성한다.

예상 schema:

```sql
CREATE TABLE trip_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id uuid NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role text NOT NULL,
  display_name text NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT trip_participants_role_check CHECK (role IN ('owner', 'member')),
  CONSTRAINT trip_participants_display_name_check CHECK (char_length(display_name) BETWEEN 1 AND 80),
  CONSTRAINT trip_participants_trip_user_unique UNIQUE (trip_id, user_id)
);
```

### Constraints / Indexes

- `trips.created_by`: authenticated creator user reference
- `trips(start_date, end_date)`: optional only if needed later; F-019 does not require date query optimization
- `trips_created_by_idx`: owner-created trip lookup 보조용
- `trip_participants(trip_id, user_id)` unique: 같은 사용자가 같은 여행에 중복 참여하지 않게 한다
- `trip_participants_user_id_idx`: 내가 참여 중인 여행 목록 (#14/#20)에서 사용할 수 있게 준비한다
- `trip_participants_trip_id_idx`: 참여자 목록 (#40)에서 사용할 수 있게 준비한다

### Migration Notes

- migration은 `apps/api/migrations`에 goose migration으로 추가한다.
- `users` table은 F-005 auth foundation에서 이미 존재한다고 전제한다.
- `trips`와 `trip_participants`는 같은 migration에서 생성한다.
- rollback은 `trip_participants`, `trips` 순서로 drop한다.
- sqlc query는 최소한 `CreateTrip`, `CreateTripParticipant`, 필요 시 response 조회용 query를 포함한다.
- Trip 생성과 Owner participant 생성은 service transaction 안에서 atomic하게 처리한다.
- F-019 migration은 `trip_days`를 만들거나 데이터를 생성하지 않는다.

## Business Rules

- `POST /trips`는 인증된 사용자만 호출할 수 있다.
- `created_by`는 request body에서 받지 않고 access token의 current user id를 사용한다.
- 서버는 `name`을 trim한 뒤 저장한다.
- trim 후 `name`은 1자 이상 80자 이하여야 한다.
- `startDate`와 `endDate`는 `YYYY-MM-DD` date여야 한다.
- `startDate`와 `endDate`는 오늘 이전일 수 없다.
- `startDate`는 `endDate`보다 늦을 수 없다.
- `defaultCurrency`는 `KRW`, `JPY`, `USD`, `EUR` 중 하나여야 한다.
- 여행 생성자는 자동으로 `owner` role의 `trip_participants` row가 된다.
- Owner `trip_participants.display_name`은 생성 시점의 authenticated user `displayName`을 복사한 스냅샷이다.
- F-019 생성 폼에서는 참여자 표시명을 따로 입력받지 않는다.
- 여행별 표시명 수정이나 초대 수락 시 이름 입력은 후속 collaboration/invite feature에서 다룬다.
- Trip row와 Owner participant row는 같은 transaction에서 생성되어야 한다.
- Owner participant 생성에 실패하면 Trip row도 남지 않아야 한다.
- F-019는 생성 성공 후 상세 화면으로 이동하지 않고, 같은 생성 화면 안에서 success state를 보여준다.

## Acceptance Criteria

- [x] `docs/features/0019-create-trip.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] `packages/api-contract/openapi.yaml`에 인증된 `POST /trips` endpoint와 request/response/error schema가 정의되어 있다.
- [x] generated Go server artifact와 TypeScript client/type이 `POST /trips`를 포함하도록 갱신되어 있다.
- [x] DB migration으로 `trips`와 `trip_participants`가 생성된다.
- [x] sqlc query와 generated DB code가 Trip 생성과 Owner participant 생성을 지원한다.
- [x] 인증되지 않은 `POST /trips` 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] 유효한 요청은 `201`과 생성된 `trip`, `ownerParticipant`를 반환한다.
- [x] 생성된 `trips.created_by`는 authenticated user id다.
- [x] 생성된 `trip_participants.role`은 `owner`다.
- [x] 생성된 `trip_participants.display_name`은 생성 시점 authenticated user `displayName` 스냅샷이다.
- [x] name은 trim 후 저장되며 1..80자 범위를 벗어나면 `VALIDATION_ERROR`가 반환된다.
- [x] `startDate > endDate`이면 `VALIDATION_ERROR`가 반환된다.
- [x] `startDate` 또는 `endDate`가 오늘 이전이면 `VALIDATION_ERROR`가 반환된다.
- [x] date가 `YYYY-MM-DD` 형식이 아니면 `VALIDATION_ERROR`가 반환된다.
- [x] `defaultCurrency`가 `KRW`, `JPY`, `USD`, `EUR`가 아니면 `VALIDATION_ERROR`가 반환된다.
- [x] Trip 생성과 Owner participant 생성은 atomic하게 처리된다.
- [x] Expo 앱에 여행 생성 화면과 접근 가능한 `새 여행 만들기` 진입점이 있다.
- [x] 앱은 generated TypeScript client를 사용해 `POST /trips`를 호출한다.
- [x] 앱은 생성 중 loading 상태와 중복 제출 방지를 제공한다.
- [x] 앱은 validation/API error 상태를 사용자 문구로 표시한다.
- [x] 앱은 시작일/종료일을 `react-native-calendars` 기반 캘린더로 선택하게 하며 오늘 이전 날짜를 선택할 수 없게 한다.
- [x] 캘린더 커스텀 헤더에서 년도와 월을 각각 선택할 수 있다.
- [x] 생성 성공 후 같은 화면에 `여행이 만들어졌어요.`와 여행 이름, 기간, 기본 통화 요약이 표시된다.
- [x] 성공 상태에서 `새 여행 만들기`는 폼을 초기화한다.
- [x] 성공 상태에서 `홈으로`는 홈으로 돌아간다.
- [x] F-019 구현은 생성된 여행 목록 반영, 여행 상세 이동, trip-day 생성 behavior를 포함하지 않는다.
- [x] API tests, DB migration verification, mobile typecheck, generated artifact consistency check가 통과한다.
- [ ] staging 또는 internal build에서 authenticated happy path로 여행 생성 성공 상태를 확인하고 결과를 기록한다.

## Implementation Plan

1. Spec approval and worktree 준비
   - 작업: 이 문서의 open questions가 없는지 확인하고 승인 후 `scripts/worktree-create F019 create-trip`로 구현 worktree를 만든다.
   - Verify: worktree가 `.worktrees/F019-create-trip`에 생성되고 branch가 feature 규칙을 따른다.

2. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `POST /trips`, `CreateTripRequest`, `CreateTripResponse`, `Trip`, `TripParticipant`, currency/role enum, error responses를 추가한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 trip endpoint/types가 포함된다.

3. DB migration과 sqlc query 추가
   - 작업: `trips`, `trip_participants` goose migration과 `CreateTrip`, `CreateTripParticipant` query를 추가한다.
   - Verify: local DB에서 `pnpm db:migrate`, `pnpm db:rollback`, 재-`pnpm db:migrate`가 성공하고 `pnpm generate`가 sqlc code를 갱신한다.

4. API trip domain 구현
   - 작업: `apps/api/internal/trip` 또는 기존 구조에 맞는 trip service/repository/handler를 추가하고 auth context 기반으로 Trip + Owner participant를 transaction 생성한다.
   - Verify: API service/handler tests에서 happy path, unauthorized, validation error, atomic failure case가 통과한다.

5. Server route wiring과 error mapping
   - 작업: generated OpenAPI interface에 맞춰 `POST /trips` handler를 등록하고 공통 error format으로 validation/unauthorized/internal error를 반환한다.
   - Verify: local API에서 dev auth token으로 `POST /trips` smoke request가 `201`을 반환하고 invalid request가 예상 status/code를 반환한다.

6. Mobile generated client 연결
   - 작업: Expo 앱에 create-trip API helper를 추가하고 generated TypeScript client/type을 사용해 `POST /trips`를 호출한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`가 통과하고 hand-written duplicate API type이 없다.

7. Mobile create-trip UI 구현
   - 작업: `새 여행 만들기` 진입점, 생성 폼, client-side validation, loading/error/success state, `새 여행 만들기`/`홈으로` action을 구현한다.
   - Verify: 앱에서 valid input으로 성공 상태가 표시되고 invalid input에서는 지정된 문구가 표시된다.

8. Repository verification 통합
   - 작업: root verification이 OpenAPI/sqlc generated drift, Go test/build, mobile typecheck를 모두 통과하도록 정리한다.
   - Verify: `pnpm verify`가 통과한다.

9. Staging/internal smoke verification
   - 작업: staging DB migration 적용, Cloud Run deploy 또는 equivalent staging API 배포, internal build 또는 local device smoke에서 authenticated trip creation을 확인한다.
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
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
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
- `pnpm db:up`: fail in this worktree because local port `5432` was already allocated by an existing `f005-oauth-user-model-design-db-1` container. The failed F-019 compose container/network/volume were cleaned up with `docker compose down -v`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass, applied `00003_create_trips.sql` against the existing local DB.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass, migration version 3 applied.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback`: pass, rolled back `00003_create_trips.sql`.
- rollback 후 `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass, reapplied `00003_create_trips.sql`.
- Local API smoke with `AUTH_ALLOW_DEV_OAUTH=true`: pass. Dev OAuth login succeeded and authenticated `POST /trips` returned `201` with trimmed trip name, Owner participant role, and display name snapshot.
- Mobile runtime check on simulator/emulator/physical device: not run in this environment. TypeScript integration with generated client passed.
- Staging/internal build verification: not run in this implementation pass.

### Manual

- [ ] 로그인된 사용자가 `새 여행 만들기` 진입점을 볼 수 있다.
- [ ] valid name/date/currency 입력 후 `여행 만들기`를 누르면 loading 상태가 표시된다.
- [ ] 생성 성공 후 같은 화면에 `여행이 만들어졌어요.`와 여행 이름, 기간, 기본 통화가 표시된다.
- [ ] `새 여행 만들기`를 누르면 폼이 초기화된다.
- [ ] `홈으로`를 누르면 홈으로 돌아간다.
- [ ] 빈 이름, 과거 날짜, `startDate > endDate`, 미지원 통화가 사용자 문구로 막힌다.
- [ ] 시작일/종료일 선택 시 캘린더가 열리고 오늘 이전 날짜가 disabled되어 선택할 수 없다.
- [ ] 캘린더 헤더에서 년도와 월 드롭다운을 열어 월을 직접 이동할 수 있다.
- [ ] 생성 성공 후 여행 상세 화면으로 자동 이동하지 않는다.
- [ ] 생성 성공 후 여행 목록 반영을 F-019 완료 조건으로 주장하지 않는다.
- [ ] staging 또는 internal build에서 authenticated happy path를 확인한다.

## Release Notes

```text
- 로그인한 사용자가 여행 이름, 기간, 기본 통화를 입력해 새 여행을 만들 수 있는 최소 생성 흐름을 추가한다.
- 여행 생성자는 자동으로 Owner participant가 된다.
- 생성 성공 후 같은 화면에서 여행 생성 완료와 요약을 확인할 수 있다.
- 생성된 여행의 목록 반영, 상세 화면, Day 생성은 후속 feature에서 제공한다.
```

## Open Questions

None for implementation after Ouroboros clarification.

Resolved by Ouroboros interview:

- F-019 범위는 Trip 생성 + Owner participant 생성 + 생성 화면 success state까지로 제한한다.
- 생성된 여행 목록 반영은 #20, 여행 상세 기본 화면은 #21, trip-day generation은 #24로 defer한다.
- `POST /trips`는 인증 필수다.
- `name`은 trim 후 1..80자다.
- `startDate`와 `endDate`는 `YYYY-MM-DD`이며 `startDate <= endDate`여야 한다.
- `defaultCurrency`는 `KRW`, `JPY`, `USD`, `EUR`만 허용한다.
- Owner participant `display_name`은 authenticated user `displayName`의 생성 시점 스냅샷이다.
- 생성 성공 후 모바일은 같은 create-trip screen 안에서 `여행이 만들어졌어요.` 성공 상태와 요약을 표시한다.

## Follow-up Issues

- #20: 여행 생성 후 마이페이지 반영
- #21: 여행 상세 기본 화면
- #24: 여행 기간 기반 Day 생성
- #22: 여행 수정
- #23: 여행 삭제
