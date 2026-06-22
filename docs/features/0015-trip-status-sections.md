# Feature Slice: F-015 여행 상태별 구분

## Metadata

- GitHub Issue: #15
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260621_172042`
- Seed: N/A (interview-only clarification)
- PM Document: N/A
- Notes: Ouroboros clarified the minimum F-015 scope as a client-side grouping enhancement on top of F-014. Status is computed from existing `GET /trips` date fields using a documented local-date rule. No API/OpenAPI/server/DB change is planned for this slice.

Context clarified before drafting:

- F-013 owns the authenticated `마이페이지` shell, profile summary, settings section, and bottom menu.
- F-014/F-020 provide the server-backed `내 여행` list using authenticated `GET /trips`, rows that navigate to `/trips/{tripId}`, and the current trip card fields.
- F-019 provides `trips` and `trip_participants` foundations.
- F-021 provides the trip detail route used by list rows.
- F-015 should group the existing `내 여행` success state into `진행 중인 여행`, `예정된 여행`, and `지난 여행` without adding status fields to the API.

## Goal

로그인한 사용자가 마이페이지의 `내 여행` 섹션에서 참여 중인 여행을 진행 중, 예정, 지난 여행으로 나누어 확인할 수 있다.

F-015는 F-014/F-020의 실제 여행 목록을 더 읽기 쉽게 분류하는 최소 UI slice다. 여행 상태는 기존 `startDate`와 `endDate`로 계산하며, 현재 여행 강조 카드나 역할/참여자 수 같은 추가 metadata는 후속 feature에서 다룬다.

## Problem

- 현재 마이페이지는 참여 여행을 하나의 flat list로 보여주기 때문에 현재 여행, 다가오는 여행, 끝난 여행을 한눈에 구분하기 어렵다.
- 사용자는 여행 실행 앱에서 지금 진행 중인 여행과 다음 여행을 먼저 찾을 수 있어야 한다.
- 별도 API/DB 모델을 늘리지 않고도 기존 date-only 여행 데이터만으로 MVP 수준의 상태 구분을 제공할 수 있다.

## User Flow

1. 사용자가 로그인한 상태로 하단 메뉴의 `마이`를 눌러 마이페이지를 연다.
2. 앱은 기존 F-013/F-014/F-020 흐름대로 현재 사용자 정보와 `GET /trips` 기반 내 여행 목록을 불러온다.
3. 앱은 모바일 기기의 local calendar date를 `YYYY-MM-DD`로 계산한다.
4. 앱은 각 여행의 `startDate`와 `endDate`를 기준으로 여행을 `진행 중`, `예정`, `지난` 상태 중 하나로 분류한다.
5. 참여 여행이 있으면 앱은 `내 여행` 섹션 안에 비어 있지 않은 상태 섹션만 `진행 중인 여행` → `예정된 여행` → `지난 여행` 순서로 보여준다.
6. 사용자는 기존과 동일하게 여행 row를 눌러 `/trips/{tripId}` 상세 화면으로 이동한다.
7. 참여 여행이 없으면 앱은 기존 empty state와 `새 여행 만들기` CTA를 보여준다.
8. 목록 조회 실패나 인증 실패는 F-020/F-013의 기존 loading/error/login-required 흐름을 따른다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 현재 마이페이지 `내 여행` success state를 상태별 section list로 변경
- [ ] App UI: `진행 중인 여행`, `예정된 여행`, `지난 여행` section header 추가
- [ ] App UI: 비어 있지 않은 section만 표시하고, 전체 목록이 비어 있으면 기존 empty state 유지
- [ ] App UI: 각 section 내부 정렬 규칙 구현
- [ ] App UI: 기존 여행 row 표시 정보와 `/trips/{tripId}` navigation 유지
- [ ] API Contract: 새 계약 없음. 기존 authenticated `GET /trips` 응답의 `startDate`, `endDate`, `joinedAt`, `createdAt`, `id`를 사용한다
- [ ] API Server: 새 서버 동작 없음. 기존 trip list endpoint를 재사용한다
- [ ] DB: 새 migration/query 없음. 기존 `trips`, `trip_participants` 조회 결과를 사용한다
- [ ] Tests: 상태 분류/정렬 pure helper 회귀 테스트, 모바일 typecheck, `pnpm verify` regression gate
- [ ] Deployment: local/internal build에서 진행 중/예정/지난 여행 표시와 기존 empty/error/navigation 흐름을 확인한다

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- API 응답에 `status`, `statusLabel`, `section` 같은 필드 추가
- OpenAPI, Go API server, DB migration, sqlc query 변경
- server-side status 계산 또는 status별 query parameter
- 상태별 tab/filter/search UI
- section별 count 표시
- sticky header, collapsible section, virtualization, pagination, pull-to-refresh 고도화
- 현재 진행 중인 여행 바로가기나 강조 카드 (#16)
- 여행 카드에 내 역할, 참여자 수, Owner/Member badge 표시 (#17)
- 여행 생성 성공 후 마이페이지 목록 자동 반영 흐름 변경 (#20)
- 여행 상세 화면 변경 (#21)
- 여행 수정/삭제 (#22, #23)
- 초대/참여자/협업 기능 (#40~#44)
- trip timezone 저장 또는 timezone-aware status model
- mock 여행 데이터, fake count, sample trip 표시
- `홈`, `마이` 외 navigation 구조 개편

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx` 또는 현재 마이페이지 route
  - 기존 header, profile summary, settings section, bottom menu는 유지한다.
  - `내 여행` 섹션의 loading/empty/error state는 현재 마이페이지와 동일하게 section-local로 유지한다.
  - `내 여행` success state만 상태별 section list로 변경한다.

### My Trips Section

- Section title: `내 여행`
- Status section order:
  1. `진행 중인 여행`
  2. `예정된 여행`
  3. `지난 여행`
- 비어 있는 status section은 렌더링하지 않는다.
- 전체 여행 목록이 비어 있으면 기존 empty state를 보여주고 status section header를 렌더링하지 않는다.
- 여행 row fields는 현재 마이페이지 카드와 동일하게 유지한다.
  - 여행 이름
  - 여행 날짜 범위: `YYYY.MM.DD ~ YYYY.MM.DD`
  - 기본 통화: `기본 통화 <currency>`
- Row action은 기존 마이페이지와 동일하다.
  - row를 누르면 기존 #21 상세 route인 `/trips/{tripId}`로 이동한다.
- 목록이 있으면 기존 `새 여행 만들기` CTA를 section 하단 또는 기존 위치에 유지한다.
- row에는 별도 status badge, role, participant count, 상세 진입 copy를 추가하지 않는다.

### Status Rules

F-015의 여행 상태는 모바일에서 기존 date-only field로 계산한다.

- `today`: 모바일 기기의 local calendar date를 `YYYY-MM-DD`로 만든 값
- `ongoing`: `startDate <= today <= endDate`
- `upcoming`: `today < startDate`
- `past`: `endDate < today`

규칙:

- `startDate` 당일은 `진행 중인 여행`이다.
- `endDate` 당일도 `진행 중인 여행`이다.
- `endDate` 다음 날부터 `지난 여행`이다.
- 각 여행은 정확히 하나의 status section에만 포함된다.
- 날짜 비교는 date-only string 기준으로 처리해 UTC 변환으로 인한 전날/다음날 밀림을 만들지 않는다.
- trip timezone이 생기면 이 규칙은 후속 feature에서 재검토한다.

### Sorting

각 section 내부 정렬은 다음을 따른다.

- 진행 중인 여행: `endDate ASC`, `startDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC`
- 예정된 여행: `startDate ASC`, `endDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC`
- 지난 여행: `endDate DESC`, `startDate DESC`, `joinedAt DESC`, `createdAt DESC`, `id DESC`

정렬 의도:

- 진행 중인 여행은 곧 끝나는 여행을 먼저 보여준다.
- 예정된 여행은 가장 가까운 다음 여행을 먼저 보여준다.
- 지난 여행은 가장 최근에 끝난 여행을 먼저 보여준다.

### States

- Loading: 현재 마이페이지와 동일하게 `내 여행` 섹션 안에서 `내 여행을 불러오는 중...`을 표시한다.
- Empty: 현재 마이페이지와 동일하게 전체 참여 여행이 없으면 `아직 여행이 없어요.`, `새 여행을 만들고 여정을 이어가요.`, `새 여행 만들기` CTA를 표시한다.
- Error: 현재 마이페이지와 동일하게 `내 여행` 섹션 안에서 `내 여행을 불러올 수 없어요.`와 `다시 시도` CTA를 표시한다.
- Login required: session이 없거나 refresh token이 invalid/revoked이면 기존 F-013 login-required/session-clearing 흐름을 사용한다.
- Success: 비어 있지 않은 status section과 여행 row를 표시한다.

### Copy / Labels

- Parent section title: `내 여행`
- Ongoing section title: `진행 중인 여행`
- Upcoming section title: `예정된 여행`
- Past section title: `지난 여행`
- Loading: `내 여행을 불러오는 중...`
- Empty title: `아직 여행이 없어요.`
- Empty helper: `새 여행을 만들고 여정을 이어가요.`
- Create trip CTA: `새 여행 만들기`
- Error: `내 여행을 불러올 수 없어요.`
- Retry CTA: `다시 시도`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 기존 마이페이지 card/list row 패턴을 유지하고, status section header만 최소로 추가한다.
- 화면 코드에 raw hex color, 임의 spacing/radius 값을 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 반복 row primitive는 이번 변경으로 필요성이 명확해질 때만 최소 범위로 승격한다.

## API Contract

No new API changes.

F-015 uses the existing generated TypeScript client for:

```text
GET /trips
```

Authenticated endpoint. 현재 사용자가 Owner 또는 Member로 참여 중인 여행 목록을 반환한다.

### Existing Response Shape

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
      "createdAt": "2026-06-21T15:00:00Z"
    }
  ]
}
```

F-015 does not add request query parameters such as `status`, `fromDate`, `toDate`, `limit`, or `cursor`.

### Existing Errors

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

No DB changes.

F-015 reads existing trip list data only.

### Tables

- `trips`: `start_date`, `end_date`, `updated_at`를 기존 `GET /trips` 응답으로 받는다.
- `trip_participants`: existing authenticated membership filtering에만 사용된다.

### Constraints / Indexes

새 constraint/index는 추가하지 않는다.

### Migration Notes

- 새 goose migration을 추가하지 않는다.
- sqlc query와 generated DB code를 변경하지 않는다.
- F-019/F-020 schema와 query가 존재하는 branch를 기준으로 구현한다.

## Business Rules

- F-015는 인증된 사용자의 참여 여행 목록만 다룬다.
- 여행 목록 데이터는 기존 `GET /trips` 결과를 그대로 사용한다.
- status 계산은 request-time server value가 아니라 mobile render/load 시점의 local date 기준이다.
- `startDate <= today <= endDate`인 여행은 `진행 중인 여행`이다.
- `today < startDate`인 여행은 `예정된 여행`이다.
- `endDate < today`인 여행은 `지난 여행`이다.
- `startDate`와 `endDate`는 API 계약상 `YYYY-MM-DD` date string으로 본다.
- 한 여행은 정확히 한 section에만 표시된다.
- 비어 있는 section은 숨긴다.
- 전체 참여 여행이 0개이면 기존 empty state를 표시한다.
- 여행 row는 현재 마이페이지와 동일하게 여행 이름, 날짜 범위, 기본 통화를 표시한다.
- 여행 row navigation은 기존 `/trips/{tripId}` route를 유지한다.
- F-015는 status badge, current-trip highlight, role, participant count, trip detail content를 추가하지 않는다.
- 모바일 앱은 기존 generated TypeScript client-backed `listMyTrips` helper를 계속 사용한다.
- 목록 조회 실패는 section-local error이며 profile/settings section을 숨기지 않는다.

## Acceptance Criteria

- [x] 마이페이지 `내 여행` 섹션은 기존 generated client-backed `GET /trips` 흐름을 계속 사용한다.
- [x] OpenAPI, API server, DB migration, sqlc query는 F-015 때문에 변경되지 않는다.
- [x] `내 여행` 목록 loading 중에는 현재 마이페이지와 동일하게 `내 여행` 섹션 안에 `내 여행을 불러오는 중...`이 표시된다.
- [x] 참여 여행이 없으면 기존 empty state와 `새 여행 만들기` CTA가 표시된다.
- [x] 목록 조회 실패 시 기존 inline error와 `다시 시도` CTA가 표시되고 profile/settings section은 유지된다.
- [x] `startDate <= today <= endDate`인 여행은 `진행 중인 여행` section에 표시된다.
- [x] `today < startDate`인 여행은 `예정된 여행` section에 표시된다.
- [x] `endDate < today`인 여행은 `지난 여행` section에 표시된다.
- [x] `startDate` 당일과 `endDate` 당일은 모두 `진행 중인 여행`으로 표시된다.
- [x] 각 여행은 정확히 하나의 status section에만 표시된다.
- [x] 비어 있는 status section은 렌더링되지 않는다.
- [x] status section은 `진행 중인 여행`, `예정된 여행`, `지난 여행` 순서로 표시된다.
- [x] 진행 중인 여행 section 내부는 `endDate ASC`, `startDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC` 순서다.
- [x] 예정된 여행 section 내부는 `startDate ASC`, `endDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC` 순서다.
- [x] 지난 여행 section 내부는 `endDate DESC`, `startDate DESC`, `joinedAt DESC`, `createdAt DESC`, `id DESC` 순서다.
- [x] 여행 row에는 기존 마이페이지와 동일하게 여행 이름, `YYYY.MM.DD ~ YYYY.MM.DD` 날짜 범위, 기본 통화가 표시된다.
- [x] 여행 row에는 role, participant count, status badge, current-trip badge가 표시되지 않는다.
- [x] 여행 row를 누르면 기존 `/trips/{tripId}` 상세 route로 이동한다.
- [x] 기존 `새 여행 만들기`, `계정 관리`, `로그아웃`, 하단 `홈`/`마이` 흐름이 깨지지 않는다.
- [x] status 분류/정렬 pure helper 단위 테스트가 코드로 남아 있고 `pnpm --filter @i-um/mobile test`에서 반복 실행된다.
- [x] `pnpm verify`가 모바일 단위 테스트를 포함해 회귀 테스트 게이트로 실행된다.
- [x] 모바일 typecheck가 통과한다.

## Implementation Plan

1. Spec approval 및 worktree 준비
   - 작업: 이 문서의 scope/out of scope를 검토하고 승인 후 `scripts/worktree-create F015 trip-status-sections`로 구현 worktree를 만든다.
   - Verify: worktree가 `.worktrees/F015-trip-status-sections`에 생성되고 branch가 feature 규칙을 따른다.

2. 현재 마이페이지 baseline 확인
   - 작업: 구현 branch가 기존 `GET /trips`, `listMyTrips`, 마이페이지 `내 여행` 목록, `/trips/{tripId}` row navigation, 기본 통화 표시를 포함하는지 확인한다.
   - Verify: `docs/features/0020-created-trip-in-mypage.md`, `apps/mobile/app/mypage.tsx`, `apps/mobile/lib/trips/client.ts`가 기존 동작을 포함한다.

3. Red: Status 분류/정렬 회귀 테스트 작성
   - 작업: `TripListItem` fixture와 고정된 `today`를 사용해 inclusive boundary, section order/hiding, section별 정렬 규칙을 검증하는 모바일 단위 테스트를 먼저 작성한다.
   - Verify: 구현 전 `pnpm --filter @i-um/mobile test`가 status helper 미구현으로 실패한다.

4. Green: Status 분류/정렬 로직 추가
   - 작업: `TripListItem`의 `startDate`, `endDate`, `joinedAt`, `createdAt`, `id`를 사용해 status별 grouped list를 만든다. 현재 날짜는 mobile local date의 `YYYY-MM-DD`로 만들고, date-only string 비교를 사용한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 통과한다.

5. My Page `내 여행` success state 변경
   - 작업: `state.status === 'ready' && state.trips.length > 0` 렌더링을 status section 기반으로 바꾸고 비어 있지 않은 section만 표시한다.
   - Verify: 진행 중/예정/지난 여행이 섞인 데이터에서 section order와 row order가 spec과 일치한다.

6. 기존 마이페이지 상태와 CTA 보존
   - 작업: loading/empty/error/retry, `새 여행 만들기`, row navigation, profile/settings/bottom menu 흐름을 변경하지 않는다.
   - Verify: empty user, API error, valid trip row tap, create CTA, account/logout manual smoke가 기존과 동일하게 동작한다.

7. 디자인 guardrail 확인
   - 작업: status section header는 기존 card/list 패턴과 theme token으로 구현한다. raw hex/임의 spacing/radius/emoji를 추가하지 않는다.
   - Verify: 변경된 screen code가 `theme` token을 사용하고 기존 마이페이지 visual hierarchy를 깨지 않는다.

8. Repository verification 통합
   - 작업: API/DB/generated 변경이 없음을 확인하고 모바일 단위 테스트, typecheck, root verify를 실행한다.
   - Verify: `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck`, `pnpm verify`가 통과한다. 환경 제약으로 전체 verify가 불가능하면 실패 이유와 대체 검증을 완료 보고에 기록한다.

9. Manual smoke verification
   - 작업: 가능하면 local/internal 환경의 실제 앱 화면에서 grouped list가 API 데이터와 연결되어 보이는지 확인한다.
   - Verify: 완료 보고에 실행 여부를 기록한다. 이 단계는 회귀 테스트 게이트를 대체하지 않는다.

## Regression Test Plan

코드로 남고 `pnpm verify`에서 반복 실행되는 회귀 테스트다. Manual smoke는 이 표의 대체물이 아니다.

| Behavior | Layer | Test File / Gate | Command |
|---|---|---|---|
| `startDate <= today <= endDate`는 진행 중으로 분류된다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| `today < startDate`는 예정으로 분류된다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| `endDate < today`는 지난 여행으로 분류된다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| 비어 있는 status section은 숨긴다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| section 순서는 진행 중 → 예정 → 지난 여행이다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| section별 정렬 규칙을 유지한다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| OpenAPI/API/DB/generated 산출물이 F-015 때문에 drift 되지 않는다 | Contract/API/DB regression | `pnpm verify:generated`, API test/build | `pnpm verify` |

## Regression Gaps

None. F-015의 변경된 behavior는 `apps/mobile/lib/trips/status.test.mts`와 `pnpm verify`에서 회귀 검증된다.

## Verification Plan

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

API/DB/OpenAPI 변경이 없는 feature지만, `pnpm verify`로 generated drift가 없고 기존 API/mobile checks와 모바일 단위 테스트가 깨지지 않는지 확인한다.

### Manual Smoke

아래 항목은 배포/기기/환경 연결 확인을 위한 smoke check다. 회귀 방지 품질 게이트는 위 Automated Regression 테스트가 담당하며, 이 수동 확인은 테스트 코드의 대체물이 아니다.

- [ ] local API에서 `AUTH_ALLOW_DEV_OAUTH=true`로 dev OAuth 로그인을 한다.
- [ ] 참여 여행이 없는 사용자로 마이페이지에 진입하면 기존 empty state가 표시되고 status section header가 보이지 않는다.
- [ ] local DB fixture 또는 pre-existing data로 오늘 기준 진행 중인 여행, 예정된 여행, 지난 여행을 준비한다.
- [ ] 마이페이지 `내 여행` 섹션에 `진행 중인 여행`, `예정된 여행`, `지난 여행`이 이 순서로 표시된다.
- [ ] 비어 있는 status section은 표시되지 않는다.
- [ ] 각 여행 row에는 여행 이름, 날짜 범위, 기본 통화가 표시되고 role/participant count/status badge/current-trip badge가 보이지 않는다.
- [ ] 여행 row를 누르면 기존 `/trips/{tripId}` 상세 화면으로 이동한다.
- [ ] 목록 API/network 오류 상황에서 inline error와 `다시 시도` CTA가 표시되고 profile/settings section은 유지된다.
- [ ] `새 여행 만들기`, `계정 관리`, `로그아웃`, 하단 `홈`/`마이` 흐름이 기존과 동일하게 동작한다.
- [ ] staging 또는 internal build에서 grouped list happy path를 확인한다.

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- `pnpm --filter @i-um/mobile test`: pass, 6 tests cover inclusive date boundaries, section order/hiding, ongoing/upcoming/past sort order, and local date formatting.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass, now includes `pnpm --filter @i-um/mobile test`.
- Manual smoke on simulator/emulator/physical device: not run in this environment. Not used as regression evidence.
- Staging/internal build smoke verification: not run in this implementation pass. Not used as regression evidence.

## Release Notes

```text
- 마이페이지 `내 여행` 목록을 진행 중인 여행, 예정된 여행, 지난 여행으로 나누어 보여준다.
- 여행 상태는 기존 여행 시작일/종료일을 기준으로 계산한다.
- 기존 여행 목록의 empty/error 상태와 상세 화면 이동 흐름은 유지한다.
```

## Open Questions

None for implementation after Ouroboros clarification.

Resolved by Ouroboros interview:

- F-015는 API status field를 추가하지 않고 mobile client에서 기존 `startDate`/`endDate`로 status를 계산한다.
- 오늘 기준은 모바일 기기의 local calendar date `YYYY-MM-DD`다.
- `startDate`와 `endDate` 당일은 모두 `진행 중`이다.
- 비어 있는 status section은 숨기고, 전체 목록이 비어 있으면 기존 empty state를 유지한다.
- section 순서는 `진행 중인 여행` → `예정된 여행` → `지난 여행`이다.
- section count, tab/filter/search, sticky/collapsible header, current-trip highlight, role/participant metadata는 F-015 범위가 아니다.

## Follow-up Issues

- #16: 현재 여행 바로가기
- #17: 여행 내 역할/참여자 수 표시
- #20: 여행 생성 후 마이페이지 반영
- #22: 여행 수정
- #23: 여행 삭제
- #40~#44: 동행자 초대/참여자 및 초대 후 마이페이지 반영
- TBD: trip timezone이 도입되면 status 계산 기준 재검토
