# Feature Slice: F-034 스킵 처리

## Metadata

- GitHub Issue: #34
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #34 — https://github.com/twotwobread/i-um/issues/34
- Ouroboros Interview: `interview_20260625_121046`
- Ouroboros Seed: `seed_c07df5d44db9`
- Ambiguity Score: `0.0945`
- Notes: Ouroboros clarified that skip is persisted on Day `itinerary_items` / ScheduleItem instances, not raw `TripPlace`; skipped state is recoverable; Today shows skipped items in a restore-only section; skip/restore use explicit action endpoints and return the latest Day itinerary snapshot.

## Goal

사용자가 Today 화면에서 현재 진행할 장소를 스킵하고, 앱이 즉시 다음 pending 장소로 넘어간다.

스킵은 같은 장소(`TripPlace`) 전체가 아니라 Day 일정 항목(`itinerary_items` / ScheduleItem instance)에 적용한다. 같은 장소가 하루에 여러 번 있어도 스킵한 하나의 일정 항목만 skipped 상태가 되며, 사용자는 나중에 Today 화면의 `스킵한 장소` 목록에서 해당 항목을 복구해 다시 진행할 수 있다.

## Problem

- F-033 도착 처리는 `arrivedAt`으로 완료된 장소를 건너뛰지만, 실제 여행 중에는 현재 장소를 방문하지 않고 다음 장소로 넘어가야 할 수 있다.
- 스킵 상태를 저장하지 않으면 앱 재실행/재조회 후 스킵한 장소와 단순 pending 장소를 구분할 수 없다.
- 스킵은 최종 완료가 아니므로, 모든 미도착 장소가 skipped여도 Today가 `완료`로 보이면 사용자가 복구할 방법을 놓치게 된다.

## User Flow

1. 사용자가 로그인된 상태에서 Today 화면(`/`)을 연다.
2. 앱은 현재 진행 중인 여행과 오늘 Day를 찾고 `GET /trips/{tripId}/days/{date}/itinerary`를 호출한다.
3. 응답의 ordered `items`에서 `arrivedAt == null && skippedAt == null`인 첫 번째 항목을 현재/다음 장소로 표시한다.
4. 현재/다음 장소 card에는 기존 `길찾기`, `도착했어요`와 함께 `스킵하기` action이 보인다.
5. 사용자가 `스킵하기`를 누르면 앱은 `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/skip`을 호출한다.
6. 서버는 인증, participant 권한, trip/day/item context, 첫 pending item 규칙을 검증한다.
7. 대상 item이 서버 기준 첫 pending item이면 서버 시각으로 `skipped_at`을 저장한다.
8. 서버는 `day`, 스킵 처리된 `item`, 최신 ordered `items` 전체를 반환한다.
9. 앱은 추가 refetch 없이 응답의 `items`로 Today 상태를 다시 계산한다.
10. 다음 pending item이 있으면 그 장소를 현재/다음 장소로 보여주고, 스킵된 item은 `스킵한 장소` section에 표시한다.
11. 사용자가 `스킵한 장소` section에서 특정 item의 `복구`를 누르면 앱은 `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/restore`를 호출한다.
12. 서버는 대상 item의 `skipped_at`을 해제하고 최신 Day itinerary snapshot을 반환한다.
13. 앱은 복구된 item을 다시 현재/다음 장소로 보여주며, 사용자는 기존 현재 장소 action(`길찾기`, `도착했어요`, `스킵하기`)으로 이어서 진행한다.

## Scope

- App UI: Today 화면(`/`, `apps/mobile/app/index.tsx`)에 현재 item `스킵하기` action과 `스킵한 장소` restore-only section 추가
- App UI: Today view model(`apps/mobile/lib/trips/today-execution.ts`)이 `arrivedAt`/`skippedAt` 기준으로 next/remaining/skipped/recover-needed/completed 상태 계산
- App UI: skip/restore loading, conflict, retryable error, auth handling copy와 mutation state
- API Contract: `DayItineraryItem.skippedAt` nullable field 추가
- API Contract: explicit itinerary item skip/restore endpoints와 response schemas 추가
- API Server: skip/restore handlers, service rules, error mapping, response conversion
- DB: `itinerary_items.skipped_at timestamptz NULL` migration과 `arrived_at`/`skipped_at` mutual-exclusion check, generated schema 갱신
- Repository: same-day item locking, first-pending skip validation, idempotent skip/restore persistence, latest snapshot 반환
- Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- Tests: API contract/generated drift, migration/repository/service/server, mobile view model/client/UI state regression
- Deploy/Smoke: staging 또는 internal build에서 Today skip/restore happy path 확인

## Out of Scope

- Day itinerary 화면에서의 skipped badge, restore, filter, history UX
- 스킵 목록에서 곧바로 `도착 처리`하는 shortcut
- 아직 차례가 아닌 pending item을 임의로 스킵하는 기능
- 스킵 복구가 `item_order`/`rank`를 영구적으로 바꾸는 기능
- skipped state를 `TripPlace`에 저장하거나 같은 장소의 모든 occurrence에 전파하는 기능
- 별도 `status` enum/column, `current`/`next` pointer table/column, per-user execution cursor
- 마지막 pending item을 스킵했을 때 자동으로 Day를 완료 처리하는 기능
- optional schedule time 기반 current/next 계산 확장
- 도착 취소/undo와 skipped/arrived 간 임의 상태 편집

## Requirements

### UI / UX

#### Screens

- Today screen: `apps/mobile/app/index.tsx`
- Today state/view model helper: `apps/mobile/lib/trips/today-execution.ts`
- Mobile API wrapper: `apps/mobile/lib/trips/client.ts`

#### Today active state

- 현재/다음 장소는 ordered itinerary items 중 `arrivedAt == null && skippedAt == null`인 첫 번째 item이다.
- 현재/다음 장소 card는 기존 place name, type, address, order, `길찾기`, `도착했어요` 표시를 유지한다.
- 현재/다음 장소 action 영역에 `스킵하기`를 추가한다.
- `스킵하기`는 현재/다음 장소에만 표시한다. `남은 장소`나 `스킵한 장소` row에는 표시하지 않는다.
- 스킵 처리 중에는 중복 tap을 막고 loading copy를 보여준다.
  - 권장 copy: `스킵 처리 중...`
- 스킵 실패 시 Today 화면 안에서 재시도 가능한 error copy를 보여준다.
  - 일반 실패 권장 copy: `스킵 처리할 수 없어요. 다시 시도해주세요.`
  - 409 conflict 권장 copy: `일정 순서가 바뀌었어요. 다시 불러와주세요.`
- 401/auth failure는 기존 Today auth handling과 동일하게 session을 정리하고 login flow로 보낸다.

#### Remaining places section

- `남은 장소` section은 현재/다음 장소 이후의 pending items만 보여준다.
- arrived items와 skipped items는 `남은 장소`에 포함하지 않는다.
- skipped items는 별도 `스킵한 장소` section에만 표시한다.

#### Skipped places section

- skipped items가 1개 이상이면 Today 화면에 `스킵한 장소` section을 표시한다.
- section title 권장 copy: `스킵한 장소`
- count/helper 권장 copy: `{n}곳을 나중에 다시 볼 수 있어요.`
- skipped list는 원래 itinerary `itemOrder` 오름차순으로 표시한다.
- 각 skipped row는 order badge, place name, place type/address 요약, `복구` action을 표시한다.
- `복구` action만 제공한다. skipped row에서 직접 `도착했어요`는 제공하지 않는다.
- 복구 처리 중에는 해당 row의 중복 tap을 막고 loading copy를 보여준다.
  - 권장 copy: `복구 중...`
- 복구 실패 시 Today 화면 안에서 재시도 가능한 error copy를 보여준다.
  - 일반 실패 권장 copy: `스킵한 장소를 복구할 수 없어요. 다시 시도해주세요.`
  - 409 conflict 권장 copy: `이미 완료된 장소예요. 다시 불러와주세요.`

#### Restore behavior

- 복구 성공 후 앱은 응답의 `items`와 target `item`을 기준으로 Today 상태를 다시 계산한다.
- 복구된 item은 즉시 현재/다음 장소로 돌아온다.
- 다른 skipped items는 skipped 상태로 남고, 기존 pending items는 pending 상태로 남는다.
- 복구는 `itemOrder`/`rank`를 영구적으로 변경하지 않는다.
- 일반 Today 흐름에서 skip은 서버 기준 첫 pending item에만 허용되므로, 복구된 item은 기존 pending items보다 앞선 execution item으로 다시 진행된다.

#### Recover-needed state

- Day에 item이 1개 이상 있고 pending item은 없으며 skipped item만 남아 있다면 completed가 아니다.
- 이 상태에서는 next-place card와 `도착했어요`/`스킵하기` 버튼을 보여주지 않는다.
- 사용자에게 복구가 필요하다는 상태와 `스킵한 장소` section을 보여준다.
- 권장 title: `진행할 장소가 없어요.`
- 권장 helper: `스킵한 장소를 복구하면 다시 진행할 수 있어요.`
- primary CTA는 `오늘 일정 보기`이며 현재 Day itinerary route로 이동한다.

#### Completed state

- completed state는 Day의 모든 item이 `arrivedAt != null`일 때만 보여준다.
- skipped item이 하나라도 있으면 completed가 아니다.
- completed state는 기존 F-033 copy와 CTA를 유지한다.

#### Empty itinerary state

- Day itinerary `items.length === 0`이면 기존 empty itinerary state를 유지한다.
- 빈 일정은 completed도 recover-needed도 아니다.

### API Contract

OpenAPI source of truth: `packages/api-contract/openapi.yaml`.

#### Schema changes

`DayItineraryItem`에 required nullable `skippedAt`을 추가한다.

```yaml
DayItineraryItem:
  required:
    - id
    - itemOrder
    - version
    - isLodging
    - arrivedAt
    - skippedAt
    - place
  properties:
    skippedAt:
      type: string
      format: date-time
      nullable: true
      description: Server-generated skip timestamp for this itinerary item instance. Null means the item is not currently skipped.
```

Derived status rules:

- `arrivedAt != null` means arrived.
- `arrivedAt == null && skippedAt != null` means skipped.
- `arrivedAt == null && skippedAt == null` means pending.
- `arrivedAt` and `skippedAt` must not both be non-null.
- No separate API `status` field is required in F-034; status is derived from timestamp nullability.

All existing endpoints returning `DayItineraryItem` must include `skippedAt`:

- `GET /trips/{tripId}/days/{date}/itinerary`
- `POST /trips/{tripId}/days/{date}/itinerary-items`
- `POST /trips/{tripId}/days/{date}/places/google/itinerary-items`
- `PATCH /trips/{tripId}/days/{date}/itinerary-items/order`
- `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/arrive`
- `PATCH /trips/{tripId}/days/{date}/itinerary/items/{itemId}`

Newly created itinerary items return `arrivedAt: null` and `skippedAt: null`.

Reorder/update responses preserve existing `arrivedAt` and `skippedAt` values.

#### New endpoint: skip

```text
POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/skip
```

- `operationId`: `markDayItineraryItemSkipped`
- Tags: `Trips`
- Security: bearer auth
- Request body: none
- Path params:
  - `tripId`: string UUID
  - `date`: string, `format: date`
  - `itemId`: string UUID

#### New endpoint: restore

```text
POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/restore
```

- `operationId`: `restoreDayItineraryItem`
- Tags: `Trips`
- Security: bearer auth
- Request body: none
- Path params:
  - `tripId`: string UUID
  - `date`: string, `format: date`
  - `itemId`: string UUID

#### Success responses

Both endpoints return `200 OK` and follow the existing arrival snapshot pattern.

```yaml
MarkDayItineraryItemSkippedResponse:
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

RestoreDayItineraryItemResponse:
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
- The client can recompute next/skipped/recover-needed/completed state from this response without a required follow-up `GET`.

#### Error responses

Both endpoints use the existing itinerary action error conventions:

- `400`: invalid `tripId`, `date`, or `itemId` format
- `401`: unauthenticated
- `403`: authenticated user is not a participant of the trip
- `404`: trip not found, virtual day out of range, or `itemId` is not part of the selected `tripId/date`
- `409`: valid item context but invalid state transition for the requested action
- `500`: unexpected server error

Skip-specific `409` cases:

- target item is pending but is not the first ordered pending item for that Day
- target item is already arrived

Restore-specific `409` cases:

- target item is already arrived

Idempotent `200 OK` cases:

- skip retry on an already skipped target preserves the original `skippedAt` and returns the latest snapshot
- restore retry on an already pending target returns the latest snapshot

### DB Changes

Migration source of truth: `apps/api/migrations/` and `apps/api/schema.sql`.

Add nullable skip timestamp and a mutual-exclusion constraint.

```sql
ALTER TABLE itinerary_items
  ADD COLUMN skipped_at timestamptz;

ALTER TABLE itinerary_items
  ADD CONSTRAINT itinerary_items_arrived_skipped_exclusive
  CHECK (arrived_at IS NULL OR skipped_at IS NULL);
```

Migration expectations:

- Existing rows backfill to `skipped_at = NULL` and retain their current pending/arrived state.
- Down migration drops `itinerary_items_arrived_skipped_exclusive` and `skipped_at`.
- No `TripPlace`-level skip column is added.
- No status enum/column is added.
- No new persisted `current`/`next` pointer is added.
- No new index is required for F-034 if repository continues loading same-Day ordered rows through existing `(trip_id, scheduled_date, rank)` access. Add an index only if implementation evidence shows it is needed.
- `apps/api/schema.sql` must be regenerated/updated to include `skipped_at` and the check constraint.

### API Server / Domain Rules

#### Status derivation

- A Day itinerary item is `arrived` when `arrived_at IS NOT NULL`.
- A Day itinerary item is `skipped` when `arrived_at IS NULL AND skipped_at IS NOT NULL`.
- A Day itinerary item is `pending` when `arrived_at IS NULL AND skipped_at IS NULL`.
- Repository and service code should use a single helper/predicate for these rules where practical.

#### Skip rules

- Skip is persisted on `itinerary_items.id`, scoped by `trip_id` and `scheduled_date`.
- Server, not client, is the timestamp source of truth.
- First successful skip sets `skipped_at` from the server clock at mutation/commit time.
- The client does not send skip time.
- If the target is already skipped, skip is idempotent: return `200 OK`, preserve the original `skipped_at`, and return the latest snapshot.
- If the target is arrived, return `409 Conflict` and do not mutate.
- If the target is pending, it must be the first ordered pending item for that Day at server transaction time.
- If a different item is the first pending item, return `409 Conflict` and do not mutate.
- Skipping one ScheduleItem must not update any other item with the same `trip_place_id`.

#### Restore rules

- Restore clears `skipped_at` on the target item and leaves `arrived_at` null.
- Restore is allowed for any skipped item in the selected trip/day.
- Restore does not conflict with other pending or skipped items.
- Restore does not change `item_order` or `rank`.
- If the target is already pending, restore is idempotent: return `200 OK` and the latest snapshot.
- If the target is arrived, return `409 Conflict` and do not mutate.
- Restoring one item must not update any other skipped item, even if they share the same `trip_place_id`.

#### Arrival interaction

- Arrival remains valid only for the first ordered pending item where `arrived_at IS NULL AND skipped_at IS NULL`.
- A skipped item cannot be directly arrived. It must be restored first, then arrived through the existing `arrive` endpoint.
- Existing `POST .../arrive` responses must include `skippedAt` on every returned `DayItineraryItem`.

#### Transaction and snapshot requirements

- Repository skip/restore mutations should be transactional:
  - lock/load same-Day itinerary items in deterministic order,
  - validate target membership,
  - apply idempotent or conflict rules,
  - update only the target row when needed,
  - return the latest ordered snapshot.
- API serialization returns `skippedAt` as nullable RFC3339 UTC datetime.
- Existing trip/day participant authorization rules apply. Owner-only permission is not required; any current trip participant may skip or restore itinerary items.
- The API is date-addressed and is not restricted to the device's today. Mobile F-034 exposes the actions only from Today for the current Day.

## Business Rules

- Current/next execution state is derived from latest Day itinerary item status and order, not from raw `TripPlace` or a separate stored current pointer.
- Pending items are `arrivedAt == null && skippedAt == null`.
- Skipped items are `arrivedAt == null && skippedAt != null`.
- Arrived items are never shown in next, remaining, or skipped sections.
- The next place is the first ordered pending item.
- Skipped list is ordered by original `itemOrder`.
- Completed means every itinerary item is arrived.
- A Day with only skipped non-arrived items is recover-needed, not completed.
- Skip and restore responses are the source of truth for immediate Today recalculation.
- Reorder remains the explicit way to permanently change itinerary order; skip/restore do not reorder.

## Acceptance Criteria

- [ ] `DayItineraryItem` API schema includes required nullable `skippedAt` and generated TS/Go types expose it.
- [ ] Existing Day itinerary item endpoints return `skippedAt` for every item.
- [ ] New authenticated `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/skip` endpoint exists.
- [ ] New authenticated `POST /trips/{tripId}/days/{date}/itinerary/items/{itemId}/restore` endpoint exists.
- [ ] DB migration adds nullable `itinerary_items.skipped_at` and enforces that `arrived_at` and `skipped_at` cannot both be non-null.
- [ ] Successful first skip sets `skipped_at` only on the targeted ScheduleItem instance.
- [ ] Same `TripPlace` appearing in multiple itinerary items is not globally skipped when one item is skipped.
- [ ] Skip success response is `200 OK` with `day`, targeted `item`, and full ordered `items` snapshot.
- [ ] Repeat skip request for an already-skipped target returns `200 OK`, preserves original `skippedAt`, and returns latest snapshot.
- [ ] Pending target that is not the first ordered pending item returns `409 Conflict` with no mutation.
- [ ] Arrived target skip returns `409 Conflict` with no mutation.
- [ ] Successful restore clears `skipped_at` only on the targeted ScheduleItem instance.
- [ ] Restore is allowed for any skipped item even when other pending/skipped items exist.
- [ ] Repeat restore request for an already-pending target returns `200 OK` and latest snapshot.
- [ ] Arrived target restore returns `409 Conflict` with no mutation.
- [ ] Invalid trip/date/item formats return `400`.
- [ ] Non-participant access returns `403`.
- [ ] Trip, out-of-range virtual day, or item outside selected trip/day context returns `404`.
- [ ] Today selects next place as the first ordered item whose `arrivedAt` and `skippedAt` are both `null`.
- [ ] Today current place shows `스킵하기` and disables duplicate taps while skip is in flight.
- [ ] After skip success, Today updates from mutation response without mandatory follow-up itinerary fetch.
- [ ] After skip success, the next pending item becomes current and the skipped item appears in `스킵한 장소`.
- [ ] Today `남은 장소` excludes skipped items.
- [ ] Today `스킵한 장소` section is ordered by `itemOrder` and each row exposes `복구` only.
- [ ] After restore success, the restored item becomes current/next and other skipped items remain skipped.
- [ ] When all non-arrived items are skipped, Today shows recover-needed state instead of completed.
- [ ] Today completed state appears only when every item has `arrivedAt != null`.
- [ ] Empty itinerary state remains separate from completed and recover-needed states.
- [ ] Focus/app reopen recreates pending/skipped/completed state from fetched `arrivedAt`/`skippedAt` values.
- [ ] F-034 does not add Day itinerary restore UI, direct skipped-item arrival, status enum/column, or persisted current pointer.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| OpenAPI defines `skippedAt`, skip/restore endpoints, response schemas, and generated code is current | Contract/generated | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm generate && pnpm verify:generated` |
| Migration adds nullable `itinerary_items.skipped_at`, mutual-exclusion check, rollback/reapply works, existing rows keep current state | DB migration | `apps/api/migrations/*_add_itinerary_item_skipped_at.sql`, `apps/api/schema.sql` | `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate` plus rollback/reapply workflow |
| Repository skips only current first pending item, preserves duplicate TripPlace independence, and returns latest ordered snapshot | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Repository skip retry is idempotent and preserves original `skipped_at` | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Repository rejects non-first pending skip and arrived skip without mutation | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Repository restores one selected skipped item, leaves other skipped/duplicate-place items unchanged, and returns latest snapshot | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Repository restore retry on pending is idempotent; arrived restore returns conflict | API repository | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Service validates auth, UUID/date format, participant permission, virtual day range, item membership, and skip/restore conflicts | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| HTTP endpoints map success/idempotent/400/401/403/404/409 and serialize nullable `skippedAt` | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| API builds after generated server/client changes | API build | Go package build | `pnpm --filter @i-um/api build` |
| Today view model selects first pending item, filters remaining pending items, separates skipped items, and keeps empty itinerary distinct | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Today view model renders recover-needed state when all non-arrived items are skipped | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Today view model renders completed only when all items are arrived | Mobile logic | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile trip client exposes generated skip/restore wrappers with auth refresh | Mobile API helper | `apps/mobile/lib/trips/client.ts` compile/typecheck or client wrapper tests if added | `pnpm --filter @i-um/mobile typecheck` |
| Today screen mutation flow disables duplicate taps, updates from skip/restore responses, handles auth/error/conflict states, and typechecks | Mobile UI/typecheck | `apps/mobile/app/index.tsx`, helper tests | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Full repo gate before PR | All | Generated/API/mobile | `pnpm verify` |

## Regression Gaps

- Full React Native press/loading visual behavior for Today `스킵하기` and `복구` buttons may not be fully automated in the current Node-only mobile test setup.
  - Risk: a style/layout or disabled-state regression could pass helper tests.
  - Follow-up: cover by internal build smoke for skip, restore, recover-needed, and conflict/error states.

## TDD Implementation Plan

1. Red: API contract expectations
   - Add/adjust generated-usage compile points expecting `DayItineraryItem.skippedAt`, `markDayItineraryItemSkipped`, and `restoreDayItineraryItem` response types.
   - Verify: `pnpm verify:generated` should fail until OpenAPI/generated artifacts are updated.
2. Green: OpenAPI and generated code
   - Update `packages/api-contract/openapi.yaml` with `skippedAt`, skip endpoint, restore endpoint, and response schemas.
   - Run `pnpm generate`.
   - Verify: `pnpm verify:generated`.
3. Red: DB/repository skip persistence
   - Add repository tests for nullable `skipped_at`, first-pending skip success, duplicate TripPlace independence, idempotent repeat preserving timestamp, out-of-order pending conflict, arrived conflict, and latest snapshot ordering.
   - Verify: `pnpm --filter @i-um/api test` should fail.
4. Green: DB migration, queries, repository skip transaction
   - Add goose migration for `itinerary_items.skipped_at` plus `arrived_at`/`skipped_at` check and update `apps/api/schema.sql`.
   - Update sqlc queries/generated DB code as needed so all `DayItineraryItem` rows include `skipped_at`.
   - Implement repository transaction that locks same-Day rows, validates target, applies idempotent/409 skip rules, updates only target row, and returns latest ordered items.
   - Verify: DB migrate rollback/reapply workflow and `pnpm --filter @i-um/api test`.
5. Red: DB/repository restore persistence
   - Add repository tests for restoring one skipped item, keeping other skipped items unchanged, duplicate TripPlace independence, pending idempotent retry, arrived conflict, and latest snapshot ordering.
   - Verify: `pnpm --filter @i-um/api test` should fail.
6. Green: repository restore transaction
   - Implement restore transaction that locks same-Day rows, validates target, clears only target `skipped_at`, applies idempotent/409 restore rules, and returns latest ordered items.
   - Verify: `pnpm --filter @i-um/api test`.
7. Red: domain service rules
   - Add service tests for auth/validation/participant/day range/item membership, skip first-pending rule, restore-any-skipped rule, idempotent behavior, and response shape.
   - Verify: `pnpm --filter @i-um/api test` should fail.
8. Green: domain service
   - Add skip/restore input/result records and service methods.
   - Keep business rules in service/repository, not handler.
   - Verify: `pnpm --filter @i-um/api test`.
9. Red: HTTP handler/server integration
   - Add server tests for `POST .../skip` and `POST .../restore` success, idempotent success, and error mapping.
   - Verify: `pnpm --filter @i-um/api test` should fail.
10. Green: handlers and response mapping
   - Wire generated server routes to trip service.
   - Convert domain `DayItineraryItem.SkippedAt` to nullable RFC3339 `skippedAt`.
   - Map invalid state transitions to `409 Conflict`.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
11. Red: mobile Today derivation
   - Extend `apps/mobile/lib/trips/today-execution.test.mts` for first pending selection, skipped filtering, skipped section ordering, recover-needed state, completed-only-arrived state, restore promotion, and duplicate place item IDs.
   - Verify: `pnpm --filter @i-um/mobile test` should fail.
12. Green: mobile Today view model
   - Update `today-execution.ts` types and builder to derive `pending`, `skipped`, `arrived` from `arrivedAt`/`skippedAt`.
   - Add skip/restore action models and recover-needed state.
   - Verify: `pnpm --filter @i-um/mobile test`.
13. Red: mobile API/action flow
   - Add helper tests or compile assertions for skip/restore wrappers and mutation state transitions.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` should fail until wired.
14. Green: Today UI mutation wiring
   - Add generated client wrappers in `apps/mobile/lib/trips/client.ts`.
   - Update `apps/mobile/app/index.tsx` to call skip/restore endpoints, disable duplicate taps, update Today view model from responses, and show error/conflict copy.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
15. Refactor
   - Keep formatting/sorting/status derivation/API-response-to-view-state logic in `apps/mobile/lib/**` helpers.
   - Reuse theme tokens and existing Today UI patterns; no raw colors.
   - Verify: targeted API/mobile tests.
16. Gate
   - Run generated, API, mobile, migration, and full verification gates.
   - Verify: `pnpm verify:generated && pnpm --filter @i-um/api test && pnpm --filter @i-um/api build && pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck && pnpm verify`.

## Verification Plan

Before opening the implementation PR:

1. Contract/generated
   - `pnpm generate`
   - `pnpm verify:generated`
2. DB migration with local test database
   - `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`
   - rollback/reapply the new migration and confirm status
3. API
   - `pnpm --filter @i-um/api test`
   - `pnpm --filter @i-um/api build`
4. Mobile
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
5. Full gate
   - `pnpm verify`

## Verification Record

### Automated Regression

- `pnpm generate`: pass.
- `pnpm verify:generated`: pass.
- `pnpm db:rollback && pnpm db:migrate`: pass — local rollback/reapply of `00012_add_itinerary_item_skipped_at.sql` verified.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify`: pass.

### Manual Smoke

- Today skip happy path in internal build: Not run — implementation/internal build not requested.
- Today restore happy path in internal build: Not run — implementation/internal build not requested.
- Recover-needed state in internal build: Not run — implementation/internal build not requested.
- Staging API skip/restore endpoint smoke: Not run — staging deploy not requested.

## Release Notes

- Today 화면에서 현재 다음 장소를 `스킵하기`로 넘기고 다음 장소를 바로 볼 수 있습니다.
- 스킵한 장소는 `스킵한 장소` 목록에 남으며, `복구`하면 다시 현재 장소로 진행할 수 있습니다.
- 모든 미도착 장소가 스킵된 경우 Today는 완료가 아니라 복구가 필요한 상태로 보여줍니다.

## Open Questions

- None for F-034 implementation scope.

## Follow-up Issues

- Day itinerary 화면에서 skipped badge, filter, restore/history UX 제공
- 스킵 목록에서 직접 `도착 처리` shortcut 제공 여부 검토
- 도착 취소/undo와 skipped/arrived 상태 편집 flow
- optional scheduled time 기반 current/next 계산 확장 (#95)
- 여러 기기/참여자가 동시에 reorder·skip·restore할 때의 고급 conflict UX 개선
