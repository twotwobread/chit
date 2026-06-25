# Feature Slice: Day 일정 장소 삭제 확인 모달/포커스

## Metadata

- GitHub Issue: #129
- Status: Spec Review
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #129 — <https://github.com/twotwobread/i-um/issues/129>
- Ouroboros/PM/Seed: interview `interview_20260625_123043`, ambiguity `0.05`, seed `seed_a7a8f1700f8b` (MCP generated; filesystem seed path not returned)
- Notes: Day 일정 화면의 장소 `삭제` 버튼이 inline 확인 카드를 목록 아래에 렌더링해 사용자가 인지하거나 포커스를 이동하기 어렵다. 기존 여행 삭제/참여자 제거 흐름과 맞춰 React Native `Modal` 기반 확인 UI로 확정한다.

## Goal

Day 일정에서 장소 삭제를 누르면 확인 UI가 즉시 보이고 스크린리더/키보드 포커스도 확인 UI로 이동해야 한다. 실제 삭제 API는 사용자가 모달에서 삭제를 확정할 때만 호출된다.

## User Flow

1. 사용자가 Day 일정 장소 행의 `삭제`를 누른다.
2. 앱은 편집/순서 변경/숙소 지정/지도 피드백 같은 임시 UI를 닫고, 선택한 장소 삭제 확인 모달을 연다.
3. 모달은 삭제 대상 장소를 `n번째 장소 · 장소명` 형식으로 식별하고 `취소`, `삭제` 액션을 보여준다.
4. `취소` 또는 Android back은 확인 상태에서만 모달을 닫고 원래 삭제 트리거/행 영역으로 포커스를 되돌린다.
5. `삭제`를 누르면 로딩 상태(`삭제 중...`)를 보여주고 중복 제출/취소/back을 막은 뒤 삭제를 수행한다.
6. 성공하면 화면의 Day 일정 목록이 삭제 결과를 반영한 뒤 모달을 닫고 다음 행 → 이전 행 → Day 제목/빈 상태 순서로 포커스를 이동한다.
7. 실패하면 모달을 유지하고 기존 삭제 실패 문구를 보여주며 오류 영역으로 포커스를 이동해 재시도 또는 취소할 수 있게 한다.

## Scope

- App UI: Yes — `apps/mobile/app/trips/[tripId]/days/[date].tsx`
- API Contract: No API changes.
- API Server: No server changes.
- DB: No DB changes.
- Tests: Mobile helper/state tests under `apps/mobile/lib/trips/*`; actual OS accessibility focus is manual smoke with an explicit regression gap.
- Deploy/Smoke: No deploy required; mobile local/manual smoke on Expo simulator/device recommended.

## Out of Scope

- 새로운 API, DB, 권한 정책, 삭제 semantics 변경.
- 바텀시트 도입 또는 공용 destructive-modal primitive 추출.
- React Native component/e2e test harness 도입.
- 삭제 후 목록 스크롤 위치를 엄격히 복원하는 기능. 단, 취소/실패 흐름에서 의도적으로 스크롤을 초기화하면 안 된다.

## Requirements

### UI / UX

- Screens: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
- Confirmation pattern:
  - 기존 inline `DeletePlacePanel` 확인 카드는 사용하지 않고 React Native `Modal`로 삭제 확인을 표시한다.
  - 모달은 `삭제` 버튼 탭 직후 현재 화면 위에 즉시 보인다.
  - 모달 밖 backdrop tap으로 닫히지 않는다.
  - Android hardware back / `onRequestClose`는 확인 상태에서만 `취소`와 동일하게 동작한다.
  - 삭제 중 상태에서는 `취소`, back, 중복 `삭제` 제출을 disabled/ignored 처리한다.
- Copy:
  - 제목: 기존 `buildDayItineraryDeleteConfirmation`의 `이 장소를 삭제할까요?`를 유지한다.
  - 대상: 최소 `n번째 장소 · {placeName}` 또는 동일 의미의 한국어 문구를 표시한다.
  - 보조 설명: 기존 `이 Day 일정에서만 삭제돼요.`를 유지한다.
  - 기존 row data에 이미 있는 타입/주소는 중복 장소명 구분을 위한 보조 문맥으로 표시할 수 있다. 새 API 데이터는 요구하지 않는다.
  - 액션: `취소`, `삭제`; 삭제 중에는 기존 `삭제 중...` 로딩 affordance를 표시한다.
- Focus / accessibility:
  - 모달이 열리면 React Native/platform 한계 내에서 확인 제목 또는 모달 컨테이너로 accessibility/keyboard focus를 이동한다.
  - `취소` 시 가능한 경우 원래 `삭제` 트리거로, ref가 불가능하면 같은 장소 행/action 영역으로 focus를 되돌린다.
  - 삭제 실패 시 오류 제목/설명으로 focus 또는 announcement를 이동한다.
  - 삭제 성공 시 focus 우선순위는 다음 visible place row → 이전 visible place row → Day 일정 제목 또는 빈 상태 카드다.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- 장소 행의 최초 `삭제` 탭만으로는 `deleteDayItineraryItem`을 호출하지 않는다.
- 삭제 API는 모달의 확정 `삭제` 액션에서만 호출한다.
- 한 번에 하나의 편집/삭제 surface만 열 수 있다. 삭제 확인을 열면 기존 edit/reorder/lodging/map transient state를 닫거나 버린다.
- 모달이 열려 있는 동안 underlying row action은 상호작용 대상이 아니다.
- 삭제 중에는 모달을 닫지 않고, 삭제 mutation과 목록 반영(refresh 또는 local state update)이 완료된 뒤 닫는다.
- 삭제 mutation 성공 후 목록 refresh가 실패하거나 지연되는 예외는 기존 Day 일정 load/error 처리로 fallback할 수 있다.
- 삭제 실패 문구는 기존 `dayItineraryMutationFailureState('delete')`를 재사용한다.

## Acceptance Criteria

- [ ] 장소 행의 `삭제`를 누르면 inline 확인 카드가 아니라 즉시 보이는 모달 확인 UI가 열린다.
- [ ] 모달은 삭제 대상 장소를 최소 `n번째 장소 · 장소명` 수준으로 식별한다.
- [ ] 모달에는 `취소`와 삭제 확정 액션이 명확히 표시된다.
- [ ] 장소 행의 최초 `삭제` 탭 시점에는 실제 삭제 API가 호출되지 않는다.
- [ ] 모달의 삭제 확정 액션을 누른 뒤에만 삭제 API가 호출된다.
- [ ] 모달 오픈 시 스크린리더/키보드 focus가 확인 UI로 이동한다(React Native/platform best effort).
- [ ] 삭제 확인을 열 때 기존 edit/reorder/lodging/map transient UI는 닫히고, 삭제 확인 모달은 한 번에 하나만 열린다.
- [ ] Backdrop tap으로 모달이 닫히지 않는다.
- [ ] 확인 상태에서 Android back / `onRequestClose`는 `취소`와 동일하게 모달을 닫는다.
- [ ] `취소` 시 focus는 가능한 경우 원래 `삭제` 트리거로, 아니면 같은 행/action 영역으로 돌아간다.
- [ ] 삭제 중에는 `삭제 중...` 로딩/disabled 상태가 보이고 `취소`, back, 중복 제출이 disabled/ignored 된다.
- [ ] 삭제 실패 시 모달은 열린 채로 `장소를 삭제할 수 없어요.`, `잠시 후 다시 시도해주세요.`를 표시하고 오류 영역으로 focus/announcement가 이동한다.
- [ ] 삭제 성공 시 화면 목록이 삭제 결과를 반영한 뒤 모달을 닫는다.
- [ ] 삭제 성공 후 focus는 다음 행 → 이전 행 → Day 제목/빈 상태 순서로 안정적인 visible context에 놓인다.
- [ ] 취소/실패 흐름은 underlying list scroll position을 의도적으로 초기화하지 않는다.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| 삭제 확인 문구가 장소명과 order context를 포함한다 | Mobile helper | `apps/mobile/lib/trips/day-itinerary-edit.test.mts` 또는 신규 `day-itinerary-delete-flow.test.mts` | `pnpm --filter @i-um/mobile test` |
| 삭제 중 submit state가 `삭제 중...`/disabled를 반환한다 | Mobile helper | `apps/mobile/lib/trips/day-itinerary-edit.test.mts` | `pnpm --filter @i-um/mobile test` |
| 삭제 성공 후 focus target 우선순위가 next → previous → heading/empty로 계산된다 | Mobile helper | 신규 `apps/mobile/lib/trips/day-itinerary-delete-flow.test.mts` | `pnpm --filter @i-um/mobile test` |
| 삭제 실패는 기존 retryable copy를 유지한다 | Mobile helper | `apps/mobile/lib/trips/day-itinerary-edit.test.mts` | `pnpm --filter @i-um/mobile test` |
| 모달 confirm 전에는 delete mutation을 호출하지 않는다 | Mobile state/action helper or extracted coordinator | 신규 `apps/mobile/lib/trips/day-itinerary-delete-flow.test.mts` | `pnpm --filter @i-um/mobile test` |
| Day 일정 화면 타입 안정성 | Mobile typecheck | TypeScript gate | `pnpm --filter @i-um/mobile typecheck` |
| 실제 RN Modal 표시, focus 이동, Android back/backdrop 정책 | Manual smoke | Expo simulator/device | See Manual Smoke checklist |

## Regression Gaps

- 실제 React Native `Modal` 표시와 OS 스크린리더/키보드 focus 이동은 현재 mobile test setup(node:test 기반 lib tests, RN component/e2e harness 없음)에서 완전히 자동화하지 않는다.
  - Risk: helper 테스트는 통과하지만 특정 플랫폼에서 focus 이동이나 back 동작이 기대와 다를 수 있다.
  - Follow-up: 필요 시 React Native Testing Library 또는 Detox 기반 screen/e2e 테스트 도입을 별도 이슈로 검토한다.

## TDD Implementation Plan

1. Red: 삭제 확인 모달 상태/문구/focus target helper 테스트 추가
   - `n번째 장소 · 장소명` 대상 문구, 기존 실패 문구, 삭제 중 disabled label, success focus priority를 먼저 실패시키기.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Red: delete mutation gating 테스트 추가
   - row `삭제`는 확인 상태만 만들고 confirm 액션에서만 delete request를 허용하는 helper/coordinator를 추출해 테스트한다.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Green: `apps/mobile/app/trips/[tripId]/days/[date].tsx`에서 inline `DeletePlacePanel`을 `DeletePlaceConfirmationModal`로 교체
   - `Modal`을 사용하고 backdrop tap dismiss는 추가하지 않는다.
   - `onRequestClose`는 confirming 상태에서만 cancel, deleting 상태에서는 ignore 처리한다.
   - 기존 `beginDelete`의 transient state 정리 동작을 유지한다.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: focus best-effort 구현
   - 모달 open/error/success/cancel 상태 전환에서 `AccessibilityInfo`/focusable ref 등 React Native에서 가능한 방식으로 focus 또는 announcement를 이동한다.
   - 원래 trigger ref가 불가능하면 originating row/action area fallback을 사용한다.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
5. Green: deletion success dismissal timing 조정
   - 삭제 mutation 성공 후 visible itinerary UI가 refresh/local update로 반영된 뒤 모달을 닫고 deterministic focus target을 적용한다.
   - Refresh 실패는 기존 Day 일정 load/error handling으로 fallback한다.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
6. Refactor: modal copy/helper와 스타일 정리
   - 기존 theme token과 shared button/card 패턴을 우선 사용하고 raw color를 추가하지 않는다.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
7. Gate: 최종 검증
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: Not run — spec/plan only.
- `pnpm --filter @i-um/mobile typecheck`: Not run — spec/plan only.

### Manual Smoke

- Expo에서 Day 일정 장소 `삭제` 탭 시 모달 즉시 표시: Not run — implementation pending.
- 모달 focus 진입/취소 focus 반환/실패 오류 focus/성공 후 focus priority: Not run — implementation pending.
- Android back은 confirming에서 취소, deleting에서 ignored: Not run — implementation pending.
- Backdrop tap으로 닫히지 않음: Not run — implementation pending.

## Release Notes

- Day 일정 장소 삭제 확인을 inline 카드에서 모달로 바꿔 삭제 대상과 선택지를 즉시 인지할 수 있게 한다.
- 삭제 확인/취소/실패/성공 focus 흐름을 명확히 해 접근성 회귀를 줄인다.

## Open Questions

- None

## Follow-up Issues

- RN component/e2e 테스트 harness 도입 여부 검토: 이번 버그 수정 범위 밖.
- 여러 화면에서 반복되는 destructive confirmation modal을 공용 primitive로 추출하는 작업: 이번 버그 수정 범위 밖.
