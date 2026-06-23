# Feature Slice: F-031 오늘 실행 화면 기본

## Metadata

- GitHub Issue: #31
- Status: Code Review
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260623_141809`
- Seed: `seed_b685e85d1c51`
- PM Document: N/A
- Notes: Ambiguity score `0.08` / seed metadata `0.076`. Ouroboros clarified F-031 as a strictly read-only Today screen slice that reuses existing generated trip list/detail and Day itinerary APIs. It must not introduce a new execution status model, DB migration, or next-place endpoint. The current date is device/app local date and must be injectable for tests. The selected current trip follows existing My Page ongoing-trip selection semantics. The next place is the first ordered item in today’s Day itinerary until later progress/status features exist.

## Goal

로그인한 사용자가 앱의 Today/Home surface에서 오늘 날짜 기준 진행 중인 여행의 현재 Day와 다음 장소를 바로 확인할 수 있다.

F-031은 여행 실행 화면의 첫 read-only slice다. 사용자는 다음 목적지를 확인하고 기존 Day 일정 화면으로 이동할 수 있지만, 도착/스킵/길찾기/숙소 이동/지출 등록은 후속 feature에서 다룬다.

## Problem

- 현재 홈 화면은 로그인 후 새 여행 만들기 정도만 제공하고, 여행 중 사용자가 “오늘 어디로 가야 하는지”를 바로 보여주지 않는다.
- 이미 Trip/Day/Itinerary 데이터는 존재하지만 Today 실행 맥락으로 조합해 보여주는 화면이 없다.
- 아직 실행 상태(`arrived`, `skipped`), optional time, 지도/길찾기, 숙소 이동 기능이 없으므로 F-031에서는 기존 순서 기반 itinerary만으로 안전한 최소 Today 화면을 만들어야 한다.
- #30 Day lodging, #40 참여자 목록이 병렬 진행 중이므로 F-031은 해당 변경에 의존하지 않고 독립적으로 동작해야 한다.

## User Flow

1. 사용자가 로그인된 상태로 앱의 기존 root route `/`에 진입한다.
2. 앱은 device/app local date를 `YYYY-MM-DD`로 한 번 계산하고 Today load에 주입한다.
3. 앱은 기존 generated client로 사용자의 여행 목록을 불러온다.
4. 앱은 오늘 진행 중인 여행을 기존 My Page selection rule로 결정한다.
5. 오늘 진행 중인 여행이 없으면 앱은 Today empty state를 보여주고 `내 여행 보기`, `새 여행 만들기` action을 제공한다.
6. 진행 중인 여행이 있으면 앱은 해당 여행 상세를 불러와 오늘 날짜와 일치하는 TripDay를 찾는다.
7. 오늘 TripDay를 찾으면 앱은 기존 Day itinerary endpoint로 오늘 일정 items를 불러온다.
8. 오늘 일정에 장소가 있으면 앱은 첫 ordered itinerary item을 `다음 장소` card로 보여준다.
9. 사용자가 `오늘 일정 보기`를 누르면 기존 Day itinerary screen `/trips/{tripId}/days/{date}`로 이동한다.
10. 오늘 일정에 장소가 없으면 앱은 current Day context와 empty state를 보여주고 같은 Day itinerary screen으로 이동하는 action을 제공한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 기존 root route `/` / `apps/mobile/app/index.tsx`의 authenticated home content를 Today execution basic screen으로 대체
- [ ] App UI: BottomMenu의 기존 `home` tab entrypoint를 Today surface로 사용하고 사용자-facing label은 `오늘`로 맞춤
- [ ] App UI: Today loading, auth-required, no-ongoing-trip, empty-itinerary, success, unavailable/error states
- [ ] App UI: success state에서 trip title, current Day label/date, next place card, Day itinerary CTA 표시
- [ ] App Logic: device/app local date를 주입 가능한 `today` 값으로 계산하고 helper/state builder에 전달
- [ ] App Logic: 기존 `selectCurrentTrip` / status helper semantics로 deterministic current trip 선택
- [ ] App Logic: selected trip detail의 `days[]`에서 `date === today`인 TripDay 매칭
- [ ] App Logic: `GET /trips/{tripId}/days/{date}/itinerary` 결과의 first ordered item을 next place로 표시
- [ ] App Logic: focus/refetch 시 최신 trip/day/itinerary를 다시 불러와 Day itinerary에서 돌아왔을 때 Today가 갱신되도록 함
- [ ] API Contract: 새 계약 없음. 기존 generated TypeScript client의 `GET /trips`, `GET /trips/{tripId}`, `GET /trips/{tripId}/days/{date}/itinerary` 사용
- [ ] API Server: 새 handler/service/repository 동작 없음
- [ ] DB: 새 migration/table/query 없음
- [ ] Tests: current-date injection, current-trip selection reuse, Today view model/state, next-place derivation, routes/actions, error mapping regression tests
- [ ] Deployment: local/staging 또는 internal build에서 no-ongoing, empty-itinerary, next-place happy path smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 새 OpenAPI endpoint 또는 server-side `today`, `currentTrip`, `nextPlace` 계산
- DB migration, `itinerary_items` status/time column 추가, `trip_days` physical table 추가
- 도착 처리, 스킵 처리, progress/current item persistence (#33, #34)
- 남은 장소 목록 전체 표시 (#32)
- 숙소로 이동 버튼 또는 lodging target 기반 navigation (#35, #30)
- Google Maps URL 생성, 지도 열기, 길찾기, 이동 모드 선택 (#36~#39)
- 시간 선택 가능한 일정 항목/30분 타임라인/current time window 계산 (#95)
- 빠른 지출 등록, 오늘 지출 요약, 정산 요약 (#47~#59)
- 여러 진행 중인 여행을 Today 화면에서 전환하는 trip switcher
- 참여자 목록/초대/역할 표시 (#40~#45)
- memo/category/business hours/좌표/거리/예상 이동 시간 표시. 현재 OpenAPI 응답에 없는 데이터는 표시하지 않는다.
- #30이 먼저 merge되어 `TripDay.lodgingPlace` 또는 `DayItineraryItem.isLodging`이 생기더라도 F-031의 next-place 계산은 lodging을 특별 취급하지 않는다.
- 미구현 action(`길찾기`, `도착`, `스킵`, `숙소로`, `+ 지출`)을 disabled 버튼으로 노출하지 않는다.

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`
  - 기존 logged-in home card를 Today execution basic content로 대체한다.
  - route는 기존 `/`를 유지한다.
  - 화면 title은 `오늘`을 사용한다.
  - 기존 session/auth recovery style을 재사용한다.
  - authenticated state에서 `BottomMenu selected="home"`를 유지하되, bottom tab label은 `오늘`로 표시한다.

- `apps/mobile/lib/navigation/BottomMenu.tsx`
  - 내부 tab key는 `home` 그대로 둔다.
  - 사용자-facing label은 `홈` 대신 `오늘`로 변경한다.
  - F-031에서는 `지도`, `일정`, `정산` tab을 새로 추가하지 않는다.

- `apps/mobile/lib/trips/today-execution.ts` 또는 동등 helper
  - Today state/view model을 pure helper로 분리해 Expo/React Native 없이 테스트한다.
  - helper는 `today` string을 인자로 받아 테스트에서 날짜를 고정할 수 있어야 한다.

### Success State

오늘 진행 중인 여행과 오늘 일정 item이 존재할 때 표시한다.

필수 표시 정보:

- Screen title: `오늘`
- Trip title: `trip.name`
- Day label/date: `Day <dayOrder>` + `YYYY.MM.DD`
- Next place overline/title: `다음 장소`
- Next place name: first ordered `DayItineraryItem.place.name`
- Place type label: existing `theme.placeType[placeType].label` / `getPlaceTypeLabel` 재사용
- Address: `DayItineraryItem.place.address`
- Primary CTA: `오늘 일정 보기`
- Multiple ongoing trip secondary copy/action: 진행 중인 여행이 여러 개면 `다른 진행 중인 여행은 내 여행에서 볼 수 있어요.`와 `내 여행 보기` secondary action을 표시한다.

Interaction:

- `오늘 일정 보기`는 기존 `buildDayItineraryRoute(tripId, day.date)` / `/trips/{tripId}/days/{date}`로 이동한다.
- `내 여행 보기`는 `/mypage`로 이동한다.

### Empty / Error States

- Loading
  - Copy: `오늘 일정을 불러오는 중...`
  - Full Today card/state로 표시한다.

- Login required / auth recovery
  - 기존 Home/MyPage auth recovery pattern을 재사용한다.
  - Missing/corrupt session 또는 `401`은 login screen으로 이어지는 상태를 보여준다.
  - Copy: `다시 로그인해주세요.` 또는 기존 copy 재사용.

- No ongoing trip
  - 조건: authenticated trip list는 성공했지만 `startDate <= today <= endDate`인 trip이 없다.
  - Title: `오늘 진행 중인 여행이 없어요.`
  - Helper: `내 여행에서 예정된 여행을 확인하거나 새 여행을 만들어보세요.`
  - Primary action: `내 여행 보기` → `/mypage`
  - Secondary action: `새 여행 만들기` → `/trips/new`

- Empty itinerary
  - 조건: selected ongoing trip과 current Day는 있지만 today itinerary items가 비어 있다.
  - Day context(`trip.name`, `Day <dayOrder>`, date)는 유지한다.
  - Title: `오늘 일정에 아직 장소가 없어요.`
  - Helper: `오늘 일정 화면에서 첫 장소를 추가해보세요.`
  - Primary action: `오늘 일정 열기` → `/trips/{tripId}/days/{date}`

- Missing current Day invariant
  - 조건: selected ongoing trip이 있지만 `GET /trips/{tripId}`의 `days[]`에 `date === today`가 없다.
  - Product empty가 아니라 safe unavailable state로 처리한다.
  - Title: `오늘 일정을 찾을 수 없어요.`
  - Helper: `여행 정보가 바뀌었을 수 있어요. 다시 시도하거나 여행 상세를 확인해주세요.`
  - Primary action: `다시 시도`
  - Secondary action: `여행 상세로` → `/trips/{tripId}`

- Trip list/detail fetch failure
  - Retryable full Today error state.
  - Title: `오늘 일정을 불러올 수 없어요.`
  - Helper: `잠시 후 다시 시도해주세요.`
  - Primary action: `다시 시도`

- Day itinerary fetch failure
  - Retryable Today error for selected trip/day.
  - Title: `오늘 일정을 불러올 수 없어요.`
  - Helper: `잠시 후 다시 시도하거나 여행 상세를 확인해주세요.`
  - Primary action: `다시 시도`
  - Secondary action: `여행 상세로` → `/trips/{tripId}`

- `403` / `404` from trip detail or day itinerary
  - Crash하지 않고 safe unavailable state를 보여준다.
  - Copy는 `오늘 일정을 찾을 수 없어요.` 계열을 사용한다.

### Copy / Labels

- Screen title: `오늘`
- Loading: `오늘 일정을 불러오는 중...`
- Next place overline: `다음 장소`
- Primary success CTA: `오늘 일정 보기`
- Empty itinerary title: `오늘 일정에 아직 장소가 없어요.`
- Empty itinerary helper: `오늘 일정 화면에서 첫 장소를 추가해보세요.`
- No ongoing trip title: `오늘 진행 중인 여행이 없어요.`
- No ongoing trip helper: `내 여행에서 예정된 여행을 확인하거나 새 여행을 만들어보세요.`
- Unavailable title: `오늘 일정을 찾을 수 없어요.`
- Retryable error title: `오늘 일정을 불러올 수 없어요.`
- Retry action: `다시 시도`
- MyPage action: `내 여행 보기`
- Create trip action: `새 여행 만들기`
- Trip detail action: `여행 상세로`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- Today 화면은 warm off-white background, white card, theme border/shadow, existing typography token을 사용한다.
- raw hex color, 임의 spacing/radius, emoji, 임의 unicode icon을 추가하지 않는다.
- 다음 장소 card는 기존 card/list row 패턴과 `theme.placeType` label을 재사용한다.
- 반복되는 card/button/list pattern이 두 번째 이상 중복되면 F-031에서 추가한 중복만 최소 helper로 정리한다.

## API Contract

No new API changes.

F-031 uses existing generated TypeScript client wrappers only:

```text
GET /trips
GET /trips/{tripId}
GET /trips/{tripId}/days/{date}/itinerary
```

### Existing Data Used

`GET /trips` / `ListTripsResponse`:

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
      "createdAt": "2026-06-22T10:00:00Z",
      "myRole": "owner",
      "participantCount": 2
    }
  ]
}
```

`GET /trips/{tripId}` / `GetTripDetailResponse`:

```json
{
  "trip": {
    "id": "trip_123",
    "name": "오사카 3박 4일",
    "startDate": "2026-07-10",
    "endDate": "2026-07-13",
    "defaultCurrency": "JPY",
    "createdBy": "user_123",
    "createdAt": "2026-06-22T10:00:00Z",
    "updatedAt": "2026-06-22T10:00:00Z"
  },
  "participantSummary": {
    "totalCount": 2,
    "previewNames": ["민수", "지영"],
    "overflowCount": 0
  },
  "days": [
    { "date": "2026-07-10", "dayOrder": 1 }
  ]
}
```

`GET /trips/{tripId}/days/{date}/itinerary` / `GetDayItineraryResponse`:

```json
{
  "day": { "date": "2026-07-10", "dayOrder": 1 },
  "items": [
    {
      "id": "item_123",
      "itemOrder": 1,
      "version": 1,
      "place": {
        "id": "place_123",
        "name": "우메다 공중정원",
        "placeType": "sights",
        "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
      }
    }
  ]
}
```

If #30 lands first and these schemas include additional lodging fields, F-031 ignores those fields for next-place selection.

### Existing Errors

F-031 follows existing generated client and common API error behavior.

- `401`: auth recovery/login state
- `400`: safe retryable error unless caused by impossible local route data; do not crash
- `403`, `404`: safe unavailable Today state
- network, `5xx`, unknown: retryable error with `다시 시도`

## DB Changes

No DB changes.

### Tables

- No table changes.
- Existing `trips`, `trip_participants`, `trip_places`, `itinerary_items` are read only through existing APIs.

### Constraints / Indexes

- No new constraints or indexes.

### Migration Notes

- Do not add a goose migration for F-031.
- Do not change sqlc queries or generated DB code for F-031.
- Do not add `status`, `arrived_at`, `skipped_at`, `start_time`, or `end_time` fields in this slice.

## Business Rules

- F-031 is read-only. It must not persist progress, status, last-viewed trip, or selected trip preference.
- Today date is the device/app local calendar date formatted as `YYYY-MM-DD`.
- The Today load computes today once and injects that value into selection/build helpers so one load cycle is internally consistent.
- A trip is ongoing when `trip.startDate <= today <= trip.endDate`.
- If multiple trips are ongoing, selected current trip uses existing ongoing sort order:

```text
endDate ASC,
startDate ASC,
joinedAt DESC,
createdAt DESC,
id DESC
```

- If zero trips are ongoing, Today shows the no-ongoing-trip empty state.
- The current Day is the selected trip’s `TripDay` with `date === today`.
- A selected ongoing trip with no matching current Day is treated as a data/invariant unavailable state, not a normal empty state.
- The next place is the first ordered `DayItineraryItem` for the current Day.
- In F-031, order-only users are supported by `itemOrder`/existing ordered response; optional schedule times are not considered.
- If the today itinerary is empty, Today still shows trip/day context and a CTA to the existing Day itinerary screen.
- The selected trip remains selected only for the current render/load. F-031 does not store a user preference or add a trip switcher.
- Owner and Member users can view Today if they can view the underlying trip/day through existing APIs.
- F-031 does not assume lodging is the first schedule item or current destination.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 자동화 테스트 또는 명시된 regression gap과 연결한다.

- [ ] AC-01: `docs/features/0031-today-execution-basic-screen.md`에 Ouroboros source, scope, out of scope, acceptance criteria, regression test plan, TDD implementation plan이 기록되어 있다.
- [ ] AC-02: F-031은 OpenAPI, Go API server behavior, DB migration, sqlc query, generated API/DB artifacts를 변경하지 않는다.
- [ ] AC-03: Today screen은 기존 root route `/`에서 authenticated user에게 표시되고 bottom navigation의 사용자-facing label은 `오늘`이다.
- [ ] AC-04: Today load는 device/app local date를 한 번 계산해 helper/state builder에 주입할 수 있다.
- [ ] AC-05: current trip selection은 `startDate <= today <= endDate`와 기존 ongoing sort order를 사용한다.
- [ ] AC-06: ongoing trip이 없으면 `오늘 진행 중인 여행이 없어요.` empty state와 `내 여행 보기`, `새 여행 만들기` actions를 표시한다.
- [ ] AC-07: multiple ongoing trips가 있으면 deterministic selected trip 하나만 Today에 표시하고, `내 여행 보기` secondary action은 제공하되 trip switcher는 제공하지 않는다.
- [ ] AC-08: selected ongoing trip의 `days[]`에서 `date === today`인 TripDay를 current Day로 사용한다.
- [ ] AC-09: selected ongoing trip에 today TripDay가 없으면 `오늘 일정을 찾을 수 없어요.` unavailable state와 retry/trip-detail action을 표시한다.
- [ ] AC-10: current Day itinerary가 비어 있으면 trip/day context와 `오늘 일정에 아직 장소가 없어요.` empty state를 표시한다.
- [ ] AC-11: empty itinerary state의 primary action은 기존 Day itinerary route `/trips/{tripId}/days/{date}`로 이동한다.
- [ ] AC-12: current Day itinerary에 items가 있으면 첫 ordered item을 next place로 표시한다.
- [ ] AC-13: success state는 trip title, `Day <dayOrder>`, formatted date, next place name, place type label, address, `오늘 일정 보기` CTA를 표시한다.
- [ ] AC-14: success state의 `오늘 일정 보기` CTA는 기존 Day itinerary route로 이동한다.
- [ ] AC-15: loading/auth/no-ongoing/empty-itinerary/unavailable/retryable-error states가 crash 없이 처리된다.
- [ ] AC-16: trip list/detail/day itinerary fetch failure는 retry 가능한 Today error state를 표시한다.
- [ ] AC-17: `401` 또는 missing/corrupt session은 기존 login recovery behavior로 이어진다.
- [ ] AC-18: `403`/`404` from trip detail/day itinerary는 safe unavailable Today state를 표시한다.
- [ ] AC-19: #30 lodging fields가 존재하더라도 F-031은 lodging을 next-place selection에 사용하지 않고 first itinerary item rule을 유지한다.
- [ ] AC-20: F-031은 도착/스킵/길찾기/숙소로/지출/남은 장소 목록/시간표 UI 또는 nonfunctional disabled action을 노출하지 않는다.
- [ ] AC-21: changed mobile logic/state behavior는 pure helper tests와 TypeScript typecheck로 회귀 보호된다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02: OpenAPI/API/DB/generated artifacts remain unchanged | Contract/API/DB drift | `pnpm verify:generated` and targeted git diff | `pnpm verify:generated`; `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts` |
| AC-04: Today helper accepts injected `today` and does not call `new Date()` internally | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-05, AC-07: existing current trip selection handles inclusive dates and deterministic multiple ongoing trips | Mobile logic | `apps/mobile/lib/trips/status.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-06: no ongoing trips maps to Today no-ongoing state and MyPage/create actions | Mobile state/view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-08, AC-09: selected trip day matching and missing-day invariant state are deterministic | Mobile state/view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-10, AC-11: empty itinerary state preserves trip/day context and builds Day itinerary route | Mobile state/navigation helper | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-12, AC-13, AC-14: success state maps first ordered itinerary item to next place card and Day itinerary CTA | Mobile state/view model | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-15, AC-16, AC-18: fetch/status failures map to retryable or unavailable Today states | Mobile state/error mapping | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-17: auth recovery code compiles with existing session/client behavior | Mobile type gate + existing auth tests | `apps/mobile/lib/auth/*.test.mts`, TypeScript gate | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |
| AC-19: lodging fields, if present, are ignored by next-place helper | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` with object containing extra lodging-like fields if type-compatible | `pnpm --filter @i-um/mobile test` |
| AC-20: scoped exclusions remain absent | Static review + TypeScript gate | Today screen JSX and generated diff review | `pnpm --filter @i-um/mobile typecheck`; PR review |
| AC-21: all mobile behavior remains type-safe | Mobile type gate | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| All ACs: existing repository regression remains green | Workspace gate | Root verification | `pnpm verify` |

## Regression Gaps

- Full React Native render/press behavior for the Today card is not automated in the current Node-only mobile test setup.
  - Covered instead: pure Today view model, date injection, route/action targets, error-state mapping, existing auth/session helpers, and TypeScript compile checks.
  - Risk: JSX wiring for a button press or copy placement could regress while helper tests remain green.
  - Follow-up: add mobile component/render test infrastructure when the project introduces RN renderer-level testing.
- Device midnight/background transition is not automated as an e2e scenario.
  - Covered instead: helper-level injected date tests and screen focus/refetch implementation plan.
  - Risk: if the app stays open across midnight without focus/reload, Today may temporarily show the prior date.
  - Follow-up: revisit when execution screen gains active timers/current-time behavior in #95/#33/#34.

## TDD Implementation Plan

1. Red: Today view model/helper tests 작성
   - 작업: `apps/mobile/lib/trips/today-execution.test.mts`를 추가해 injected today, no-ongoing state, multiple-ongoing selected trip input, missing Day invariant, empty itinerary, success next-place card, route/action targets, failure mapping을 검증한다.
   - Verify: helper 미구현 상태에서 `pnpm --filter @i-um/mobile test`가 기대한 이유로 실패한다.

2. Red: no-contract-change guard 확인
   - 작업: F-031에서 API/DB/OpenAPI 변경이 필요 없다는 전제를 고정한다.
   - Verify: `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`가 implementation 중에도 변경 없음이어야 한다.

3. Green: Today pure helper 최소 구현
   - 작업: `apps/mobile/lib/trips/today-execution.ts` 또는 동등 파일에 Today view model builder, Day matcher, next-place mapper, route/action model, error-state mapper를 구현한다.
   - 작업: 기존 `selectCurrentTrip`, `formatTripDayDate`, `buildDayItineraryRoute`, `getPlaceTypeLabel`을 재사용한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper tests를 통과한다.

4. Green: root Today screen wiring
   - 작업: `apps/mobile/app/index.tsx`에서 기존 authenticated home content를 Today load flow로 교체한다.
   - 작업: `readStoredSession`/existing auth recovery, `listMyTrips`, `getTripDetail`, `getTripDayItinerary`를 generated-client wrappers로 호출한다.
   - 작업: `localDateString()`을 load/focus cycle당 한 번 계산해 Today helper에 주입한다.
   - 작업: `useFocusEffect` 또는 동등 focus refetch로 Day itinerary에서 돌아왔을 때 최신 Today state를 로드한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`가 통과한다.

5. Green: BottomMenu Today label 반영
   - 작업: `apps/mobile/lib/navigation/BottomMenu.tsx`의 `home` visible label을 `오늘`로 변경한다. Internal key/route는 유지한다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`.

6. Refactor: F-031에서 추가한 중복만 정리
   - 작업: Today card/date/action formatting에서 중복이 생기면 작은 helper로만 정리한다. 기존 MyPage/Day itinerary UI 구조는 불필요하게 리팩터링하지 않는다.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.

7. Regression gate
   - Verify: `pnpm verify:generated`.
   - Verify: `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`.
   - Verify: `pnpm verify`.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify:generated
git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts
pnpm verify
```

API/DB/OpenAPI 변경이 없는 feature지만, `pnpm verify`로 existing API/mobile checks가 깨지지 않는지 확인한다.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 로그인하지 않은 상태에서 `/` 진입 시 login-required/auth recovery가 보인다.
- [ ] 오늘 진행 중인 여행이 없는 사용자로 `/`에 진입하면 `오늘 진행 중인 여행이 없어요.`와 `내 여행 보기`, `새 여행 만들기`가 보인다.
- [ ] 오늘 진행 중인 여행은 있지만 오늘 Day itinerary가 비어 있는 사용자로 `/`에 진입하면 trip/day context와 `오늘 일정에 아직 장소가 없어요.`가 보인다.
- [ ] empty itinerary state에서 `오늘 일정 열기`를 누르면 해당 Day itinerary screen으로 이동하고 기존 장소 추가/search actions를 사용할 수 있다.
- [ ] 오늘 Day itinerary에 1개 이상 장소가 있는 사용자로 `/`에 진입하면 `다음 장소` card에 첫 장소의 이름/type/address가 보인다.
- [ ] `오늘 일정 보기`를 누르면 해당 Day itinerary screen으로 이동한다.
- [ ] 진행 중인 여행이 여러 개 있는 test data에서 deterministic rule상 선택된 여행 하나만 Today에 표시되고 `내 여행 보기`로 전체를 볼 수 있다.
- [ ] Day itinerary에서 장소를 추가한 뒤 Today로 돌아오면 focus/refetch로 next place state가 갱신된다.
- [ ] staging 또는 internal build에서 next-place happy path를 확인한다.

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- Red check: `pnpm --filter @i-um/mobile test` failed as expected after adding `today-execution.test.mts` because `apps/mobile/lib/trips/today-execution.ts` did not exist yet. A first attempt before install failed on missing local `node_modules`/`tsx`, then dependency install was completed.
- `pnpm --filter @i-um/mobile test`: pass, 99 tests including Today view model tests.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass.
- `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`: pass, no API/OpenAPI/DB/generated changes.
- `pnpm verify`: pass.
- Manual simulator/device smoke: not run in this environment. Not used as regression evidence.
- Staging/internal build smoke: not run in this implementation pass. Not used as regression evidence.

## Release Notes

```text
- 앱 첫 화면에서 오늘 진행 중인 여행의 Day와 다음 장소를 확인할 수 있습니다.
- 오늘 일정이 비어 있으면 해당 Day 일정 화면으로 이동해 장소를 추가할 수 있습니다.
- 아직 도착/스킵/길찾기/숙소 이동은 제공하지 않고, 기존 일정 순서를 기준으로 다음 장소를 보여줍니다.
```

## Open Questions

None after Ouroboros clarification. Spec approved for implementation by user request on 2026-06-23.

## Follow-up Issues

- #30: Day별 숙소 장소 지정. F-031은 lodging을 next-place로 추론하지 않는다.
- #32: 남은 장소 목록. Today 화면에 전체 remaining itinerary list를 추가한다.
- #33: 도착 처리. Next/current item 진행 상태를 저장하고 다음 장소 계산에 반영한다.
- #34: 스킵 처리. Skip 상태를 저장하고 다음 장소 계산에 반영한다.
- #35: 숙소로 이동 버튼. Day lodging target과 Maps 흐름을 연결한다.
- #36: 다음 장소 길찾기.
- #37: 이전 장소 기준 길찾기.
- #38: 이동 모드 선택.
- #39: 장소 지도 열기/주소 복사.
- #40: 참여자 목록. Today basic screen은 participant list를 표시하지 않는다.
- #47: 빠른 지출 등록.
- #95: 시간 선택 가능한 일정 항목/타임라인. Optional time이 생기면 Today의 current/next 계산 규칙을 확장한다.
