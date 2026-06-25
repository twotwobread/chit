# Feature Slice: F-128 iPhone Day 일정 순서 변경 드래그 수정

## Metadata

- GitHub Issue: #128
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #128 — Day 일정 순서 변경 드래그앤드롭이 iPhone에서 동작하지 않음
- Ouroboros/PM/Seed: Interview `interview_20260625_125102`, ambiguity `0.0585`, Seed `seed_96bfcf9a2fa1`
- Notes: Physical iPhone/Expo Go에서 Day 일정 `순서 변경` 모드의 custom `PanResponder` drag handle이 시작되지 않는 버그를 수정한다. F-029의 reorder UX와 기존 reorder API를 유지하고, 이번 범위는 mobile-only 버그 픽스로 제한한다.

## Goal

사용자가 iPhone의 Expo Go에서 Day 일정 `순서 변경` 모드에 들어가 drag handle로 장소를 위아래로 끌어 순서를 바꾸고, `저장`으로 기존 reorder API에 새 순서를 반영할 수 있다.

이번 이슈는 실제 iPhone gesture 동작을 복구하는 것이 목표다. Up/down 버튼, 별도 reorder UI, simulator-only 성공, Android-only 성공은 해결로 인정하지 않는다.

## User Flow

1. 사용자가 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 장소가 2개 이상이면 기존처럼 `순서 변경` action이 보인다.
3. 사용자가 `순서 변경`을 누르면 편집 모드로 전환되고 각 장소 row에 drag handle과 `저장`/`취소`가 보인다.
4. 사용자가 drag handle을 잡아 장소를 위/아래로 이동한다.
   - Immediate drag가 가능하면 즉시 끌 수 있다.
   - 구현이 long-press activation을 선택하면 helper/accessibility copy가 `길게 누른 뒤` 동작을 안내해야 한다.
5. 앱은 드래그 중 로컬 row 순서를 즉시 갱신한다.
6. 실제 순서가 원래와 다르면 `저장`이 활성화된다.
7. 사용자가 순서를 원래대로 되돌리면 `저장`은 다시 비활성화된다.
8. 사용자가 `저장`을 누르면 기존 reorder API로 저장하고 최신 Day 일정 순서를 보여준다.
9. 사용자가 화면을 나갔다가 다시 들어오거나 refetch하면 저장된 순서가 유지된다.

## Scope

- App UI: yes — `apps/mobile/app/trips/[tripId]/days/[date].tsx`의 reorder list/gesture 구현과 helper/accessibility copy
- API Contract: no — 기존 `PATCH /trips/{tripId}/days/{date}/itinerary-items/order` 재사용
- API Server: no
- DB: no
- Tests: mobile reorder helper/state/adapter unit tests, mobile typecheck, physical iPhone Expo Go manual smoke
- Deploy/Smoke: required — physical iPhone + Expo Go smoke result 기록

## Out of Scope

- API, OpenAPI, generated client/server, DB migration, storage query 변경
- reorder endpoint semantics 변경
- 장소 추가/수정/삭제, 숙소 지정, 지도/주소복사, Today execution 변경
- Up/down 버튼 또는 별도 fallback reorder UI로 drag를 대체하는 것
- whole-row drag를 지원 gesture로 추가하는 것
- 새 automated native drag E2E harness 구축
- Android 기기 smoke를 release-blocking 조건으로 만드는 것

## Requirements

### UI / UX

- Screen: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
- 기존 `순서 변경` 진입, reorder edit mode, `저장`, `취소` UX를 유지한다.
- Drag는 handle-only로 시작해야 한다.
  - 전체 row drag 또는 별도 touch target은 이번 이슈의 지원 gesture가 아니다.
  - iPhone/Expo Go에서 안정적인 구현을 위해 long-press-on-handle이 필요하면 허용한다.
- 구현은 physical iPhone의 Expo Go에서 동작해야 한다.
  - Expo Go에서 실행할 수 없는 새 native dependency만으로 해결하는 접근은 허용하지 않는다.
  - 새 drag/gesture/list dependency는 Expo/RN 현재 버전과 호환되고 Expo Go-runnable이며 mobile-only 범위를 유지할 때 허용한다.
- Drag 중 로컬 목록 순서가 즉시 바뀌어야 한다.
- 긴 목록에서는 row를 한 화면 밖으로 이동할 수 있도록 near-edge auto-scroll 또는 동등한 long-list drag 동작을 지원해야 한다.
- 심한 gesture 취소, ScrollView/List scroll 충돌, target placement가 어려울 정도의 jank는 실패다. 경미한 smoothness 차이는 허용한다.
- Saving 중에는 기존처럼 중복 drag/save/cancel이 막혀야 한다.

#### States

- View: 기존 Day 일정 success state와 row action들을 유지한다.
- Edit: reorder row, handle, helper, `저장`, `취소`를 보여준다.
- No change: 원래 순서와 같으면 `저장` disabled.
- Changed: 실제 순서가 바뀌면 `저장` enabled.
- Restored: 사용자가 원래 순서로 되돌리면 `저장` disabled.
- Save success: 최신 Day itinerary를 반영하고 편집 모드를 종료한다.
- Retryable save failure: 편집 모드와 임시 순서를 유지하고 retry/cancel 가능하게 한다.
- Conflict `409`: 기존 F-029 동작대로 로컬 임시 순서를 버리고 최신 itinerary를 refetch한 뒤 conflict 안내를 보여준다.
- `취소`, back, route exit: 기존처럼 confirmation 없이 임시 순서를 버린다.

#### Copy / Accessibility

- Existing labels stay unless activation behavior requires clearer wording.
- Reorder action: `순서 변경`
- Save action: `저장`
- Saving action: `저장 중...`
- Cancel action: `취소`
- Helper content must clearly say the handle is the draggable control.
- Suggested helper when long-press is used: `핸들을 길게 누른 뒤 위아래로 끌어서 순서를 바꿔요.`
- Suggested handle accessibility label: `${placeName} 드래그 핸들`
- Suggested handle accessibility hint when long-press is used: `길게 누른 뒤 위아래로 끌어서 순서를 바꿔요.`
- If immediate drag is used, copy may omit `길게 누른 뒤` but must still identify the handle as the drag control.

### API Contract

No API changes.

Existing endpoint remains the source of persistence:

```text
PATCH /trips/{tripId}/days/{date}/itinerary-items/order
```

The mobile app continues to build `ReorderDayItineraryItemsRequest` from the original loaded order and final local order, then calls the generated client through `reorderDayItineraryItems`.

### DB Changes

No DB changes.

### Business Rules

- Reorder is available only for existing success states with 2+ places, as in F-029.
- Only handle-based drag can reorder rows.
- Drag changes are local until explicit `저장`.
- `저장` must reflect effective diff from the original order, not merely whether a drag happened.
- A no-op final order must not call the API.
- API/server conflict and retryable error behavior remain unchanged.
- If implementation discovers a blocker that appears to require API/DB/contract changes, stop and re-scope before implementation.

## Acceptance Criteria

- [ ] On a physical iPhone running Expo Go, reorder mode allows moving a row up/down by dragging from the row handle.
- [ ] Drag starts from the handle only; whole-row drag and alternate fallback touch targets are not introduced.
- [ ] If long-press activation is used, Korean helper/accessibility copy tells the user to long-press and drag the handle.
- [ ] Row order updates immediately on screen while reordering.
- [ ] `저장` is disabled before any effective order change.
- [ ] `저장` becomes enabled after an actual order change.
- [ ] `저장` becomes disabled again if the user restores the original order before saving.
- [ ] Saving persists through the existing reorder API, with no API/DB/contract changes.
- [ ] Saved order remains after leaving/re-entering the Day screen or refetching.
- [ ] For lists longer than one viewport, rows can be moved across the viewport boundary with near-edge scrolling or equivalent long-list drag support.
- [ ] Retryable save failure preserves the edited temporary order with retry/cancel available.
- [ ] Conflict behavior remains unchanged: local order is discarded after latest itinerary refetch and conflict feedback is shown.
- [ ] `취소`, back, or route exit discards unsaved reorder changes without a confirmation prompt.
- [ ] Physical iPhone + Expo Go smoke result is recorded, including any near-edge auto-scroll gap if the smoke itinerary is shorter than one viewport.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Save disabled/enabled/restored based on effective order diff | Unit | `apps/mobile/lib/trips/reorder-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| No-op final order does not build an API request | Unit | `apps/mobile/lib/trips/reorder-itinerary.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing move batch and persistence helper behavior stay unchanged | Unit | `apps/mobile/lib/trips/reorder-itinerary*.test.mts` | `pnpm --filter @i-um/mobile test` |
| Extracted drag target/adapter logic, if introduced, handles up/down thresholds and long-list movement boundaries | Unit | `apps/mobile/lib/trips/*drag*.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| Mobile screen/dependency changes remain type-safe | Static | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Physical iPhone handle drag, save gating, persistence after re-entry/refetch | Manual | iPhone + Expo Go smoke checklist | Record device/iOS/Expo Go result in PR/spec |
| Long-list near-edge movement | Manual | iPhone + Expo Go smoke with list longer than one viewport | Record pass, or record not exercised with risk if dataset is shorter |

## Regression Gaps

- Native iOS drag gesture behavior is not automated in the current Node-based mobile test setup.
  - Risk: future gesture/list refactors can regress physical-device drag without failing CI.
  - Follow-up: consider a dedicated React Native interaction/E2E harness when the project adopts one.
- Android physical-device smoke is non-blocking for this issue.
  - Risk: an Expo-compatible iOS fix could unintentionally affect Android drag feel.
  - Follow-up: run a brief Android smoke when available; automated mobile tests/typecheck remain required.
- Near-edge auto-scroll may be unexercised if the available smoke itinerary is shorter than one viewport.
  - Risk: long Day itineraries could still have drag/scroll conflicts.
  - Follow-up: prepare a long-list smoke dataset before release when practical, or record the gap explicitly.

## TDD Implementation Plan

1. Red: strengthen pure reorder tests for effective-order save gating.
   - Add/confirm a case where moving an item changes the order, then moving it back restores the original order and disables `저장`/returns no request.
   - Verify: `pnpm --filter @i-um/mobile test`
2. Red: extract any reusable drag/list adapter logic before changing the native gesture implementation.
   - Candidate logic: target-index resolution, active item state transitions, long-list movement thresholds, or handle activation copy selection.
   - Keep actual native gesture proof manual if no RN interaction harness exists.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Green: replace or refactor the current `ScrollView` + custom per-row `PanResponder` implementation so handle drag works on physical iPhone in Expo Go.
   - Allowed approaches include an Expo Go-compatible drag/list/gesture dependency or an in-house refactor, as long as it is maintainable and compatible with current Expo/RN versions.
   - Keep handle-only initiation.
   - Do not add API, DB, OpenAPI, or generated-code changes.
   - Preserve existing reorder state transitions and existing reorder API call path.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: align Korean helper/accessibility copy with the selected activation behavior.
   - If long-press is required, visible helper and accessibility hint must mention `길게 누른 뒤`.
   - If immediate drag is used, copy still identifies the handle as the drag control.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
5. Refactor: remove obsolete PanResponder/ScrollView-specific code paths if replaced.
   - Keep screen style tokens and existing Day itinerary row visual hierarchy.
   - Avoid broad UI refactors outside reorder mode.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
6. Manual gate: run physical iPhone + Expo Go smoke.
   - Freshly open a Day with 2+ places.
   - Enter `순서 변경`.
   - Confirm `저장` starts disabled.
   - Drag a handle to move a row up/down.
   - Confirm on-screen order changes and `저장` enables.
   - Drag back to original order and confirm `저장` disables.
   - Drag again, save, leave/re-enter or refetch, and confirm order persists.
   - If the list is longer than one viewport, drag across the viewport boundary and confirm near-edge scrolling/long-list movement works.
   - Record device model, iOS version, Expo Go version if available, result, and gaps.
7. Gate: final verification before implementation PR.
   - Verify: `pnpm --filter @i-um/mobile test`
   - Verify: `pnpm --filter @i-um/mobile typecheck`
   - Attach manual smoke result.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass — 184 tests
- `pnpm --filter @i-um/mobile typecheck`: pass

### Manual Smoke

- Physical iPhone + Expo Go handle drag: not run — physical device smoke required
- Save gating and persistence after re-entry/refetch: not run — physical device smoke required
- Long-list near-edge movement: not run — physical device smoke required

## Release Notes

- Day 일정 `순서 변경` 모드에서 iPhone 사용자가 drag handle로 장소 순서를 안정적으로 바꾸고 저장할 수 있게 한다.

## Open Questions

- None

## Follow-up Issues

- None
