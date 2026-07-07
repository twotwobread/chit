# Feature Slice: F-232 장소 있는/없는 일정 추가 플로우 통합

## Metadata

- GitHub Issue: #232
- Status: Implemented
- Created: 2026-07-08
- Updated: 2026-07-08

## Source

- Issue: #232 — `[일정] 장소 있는/없는 일정 추가 플로우 통합`
- Harness run: `.harness/runs/issue-232-itinerary-add-flow-unification`
- Product decision: User selected approach A — one `일정 추가` detail form with optional place selection.

## Goal

일정 탭의 새 일정 추가 진입점을 하나로 합치고, 일정 상세 입력 화면에서 장소 선택 여부에 따라 place-backed 또는 non-place schedule item으로 저장한다.

## Product Decisions

- `일정 추가`는 하나의 일정 상세 입력 화면으로 진입한다.
- 상세 입력 화면에서 장소는 선택 사항이다.
- 장소를 검색해 선택하면 place-backed schedule item으로 저장한다.
- 장소를 선택하지 않으면 카테고리를 고르고 non-place schedule item으로 저장한다.
- Day 일정 화면에는 별도의 `장소 없는 일정 추가` 버튼을 노출하지 않는다.

## Scope

### In

- 일정 탭/Day itinerary 편집 UI의 새 일정 추가 진입점을 `일정 추가` 하나로 통합한다.
- 기존 place-backed 상세 입력 route를 unified create form으로 확장한다.
- 선택된 장소가 있으면 기존 Google place schedule create API를 호출한다.
- 선택된 장소가 없으면 기존 non-place schedule item create API를 호출한다.
- 장소 없는 상태에서는 non-place 카테고리와 기존 category-specific fields를 입력할 수 있다.
- 선택된 장소를 지워 non-place 저장 상태로 돌아갈 수 있다.
- Google place search selector return은 기존처럼 unified form으로 돌아와 선택된 장소 카드를 채운다.
- 저장 성공 후 일정 탭의 같은 Day로 돌아간다.

### Out

- API contract 변경.
- DB schema/migration 변경.
- 생성된 API client 변경.
- 기존 edit/delete/reorder/lodging/map/Today/settlement behavior 변경.
- 장소 검색 품질, 중복 장소 정책, Google place snapshot/reuse 정책 변경.
- non-place enum 변경.
- 기존 route path rename.

## Acceptance Criteria

- [x] AC-01: From the Day itinerary action area, users see only one create CTA labeled `일정 추가`; there is no separate create CTA labeled `장소 없는 일정 추가`.
- [x] AC-02: Tapping `일정 추가` opens a single `일정 상세 입력` form where place is optional.
- [x] AC-03: With no selected place, entering title/category and saving creates a non-place schedule item using the existing non-place create API.
- [x] AC-04: With a selected Google place, saving creates a place-backed schedule item using the existing Google place create API.
- [x] AC-05: The form can open place search; selecting a search result returns to the form with the selected place card filled and common fields preserved.
- [x] AC-06: The form supports clearing the selected place; clearing switches back to non-place mode while preserving title/time/memo.
- [x] AC-07: Place selection auto-fills title from the place name only when the title is blank or untouched; manually edited titles are preserved.
- [x] AC-08: Non-place mode exposes the existing categories and transport/link fields, with the same validation as the current non-place create flow.
- [x] AC-09: Place-backed duplicate confirmation still appears for duplicate same-Day Google place saves and confirming saves the same detail values.
- [x] AC-10: Successful place-backed or non-place save returns to the itinerary tab for the same Day.
- [x] AC-11: Existing edit/delete/reorder/lodging/map/Today/settlement flows remain compatible.

## Implementation Notes

- The existing route `/trips/[tripId]/days/[date]/places/new` now acts as the unified create form.
- `apps/mobile/lib/places/place-schedule-detail.ts` owns unified form state, route param preservation, selected-place clearing, and place/non-place validation.
- The separate `장소 없는 일정 추가` create CTA was removed from Day itinerary content; non-place edit support remains.

## Verification

- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `pnpm harness:check-worktree-isolation`: pass
- `pnpm harness:validate`: pass
- `pnpm harness:check-bugfix-scenario -- --run-id issue-232-itinerary-add-flow-unification`: pass; non-bugfix skipped
