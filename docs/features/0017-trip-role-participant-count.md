# Feature Slice: F-017 여행 내 역할/참여자 수 표시

## Metadata

- GitHub Issue: #17
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260622_070338`
- Seed: `seed_6a47ca19d4c7`
- PM Document: N/A
- Notes: Ambiguity score `0.049`. Ouroboros clarified F-017 as the minimum OpenAPI-first vertical slice that extends the existing `GET /trips` My Page flow with required per-trip `myRole` and `participantCount` fields. The slice reuses the existing lowercase `TripParticipantRole` enum (`owner`, `member`), maps it to Korean labels on mobile, counts accepted/current `trip_participants` rows only, preserves F-015 status sections and existing loading/empty/error states, and does not add detail-screen, sorting, filtering, search, or future-role behavior.

Context clarified before drafting:

- F-013 owns the authenticated `마이페이지` shell, profile summary, settings section, and bottom menu.
- F-014/F-020 provide the generated-client-backed `GET /trips` flow for the My Page `내 여행` list.
- F-015 groups the existing `내 여행` success state into status sections and must remain intact.
- F-019/F-020 provide the existing `trips` and `trip_participants` model; a created trip has an Owner participant.
- The current OpenAPI role enum is lowercase `owner | member`; F-017 must not introduce uppercase role values.

## Goal

로그인한 사용자가 마이페이지의 `내 여행` 카드에서 각 여행에 대한 내 역할과 현재 참여자 수를 바로 확인할 수 있다.

F-017은 기존 `GET /trips` 목록 응답을 확장해 마이페이지 카드에 `주최자`/`동행자` 역할 라벨과 `참여자 N명` 정보를 표시하는 최소 vertical slice다.

## Problem

- 현재 마이페이지 여행 카드는 여행명, 날짜, 기본 통화만 보여주기 때문에 사용자가 각 여행에서 본인이 주최자인지 동행자인지 알 수 없다.
- 동행자가 있는 여행인지 카드만 보고 알 수 없어 초대/협업 기능이 추가될수록 목록에서 여행 맥락을 파악하기 어렵다.
- 역할/참여자 수는 `trip_participants`에 이미 존재하는 데이터이므로 별도 화면 진입 없이 목록에서 요약할 수 있다.

## User Flow

1. 사용자가 로그인한 상태로 하단 메뉴의 `마이`를 눌러 마이페이지를 연다.
2. 앱은 기존 흐름대로 generated client를 통해 authenticated `GET /trips`를 호출한다.
3. API는 인증된 사용자가 참여 중인 각 여행에 `myRole`과 `participantCount`를 포함해 반환한다.
4. 앱은 기존 F-015 상태 섹션 안에서 각 여행 카드를 렌더링한다.
5. 각 카드에는 기존 여행명, 날짜 범위, 기본 통화와 함께 `주최자` 또는 `동행자`, `참여자 N명`이 표시된다.
6. 사용자는 기존과 동일하게 여행 카드를 눌러 `/trips/{tripId}` 상세 화면으로 이동한다.
7. 목록 loading/empty/error 상태는 기존 마이페이지 동작과 동일하게 유지된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 마이페이지 `내 여행` 카드 success state에 내 역할 라벨과 참여자 수 라벨 추가
- [ ] App UI: 기존 F-015 상태 섹션(`진행 중인 여행`, `예정된 여행`, `지난 여행`) 안의 모든 여행 카드에 동일하게 표시
- [ ] App UI: `owner` → `주최자`, `member` → `동행자` mobile mapping 추가
- [ ] App UI: 참여자 수를 `참여자 N명` 형식으로 표시
- [ ] API Contract: `GET /trips`의 `TripListItem`에 required `myRole: TripParticipantRole`, `participantCount: integer >= 1` 추가
- [ ] API Server: authenticated user의 participant role과 해당 여행의 accepted/current participant count를 list 응답에 포함
- [ ] DB: 새 schema migration 없음. 기존 `trip_participants` rows를 role/count source로 사용하고 list query/sqlc code를 갱신
- [ ] Generated Code: OpenAPI 기반 Go server artifact, TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API contract/server response, participant count source, mobile role/count mapping 및 status section view-model 회귀 테스트
- [ ] Deployment: local/internal build에서 내 여행 카드 역할/참여자 수 표시와 기존 navigation/loading/empty/error 흐름 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 새 participant list endpoint 호출 또는 마이페이지에서 참여자 이름 목록 조회
- `GET /trips` 외 별도 mobile fetch 경로 추가
- 초대 링크 생성/수락, pending invitee 표시, pending invitee count 포함 (#41~#44)
- 참여자 목록/관리, 참여자 제거 (#40, #45)
- future role 값 추가 또는 role hierarchy 변경
- uppercase `OWNER`/`MEMBER` enum 도입
- 역할별 sorting/filtering/search/tab 추가
- 역할 badge로 카드 정렬 순서 변경
- section별 참여자 count 합계 표시
- 여행 상세 화면의 참여자 summary 변경
- 여행 카드에 대표 이미지, 목적지, 장소 수, 일정 진행률, 지출/정산 요약 추가
- loading/empty/error state에 role/count placeholder 추가
- unknown/null/missing role/count를 위한 fallback UI
- 하단 navigation 구조 개편

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx` 또는 현재 마이페이지 route
  - 기존 header, profile summary, settings section, bottom menu는 유지한다.
  - `내 여행` 섹션의 loading/empty/error state는 기존과 동일하게 유지한다.
  - `내 여행` success state에서만 각 여행 카드에 역할/참여자 수 metadata를 추가한다.
  - 기존 F-015 status section order와 비어 있는 section 숨김 동작은 유지한다.

### My Trips Card Content

각 여행 카드는 기존 필드와 새 metadata를 함께 표시한다.

- 기존 필드 유지:
  - 여행 이름
  - 여행 날짜 범위: `YYYY.MM.DD ~ YYYY.MM.DD`
  - 기본 통화: `기본 통화 <currency>`
- 새 필드 추가:
  - 내 역할: `주최자` 또는 `동행자`
  - 참여자 수: `참여자 N명`
- 카드 tap action은 기존과 동일하게 `/trips/{tripId}`로 이동한다.
- 새 metadata는 같은 카드 안에서 과도한 시각 강조 없이 보조 정보로 표시한다.

### States

- Loading: 기존 `내 여행을 불러오는 중...` state를 그대로 유지한다. role/count placeholder를 표시하지 않는다.
- Empty: 기존 `아직 여행이 없어요.`와 `새 여행 만들기` CTA를 그대로 유지한다. role/count placeholder를 표시하지 않는다.
- Error: 기존 `내 여행을 불러올 수 없어요.`와 `다시 시도` CTA를 그대로 유지한다. role/count placeholder를 표시하지 않는다.
- Success: 모든 여행 카드에 기존 필드와 함께 role/count metadata를 표시한다.

### Copy / Labels

- Role owner label: `주최자`
- Role member label: `동행자`
- Participant count label: `참여자 N명`
- Existing section title: `내 여행`
- Existing status section titles: `진행 중인 여행`, `예정된 여행`, `지난 여행`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 마이페이지 card/list row 패턴을 유지하고 metadata text/chip만 최소로 추가한다.
- 같은 role/count formatting이 screen code에 직접 흩어지지 않도록 mobile helper/view-model로 분리한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips
```

Existing authenticated endpoint. Returns trips where the current authenticated user has a `trip_participants` row.

### Request

No request body.

### Response

`TripListItem`에 required fields를 추가한다.

```yaml
TripListItem:
  type: object
  required:
    - id
    - name
    - startDate
    - endDate
    - defaultCurrency
    - joinedAt
    - createdAt
    - myRole
    - participantCount
  properties:
    id:
      type: string
    name:
      type: string
    startDate:
      type: string
      format: date
    endDate:
      type: string
      format: date
    defaultCurrency:
      $ref: '#/components/schemas/SupportedCurrency'
    joinedAt:
      type: string
      format: date-time
    createdAt:
      type: string
      format: date-time
    myRole:
      $ref: '#/components/schemas/TripParticipantRole'
    participantCount:
      type: integer
      minimum: 1
```

Example response:

```json
{
  "trips": [
    {
      "id": "trip_123",
      "name": "오사카 3박 4일",
      "startDate": "2026-07-10",
      "endDate": "2026-07-13",
      "defaultCurrency": "JPY",
      "joinedAt": "2026-06-21T15:00:00Z",
      "createdAt": "2026-06-21T15:00:00Z",
      "myRole": "owner",
      "participantCount": 3
    }
  ]
}
```

### Role Enum

F-017 reuses the existing enum exactly as-is.

```yaml
TripParticipantRole:
  type: string
  enum:
    - owner
    - member
```

- `owner` maps to mobile label `주최자`.
- `member` maps to mobile label `동행자`.
- New role values are out of scope for F-017.

### Errors

No new error codes.

Existing authenticated `GET /trips` errors remain unchanged and follow the common error format.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "authentication required",
    "details": []
  }
}
```

## DB Changes

No schema migration.

### Tables

- `trips`: unchanged.
- `trip_participants`: unchanged. F-017 reads:
  - current user's `role` for each listed trip
  - total accepted/current participant row count for each listed trip

### Constraints / Indexes

- Existing `trip_participants_role_check` keeps roles limited to `owner` and `member`.
- Existing `trip_participants_trip_user_unique` ensures one current-user participant row per trip.
- Existing `trip_participants_user_id_idx` supports listing trips by current user.
- Existing `trip_participants_trip_id_idx` supports counting participants by trip.

### Query / sqlc Notes

`ListTripsByParticipantUser` should be updated to return at least:

- existing list fields: `id`, `name`, `start_date`, `end_date`, `default_currency`, `joined_at`, `created_at`
- `my_role`: role from the authenticated user's `trip_participants` row
- `participant_count`: count of `trip_participants` rows for the same `trip_id`

The query must preserve the existing sort order from F-020 and must not filter out accessible trips.

### Migration Notes

- No goose migration is expected.
- sqlc generated DB code must be regenerated after query changes.

## Business Rules

- `GET /trips` returns only trips where the authenticated user has a `trip_participants` row.
- `myRole` is the authenticated user's role for that trip, not the trip creator field and not another participant's role.
- `myRole` uses the existing lowercase `TripParticipantRole` values: `owner`, `member`.
- `participantCount` is the number of accepted/current `trip_participants` rows for the trip.
- `participantCount` includes the authenticated user.
- Pending invitation links and users who have not accepted an invite are excluded because they do not have an accepted/current `trip_participants` row.
- For any trip returned to the authenticated user, `participantCount` must be at least `1`.
- Existing My Trips sorting and F-015 status grouping remain unchanged.
- Unknown/null/missing `myRole` or `participantCount` values are contract/server/mobile mapping failures, not fallback UI states in this slice.

## Acceptance Criteria

- [ ] `GET /trips` OpenAPI contract defines required per-trip `myRole: TripParticipantRole` and `participantCount: integer >= 1` fields.
- [ ] Generated Go server types and TypeScript client types are regenerated from the updated OpenAPI with no generated drift.
- [ ] `GET /trips` returns `myRole` as the authenticated user's own participant role, limited to `owner` or `member`.
- [ ] `GET /trips` returns `participantCount` from accepted/current `trip_participants` rows, includes the authenticated user, excludes pending invitees, and is at least `1`.
- [ ] 마이페이지 `내 여행` success state의 모든 기존 F-015 status section 카드가 `주최자` 또는 `동행자` 역할 라벨을 표시한다.
- [ ] 마이페이지 `내 여행` success state의 모든 기존 F-015 status section 카드가 `참여자 N명` count 라벨을 표시한다.
- [ ] 모바일은 role/count 표시를 기존 `GET /trips` 응답에서만 가져오며 별도 participant-list API를 호출하지 않는다.
- [ ] 기존 `내 여행` loading/empty/error state는 문구와 CTA가 그대로 유지되고 role/count placeholder를 표시하지 않는다.
- [ ] unknown/null/missing role/count 값은 contract, generated-client, server, 또는 mobile mapping 테스트 실패로 처리되며 fallback UI를 추가하지 않는다.
- [ ] F-017 구현은 sorting/filtering/search/detail-screen/future-role behavior를 추가하지 않는다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| `TripListItem` contract includes required `myRole` and `participantCount` and generated artifacts are current | Contract / Generated | `packages/api-contract/openapi.yaml`, generated Go/TS artifacts | `pnpm verify:generated` |
| `GET /trips` serializes `myRole` and `participantCount` for each listed trip and keeps list-only fields constrained | API handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Authenticated user's own role is returned, not another participant's role | API service/repository or handler-backed fake | `apps/api/internal/trip/service_test.go` and/or `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| `participantCount` is derived from accepted/current `trip_participants` rows and is at least 1 for accessible trips | API repository/service | `apps/api/internal/trip/service_test.go` or repository-level test if DB harness exists | `pnpm --filter @i-um/api test` |
| API server compiles against regenerated required OpenAPI fields | API build | Go generated types + server mapping | `pnpm --filter @i-um/api build` |
| `owner` maps to `주최자`, `member` maps to `동행자`, and count formats as `참여자 N명` | Mobile logic | `apps/mobile/lib/trips/cardMeta.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| Every trip card view-model in ongoing/upcoming/past sections includes role/count labels | Mobile logic/state | `apps/mobile/lib/trips/cardMeta.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| Existing F-015 status grouping and sorting behavior remains unchanged | Mobile regression | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mypage screen consumes generated `TripListItem` fields without TypeScript errors | Mobile typecheck | TypeScript compiler | `pnpm --filter @i-um/mobile typecheck` |
| Full workspace regression gate passes | Workspace | root verification | `pnpm verify` |

## Regression Gaps

- None for the F-017 acceptance criteria. The role/count copy and per-section card metadata should be produced by tested mobile helper/view-model code that `mypage.tsx` consumes. Manual smoke remains a visual/device check, not the only regression proof.

## TDD Implementation Plan

Red-Green-Refactor 순서로 작성한다. 구현 계획보다 실패 테스트와 회귀 테스트 게이트를 먼저 고정한다.

1. Red: API contract/server expectations 추가
   - 작업: `TripListItem`에 required `myRole`, `participantCount`를 기대하도록 OpenAPI와 API response tests를 먼저 갱신한다.
   - Verify: `pnpm --filter @i-um/api test` 또는 `pnpm --filter @i-um/api build`가 기존 server mapping/domain type에 필드가 없어 실패한다.
2. Green: OpenAPI-first generated code 갱신
   - 작업: `packages/api-contract/openapi.yaml`을 수정하고 `pnpm generate`로 Go server/TS client/sqlc generated artifacts를 갱신한다.
   - Verify: generated required fields 때문에 아직 구현되지 않은 server mapping compile/test failure가 확인된다.
3. Green: API query/domain/server 최소 구현
   - 작업: `ListTripsByParticipantUser` query/sqlc/domain `ListItem`/repository/server mapping을 갱신해 `myRole`과 `participantCount`를 반환한다.
   - Include: current user's `tp.role`, same-trip participant row count, 기존 sort order 유지.
   - Verify: `pnpm --filter @i-um/api test` pass.
4. Red: Mobile role/count mapping tests 추가
   - 작업: `owner`/`member` label mapping, `참여자 N명` formatting, status section card view-model coverage test를 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현으로 실패한다.
5. Green: Mobile helper/view-model과 마이페이지 card UI 연결
   - 작업: role/count formatting helper를 구현하고 `apps/mobile/app/mypage.tsx` success card에서 generated `TripListItem.myRole`/`participantCount`를 표시한다.
   - Include: 기존 loading/empty/error state와 status grouping 유지, 별도 participant API 호출 없음.
   - Verify: `pnpm --filter @i-um/mobile test` 및 `pnpm --filter @i-um/mobile typecheck` pass.
6. Refactor: UI styling 최소 정리
   - 작업: theme token 기반 metadata layout으로 정리하고 중복 formatting을 screen에서 제거한다.
   - Verify: `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck` 재실행.
7. Regression gate
   - Verify: `pnpm verify`.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

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

DB schema migration은 없으므로 F-017 자체 완료 조건에 migration apply/rollback은 포함하지 않는다. 다만 staging DB에 기존 migrations가 적용되어 있어야 한다.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Owner user로 로그인해 마이페이지 `내 여행` 카드에 `주최자`와 `참여자 1명` 이상이 표시되는지 확인한다.
- [ ] member 참여 여행이 있는 계정 또는 seed data로 마이페이지 카드에 `동행자`가 표시되는지 확인한다.
- [ ] 여러 status section(`진행 중인 여행`, `예정된 여행`, `지난 여행`)에 있는 카드 모두 role/count metadata를 표시하는지 확인한다.
- [ ] 여행 카드 tap 시 기존 `/trips/{tripId}` 상세 이동이 유지되는지 확인한다.
- [ ] 참여 여행이 없는 계정에서 기존 empty state와 `새 여행 만들기` CTA가 유지되는지 확인한다.
- [ ] API/network 오류 상황에서 기존 inline error와 `다시 시도` CTA가 유지되는지 확인한다.
- [ ] staging 또는 internal build에서 authenticated mypage happy path를 확인하고 결과를 기록한다.

## Release Notes

```text
- 마이페이지 내 여행 카드에 내 역할(주최자/동행자)과 참여자 수를 표시한다.
- 역할/참여자 수는 기존 GET /trips 응답을 통해 제공되며, 기존 여행 상태 섹션과 카드 이동 흐름은 유지된다.
```

## Open Questions

- None. Spec approved for implementation by user request on 2026-06-22.

## Follow-up Issues

- #18: 앱 정보/약관/개인정보 링크
- #40: 참여자 목록
- #41: 초대 링크 생성
- #42: 초대 링크 수락
- #44: 초대 후 마이페이지 반영
- #45: 참여자 제거
- Future TBD: additional participant roles beyond `owner`/`member` if product scope changes
