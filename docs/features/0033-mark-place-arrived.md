# Feature Slice: F-033 도착 처리

## Metadata

- GitHub Issue: #33
- Status: In Progress
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #33 — https://github.com/twotwobread/i-um/issues/33
- Ouroboros Interview: `interview_20260624_125034`
- Ouroboros Seed: `seed_2e1433a00042`
- Ambiguity Score: `0.064`
- Notes: Ouroboros clarified that F-033 persists arrival on Day `itinerary_items` instances, not `TripPlace`; `arrivedAt` is server-generated hidden progress state; current/next is derived from the first ordered pending item; maps/routes/origin/undo are out of scope.

## Goal

사용자가 Today 화면에서 현재 다음 장소에 도착했음을 기록하고, 앱이 즉시 다음 도착지 또는 오늘 일정 완료 상태로 넘어간다.

도착 처리는 같은 장소(`TripPlace`)가 아니라 Day 일정 항목(`itinerary_items` / schedule item instance)에 적용한다. 같은 장소가 하루에 여러 번 있어도 사용자가 도착 처리한 하나의 일정 항목만 완료된다.

## Problem

- F-031 Today 기본 화면은 항상 첫 ordered itinerary item을 다음 장소로 보여준다.
- 실제 여행 진행 중에는 이미 도착한 장소를 건너뛰고 다음 미도착 장소를 보여줘야 한다.
- 진행 상태를 저장하지 않으면 앱 재실행/재조회 후에도 동일한 장소가 계속 다음 장소로 남는다.

## User Flow

1. 사용자가 로그인된 상태에서 Today 화면(`/`)을 연다.
2. 앱은 기존 F-031 흐름처럼 현재 진행 중인 여행과 오늘 Day를 찾고 `GET /trips/{tripId}/days/{date}/itinerary`를 호출한다.
3. 응답의 ordered `items`에서 `arrivedAt == null`인 첫 번째 항목을 다음 장소로 표시한다.
4. 사용자가 다음 장소 card의 `도착했어요` 버튼을 누른다.
5. 앱은 `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/arrive`를 호출한다.
6. 서버는 인증, participant 권한, trip/day/item context, 첫 pending item 규칙을 검증한다.
7. 대상 item이 아직 pending이고 해당 Day의 첫 pending item이면 서버 시각으로 `arrived_at`을 저장한다.
8. 서버는 `day`, 도착 처리된 `item`, 최신 ordered `items` 전체를 반환한다.
9. 앱은 추가 refetch 없이 응답의 `items`로 Today 상태를 다시 계산한다.
10. 다음 pending item이 있으면 그 장소를 다음 장소로 보여주고, 없으면 `오늘 일정을 모두 완료했어요.` 완료 상태를 보여준다.

## Scope

- App UI: Today 화면(`/`, `apps/mobile/app/index.tsx`)의 다음 장소 card에 `도착했어요` action 추가
- App UI: Today view model(`apps/mobile/lib/trips/today-execution.ts`)이 `arrivedAt` 기준으로 next/remaining/completed 상태 계산
- App UI: 도착 처리 loading/error/idempotent success/completed 상태 copy와 navigation
- API Contract: `DayItineraryItem.arrivedAt` nullable field 추가
- API Contract: explicit itinerary item arrival endpoint와 response schema 추가
- API Server: arrival handler, service rule, error mapping, response conversion
- DB: `itinerary_items.arrived_at timestamptz NULL` migration과 generated schema 갱신
- Repository: same-day item locking, first-pending validation, idempotent arrival persistence, latest snapshot 반환
- Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- Tests: API contract/generated drift, repository/service/server, mobile view model/client/UI state regression
- Deploy/Smoke: staging 또는 internal build에서 Today 도착 처리 happy path 확인

## Out of Scope

- 도착 취소/undo/cancel-arrival API 또는 UI
- 아직 차례가 아닌 pending item을 임의로 도착 처리하는 기능
- 앞선 미도착 항목을 자동으로 도착 처리하는 기능
- 마지막 장소 도착 후 다음 TripDay로 자동 이동하는 기능
- 출발지 저장/계산, 현재 위치 권한, 앱 내 지도, 경로 preview, Google Maps route summary/navigation
- 도착 시각을 모바일 UI에 표시하는 기능
- `current`/`next` execution state를 DB에 별도 저장하는 기능
- optional schedule time 기반 current/next 계산; F-033은 기존 itinerary order만 사용한다
- Day itinerary 화면의 완료 history/filter/badge UX 확장

## Requirements

### UI / UX

#### Screens

- Today screen: `apps/mobile/app/index.tsx`
- Today state/view model helper: `apps/mobile/lib/trips/today-execution.ts`
- Mobile API wrapper: `apps/mobile/lib/trips/client.ts`

#### Today success state

- 다음 장소는 ordered itinerary items 중 `arrivedAt == null`인 첫 번째 item이다.
- `다음 장소` card는 기존 place name, type, address, order 표시를 유지한다.
- 다음 장소 card 또는 card 하단 action 영역에 primary action `도착했어요`를 노출한다.
- `오늘 일정 보기`는 secondary route action으로 유지한다.
- `남은 장소` section은 다음 장소 이후의 pending items만 보여준다. 이미 도착한 items는 남은 장소에 포함하지 않는다.
- 도착 처리 중에는 중복 tap을 막고 loading copy를 보여준다.
  - 권장 copy: `도착 처리 중...`
- 도착 처리 실패 시 Today 화면 안에서 재시도 가능한 error copy를 보여준다.
  - 일반 실패 권장 copy: `도착 처리할 수 없어요. 다시 시도해주세요.`
  - 409 conflict 권장 copy: `일정 순서가 바뀌었어요. 다시 불러와주세요.`
- 401/auth failure는 기존 Today auth handling과 동일하게 session을 정리하고 login flow로 보낸다.

#### Today completed state

- Day에 item이 1개 이상 있고 모든 item의 `arrivedAt`이 non-null이면 completed state다.
- completed state는 trip/day/date header를 유지한다.
- completed state title: `오늘 일정을 모두 완료했어요.`
- completed state helper 권장 copy: `오늘 일정 화면에서 장소를 확인할 수 있어요.`
- completed state는 next-place card를 보여주지 않는다.
- completed state는 `도착했어요` 버튼을 보여주지 않는다.
- primary CTA는 `오늘 일정 보기`이며 현재 Day itinerary route로 이동한다.
- 같은 날 앱을 다시 열거나 focus refetch가 발생해도, fetched itinerary `arrivedAt` 값만으로 completed state가 즉시 재현되어야 한다.

#### Empty itinerary state

- Day itinerary `items.length === 0`이면 기존 empty itinerary state를 유지한다.
- 빈 일정은 completed state가 아니다.

### API Contract

OpenAPI source of truth: `packages/api-contract/openapi.yaml`.

#### Schema changes

`DayItineraryItem`에 nullable `arrivedAt`을 추가한다.

```yaml
DayItineraryItem:
  required:
    - id
    - itemOrder
    - version
    - isLodging
    - arrivedAt
    - place
  properties:
    arrivedAt:
      type: string
      format: date-time
      nullable: true
      description: Server-generated arrival timestamp for this itinerary item instance. Null means pending.
```

Rules:

- `arrivedAt == null` means pending.
- `arrivedAt != null` means arrived.
- No separate API `status` field is required in F-033; status is derived from nullability.
- All existing endpoints returning `DayItineraryItem` must include `arrivedAt`:
  - `GET /trips/{tripId}/days/{date}/itinerary`
  - `POST /trips/{tripId}/days/{date}/itinerary-items`
  - `PATCH /trips/{tripId}/days/{date}/itinerary-items/order`
  - `PATCH /trips/{tripId}/days/{date}/itinerary/items/{itemId}`
- Newly created itinerary items return `arrivedAt: null`.
- Reorder/update responses preserve existing `arrivedAt` values.

#### New endpoint

```text
POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/arrive
```

- `operationId`: `markDayItineraryItemArrived`
- Tags: `Trips`
- Security: bearer auth
- Request body: none
- Path params:
  - `tripId`: string UUID
  - `date`: string, `format: date`
  - `itemId`: string UUID

#### Success response

`200 OK` for both first arrival and idempotent already-arrived target.

```yaml
MarkDayItineraryItemArrivedResponse:
  type: object
  required:
    - day
    - item
    - items
  properties:
    day:
      $ref: '#/components/schemas/TripDay'
    item:
      $ref: '#/components/schemas/DayItineraryItem'
    items:
      type: array
      description: Latest server source-of-truth itinerary items for the selected day, ordered by itinerary order/rank.
      items:
        $ref: '#/components/schemas/DayItineraryItem'
```

Response requirements:

- `item` is the targeted itinerary item after mutation or idempotent no-op.
- `items` is the full latest Day itinerary snapshot for `tripId/date`.
- The client can recompute next/completed state from this response without a required follow-up `GET`.

#### Error responses

- `400`: invalid `tripId`, `date`, or `itemId` format
- `401`: unauthenticated
- `403`: authenticated user is not a participant of the trip
- `404`: trip not found, virtual day out of range, or `itemId` is not part of the selected `tripId/date`
- `409`: targeted item is still pending but is not the first ordered pending item for that Day
- `500`: unexpected server error

### DB Changes

Migration source of truth: `apps/api/migrations/` and `apps/api/schema.sql`.

Add nullable arrival timestamp to `itinerary_items`.

```sql
ALTER TABLE itinerary_items
  ADD COLUMN arrived_at timestamptz;
```

Migration expectations:

- Existing rows backfill to `NULL` and remain pending.
- Down migration drops `arrived_at`.
- No new `current`/`next` table or column is added.
- No TripPlace-level arrival column is added.
- No new index is required for F-033 if repository loads same-Day ordered rows through existing `(trip_id, scheduled_date, rank)` access. Add a partial pending index only if implementation evidence shows it is needed.

### API Server / Domain Rules

- Arrival is persisted on `itinerary_items.id`, scoped by `trip_id` and `scheduled_date`.
- Server, not client, is the timestamp source of truth.
- First successful arrival sets `arrived_at` from the server clock at mutation/commit time.
- API serialization returns `arrivedAt` as nullable RFC3339 UTC datetime.
- The client does not send arrival time.
- Idempotent repeat on an already-arrived target returns `200 OK`, preserves the original `arrived_at`, and returns the latest full Day snapshot.
- If the target item is pending, it must be the first ordered pending item for that Day at server transaction time.
- If the target item is pending but a different item is the first pending item, return `409 Conflict` and do not mutate.
- If all items are already arrived and the target item is one of them, idempotent `200 OK` applies.
- If a new pending item is later added to a completed Day, the Day is no longer completed on the next fetch because completed state is derived from current `items` values.
- The API is date-addressed and is not restricted to the device's today. Mobile F-033 exposes the action only from Today for the current Day.
- Existing trip/day participant authorization rules apply. Owner-only permission is not required; any current trip participant may mark the itinerary item arrived.
- Repository mutation should be transactional:
  - lock/load same-Day itinerary items in deterministic order,
  - validate target membership,
  - apply idempotent or first-pending rule,
  - update only the target row when needed,
  - return the latest ordered snapshot.
- Reorder remains the way to handle intentional out-of-order visits: reorder the Day first, then arrive the new first pending item.

## Acceptance Criteria

- [ ] `DayItineraryItem` API schema includes required nullable `arrivedAt` and generated TS/Go types expose it.
- [ ] `GET /trips/{tripId}/days/{date}/itinerary` returns ordered items with `arrivedAt` for pending and arrived items.
- [ ] New authenticated `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/arrive` endpoint exists.
- [ ] Successful first arrival sets `itinerary_items.arrived_at` only on the targeted item instance.
- [ ] Same `TripPlace` appearing in multiple itinerary items is not globally marked arrived when one item is arrived.
- [ ] Success response is `200 OK` with `day`, targeted `item`, and full ordered `items` snapshot.
- [ ] Repeat request for an already-arrived target returns `200 OK`, preserves original `arrivedAt`, and returns latest snapshot.
- [ ] Pending target that is not the first ordered pending item returns `409 Conflict` with no mutation.
- [ ] Invalid trip/date/item formats return `400`.
- [ ] Non-participant access returns `403`.
- [ ] Trip, out-of-range virtual day, or item outside selected trip/day context returns `404`.
- [ ] Today selects next place as the first ordered item whose `arrivedAt` is `null`.
- [ ] Today remaining list excludes arrived items and includes only pending items after the next place.
- [ ] Today `도착했어요` action appears only for the current next-place card.
- [ ] After arrival success, Today updates from mutation response without mandatory follow-up itinerary fetch.
- [ ] After the last pending item is arrived, Today shows `오늘 일정을 모두 완료했어요.`, no next-place card, no `도착했어요` button, and `오늘 일정 보기` CTA.
- [ ] Empty itinerary state remains separate from completed state.
- [ ] Focus/app reopen recreates next/completed state from fetched `arrivedAt` values alone.
- [ ] F-033 does not add undo, route/map/origin, displayed arrival time, schedule-time ordering, or persisted current/next state.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI defines `arrivedAt`, arrive endpoint, response schema, and generated code is current | Contract/generated | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm generate && pnpm verify:generated` |
| Migration adds nullable `itinerary_items.arrived_at`, rollback/reapply works, existing rows are pending | DB migration | `apps/api/migrations/*_add_itinerary_item_arrived_at.sql`, `apps/api/schema.sql` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate` plus rollback/reapply workflow |
| Repository marks only current first pending item arrived and returns latest ordered snapshot | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Repository preserves duplicate TripPlace independence | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Repository/service idempotent repeat preserves original `arrived_at` and returns 200-equivalent result | API repository/service | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| Service validates auth, UUID/date format, participant permission, virtual day range, item membership, and 409 out-of-order pending target | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| HTTP endpoint maps success/idempotent/400/401/403/404/409 and serializes RFC3339 nullable `arrivedAt` | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| API builds after generated server/client changes | API build | Go package build | `pnpm --filter @i-um/api build` |
| Today view model selects first pending item, filters remaining pending items, and keeps empty itinerary distinct | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Today view model renders completed state after all items have `arrivedAt` | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile trip client exposes generated `markDayItineraryItemArrived` wrapper with auth refresh | Mobile API helper | `apps/mobile/lib/trips/client.test.mts` or existing auth/client coverage if wrapper pattern is compile-only | `pnpm --filter @i-um/mobile test` |
| Today screen mutation flow disables duplicate taps, updates from response, handles auth/error/conflict states, and typechecks | Mobile UI/typecheck | `apps/mobile/app/index.tsx`, helper tests | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Full repo gate before PR | All | Generated/API/mobile | `pnpm verify` |

## Regression Gaps

- Full React Native press/loading visual behavior for the Today button may not be fully automated in the current Node-only mobile test setup.
  - Risk: a style/layout regression could pass helper tests.
  - Follow-up: cover by internal build smoke for Today arrival happy path, conflict/error retry, and completed state.

## TDD Implementation Plan

1. Red: API contract expectations
   - Add/adjust tests or generated-usage compile points expecting `DayItineraryItem.arrivedAt` and `markDayItineraryItemArrived` response.
   - Verify: `pnpm verify:generated` should fail until OpenAPI/generated artifacts are updated.
2. Green: OpenAPI and generated code
   - Update `packages/api-contract/openapi.yaml` with `arrivedAt`, new endpoint, and `MarkDayItineraryItemArrivedResponse`.
   - Run `pnpm generate`.
   - Verify: `pnpm verify:generated`.
3. Red: DB/repository arrival persistence
   - Add repository tests for nullable `arrived_at`, current-first-pending success, duplicate TripPlace independence, idempotent repeat preserving timestamp, out-of-order pending conflict, and latest snapshot ordering.
   - Verify: `pnpm --filter @i-um/api test` should fail.
4. Green: DB migration, queries, repository transaction
   - Add goose migration for `itinerary_items.arrived_at` and update `apps/api/schema.sql`.
   - Update sqlc queries/generated DB code as needed.
   - Implement repository transaction that locks same-Day rows, validates target, applies idempotent/409 rules, and returns latest ordered items.
   - Verify: DB migrate rollback/reapply workflow and `pnpm --filter @i-um/api test`.
5. Red: domain service rules
   - Add service tests for auth/validation/participant/day range/item membership, first-pending rule, idempotent behavior, and response shape.
   - Verify: `pnpm --filter @i-um/api test` should fail.
6. Green: domain service
   - Add `MarkDayItineraryItemArrived` input/result and service method.
   - Keep business rules in service/repository, not handler.
   - Verify: `pnpm --filter @i-um/api test`.
7. Red: HTTP handler/server integration
   - Add server tests for `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/arrive` success and error mapping.
   - Verify: `pnpm --filter @i-um/api test` should fail.
8. Green: handler and response mapping
   - Wire generated server route to trip service.
   - Convert domain `DayItineraryItem.ArrivedAt` to nullable RFC3339 `arrivedAt`.
   - Map pending out-of-order to `409 Conflict`.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
9. Red: mobile Today derivation
   - Extend `apps/mobile/lib/trips/today-execution.test.mts` for first pending selection, pending remaining list, completed state, empty distinct state, and duplicate place item IDs.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
10. Green: mobile Today view model
   - Update `today-execution.ts` types and builder to use `arrivedAt` nullability.
   - Add `completed` state and arrival action model.
   - Verify: `pnpm --filter @i-um/mobile test`.
11. Red: mobile API/action flow
   - Add helper tests or compile assertions for `markDayItineraryItemArrived` wrapper and mutation state transitions.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` should fail until wired.
12. Green: Today UI mutation wiring
   - Add generated client wrapper in `apps/mobile/lib/trips/client.ts`.
   - Update `apps/mobile/app/index.tsx` to call arrival endpoint, disable duplicate taps, update local Today view model from response, and show error/conflict copy.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
13. Refactor
   - Keep formatting/sorting/API-response-to-view-state logic in `apps/mobile/lib/**` helpers.
   - Reuse theme tokens and existing Today UI patterns; no raw colors.
   - Verify: targeted API/mobile tests.
14. Gate
   - Run generated, API, mobile, and full verification gates.
   - Verify: `pnpm verify:generated && pnpm --filter @i-um/api test && pnpm --filter @i-um/api build && pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck && pnpm verify`.

## Verification Record

### Automated Regression

- `pnpm generate`: pass — OpenAPI, TS client, Go server, and sqlc artifacts regenerated.
- `pnpm verify:generated`: pass.
- `pnpm db:migrate`: pass — applied `00009_add_itinerary_item_arrived_at.sql` locally.
- `pnpm db:rollback && pnpm db:migrate`: pass — rollback/reapply of `00009` verified locally.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.

### Manual Smoke

- Today arrival happy path in internal build: Not run — internal build not requested.
- Last-place completed state in internal build: Not run — internal build not requested.
- Staging API arrival endpoint smoke: Not run — staging deploy not requested.

## Release Notes

- Today 화면에서 현재 다음 장소를 `도착했어요`로 처리하면 다음 미도착 장소로 바로 넘어갑니다.
- 오늘 일정의 모든 장소에 도착하면 Today 화면이 완료 상태를 보여줍니다.
- 지도/경로 안내와 도착 취소는 이번 slice에 포함되지 않습니다.

## Open Questions

- None for F-033 implementation scope.

## Follow-up Issues

- 도착 취소/undo 또는 완료 상태 수정 flow
- 현재 위치 기준 앱 내 지도/경로 preview 및 Google Maps 상세 길찾기 handoff
- 도착 시각 표시/history UX
- optional scheduled time 기반 current/next 계산 확장 (#95)
- skip/pass 처리와 arrival과의 상태 조합 (#34 if applicable)
