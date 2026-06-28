# Bugfix Plan: F-148 장소 순서 변경 드래그 snapback

## Metadata

- GitHub Issue: #148
- Status: In Progress
- Created: 2026-06-27
- Updated: 2026-06-27

## Source

- Issue: #148 — https://github.com/twotwobread/i-um/issues/148
- Ouroboros/PM/Seed: Interview `interview_20260627_084809`, ambiguity `0.056`, Seed `seed_1cc523612295`
- Related specs: F-029 `docs/features/0029-reorder-itinerary.md`, F-128 `docs/features/0128-day-reorder-iphone-drag.md`

## Problem

Day 일정 `순서 변경` 모드에서 drag handle로 장소를 움직이면 row가 잠깐 이동했다가 원래 자리로 돌아온다. 결과적으로 사용자가 장소 순서를 바꿀 수 없다.

이 이슈는 최초 스펙 작성 시 정확한 원인이 확정되지 않았으나, physical iPhone + Expo Go 재현 로그로 root cause를 확인했다. 수정은 확인된 원인에 대한 최소 변경으로 제한한다.

## Expected Behavior

- drag handle로 row를 위/아래로 움직이면 화면 순서가 안정적으로 바뀐다.
- 드롭 후에도 변경된 편집 draft 순서가 유지된다.
- 실제 순서가 바뀌면 `저장`이 활성화된다.
- 원래 순서로 되돌리면 `저장`이 비활성화된다.
- 저장하면 기존 reorder API 결과가 즉시 Day 화면에 반영된다.
- 재진입/refetch 후에도 저장된 순서가 유지된다.

## Scope

### In Scope

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`의 reorder drag/edit state 흐름
- `apps/mobile/lib/trips/reorder-itinerary*.ts` helper/state 테스트
- 필요 시 `apps/mobile/lib/trips/shared-itinerary-updates.ts` 관련 보호 상태 검증
- physical iPhone + Expo Go smoke

### Out of Scope

- API / OpenAPI / DB / server / generated code 변경
- reorder rank/version semantics 변경
- 장소 추가/수정/삭제, 숙소, 지도, Today 화면 변경
- drag 대체용 `위/아래 이동` 버튼 추가
- whole-row drag 추가
- 원인과 무관한 인접 리팩터링

## Current Facts

현재 코드 기준으로 확인된 사실:

- reorder mode는 `apps/mobile/app/trips/[tripId]/days/[date].tsx` 안의 `ReorderPlaceList`가 담당한다.
- `ReorderPlaceList`는 `draft.items.map(...)`으로 row를 렌더링하고, row마다 `PanResponder.create(...)`를 만든다.
- drag 중 target index가 바뀌면 `onMoveItem(currentIndex, targetIndex)`를 호출하고, parent state의 `draft.items`가 변경되며 화면이 re-render된다.
- `moveDayItineraryReorderItem()` 자체는 원래 순서/변경 순서/save gating 테스트가 이미 존재한다.
- shared itinerary polling은 `reorderStatus: 'editing' | 'saving'` 상태를 protected로 취급한다. 따라서 일반적인 shared-update overwrite가 1순위 원인이라고 단정하긴 어렵다.
- 최근 F-128에서 iPhone drag 시작 문제를 `ScrollView` + `PanResponder` 기반으로 안정화한 이력이 있다.

## Leading Hypotheses

우선순위 높은 의심 지점:

1. **Per-row PanResponder ownership 문제**
   - drag 중 `draft.items` 변경으로 row들이 re-render되면서 active responder/closure/index가 흔들릴 수 있다.
2. **stale currentIndex / captured index 문제**
   - drag 시작 시점의 `index`, `currentIndex`, `item.id` 조합이 reorder 후 실제 배열과 어긋날 수 있다.
3. **target index oscillation 문제**
   - threshold 근처에서 target index가 앞뒤로 튀어 사용자가 보기엔 원위치로 돌아가는 것처럼 보일 수 있다.
4. **ScrollView responder conflict 문제**
   - drag 중 ScrollView 또는 native responder termination이 발생할 수 있다.
5. **unexpected fetch/state overwrite 문제**
   - 가능성은 낮아 보이나, 실제 로그로 `reorderState.draft`가 서버 state로 덮이는지 확인한다.

## Debugging Plan

### Step 1. Instrument drag lifecycle

`EXPO_PUBLIC_DAY_REORDER_DEBUG=true` dev-only instrumentation으로 아래를 확인한다.

- `onPanResponderGrant`: item id, start index, draft order
- `onPanResponderMove`: item id, gesture `dy`, computed target index, current index, draft order
- `onMoveItem`: from index, to index, before/after draft order
- `onPanResponderRelease` / `Terminate` / `Reject`
- `setReorderState` 호출 시 draft order
- `load()` / shared refetch / `applyItineraryResponse()`가 reorder editing 중 호출되는지

### Step 2. Reproduce on device

- physical iPhone + Expo Go에서 #148 재현
- drag 한 번 이동 시 snapback이 발생하는 순간의 로그 확인
- 가능하면 화면 녹화와 로그를 함께 확인

### Step 3. Classify root cause

아래 중 하나로 분류한다.

- `draft.items` 자체가 원래 순서로 reset된다.
- `draft.items`는 바뀌었지만 responder/index 계산이 다시 원위치 move를 호출한다.
- responder가 terminate/re-grant되며 active drag가 끊긴다.
- fetch/shared-update가 편집 화면을 덮는다.
- 그 외 Expo/RN gesture integration 문제다.

### Step 4. Apply minimal fix

원인별 수정 방향:

- draft reset이면 editing 중 overwrite path를 차단하거나 state ownership을 분리한다.
- index stale이면 active `itemId` 기준으로 최신 index를 계산하도록 변경한다.
- per-row responder ownership 문제면 responder 생성/active drag state를 안정화한다.
- target oscillation이면 target resolution 또는 move application 기준을 보정한다.
- ScrollView conflict면 responder termination/scroll disable/auto-scroll 처리 범위를 조정한다.
- 구조적으로 안정화가 어렵다면 mobile-only 범위 안에서 contained refactor를 허용한다.

## Root Cause Record

```text
Root Cause:
- ReorderPlaceList creates PanResponder handlers inside draft.items.map(). When a drag crosses a reorder threshold, onMoveItem updates draft.items and the list re-renders during the same active gesture.
- On iPhone/Expo Go, after that reorder-triggered render, PanResponder gestureState.dy can effectively restart near 0 even though the finger is still in the same drag.
- The code used gestureState.dy plus the original startIndex to compute targetIndex, so the next move event computed the original position as the target and moved the row back.

Evidence:
- Logs for item a293... showed target 2 -> 1 with dy -76.6, then immediately target 1 -> 2 with dy -10.6, returning to original order.
- Logs for item 151... showed the same oscillation downward: target 0 -> 1 with dy 68.6, then target 1 -> 0 with dy 9.
- No drag-terminate/re-grant or apply-itinerary-response/shared overwrite occurred during the snapback sequence.

Fix:
- Capture gestureState.y0 as startPointerY on grant.
- Compute dragOffsetY from absolute pointer movement, gestureState.moveY - startPointerY, plus scroll delta instead of using gestureState.dy.

Why it prevents snapback:
- moveY is absolute screen position and remains stable for the active finger movement even when per-row PanResponder handlers are recreated by a reorder render. Therefore targetIndex no longer flips back to the original slot because dy reset near 0.

Automated regression added:
- apps/mobile/lib/trips/reorder-itinerary-drag.test.mts covers absolute pointer offset and the reproduced dy-reset scenario.

Manual smoke result:
- Pass — physical iPhone + Expo Go retest confirmed drag reorder works normally after the fix.

Deferred findings:
- None yet.
```

## Acceptance Criteria

- [ ] root cause가 로그/테스트로 확인되어 Root Cause Record에 기록된다.
- [ ] drag handle로 row를 움직일 때 snapback이 재현되지 않는다.
- [ ] 여러 번 연속 이동해도 최종 순서가 유지된다.
- [ ] 변경 전 `저장`은 disabled다.
- [ ] 실제 순서 변경 후 `저장`은 enabled다.
- [ ] 원래 순서로 되돌리면 `저장`은 다시 disabled다.
- [ ] 저장은 기존 reorder API를 사용한다.
- [ ] 저장 성공 후 Day 화면이 즉시 새 순서를 보여준다.
- [ ] refetch/re-entry 후에도 저장된 순서가 유지된다.
- [ ] 취소/back/route 이탈은 미저장 변경을 버린다.
- [ ] API/DB/OpenAPI/generated code 변경이 없다.

## Test Plan

### Automated

- `pnpm --filter @i-um/mobile test`
  - root cause에 맞는 helper/state regression test 추가
  - 기존 reorder save gating test 유지
  - 필요 시 shared-update protected-state test 추가
- `pnpm --filter @i-um/mobile typecheck`

### Manual Smoke

physical iPhone + Expo Go에서 확인:

1. Day 일정 화면 진입
2. `순서 변경` 진입
3. `저장` 초기 disabled 확인
4. drag handle로 row 위/아래 이동
5. snapback 없음 확인
6. 여러 번 연속 이동
7. `저장` enabled 확인
8. 원래 순서로 복구 후 `저장` disabled 확인
9. 다시 변경 후 저장
10. Day 화면에 새 순서 즉시 반영 확인
11. 재진입/refetch 후 순서 유지 확인
12. 취소/back에서 미저장 변경 discard 확인
13. 긴 목록이 있으면 near-edge auto-scroll 확인

## Verification Record

- `pnpm install --frozen-lockfile`: pass — worktree dependency install for local verification
- `pnpm --filter @i-um/mobile test`: pass — 233 tests
- `pnpm --filter @i-um/mobile typecheck`: pass
- Manual smoke: pass — physical iPhone + Expo Go retest confirmed normal drag reorder behavior after fix

## Notes

이 문서는 확정 구현 사양이 아니라 **debug-first bugfix plan**이다. 정확한 수정 방식은 Root Cause 확인 후 결정한다.
