# Feature Slice: 지도·일정·정산/지출 화면 UI 순차 이관

## Metadata

- GitHub Issue: #161
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-28
- Updated: 2026-06-28

## Source

- Issue: #161 — [Mobile UI Refactor 4/6] 지도·일정·정산 화면 UI 순차 이관
- Depends on: #160 — Today 실행 화면 컴포넌트 조립형 리팩토링, merged into `origin/develop`
- Ouroboros/PM/Seed: Interview `interview_20260628_092538`; ambiguity score was not returned by the MCP session. Seed generation attempted via MCP but repeatedly timed out, so no seed artifact/path is available.
- Local handoff package: `refactor/README.md`, `refactor/MAPPING.md` sections 1, 3, 4, `refactor/PROMPT.md` task 4
- Current mobile sources: `apps/mobile/app/trips/[tripId]/days/[date].tsx`, `apps/mobile/lib/trips/day-itinerary.ts`, `apps/mobile/lib/trips/day-itinerary-map-actions.ts`, `apps/mobile/lib/trips/day-expenses.ts`, `apps/mobile/lib/trips/reorder-itinerary.ts`, `apps/mobile/lib/design/primitives.tsx`, `apps/mobile/lib/trip-ui/NextPlaceHeroCard.tsx`
- Notes: #161 treats “map / itinerary / settlement” as refactor responsibility buckets inside the existing single-scroll Day screen, not as a promise to add three new visible top-level sections. Current repo facts show the Day screen already renders itinerary/place rows and a Day expense history section; it does not have a separate map tab/container or true settlement summary UI. Implementation chose tokenized row/action composition without optional movement connector rows, and kept current formatted expense amount strings instead of `AmountText` to preserve USD/EUR/KRW/JPY parity.

## Goal

여행 Day 화면의 기존 지도 관련 액션, 일정 목록, 지출 목록을 #160에서 검증한 token-based primitive/component 조립 방식으로 정리한다.

이번 slice는 `apps/mobile/app/trips/[tripId]/days/[date].tsx`의 동작과 정보 구조를 유지하면서 반복 row/card/style 구현과 화면 내 presentation shaping을 줄이는 UI 리팩토링이다. 새 지도 기능, 새 정산 기능, 트립 레벨 Tabs, API/DB 변경은 포함하지 않는다.

## User Flow

1. 사용자가 로그인된 상태로 `/trips/{tripId}/days/{date}` Day 화면을 연다.
2. 앱은 기존과 동일하게 Day itinerary와 Day expense list를 로드하고, loading/auth/not-found/error/empty/success 상태를 처리한다.
3. 사용자는 기존 top-to-bottom 흐름 그대로 Day 일정 영역을 본다. 장소 row, 순서 표시, 숙소 배지/액션, 지도 열기, 주소 복사, 장소 추가/수정/삭제/순서 변경 진입은 기존 의미와 위치 관계를 유지하되 tokenized row/action composition으로 정리된다.
4. 지도 관련 표현은 별도 map 섹션이 아니라 기존 itinerary-adjacent UI 안에서 처리된다. 필요한 경우 현재 ordered itinerary data로만 만든 read-only movement/sequence 표현을 인라인으로 보여주며, 실제 지도/경로 계산은 추가하지 않는다.
5. 사용자는 일정 영역 아래의 기존 `지출` 섹션에서 loading/error/empty/success 상태와 지출 row를 본다. 빈 상태의 `지출 등록` 진입과 기존 quick-expense route는 유지된다.
6. 사용자는 기존처럼 edit/delete/reorder/lodging/map/copy/expense-add flows에 진입하고, refactor 전과 같은 side effect와 feedback을 받는다.

## Scope

- App UI: yes — existing Day screen `apps/mobile/app/trips/[tripId]/days/[date].tsx`
- App Logic: yes — deterministic presentation shaping helpers only, in or near `apps/mobile/lib/trips/day-itinerary.ts`, `apps/mobile/lib/trips/day-itinerary-map-actions.ts`, `apps/mobile/lib/trips/day-expenses.ts`, or small Day-screen-local presentational components
- API Contract: no — `No API changes.`
- API Server: no
- DB: no
- Tests: mobile helper/view-model tests for extracted presentation shaping and behavior-preserving seams; mobile typecheck for screen integration
- Deploy/Smoke: no staging deploy required; manual simulator/device smoke recommended for Day itinerary/map-action/expense flows

## Out of Scope

- Trip-level Tabs, `app/trips/[tripId]/_layout.tsx`, or lateral 오늘·지도·일정·정산 navigation (#162)
- Moving Day screen behavior into separate map/itinerary/settlement routes
- New standalone map section/header/container, route summary card, mini-map, route canvas, coordinate handling, pin strip, map legend, route drawing, transport overview, or native map provider integration
- New distance/time estimation, transport-mode inference, route-preview API calls, or external lookup/calculation for the Day screen
- True settlement product surfaces: per-person balances, debt netting, settlement summary math, transfer/payment CTA, person-scoped summaries, sticky totals, or settlement completion states
- New expense filters/toggles/chips/segmented controls unless an equivalent control already exists on this screen today
- New expense grouping/sorting models such as date buckets, person buckets, summaries, or totals
- Changing itinerary domain behavior: time-anchor policy, unscheduled policy, lodging policy, reorder rules, edit/delete rules, shared-update behavior, or item ordering
- Changing current user-facing copy/labels except for explicitly introduced movement connector text, if implementation chooses to render movement rows
- API/OpenAPI/server/DB/generated-code changes
- New design tokens, raw hex colors, arbitrary spacing/radius/font values, or new dependencies
- BottomSheet/modal conversions for edit/expense flows

## Requirements

### UI / UX

#### Screen and state boundary

- Target screen remains `apps/mobile/app/trips/[tripId]/days/[date].tsx`.
- Preserve the current single-scroll, single-column Day screen flow.
- Preserve current top-level information hierarchy and section order by default:
  1. Existing Day/itinerary content
  2. Existing `지출` expense history section
  3. Existing edit/delete/reorder modal/panel surfaces when triggered
- Do not introduce new visible top-level titles such as `지도`, `일정`, or `정산` unless that label already exists on the current screen.
- Existing loading, auth, not-found, retryable error, empty, success, shared-update notice, mutation error, reorder conflict, and expense-section states must preserve current behavior, placement, and copy.
- Screen files should keep route params, API calls, mutations, navigation, focus/accessibility recovery, state ownership, and composition orchestration. Formatting, sorting/grouping already implied by current behavior, token-ready row models, and display labels should move to pure helpers where useful.

#### #160 token/component adoption

- #160 is the visual and extraction-style baseline, not a mandate to copy Today’s exact section taxonomy.
- Prefer existing primitives where semantics fit naturally:
  - `ListRow` for place/expense rows when it can preserve action/focus/accessibility semantics
  - `PlacePin` / `PlaceTag` for existing order/place-type markers when replacing current bespoke order/type styling
  - `Badge` / `Pill` for existing status labels such as lodging/status markers when semantics match
  - `AmountText` for amounts only if current `formatMoney` output and supported currencies remain equivalent; otherwise keep a token-styled text fallback or extend the primitive with tests before use
  - `Chip` / `SegmentedControl` only if an equivalent current control already exists on this screen; do not add dormant/new filters just to use them
- If a primitive does not fit without behavior, copy, currency, or accessibility drift, keep a small Day-specific presentational fragment and document the retained bespoke surface in the component checklist/regression gaps.
- Do not create a second local pattern library inside `days/[date].tsx`; local components should be narrow presentation wrappers for this screen only.

#### Map responsibility bucket

- In #161, “map” means current itinerary-adjacent map affordances and sequence/movement presentation derived from existing Day itinerary data.
- Canonical current behavior is `apps/mobile/lib/trips/day-itinerary-map-actions.ts`:
  - `지도` opens a Google Maps search URL built from place name/address.
  - `주소 복사` copies the normalized address when present.
  - Missing address disables copy and keeps `주소 정보가 없어요.` helper semantics.
  - Copy success/failure and map failure feedback remain unchanged.
- Required map refactor:
  - Keep map/search/copy actions attached to the same place-row meaning and availability rules.
  - Present these actions through tokenized row/action composition where possible.
  - Preserve accessibility labels/hints/states for `지도` and `주소 복사`.
- Optional movement/sequence presentation:
  - A pure helper may derive read-only movement rows or connector view-models only from consecutive ordered itinerary items already present in the Day itinerary view model.
  - Eligible pairs are consecutive ordered items that both participate in the ordered itinerary sequence; lodging items may participate because they are current itinerary rows.
  - If a pair lacks the minimum existing data needed for the chosen read-only presentation, omit the movement row instead of showing a fallback/placeholder.
  - Movement rows must not add press targets, menus, chips, disclosures, distance/time estimates, transport-mode labels, route geometry, coordinates, or external lookups.
  - If visible connector copy is needed, it must be neutral and explicitly tested (for example, a short “다음 장소로” style label); do not imply data that is not available.
- The map scope is also satisfied if implementation discovery shows that embedding clearer map actions and existing order/place markers in tokenized itinerary rows reduces duplication without adding movement rows.

#### Itinerary responsibility bucket

- Preserve current itinerary data semantics from `apps/mobile/lib/trips/day-itinerary.ts`:
  - `dayLabel` and `formattedDate`
  - empty state title/helper
  - success rows sorted by `itemOrder`
  - row fields: `id`, `version`, `orderLabel`, `isLodging`, `placeId`, `placeName`, `placeType`, `placeTypeLabel`, `address`
- Current repo facts show no separate time-anchor/unscheduled model in `day-itinerary.ts`; #161 must not invent one. If existing code paths already render scheduled/unscheduled/time-anchor distinctions, preserve them exactly; otherwise keep them out of scope.
- Place rows should move toward a single tokenized row composition pattern, including lodging rows, while preserving special-case data/actions.
- Existing row actions and flows must keep current triggers, availability rules, labels, disabled/loading states, focus behavior, and side effects:
  - 장소 추가
  - 지도
  - 주소 복사
  - 숙소 지정/해제
  - 수정
  - 삭제
  - 순서 변경 / 저장 / 취소
  - shared-update reload and notices
- Reorder is preserve-only:
  - Drag semantics, move target calculation, auto-scroll, save request construction, conflict handling, and mutation flow must not change.
  - Tokenized wrappers may restyle the row shell/handle only if tests and smoke prove parity.
- Place/order markers may be visually restyled or modestly repositioned to use #160 primitives, but the same sequence meaning and underlying data must be preserved.

#### Settlement / expense responsibility bucket

- For #161, the “settlement/expense” area is narrowed to the current Day expense history surface derived by `apps/mobile/lib/trips/day-expenses.ts`.
- Preserve current expense semantics:
  - loading state copy: `지출을 불러오는 중...`
  - error title/helper/action: `지출을 불러올 수 없어요.`, `잠시 후 다시 시도해주세요.`, `다시 시도`
  - empty title/helper/action: `아직 등록된 지출이 없어요.`, `지출 등록을 눌러 오늘 쓴 금액을 남겨보세요.`, `지출 등록`
  - success rows show display title/place, amount, and detail line semantics
  - `detailLine` remains `결제 {payer} · {splitSummary}` using saved splits
  - current list ordering/meaning remains unchanged
  - empty CTA still routes to the existing quick-expense flow for the current `tripId`/`date`
- Refactor expense rows to `ListRow`/tokenized composition where possible.
- `AmountText` may be used only if it preserves current `formatMoney` output for all currencies exercised by existing tests. If not, either extend `AmountText` with regression tests or keep the current formatted string in token-styled text.
- Do not add per-person balances, settlement summaries, netting, totals, chips, filters, toggles, or person-based grouping in #161 unless such UI already renders on this screen before the refactor.

### API Contract

`No API changes.`

### DB Changes

`No DB changes.`

### Business Rules

- #161 is a UI composition refactor. It must not change itinerary, map-link, lodging, expense, split, or settlement domain policy.
- Existing mobile helper contracts remain the source of truth for current behavior:
  - `day-itinerary.ts` for Day row/empty state shaping
  - `day-itinerary-map-actions.ts` for Google Maps URL/address-copy actions and feedback
  - `day-expenses.ts` for expense empty/success/error shaping and split summary text
  - `reorder-itinerary.ts` and `reorder-itinerary-drag.ts` for reorder behavior
- New helpers must be deterministic and synchronous presentation shaping only. Do not introduce new fetch boundaries, cache, async effects, navigation branching, or mutation orchestration.
- Design tokens come from `apps/mobile/lib/design/theme.ts`; shared primitives come from `apps/mobile/lib/design/primitives.tsx` / `apps/mobile/lib/design/index.ts`.

## Acceptance Criteria

- [x] AC-01: `docs/features/0161-map-itinerary-settlement-ui.md` contains the approved spec and TDD implementation plan.
- [x] AC-02: `apps/mobile/app/trips/[tripId]/days/[date].tsx` remains the Day screen orchestration entrypoint; #161 does not add trip-level Tabs or new map/itinerary/settlement routes.
- [x] AC-03: The screen preserves the current top-to-bottom hierarchy and section order; no new standalone `지도`/`정산` top-level section, route summary card, mini-map, or settlement container is introduced.
- [x] AC-04: Existing loading/auth/not-found/error/empty/success state branching and visible copy remain unchanged unless an explicitly tested token wrapper moves the same text into a new component boundary.
- [x] AC-05: Itinerary success rows remain ordered by current `itemOrder` semantics and preserve row identity/version/place/lodging/address/place-type data.
- [x] AC-06: Itinerary row composition uses #160-style token primitives or narrow local presentational wrappers where semantics match, reducing bespoke row/card/order/action styling without behavior drift.
- [x] AC-07: Existing `지도` and `주소 복사` actions preserve URLs, disabled rules, helper text, feedback, accessibility semantics, and side effects.
- [x] AC-08: If movement connector rows are implemented, they are read-only, derived only from eligible consecutive ordered itinerary items, omit insufficient-data pairs, and add no route estimates, map provider work, or new interactions.
- [x] AC-09: Add/edit/delete/reorder/lodging/shared-update flows preserve current triggers, labels, availability rules, loading/disabled states, focus behavior, error feedback, and mutation/navigation targets.
- [x] AC-10: Reorder drag/save/conflict behavior remains preserve-only and is covered by existing or updated helper tests.
- [x] AC-11: The `지출` section preserves current loading/error/empty/success behavior, copy, quick-expense entry route, amount/detail semantics, and current ordering.
- [x] AC-12: Expense rows use tokenized composition where safe; amount rendering preserves current `formatMoney` output across supported/tested currencies.
- [x] AC-13: #161 adds no per-person balance, netting, settlement summary, total, settlement CTA, new filter/toggle/chip state, or new expense grouping model.
- [x] AC-14: Presentation shaping that grows beyond simple JSX glue lives in pure helper(s) under `apps/mobile/lib/**` or narrow local components; no new API/DB/domain/fetch/state ownership is introduced.
- [x] AC-15: No raw hex colors, arbitrary design tokens, new dependencies, generated-code changes, OpenAPI changes, server changes, or DB migrations are introduced.
- [x] AC-16: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
- [ ] AC-17: Manual smoke confirms itinerary map/copy actions, add/edit/delete/reorder entry, lodging action entry, expense list/empty/retry states, and expense add entry still work.

## Component Usage Checklist

| Surface | Target / rule | Notes |
|---|---|---|
| Day/section container | Existing layout + tokenized local wrapper if useful | Preserve hierarchy and copy |
| Place/order marker | Prefer `PlacePin` / `PlaceTag` or tokenized equivalent | Preserve orderLabel/placeType meaning |
| Place row | Prefer `ListRow` or narrow local row component | Must preserve action/focus/accessibility semantics |
| Lodging status/action | Prefer `Badge` / `Pill` only when semantics fit | No lodging behavior changes |
| Map actions | Existing `day-itinerary-map-actions` + tokenized action shell | URL/copy/disabled/feedback unchanged |
| Movement connector | Optional read-only local component/helper | Only from existing ordered pairs; no map data |
| Reorder row/handle | Tokenized shell only if drag parity is preserved | Keep existing helper behavior |
| Expense row | Prefer `ListRow` | Non-tappable unless current behavior changes separately |
| Expense amount | Prefer `AmountText` only with currency/format parity | Otherwise keep formatted string with token text style |
| Expense filters/toggles | Out of scope unless existing semantic equivalent exists today | No dormant controls |
| True settlement summary | Out of scope | Follow-up product/API/UI slice |

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Day itinerary row shaping preserves itemOrder, empty state, place/lodging fields, and any new token-ready row model | Mobile helper | `apps/mobile/lib/trips/day-itinerary.test.mts` or new adjacent test | `pnpm --filter @i-um/mobile test` |
| Optional movement connector eligibility/omission is deterministic and uses only existing ordered items | Mobile helper | new/updated `day-itinerary` presentation test | `pnpm --filter @i-um/mobile test` |
| Map/search/copy action URLs, disabled state, helper text, and feedback remain unchanged | Mobile helper | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Reorder action/draft/move/request/conflict behavior remains unchanged if row shell changes | Mobile helper | existing `reorder-itinerary*.test.mts` | `pnpm --filter @i-um/mobile test` |
| Expense empty/success rows preserve copy, quick-expense route, amount labels, split summaries, and ordering semantics | Mobile helper | `apps/mobile/lib/trips/day-expenses.test.mts` | `pnpm --filter @i-um/mobile test` |
| Amount rendering keeps current currency formatting when using/adjusting `AmountText` | Mobile helper/component-adjacent | existing/new `day-expenses` or design primitive test | `pnpm --filter @i-um/mobile test` |
| Screen integration compiles after extraction/import changes | Mobile type/static | `days/[date].tsx` and helpers | `pnpm --filter @i-um/mobile typecheck` |
| No API/DB/generated drift | Static review | Diff review | `git diff --name-only -- packages/api-contract apps/api apps/mobile/lib/trips/client.ts` |
| Token/style/import conventions clean | Mobile lint if touched enough to warrant it | ESLint | `pnpm --filter @i-um/mobile lint` |
| Final mobile gate | Mobile | relevant mobile tests/types | `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck` |

## Regression Gaps

- Full React Native visual/render parity for the large Day screen is not currently covered by an established screen-level test harness.
  - Risk: spacing, grouping, or row affordance regressions may only appear on simulator/device.
  - Follow-up: manual smoke for #161; add component/e2e harness later if the project adopts one.
- If movement connector rows are implemented, their visual scanability is primarily manual unless a component render harness is added.
  - Risk: read-only connector rows may add clutter even without behavior changes.
  - Follow-up: keep connector rows optional and remove them if manual smoke shows reduced clarity.
- True settlement UI remains out of scope.
  - Risk: The issue title/labels mention settlement, but the current Day screen has only expense history data and prior expense specs explicitly defer settlement summaries.
  - Follow-up: file/implement a dedicated settlement summary/balance slice after product semantics are approved.

## TDD Implementation Plan

1. Red: Add or extend helper tests for token-ready Day itinerary/place-row presentation, preserving `itemOrder`, lodging flags, empty state copy, and action model inputs.
   - Verify: `pnpm --filter @i-um/mobile test -- --runInBand` if supported by the existing runner, otherwise `pnpm --filter @i-um/mobile test`
2. Red: Add/extend `day-itinerary-map-actions` tests for unchanged Google Maps URL, missing-address disabled helper, and copy/map feedback.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Red: Add/extend `day-expenses` tests for token-ready row fields, preserved `amountLabel` / `detailLine`, empty CTA route, and currency parity if `AmountText` is used.
   - Verify: `pnpm --filter @i-um/mobile test`
4. Green: Implement pure presentation shaping helpers and/or small local presentational components without changing data fetching, mutation, navigation, or state ownership.
   - Verify: `pnpm --filter @i-um/mobile test`
5. Green: Recompose `days/[date].tsx` to use token primitives/local wrappers for itinerary rows, map actions, optional movement connectors, and expense rows while preserving current positions and flow ownership.
   - Verify: `pnpm --filter @i-um/mobile typecheck`
6. Refactor: Remove duplicated StyleSheet blocks and row/card fragments only after parity tests/typecheck pass. Keep bespoke fragments where primitives would cause behavior/accessibility drift and document them in the component checklist.
   - Verify: `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
7. Gate: Review diff for no API/DB/generated drift and run final mobile verification.
   - Verify: `git diff --name-only -- packages/api-contract apps/api apps/mobile/lib/trips/client.ts`; `pnpm --filter @i-um/mobile test`; `pnpm --filter @i-um/mobile typecheck`
8. Manual smoke: On simulator/device, check Day screen itinerary rows, map open/copy, add/edit/delete/reorder entry and cancel/save affordances, lodging action entry, expense loading/error/empty/success, and expense add route.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `git diff --name-only -- packages/api-contract apps/api apps/mobile/lib/trips/client.ts`: pass (no output)

### Manual Smoke

- Day itinerary/map/copy/edit/delete/reorder/lodging/expense flows: not run (requires simulator/device smoke)

## Release Notes

- Mobile Day 화면의 일정·지도 액션·지출 목록 UI를 기존 동작 그대로 유지하면서 #160 기반 token/component 조립 패턴으로 정리했다.

## Open Questions

- None for #161’s conservative refactor scope.

## Follow-up Issues

- #162 — 트립 레벨 Tabs 도입 및 오늘·지도·일정·정산 IA 분리
- Future dedicated settlement slice — per-person balances, netting, settlement summary, settlement actions, and any expense filters/toggles with approved product semantics
- Future map slice — native/inline map preview, route geometry, pins, transport summaries, or route provider integration if product scope requires it
