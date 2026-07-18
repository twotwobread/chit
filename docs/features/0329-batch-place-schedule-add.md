# Feature Slice: F-329 지도 검색에서 여러 장소를 한 번에 일정 추가

## Metadata

- GitHub Issue: #329
- Status: Implemented in `feature/329-multiple-place-schedule`
- Created: 2026-07-18
- Source run: `.harness/runs/issue-329-batch-place-schedule`

## Goal

Day 일정 추가 mode의 Google 지도 장소 검색 화면에서 사용자가 검색 결과와 찜한 장소를 여러 개 선택하고, Triple류 여행 앱의 선택 tray/cart 패턴처럼 하단 tray에서 선택 순서를 확인한 뒤 한 번의 CTA로 같은 Day 마지막에 선택 순서대로 일정들을 추가한다.

## Product Decisions

- Batch quick-add는 별도 일정 상세 입력을 거치지 않는다.
- 생성 title은 각 Google/provider place의 표시명/snapshot 이름이다.
- 생성 시 `startTime`, `endTime`, `memo`는 비워 둔다.
- 생성된 모든 일정은 시간 미정/순서형 일정이다.
- MVP 최대 선택 수는 20개다.
- 이미 선택한 Google place는 card/marker/tray에서 선택 상태를 표시하고 중복 선택을 막는다.
- 같은 Day에 이미 있는 Google place도 사용자가 선택했다면 그대로 일정으로 추가한다.
- 저장은 atomic이어야 한다. 일부만 저장되고 일부가 실패하는 상태를 만들지 않는다.
- Tray reorder drag는 이번 범위에서 제외한다. MVP는 선택 순서를 보존하고 제거 후 재선택으로 순서를 조정할 수 있다.

## Scope

### In

- `scheduleAdd` mode의 `GooglePlaceMapSearch` 다중 선택.
- 검색 결과, 찜한 장소 card, marker, selection tray의 선택 상태 표시.
- Selection tray에서 선택 개수, 선택 순서, 장소명 목록, 개별 선택 해제 제공.
- `N개 일정 추가` CTA로 선택 항목을 batch 저장.
- OpenAPI batch endpoint, generated Go/TS client, Go handler/service/repository transaction 구현.
- Same-Day duplicate Google place를 별도 확인 없이 같은 Day 마지막에 추가.
- 성공 후 같은 Day 일정 화면으로 복귀.

### Out

- 자동 경로 최적화, 거리 기반 재정렬, 시간 자동 배정, 이동 시간 계산.
- 여러 Day에 나눠 담기.
- 장소별 title/time/memo를 batch 생성 중 개별 편집.
- provider 전환 또는 provider-neutral contract 전환.
- Drag-and-drop tray reorder.

## UX Notes

- #328의 `상단 검색창 + 지도 + 하단 sheet 검색 결과/찜한 장소 tab` 구조를 유지한다.
- Triple식 다중 선택은 화면 하단 또는 sheet footer tray로 표현한다.
- Tray는 `선택한 장소 N개`, 선택된 장소명 순서 목록, `해제` action, `N개 일정 추가` CTA를 제공한다.
- Search/bookmark card의 primary action은 선택 전 `선택`, 선택 후 `선택됨`/disabled 상태로 보인다.
- Marker는 기존 focus/selection sync와 별개로 cart membership 선택 상태를 표현한다.
- 최대 20개를 초과하면 `한 번에 최대 20개까지 선택할 수 있어요.` copy를 보여주고 추가 선택을 막는다.

## API Contract

```text
POST /trips/{tripId}/days/{tripDayId}/places/google/schedule-items/batch
```

Request:

```json
{
  "items": [
    { "googlePlaceId": "ChIJ..." }
  ]
}
```

Response `201`:

```json
{
  "day": { "id": "...", "tripId": "...", "date": "2026-07-11", "dayOrder": 2, "lodgingPlace": null },
  "createdScheduleItems": [],
  "scheduleItems": []
}
```

Same-Day duplicate Google places are allowed. A selected place that already exists in the Day schedule is appended again as a new schedule item.

## Acceptance Criteria

- [x] 일정 추가 mode의 지도 검색 화면에서 여러 장소를 선택할 수 있다.
- [x] 선택된 장소는 result card, bookmark card, marker, tray에서 선택 상태로 표시된다.
- [x] 이미 선택한 같은 Google provider place는 중복 선택할 수 없다.
- [x] 선택 tray에서 선택 해제와 선택 순서 확인이 가능하다.
- [x] 사용자는 `N개 일정 추가` CTA로 선택한 장소들을 한 번에 저장한다.
- [x] 저장된 일정들은 선택 순서대로 같은 Day 마지막에 추가된다.
- [x] 각 일정 title은 provider/display snapshot 이름이고 startTime, endTime, memo는 생성 시 비어 있다.
- [x] 같은 Day 기존 Google place 중복도 막지 않고 새 일정으로 추가된다.
- [x] batch 저장은 atomic하게 처리된다.
- [x] 성공 후 같은 Day 일정 화면으로 돌아가고 추가된 일정들이 최신 목록에 보인다.
- [x] 최대 선택 수 20개를 넘으면 제한 copy를 보여주고 추가 선택을 막는다.

## Test Plan

- Mobile helper tests: selected cart add/remove/toggle/max-limit/order behavior.
- Mobile helper tests: batch request builder preserves selection order without duplicate confirmation fields.
- Mobile source/action tests: selected card/tray UI copy where practical.
- API service tests: validation, same-Day duplicate allowed, provider-display title, all-or-nothing behavior.
- API storage/repository tests: batch append order/rank and same-Day duplicate append behavior.
- API handler/contract generated tests: request/response/error mapping.
- Verification:
  - `pnpm generate`
  - `pnpm verify:generated`
  - `pnpm --filter @i-um/api test`
  - `pnpm --filter @i-um/api build`
  - `pnpm --filter @i-um/mobile test`
  - `pnpm --filter @i-um/mobile typecheck`
  - `pnpm harness:check-worktree-isolation`

## Verification Notes

- Passed: `pnpm verify:generated`
- Passed: `go test ./internal/place ./internal/server`
- Passed: `go test ./internal/storage -run TestTripRepositoryCreateGooglePlaceScheduleItemsBatch -count=0`
- Passed: `pnpm --filter @i-um/mobile test`
- Passed: `pnpm --filter @i-um/mobile typecheck`
- Passed: `pnpm format:check`
- Passed: `pnpm lint`
- Passed: `pnpm --filter @i-um/api build`
- Passed: `pnpm harness:check-worktree-isolation`

## Manual Smoke Gap

- iOS/Android sheet gesture, keyboard, map pan, marker tap, search result tab, bookmark tab, tray scrolling, same-Day duplicate append, and return-to-Day should be smoke-tested on device/simulator if available.
- Full `go test ./...` needs a running Postgres/Docker environment; local Docker daemon was unavailable in this run.
