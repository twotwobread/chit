# Feature Slice: F-024 여행 기간 기반 Day 생성

## Metadata

- GitHub Issue: #24
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260622_132642`
- Seed: `seed_b0dcba0b62f6`
- PM Document: N/A
- Notes: Ambiguity score `0.09`. Ouroboros initially clarified that F-024 should expose ordered Day structure on `GET /trips/{tripId}` and render it on the existing trip detail screen. During implementation review, the product decision changed from persistent `trip_days` rows to virtual Day calculation because no near-term business behavior attaches directly to Day as an entity. F-024 now derives `days[]` from `trip.startDate` and `trip.endDate` at detail-read time. Separate day endpoints, persistent day rows, places, itinerary items, trip timezone/locale, and create/update response shape changes are out of scope.

## Goal

사용자가 여행 상세 화면에서 여행 기간에 맞춰 계산된 `Day 1`, `Day 2` 구조를 확인할 수 있다.

F-024는 여행의 `startDate`부터 `endDate`까지 날짜별 일정 컨테이너를 보여주는 최소 vertical slice다. Day는 이 slice에서 DB row가 아니라 `Trip`의 날짜 범위에서 계산되는 가상 구조다. 장소 추가, 일정 항목, 지도, 오늘 실행 화면은 후속 기능에서 다룬다.

## Problem

- 현재 여행은 시작일/종료일만 보여주며 날짜별 일정 구조가 없다.
- 이후 장소 추가와 일정 관리는 날짜별로 묶여야 하므로 사용자가 상세 화면에서 먼저 Day 구조를 볼 수 있어야 한다.
- Day 자체에 메모/정산/지출 같은 직접 속성을 붙이는 요구는 아직 없으므로, F-024에서 persistent `trip_days` table을 만들면 기간 수정마다 불필요한 row churn이 생긴다.

## User Flow

1. 사용자가 로그인된 상태에서 새 여행을 만든다.
2. 서버는 기존처럼 `trips`와 Owner `trip_participants`를 생성한다. `trip_days` row는 만들지 않는다.
3. 사용자가 `/trips/{tripId}` 상세 화면을 연다.
4. 앱은 generated client로 `GET /trips/{tripId}`를 호출한다.
5. 서버는 기존 participant authorization을 통과한 뒤 여행 기본 정보, 참여자 요약, 그리고 `trip.startDate`~`trip.endDate`에서 계산한 날짜순 `days[]`를 반환한다.
6. 앱은 상세 화면에 `여행 일정` 섹션을 표시하고 `Day 1`, `Day 2` 등 날짜별 구조를 보여준다.
7. Owner가 여행 기간을 수정하면 기존 `/trips/{tripId}/edit` 흐름으로 저장한다.
8. 앱은 저장 성공 후 상세 화면으로 돌아가고 focus/refetch를 통해 새 날짜 범위에서 계산된 Day 목록을 바로 보여준다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: 기존 `/trips/{tripId}` 상세 화면에 날짜별 `여행 일정` / `Day N` 섹션 추가
- [x] API Contract: 인증된 `GET /trips/{tripId}` response에 required ordered virtual `days[]` 추가, `TripDay` schema 정의
- [x] API Server: trip detail 조회 시 `startDate`~`endDate` inclusive date range로 virtual Day list 계산
- [x] DB: No DB changes
- [x] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type 갱신
- [x] Tests: API detail/update behavior, mobile day view-model/formatting test
- [ ] Deployment: local/staging 또는 internal build에서 create → detail, edit dates → detail day update smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- persistent `trip_days` table, migration, row 생성/삭제/동기화
- 별도 `GET /trips/{tripId}/days` endpoint 또는 day CRUD endpoint
- `POST /trips` response나 `PATCH /trips/{tripId}` response에 `days[]` 추가
- 사용자가 Day를 수동으로 추가, 삭제, 이름 변경, 순서 변경하는 기능
- Day별 장소 추가, 장소 목록, itinerary item, 도착/스킵 상태, 오늘 실행 화면
- Google Maps, 경로/거리/이동 시간 표시
- trip timezone/locale 설정 또는 device timezone 기반 날짜 변환
- 여행 기간의 최대 일수 제한 추가. 기존 trip validation은 유지한다
- Day 자체에 메모/상태/숙소/정산/지출 속성을 저장하는 기능
- offline cache, optimistic day update, manual pull-to-refresh

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/index.tsx`
  - 기존 여행 상세 화면의 success state에 `여행 일정` 섹션을 추가한다.
  - 기존 여행 이름, 기간, 기본 통화, 참여자 요약, 수정/삭제 액션은 유지한다.
  - `days[]`는 generated TypeScript type을 사용해 렌더링한다.
  - create success의 `여행 상세 보기`, mypage trip card, edit success 후 상세 재진입 모두 같은 detail screen을 사용한다.

### Detail Day Content

각 Day row/card는 최소한 다음 정보를 표시한다.

- Day label: `Day <dayOrder>`
- Date: `YYYY.MM.DD` 형식으로 표시한 `TripDay.date`

표시하지 않는다.

- 장소 개수
- 장소 추가 CTA
- 일정 진행률
- 도착/스킵 상태
- 지도/경로 요약

### States

- Loading: 기존 `여행 정보를 불러오는 중...` state를 그대로 사용한다. Day skeleton을 별도로 만들지 않는다.
- Empty: 정상 trip은 `startDate <= endDate`이므로 `days[]`가 최소 1개여야 한다. 별도 empty state는 만들지 않는다.
- Error: 기존 detail screen의 `401`, `400/403/404`, network/unknown error state를 그대로 사용한다.
- Success: 여행 기본 정보 아래 또는 인접한 위치에 날짜순 Day list를 표시한다.
- Date edit success: 기존 edit screen이 `/trips/{tripId}`로 돌아간 뒤 detail focus/refetch로 갱신된 Day list를 보여준다. 수동 refresh나 앱 재시작이 필요하면 안 된다.

### Copy / Labels

- Section title: `여행 일정`
- Section helper: `여행 기간에 맞춰 날짜별 일정이 준비됐어요.`
- Day label: `Day <dayOrder>`
- Date label: `<YYYY.MM.DD>`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 trip detail card/list 패턴과 맞춰 warm off-white background, white card, subtle border/shadow를 유지한다.
- Day label/date formatting은 screen code에 흩어지지 않게 mobile helper/view-model로 분리한다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
GET /trips/{tripId}
```

Existing authenticated endpoint. F-024는 이 endpoint의 response에 required ordered virtual `days[]`를 추가한다.

F-024에서는 별도 day-list endpoint를 추가하지 않는다.

### Request

No request body.

Path parameter는 기존과 동일하다.

```text
tripId: string
```

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
    "updatedAt": "2026-06-22T09:00:00Z"
  },
  "participantSummary": {
    "totalCount": 2,
    "previewNames": ["민수", "지영"],
    "overflowCount": 0
  },
  "days": [
    {
      "date": "2026-07-10",
      "dayOrder": 1
    },
    {
      "date": "2026-07-11",
      "dayOrder": 2
    }
  ]
}
```

### Schema Notes

`TripDay` schema:

```yaml
TripDay:
  type: object
  required:
    - date
    - dayOrder
  properties:
    date:
      type: string
      format: date
    dayOrder:
      type: integer
      minimum: 1
```

`GetTripDetailResponse` adds required `days`:

```yaml
days:
  type: array
  items:
    $ref: '#/components/schemas/TripDay'
```

Response rules:

- `days.length` equals inclusive date count from `trip.startDate` through `trip.endDate`.
- `days` is ordered by ascending date / `dayOrder`.
- `dayOrder` is 1-based and equals the date offset from current `trip.startDate` plus 1.
- `date` is returned as date-only `YYYY-MM-DD`. Mobile must not timezone-convert it.
- Virtual Day has no `id` and no `tripId`; callers identify a Day by the enclosing `tripId` plus `date` if needed.
- `POST /trips` and `PATCH /trips/{tripId}` response shapes remain unchanged in F-024.

### Errors

No new error codes.

Existing `GET /trips/{tripId}` errors remain unchanged and follow the common error format.

- `400 VALIDATION_ERROR`: invalid `tripId`
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant
- `404 NOT_FOUND`: trip does not exist
- `500 INTERNAL_ERROR`: unexpected server/data error

## DB Changes

No DB changes.

F-024 intentionally does not create a `trip_days` table. Day rows are not inserted, deleted, or synchronized on trip create/update/delete. The Day list is computed from existing `trips.start_date` and `trips.end_date` at detail-read time.

Future itinerary work can attach schedule data directly to `trip_id + scheduled_date` or introduce a persistent Day table later if Day itself gains business-owned fields. That decision is out of scope for F-024.

## Business Rules

- A valid trip exposes exactly one virtual Day per calendar date from `trip.startDate` through `trip.endDate`, inclusive.
- A one-day trip exposes exactly one virtual Day with `dayOrder = 1`.
- Date values are source-of-truth date-only values (`YYYY-MM-DD` / PostgreSQL `date`), not instants.
- Server date arithmetic expands ranges. Mobile must render returned strings directly and avoid timezone-shifting `Date` construction.
- Trip creation does not create Day rows.
- Trip date update does not create or delete Day rows.
- Name-only or currency-only trip updates naturally leave virtual Day output unchanged because the trip date range is unchanged.
- When the trip start date changes, virtual `dayOrder` is recalculated from the new start date on the next detail response.
- Only authenticated trip participants can see `days[]`, through the existing detail authorization rule.
- Users cannot manually edit Day entries in F-024.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 `AC-*` 행 또는 `Regression Gaps`와 연결한다.

- [x] AC-01: `docs/features/0024-trip-day-generation.md`에 feature spec + implementation plan이 작성되어 있고 Ouroboros source와 가상 Day 결정이 기록되어 있다.
- [x] AC-02: `packages/api-contract/openapi.yaml`의 `GetTripDetailResponse`에 required ordered `days[]`가 추가되고 virtual `TripDay` schema가 정의되어 있다.
- [x] AC-03: generated Go server artifact와 TypeScript client/type이 `days[]`와 virtual `TripDay`를 포함하도록 갱신되어 있다.
- [x] AC-04: F-024는 `trip_days` table 또는 DB migration을 추가하지 않는다.
- [x] AC-05: 새 여행 생성은 Day row를 만들지 않고, detail response에서 날짜 범위 기반 virtual `days[]`를 반환한다.
- [x] AC-06: 1일 여행은 Day 1 하나만 반환하고, N일 여행은 `dayOrder` 1..N의 virtual Day entries를 반환한다.
- [x] AC-07: authenticated participant의 `GET /trips/{tripId}`는 `days[]`를 날짜/`dayOrder` 오름차순으로 반환한다.
- [x] AC-08: `days[]`의 각 항목은 `date`, `dayOrder`를 포함하며 `id`, `tripId`를 포함하지 않는다.
- [x] AC-09: Owner가 여행 기간을 확장하면 저장 후 상세 화면에서 추가된 virtual Day entries가 바로 보인다.
- [x] AC-10: Owner가 여행 기간을 단축하거나 시작일을 변경하면 저장 후 상세 화면에서 새 기간에 해당하는 virtual Day entries와 재계산된 `dayOrder`가 보인다.
- [x] AC-11: Owner가 이름 또는 기본 통화만 수정하면 기존 날짜 범위의 virtual Day output은 변경되지 않는다.
- [x] AC-12: 여행 삭제는 Day row cleanup이 필요 없다. Persistent Day row가 없기 때문이다.
- [x] AC-13: 모바일 여행 상세 화면은 `여행 일정` 섹션에서 `Day N`과 날짜를 렌더링한다.
- [x] AC-14: 모바일 날짜 표시 로직은 timezone 변환 없이 `YYYY-MM-DD` 문자열을 `YYYY.MM.DD`로 포맷한다.
- [x] AC-15: Date edit 성공 후 사용자가 수동 refresh나 앱 재시작을 하지 않아도 detail refetch를 통해 갱신된 Day list를 볼 수 있다.
- [x] AC-16: F-024는 별도 day endpoint를 추가하지 않고, `POST /trips`와 `PATCH /trips/{tripId}` response shape에 `days[]`를 추가하지 않는다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02, AC-03: OpenAPI `GetTripDetailResponse.days[]`와 virtual `TripDay` generated drift 없음 | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-04, AC-16: 별도 day table/endpoint가 없고 create/update response schema에 `days[]`가 추가되지 않음 | Contract/DB | OpenAPI/schema/sqlc generated drift | `pnpm verify:generated` |
| AC-05, AC-06, AC-07, AC-08: detail response returns ordered virtual `days[]` only for authorized participants | API service/handler | `apps/api/internal/trip/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-09, AC-10: owner date update changes virtual detail days through updated trip date range | API service/handler | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| AC-11: name/currency-only update preserves date range and therefore virtual Day output | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-12: trip deletion still cascades participants and needs no Day cleanup | DB / repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-13, AC-14: mobile formats `YYYY-MM-DD` as `YYYY.MM.DD` and builds `Day N` labels without Date timezone conversion | Mobile logic | `apps/mobile/lib/trips/days.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-13: trip detail consumes generated `days[]` type and renders success state | Mobile type/UI state | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| AC-09, AC-10, AC-15: updated detail data is available immediately after edit through API date update; native navigation/focus smoke is listed as a gap below | API + Mobile smoke | API tests + Manual Smoke | `pnpm --filter @i-um/api test` |
| AC-01 through AC-16: Full regression suite remains green | All | verify gate | `pnpm verify` |

## Regression Gaps

- AC-15 native navigation/focus refetch sequence: the current mobile test setup does not include a React Native component/e2e harness that can assert `PATCH success → router.replace('/trips/{tripId}') → useFocusEffect refetch → rendered updated days` end to end.
  - Automated coverage retained: API tests prove date edits change subsequent detail `days[]`; mobile type/helper tests prove detail can consume and format returned days.
  - Risk: a future navigation/focus regression could require manual smoke or internal build testing to detect.
  - Follow-up: add a mobile component/e2e test harness before relying on complex navigation state as a regression gate.

## TDD Implementation Plan

1. Red: API tests for virtual Day invariants
   - Add failing tests for detail ordered `days[]`, one-day/N-day virtual output, and owner date update extend/shorten/reorder behavior.
   - Verify: `pnpm --filter @i-um/api test` fails before implementation.
2. Red: Mobile day view-model/formatting tests
   - Add failing `apps/mobile/lib/trips/days.test.mts` for `Day N` labels and `YYYY-MM-DD` → `YYYY.MM.DD` string formatting without `Date` construction.
   - Verify: `pnpm --filter @i-um/mobile test` fails before implementation.
3. Contract: Extend OpenAPI first
   - Add virtual `TripDay` schema and required `days[]` to `GetTripDetailResponse`.
   - Regenerate Go/TS artifacts with `pnpm generate`.
   - Verify: `pnpm verify:generated` passes after generated files are committed.
4. Green: API server minimum implementation
   - Add service-level date range expansion from `Trip.StartDate` through `Trip.EndDate`.
   - Update detail result types and server response mapping to include ordered virtual `days[]`.
   - Preserve existing auth, validation, not-found/forbidden response behavior.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
5. Green: Mobile detail UI
   - Add a small day formatting/view-model helper.
   - Render `여행 일정` section from generated `detail.days` on `/trips/{tripId}`.
   - Rely on existing edit success navigation/focus refetch for immediate updated days.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
6. Refactor: Remove duplication introduced by the change only
   - Keep UI patterns consistent with existing detail screen and theme tokens.
   - Verify: rerun changed-layer tests.
7. Regression gate
   - Verify: `pnpm verify` passes.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Expo Go/local API에서 3일짜리 여행 생성 후 상세 화면에 `Day 1`, `Day 2`, `Day 3`가 보이는지 확인한다.
- [ ] Owner가 여행 기간을 4일로 늘린 뒤 저장하면 상세 화면에 `Day 4`가 수동 refresh 없이 보이는지 확인한다.
- [ ] Owner가 여행 기간을 2일로 줄인 뒤 저장하면 상세 화면에 `Day 1`, `Day 2`만 남고 날짜가 맞는지 확인한다.
- [ ] staging 또는 internal build에서 create → detail day list → edit dates → updated day list happy path를 확인한다.

## Release Notes

```text
- 여행 기간에 맞춰 Day 1, Day 2 등 날짜별 일정 구조가 자동으로 표시됩니다.
- 여행 날짜를 수정하면 상세 화면의 날짜별 일정 구조가 함께 갱신됩니다.
```

## Open Questions

- None for F-024 readiness. Deferred decisions below are explicitly out of scope and should not block implementation of this slice.

## Follow-up Issues

- TBD: Day별 장소 추가와 itinerary item 목록 표시. 이때 일정 데이터를 `trip_id + scheduled_date`로 둘지, persistent Day table을 도입할지 다시 결정한다.
- TBD: 오늘 실행 화면, 도착/스킵 상태, Google Maps 길찾기 연결.
- TBD: Day 자체에 메모/상태/숙소 같은 비즈니스 필드가 필요해지는지 검증한다.
