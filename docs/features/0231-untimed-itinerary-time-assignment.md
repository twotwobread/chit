# Feature Slice: F-231 시간이 미정인 일정 시간 지정

## Metadata

- GitHub Issue: #231
- Status: Implemented
- Created: 2026-07-06
- Updated: 2026-07-06

## Source

- Issue: #231 — `[일정] 시간이 미정인 일정에 시간 지정 기능 추가`
- Harness run: `.harness/runs/F231-issue-231`

## Goal

사용자는 일정 타임라인에서 시간이 미정인 일정에 바로 시작/종료 시간을 지정할 수 있다.

시간을 지정하거나 수정해도 일정 순서는 자동으로 바뀌지 않으며, 필요한 경우 기존 `순서 변경` 기능으로 직접 조정한다.

## Scope

- App UI: Yes
  - 일정 타임라인의 시간 CTA를 활성화한다.
  - 시간이 없는 일정은 `시간 지정`, 시간이 있는 일정은 `시간 수정`으로 표시한다.
  - CTA를 누르면 기존 장소/장소 없는 일정 수정 패널을 연다.
  - 수정 패널의 시간 입력은 일정 생성과 같은 AM/PM·시·분 wheel picker를 사용하고 평문 `HH:mm` 입력을 노출하지 않는다.
  - 수정 패널의 시간 도움말에 자동 순서 변경이 없음을 안내한다.
- API Contract: No change.
- API Server: No change.
- DB: No change.
- Generated Code: No change.

## Requirements

### UI / UX

- 타임라인의 시간 미정 일정 카드에 `시간 지정` 액션을 표시한다.
- 시간 확정 일정에는 `시간 수정` 액션을 표시한다.
- 액션 접근성 라벨은 `<일정명> 시간 지정` 또는 `<일정명> 시간 수정`이다.
- 액션을 누르면 해당 일정의 기존 수정 플로우를 연다.
  - place-backed 일정은 장소 수정 패널을 사용한다.
  - non-place 일정은 장소 없는 일정 수정 패널을 사용한다.
- 수정 플로우의 시간 선택은 일정 생성과 같은 AM/PM·시·분 wheel picker를 사용한다.
- 사용자가 `HH:mm` 평문을 직접 입력하는 시간 필드는 노출하지 않는다.
- 기존 시간 검증을 유지한다.
  - 내부 값은 `HH:mm` 형식이다.
  - 종료 시간만 입력할 수 없다.
  - 종료 시간은 시작 시간보다 늦어야 한다.
- 시간 변경 후 저장하면 기존 업데이트/재조회 흐름으로 목록과 타임라인에 반영한다.
- 시간 변경은 자동 충돌 감지, 자동 재정렬, 경로 최적화를 수행하지 않는다.
- 순서가 맞지 않으면 사용자가 기존 `순서 변경` 기능으로 조정한다.

## Out of Scope

- API/DB 스키마 변경.
- 시간 충돌 감지 또는 경고.
- 시간 기준 자동 정렬.
- 이동 시간/체류 시간 추천.
- 캘린더형 드래그 앤 드롭 편집.

## Acceptance Criteria

- [x] AC-01: 시간이 미정인 타임라인 일정에 `시간 지정` 액션이 보인다.
- [x] AC-02: 시간이 있는 타임라인 일정에 `시간 수정` 액션이 보인다.
- [x] AC-03: 시간 액션을 누르면 해당 일정의 기존 수정 패널이 열린다.
- [x] AC-04: 수정 패널은 일정 생성과 같은 AM/PM·시·분 wheel picker로 시작/종료 시간을 선택하게 하며 평문 시간 입력을 노출하지 않는다.
- [x] AC-05: 수정 패널에서 시작/종료 시간을 저장하면 기존 업데이트/재조회 흐름으로 타임라인에 반영된다.
- [x] AC-06: 수정 패널 도움말은 시간이 바뀌어도 순서가 자동 변경되지 않으며 필요 시 `순서 변경`을 사용하라고 안내한다.
- [x] AC-07: 기존 지도/주소복사/숙소/수정/삭제/순서변경 액션은 유지된다.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Time CTA label/accessibility for untimed/timed items | Mobile helper | `apps/mobile/lib/trips/itinerary-segments.test.mts` | `pnpm --filter @i-um/mobile test` |
| Wheel-style time add/end/clear helper behavior | Mobile helper | `apps/mobile/lib/trips/schedule-time-editor.test.mts` | `pnpm --filter @i-um/mobile test` |
| Timeline-to-edit wiring compiles with existing editor props | Mobile typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Mobile style/copy consistency | Mobile lint/format | ESLint/Prettier | `pnpm --filter @i-um/mobile lint`, `pnpm --filter @i-um/mobile format:check` |

## Verification Record

- RED: `pnpm --filter @i-um/mobile exec node --import tsx --test lib/trips/itinerary-segments.test.mts` failed before implementation because the new time action helpers were missing.
- RED: `pnpm --filter @i-um/mobile exec node --import tsx --test lib/trips/schedule-time-editor.test.mts` failed before implementation because the new shared time editor helpers were missing.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm --filter @i-um/mobile lint`: pass.
- `pnpm --filter @i-um/mobile format:check`: pass.
- Shared primitive refactor: creation/edit time flows now reuse `Card`, `PrimaryButton`, `SecondaryButton`, `ScheduleTimeEditor`, and `ScheduleTimeWheel`; duplicate local button/time-picker styles were removed from the creation screen where practical.
- `pnpm harness:check-worktree-isolation`: pass.
- `pnpm harness:validate`: pass.
- `pnpm harness:check-bugfix-scenario -- --run-id F231-issue-231`: pass, non-bugfix skipped.
- `git diff --check`: pass.

## Regression Gaps

- React Native rendered component/E2E tap coverage was not added because the current mobile test suite is helper-oriented.
  - Risk: actual tap target spacing/focus behavior may need device confirmation.
  - Mitigation: the change uses existing typed props and existing `TimeButton` styling; mobile typecheck/lint passed.

## Manual Smoke

- Not run in this session. Run a simulator/device smoke before release if possible:
  1. Open a Day itinerary with an untimed item.
  2. Tap `시간 지정`.
  3. Enter a valid start/end time and save.
  4. Confirm the timeline shows the assigned time and manual order remains unchanged.
