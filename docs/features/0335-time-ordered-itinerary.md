# Feature Slice: F-335 시간 입력 일정 시간순 정렬

## Metadata

- GitHub Issue: #335
- Status: Implemented
- Created: 2026-07-19
- Updated: 2026-07-19
- Harness run: `.harness/runs/F335-time-ordered-itinerary`

## Source

- Issue: #335 — `[일정] 시간이 입력된 일정은 시간순으로 정렬`
- User clarification:
  - 시간이 지정된 일정 다음 일정의 시작 시간을 지정할 때 spinner 기본값은 이전 시간 지정 일정의 종료 시간이다.
  - 종료 시간 설정에는 `+30분`, `+1시간`, `+2시간` 빠른 버튼을 제공한다.
- Related specs:
  - F-095 introduced optional `startTime`/`endTime` while keeping rank as ordering source.
  - F-231 explicitly did not auto-reorder after time edits; F-335 changes that product behavior for display/execution order.
  - F-029 owns manual reorder/rank persistence.

## Goal

사용자는 시간이 지정된 일정끼리는 자연스러운 시간순으로 보고 실행하되, 시간 미정 일정은 사용자가 정한 수동 위치에 남겨 시간 지정 일정들 사이에도 둘 수 있다. 시간 입력 UX는 이전 일정 종료 시간과 빠른 종료 시간 버튼으로 더 빠르게 설정할 수 있다.

## Scope

### In

- Mobile ordering helper for schedule items:
  - valid `startTime` exists: sort timed items by `startTime ASC`, then `itemOrder ASC`.
  - no valid `startTime`: preserve the item’s manual `itemOrder` slot so untimed items can appear between timed items.
- Apply the shared ordering helper to Day itinerary/timeline, Today execution, map route layer, and quick-expense schedule selector.
- Visible sequence badges/markers should follow the displayed order where the surface presents an order sequence.
- Start-time wheel default:
  - For an item without `startTime`, seed from the previous valid timed item’s `endTime` in current Day order when available.
  - Existing `startTime` is not overwritten.
  - Missing/invalid previous `endTime` falls back to the existing default.
- End-time quick buttons: `+30분`, `+1시간`, `+2시간` accumulate from the current valid end time, falling back to start time when no valid end time exists.
- Reorder mode copy/constraint clarity for timed-range reorder and untimed slot preservation.

### Out

- DB migrations or schema changes.
- Server ordering source-of-truth changes beyond extending the existing reorder endpoint with optional time updates.
- Time overlap warnings.
- Travel/stay duration recommendations.
- Route optimization.
- Calendar-style drag-and-drop.
- Overnight schedule support.

## Requirements

### Ordering

- Timed items sort by `startTime ASC` among timed slots.
- Same-time timed items retain manual `itemOrder`/rank order.
- Untimed items are excluded from time sorting and keep their manual `itemOrder` slots, including positions between timed items.
- Invalid/missing `startTime` is treated as untimed defensively.
- The same helper must drive Day list/timeline, Today next-place selection, map route order, and quick-expense schedule selector.

### Time Editor UX

- Opening start-time selection for an item without a start time uses the previous valid timed item’s `endTime` as the wheel value when available.
- Opening start-time selection for an item that already has a start time keeps the existing value.
- End-time selection shows quick buttons:
  - `+30분`
  - `+1시간`
  - `+2시간`
- When end time is first opened, the default end time is the same as `startTime` when valid.
- A quick button adds its duration to the current valid `endTime`; if `endTime` is absent, it uses `startTime` as the base.
- A quick button is unavailable/no-op if there is no valid base time or if the result would exceed `23:59`.

### Reorder UX

- Manual rank remains the persisted ordering source and tie-breaker.
- Timed display order is controlled by `startTime`.
- Reorder mode copy must explain that timed reorder preserves each schedule's duration and the existing gaps between timed slots.
- When multiple schedules have valid `startTime` and `endTime`, drag reorder reassigns time ranges using the selected “duration 유지 + 기존 gap 유지” policy:
  - Preserve each moved schedule item’s own duration.
  - Preserve the gap after each original timed slot.
  - Keep the first original timed slot start as the first reassigned start.
  - Apply rank moves and time updates in one API transaction.

### API Contract

- Extend `ReorderScheduleItemsRequest` with optional `timeUpdates`.
- Each time update includes:
  - `scheduleItemId`
  - client-observed `expectedStartTime` / `expectedEndTime`
  - target `startTime` / `endTime`
- The server validates referenced items belong to the same Day, expected times still match the current row, and target times are valid before applying updates in the existing reorder transaction.

## Acceptance Criteria

- [x] AC-01: In a same-Day itinerary, items with `startTime` are sorted by `startTime` ascending among timed slots.
- [x] AC-02: Items with the same `startTime` retain `itemOrder`/rank order as tie-breaker.
- [x] AC-03: Untimed items retain manual `itemOrder` slots and can appear between timed items.
- [x] AC-04: Adding/editing a time reorders timed items after the existing save/reload flow without forcing untimed items to the bottom.
- [x] AC-05: Clearing `startTime` makes the item keep its manual untimed slot after save/reload.
- [x] AC-06: Today next-place selection uses the same timed-slot ordering.
- [x] AC-07: Map route-layer waypoints use the same timed-slot ordering.
- [x] AC-08: Quick expense schedule selector uses the same timed-slot ordering.
- [x] AC-09: Start-time wheel for an item without start time defaults to the previous valid timed item’s `endTime` when available.
- [x] AC-10: Start-time wheel for an item with existing start time keeps the existing value.
- [x] AC-11: The default end time is the same as `startTime` when valid.
- [x] AC-12: `+30분`, `+1시간`, `+2시간` buttons add to the current end time when present, otherwise to the start time.
- [x] AC-13: Quick duration buttons do not set invalid overflow times beyond `23:59`.
- [x] AC-14: Reorder mode copy/constraints clarify duration-and-gap-preserving timed reorder behavior.
- [x] AC-15: Reordering timed range items sends rank moves and time updates in one request.
- [x] AC-16: The API applies reorder moves and matching expected time updates inside one transaction.
- [x] AC-17: The API rejects stale time updates when current start/end no longer match the request's expected values.
- [x] AC-18: Focused API/mobile tests cover ordering, consumers, start defaulting, cumulative quick duration buttons, and timed reorder time updates.

## Implementation Plan

1. RED/GREEN: Add shared schedule ordering/default resolver helper and tests.
2. RED/GREEN: Update Day itinerary tests and adopt timed-slot ordering/display labels.
3. RED/GREEN: Update Today execution tests and ordering.
4. RED/GREEN: Update map route tests and ordering/marker labels.
5. RED/GREEN: Update quick-expense selector tests and ordering.
6. RED/GREEN: Update schedule-time-editor tests for default start time, start-equal default end time, and cumulative quick duration buttons.
7. RED/GREEN: Extend OpenAPI reorder request with optional `timeUpdates`, regenerate artifacts, and add API service/repository/server coverage.
8. RED/GREEN: Compute duration-and-gap-preserving time updates in mobile reorder helpers and send them with reorder moves.
9. Wire `ScheduleTimeEditor` quick buttons and optional default start time prop.
10. Pass edit default start time from the current Day view model into edit panels.
11. Update reorder helper copy.
12. Run generated/API/mobile tests, typecheck/build, and harness checks.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-01~AC-03, AC-09 | Mobile helper | `apps/mobile/lib/trips/schedule-item-ordering.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-01~AC-05 | Mobile helper | `apps/mobile/lib/trips/day-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-06 | Mobile helper | `apps/mobile/lib/trips/today-execution.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-07 | Mobile helper | `apps/mobile/lib/trips/trip-map.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-08 | Mobile helper | quick-expense/expense selector tests | `pnpm --filter @i-um/mobile test` |
| AC-10~AC-13 | Mobile helper | `apps/mobile/lib/trips/schedule-time-editor.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-15 | Mobile helper | `apps/mobile/lib/trips/reorder-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-16~AC-17 | API service/repository/server | `apps/api/internal/trip/service_test.go`, `apps/api/internal/storage/trip_repository_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Contract/generated sync | API contract | OpenAPI/generated artifacts | `pnpm generate && pnpm verify:generated` |
| Type-safe UI wiring | Mobile | TypeScript | `pnpm --filter @i-um/mobile typecheck` |

## Verification

- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm --filter @i-um/mobile format:check`: pass.
- `pnpm --filter @i-um/mobile lint`: pass.
- `pnpm lint`: pass.
- `pnpm format:check`: pass.
- `pnpm harness:validate`: pass.
- `node .harness/scripts/check-mobile-context-bound-ui.mjs --repo-root .`: pass.
- `node .harness/scripts/check-bugfix-scenario-coverage.mjs --run-dir .harness/runs/F335-time-ordered-itinerary`: pass, non-bugfix skipped.
- `pnpm harness:check-worktree-isolation`: pass.
- `git diff --check`: pass.
- `pnpm verify`: pass.

## Regression Gaps

- Full React Native tap/gesture behavior is not covered by the current helper-oriented mobile tests.
  - Risk: quick button tap layout or reorder copy visibility may need device confirmation.
  - Follow-up: run simulator/internal build smoke before release.

## Open Questions

- None for the mobile-first slice. Server/API ordered responses can be considered separately if another client requires them.
