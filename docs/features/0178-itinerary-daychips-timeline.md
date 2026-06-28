# Feature Slice: 일정 탭 DayChips·타임라인 전환

## Metadata

- GitHub Issue: #178
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #178 — [Mobile UI Refactor follow-up] 일정 탭 DayChips·타임라인 전환
- Depends on: #175, #177 merged into `origin/develop`
- Ouroboros/PM/Seed: `interview_20260628_165842` / `seed_a54317a26fb1` (ambiguity 0.09)
- Current sources: `apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx`, `apps/mobile/lib/trip-ui/DayChips.tsx`, `ItineraryTimeline.tsx`, `apps/mobile/lib/trips/day-itinerary.ts`, `days.ts`, `trip-map.ts`

## Goal

일정 탭을 Day 목록 화면에서 선택 Day의 읽기 중심 일정 요약 화면으로 전환한다. `DayChips`로 날짜를 인라인 선택하고, 선택 Day의 order-only schedule items를 `ItineraryTimeline`으로 보여주되 전체 add/edit/delete/reorder/lodging 편집은 기존 Day detail route에 남긴다.

## User Flow

1. 사용자가 일정 탭을 연다.
2. 앱은 여행의 오늘 날짜 Day가 있으면 그 Day를, 없으면 첫 Day를 선택한다.
3. 사용자가 Day chip을 누르면 route push 없이 같은 탭에서 해당 Day의 타임라인/빈 상태가 갱신된다.
4. 사용자가 편집이나 상세 확인이 필요하면 `일정 자세히 보기` CTA로 기존 Day detail 화면으로 이동한다.

## Scope

- App UI: yes — update `apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx`
- Mobile helpers: yes — add selected-day timeline mapping helper and tests
- API/DB/generated: no changes
- Tests: helper tests for order-only timeline mapping and selected-day retention/fallback
- Deploy/Smoke: manual smoke recommended; no staging/internal build required

## Out of Scope

- #95 start/end time DB/API fields, TimeEditForm connection, or time editing UX
- #122 place-less itinerary item support
- In-tab add/edit/delete/reorder/lodging mutations
- Today next-place policy changes
- Map tab day selection synchronization
- API/OpenAPI/server/DB/generated code changes

## Requirements

### UI / UX

- Initial selected Day: calendar-current Day if present, otherwise first Day.
- During the mounted tab session, keep the user's selected Day across focus/reload if that Day still exists. If invalid, fall back to current/first.
- DayChips switch selected Day inline without route push.
- Selected Day content is read-oriented:
  - Non-empty Day renders existing ordered place schedule items in `ItineraryTimeline`.
  - Items have no start/end times in this slice, so they render as order-only/untimed timeline items.
  - Empty Day shows `이 Day에 등록된 일정이 없어요.` and helper `장소를 추가하려면 일정 자세히 보기로 이동해 주세요.`.
- Empty and non-empty states expose `일정 자세히 보기` CTA to `buildDayItineraryRoute(tripId, selectedDayId)`.
- Existing Day detail route remains the owner of add/edit/delete/reorder/lodging flows.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

## Acceptance Criteria

- [ ] Itinerary tab opens with current calendar Day selected when available, otherwise first Day.
- [ ] DayChips switch selected Day in place without route push.
- [ ] Selected Day with items renders `ItineraryTimeline` with the selected Day's existing ordered schedule items.
- [ ] Selected Day with no items shows the specified empty copy and detail CTA.
- [ ] Returning from Day detail keeps the same selected Day when it still exists and reloads latest content.
- [ ] Existing Day detail route remains available for all editing flows.
- [ ] No API/DB/generated code changes.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Selected-day timeline item mapping | Unit | `apps/mobile/lib/trips/itinerary-tab.test.mts` | `pnpm --filter @i-um/mobile test` |
| Day selection fallback/retention helper | Unit | existing `trip-map.test.mts` + new itinerary helper test | `pnpm --filter @i-um/mobile test` |
| Existing Day itinerary detail helpers unchanged | Unit | existing `day-itinerary*.test.mts` | `pnpm --filter @i-um/mobile test` |
| Screen composition compiles | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- Simulator visual smoke for timeline spacing and Day detail return flow is not automated.
  - Risk: focus reload/spacing regressions may need follow-up tuning.
  - Follow-up: manual smoke: Day switch, detail CTA, edit in detail, return.

## TDD Implementation Plan

1. Red: add tests for mapping `DayItineraryViewModel` to order-only `ItineraryTimelineItem[]`.
2. Green: add itinerary-tab helper and refactor itinerary tab state to load selected Day detail using #177 selection rules.
3. Green: render `DayChips`, `ItineraryTimeline`, empty state, and selected Day detail CTA.
4. Refactor: remove old day-list row styles and keep edit flows in Day detail.
5. Gate: run test/typecheck/lint/format and raw-color grep.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (272 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/trips/[tripId]/(tabs)/itinerary.tsx apps/mobile/lib/trips/itinerary-tab.ts apps/mobile/lib/trip-ui/ItineraryTimeline.tsx`: pass (no matches)

### Manual Smoke

- Day switch/detail return/edit flow: not run — manual simulator smoke deferred; helper tests and focus reload code cover expected state rules

## Release Notes

- Team-facing: 일정 탭이 DayChips 기반 선택 Day 요약과 order-only 타임라인을 제공하며, 편집은 기존 Day detail route로 유지된다.

## Open Questions

- None.

## Follow-up Issues

- #95 — 시간 선택 가능한 일정 항목/타임라인
- #122 — 장소 없는 일정 항목 지원
