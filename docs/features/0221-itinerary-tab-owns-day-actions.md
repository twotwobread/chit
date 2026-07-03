# Feature Slice: 일정 탭이 Day 일정 액션을 소유

## Metadata

- GitHub Issue: not assigned
- Status: Implemented
- Created: 2026-07-03
- Updated: 2026-07-03

## Source

- User request: Day 일정 상세 흐름을 제거하고, 일정 페이지에서 일정 추가/수정/삭제/순서 변경 책임을 모두 처리한다.
- Current sources: `apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx`, `apps/mobile/app/trips/[tripId]/days/[date].tsx`, `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`, `apps/mobile/lib/trips/day-itinerary-add-place-navigation.ts`, `apps/mobile/lib/trips/routes.ts`

## Goal

Day 일정 상세 route를 사용자가 방문하는 흐름에서 제거하고, 일정 탭이 선택 Day의 일정 추가/수정/삭제/순서 변경 책임을 직접 소유한다.

## Scope

- 일정 탭에서 선택 Day의 편집 UI를 직접 표시한다.
- 장소 검색/수동 장소 추가처럼 별도 route가 필요한 흐름은 유지하되 완료 후 Day 상세가 아니라 일정 탭으로 복귀한다.
- Day 상세 route는 신규 진입점에서 제거한다.
- Today/Map/quick-expense 등 기존 Day route fallback은 일정 탭 복귀로 정리한다.
- API/DB/generated code 변경은 하지 않는다.

## Out of Scope

- API contract 변경
- DB schema/data migration
- 새 일정 도메인 모델 설계
- 지출 quick expense 흐름 제거
- 지도 탭의 장소 검색 UX 재설계

## Acceptance Criteria

- [x] 일정 탭에서 Day를 선택하면 같은 탭 안에서 해당 Day 일정 편집 UI가 열린다.
- [x] 일정 탭에서 일정 추가, 장소 없는 일정 추가, 수정, 삭제, 순서 변경을 수행할 수 있다.
- [x] 일정 추가를 위한 장소 검색 완료 후 일정 탭의 같은 Day로 돌아온다.
- [x] 수동 장소 안내 화면의 뒤로가기/복귀도 일정 탭으로 돌아온다.
- [x] 앱 shell fallback에서 `/trips/:tripId/days/:dayId` 및 하위 add-place routes는 Day 상세 대신 일정 탭의 해당 Day로 이동한다.
- [x] Day 상세 screen route는 stack에서 신규 진입점으로 노출되지 않는다.
- [x] No API/DB/generated code changes.
- [x] `pnpm --filter @i-um/mobile test` passes.
- [x] `pnpm --filter @i-um/mobile typecheck` passes.

## Implementation Notes

- Prefer reusing the existing Day detail implementation by extracting it into a component rendered by the itinerary tab, instead of rewriting mutation flows.
- Keep route-specific wrappers thin.
- Keep selected Day in the itinerary tab via a `dayId` query when returning from nested add/search flows.

## Open Questions

- None. User approved hybrid UX: in-tab editing for schedule actions, separate route only where search/manual add flows require it.
