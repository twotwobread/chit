# Feature Slice: F-039 장소 지도 열기/주소 복사

## Metadata

- GitHub Issue: #39
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-24
- Updated: 2026-06-24

## Ouroboros Source

- Interview Session: `interview_20260623_152137`
- Seed: `seed_3f7941a35ba3`
- PM Document: `N/A`
- Notes: Ambiguity score `0.105`. Ouroboros fixed the scope to mobile Day itinerary row actions on `/trips/{tripId}/days/{date}`. F-039 intentionally stays out of today execution and remaining places work because of parallel `#32`. Spec draft execution session: `orch_d5bd36165202`.

## Goal

사용자가 모바일 Day 일정 화면에서 각 장소 row마다 Google Maps를 열거나 주소를 바로 복사할 수 있다.

F-039는 기존 Day itinerary data만 재사용하는 작은 app-only slice다. 지도 열기와 주소 복사는 row 단위 행동으로 제공하고, backend 변경 없이 구현 가능해야 한다.

## Problem

- 현재 Day itinerary place row는 장소명, 타입, 주소만 보여주고 있어 사용자가 길찾기나 주소 공유를 위해 앱 밖으로 다시 복사하거나 직접 검색해야 한다.
- 장소 action 진입점이 row에 명확히 보이지 않으면 사용자가 long-press, swipe, hidden gesture를 추측해야 해서 discoverability가 낮다.
- 오늘 실행 화면과 남은 장소 목록은 병렬 `#32` 범위이므로, F-039는 기존 Day itinerary row 안에서만 안전하게 기능을 추가해야 한다.

## User Flow

1. 사용자가 모바일 앱에서 `/trips/{tripId}/days/{date}` Day itinerary 화면을 연다.
2. 앱은 기존 itinerary response의 각 `DayItineraryItem.place` row를 렌더링한다.
3. 각 place row는 주소 아래 또는 기존 row action 영역 안에 계속 보이는 action affordance를 표시한다. 직접 button을 노출하는 경우 row마다 `지도`, `주소 복사` label이 그대로 보여야 하고, 직접 button을 노출하지 않는 경우에도 row마다 항상 보이는 `더보기` 또는 `장소 액션` affordance가 있어야 한다.
4. 사용자가 지도 action을 누르면 앱은 place name과 address를 조합한 Google Maps search URL을 만들고 `Linking.openURL`로 연다.
5. address가 비어 있으면 앱은 place name만으로 URL을 만들고 같은 action을 유지한다.
6. `지도 열기` 성공은 외부 Google Maps app 또는 browser 전환 자체로 간주하며, 앱 안에서는 별도 success toast나 inline notice를 추가로 띄우지 않는다.
7. 사용자가 `주소 복사`를 누르면 address가 있는 row에서만 복사가 수행되고 짧은 inline notice 또는 toast로 `주소를 복사했어요.` feedback을 보여준다.
8. address가 없거나 blank-trim 후 empty인 row는 `주소 복사`를 disabled 상태 또는 미노출 상태로 보여주고, long-press 같은 숨겨진 대체 진입점은 제공하지 않는다.

## Scope

이번 feature slice에 포함되는 범위다.

- [x] App UI: `apps/mobile/app/trips/[tripId]/days/[date].tsx`의 Day itinerary place row마다 visible row-scoped 지도/주소 action affordance를 추가한다.
- [x] App Logic: place name + optional address로 Google Maps search URL을 만드는 pure mobile helper와 defensive fallback을 추가한다.
- [x] App Logic: address 존재 여부에 따른 copy availability, open/copy success-failure feedback mapping을 정의한다.
- [x] App Dependency: 현재 clipboard dependency가 없으면 Expo SDK에 맞는 `expo-clipboard` 같은 최소 clipboard dependency 추가를 허용한다.
- [x] API Contract: No API changes. Existing `DayItineraryItem.place.name`, `place.placeType`, `place.address`만 사용한다.
- [x] API Server: No server changes.
- [x] DB: No DB changes.
- [x] Tests: `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` 같은 mobile unit test에서 URL builder, missing-address fallback, blank-trim defensive handling, copy enabled-disabled behavior를 검증하는 회귀 계획을 추가한다.
- [ ] Deployment: internal build 또는 local device에서 Day row별 `지도 열기`, `주소 복사`, missing-address fallback을 smoke 확인한다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- Today execution screen `/` 또는 next/remaining places UI 변경 (`#32`)
- `/trips/{tripId}/days/{date}` 밖의 다른 route에서 지도/주소 action 추가
- 새 OpenAPI schema, endpoint, generated client regeneration이 필요한 backend contract 변경
- server-side maps URL generation, redirect endpoint, analytics persistence
- 위도/경도, place id, 이동 수단, deep link provider selection 같은 richer maps integration
- Google Maps app scheme 우선 시도, platform별 fallback chain, Apple Maps/Naver Maps/KakaoMap 분기
- hidden long-press, swipe-only, drag-handle-only gesture로 action에 진입하는 UX
- address가 없는 row에서 빈 문자열 복사 허용
- clipboard 지원을 위한 최소 mobile dependency 추가를 넘어선 broader dependency/refactor 작업

## UX / UI Requirements

### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - Day itinerary success state의 각 place row에 row-scoped action affordance를 노출한다.
  - action은 row 안에서 항상 보이거나, 최소한 row별로 항상 보이는 `더보기` 또는 `장소 액션` button을 통해 열려야 한다.
  - F-039의 기준 entry pattern은 hidden gesture가 아니라 visible inline action group 또는 visible row action menu다.
  - inline direct action group을 쓰면 각 row에 `지도`, `주소 복사` text label이 그대로 보여야 한다.
  - 최소 action set:
    - 지도 action
    - `주소 복사`
  - action은 해당 row의 `place.name` / `place.address`에만 연결된다. 다른 row나 header 전역 action으로 합치지 않는다.

### Entry Pattern / Discoverability

- 각 place row는 사용자가 학습 없이 찾을 수 있도록 계속 보이는 action affordance를 제공해야 한다.
- 허용되는 패턴:
  - inline text button group처럼 row에 직접 `지도`, `주소 복사`를 노출하는 방식
  - row마다 항상 보이는 `더보기` 또는 `장소 액션` affordance를 두고, 한 번 탭하면 `지도 열기`, `주소 복사` item이 보이는 menu 방식
- menu 방식을 택하면 action item은 추가 gesture나 두 번째 탐색 단계 없이 첫 탭 결과로 바로 보여야 한다.
- inline direct button 방식을 택하면 각 row에서 `지도`, `주소 복사`가 success state의 기본 visible label이어야 한다.
- 허용되지 않는 패턴:
  - long-press 후에만 보이는 menu
  - swipe action만으로 노출되는 action
  - drag/reorder gesture 안에 숨어 있는 action
  - 화면 상단 공용 버튼 하나로 현재 row를 추정하게 만드는 방식
- row action label은 현재 row content와 시각적으로 가까워야 하며, tap target은 기존 mobile button 패턴을 따른다.

### States

- Loading: F-039 전용 추가 상태 없음. 기존 Day itinerary loading state를 유지한다.
- Empty: itinerary item이 없으면 row action도 없다. 기존 empty state를 유지한다.
- Error: screen fetch error state는 기존 Day itinerary behavior를 유지한다.
  - Success:
    - address가 있는 row:
      - `지도 열기` enabled
      - 성공 신호는 외부 app/web handoff 자체이며, 추가 success message는 없다.
      - `주소 복사` enabled
      - `주소 복사` 성공 직후 짧은 inline notice 또는 toast `주소를 복사했어요.`를 노출한다.
    - address가 비어 있거나 blank-trim 후 empty인 row:
      - `지도 열기` enabled, query는 place name only
      - 성공 신호는 외부 app/web handoff 자체이며, 추가 success message는 없다.
      - `주소 복사` disabled 또는 미노출

### Copy / Labels

- Direct row button: `지도`
- Direct row button or menu item: `주소 복사`
- Menu item, if a row action menu is used: `지도 열기`
- Map open success feedback: none. Successful external app/browser transition is the only success signal.
- Copy success feedback: `주소를 복사했어요.`
- Copy success presentation: short inline notice 또는 toast
- Copy failure feedback: `주소를 복사할 수 없어요. 잠시 후 다시 시도해주세요.`
- Map open failure feedback: `지도를 열 수 없어요. 잠시 후 다시 시도해주세요.`
- Optional disabled helper: `주소 정보가 없어요.`
- Disabled rule: `place.address`가 없거나 blank-trim 후 empty이면 `주소 복사`는 실행할 수 없다.

### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 화면 코드에 추가하지 않는다.
- 제품 UI에 emoji 또는 임의 unicode icon을 사용하지 않는다.
- 기존 Day itinerary row의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- 같은 row action/button 패턴이 이번 변경으로 두 번째 이상 반복되면 이번 변경 범위 안에서만 공용 primitive 승격을 검토하고, 범위 밖 refactor는 하지 않는다.

## API Contract

No API changes.

F-039 reuses the existing Day itinerary response only:

```text
GET /trips/{tripId}/days/{date}/itinerary
```

Existing fields used per row:

```json
{
  "place": {
    "name": "우메다 공중정원",
    "placeType": "sights",
    "address": "1 Chome-1-88 Oyodonaka, Kita Ward, Osaka"
  }
}
```

## DB Changes

No DB changes.

## Business Rules

- F-039는 mobile-only slice이며 route scope는 `/trips/{tripId}/days/{date}` success state의 place row다.
- action scope는 row 단위다. 사용자가 누른 row의 `place.name`과 `place.address`만 사용한다.
- Google Maps URL은 standard search URL을 사용한다. Implementation target form:

```text
https://www.google.com/maps/search/?api=1&query=<encoded query>
```

- `query`는 address가 있으면 `place.name + " " + place.address`를 encode한 값이다.
- address가 비어 있거나 blank-trim 후 empty이면 `query`는 `place.name` only다.
- `지도 열기`는 `Linking.openURL`로 실행하고, OS가 app/web resolution을 결정하게 둔다.
- `지도 열기` 성공은 외부 app/browser handoff 자체로 간주하며, 앱 안의 추가 success toast, snackbar, inline notice는 보여주지 않는다.
- F-039에서는 Google Maps custom scheme 우선 시도나 platform-specific fallback을 추가하지 않는다.
- `주소 복사`는 non-empty address가 있을 때만 가능하다.
- `place.address`는 copy availability 판단 전에 trim한다. trim 결과가 empty이면 missing address로 간주한다.
- `주소 복사`가 불가능한 row는 disabled 또는 hidden 중 하나로 구현할 수 있지만, 어떤 경우에도 hidden gesture를 대체 진입점으로 사용하지 않는다.
- disabled를 선택하면 tap으로 clipboard side effect가 발생하면 안 된다.
- success/failure feedback은 사용자에게 즉시 보여야 하며, silent failure는 허용하지 않는다.
- `Linking.openURL` 실패 시 사용자는 `지도를 열 수 없어요. 잠시 후 다시 시도해주세요.` 오류 문구를 즉시 본다.
- `주소 복사` 성공 feedback은 짧은 inline notice 또는 toast로 `주소를 복사했어요.` 문구를 그대로 노출한다.
- clipboard 구현 방식은 app-layer implementation detail이다. 현재 app에 clipboard dependency가 없으면 Expo SDK에 맞는 최소 dependency를 추가할 수 있지만, backend/API/DB 변경의 이유가 되지 않는다.

## Acceptance Criteria

- [x] 모바일 `/trips/{tripId}/days/{date}` Day itinerary success state의 각 place row에는 사용자가 바로 볼 수 있는 row-scoped action affordance가 있고, long-press 또는 gesture-only entry 없이 지도 action과 `주소 복사`에 접근할 수 있다.
- [x] inline direct button pattern을 선택한 구현에서는 각 place row에 `지도`, `주소 복사` label이 visible state로 그대로 보여야 한다.
- [x] row action menu를 사용하는 구현에서는 각 place row마다 항상 보이는 `더보기` 또는 `장소 액션` affordance가 있고, 한 번 탭하면 해당 row의 `지도 열기`와 `주소 복사` item이 노출된다. Not applicable: implementation uses inline direct buttons.
- [x] `지도 열기`는 해당 row의 `place.name`과 non-empty `place.address`를 조합한 encoded Google Maps search URL을 `Linking.openURL`로 연다.
- [x] `지도 열기` success는 외부 app/browser transition 자체로 판단되며, 앱 안의 추가 success toast, inline notice, snackbar를 노출하지 않는다.
- [x] `place.address`가 비어 있거나 blank-trim 후 empty이면 `지도 열기`는 `place.name` only query로 fallback하고, `주소 복사`는 disabled 또는 hidden 상태가 되며 clipboard side effect가 발생하지 않는다.
- [x] `주소 복사`는 address가 있는 row에서만 수행되고 성공 시 짧은 inline notice 또는 toast `주소를 복사했어요.`를 사용자에게 보여준다.
- [x] `Linking.openURL` 또는 clipboard 동작이 실패하면 사용자-visible failure feedback을 보여주고 app crash나 silent no-op가 없어야 한다.
- [x] F-039 spec과 implementation은 API Contract, API Server, DB 변경 없이 mobile app layer 안에서 완료 가능해야 한다.
- [x] mobile unit test는 Google Maps URL builder가 `place.name + non-empty address`를 encode한 search URL을 만들고, blank-trim 후 empty address는 `place.name` only query로 fallback하며 copy unavailable state를 반환하는 defensive behavior를 검증한다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| Row action affordance is visible and not gesture-only for each success-state item | Mobile logic / Mobile state | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Inline direct button rows, if used, render visible `지도` and `주소 복사` labels per item | Mobile state | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Google Maps URL builder encodes `place.name + non-empty address` into `https://www.google.com/maps/search/?api=1&query=<encoded query>` | Mobile unit logic | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Successful map-open state does not map to any in-app success toast/notice and relies on external app/browser transition only | Mobile unit logic | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Missing-address rows, including `undefined`, empty string, and blank-trimmed address inputs, fall back to name-only map query and disable or hide copy without clipboard side effects | Mobile unit logic | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Copy success state maps to the exact user-facing message `주소를 복사했어요.` via a short inline notice or toast | Mobile logic | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| `Linking.openURL` failure maps to the exact user-facing message `지도를 열 수 없어요. 잠시 후 다시 시도해주세요.` and clipboard failure maps to its defined error copy | Mobile logic | `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile app remains type-safe after adding row action helpers/state | Mobile typecheck | `@i-um/mobile typecheck` | `pnpm --filter @i-um/mobile typecheck` |
| Full repo regression gate stays green with no API/DB changes required | Repo gate | `pnpm verify` | `pnpm verify` |

## Regression Gaps

- Native `Linking.openURL` handoff and clipboard integration cannot be fully asserted in the current pure Node mobile test runner.
  - Risk: device-level permission or OS handoff behavior may differ from helper expectations.
  - Follow-up: verify on internal build/device during implementation of #39.

## TDD Implementation Plan

1. Red: add `apps/mobile/lib/trips/day-itinerary-map-actions.test.mts` for a pure helper/state module.
   - Cover: standard Google Maps URL generation from `place.name + address`, name-only fallback when address is missing, blank, or blank-trimmed, and copy unavailable state for those same inputs.
   - Verify: `pnpm --filter @i-um/mobile test` fails because the new row action helper/state does not exist yet.
2. Green: add the minimal mobile helper and wire row action UI on `apps/mobile/app/trips/[tripId]/days/[date].tsx` using existing Day itinerary row data. If needed, add the minimal Expo-compatible clipboard dependency and lockfile update.
   - Verify: `pnpm --filter @i-um/mobile test`
3. Refactor: keep URL/copy/feedback mapping in a pure helper and keep screen wiring minimal.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`
4. Regression gate
   - Verify: `pnpm verify`

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

Result on 2026-06-24: all automated regression commands passed.

### Manual Smoke

```text
1. 모바일 Day itinerary `/trips/{tripId}/days/{date}`에서 address가 있는 row를 연다.
2. 각 row에 visible row action affordance가 long-press 없이 바로 보이는지 확인한다. inline direct button 패턴이면 `지도`, `주소 복사`가 그대로 보여야 한다.
3. `지도 열기`를 눌러 Google Maps app 또는 web으로 이동하는지 확인하고, 성공 시 앱 안에 별도 success toast/notice가 추가로 뜨지 않는지 확인한다.
4. `주소 복사`를 눌러 success feedback이 보이고 다른 앱에 붙여넣을 수 있는지 확인한다.
5. address가 없거나 공백만 있는 row에서 `지도 열기`는 place name only로 동작하고 `주소 복사`는 disabled 또는 미노출이며 복사 side effect가 없는지 확인한다.
6. `Linking.openURL`를 실패시키거나 열 수 없는 환경을 만들어 `지도를 열 수 없어요. 잠시 후 다시 시도해주세요.` 오류 문구가 보이는지 확인한다.
7. clipboard failure를 강제로 만들 수 있으면 `주소를 복사할 수 없어요. 잠시 후 다시 시도해주세요.` 오류 문구가 보이는지 확인한다.
```

## Release Notes

- Day itinerary 모바일 화면의 각 장소 row에서 `지도`와 `주소 복사` inline action을 바로 실행할 수 있다.
- address가 없는 장소는 지도 검색을 place name only로 fallback하고, 주소 복사는 비활성 또는 미노출 처리한다.
- backend/API/DB 변경 없이 mobile row action만 추가하는 작은 slice다.

## Open Questions

None. F-039의 hidden-gesture 금지, standard Google Maps search URL 사용, missing-address fallback, no-backend-change 범위는 이 spec에서 확정한다.

## Follow-up Issues

- #32: Today execution screen과 remaining places list에 같은 row action을 확장할지 별도 slice로 다룬다.
- TBD: 구현/QA 중 OS-level handoff 한계가 확인되면 Google Maps scheme prioritization 또는 provider fallback을 후속 issue로 분리한다.
