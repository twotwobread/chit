# Feature Slice: F-309 Day 간 일정 이동 지원

## Metadata

- GitHub Issue: #309
- Status: Approved for implementation
- Created: 2026-07-15
- Updated: 2026-07-15

## Source

- Issue: #309 — [일정] Day 간 일정 이동 지원
- Harness run: `.harness/runs/F309-day-cross-move`
- Scope revision: User approved reducing the MVP from multi-select batch move to a single-item row swipe move to reduce conflict surface and simplify mobile UX.

## Goal

사용자가 일정 탭에서 일정 row를 오른쪽으로 스와이프해 `이동` 액션을 누르고, 같은 여행의 다른 active Day를 선택해 해당 schedule item 1개를 target Day 마지막 순서로 이동할 수 있다.

이동은 항목의 장소/제목/시간/메모를 유지하고, Day 실행 맥락에 묶인 도착/스킵 상태는 초기화한다. schedule-item anchored expense는 같은 schedule item을 계속 가리키되 target Day로 함께 재앵커링하고, `expenseDate`는 바꾸지 않는다.

## Product Decisions and Assumptions

- 이번 MVP는 한 번에 schedule item 1개만 이동한다.
- 기존 row swipe 삭제 액션의 왼쪽에 `이동` 액션을 추가한다.
- Multi-select batch move는 이번 scope에서 제외하고 follow-up으로 남긴다.
- 이동한 schedule item은 target Day의 마지막에 append한다.
- Target Day 안의 세부 순서 조정은 기존 같은 Day `순서 변경` 기능으로 처리한다.
- Target Day 선택지는 같은 여행의 active/non-deleted Day이며 source Day는 제외한다. 일정이 없는 빈 Day도 포함한다.
- 이 slice는 past/completed/locked Day 같은 새 eligibility 규칙을 만들지 않는다.
- source Day와 target Day가 같은 요청은 모바일에서 선택 불가능하고 API에서도 400으로 거부한다.
- stale version, source/target ordering conflict, selected item이 더 이상 source Day에 없는 경우에는 move가 409로 원자적으로 실패한다.
- 409 후 모바일은 최신 일정을 다시 불러오고 사용자가 다시 시도할 수 있게 한다.

## Scope

### In

- 일정 row swipe action에 `이동` 버튼 추가.
- Target Day picker with Day number/date.
- Cross-Day single schedule item move OpenAPI contract and generated client/server code.
- API service/repository transaction for moving one schedule item, appending it to target tail, resetting arrived/skipped state, and re-anchoring schedule-item expenses.
- Source/target Day refresh/navigation after success.
- Recoverable conflict handling.
- API/DB/mobile tests for single move, expense re-anchor, status reset, source/target refresh, and conflict rollback.

### Out

- Multi-select batch move.
- Day 간 drag-and-drop.
- Target Day 내 위치 선택.
- Copy/clone or moving to multiple Days.
- Lodging move.
- Day-level/trip-level expense move.
- Recurring schedules/templates.
- Realtime collaboration beyond existing refresh/conflict behavior.

## UX Requirements

### Row action entry

- Existing schedule item row swipe currently exposes delete. Add `이동` as a second swipe action next to delete.
- Recommended visual/order when swiped: `[이동] [삭제]`, with `이동` left of delete.
- `이동` is shown only for normal itinerary rows while not in reorder/edit/delete/lodging mutation state.
- Existing `순서 변경` remains separate and unchanged.

### Target Day picker

- Tapping `이동` opens a target Day picker.
- Show active Days from the same trip with `Day N` and formatted date.
- Exclude the source Day.
- Include empty active Days.
- If there is no other active Day, do not expose the move action.

### Status reset confirmation

- If the selected item has `arrivedAt` or `skippedAt`, show confirmation before calling the API.
- Suggested copy:
  - Title: `진행 상태를 초기화할까요?`
  - Helper: `도착/건너뛴 일정은 다른 Day로 이동하면 진행 상태가 초기화돼요.`
  - Confirm: `이동`
  - Cancel: `취소`

### Success and errors

- On success, close the picker, refresh schedule state, and navigate/reload so the target Day shows the moved item at the end.
- Source Day no longer includes the moved item when revisited/refreshed.
- On 409 conflict, show recoverable copy and refresh latest schedule state.
  - Suggested copy: `다른 변경이 있어 이동하지 못했어요. 최신 일정으로 다시 불러왔어요.`
- On retryable non-conflict errors, keep the target picker or let the user retry when practical and show retryable failure copy.

## API Contract

Add:

```text
POST /trips/{tripId}/days/{sourceTripDayId}/schedule-items/{scheduleItemId}/move
operationId: moveScheduleItemToDay
```

### Request

```yaml
MoveScheduleItemToDayRequest:
  additionalProperties: false
  required: [targetTripDayId, clientVersion]
  properties:
    targetTripDayId:
      type: string
    clientVersion:
      type: integer
      minimum: 1
```

### Response

```yaml
MoveScheduleItemToDayResponse:
  additionalProperties: false
  required:
    - sourceDay
    - sourceScheduleItems
    - targetDay
    - targetScheduleItems
    - movedScheduleItem
  properties:
    sourceDay:
      $ref: '#/components/schemas/TripDay'
    sourceScheduleItems:
      type: array
      items:
        $ref: '#/components/schemas/ScheduleItem'
    targetDay:
      $ref: '#/components/schemas/TripDay'
    targetScheduleItems:
      type: array
      items:
        $ref: '#/components/schemas/ScheduleItem'
    movedScheduleItem:
      $ref: '#/components/schemas/ScheduleItem'
```

### Status codes

- `200`: moved successfully; response contains latest ordered source and target snapshots.
- `400`: malformed ids, source == target, invalid clientVersion, or target not active/same-trip.
- `401`/`403`: existing auth behavior.
- `404`: trip/source Day/target Day/schedule item not found.
- `409`: stale item version, selected item no longer active in source Day, rank/order conflict, or transaction conflict. No partial move is committed.

## DB and Transaction Requirements

No schema migration is expected unless implementation proves the existing composite FK cannot be preserved atomically. If that happens, stop and re-triage before adding a migration.

Inside one transaction:

1. Authorize participant and validate source/target active Days.
2. Acquire source/target Day schedule-order locks in deterministic order.
3. Load the source schedule item and target tail state `FOR UPDATE`.
4. Validate the schedule item is still active in the source Day and matches `clientVersion`.
5. Generate an append rank after the current target tail. Rebalance target ranks only if existing helpers require it.
6. Update the moved `schedule_items` row:
   - `trip_day_id = targetTripDayId`
   - append rank/order in target Day
   - `version = version + 1`
   - `arrived_at = NULL`
   - `skipped_at = NULL`
   - `updated_at = now()`
7. Recompute or safely assign source/target `item_order` values to preserve uniqueness.
8. Update only schedule-item anchored expenses for the moved row:
   - `trip_day_id = targetTripDayId`
   - keep `schedule_item_id` unchanged
   - keep `expense_date` unchanged
9. Return latest source and target schedule snapshots ordered by rank.

Trip-level and Day-level expenses must remain unchanged.

## Mobile Implementation Notes

- Pass active trip Days from the itinerary tab shell into `DayItineraryEditor` so the move picker can build target options.
- Add a focused helper module for single-item move state/request building.
- Add an API client wrapper for `moveScheduleItemToDay` after generated client update.
- Extend shared-update local state so a pending move picker/save blocks background auto-apply like reorder/edit/delete.
- Add `onRequestDayChange?: (dayId: string) => void` to `DayItineraryEditor` so success can show the target Day.
- After success, update the selected Day to `targetDay.id`; the target response already includes the moved item at the end.

## Acceptance Criteria

- [ ] 사용자는 일정 row를 swipe해 `이동` 액션을 실행할 수 있다.
- [ ] `이동` 액션은 기존 swipe 삭제 액션과 함께 표시된다.
- [ ] target Day 선택 목록에는 같은 여행의 active Day들이 Day 번호/날짜와 함께 표시된다.
- [ ] source Day와 같은 Day를 target으로 선택할 수 없다. API same-Day request는 400이다.
- [ ] 이동 성공 후 해당 item은 target Day 마지막에 추가된다.
- [ ] source Day에서는 이동한 item이 사라지고, target Day에서는 이동한 item이 보인다.
- [ ] 이동 item의 장소/제목/시간/메모는 유지된다.
- [ ] 이동 item의 arrived/skipped 상태는 초기화된다.
- [ ] arrived/skipped 상태가 있는 item을 이동하려면 사용자가 확인해야 한다.
- [ ] 이동 item에 연결된 schedule-item 지출은 같은 schedule item을 가리키되 target Day anchor로 갱신된다.
- [ ] 지출의 결제일자(`expenseDate`)는 이동으로 변경되지 않는다.
- [ ] source/target Day rank/order와 expense re-anchor는 한 transaction 안에서 원자적으로 갱신된다.
- [ ] stale version/conflict는 사용자에게 복구 가능한 오류로 표시되고 부분 이동은 발생하지 않는다.
- [ ] API/DB/mobile tests가 단일 이동, 지출 재앵커링, 상태 초기화, conflict rollback을 검증한다.

## Regression Test Plan

| Behavior | Layer | Command |
|---|---|---|
| New OpenAPI route/schemas generate client/server code | Contract | `pnpm generate && pnpm verify:generated` |
| Request validation, auth, active source/target Days, same-Day rejection | API service/handler | `pnpm --filter @i-um/api test` |
| Single move appends to empty/non-empty target tail and refreshes source/target snapshots | API repository | `pnpm --filter @i-um/api test` |
| Moved item place/title/time/memo preserved, arrived/skipped reset | API repository | `pnpm --filter @i-um/api test` |
| Schedule-item expenses re-anchor tripDayId and preserve expenseDate | API repository | `pnpm --filter @i-um/api test` |
| Trip-level and Day-level expenses remain unchanged | API repository | `pnpm --filter @i-um/api test` |
| Stale version/source item conflict rolls back schedule and expense changes | API repository/service | `pnpm --filter @i-um/api test` |
| Move action visibility, target options, request builder, confirmation gating, success/conflict states | Mobile unit | `pnpm --filter @i-um/mobile test` |
| Mobile route/controller/screen changes typecheck | Mobile static | `pnpm --filter @i-um/mobile typecheck` |

## Verification Record

- `pnpm generate`: not run yet
- `pnpm verify:generated`: not run yet
- `pnpm --filter @i-um/api test`: not run yet
- `pnpm --filter @i-um/api build`: not run yet
- `pnpm --filter @i-um/mobile test`: not run yet
- `pnpm --filter @i-um/mobile typecheck`: not run yet
- Manual smoke: not run yet

## Open Questions

None.

## Follow-up Issues

- Batch move of multiple schedule items, if user feedback shows the single-item swipe flow is too repetitive.
