# Feature Slice: F-032 남은 장소 목록

## Metadata

- GitHub Issue: #32
- Status: Code Review
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260623_150046`
- Seed: `seed_e40a9916d6fb`
- PM Document: N/A
- Notes: Ambiguity score `0.1155`. Ouroboros clarified F-032 as a read-only Today execution screen enhancement that shows the remaining place-backed itinerary items after the current next-place hero card. The list excludes raw `TripPlace` rows, Day lodging targets that are not schedule items, and future completed/terminal items. F-032 must not introduce new progress/status/time fields, a new API endpoint, DB migration, map/navigation actions, or place detail interactions.

## Goal

사용자가 Today 화면에서 다음 장소 이후 오늘 남은 장소들을 순서대로 확인할 수 있다.

F-032는 F-031 오늘 실행 화면 기본 위에 `남은 장소` section을 추가하는 최소 read-only slice다. 도착/스킵 진행 상태, 길찾기, 숙소 이동, 장소 상세/지도 열기, 시간표 입력은 후속 feature에서 다룬다.

## Problem

- F-031은 오늘의 `다음 장소` 1개만 보여주므로, 사용자는 오늘 남은 전체 흐름을 Today 화면에서 바로 파악하기 어렵다.
- 여행 중에는 다음 장소만큼 “그 다음에 무엇이 남았는지”를 빠르게 보는 것이 중요하다.
- 이 목록은 여행에 저장된 모든 장소가 아니라, 오늘 Day에 배치된 place-backed itinerary/schedule item이어야 한다.
- 아직 도착/스킵/status와 optional time 모델이 없으므로, 현재 slice에서는 기존 Day itinerary ordered response를 재사용하고 후속 status/time 기능과 충돌하지 않는 규칙을 문서화한다.

## User Flow

1. 사용자가 로그인된 상태로 앱의 Today route `/`에 진입한다.
2. 앱은 F-031과 동일하게 오늘 진행 중인 여행과 current Day를 결정한다.
3. 앱은 기존 generated client로 `GET /trips/{tripId}/days/{date}/itinerary`를 호출한다.
4. 오늘 itinerary item이 1개 이상이면 첫 ordered item은 기존 `다음 장소` hero card에 표시된다.
5. 앱은 hero card에 사용된 item을 제외한 subsequent ordered place-backed items를 `남은 장소` section에 표시한다.
6. 오늘 itinerary item이 정확히 1개이면 `다음 장소` hero card 아래에 `남은 장소` section의 compact empty state를 표시한다.
7. 오늘 itinerary item이 0개이거나 next-place hero가 없는 F-031 empty/unavailable state에서는 `남은 장소` section을 렌더링하지 않는다.
8. 사용자가 Day itinerary 화면에서 장소를 추가/수정/삭제/순서 변경한 뒤 Today로 돌아오면 F-031 focus/refetch 흐름으로 `다음 장소`와 `남은 장소`가 최신 item list를 반영한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: F-031 Today success state에 `남은 장소` section 추가
- [x] App UI: remaining item row list와 hero-present/no-subsequent empty state 추가
- [x] App Logic: existing Day itinerary ordered items에서 next hero item을 제외한 remaining list view model 생성
- [x] App Logic: remaining row view model에 order label, place name, place type label, address, optional time label field를 포함
- [x] App Logic: no-next state에서는 remaining section 숨김
- [x] API Contract: 새 계약 없음. 기존 generated TypeScript client의 `GET /trips`, `GET /trips/{tripId}`, `GET /trips/{tripId}/days/{date}/itinerary` 사용
- [x] API Server: 새 handler/service/repository 동작 없음
- [x] DB: 새 migration/table/query 없음
- [x] Tests: remaining section visibility, list derivation, ordering, row presentation, no-navigation behavior, no API/DB drift regression tests
- [ ] Deployment: local/staging 또는 internal build에서 0개/1개/2개 이상 Today itinerary 상태를 smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 새 OpenAPI endpoint, server-side today execution endpoint, server-side remaining-place calculation
- DB migration, sqlc query 변경, generated Go/DB artifact 변경
- `itinerary_items` status/progress column 추가, 도착 처리 (#33), 스킵 처리 (#34)
- `숙소로 이동` 또는 day-ended/shelter progress 상태 (#35)
- 시간 선택 가능한 일정 항목, start/end time schema, 30분 타임라인 (#95)
- Google Maps URL 생성, 길찾기, 이동 모드 선택, 장소 지도 열기/주소 복사 (#36~#39)
- 장소 상세 화면, remaining row tap/navigation, edit/delete/reorder action
- raw `TripPlace` 목록, Day lodging target만 따로 보여주는 목록, 예약/지출/정산 항목 표시
- 빠른 지출 등록, 오늘 지출 요약, 정산 요약 (#47~#59)
- 여러 진행 중인 여행을 Today 화면에서 전환하는 trip switcher
- completed/history 장소 목록 또는 “이미 방문한 장소” section
- 미구현 action을 disabled 버튼으로 노출하는 UX

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`
  - F-031 Today success state의 next-place card 아래에 `남은 장소` section을 추가한다.
  - 기존 no-ongoing, empty-itinerary, unavailable, retryable-error, auth state는 유지한다.
  - `오늘 일정 보기` CTA와 multiple ongoing trip notice 동작은 유지한다.
  - remaining rows는 read-only summary다. `Pressable` tap, route action, map action, edit/delete/reorder action을 추가하지 않는다.

- `apps/mobile/lib/trips/today-execution.ts` 또는 동등 helper
  - remaining section state를 pure helper/view model로 분리해 Expo/React Native 없이 테스트한다.
  - helper는 F-031의 injected `today`, current trip/day, generated itinerary response 흐름을 유지한다.
  - current baseline에서는 `GetDayItineraryResponse.items`의 ordered `itemOrder`를 사용한다.
  - optional time fields가 #95에서 생긴 뒤에는 같은 helper 또는 후속 확장에서 time-first ordering을 적용한다. F-032 자체는 time fields를 추가하지 않는다.

### Remaining Section States

- Hidden
  - 조건: Today view model이 success가 아니거나, next-place hero가 없다.
  - 예: no ongoing trip, empty itinerary, missing current Day, retryable error, auth-required state.
  - 이 경우 F-031의 기존 empty/error copy만 보여주고 `남은 장소` section은 중복으로 렌더링하지 않는다.

- Empty
  - 조건: next-place hero는 있지만 subsequent upcoming remaining item이 없다.
  - 예: 오늘 itinerary item이 정확히 1개인 경우.
  - Section title: `남은 장소`
  - Empty copy: `다음 장소 이후 남은 장소가 없어요.`
  - Optional helper: `도착하면 오늘 일정이 끝나요.`

- List
  - 조건: next-place hero 이후 remaining item이 1개 이상 있다.
  - Section title: `남은 장소`
  - Count helper: `<N>곳 남았어요`
  - 각 remaining item row를 ordered list로 표시한다.

### Remaining Row Content

각 row는 최소한 다음 정보를 보여준다.

- Sequence/order indicator: current Day itinerary order label. 현재 모델에서는 `DayItineraryItem.itemOrder`를 사용한다.
- Optional time label: #95 time fields가 있는 경우에만 표시한다.
- Place name: `item.place.name`
- Place type label: existing `getPlaceTypeLabel(item.place.placeType)` 또는 `theme.placeType` label 재사용
- Address: `item.place.address`

표시하지 않는다.

- 장소 상세 CTA
- 지도/길찾기 CTA
- 주소 복사 CTA
- 수정/삭제/순서 변경 action
- 도착/스킵/숙소로 action
- completed/skipped history badge
- raw provider metadata, 좌표, 거리, 예상 이동 시간

### Ordering Rules

Current F-032 baseline:

- F-031과 동일하게 existing Day itinerary response의 ordered items를 source of truth로 사용한다.
- next-place hero item은 first ordered item이다.
- remaining list는 first ordered item을 제외한 subsequent items다.
- 현재 schema에서는 `itemOrder`가 server-calculated display order이며, F-029 이후 실제 persistence order는 rank 기반이다.

Future #95 compatibility:

- optional schedule time fields가 생기면 upcoming remaining items는 timed item을 먼저 `startTime ASC`로 정렬한다.
- 같은 start time이거나 time 비교가 동률이면 rank/order를 tie-breaker로 사용한다.
- untimed item은 timed item 뒤에서 rank/order 순서로 유지한다.
- row time label은 time이 있을 때만 표시한다. untimed row에 `시간 미정` label을 강제하지 않는다.
- #95가 아직 구현되지 않은 상태에서는 F-032가 time fields를 새로 추가하지 않는다.

### Copy / Labels

- Section title: `남은 장소`
- Count helper: `<N>곳 남았어요`
- Empty title/copy: `다음 장소 이후 남은 장소가 없어요.`
- Empty helper: `도착하면 오늘 일정이 끝나요.`
- Time label format after #95: `HH:mm` or `HH:mm-HH:mm`

### Design Guardrails

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- Today 화면의 warm off-white background, white card, theme border/shadow, existing typography token을 사용한다.
- raw hex color, 임의 spacing/radius, emoji, 임의 unicode icon을 추가하지 않는다.
- 남은 장소 row는 기존 Day itinerary/Today card row 패턴과 `theme.placeType` label을 재사용한다.
- 같은 card/button/list row 패턴이 F-032에서 중복되면 F-032에서 추가한 중복만 작은 helper/component로 정리한다.

## API Contract

No new API changes.

F-032 uses the same generated TypeScript client wrappers as F-031:

```text
GET /trips
GET /trips/{tripId}
GET /trips/{tripId}/days/{date}/itinerary
```

### Existing Data Used

`GET /trips/{tripId}/days/{date}/itinerary` / `GetDayItineraryResponse`:

```json
{
  "day": { "date": "2026-07-10", "dayOrder": 1, "lodgingPlace": null },
  "items": [
    {
      "id": "item_1",
      "itemOrder": 1,
      "version": 1,
      "isLodging": false,
      "place": {
        "id": "place_1",
        "name": "우메다 공중정원",
        "placeType": "sights",
        "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
      }
    },
    {
      "id": "item_2",
      "itemOrder": 2,
      "version": 1,
      "isLodging": false,
      "place": {
        "id": "place_2",
        "name": "도톤보리",
        "placeType": "food",
        "address": "Dotonbori, Chuo Ward, Osaka"
      }
    }
  ]
}
```

F-032 ignores `day.lodgingPlace` for remaining-place inclusion unless the lodging target is also present as an `items[]` schedule row.

If #33/#34 later add progress/status fields to the existing response, terminal items are filtered out by that feature’s Today calculation update. F-032 does not define those fields.

If #95 later adds optional time fields to the existing response, row time label and time-first ordering are enabled by that feature’s schema/update. F-032 does not define those fields.

### Existing Errors

F-032 follows F-031 error handling unchanged.

- `401`: auth recovery/login state
- `400`: safe retryable or unavailable state depending on F-031 local route context
- `403`, `404`: safe unavailable Today state
- network, `5xx`, unknown: retryable error with `다시 시도`

## DB Changes

No DB changes.

### Tables

- No table changes.
- Existing `trips`, `trip_participants`, `trip_places`, `itinerary_items`, and `day_lodging_places` are read only through existing APIs.

### Constraints / Indexes

- No new constraints or indexes.

### Migration Notes

- Do not add a goose migration for F-032.
- Do not change sqlc queries or generated DB code for F-032.
- Do not add `status`, `arrived_at`, `skipped_at`, `start_time`, or `end_time` fields in this slice.

## Business Rules

- F-032 is read-only. It must not persist progress, status, selected item, scroll state, or user preference.
- “남은 장소” means remaining place-backed itinerary/schedule items for the current Day, not every `TripPlace` in the trip.
- The current next-place hero item is excluded from the remaining list because it is already surfaced as the primary card.
- Current baseline: all current Day itinerary items returned by F-031’s existing Day itinerary endpoint are treated as upcoming; next-place hero is the first ordered item; remaining list is subsequent ordered items.
- Future progress/status support: terminal items such as `arrived` or `skipped` must disappear from the remaining list immediately. The remaining list is not a completed/history list.
- `숙소로 이동` or day-ended behavior is out of scope. If a future day-ended state exists, the Today view model should return no next hero and F-032’s remaining section stays hidden.
- Day lodging target from #30 is not included unless it is also represented by a Day itinerary item in `items[]`.
- Same `TripPlace` may appear in multiple itinerary items; F-032 treats each itinerary item as a separate remaining row because it represents a schedule placement.
- If the current Day has exactly one upcoming item, the next-place hero is shown and the remaining section shows its empty copy.
- If the current Day has no upcoming item, F-031 empty/no-next state owns the UX and the remaining section is hidden.
- Current ordering uses server-provided `itemOrder` / existing ordered response. F-032 does not calculate rank itself.
- After #95, optional time sorting/rendering follows the compatibility rule in `Ordering Rules`, but F-032 does not add time fields.
- Remaining rows are read-only summaries. They do not navigate, mutate, open maps, copy address, or expose hidden disabled actions.
- Mobile renders date/time strings without timezone conversion. Date formatting continues to use existing F-031 helpers.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 자동화 테스트 또는 명시된 regression gap과 연결한다.

- [x] AC-01: `docs/features/0032-remaining-place-list.md`에 Ouroboros source, scope, out of scope, acceptance criteria, regression test plan, TDD implementation plan이 기록되어 있다.
- [x] AC-02: F-032은 OpenAPI, Go API server behavior, DB migration, sqlc query, generated API/DB artifacts를 변경하지 않는다.
- [x] AC-03: Today success state에서 current Day itinerary item이 2개 이상이면 next-place hero card 아래 `남은 장소` section이 표시된다.
- [x] AC-04: remaining list는 next-place hero item을 제외하고 second ordered item부터 표시한다.
- [x] AC-05: current baseline에서 remaining rows는 existing Day itinerary ordered response / `itemOrder ASC` 순서를 유지한다.
- [x] AC-06: remaining row는 order label, place name, Korean place type label, address를 표시한다.
- [x] AC-07: remaining row는 F-032에서 tap/navigation/action을 제공하지 않는 read-only summary다.
- [x] AC-08: Today success state에서 current Day itinerary item이 정확히 1개이면 `남은 장소` section은 `다음 장소 이후 남은 장소가 없어요.` empty copy를 표시한다.
- [x] AC-09: current Day itinerary item이 0개인 F-031 empty-itinerary state에서는 `남은 장소` section을 렌더링하지 않는다.
- [x] AC-10: no-ongoing, unavailable, retryable-error, auth-required state에서는 `남은 장소` section을 렌더링하지 않고 F-031 state를 유지한다.
- [x] AC-11: Day itinerary에서 장소 추가/삭제/순서 변경 후 Today로 돌아오면 focus/refetch로 remaining list가 최신 ordered items를 반영한다.
- [x] AC-12: #30 lodging fields가 존재하더라도 Day lodging target은 itinerary `items[]`에 있는 경우에만 remaining row로 표시된다.
- [x] AC-13: F-032는 도착/스킵/status fields를 추가하지 않는다. 향후 status fields가 존재하면 terminal `arrived`/`skipped` items는 remaining list에 표시하지 않는 규칙을 따른다.
- [x] AC-14: F-032는 optional schedule time fields를 추가하지 않는다. 향후 #95 fields가 존재하면 row time label은 time이 있을 때만 표시하고 untimed row에 `시간 미정` label을 강제하지 않는다.
- [x] AC-15: 향후 #95 fields가 존재하면 timed remaining items는 `startTime ASC`, rank/order tie-breaker 순서로 untimed items보다 먼저 표시되고, untimed items는 rank/order 순서를 유지한다.
- [x] AC-16: multiple ongoing trip notice와 `오늘 일정 보기` CTA는 F-031 behavior를 유지한다.
- [x] AC-17: F-032 구현은 장소 상세, Google Maps, 주소 복사, edit/delete/reorder, 도착/스킵/숙소로/지출 action을 포함하지 않는다.
- [x] AC-18: changed mobile logic/state behavior는 pure helper tests와 TypeScript typecheck로 회귀 보호된다.
- [x] AC-19: Today UI 변경은 design guardrails를 따른다. raw hex, 임의 spacing/radius, emoji/unicode icon을 추가하지 않는다.
- [x] AC-20: `pnpm verify` 또는 동등한 CI gate가 기존 API/mobile regression을 통과한다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02: OpenAPI/API/DB/generated artifacts remain unchanged | Contract/API/DB drift | `pnpm verify:generated` and targeted git diff | `pnpm verify:generated`; `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts` |
| AC-03, AC-04, AC-05: 2+ ordered itinerary items produce next-place hero plus remaining rows starting at second item in order | Mobile logic/view model | `apps/mobile/lib/trips/today-execution.test.mts` or `apps/mobile/lib/trips/today-execution-remaining.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-06: remaining row maps order label, place name, Korean type label, and address from existing `DayItineraryItem` | Mobile logic/view model | `apps/mobile/lib/trips/today-execution*.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-07, AC-17: remaining row view model has no route/action/tap model and scoped interactions remain absent | Mobile logic/static review | helper tests plus Today screen review | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |
| AC-08: one-item itinerary keeps next-place hero and renders remaining section empty copy | Mobile state/view model | `apps/mobile/lib/trips/today-execution*.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-09, AC-10: no-next states hide remaining section and preserve F-031 empty/error/auth behavior | Mobile state/view model | `apps/mobile/lib/trips/today-execution*.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-11: Today state is rebuilt from refetched itinerary items after Day itinerary changes | Mobile state/view model | helper test for rebuild from changed input; screen focus/refetch TypeScript gate | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |
| AC-12: lodging summary fields are ignored unless represented as itinerary item rows | Mobile logic | `apps/mobile/lib/trips/today-execution*.test.mts` with day lodging fixture if generated type includes it | `pnpm --filter @i-um/mobile test` |
| AC-13: no status/progress schema is introduced by F-032; future terminal filtering rule is documented | Generated drift/static review | OpenAPI/generated diff review | `pnpm verify:generated` |
| AC-14, AC-15: optional time behavior is not implemented before #95 but compatibility rule is documented | Spec/follow-up gate | This feature spec + #95 follow-up | PR review |
| AC-16: existing multiple-ongoing notice and Today CTA behavior remains covered | Mobile logic | existing `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-18, AC-19: mobile behavior remains type-safe and theme-token-based | Mobile type/UI | TypeScript gate + PR review | `pnpm --filter @i-um/mobile typecheck` |
| AC-20: full regression gate remains green | All | workspace verify | `pnpm verify` |

## Regression Gaps

- Native React Native render/tap absence is not fully automated in the current Node-only mobile test setup.
  - Covered instead: pure Today view model tests prove section state, row payload, and lack of route/action model; TypeScript proves screen wiring compiles.
  - Risk: JSX could accidentally wrap a row with a press handler while helper tests remain green.
  - Follow-up: add mobile component/render test infrastructure when the project introduces RN renderer-level testing.
- Optional time ordering and time label rendering cannot be fully regression-tested until #95 adds schedule time fields to generated types or a stable schedule item model.
  - Covered instead: F-032 documents the ordering rule and explicitly forbids adding time fields in this slice.
  - Risk: #95 could introduce time fields without extending Today remaining-list tests.
  - Follow-up: #95 must update Today execution tests for timed/untimed ordering and optional time labels.
- Terminal `arrived`/`skipped` filtering cannot be fully regression-tested until #33/#34 add progress/status fields.
  - Covered instead: F-032 documents that terminal items disappear and explicitly forbids adding status fields in this slice.
  - Risk: status features could update next-place logic but forget remaining-list filtering.
  - Follow-up: #33/#34 must update Today execution tests for next/remaining calculations.

## TDD Implementation Plan

1. Red: remaining-list view model tests 작성
   - 작업: `apps/mobile/lib/trips/today-execution.test.mts` 또는 `today-execution-remaining.test.mts`에 2개 이상 item, 1개 item, 0개 item/no-next state를 검증하는 실패 테스트를 추가한다.
   - 기대 실패: `TodaySuccessViewModel` 또는 equivalent helper에 remaining section state가 없다.
   - Verify: `pnpm --filter @i-um/mobile test`가 기대한 이유로 실패한다.

2. Red: row payload/no-action tests 작성
   - 작업: remaining row가 order label, place name, type label, address를 포함하고 route/action/tap model을 포함하지 않는 실패 테스트를 추가한다.
   - Verify: `pnpm --filter @i-um/mobile test`가 helper 미구현으로 실패한다.

3. Red: no-contract-change guard 확인
   - 작업: F-032에서 API/DB/OpenAPI 변경이 필요 없다는 전제를 고정한다.
   - Verify: `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`가 implementation 중에도 변경 없음이어야 한다.

4. Green: Today pure helper 최소 구현
   - 작업: `TodaySuccessViewModel` 또는 동등 view model에 `remainingSection`을 추가한다.
   - 작업: current ordered items에서 first item은 `nextPlace`, subsequent items는 `remainingSection.items`로 매핑한다.
   - 작업: one-item success state는 `remainingSection.status = 'empty'`와 empty copy를 반환한다.
   - 작업: empty-itinerary/no-next states에는 remaining section을 두지 않는다.
   - Verify: `pnpm --filter @i-um/mobile test`가 remaining-list tests를 통과한다.

5. Green: Today screen UI wiring
   - 작업: `apps/mobile/app/index.tsx`에서 next-place card 아래 `남은 장소` section을 렌더링한다.
   - 작업: list/empty section 모두 theme token과 existing card/list 스타일을 사용한다.
   - 작업: remaining row에 `Pressable` navigation/action을 추가하지 않는다.
   - Verify: `pnpm --filter @i-um/mobile typecheck`.

6. Refactor: F-032에서 추가한 중복만 정리
   - 작업: Today card/list rendering에서 F-032가 만든 중복만 작은 helper/component로 정리한다.
   - 작업: F-031 current trip selection, Day route, auth/error handling은 불필요하게 변경하지 않는다.
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

### Verification Results

- `pnpm --dir .worktrees/F032-remaining-place-list install --frozen-lockfile`: pass. Worktree dependencies installed.
- Red check: `pnpm --dir .worktrees/F032-remaining-place-list --filter @i-um/mobile test`: initially failed because worktree `node_modules` was missing; after install, failed as expected because `remainingSection` was not implemented.
- `pnpm --dir .worktrees/F032-remaining-place-list --filter @i-um/mobile test`: pass, 105 tests including remaining-list view model coverage.
- `pnpm --dir .worktrees/F032-remaining-place-list --filter @i-um/mobile typecheck`: pass.
- `pnpm --dir .worktrees/F032-remaining-place-list verify:generated`: pass.
- `git -C .worktrees/F032-remaining-place-list diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`: pass, no API/OpenAPI/DB/generated drift.
- `git -C .worktrees/F032-remaining-place-list diff --check`: pass.
- `pnpm --dir .worktrees/F032-remaining-place-list verify`: pass.
- Manual simulator/device smoke: not run in this environment. Not used as regression evidence.
- Staging/internal build smoke: not run in this implementation pass. Not used as regression evidence.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build에서 사람이 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 오늘 진행 중인 여행이 없으면 F-031 `오늘 진행 중인 여행이 없어요.` state가 유지되고 `남은 장소` section은 보이지 않는다.
- [ ] 오늘 진행 중인 여행은 있지만 오늘 Day itinerary가 비어 있으면 F-031 empty itinerary state가 유지되고 `남은 장소` section은 보이지 않는다.
- [ ] 오늘 Day itinerary에 장소가 1개 있으면 `다음 장소` card와 `남은 장소` empty copy `다음 장소 이후 남은 장소가 없어요.`가 보인다.
- [ ] 오늘 Day itinerary에 장소가 3개 있으면 첫 장소는 `다음 장소` card에만 보이고, 두 번째/세 번째 장소는 `남은 장소` list에 순서대로 보인다.
- [ ] remaining row에는 order label, 장소명, 장소 타입, 주소가 보이고 row tap/navigation은 없다.
- [ ] Day itinerary에서 장소를 추가하거나 순서 변경한 뒤 Today로 돌아오면 `남은 장소` list가 갱신된다.
- [ ] staging 또는 internal build에서 1개 item empty section과 2개 이상 item list happy path를 확인한다.

## Release Notes

```text
- Today 화면에서 다음 장소 이후 오늘 남은 장소들을 순서대로 확인할 수 있습니다.
- 남은 장소 목록은 오늘 Day 일정에 배치된 장소만 보여주며, 장소 상세/지도/도착/스킵 동작은 후속 기능에서 제공합니다.
```

## Open Questions

None. User approved implementation on 2026-06-23 by requesting `기능 구현 진행`.

## Follow-up Issues

- #33: 도착 처리. Terminal arrived items should update next/remaining calculation and disappear from remaining list.
- #34: 스킵 처리. Terminal skipped items should update next/remaining calculation and disappear from remaining list.
- #35: 숙소로 이동 버튼. Day-ended/shelter behavior should hide the remaining section when there is no next hero.
- #36: 다음 장소 길찾기 / Google Maps URL 연결.
- #37: 이전 schedule item 또는 전날 숙소 기준 길찾기.
- #38: 이동 모드 선택.
- #39: 장소 지도 열기/주소 복사.
- #47: 빠른 지출 등록.
- #95: 시간 선택 가능한 일정 항목/타임라인. Adds optional time fields and must extend Today remaining-list ordering/time-label tests.
