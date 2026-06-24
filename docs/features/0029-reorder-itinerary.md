# Feature Slice: F-029 일정 순서 변경

## Metadata

- GitHub Issue: #29
- Status: Spec Review
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Ouroboros Source

- Interview Session: `interview_20260623_053757`
- Seed: `seed_6f774d1c7a94`
- PM Document: N/A
- Notes: Ambiguity score `0.0945`. Ouroboros clarified F-029 as a same-Day drag-and-drop reorder MVP with explicit save. Reorder persistence uses existing `itinerary_items`, server-owned fractional `rank`, optimistic `version`, and transactional batch move application. Realtime shared edit refresh is deferred to #46. Rank rebalance policy is deferred to #89.

## Goal

사용자가 특정 Day 일정 화면에서 같은 Day 안의 장소 방문 순서를 드래그앤드롭으로 바꾸고, 명시적으로 저장해 새 순서를 반영할 수 있다.

F-029는 순서 변경만 검증하는 최소 vertical slice다. 기존 장소 추가/수정/삭제 흐름은 변경하지 않고, 실시간 공동 편집 반영, rank rebalance, 지도/길찾기, 오늘 실행 화면은 후속 기능에서 다룬다.

## Problem

- F-025/F-026 이후 Day별 장소 목록을 조회하고 장소를 추가할 수 있지만, 잘못 추가한 순서를 앱에서 바꿀 수 없다.
- 여행 일정은 방문 순서가 핵심이므로 사용자가 Day 안의 장소 순서를 직접 정리할 수 있어야 한다.
- 단순 정수 `item_order` 전체 재번호 매기기는 동시 편집 시 충돌 폭이 커질 수 있다.
- F-029는 실시간 협업 전체를 구현하지 않으면서도, 같은 Day 순서 변경을 안전하게 저장할 수 있는 서버 권위 ordering 규칙을 먼저 고정한다.

## User Flow

1. 사용자가 로그인된 상태에서 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 앱은 기존 `GET /trips/{tripId}/days/{date}/itinerary`로 Day header와 현재 장소 목록을 보여준다.
3. 장소가 2개 이상이면 앱은 `순서 변경` action을 보여준다.
4. 사용자가 `순서 변경`을 누른다.
5. 앱은 편집 모드로 전환하고 각 장소 row에 drag handle을 보여준다.
6. 사용자가 같은 Day 안에서 장소를 드래그해 순서를 바꾼다.
7. 드래그만으로는 API를 호출하지 않는다.
8. 사용자가 `저장`을 누른다.
9. 앱은 원래 순서와 최종 순서를 비교해 move batch를 만든다. 최종 순서가 원래와 같으면 저장을 비활성화하고 API를 호출하지 않는다.
10. 앱은 generated client로 `PATCH /trips/{tripId}/days/{date}/itinerary-items/order`를 호출한다.
11. 서버는 인증, participant 권한, 날짜 범위, item/neighbor same-Day membership, moved item version을 검증한다.
12. 서버는 하나의 transaction 안에서 move batch를 순서대로 적용하고 각 move의 새 `rank`를 서버에서 계산한다.
13. batch 중 하나라도 validation, optimistic locking, rank collision retry failure로 실패하면 전체 transaction을 rollback한다.
14. 성공하면 앱은 최신 Day itinerary를 즉시 보여주고 편집 모드를 종료한다.
15. `409 CONFLICT`가 발생하면 앱은 로컬 미저장 순서를 버리고 최신 Day itinerary를 다시 불러온 뒤, 사용자가 다시 편집할 수 있게 한다.
16. 사용자가 `취소`, back, route 이탈을 하면 미저장 순서 변경은 confirmation 없이 버려진다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: Day 일정 화면의 `순서 변경` entry, drag-and-drop edit mode, `저장`/`취소`, saving/conflict/error/success state
- [ ] API Contract: authenticated `PATCH /trips/{tripId}/days/{date}/itinerary-items/order` endpoint, batch move request/response/error schemas
- [ ] API Server: reorder handler/service/repository, participant authorization, date range validation, same-Day item/neighbor validation, server-side rank computation, optimistic locking, transaction/rollback
- [ ] DB: existing `itinerary_items`에 `rank TEXT`와 `version INT` 추가. 기존 `trip_places`/`itinerary_items` model 유지. 새 `itinerary_places` table은 만들지 않는다.
- [ ] Generated Code: OpenAPI 기반 Go server artifact와 TypeScript client/type, sqlc generated DB code 갱신
- [ ] Tests: API validation/auth/conflict/success/rollback tests, repository rank/order/version tests, mobile reorder state/move-batch tests, generated/typecheck gates
- [ ] Deployment: local/staging 또는 internal build에서 Day 화면 → 순서 변경 → 저장 → 최신 순서 반영 smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 기존 장소 추가 (#26), Google Places 검색 (#27), 장소 수정/삭제 (#28) 흐름 변경
- 숙소 장소 지정 (#30)
- 오늘 실행 화면, 도착/스킵, 남은 장소 목록 (#31~#35)
- 지도/길찾기, 이동 모드, Google Maps URL 연결 (#36~#39)
- 화면을 보고 있는 중 타인의 변경을 push/polling/WebSocket/SSE로 자동 반영하는 기능 (#46)
- rank rebalance 정책/배치 작업/운영 도구 (#89)
- CRDT(Yjs/Automerge) 기반 실시간 공동 편집
- persistent `trip_days` table 또는 Day CRUD
- 다른 Day로 장소 이동
- 여러 Day를 한 번에 재정렬
- 방문 시간, 메모, 영업시간, 이동 시간 표시
- 변경자 표시, 변경 이력, undo stack
- 저장 전 미저장 변경 confirmation
- reorder용 별도 `itinerary_places` table 생성

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 기존 Day 일정 화면에 `순서 변경` action을 추가한다.
  - 장소가 2개 이상인 success state에서만 `순서 변경`을 활성화한다.
  - empty state와 장소 1개 state에서는 순서 변경 action을 숨기거나 disabled 처리한다. F-029에서는 별도 안내 문구가 필수는 아니다.
  - 편집 모드에서는 장소 row를 drag-and-drop으로 재정렬할 수 있어야 한다.
  - 편집 모드에서는 `저장`과 `취소` action을 제공한다.
  - `저장`은 원래 순서와 최종 순서가 다를 때만 활성화한다.
  - `취소`, back, route 이탈은 미저장 변경을 버린다. F-029에서는 unsaved changes confirmation을 제공하지 않는다.

정확한 drag implementation은 Expo/React Native 제약에 맞춰 구현 시 선택할 수 있다. 기존 stack에 drag list primitive가 없다면 작은 유지보수 가능한 drag list dependency를 추가할 수 있다. 단, UX는 드래그앤드롭이어야 하며 `위로/아래로 이동` 버튼만으로 대체하지 않는다.

### Reorder Edit Mode Content

편집 모드 row는 최소한 다음 정보를 유지한다.

- 현재 로컬 순서번호
- 장소명
- 장소 타입 label
- 주소
- drag handle affordance

표시하지 않는다.

- 장소 상세 CTA
- 장소 수정/삭제 CTA
- 지도/길찾기 버튼
- 도착/스킵 상태
- 실시간 공동 편집 presence

### States

- Loading: 기존 Day itinerary loading state를 유지한다.
- Empty: 기존 Day itinerary empty state를 유지한다. reorder action은 비활성/숨김이다.
- Success/View: 기존 Day itinerary success state에 `순서 변경` action을 제공한다.
- Edit: drag-and-drop list, `저장`, `취소`를 보여준다.
- No-op Edit: 최종 순서가 원래 순서와 같으면 `저장`은 disabled이고 API를 호출하지 않는다.
- Saving: 저장 중 `저장 중...`을 표시하고 drag, 저장, 취소를 중복 실행할 수 없게 한다.
- Save Success: 최신 Day itinerary를 반영하고 편집 모드를 종료한다.
- Conflict: `409 CONFLICT` 시 로컬 미저장 순서를 버리고 최신 itinerary를 refetch한다. 화면에는 `다른 변경이 있어 저장되지 않았어요. 최신 일정으로 다시 불러왔어요.`를 표시한다.
- Not Found / Forbidden: `403`, `404`, 범위 밖 날짜는 기존 non-retry 상태를 사용한다.
  - Title: `일정을 찾을 수 없어요.`
  - Helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`
- Retryable Error: network, `5xx`, unknown error는 기존 retry 가능 상태를 사용한다. 저장 실패 시 편집 모드와 로컬 순서는 유지할 수 있다.
  - Title: `순서를 저장할 수 없어요.`
  - Helper: `잠시 후 다시 시도해주세요.`

### Copy / Labels

- Reorder action: `순서 변경`
- Save action: `저장`
- Saving action: `저장 중...`
- Cancel action: `취소`
- Conflict message: `다른 변경이 있어 저장되지 않았어요. 최신 일정으로 다시 불러왔어요.`
- Save generic error title: `순서를 저장할 수 없어요.`
- Save generic error helper: `잠시 후 다시 시도해주세요.`
- Not found title: `일정을 찾을 수 없어요.`
- Not found helper: `삭제되었거나 접근할 수 없는 여행 일정이에요.`

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji를 사용하지 않는다.
- 기존 Day 일정 화면의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- drag handle은 emoji/임의 unicode가 아니라 텍스트 label 또는 일관된 line-icon source가 생긴 뒤 icon으로 표현한다.
- 같은 버튼/list/card 패턴이 반복되면 이번 변경에서 만든 중복만 공용 primitive로 정리한다. 범위를 벗어난 전체 UI refactor는 하지 않는다.

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용한다.

### Endpoints

```text
PATCH /trips/{tripId}/days/{date}/itinerary-items/order
```

Authenticated endpoint. `Authorization: Bearer <accessToken>`이 필요하다. Trip participant만 호출할 수 있으며 `date`는 trip 기간 안이어야 한다.

### Path Parameters

```text
tripId: string
date: string, format date, YYYY-MM-DD
```

### Request

Schema name: `ReorderDayItineraryItemsRequest`

```json
{
  "moves": [
    {
      "itemId": "itinerary_item_3",
      "beforeItemId": "itinerary_item_1",
      "afterItemId": "itinerary_item_2",
      "clientVersion": 4
    },
    {
      "itemId": "itinerary_item_5",
      "beforeItemId": null,
      "afterItemId": "itinerary_item_1",
      "clientVersion": 1
    }
  ]
}
```

Request schema notes:

- `moves`: required array, `minItems: 1`.
- Move order is significant. The server applies moves sequentially in the provided order inside one transaction.
- `itemId`: required itinerary item id being moved.
- `beforeItemId`: nullable string. The item that should be immediately before `itemId` after this move, or `null` when moving to the first position.
- `afterItemId`: nullable string. The item that should be immediately after `itemId` after this move, or `null` when moving to the last position.
- `clientVersion`: required integer, minimum `1`. It is the `version` observed by the client for the moved item.
- `beforeItemId` and `afterItemId` cannot both be `null`.
- `itemId`, `beforeItemId`, and `afterItemId` must be distinct when present.
- All referenced item ids must belong to the same `tripId + date`.
- For exact local intent preservation, after removing the moved item in the transaction's current order, `beforeItemId` and `afterItemId` must be valid adjacent anchors when both are provided. If the anchors no longer describe the current order because of another change, the server returns `409 CONFLICT`.

Mobile behavior:

- Mobile builds `moves` by comparing the original loaded order and the final local drag order.
- The move batch does not need to be mathematically minimal, but applying it sequentially to the original order must produce the final local order.
- If `moves` is empty, mobile disables `저장` and does not call the API.

### Response

HTTP status: `200`

Schema name: `ReorderDayItineraryItemsResponse`

```json
{
  "day": {
    "date": "2026-07-10",
    "dayOrder": 1
  },
  "items": [
    {
      "id": "itinerary_item_5",
      "itemOrder": 1,
      "version": 2,
      "place": {
        "id": "trip_place_5",
        "name": "도톤보리",
        "placeType": "food",
        "address": "Dotonbori, Chuo Ward, Osaka"
      }
    },
    {
      "id": "itinerary_item_1",
      "itemOrder": 2,
      "version": 4,
      "place": {
        "id": "trip_place_1",
        "name": "우메다 공중정원",
        "placeType": "sights",
        "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
      }
    }
  ]
}
```

Response rules:

- Response shape matches `GetDayItineraryResponse` with the addition of `version` on each `DayItineraryItem`.
- `items` are sorted by server source-of-truth rank.
- `itemOrder` is a 1-based display order calculated from rank order, not directly trusted from legacy `itinerary_items.item_order` after F-029.
- Each moved item has `version` incremented by 1 for every successful move applied to it.
- Unmoved items keep their existing version.

### Existing Schema Updates

`DayItineraryItem` gains a required `version` field:

```yaml
DayItineraryItem:
  required:
    - id
    - itemOrder
    - version
    - place
  properties:
    version:
      type: integer
      minimum: 1
```

This affects:

- `GET /trips/{tripId}/days/{date}/itinerary`
- `POST /trips/{tripId}/days/{date}/itinerary-items`
- `PATCH /trips/{tripId}/days/{date}/itinerary-items/order`

### Errors

공통 에러 포맷을 따른다.

```json
{
  "error": {
    "code": "CONFLICT",
    "message": "itinerary reorder conflict",
    "details": []
  }
}
```

- `400 VALIDATION_ERROR`: invalid `tripId`, invalid `date`, empty `moves`, invalid move shape, duplicate ids in a move, invalid `clientVersion`, referenced item/neighbor not in the selected `tripId + date`
- `401 UNAUTHORIZED`: missing/invalid auth
- `403 FORBIDDEN`: authenticated user is not a participant of the trip
- `404 NOT_FOUND`: trip does not exist, or `date` is outside `trip.startDate`~`trip.endDate`
- `409 CONFLICT`: moved item version mismatch, anchor order changed, rank collision retry failed, or another reorder conflict
- `500 INTERNAL_ERROR`: unexpected server/data error

## DB Changes

F-029 extends the existing `itinerary_items` table. It does not create a new ordering table.

### Tables

#### `itinerary_items`

Add:

```sql
rank text COLLATE "C";
version integer NOT NULL DEFAULT 1;
```

Migration notes:

1. Add `rank` nullable first.
2. Backfill existing rows in current visible order per `trip_id + scheduled_date`, using existing `item_order ASC, id ASC` as the initial order.
3. Set `rank` `NOT NULL` after backfill.
4. Add unique constraint/index for same-Day rank uniqueness.
5. Add read index supporting Day ordered lookup.

Recommended constraints/indexes:

```sql
ALTER TABLE itinerary_items ADD COLUMN rank text COLLATE "C";
ALTER TABLE itinerary_items ADD COLUMN version integer NOT NULL DEFAULT 1;

-- Backfill ranks before setting NOT NULL.

ALTER TABLE itinerary_items ALTER COLUMN rank SET NOT NULL;
ALTER TABLE itinerary_items ADD CONSTRAINT itinerary_items_version_check CHECK (version >= 1);
ALTER TABLE itinerary_items ADD CONSTRAINT itinerary_items_trip_date_rank_unique UNIQUE (trip_id, scheduled_date, rank);
CREATE INDEX itinerary_items_trip_date_rank_idx ON itinerary_items (trip_id, scheduled_date, rank);
```

Existing `item_order`:

- Keep existing `item_order` column and `itinerary_items_trip_date_order_unique` constraint for compatibility with F-025/F-026 migrations and rollback.
- After F-029, read ordering and API `itemOrder` display order use `rank`, not persisted `item_order`.
- Manual add must assign a rank after the current last rank and may continue assigning legacy `item_order = max(item_order) + 1` for compatibility.
- If a future cleanup removes or renames `item_order`, that must be a separate migration/feature.

### Constraints / Indexes

- `itinerary_items_trip_date_rank_unique`: prevents duplicate same-Day rank values.
- `itinerary_items_trip_date_rank_idx`: supports `GET /trips/{tripId}/days/{date}/itinerary` ordered by rank.
- `itinerary_items_version_check`: keeps optimistic locking versions valid.
- Existing FK constraints continue to enforce same-trip place references.

### Migration Notes

- Up migration must backfill rank deterministically from existing visible order.
- Down migration should rewrite legacy `item_order` to match current rank order before dropping `rank`/`version`, so rollback preserves visible order as much as possible.
- DB migration apply/status/rollback/apply verification is required for F-029.
- No `itinerary_places` table is created.

## Rank / Version Rules

### Rank

- `rank` is the server-owned source of truth for itinerary item ordering within a `trip_id + scheduled_date`.
- The mobile app never generates or sends rank values.
- The server computes a new rank between the current `beforeItemId` and `afterItemId` anchors.
- Rank strings must be lexicographically sortable under PostgreSQL `COLLATE "C"`.
- The exact fractional rank helper should be covered by unit tests.
- On unique rank collision (`23505` for `itinerary_items_trip_date_rank_unique`), the server may reload current anchors, recompute a rank, and retry once inside the reorder flow.
- If retry fails, the API returns `409 CONFLICT`.

### Version

- `version` is an optimistic locking integer on `itinerary_items`.
- Each successful move updates only the moved item row's `rank`, increments its `version`, and updates its `updated_at` if available/introduced by existing schema. F-029 does not require adding `updated_at` if it is not already present.
- The update must check `WHERE id = $itemId AND version = $clientVersion` or equivalent inside the transaction.
- If no row is updated because the moved item version changed, the transaction rolls back and returns `409 CONFLICT`.
- F-029 does not maintain a Day-level revision. Other participants changing different items may merge into the current server order unless they invalidate the requested move anchors or moved item version.

## Business Rules

- Only authenticated trip participants can reorder itinerary items.
- Reorder is scoped to one virtual Day identified by `tripId + date`.
- `date` must be inside `trip.startDate` through `trip.endDate`.
- All moved and neighbor itinerary item ids must belong to the same `tripId + date`.
- Moves cannot reference items from another trip, another date, deleted items, or inaccessible items.
- Dragging in the mobile UI does not persist changes.
- `저장` persists the whole move batch in one server transaction.
- Any move failure rolls back the entire batch; partial reorder is not allowed.
- Empty move batch is not submitted by mobile and is rejected by server if called directly.
- Cancel/back/route exit discards unsaved reorder state without confirmation.
- `409 CONFLICT` discards local unsaved order and refetches latest server itinerary.
- F-029 does not auto-refresh while another participant edits the same Day in the background. Shared edit reflection is handled by #46.
- F-029 does not implement rank rebalance. Rank rebalance is handled by #89.

## Acceptance Criteria

각 acceptance criterion은 아래 `Regression Test Plan`의 자동화 테스트와 연결한다.

- [x] AC-01: Day 일정 success state에서 장소가 2개 이상이면 `순서 변경` action으로 edit mode에 진입할 수 있다.
- [x] AC-02: edit mode는 drag-and-drop reorder, `저장`, `취소`를 제공한다.
- [x] AC-03: drag만으로는 API를 호출하지 않는다.
- [x] AC-04: `취소`, back, route 이탈은 미저장 순서를 버리며 confirmation을 표시하지 않는다.
- [x] AC-05: 로컬 최종 순서가 원래 순서와 같으면 `저장`이 disabled이고 API를 호출하지 않는다.
- [x] AC-06: mobile은 original order, final order, item versions로 ordered move batch를 만든다.
- [x] AC-07: `packages/api-contract/openapi.yaml`에 authenticated `PATCH /trips/{tripId}/days/{date}/itinerary-items/order` endpoint와 request/response/error schema가 정의되어 있다.
- [x] AC-08: generated Go server artifact와 TypeScript client/type이 reorder endpoint/schema와 `DayItineraryItem.version`을 포함한다.
- [x] AC-09: DB migration은 existing `itinerary_items`에 `rank`와 `version`을 추가하고 existing visible order 기준으로 rank를 backfill한다.
- [x] AC-10: DB migration rollback은 rank order 기준으로 legacy `item_order`를 보존한 뒤 `rank`/`version`을 제거할 수 있다.
- [x] AC-11: manual place append flow는 새 row에 마지막 rank 이후의 rank와 version `1`을 부여한다.
- [x] AC-12: `GET /trips/{tripId}/days/{date}/itinerary`는 rank order로 정렬하고 `itemOrder`를 1-based display order로 계산하며 각 item의 `version`을 반환한다.
- [x] AC-13: 인증되지 않은 reorder 요청은 `401 UNAUTHORIZED`를 반환한다.
- [x] AC-14: invalid `tripId`, invalid `date`, invalid move body, empty moves는 `400 VALIDATION_ERROR`를 반환한다.
- [x] AC-15: 존재하지 않는 trip 또는 범위 밖 date는 `404 NOT_FOUND`를 반환한다.
- [x] AC-16: participant가 아닌 authenticated user의 reorder 요청은 `403 FORBIDDEN`을 반환한다.
- [x] AC-17: moved item 또는 neighbor item이 같은 `tripId + date`에 속하지 않으면 `400 VALIDATION_ERROR`를 반환하고 데이터가 변경되지 않는다.
- [x] AC-18: valid move batch는 하나의 transaction에서 순서대로 적용되고 최신 ordered itinerary를 반환한다.
- [x] AC-19: batch 중 하나라도 실패하면 전체 transaction이 rollback되고 기존 rank/version/order가 보존된다.
- [x] AC-20: moved item `clientVersion`이 최신이 아니면 `409 CONFLICT`를 반환하고 데이터가 변경되지 않는다.
- [x] AC-21: rank unique collision은 서버가 1회 재시도하며, retry 실패 시 `409 CONFLICT`를 반환한다.
- [x] AC-22: 저장 성공 후 mobile은 edit mode를 종료하고 최신 Day itinerary 순서를 즉시 보여준다.
- [x] AC-23: `409 CONFLICT` 후 mobile은 `다른 변경이 있어 저장되지 않았어요. 최신 일정으로 다시 불러왔어요.`를 표시하고, 로컬 미저장 순서를 버린 뒤 최신 itinerary를 보여준다.
- [x] AC-24: F-029는 realtime shared-edit refresh, rank rebalance, CRDT, place edit/delete, cross-Day move, 지도/길찾기를 구현하지 않는다.

## Regression Test Plan

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-07, AC-08: OpenAPI reorder endpoint/schema, `DayItineraryItem.version`, generated artifacts are in sync | Contract | `packages/api-contract/openapi.yaml`, generated artifacts | `pnpm verify:generated` |
| AC-09, AC-10: migration adds/backfills rank/version and rollback preserves visible order | DB migration | `apps/api/migrations/*_add_itinerary_rank_version.sql` | `DATABASE_URL=... pnpm db:migrate && DATABASE_URL=... pnpm db:status && DATABASE_URL=... pnpm db:rollback && DATABASE_URL=... pnpm db:migrate` |
| AC-11, AC-12: append assigns rank/version, read order uses rank and computes display itemOrder | Repository/DB | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| AC-18, AC-19, AC-20, AC-21: transactional batch reorder, rollback, optimistic conflict, rank collision retry behavior | Repository/service | `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-13, AC-14, AC-15, AC-16, AC-17: auth, validation, not found, forbidden, same-Day membership errors | API handler/service | `apps/api/internal/server/server_test.go`, `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| AC-01, AC-02, AC-03, AC-04, AC-05, AC-06: mobile edit state, no-op save disable, cancel discard, move batch generation | Mobile logic/state | `apps/mobile/lib/trips/reorder-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-22, AC-23: mobile save success/conflict state mapping and latest itinerary handling | Mobile logic/state/type | `apps/mobile/lib/trips/reorder-itinerary.test.mts`, TypeScript gate | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| AC-24: scoped exclusions remain unimplemented | Static review/generated drift | OpenAPI routes, mobile routes, DB migrations | `pnpm verify:generated` |
| All ACs: full regression gate remains green | All | workspace verify | `pnpm verify` |

## Regression Gaps

- Native drag gesture behavior is not fully covered by the current pure Node mobile test setup.
  - Automated coverage retained: move-batch generation, edit-state transitions, no-op/submit/conflict behavior, and TypeScript screen integration.
  - Risk: drag handle wiring or gesture-library behavior may regress without simulator/internal build smoke.
  - Follow-up: add mobile component/e2e gesture harness in a later testing slice.
- True concurrent database race timing may be hard to deterministically reproduce in unit tests.
  - Automated coverage retained: service/repository tests for version mismatch, transaction rollback, and rank collision retry using controlled fixtures/fakes.
  - Risk: rare production concurrency interleavings may require additional integration/load tests later.
  - Follow-up: revisit with #46 shared-edit reflection or #89 rank rebalance if conflict frequency is observed.

## TDD Implementation Plan

1. Red: API contract and handler/service test matrix
   - Add failing tests for `PATCH /trips/{tripId}/days/{date}/itinerary-items/order`: 401, invalid params/body, missing trip, out-of-range date, forbidden, same-Day membership validation, success, conflict.
   - Verify: `pnpm --filter @i-um/api test` fails before implementation.
2. Red: Repository and migration tests
   - Add failing storage tests for rank backfill assumptions, rank-ordered reads, append rank/version, successful batch reorder, rollback on mid-batch failure, stale version conflict, and rank collision retry.
   - Verify: `pnpm --filter @i-um/api test` fails before implementation.
3. Red: Mobile reorder helper/state tests
   - Add failing `apps/mobile/lib/trips/reorder-itinerary.test.mts` for edit entry eligibility, reorder state, no-op save disabled, move batch generation, cancel discard, saving state, success, conflict refresh state.
   - Verify: `pnpm --filter @i-um/mobile test` fails before implementation.
4. Contract: OpenAPI first
   - Add reorder endpoint, request/response schemas, `DayItineraryItem.version`, and `409` error response.
   - Regenerate Go/TypeScript artifacts.
   - Verify: `pnpm generate && pnpm verify:generated` passes.
5. DB migration and sqlc queries
   - Add migration for `rank`, `version`, backfill, rank unique/index, rollback order preservation.
   - Add/update sqlc queries for rank-ordered read, append rank, batch reorder transaction helpers, and version checks.
   - Verify: DB migration apply/status/rollback/apply and `pnpm --filter @i-um/api test`.
6. API domain implementation
   - Add trip service input/types for reorder batch.
   - Validate auth, trip id/date, date range, participant, move shape, same-Day item/neighbor membership, version conflicts.
   - Apply moves sequentially in one transaction and map errors to common error format.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.
7. Mobile implementation
   - Add generated-client wrapper for reorder endpoint.
   - Add Day screen edit mode, drag-and-drop list, save/cancel/no-op/ saving/conflict handling.
   - Ensure success exits edit mode and conflict discards local order after refetch.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
8. Refactor
   - Remove duplication introduced by F-029 only. Keep unrelated Day/add/search UI untouched.
   - Verify related API/mobile tests pass.
9. Regression gate
   - Verify: `pnpm verify`.
10. Manual smoke
   - Verify Day 화면 with 2+ places → `순서 변경` → drag → `저장` → new order persists after leaving/re-entering.
   - Verify `취소` discards local order.
   - Verify conflict state if feasible with two clients or seeded stale version.

## Verification Plan

### Automated Regression

```text
pnpm generate
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
DATABASE_URL=... pnpm db:migrate
DATABASE_URL=... pnpm db:status
DATABASE_URL=... pnpm db:rollback
DATABASE_URL=... pnpm db:migrate
pnpm verify
```

Verification notes:

- 2026-06-23: `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback && DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate && DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status` passed in `.worktrees/F029-reorder-itinerary`.
- 2026-06-23: `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test` passed in `.worktrees/F029-reorder-itinerary`.
- 2026-06-23: `pnpm verify` passed in `.worktrees/F029-reorder-itinerary`.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 장소가 2개 이상 있는 Day 일정 화면을 연다.
- [ ] `순서 변경`을 눌러 edit mode에 진입한다.
- [ ] 장소를 drag-and-drop으로 재정렬한다.
- [ ] 순서가 변경되면 `저장`이 활성화되는지 확인한다.
- [ ] `저장` 후 편집 모드가 종료되고 새 순서가 표시되는지 확인한다.
- [ ] Day 화면을 나갔다가 다시 들어와도 새 순서가 유지되는지 확인한다.
- [ ] `취소` 또는 back 후 미저장 변경이 버려지는지 확인한다.
- [ ] 가능하면 stale version 또는 두 클라이언트 상황에서 conflict 메시지와 최신 순서 refetch를 확인한다.
- [ ] staging 또는 internal build에서 reorder happy path를 확인한다.

## Release Notes

```text
- Day 일정 화면에서 같은 Day 안의 장소 방문 순서를 드래그앤드롭으로 변경할 수 있습니다.
- 순서 변경은 저장 버튼을 눌렀을 때만 반영되며, 다른 변경과 충돌하면 최신 일정으로 다시 불러옵니다.
```

## Open Questions

None for F-029 spec review.

## Follow-up Issues

- #30: 숙소 장소 지정
- #46: 공동 일정 편집 반영. 화면을 보고 있는 중 타인의 일정 변경을 감지/안내/refetch하는 UX를 다룬다.
- #89: 일정 순서 rank rebalance 정책. fractional rank 장기 안정성, rank 길이/소진 대응, 재분배 운영 정책을 다룬다.
