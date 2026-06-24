# Feature Slice: F-022 여행 수정

## Metadata

- GitHub Issue: #22
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260622_042934`
- Seed: `seed_d663d7d0bd66`
- PM Document: N/A
- Notes: Ambiguity score `0.062`. Scope was clarified as the minimum owner-only trip metadata edit slice: only `name`, `startDate`, `endDate`, and `defaultCurrency` are editable. F-022 uses `PATCH /trips/{tripId}` with changed fields only. Dates may be past/current/future as long as `startDate <= endDate`. Trip-day regeneration, delete/cancel, participants, itinerary, expenses, and settlement effects are deferred.

## Goal

Owner가 여행 상세 화면에서 여행 이름, 시작일, 종료일, 기본 통화를 수정할 수 있다.

F-022는 여행 기본 정보 수정만 검증하는 최소 vertical slice다. 여행 기간 변경에 따른 Day 구조 재생성, 일정/장소 변경, 지출/정산 통화 영향, 삭제는 후속 feature에서 다룬다.

## Problem

- F-019에서 여행 생성은 가능하지만, 생성 후 오타나 날짜/통화 입력 실수를 고칠 수 없다.
- F-021에서 여행 상세 기본 정보는 조회할 수 있지만, Owner가 같은 맥락에서 기본 정보를 수정하는 경로가 없다.
- 이후 일정, 지출, 정산 기능이 붙기 전에 여행 기본 정보 수정 권한과 validation 규칙을 고정해야 한다.

## User Flow

1. Owner가 로그인된 상태에서 `/trips/{tripId}` 여행 상세 화면을 연다.
2. 앱은 Owner에게만 `여행 정보 수정` 액션을 보여준다.
3. Owner가 `여행 정보 수정`을 누른다.
4. 앱이 `/trips/{tripId}/edit` 화면을 열고 `GET /trips/{tripId}`로 현재 여행 정보를 불러온다.
5. 앱은 여행 이름, 시작일, 종료일, 기본 통화를 기존 값으로 채운다.
6. Owner가 하나 이상의 필드를 수정한다.
7. 앱은 client-side validation을 통과하고 변경사항이 있을 때 `저장하기`를 활성화한다.
8. Owner가 `저장하기`를 누른다.
9. 앱은 generated API client로 `PATCH /trips/{tripId}`를 호출하며 변경된 필드만 보낸다.
10. 서버는 인증된 사용자가 해당 여행의 Owner인지 확인하고, 기존 값과 request 값을 merge한 뒤 validation을 수행한다.
11. 성공하면 서버는 수정된 `trip`을 반환한다.
12. 앱은 `/trips/{tripId}` 상세 화면으로 돌아가고, 상세 화면은 수정된 이름/기간/기본 통화를 즉시 보여준다.
13. 사용자가 이후 마이페이지로 돌아가면 기존 focus reload를 통해 목록에도 수정된 값이 표시된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 여행 상세 화면의 `여행 정보 수정` 진입점, `/trips/{tripId}/edit` 수정 화면, prefilled form, loading/error/saving/success navigation 상태
- [ ] API Contract: 인증된 `PATCH /trips/{tripId}` endpoint, partial request schema, response/error schema
- [ ] API Server: trip update handler/service/repository, Owner authorization, partial merge validation, error mapping
- [ ] DB: 기존 `trips`, `trip_participants`를 사용하는 update/owner-check sqlc query. 새 schema migration은 예상하지 않는다
- [ ] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API validation/authorization/update test, mobile form state/payload test, generated consistency, mobile typecheck
- [ ] Deployment: staging 또는 internal build에서 owner edit happy path와 non-owner/invalid failure smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 목적지, 지역, 주소, 대표 이미지, 커버 색상 등 여행 프로필 확장 정보
- 동행자/참여자 추가, 제거, role 변경, 참여자 표시명 수정 (#40~#46)
- 여행별 budget, visibility/privacy, 공유 설정, 알림 설정
- 여행 삭제 (#23)
- 여행 취소, 완료, 보관, status 변경
- 여행 기간 변경에 따른 Day 1, Day 2 구조 생성/삭제/재생성 (#24)
- Day별 일정, 장소, Google Places/Maps, 오늘 실행 화면 변경
- 지출/정산 데이터 통화 변환 또는 기존 지출 통화 변경
- 지출이 생성된 뒤 기본 통화 변경 제한. 해당 제약은 지출/정산 feature가 생긴 뒤 후속에서 재정의한다
- non-owner/admin 편집 UI나 관리자 override
- optimistic update, offline edit queue, conflict resolution, audit log
- unsaved changes confirmation modal
- full trip settings screen

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/index.tsx`
  - 성공 상태에서 Owner에게 `여행 정보 수정` 액션을 제공한다.
  - F-022 시점에는 F-019 Owner가 `trip.createdBy`와 동일하므로, 앱은 current user id와 `detail.trip.createdBy`를 비교해 액션 노출을 결정할 수 있다.
  - 서버의 Owner authorization이 최종 권한 판단이다. 직접 edit route 접근이나 stale UI는 `PATCH`에서 다시 검증한다.
- `apps/mobile/app/trips/[tripId]/edit.tsx`
  - `/trips/{tripId}/edit` 의미의 Expo Router 화면을 제공한다.
  - 화면 진입 시 `GET /trips/{tripId}`로 현재 값을 불러온다.
  - 불러온 `trip.name`, `trip.startDate`, `trip.endDate`, `trip.defaultCurrency`로 form을 prefill한다.
  - `저장하기`는 generated TypeScript client를 통해 `PATCH /trips/{tripId}`를 호출한다.
  - `취소` 또는 back은 저장 없이 `/trips/{tripId}` 상세로 돌아간다. F-022에서는 unsaved changes confirmation을 제공하지 않는다.
- `apps/mobile/app/mypage.tsx`
  - 직접 UI 변경은 필수 범위가 아니다.
  - F-020의 focus 기반 `GET /trips` reload를 유지해 사용자가 마이페이지로 돌아왔을 때 수정된 값이 보이게 한다.

정확한 파일명은 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, route 의미는 `/trips/{tripId}/edit`로 유지한다.

### Form Fields

편집 가능한 필드는 정확히 아래 네 개다.

- 여행 이름
  - Label: `여행 이름`
  - Placeholder: `예: 오사카 3박 4일`
  - 기존 이름으로 prefill한다.
- 시작일
  - Label: `시작일`
  - `react-native-calendars` 기반 월간 캘린더 선택을 재사용한다.
  - 과거/오늘/미래 날짜 모두 선택할 수 있다.
  - 시작일이 종료일보다 늦어지는 선택은 validation error로 막는다.
- 종료일
  - Label: `종료일`
  - `react-native-calendars` 기반 월간 캘린더 선택을 재사용한다.
  - 과거/오늘/미래 날짜 모두 선택할 수 있다.
  - 종료일은 시작일보다 빠를 수 없다.
- 기본 통화
  - Label: `기본 통화`
  - Options: `KRW`, `JPY`, `USD`, `EUR`
  - F-022에서는 기본 통화 값만 바꾼다. 기존 지출/정산 데이터에 대한 영향은 없다.

F-022 날짜 편집은 F-019 생성과 달리 오늘 이전 날짜를 금지하지 않는다. 여행 기록 보정과 과거 여행 정보 수정을 허용하기 위해 `startDate <= endDate`만 날짜 범위 규칙으로 적용한다.

### Button State

- `저장하기`는 다음 경우 disabled다.
  - 초기 load 중
  - submit 중
  - loaded original values와 현재 form values 사이에 변경사항이 없음
  - client-side validation 실패
- submit 중에는 버튼 문구를 `저장하는 중...`으로 바꾸고 중복 제출을 막는다.
- invalid form에서는 사용자가 이해할 수 있는 validation 문구를 화면 안에 표시한다.

### States

- Initial Loading
  - Full-card 상태로 `여행 정보를 불러오는 중...`을 표시한다.
- Initial Load Error
  - Toast가 아니라 edit route 안의 full-card 상태로 표시한다.
  - `401 UNAUTHORIZED`: `다시 로그인해주세요.`와 `로그인하기`
  - `400 VALIDATION_ERROR`, `403 FORBIDDEN`, `404 NOT_FOUND`: `여행을 찾을 수 없어요.`와 `삭제되었거나 접근할 수 없는 여행이에요.`, `홈으로` 또는 안전한 뒤로가기 액션
  - network/unknown/`500`: `여행 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.`와 `다시 시도`
- Editing
  - Prefilled form을 보여준다.
  - validation 오류가 있으면 form 안에 표시한다.
- Saving
  - `저장하는 중...`을 표시하고 입력/저장을 중복 수행할 수 없게 한다.
- Save Success
  - Toast는 필요 없다.
  - `/trips/{tripId}`로 `replace` 또는 동등한 navigation을 수행한다.
  - 상세 화면은 refetch 또는 returned updated trip 소비를 통해 수정된 값을 즉시 보여준다.
- Save Error
  - edit screen에 머문다.
  - 사용자가 입력한 수정값을 유지한다.
  - `저장하기`를 다시 누를 수 있게 한다.
  - inline error를 save button 위 또는 인접 위치에 표시한다.
  - `400 VALIDATION_ERROR`: field/general validation copy
  - `401 UNAUTHORIZED`: `다시 로그인해주세요.`
  - `403 FORBIDDEN`: `여행 정보를 수정할 권한이 없어요.`
  - `404 NOT_FOUND`: `여행을 찾을 수 없어요.`
  - network/unknown/`500`: `여행 정보를 수정할 수 없어요. 잠시 후 다시 시도해주세요.`

### Copy / Labels

- Detail edit action: `여행 정보 수정`
- Screen title: `여행 정보 수정`
- Screen subtitle: `이름, 기간, 기본 통화를 바꿀 수 있어요.`
- Name label: `여행 이름`
- Start date label: `시작일`
- End date label: `종료일`
- Currency label: `기본 통화`
- Save action: `저장하기`
- Saving: `저장하는 중...`
- Cancel action: `취소`
- Loading: `여행 정보를 불러오는 중...`
- Load generic error: `여행 정보를 불러올 수 없어요. 잠시 후 다시 시도해주세요.`
- Save generic error: `여행 정보를 수정할 수 없어요. 잠시 후 다시 시도해주세요.`
- Auth error: `다시 로그인해주세요.`
- Permission error: `여행 정보를 수정할 권한이 없어요.`
- Not found title: `여행을 찾을 수 없어요.`
- Not found helper: `삭제되었거나 접근할 수 없는 여행이에요.`
- Retry action: `다시 시도`
- Login action: `로그인하기`
- Home action: `홈으로`
- Name validation: `여행 이름을 입력해주세요.`
- Name length validation: `여행 이름은 80자 이내로 입력해주세요.`
- Date format validation: `날짜는 YYYY-MM-DD 형식으로 입력해주세요.`
- Date range validation: `종료일은 시작일보다 빠를 수 없어요.`
- Currency validation: `지원하는 통화를 선택해주세요.`
- No changes helper: `변경된 내용이 없어요.`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- F-019 생성 폼의 warm off-white background, white card, subtle border/shadow, calendar/currency chip 패턴을 재사용한다.
- F-022에서 같은 버튼/card/form 패턴을 세 번째 이상 반복하게 되면, 최소한 기존 중복을 깨지 않는 범위에서 reusable primitive 승격을 검토한다. 다만 primitive 추출 자체가 F-022 범위를 키우면 후속으로 분리한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
PATCH /trips/{tripId}
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다.

F-021의 existing endpoint도 edit screen prefill에 사용한다.

```text
GET /trips/{tripId}
```

F-022는 기본적으로 `GET /trips/{tripId}` response schema 변경을 요구하지 않는다. 모바일은 existing `trip.createdBy`와 current user id를 비교해 edit action 노출을 결정할 수 있다. 서버의 `PATCH` Owner authorization이 최종 보안 경계다.

### Path Parameters

```text
tripId: string
```

`tripId`는 서버 내부 id 형식에 맞는 string이다. 현재 DB 구현이 UUID라면 유효하지 않은 UUID 형식은 `400 VALIDATION_ERROR`로 처리한다.

### Request

HTTP request body required. 모든 field는 optional이지만 request에는 최소 하나의 field가 있어야 한다. 모바일은 original values와 비교해 변경된 필드만 보낸다.

```json
{
  "name": "오사카 4박 5일",
  "startDate": "2026-07-10",
  "endDate": "2026-07-14",
  "defaultCurrency": "JPY"
}
```

Schema notes:

- `name`: optional string. 제공되면 서버가 trim한 뒤 1..80 chars 범위를 검증하고 저장한다.
- `startDate`: optional string, format `date`, `YYYY-MM-DD`.
- `endDate`: optional string, format `date`, `YYYY-MM-DD`.
- `defaultCurrency`: optional enum `KRW | JPY | USD | EUR`.
- 빈 object `{}`는 `VALIDATION_ERROR`다.
- `null` 값은 허용하지 않는다.
- unknown field는 OpenAPI/generated client 관점에서 사용하지 않는다.

### Merge and Validation Semantics

서버는 request field를 기존 trip 값 위에 merge한 후 전체 결과를 검증한다.

예시:

- 기존 기간이 `2026-07-10 ~ 2026-07-13`이고 request가 `{ "startDate": "2026-07-14" }`이면 merged range가 `2026-07-14 ~ 2026-07-13`이므로 `VALIDATION_ERROR`다.
- 기존 기간이 `2026-07-10 ~ 2026-07-13`이고 request가 `{ "endDate": "2026-07-09" }`이면 `VALIDATION_ERROR`다.
- request가 `{ "name": "  제주 가족여행  " }`이면 저장 값은 `제주 가족여행`이다.
- request가 기존 값과 동일한 값을 포함하더라도 서버는 idempotent하게 `200`과 현재/updated trip을 반환할 수 있다. 모바일은 unchanged submit을 만들지 않는다.

### Response

HTTP status: `200`

```json
{
  "trip": {
    "id": "trip_123",
    "name": "오사카 4박 5일",
    "startDate": "2026-07-10",
    "endDate": "2026-07-14",
    "defaultCurrency": "JPY",
    "createdBy": "user_123",
    "createdAt": "2026-06-21T15:00:00Z",
    "updatedAt": "2026-06-22T04:40:00Z"
  }
}
```

Schema notes:

- Response는 existing `Trip` schema를 재사용한다.
- `updatedAt`은 수정 시점으로 갱신된다.
- F-022 response에는 participant summary, role, permission, day, itinerary, expense data를 포함하지 않는다.

### Errors

공통 에러 포맷을 따른다.

Invalid `tripId`, empty body, invalid field value, invalid merged date range:

HTTP status: `400`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid trip update request",
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

No DB schema changes are expected.

### Tables

- `trips`: `name`, `start_date`, `end_date`, `default_currency`, `updated_at`를 수정한다.
- `trip_participants`: authenticated user가 해당 trip의 `owner` role인지 확인한다.

### Queries

구현 시 sqlc query 이름은 기존 구조에 맞춰 조정할 수 있지만 다음 동작을 지원해야 한다.

- `GetTripByID`: F-021 existing query를 재사용해 기존 값을 가져온다.
- `GetTripParticipantRole` 또는 `GetTripOwnerMembership`: `trip_id`, `user_id`로 authenticated user의 role을 확인한다.
- `UpdateTripBasicInfo`: full merged values를 받아 `trips` row를 update하고 수정된 row를 반환한다.

Expected update shape:

```sql
UPDATE trips
SET
  name = $2,
  start_date = $3,
  end_date = $4,
  default_currency = $5,
  updated_at = now()
WHERE id = $1
RETURNING id, name, start_date, end_date, default_currency, created_by, created_at, updated_at;
```

Owner check는 service/repository에서 update 전에 수행한다. 구현에서 race-free authorization을 위해 transaction이나 owner-check 포함 update query를 선택할 수 있지만, observable behavior는 동일해야 한다.

### Constraints / Indexes

F-019에서 추가된 다음 constraint/index를 재사용한다.

- `trips_name_length_check`: DB에서도 1..80자 이름을 보장한다.
- `trips_date_range_check`: DB에서도 `start_date <= end_date`를 보장한다.
- `trips_default_currency_check`: DB에서도 지원 currency를 보장한다.
- `trip_participants_trip_user_unique`: user의 trip membership/role 확인에 사용한다.
- `trip_participants_trip_id_idx`, `trip_participants_user_id_idx`: owner check 및 future participant 조회에 사용한다.

F-022에서는 새 index를 기본적으로 추가하지 않는다. 구현 중 query plan상 필요가 확인되면 spec을 업데이트한 뒤 migration을 추가한다.

### Migration Notes

- 새 migration은 예상하지 않는다.
- sqlc query 추가 후 generated DB code를 갱신한다.
- 기존 migration 적용/rollback 경로가 계속 통과해야 한다.

## Business Rules

- `PATCH /trips/{tripId}`는 인증된 사용자만 호출할 수 있다.
- authenticated user가 해당 여행의 `trip_participants.role = 'owner'`일 때만 수정할 수 있다.
- request body나 query parameter에서 user id 또는 role을 받지 않는다.
- `tripId` 형식이 유효하지 않으면 `VALIDATION_ERROR`를 반환한다.
- trip row가 없으면 `NOT_FOUND`를 반환한다.
- trip row는 있지만 authenticated user가 Owner가 아니면 `FORBIDDEN`을 반환한다.
- editable fields는 `name`, `startDate`, `endDate`, `defaultCurrency` 네 개뿐이다.
- 서버는 partial request를 기존 trip 값과 merge한 뒤 merged trip 전체를 검증한다.
- request에는 최소 하나의 editable field가 있어야 한다.
- `name`이 제공되면 trim 후 저장한다.
- trim 후 `name`은 1자 이상 80자 이하여야 한다.
- `startDate`와 `endDate`가 제공되면 `YYYY-MM-DD` date여야 한다.
- F-022에서는 과거 날짜를 허용한다.
- merged `startDate`는 merged `endDate`보다 늦을 수 없다.
- `defaultCurrency`가 제공되면 `KRW`, `JPY`, `USD`, `EUR` 중 하나여야 한다.
- `defaultCurrency` 변경은 F-022에서 trip 기본 통화 표시값만 바꾼다. 기존 지출/정산 데이터에 대한 변환, 잠금, 재계산은 수행하지 않는다.
- `updated_at`은 update 성공 시 갱신된다.
- update 실패 시 trip row는 변경되지 않아야 한다.
- F-022는 trip_days를 생성/삭제/재생성하지 않는다.
- F-022는 participant, itinerary, expense, settlement 데이터를 수정하지 않는다.

## Acceptance Criteria

- [x] `docs/features/0022-update-trip.md`에 feature spec + implementation plan이 작성되어 있다.
- [x] F-022 editable field는 `name`, `startDate`, `endDate`, `defaultCurrency` 네 개로만 정의되어 있다.
- [x] 여행 상세 화면에서 Owner에게 `여행 정보 수정` 진입점이 표시된다.
- [x] non-owner에게 edit action이 노출되지 않거나, 직접 접근/요청 시 서버에서 안전하게 차단된다.
- [x] `/trips/{tripId}/edit` 화면은 `GET /trips/{tripId}`로 현재 여행 정보를 불러오고 네 필드를 prefill한다.
- [x] initial loading 상태에 `여행 정보를 불러오는 중...`이 표시된다.
- [x] initial load `401`은 re-login 상태를 표시한다.
- [x] initial load `400/403/404`는 `여행을 찾을 수 없어요.` 상태를 표시한다.
- [x] initial load network/unknown/`500`은 retry 가능한 load error 상태를 표시한다.
- [x] `저장하기`는 load/submitting 중, 변경사항 없음, client validation 실패 시 disabled다.
- [x] `취소` 또는 back은 저장 없이 상세 화면으로 돌아가며 unsaved changes confirmation은 표시하지 않는다.
- [x] `packages/api-contract/openapi.yaml`에 인증된 `PATCH /trips/{tripId}` endpoint와 partial request/response/error schema가 정의되어 있다.
- [x] generated Go server artifact와 TypeScript client/type이 `PATCH /trips/{tripId}`를 포함하도록 갱신되어 있다.
- [x] 모바일은 generated TypeScript client를 사용해 `PATCH /trips/{tripId}`를 호출한다.
- [x] 모바일은 original values와 비교해 변경된 field만 request body에 포함한다.
- [x] 빈 patch body 또는 지원하지 않는 field value는 `VALIDATION_ERROR`다.
- [x] 인증되지 않은 `PATCH /trips/{tripId}` 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] 유효하지 않은 `tripId` 형식은 `400 VALIDATION_ERROR`를 반환한다.
- [x] 존재하지 않는 trip은 `404 NOT_FOUND`를 반환한다.
- [x] authenticated user가 Owner가 아닌 trip update 요청은 `403 FORBIDDEN`을 반환하고 데이터가 변경되지 않는다.
- [x] Owner의 유효한 partial update 요청은 `200`과 수정된 `trip`을 반환한다.
- [x] name은 trim 후 저장되며 1..80자 범위를 벗어나면 `VALIDATION_ERROR`가 반환된다.
- [x] date가 `YYYY-MM-DD` 형식이 아니면 `VALIDATION_ERROR`가 반환된다.
- [x] merged `startDate > endDate`이면 `VALIDATION_ERROR`가 반환된다.
- [x] 과거 날짜는 F-022 update에서 허용된다.
- [x] `defaultCurrency`가 `KRW`, `JPY`, `USD`, `EUR`가 아니면 `VALIDATION_ERROR`가 반환된다.
- [x] update 성공 시 `trips.updated_at`이 갱신된다.
- [x] save success 후 앱은 `/trips/{tripId}` 상세 화면으로 돌아가고 수정된 이름/기간/기본 통화를 즉시 보여준다.
- [x] save failure는 edit screen에 머물며 사용자 입력값을 유지하고 inline error를 표시하며 retry 가능하다.
- [x] 마이페이지는 optimistic update를 하지 않아도 되지만, 사용자가 돌아가거나 다시 열면 기존 focus reload로 수정된 값을 보여준다.
- [x] F-022 구현은 trip-day regeneration, delete/cancel, participant management, itinerary/place/expense/settlement 변경을 포함하지 않는다.
- [x] API tests, mobile tests/typecheck, generated artifact consistency check가 통과한다.
- [ ] staging 또는 internal build에서 Owner edit happy path와 non-owner/invalid failure path를 확인하고 결과를 기록한다.
## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| `PATCH /trips/{tripId}` contract and generated clients stay in sync | Contract/generated | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| Owner valid partial update returns `200` with updated trip | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` |
| `PATCH` requires authentication | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| invalid `tripId`, empty body, invalid date/name/currency return `VALIDATION_ERROR` | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| non-owner receives `403` and trip data is not changed | API service/repository | `apps/api/internal/trip/service_test.go` and/or integration handler test | `pnpm --filter @i-um/api test` |
| partial date merge validates against existing date pair and allows past dates | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| `updated_at` changes on successful update | DB/repository or service integration | `apps/api/internal/storage/trip_repository` covered by API/storage tests if available | `pnpm --filter @i-um/api test` |
| edit form computes changed-field-only payload and disables save for unchanged/invalid/submitting states | Mobile logic/state | `apps/mobile/lib/trips/update-form.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| mobile client uses generated `TripsService` for update | Mobile type/gate | TypeScript compile and generated type references | `pnpm --filter @i-um/mobile typecheck` |
| trip detail route can navigate to edit and returns to updated detail after success | Mobile state/navigation smoke plus typecheck | component/state tests if router mocking exists; otherwise regression gap/manual smoke | `pnpm --filter @i-um/mobile test` + Manual Smoke |
| existing create/list/detail flows are not broken | Full regression | API build/test, mobile test/typecheck, generated drift | `pnpm verify` |

## Regression Gaps

- Expo Router navigation and visual rendering on a physical/internal build are not fully covered unless component/router tests are added during implementation.
  - Risk: route transition or focus refetch could regress despite pure logic tests passing.
  - Follow-up: Record staging/internal build smoke result in this feature; add component/router tests if the project introduces a stable React Native render test harness.

## TDD Implementation Plan

1. Red: Contract and API behavior tests
   - 작업: `PATCH /trips/{tripId}` handler/service tests를 먼저 추가한다. Include: owner partial update, auth required, invalid id, empty body, invalid name/date/currency, merged date range, past dates allowed, non-owner forbidden/no mutation, not found.
   - Verify: `pnpm --filter @i-um/api test`가 `PATCH` 미구현으로 실패한다.

2. Red: Mobile update form logic tests
   - 작업: changed-field payload 계산, validation, save disabled 조건을 순수 함수/상태 helper test로 작성한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현으로 실패한다.

3. OpenAPI 계약 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `PATCH /trips/{tripId}`, `UpdateTripRequest`, `UpdateTripResponse`, `400/401/403/404/500` error responses를 추가한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifacts에 update trip endpoint/types가 포함된다.

4. DB/sqlc query 추가
   - 작업: owner role 확인 query와 `UpdateTripBasicInfo` query를 추가한다. 새 migration은 추가하지 않는다.
   - Verify: `pnpm generate`가 sqlc code를 갱신하고 API compile이 query drift 없이 진행된다.

5. API trip update domain 구현
   - 작업: service에서 partial merge, validation, owner authorization, no-mutation-on-failure 규칙을 구현하고 repository update를 연결한다.
   - Verify: `pnpm --filter @i-um/api test`의 F-022 service tests가 통과한다.

6. Server route wiring과 error mapping
   - 작업: generated OpenAPI interface에 맞춰 `PATCH /trips/{tripId}` handler를 등록하고 공통 error format으로 `400/401/403/404/500`을 반환한다.
   - Verify: `pnpm --filter @i-um/api test`와 `pnpm --filter @i-um/api build`가 통과한다.

7. Mobile generated client helper 추가
   - 작업: `apps/mobile/lib/trips/client.ts` 또는 기존 위치에 generated client를 사용하는 `updateTrip(tripId, request)` helper를 추가한다.
   - Verify: hand-written duplicate API type 없이 `pnpm --filter @i-um/mobile typecheck`가 통과한다.

8. Mobile edit form logic 구현
   - 작업: F-019 create form validation/calendar/currency patterns를 재사용해 changed-field-only payload, disabled state, validation copy를 구현한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 통과한다.

9. Mobile screens 연결
   - 작업: 상세 화면 Owner-only `여행 정보 수정` entry, `/trips/{tripId}/edit` load/prefill/edit/save/error/cancel flow를 구현한다.
   - Verify: simulator/emulator/local device 또는 Expo dev에서 Owner가 수정 후 상세에서 갱신 값을 확인하고 non-owner/direct route error state를 확인한다.

10. Repository verification 통합
    - 작업: generated drift, Go test/build, mobile test/typecheck를 모두 통과하도록 정리한다.
    - Verify: `pnpm verify`가 통과한다.

11. Staging/internal smoke verification
    - 작업: staging API 배포 또는 equivalent environment에서 Owner edit happy path, invalid validation, non-owner forbidden path를 확인한다.
    - Verify: 완료 보고에 staging/internal build 검증 결과, API URL/build link 또는 제한사항을 기록한다.

## Verification Plan

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
- `pnpm verify:generated`: pass.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test`: pass through `pnpm verify`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api build`: pass through `pnpm verify`.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.
- `pnpm db:up`: fail in this worktree because local port `5432` was already allocated. The failed F-022 compose container/network/volume were cleaned up with `docker compose down -v`.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass against the existing local DB; no migrations to run, current version 3.
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass; migrations `00001` through `00003` applied.
- Local API smoke with `AUTH_ALLOW_DEV_OAUTH=true` on port `18122`: pass. Dev OAuth login succeeded, authenticated `POST /trips` created a trip, and authenticated `PATCH /trips/{tripId}` updated name, past date range, and default currency through the real repository/sqlc path.
- Mobile runtime check on simulator/emulator/physical device: not run in this environment. TypeScript integration with generated client and mobile update-form regression tests passed.
- Staging/internal build verification: not run in this implementation pass.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Owner 계정으로 여행 상세 화면에 진입하면 `여행 정보 수정` action이 보인다.
- [ ] `여행 정보 수정`을 누르면 `/trips/{tripId}/edit` 화면이 열리고 기존 이름/기간/기본 통화가 prefill된다.
- [ ] 변경사항이 없으면 `저장하기`가 비활성화된다.
- [ ] 빈 이름, 80자 초과 이름, `startDate > endDate`, 미지원 통화가 사용자 문구로 막힌다.
- [ ] 과거 날짜로 기간을 수정할 수 있다.
- [ ] 이름만 바꾸면 request body에 이름만 포함된다.
- [ ] 저장 중 `저장하는 중...`이 표시되고 중복 제출이 막힌다.
- [ ] 저장 성공 후 상세 화면으로 돌아가고 수정된 값이 즉시 보인다.
- [ ] `취소` 또는 back은 저장 없이 상세 화면으로 돌아간다.
- [ ] non-owner가 직접 edit route 또는 PATCH를 시도하면 수정되지 않고 권한 오류가 표시된다.
- [ ] 마이페이지로 돌아가거나 다시 열면 목록 row의 이름/기간/기본 통화가 수정된 값으로 보인다.
- [ ] staging 또는 internal build에서 Owner edit happy path와 invalid/non-owner failure path를 확인한다.

## Release Notes

```text
- 여행 Owner가 여행 상세 화면에서 이름, 기간, 기본 통화를 수정할 수 있게 한다.
- 수정 성공 후 여행 상세와 마이페이지 목록에서 변경된 기본 정보가 반영된다.
- 여행 기간 변경에 따른 Day 생성/재생성과 지출/정산 영향은 후속 기능에서 다룬다.
```

## Open Questions

None for implementation after Ouroboros clarification.

Resolved by Ouroboros interview:

- F-022 editable fields는 `name`, `startDate`, `endDate`, `defaultCurrency` 네 개뿐이다.
- API는 `PATCH /trips/{tripId}`이며 모바일은 변경된 필드만 보낸다.
- 날짜 수정은 과거/오늘/미래 모두 허용하되 `startDate <= endDate`만 검증한다.
- 기본 통화 변경은 F-022에서 trip 기본 통화 값만 바꾸며 지출/정산 영향은 후속에서 재정의한다.
- edit entry는 `/trips/{tripId}` 상세 화면의 `여행 정보 수정` action이다.
- edit screen은 `GET /trips/{tripId}`로 prefill한다.
- save disabled 조건은 loading/submitting, unchanged, invalid form이다.
- unsaved changes confirmation은 F-022에서 제공하지 않는다.
- save success는 toast 없이 `/trips/{tripId}`로 돌아가고 상세가 수정 값을 즉시 보여준다.
- MyPage는 optimistic update 없이 기존 focus reload로 수정 값을 보여준다.
- load/save failure는 toast가 아니라 화면 안의 full-card 또는 inline error로 표시하고 retry 가능해야 한다.

## Follow-up Issues

- #23: 여행 삭제
- #24: 여행 기간 기반 Day 생성 및 기간 수정 시 Day 구조 정책
- #40~#46: 동행자 초대, 수락, 참여자 목록/관리, 공동 일정 편집 반영
- #47~#59: 지출/정산 도메인. 지출 생성 이후 기본 통화 변경 제약 또는 정산 영향은 해당 feature에서 재정의
