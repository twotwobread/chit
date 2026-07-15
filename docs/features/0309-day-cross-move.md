# Feature Slice: F-309 Day 간 일정 이동 지원

## Metadata

- GitHub Issue: #309
- Status: Draft — awaiting spec review/approval before implementation
- Created: 2026-07-15
- Updated: 2026-07-15

## Source

- Issue: #309 — [일정] Day 간 일정 이동 지원
- Harness run: `.harness/runs/F309-day-cross-move`
- Provider notes: policy selected `ouroboros-spec-author`; MCP interview/auto attempts timed out before persisted seed generation, so this spec records the issue-derived assumptions explicitly.

## Goal

사용자가 일정 탭에서 하나 이상의 schedule item을 선택해 같은 여행의 다른 active Day 마지막 순서로 이동할 수 있다.

이동은 항목의 장소/제목/시간/메모를 유지하고, Day 실행 맥락에 묶인 도착/스킵 상태는 초기화한다. schedule-item anchored expense는 같은 schedule item을 계속 가리키되 target Day로 함께 재앵커링하고, `expenseDate`는 바꾸지 않는다.

## Product Decisions and Assumptions

- MVP는 선택한 schedule item들을 target Day의 마지막에 append한다.
- 이동 항목 간 상대 순서는 source Day에서 보이던 순서를 기준으로 유지한다. 체크한 순서가 아니다.
- Target Day 안의 세부 순서 조정은 기존 같은 Day `순서 변경` 기능으로 처리한다.
- Target Day 선택지는 같은 여행의 active/non-deleted Day이며 source Day는 제외한다. 일정이 없는 빈 Day도 포함한다.
- 이 slice는 past/completed/locked Day 같은 새 eligibility 규칙을 만들지 않는다.
- source Day와 target Day가 같은 요청은 모바일에서 막고 API에서도 400으로 거부한다.
- stale version, source/target ordering conflict, selected item이 더 이상 source Day에 없는 경우에는 전체 move가 409로 원자적으로 실패한다. 부분 성공이나 자동 재시도는 하지 않는다.
- 409 후 모바일은 최신 일정을 다시 불러오고 사용자가 다시 선택/재시도할 수 있게 한다.

## Scope

### In

- 일정 탭 multi-select move mode.
- Target Day picker with Day number/date.
- Cross-Day move OpenAPI contract and generated client/server code.
- API service/repository transaction for moving schedule items, appending to target tail, resetting arrived/skipped state, and re-anchoring schedule-item expenses.
- Source/target Day refresh/navigation after success.
- Recoverable conflict handling.
- API/DB/mobile tests for single move, multi move, relative order preservation, expense re-anchor, status reset, and conflict rollback.

### Out

- Day 간 drag-and-drop.
- Target Day 내 위치 선택.
- Copy/clone or moving to multiple Days.
- Lodging move.
- Day-level/trip-level expense move.
- Recurring schedules/templates.
- Realtime collaboration beyond existing refresh/conflict behavior.

## UX Requirements

### Entry and selection

- Show `다른 Day로 이동` when the current Day has at least one schedule item and there is at least one other active Day.
- Keep existing `순서 변경` as a separate same-Day reorder mode.
- Move mode shows selectable rows, selected count, `취소`, and a disabled move/next action until at least one row is selected.
- Normal row edit/delete/reorder/lodging actions are disabled while move mode is active.

### Target Day picker

- Show active Days from the same trip with `Day N` and formatted date.
- Exclude the source Day.
- Include empty Days.
- Selecting a target proceeds to confirmation if needed, then submit.

### Status reset confirmation

- If any selected item has `arrivedAt` or `skippedAt`, show confirmation before calling the API.
- Suggested copy:
  - Title: `진행 상태를 초기화할까요?`
  - Helper: `도착/건너뛴 일정은 다른 Day로 이동하면 진행 상태가 초기화돼요.`
  - Confirm: `이동`
  - Cancel: `취소`

### Success and errors

- On success, exit move mode, refresh schedule state, and navigate/reload so the target Day shows the appended items.
- Source Day no longer includes moved items when revisited/refreshed.
- On 409 conflict, show recoverable copy and refresh latest schedule state.
  - Suggested copy: `다른 변경이 있어 이동하지 못했어요. 최신 일정으로 다시 불러왔어요.`
- On retryable non-conflict errors, keep selections when practical and show retryable failure copy.

## API Contract

Add:

```text
POST /trips/{tripId}/days/{sourceTripDayId}/schedule-items/move
operationId: moveScheduleItemsToDay
```

### Request

```yaml
MoveScheduleItemsToDayRequest:
  required: [targetTripDayId, scheduleItems]
  properties:
    targetTripDayId: string
    scheduleItems:
      type: array
      minItems: 1
      items:
        $ref: '#/components/schemas/MoveScheduleItemInput'

MoveScheduleItemInput:
  required: [scheduleItemId, clientVersion]
  properties:
    scheduleItemId: string
    clientVersion:
      type: integer
      minimum: 1
```

- Duplicate `scheduleItemId`s are invalid.
- The client should send selected items sorted by current source Day order.

### Response

```yaml
MoveScheduleItemsToDayResponse:
  required:
    - sourceDay
    - sourceScheduleItems
    - targetDay
    - targetScheduleItems
    - movedScheduleItemIds
  properties:
    sourceDay: TripDay
    sourceScheduleItems: ScheduleItem[]
    targetDay: TripDay
    targetScheduleItems: ScheduleItem[]
    movedScheduleItemIds: string[]
```

### Status codes

- `200`: moved successfully; response contains latest ordered source and target snapshots.
- `400`: malformed ids, empty/duplicate items, source == target, or target not active/same-trip.
- `401`/`403`: existing auth behavior.
- `404`: trip/source Day/target Day not found.
- `409`: stale item version, selected item no longer active in source Day, rank/order conflict, or transaction conflict. No partial move is committed.

## DB and Transaction Requirements

No schema migration is expected.

Inside one transaction:

1. Authorize participant and validate source/target active Days.
2. Acquire source/target Day schedule-order locks in deterministic order.
3. Load active source and target schedule rows `FOR UPDATE`.
4. Validate all selected rows are still active in the source Day and match client versions.
5. Derive moved order from source rank order.
6. Remove moved rows from source and append them after the current target tail.
7. Update moved `schedule_items`:
   - `trip_day_id = targetTripDayId`
   - append rank/order in target Day
   - `version = version + 1`
   - `arrived_at = NULL`
   - `skipped_at = NULL`
   - `updated_at = now()`
8. Recompute or safely assign source/target `item_order` values to preserve uniqueness.
9. Update only schedule-item anchored expenses for moved rows:
   - `trip_day_id = targetTripDayId`
   - keep `schedule_item_id` unchanged
   - keep `expense_date` unchanged
10. Return latest source and target schedule snapshots ordered by rank.

Trip-level and Day-level expenses must remain unchanged.

## Mobile Implementation Notes

- Pass active trip Days from the itinerary tab shell into `DayItineraryEditor` so the move flow can build target options.
- Add a focused helper module for move mode state/request building, similar to existing reorder helpers.
- Extend controller local state and shared-update protection so move mode blocks background refresh like reorder/edit/delete.
- Add an API client wrapper for `moveScheduleItemsToDay` after generated client update.
- After success, use the response and/or route param update to show the target Day with moved items at the end.

## Acceptance Criteria

- [ ] 사용자는 일정 탭에서 일정 1개 이상을 선택하고 `다른 Day로 이동`을 실행할 수 있다.
- [ ] target Day 선택 목록에는 같은 여행의 active Day들이 Day 번호/날짜와 함께 표시된다.
- [ ] source Day와 같은 Day를 target으로 선택할 수 없다. API same-Day request는 400이다.
- [ ] 이동 성공 후 항목들은 target Day 마지막에 source Day 기준 선택 순서대로 추가된다.
- [ ] source Day에서는 이동한 항목들이 사라지고, target Day에서는 이동한 항목들이 보인다.
- [ ] 이동 항목의 장소/제목/시간/메모는 유지된다.
- [ ] 이동 항목의 arrived/skipped 상태는 초기화된다.
- [ ] arrived/skipped 상태가 있는 항목을 이동하려면 사용자가 확인해야 한다.
- [ ] 이동 항목에 연결된 schedule-item 지출은 같은 schedule item을 가리키되 target Day anchor로 갱신된다.
- [ ] 지출의 결제일자(`expenseDate`)는 이동으로 변경되지 않는다.
- [ ] source/target Day rank/order와 expense re-anchor는 한 transaction 안에서 원자적으로 갱신된다.
- [ ] stale version/conflict는 사용자에게 복구 가능한 오류로 표시되고 부분 이동은 발생하지 않는다.
- [ ] API/DB/mobile tests가 단일 이동, 다중 이동, 상대 순서 보존, 지출 재앵커링, 상태 초기화, conflict를 검증한다.

## Regression Test Plan

| Behavior | Layer | Command |
|---|---|---|
| New OpenAPI route/schemas generate client/server code | Contract | `pnpm generate && pnpm verify:generated` |
| Request validation, auth, active source/target Days, same-Day rejection | API service/handler | `pnpm --filter @i-um/api test` |
| Single move appends to target tail and refreshes source/target snapshots | API repository | `pnpm --filter @i-um/api test` |
| Multi move preserves source-order relative order | API repository/service | `pnpm --filter @i-um/api test` |
| Moved item place/title/time/memo preserved, arrived/skipped reset | API repository | `pnpm --filter @i-um/api test` |
| Schedule-item expenses re-anchor tripDayId and preserve expenseDate | API repository | `pnpm --filter @i-um/api test` |
| Trip-level and Day-level expenses remain unchanged | API repository | `pnpm --filter @i-um/api test` |
| Stale version/source item conflict rolls back schedule and expense changes | API repository/service | `pnpm --filter @i-um/api test` |
| Move action visibility, target options, selected source-order request, confirmation gating, success/conflict states | Mobile unit | `pnpm --filter @i-um/mobile test` |
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

None. The conflict and target eligibility assumptions above should be reviewed before implementation.

## Follow-up Issues

- None.
