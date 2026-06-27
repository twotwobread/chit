# Feature Slice: F-147 Day 일정 장소 추가 후 back stack 중복 제거

## Metadata

- GitHub Issue: #147
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-27
- Updated: 2026-06-27

## Source

- Issue: #147 — https://github.com/twotwobread/i-um/issues/147
- Ouroboros/PM/Seed: Interview `interview_20260627_083243`; Seed `seed_41981e3526c3`; ambiguity score `0.08`
- Notes: 성공한 장소 추가 플로우에서 Day 상세가 navigation stack에 중복 누적되는 버그를 고친다. 취소/실패/하드웨어 뒤로가기 정책 변경은 이번 범위 밖이며, 직접 진입 fallback은 추가된 장소가 보이는 Day 상세 1개를 유지하는 것으로 한정한다.

## Goal

사용자가 Day 일정 상세에서 장소를 추가한 뒤 뒤로 가기를 눌렀을 때, 중복된 Day 상세가 다시 보이지 않고 장소 추가 전의 실제 이전 화면으로 돌아가게 한다.

장소 추가 성공 후에는 새 장소가 반영된 Day 상세 1개만 남아야 하며, 같은 Day에서 장소를 여러 번 연속 추가해도 back stack이 계속 쌓이지 않아야 한다.

## User Flow

### A. 이전 화면에서 Day 상세로 들어온 일반 흐름

1. 사용자가 여행 상세, 오늘 실행 등 어떤 이전 화면에서 Day 일정 상세로 이동한다.
2. Day 일정 상세에서 `장소 추가`를 누른다.
3. 앱이 장소 검색 화면으로 이동한다.
4. 사용자가 장소를 검색하고 추가한다.
5. 장소 추가 성공 후 앱은 기존 Day 상세로 돌아오고, 사용자는 수동 새로고침 없이 추가된 장소를 본다.
6. 사용자가 Day 상세에서 뒤로 가기를 누르면 장소 추가 전 Day 상세 아래에 있던 실제 이전 화면으로 돌아간다.

### B. 같은 Day에서 장소를 여러 번 연속 추가하는 흐름

1. 사용자가 Day 상세에서 장소 추가를 완료하고 Day 상세로 돌아온다.
2. 같은 Day 상세에서 다시 `장소 추가`를 눌러 다른 장소를 추가한다.
3. 여러 번 반복해도 Day 상세 route instance가 중복 누적되지 않는다.
4. 마지막 복귀 후 뒤로 가기 1회로 첫 장소 추가 전의 실제 이전 화면으로 돌아간다.

### C. 직전 화면이 없는 직접 진입/fallback 흐름

1. 사용자가 직접 place-search route에 진입했거나, navigation stack에 Day 상세 아래의 이전 화면이 없다.
2. 장소 추가에 성공한다.
3. 앱은 추가된 장소가 보이는 Day 상세 1개로 이동하거나 유지한다.
4. 특정 목적지(여행 상세/홈)로 강제 이동하는 정책은 요구하지 않는다.

## Scope

- App UI: yes
  - `apps/mobile/app/trips/[tripId]/days/[date].tsx`의 장소 추가 진입 navigation.
  - `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`의 장소 추가 성공 후 복귀 navigation.
  - 필요 시 `apps/mobile/lib/places/google-search.ts` 또는 `apps/mobile/lib/trips/**`에 navigation decision helper를 추가한다.
- API Contract: no changes.
- API Server: no changes.
- DB: no changes.
- Tests: `apps/mobile/lib/trips/day-itinerary-add-place-navigation.test.mts`, mobile lint/format/typecheck, manual Expo/native stack smoke.
- Deploy/Smoke: staging deploy not required for the spec itself; implementation release 전 실제 기기 또는 simulator smoke가 필요하다.

## Out of Scope

- 장소 검색/추가 API 동작, Google Places 검색 품질, 중복 장소 확인 비즈니스 규칙 변경.
- Day 일정 목록, 여행 상세, 오늘 실행 화면의 진입 정책 변경.
- 취소, 실패, 하드웨어 뒤로가기의 신규 정책 정의.
- 직접 진입 시 여행 상세나 홈으로 보내는 신규 fallback 정책.
- API contract, 서버, DB, generated client/schema 변경.
- 낙관적 업데이트나 별도 캐시 계층 추가. 기존 focus reload/useFocusEffect 기반 재조회 패턴을 활용하면 충분하다.

## Requirements

### UI / UX

- Screens:
  - Day 상세: `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 장소 검색: `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx`
- Day 상세에서 `장소 추가` 진입 시, 장소 추가 성공 후 기존 Day 상세로 돌아올 수 있도록 return/navigation intent를 보존해야 한다.
- 장소 추가 성공 후 Day 상세가 새로 push되어 기존 Day 상세 위에 쌓이면 안 된다.
- 성공 후 돌아온 Day 상세는 추가된 장소를 수동 새로고침 없이 보여야 한다.
  - 기존 Day 상세의 `useFocusEffect`/focus reload 재조회 패턴을 활용할 수 있다.
  - 별도 optimistic update는 요구하지 않는다.
- 성공 후 Day 상세에서 뒤로 가기 시, 장소 추가 진입 당시 Day 상세 아래에 있던 실제 이전 navigation entry로 돌아가야 한다.
  - 최소 기준은 같은 route/params의 이전 entry로 돌아가며 Day 상세 중복 entry가 중간에 끼지 않는 것이다.
  - 이전 화면 내부 상태 보존은 navigator가 기존 entry로 back할 때 자연스럽게 유지되는 범위만 요구한다.
- 같은 Day에서 장소 추가를 여러 번 반복해도 Day 상세 instance는 중복 누적되지 않아야 한다.
- 직전 navigation entry가 없는 직접 진입/fallback에서는 추가된 장소가 보이는 Day 상세 1개를 남기면 충분하다.
- 오류/권한/일정 없음 상태의 기존 copy와 화면 구조는 변경하지 않는다.

### API Contract

No API changes.

Existing mobile calls remain unchanged:

```text
GET /trips/{tripId}/days/{date}/itinerary
POST /trips/{tripId}/days/{date}/itinerary/google-places
```

### DB Changes

No DB changes.

### Business Rules

- 장소 추가 성공은 `createGooglePlaceDayItineraryItem`이 성공 응답을 받은 뒤로 정의한다.
- 성공 경로에서는 Day 상세 route가 중복 push/replace되어 back stack에 여러 개 남으면 안 된다.
- 장소 추가 전 실제 이전 entry가 있으면 그 entry가 back 대상이다. 특정 화면 종류(여행 상세 등)로 한정하지 않는다.
- 직접 진입처럼 이전 entry가 없으면 Day 상세 1개로 안전하게 fallback한다.
- 반복 추가도 단일 추가와 같은 stack invariant를 유지해야 한다.
- API/DB 도메인 규칙은 기존 구현을 그대로 따른다.

## Acceptance Criteria

- [x] AC-01: `docs/features/0147-day-detail-add-place-back.md`에 F-147 spec, TDD plan, Ouroboros interview/seed metadata가 기록된다.
- [x] AC-02: Day 상세에서 장소 추가 성공 후 사용자는 수동 새로고침 없이 새 장소가 반영된 Day 상세를 본다.
- [x] AC-03: 장소 추가 성공 후 해당 Day 상세 route instance가 stack에 중복 누적되지 않는다.
- [x] AC-04: 성공 후 복귀한 Day 상세에서 뒤로 가기 1회는 장소 추가 진입 전 Day 상세 아래에 있던 실제 이전 entry로 돌아간다.
- [x] AC-05: back 대상은 특정 진입 경로로 제한하지 않고, 여행 상세/오늘 실행/딥링크 등 Day 상세를 연 실제 route/params 기준으로 동작한다.
- [x] AC-06: 같은 Day에서 장소 추가를 여러 번 연속 성공해도 Day 상세 중복 instance가 누적되지 않으며, 마지막 복귀 후 뒤로 가기 1회로 원래 이전 entry에 도달한다.
- [x] AC-07: 직전 entry가 없는 직접 진입/fallback에서는 장소 추가 성공 후 새 장소가 보이는 Day 상세 1개를 유지한다.
- [x] AC-08: 취소/실패/인증 오류/일정 없음 상태의 기존 UX는 의도적으로 재정의하지 않는다. navigation wiring이 바뀌는 경우 이 경로들이 새 Day 상세 중복 entry를 만들지 않는지만 회귀 확인한다.
- [x] AC-09: OpenAPI, API server, DB migration/query, generated artifacts는 변경되지 않는다.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-02~AC-04: Day-launched place-search success uses existing Day entry/back semantics instead of pushing or replacing to a duplicate Day detail | Mobile navigation helper/unit | `apps/mobile/lib/trips/day-itinerary-add-place-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-03, AC-06: repeated success keeps the same return strategy and never resolves to an additional Day detail push | Mobile navigation helper/unit | `apps/mobile/lib/trips/day-itinerary-add-place-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-07: no-previous-entry/direct-entry fallback resolves to `buildDayItineraryRoute(tripId, date)` replace or equivalent single Day detail fallback | Mobile navigation helper/unit | `apps/mobile/lib/trips/day-itinerary-add-place-navigation.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-02: returned Day detail reloads itinerary on focus and can show the newly added place without manual refresh | Mobile screen/type gate + manual smoke | Existing `useFocusEffect` in `apps/mobile/app/trips/[tripId]/days/[date].tsx`; no broad component harness currently present | `pnpm --filter @i-um/mobile typecheck` + manual smoke |
| AC-08: cancel/error paths still do not create a new Day detail duplicate if touched | Mobile smoke/regression | Place-search error/cancel manual checklist; add helper tests only if logic is extracted | `pnpm --filter @i-um/mobile test` + manual smoke |
| AC-09: API/DB/generated artifacts untouched | Diff gate | Targeted diff | `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts` |

## Regression Gaps

- Expo Router/native navigation stack instance count is not fully observable in the current Node unit test harness.
  - Risk: A helper test can prove the chosen router action, but an actual device/simulator may still expose stack behavior differences.
  - Follow-up: Manual simulator/device smoke is required before marking implementation release-ready.
- Newly added place visibility depends on real API mutation + Day detail focus reload timing.
  - Risk: Unit tests may not prove the end-to-end perceived freshness after native navigation.
  - Follow-up: Manual smoke must confirm the added place appears after returning without pull-to-refresh or extra navigation.

## TDD Implementation Plan

1. Red: Add focused mobile navigation tests
   - Add a small helper test for the Day add-place success navigation decision.
   - Cover Day-launched search with previous history: expected action is `back`/existing-entry return, not `push` or `replace` to another Day detail.
   - Cover no previous entry or missing Day-launched intent: expected action is safe fallback to `replace(buildDayItineraryRoute(tripId, date))` or equivalent single-Day-detail fallback.
   - Cover repeated success by asserting the same Day-launched return strategy is used every time.
   - Verify: `pnpm --filter @i-um/mobile test` fails.
2. Green: Implement the minimal navigation helper and route intent
   - Preserve the existing Day 상세 → place-search entry flow while marking that the search was launched from a Day detail instance.
   - On `createGooglePlaceDayItineraryItem` success, return to the existing Day detail entry when that Day-launched intent and back history exist.
   - Fall back to `buildDayItineraryRoute(tripId, date)` replace when there is no reliable previous Day entry.
   - Reuse `buildGooglePlaceSearchRoute` and `buildDayItineraryRoute`; do not hardcode paths.
   - Verify: `pnpm --filter @i-um/mobile test`.
3. Red/Green: Wire screens with minimal UI changes
   - Update `apps/mobile/app/trips/[tripId]/days/[date].tsx` to use the route/intent helper for `onAddPlace`.
   - Update `apps/mobile/app/trips/[tripId]/days/[date]/place-search.tsx` success handling to use the helper action.
   - Keep back link, auth redirect, not-found, and error copy unchanged unless the helper requires a non-user-visible param read.
   - Verify: `pnpm --filter @i-um/mobile typecheck`.
4. Refactor: Keep navigation logic out of screen bodies where practical
   - Keep screen files focused on route params, API calls, and invoking router actions.
   - Keep any route formatting/decision logic in `apps/mobile/lib/**`.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck`.
5. Drift gate
   - Verify no API contract, API server, DB, sqlc, or generated client artifacts changed.
   - Command: `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`.
6. Manual smoke gate
   - From a trip/day with an existing previous screen, open Day 상세 → 장소 추가 → add one place → confirm the new place is visible → press back once → confirm the original previous screen appears.
   - Repeat 장소 추가 twice from the same Day 상세 → press back once → confirm the original previous screen appears and no Day 상세 duplicate is shown.
   - Direct/fallback smoke if practical: open place-search without a Day detail below it → add place → confirm the app lands on one updated Day 상세.
   - Error/cancel smoke if touched: search failure or back/cancel does not add a Day 상세 duplicate.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: Pass — 229 tests, 17 suites.
- `pnpm --filter @i-um/mobile typecheck`: Pass.
- `pnpm --filter @i-um/mobile lint`: Pass.
- `pnpm --filter @i-um/mobile format:check`: Pass.
- `git diff --exit-code -- packages/api-contract/openapi.yaml apps/api/migrations apps/api/queries apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts`: Pass — no API/DB/generated diff.

### Manual Smoke

- Day 상세 → 장소 추가 → 성공 → Day 상세 back stack: not run — local device/simulator smoke not requested.
- Repeated 장소 추가 success flow: not run — local device/simulator smoke not requested.
- Direct/fallback entry: not run — local device/simulator smoke not requested.

## Release Notes

- Day 일정에서 장소를 추가한 뒤 뒤로 가기를 눌렀을 때 Day 상세가 중복으로 다시 나타나는 navigation 문제를 수정한다.

## Open Questions

- None

## Follow-up Issues

- None
