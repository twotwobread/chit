# Feature Slice: F-016 현재 여행 바로가기

## Metadata

- GitHub Issue: #16
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-22

## Ouroboros Source

- Interview Session: `interview_20260622_042919`
- Seed: `seed_edf50d171022`
- PM Document: N/A
- Notes: Ambiguity score `0.04`. Ouroboros clarified F-016 as a minimal mobile/UI-only enhancement on top of F-015: reuse the existing generated-client `GET /trips` result and F-015 client-side status rules, select one primary ongoing trip deterministically, render a shortcut card above the normal My Page trip sections, and do not change API/OpenAPI/DB behavior.

Context clarified before drafting:

- F-013 owns the authenticated `마이페이지` shell, profile/settings sections, and bottom menu.
- F-014/F-020 provide the generated-client-backed authenticated `GET /trips` list in `내 여행`.
- F-015 groups trips into `진행 중인 여행`, `예정된 여행`, `지난 여행` on the mobile client using the device/app local calendar date.
- F-016 should not introduce a server-side current-trip concept, new API field, DB migration, or new route.
- If multiple trips are ongoing today, the primary current trip uses the F-015 ongoing sort order: `endDate ASC`, `startDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC`.

## Goal

로그인한 사용자가 마이페이지에서 오늘 날짜 기준 진행 중인 여행이 있을 때, `내 여행` 섹션 상단의 강조 카드로 현재 여행을 빠르게 확인하고 기존 여행 상세 화면으로 바로 이동할 수 있다.

F-016은 현재 여행을 더 쉽게 찾게 하는 최소 UI slice다. 여행 목록 조회, 상태별 구분, 여행 상세 화면은 기존 기능을 재사용한다.

## Problem

- F-015 이후 마이페이지는 여행을 상태별로 구분하지만, 사용자가 지금 진행 중인 여행을 바로 눌러 들어가는 강조 진입점은 없다.
- 여행 실행 앱에서는 현재 진행 중인 여행이 예정/지난 여행보다 우선적으로 보여야 한다.
- 현재 여행 판단은 기존 여행 날짜 데이터만으로 충분하므로 API/DB를 확장하지 않고도 MVP 수준의 바로가기를 제공할 수 있다.

## User Flow

1. 사용자가 로그인한 상태로 하단 메뉴의 `마이`를 눌러 마이페이지를 연다.
2. 앱은 기존 흐름대로 프로필과 `GET /trips` 기반 내 여행 목록을 불러온다.
3. 여행 목록 조회가 성공하면 앱은 F-015와 같은 device/app local calendar date로 진행 중인 여행을 계산한다.
4. 오늘 진행 중인 여행이 1개 이상이면 앱은 `내 여행` 섹션의 상태별 목록 위에 `현재 진행 중인 여행` shortcut card를 표시한다.
5. 진행 중인 여행이 여러 개이면 앱은 F-015 ongoing 정렬 기준으로 첫 번째 여행을 shortcut의 primary current trip으로 선택한다.
6. 사용자가 shortcut card 또는 `여행 바로가기` CTA를 누른다.
7. 앱은 기존 `/trips/{tripId}` 여행 상세 화면으로 이동한다.
8. selected current trip은 아래 `진행 중인 여행` 섹션에도 그대로 남아 있어 기존 목록 탐색 흐름이 유지된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 마이페이지 `내 여행` 섹션 상단에 현재 진행 중인 여행 shortcut card 추가
- [ ] App UI: shortcut card는 trip name, date range, default currency, `여행 바로가기` CTA를 표시
- [ ] App UI: shortcut card/CTA tap 시 기존 `/trips/{tripId}` 상세 route로 이동
- [ ] App Logic: F-015 status/date rule을 재사용해 ongoing trips를 찾고 primary current trip을 결정
- [ ] App Logic: multiple ongoing trips의 deterministic selection rule 구현
- [ ] App UI: selected current trip을 기존 `진행 중인 여행` 섹션에서 제거하지 않고 intentional duplication 유지
- [ ] API Contract: 새 계약 없음. 기존 authenticated `GET /trips` 응답을 사용
- [ ] API Server: 새 서버 동작 없음
- [ ] DB: 새 migration/query 없음
- [ ] Tests: current trip selector/helper test, shortcut rendering/duplication test, navigation interaction test, no-contract-change regression gate
- [ ] Deployment: local/internal build에서 ongoing/no-ongoing/multiple-ongoing smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- API response에 `currentTrip`, `isCurrent`, `status`, `priority` 같은 필드 추가
- OpenAPI, Go API server, DB migration, sqlc query 변경
- server-side current trip 계산 또는 timezone-aware status model
- 현재 여행을 기존 `진행 중인 여행` 목록에서 제거하거나 별도 필터로 분리
- 진행 중인 여행이 없을 때 empty shortcut card 또는 fallback card 표시
- shortcut 전용 loading/skeleton/error/retry state
- `홈`, `마이` 외 navigation 구조 개편
- 오늘 실행 화면, 다음 장소, 일정 진행률, 장소 수, Day 정보 (#31~#35)
- 내 역할/참여자 수/Owner badge 표시 (#17)
- 초대/참여자 정보 (#40~#44)
- 정산/지출 요약 (#47~#59)
- 여행 수정/삭제 (#22, #23)
- 새로운 디자인 시스템 variant, 아이콘, 이모지, raw color/spacing 추가

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx` 또는 현재 마이페이지 route
  - 기존 header, profile summary, settings section, bottom menu는 유지한다.
  - `내 여행` 섹션의 loading/empty/error state는 기존 F-015 흐름을 유지한다.
  - `내 여행` success state에서만 shortcut card를 계산하고 렌더링한다.
  - shortcut card는 `내 여행` section title 아래, `진행 중인 여행`/`예정된 여행`/`지난 여행` status sections 위에 표시한다.

### Current Trip Shortcut Card

렌더링 조건:

- `state.status === 'ready'`
- `state.trips.length > 0`
- F-015 status rule로 계산한 ongoing trips가 1개 이상

표시하지 않는 조건:

- trip list loading/error 상태
- unauthenticated/login-required 상태
- 전체 trip list empty 상태
- trip은 있지만 ongoing trip이 0개인 상태

필수 표시 정보:

- Card title/label: `현재 진행 중인 여행`
- Trip name: `trip.name`
- Date range: existing mypage row와 같은 `YYYY.MM.DD ~ YYYY.MM.DD`
- Currency: existing mypage row와 같은 `기본 통화 <currency>`
- CTA text: `여행 바로가기`

Interaction:

- card 전체와 CTA는 button 역할로 동작한다.
- tap하면 기존 상세 route `/trips/{tripId}`로 이동한다.
- accessibility label은 최소한 여행명과 바로가기 의미를 포함한다. 예: `<trip.name> 여행 바로가기`.

### Current Trip Selection Rules

F-016의 current trip은 모바일에서 기존 date-only field로 계산한다.

- `today`: F-015와 동일하게 모바일 기기의 local calendar date를 `YYYY-MM-DD`로 만든 값
- `ongoing`: `startDate <= today <= endDate`
- `startDate` 당일은 current/ongoing이다.
- `endDate` 당일도 current/ongoing이다.
- 날짜 비교는 date-only string 기준으로 처리해 UTC 변환으로 인한 전날/다음날 밀림을 만들지 않는다.

Ongoing trip이 여러 개면 primary current trip은 다음 정렬의 첫 번째 항목이다.

```text
endDate ASC,
startDate ASC,
joinedAt DESC,
createdAt DESC,
id DESC
```

구현 시 같은 render cycle에서 `today`를 한 번 계산해 shortcut selection과 status grouping에 동일하게 주입한다.

### Existing List Preservation

- shortcut에 선택된 trip은 아래 `진행 중인 여행` section에 그대로 표시된다.
- 이 duplication은 의도된 동작이다.
- F-016은 기존 status section의 trip 구성, 순서, row 내용, row navigation을 변경하지 않는다.

### States

- Loading: 기존 `내 여행을 불러오는 중...` 상태를 그대로 사용한다. shortcut skeleton은 만들지 않는다.
- Empty: 전체 참여 여행이 없으면 기존 `아직 여행이 없어요.` empty state와 `새 여행 만들기` CTA를 그대로 사용한다.
- Error: 기존 `내 여행을 불러올 수 없어요.` inline error와 `다시 시도` CTA를 그대로 사용한다.
- Login required: 기존 F-013 login-required/session-clearing 흐름을 그대로 사용한다.
- Success with ongoing trips: shortcut card + 기존 status sections를 표시한다.
- Success without ongoing trips: shortcut card 없이 기존 status sections만 표시한다.

### Copy / Labels

- Shortcut title: `현재 진행 중인 여행`
- Shortcut CTA: `여행 바로가기`
- Date range: `<YYYY.MM.DD> ~ <YYYY.MM.DD>`
- Currency label: `기본 통화 <currency>`
- Accessibility label: `<trip.name> 여행 바로가기`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 기존 마이페이지 card/list-row 패턴, theme token, typography convention을 재사용한다.
- shortcut card의 차별점은 top placement와 current-trip copy다.
- raw hex color, 임의 spacing/radius, 이모지, 임의 unicode icon을 추가하지 않는다.
- 새 UI primitive는 이번 변경으로 반복 필요성이 명확해질 때만 최소 범위로 승격한다.

## API Contract

No new API changes.

F-016 uses the existing generated TypeScript client for:

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
      "joinedAt": "2026-06-22T10:00:00Z",
      "createdAt": "2026-06-22T10:00:00Z"
    }
  ]
}
```

F-016 does not add query parameters, response fields, or error formats.

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

### Tables

- No table changes.
- Existing `trips` and `trip_participants` data are read through existing `GET /trips` only.

### Constraints / Indexes

- No new constraints or indexes.

### Migration Notes

- Do not add a goose migration for F-016.
- Do not change sqlc queries or generated DB code for F-016.

## Business Rules

- F-016 only runs for authenticated users who can load My Page successfully.
- Current trip selection is client-side only.
- The app must use existing generated-client `GET /trips` data; it must not issue a new current-trip API call.
- The same local date string must drive both shortcut selection and F-015 status grouping in one render/load cycle.
- A trip is current when `startDate <= today <= endDate`.
- If there are zero current trips, no shortcut card is rendered.
- If there is one current trip, that trip is shown in the shortcut card.
- If there are multiple current trips, the primary current trip is selected by `endDate ASC`, `startDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC`.
- The selected current trip remains visible in the regular `진행 중인 여행` section.
- The shortcut card navigates to the existing trip detail route `/trips/{tripId}`.
- F-016 does not display role, participant count, itinerary summary, place count, execution status, expense total, or settlement summary.
- Existing My Page loading/error/empty/login-required behavior is unchanged.

## Acceptance Criteria

- [x] F-016 does not modify OpenAPI, API server behavior, DB migrations, sqlc queries, or generated API/DB artifacts.
- [x] 마이페이지 `내 여행` 섹션은 기존 generated-client-backed `GET /trips` 흐름을 계속 사용한다.
- [x] shortcut selection uses the same device/app local calendar date rule as F-015.
- [x] `startDate` 당일과 `endDate` 당일인 여행은 current/ongoing으로 간주된다.
- [x] 진행 중인 여행이 0개이면 shortcut card가 렌더링되지 않고 기존 status sections/list가 그대로 표시된다.
- [x] 진행 중인 여행이 1개이면 `내 여행` status sections 위에 shortcut card가 표시된다.
- [x] 진행 중인 여행이 여러 개이면 F-015 ongoing sort order로 primary current trip 1개가 결정된다.
- [x] shortcut card에는 `현재 진행 중인 여행`, 여행명, `YYYY.MM.DD ~ YYYY.MM.DD` 날짜 범위, `기본 통화 <currency>`, `여행 바로가기`가 표시된다.
- [x] shortcut card 전체 또는 CTA를 누르면 기존 `/trips/{tripId}` 상세 화면으로 이동한다.
- [x] shortcut에 선택된 trip은 아래 `진행 중인 여행` section에도 unchanged row로 표시된다.
- [x] 기존 status section 순서와 각 section 내부 정렬은 F-015와 동일하게 유지된다.
- [x] 전체 여행 목록이 비어 있으면 기존 empty state와 `새 여행 만들기` CTA만 표시되고 shortcut card는 표시되지 않는다.
- [x] trip list loading/error 상태와 login-required 상태는 기존 UI를 유지하며 shortcut 전용 loading/error/fallback UI를 만들지 않는다.
- [x] shortcut card는 기존 마이페이지 card/list-row style과 theme token을 사용하며 raw color/spacing/emoji를 추가하지 않는다.
- [x] current trip selector/helper regression test가 0개/1개/여러 개 ongoing trip과 inclusive date boundary를 검증한다.
- [x] rendering/state regression test가 shortcut 표시/비표시 model과 selected trip의 intentional duplication을 검증한다.
- [x] navigation target regression test가 card/CTA에 쓰이는 `/trips/{tripId}` route helper를 검증한다.
- [x] `pnpm --filter @i-um/mobile test`, `pnpm --filter @i-um/mobile typecheck`, `pnpm verify`가 통과한다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| `startDate <= today <= endDate`인 여행만 current shortcut 후보가 된다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| ongoing trip이 0개이면 primary current trip은 `null`이다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| ongoing trip이 1개이면 그 trip이 primary current trip이다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| multiple ongoing trips는 `endDate ASC`, `startDate ASC`, `joinedAt DESC`, `createdAt DESC`, `id DESC` 첫 번째 trip을 선택한다 | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| shortcut card는 success + ongoing trip 존재 시 status sections 위에 표시될 수 있는 model을 만든다 | Mobile state/presentation model | `apps/mobile/lib/trips/mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| ongoing trip이 없으면 shortcut model이 없고 기존 sections는 유지된다 | Mobile state/presentation model | `apps/mobile/lib/trips/mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| selected current trip은 shortcut model과 `진행 중인 여행` section에 모두 포함된다 | Mobile state/presentation model | `apps/mobile/lib/trips/mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| card/CTA가 사용하는 navigation target은 `/trips/{tripId}`다 | Mobile navigation helper | `apps/mobile/lib/trips/mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| API/OpenAPI/DB/generated artifacts do not change for F-016 | Contract/API/DB regression | generated drift + implementation diff review | `pnpm verify:generated` and `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts` |
| Existing API/mobile behavior is not broken | Repository regression | root verification gate | `pnpm verify` |

## Regression Gaps

- Full React Native component render/press simulation is not automated in F-016 because the current mobile test setup uses `node:test` + pure TypeScript helpers and does not include a React Native renderer/Jest transform.
  - Covered instead: current-trip selector, My Page trip-section presentation model, intentional duplication, and route helper are tested in `apps/mobile/lib/trips/status.test.mts` and `apps/mobile/lib/trips/mypage.test.mts`; TypeScript verifies the `Pressable` wiring compiles.
  - Risk: a future edit could remove or reorder the actual JSX shortcut card/onPress while preserving the helper tests.
  - Follow-up: introduce mobile component testing infrastructure when another UI interaction requires renderer-level regression coverage.

## TDD Implementation Plan

1. Red: current trip selector/helper regression tests 작성
   - 작업: `apps/mobile/lib/trips/status.test.mts`에 `selectCurrentTrip` 또는 동등 helper의 0개/1개/여러 개 ongoing, inclusive date boundary, deterministic sort 테스트를 추가한다.
   - Verify: helper 미구현 상태에서 `pnpm --filter @i-um/mobile test`가 기대한 이유로 실패한다.

2. Green: current trip selection helper 최소 구현
   - 작업: `apps/mobile/lib/trips/status.ts`에 F-015 date/status/sort rule을 재사용하는 `selectCurrentTrip(trips, today = localDateString())` 또는 동등 helper를 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 selector/helper 테스트를 통과한다.

3. Red: shortcut presentation model/navigation target tests 작성
   - 작업: 마이페이지 `내 여행` success state를 대상으로 shortcut 표시/비표시 model, intentional duplication, card/CTA route target 테스트를 작성한다.
   - Note: 기존 test script가 단일 파일만 실행한다면 `@i-um/mobile test`가 새 테스트를 포함하도록 최소 수정한다.
   - Verify: model/helper 미구현 상태에서 `pnpm --filter @i-um/mobile test`가 기대한 이유로 실패한다.

4. Green: 마이페이지 shortcut card 최소 구현
   - 작업: `apps/mobile/app/mypage.tsx`에서 trip list success state의 `today`를 한 번 계산하고, selector와 `groupTripsByStatus`에 같은 값을 주입한다.
   - 작업: current trip이 있으면 `내 여행` section title 아래/status sections 위에 shortcut card를 추가한다.
   - 작업: card/CTA press가 기존 `/trips/{tripId}` route로 이동하게 한다.
   - Verify: `pnpm --filter @i-um/mobile test`와 `pnpm --filter @i-um/mobile typecheck`가 통과한다.

5. Refactor: 기존 list rendering 보존 및 중복 최소화
   - 작업: 필요한 경우 기존 trip row/date formatting을 shortcut과 공유 가능한 최소 helper로 정리한다. 단, 범위를 벗어난 UI primitive/디자인 시스템 확장은 하지 않는다.
   - Verify: selector/presentation/navigation helper 테스트를 재실행하고 기존 F-015 status tests가 그대로 통과한다.

6. No-contract-change regression gate
   - 작업: API/OpenAPI/DB/generated files가 F-016 때문에 변경되지 않았는지 확인한다.
   - Verify: `pnpm verify:generated` and `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`.

7. Full regression gate
   - Verify: `pnpm verify`.

## Verification Plan

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify:generated
git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts
pnpm verify
```

API/DB/OpenAPI 변경이 없는 feature지만, `pnpm verify`로 generated drift가 없고 기존 API/mobile checks가 깨지지 않는지 확인한다.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] local API에서 `AUTH_ALLOW_DEV_OAUTH=true`로 dev OAuth 로그인을 한다.
- [ ] 오늘 기준 진행 중인 여행이 없는 사용자로 마이페이지에 진입하면 shortcut card가 보이지 않고 기존 status sections/empty state가 유지된다.
- [ ] 오늘 기준 진행 중인 여행이 1개 있는 사용자로 마이페이지에 진입하면 `내 여행` section 상단에 `현재 진행 중인 여행` card가 보인다.
- [ ] shortcut card에 여행명, 날짜 범위, 기본 통화, `여행 바로가기`가 표시된다.
- [ ] shortcut card의 여행이 아래 `진행 중인 여행` section에도 그대로 표시된다.
- [ ] 오늘 기준 진행 중인 여행이 여러 개 있으면 정렬 기준상 primary trip이 shortcut에 표시된다.
- [ ] shortcut card 또는 CTA를 누르면 기존 여행 상세 화면으로 이동한다.
- [ ] loading/error/login-required 상태에서 shortcut 전용 skeleton/error/fallback UI가 보이지 않는다.
- [ ] staging 또는 internal build에서 ongoing trip happy path를 확인한다.

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- Red check: `pnpm --filter @i-um/mobile test` failed as expected before helper/model implementation because `selectCurrentTrip` and `lib/trips/mypage.ts` were missing.
- `pnpm --filter @i-um/mobile test`: pass, 13 node:test cases cover F-015 status behavior, current trip selection, My Page shortcut presentation model, intentional duplication, and route helper.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`: pass, no API/OpenAPI/DB/generated changes.
- `pnpm verify`: pass.
- Manual simulator/device smoke: not run in this environment. Not used as regression evidence.
- Staging/internal build smoke: not run in this implementation pass. Not used as regression evidence.

## Release Notes

```text
- 마이페이지에서 오늘 진행 중인 여행이 있을 때 `현재 진행 중인 여행` 바로가기 card를 표시한다.
- 바로가기 card를 눌러 기존 여행 상세 화면으로 이동할 수 있다.
- 현재 여행 판단은 기존 여행 시작일/종료일과 F-015 상태 계산 규칙을 재사용한다.
```

## Open Questions

None for implementation after Ouroboros clarification.

Spec approved for implementation by user request on 2026-06-22.

## Follow-up Issues

- #17: 여행 내 역할/참여자 수 표시
- #21: 여행 상세 기본 화면
- #22: 여행 수정
- #23: 여행 삭제
- #31~#35: 오늘 실행 화면과 다음 장소 흐름
- #40~#44: 참여자/초대 및 초대 후 마이페이지 반영
- #59: 마이페이지 내 정산 요약
- TBD: mobile component testing infrastructure for renderer-level UI interaction regression
