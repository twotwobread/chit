# Feature Slice: F-046 공동 일정 편집 반영

## Metadata

- GitHub Issue: #46
- Status: In Progress
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #46
- Related: #29
- Ouroboros Interview: `interview_20260625_131018`
- Ouroboros Seed: `seed_38c265741656` (MCP generated; no local file path emitted)
- Ambiguity Score: `0.071`
- Notes: Ouroboros clarified F-046 as a mobile Day-screen near-real-time freshness slice. The MVP uses focused/foreground polling of the existing Day itinerary GET endpoint, auto-applies safe remote changes, and protects local in-progress edits from being overwritten without confirmation.

## Goal

여행 참여자가 같은 Day 일정을 함께 보고 있을 때, 다른 참여자가 저장한 변경이 내 화면에도 거의 실시간으로 반영된다.

F-046은 WebSocket/SSE 같은 push 인프라를 도입하지 않고, 모바일 Day 일정 화면에서 기존 itinerary 조회 API를 주기적으로 다시 불러와 공동 편집 중 낡은 화면 상태와 불필요한 409 경험을 줄이는 최소 vertical slice다.

## Problem

- F-029는 순서 변경 저장 성공 후 최신 itinerary 반영과 `409 CONFLICT` 시 refetch를 처리했지만, 화면을 계속 보고 있는 동안 다른 참여자의 변경을 자동 감지하지 않는다.
- 4명 이상이 함께 여행 계획을 세우는 상황에서는 한 사람이 장소를 추가/수정/삭제/순서변경한 뒤 다른 참여자가 매번 직접 갱신 버튼을 눌러야 하는 UX가 불편하다.
- 반대로 사용자가 순서 변경이나 장소 수정 중인 로컬 상태를 원격 변경으로 갑자기 덮어쓰면 입력 내용과 의도가 사라질 수 있다.
- 따라서 MVP는 “볼 때는 자동 최신화, 편집 중에는 보호 + 명시적 reload” 규칙을 고정한다.

## User Flow

### View mode auto-apply

1. 사용자가 로그인된 상태에서 `/trips/{tripId}/days/{date}` Day 일정 화면을 연다.
2. 앱은 기존처럼 focus 시 `GET /trips/{tripId}/days/{date}/itinerary`를 호출해 itinerary를 표시한다.
3. Day 화면이 focused이고 앱이 foreground 상태이면 앱은 10초 간격으로 같은 GET endpoint를 background polling한다.
4. 다른 참여자가 같은 trip/day의 장소 추가, 장소 수정, 장소 삭제, 숙소 지정/해제, 순서 변경을 저장한다.
5. 다음 polling 응답의 user-visible itinerary signature가 현재 clean baseline과 다르면 앱은 로컬 보호 상태가 있는지 확인한다.
6. 로컬 보호 상태가 없으면 앱은 polling 응답을 즉시 화면에 반영하고 새 clean baseline으로 저장한다.
7. view mode에서는 별도 “최신 내용 보기” 버튼을 누르지 않아도 최신 일정이 표시된다.

### Local edit protection

1. 사용자가 Day 화면에서 순서 변경, 장소 수정, 삭제 확인, 숙소 지정/해제 같은 로컬 작업을 시작한다.
2. 다른 참여자가 같은 trip/day 일정을 변경한다.
3. polling은 계속 실행되지만 로컬 보호 상태가 있으므로 앱은 polling 응답을 자동 반영하지 않는다.
4. 앱은 `다른 참여자가 일정을 변경했어요.` 배너와 `최신 내용 보기` action을 표시한다.
5. 사용자가 배너 action을 누르면 앱은 로컬 변경이 사라질 수 있음을 확인한다.
6. 사용자가 확인하면 앱은 Day 화면의 로컬 draft/confirmation state를 버리고 최신 itinerary를 다시 불러와 반영한다.
7. 사용자가 취소하면 현재 로컬 작업을 계속할 수 있고 배너는 유지된다.
8. 사용자가 로컬 작업을 저장하거나 취소해 보호 상태가 해제되면 앱은 pending remote update를 다시 확인하고 안전해진 시점에 최신 상태로 reconcile한다.

### Foreground resume

1. 사용자가 Day 화면을 열어둔 채 앱을 background로 보낸다.
2. background 상태에서는 polling을 중단한다.
3. 앱이 foreground로 돌아오고 같은 Day 화면이 focused이면 앱은 즉시 itinerary를 한 번 refetch한다.
4. 이후 10초 polling cadence를 다시 시작한다.

## Scope

- App UI: Yes. `apps/mobile/app/trips/[tripId]/days/[date].tsx`에 focused/foreground polling orchestration, pending remote update banner, discard/reload confirmation을 추가한다.
- Mobile helpers: Yes. Day itinerary remote-change signature, local protection, polling decision, banner copy/view-model을 `apps/mobile/lib/trips/**` helper로 분리한다.
- API Contract: No changes. Existing `GET /trips/{tripId}/days/{date}/itinerary`를 재사용한다.
- API Server: No behavior changes required for MVP.
- DB: No migration. F-029의 existing item-level `version`을 signature 일부로 사용하지만 Day-level revision은 추가하지 않는다.
- Generated Code: No generated client/server code changes.
- Tests: Mobile helper tests and TypeScript integration gate. Screen timer/AppState behavior is manually smoked unless a screen test harness is added.
- Deploy/Smoke: Internal build 또는 staging-connected mobile build에서 two-client smoke가 필요하다.

## Out of Scope

- WebSocket, SSE, LISTEN/NOTIFY, push transport 기반 실시간 동기화
- CRDT(Yjs/Automerge), per-field merge, live co-editing cursor/presence/typing indicator
- “누가 변경했는지” attribution, 변경 이력, unread change count
- Day 화면 밖의 global/cross-screen sync: trip overview, Day list, participants, today execution, expenses screen 등
- 한 명이 편집 중일 때 다른 참여자의 편집을 막는 global edit lock
- 로컬 draft를 route 이탈 후 보존하거나 remote data와 자동 merge
- 새 API field, Day-level `updatedAt`/revision, DB trigger/revision table
- polling 부하 최적화를 위한 HEAD/lightweight diff endpoint
- F-029 rank rebalance 정책 (#89)

## Requirements

### UI / UX

#### Screens

- `apps/mobile/app/trips/[tripId]/days/[date].tsx`
  - 기존 focus load behavior를 유지한다.
  - Day 화면이 focused이고 app state가 active/foreground일 때만 polling한다.
  - 앱이 background/inactive가 되거나 화면 focus를 잃으면 polling interval을 정리한다.
  - 앱이 active로 돌아오고 화면이 focused이면 즉시 한 번 refetch한다.
  - background polling refetch는 기존 main loading card로 화면을 되돌리지 않는다.
  - polling 응답을 적용할 때 기존 Day itinerary card/list UI를 그대로 사용한다.
  - 로컬 보호 상태가 없으면 remote change를 자동 반영한다.
  - 로컬 보호 상태가 있으면 remote change를 자동 반영하지 않고 pending banner를 표시한다.
  - pending banner는 같은 remote update가 여러 번 감지되어도 하나만 표시한다.
  - mutation error surface와 pending banner는 서로를 대체하지 않는다. 예를 들어 저장 실패 error가 표시되어도 pending banner는 유지된다.

#### Local protection states

아래 상태 중 하나라도 active이면 polling 응답을 자동 반영하지 않는다.

- Reorder: `reorderState.status === 'editing' | 'saving'`
- Place edit: `editState.status === 'editing' | 'saving'`
- Delete: `deleteState.status === 'confirming' | 'deleting'`
- Lodging mutation: `lodgingState.status === 'setting' | 'clearing'`
- Future on-screen add/create draft가 생기면 같은 보호 규칙에 포함한다.

아래는 보호 상태가 아니다.

- 단순 view mode
- 지도 열기 / 주소 복사 feedback
- retryable polling failure
- 별도 route로 이동한 장소 추가/search 화면. 해당 route 이탈 시 기존 route lifecycle 규칙을 따른다.

#### Pending remote update banner

Banner copy:

- Message: `다른 참여자가 일정을 변경했어요.`
- Action: `최신 내용 보기`

Confirmation copy:

- Title: `최신 일정으로 불러올까요?`
- Helper: `현재 편집 중인 내용은 저장되지 않고 사라져요.`
- Confirm action: `불러오기`
- Cancel action: `계속 편집`

Behavior:

- Banner appears only when a remote itinerary change is detected while local protection is active.
- Banner persists until the user reloads, local protection clears and the latest itinerary is reconciled, or the screen is left.
- If the protected state is an in-flight network request, the UI may keep the banner action disabled until the request settles to avoid racing a non-cancelable request. The banner itself remains visible.
- Confirming reload discards Day-screen local state (`editState`, `deleteState`, `reorderState`, `lodgingState`) and runs an explicit latest itinerary refetch.
- Canceling confirmation keeps local state and keeps the banner visible.

#### Polling / AppState rules

- Polling interval constant: `DAY_ITINERARY_SHARED_UPDATE_POLL_INTERVAL_MS = 10_000`.
- Poll only when all are true:
  - valid `tripId` and `date`
  - Day screen focused
  - React Native app state is active/foreground
  - no identical polling request is already in flight
- On every polling response, evaluate local protection at response time, not only request start time.
- Do not allow an older polling response to overwrite a newer explicit load or successful local mutation response. Use a request sequence, latest-applied marker, or equivalent stale-response guard.
- When local protection clears while a pending remote update exists, run an immediate reconcile refetch instead of waiting up to the next 10-second interval.
- Background polling failures for network, timeout, `5xx`, and unknown errors are silent and retry on the next interval.
- `401`, auth refresh failure, `403`, and `404` from a poll/refetch follow existing load/auth/not-found handling because access may have changed or the trip/day may no longer exist.

#### Change detection signature

Because F-046 does not add a server Day revision, the client compares a deterministic signature built from user-visible Day itinerary content.

For each row sorted by `itemOrder`, include raw API values used by the Day itinerary view model:

- `id`
- `itemOrder`
- `version`
- `isLodging`
- `place.id`
- `place.name`
- `place.placeType`
- `place.address`

Rules:

- Use raw values as received/rendered; do not add special whitespace/null normalization in the MVP.
- Ignore generated object identity and response object reference changes.
- Treat any signature difference as a remote itinerary content change.
- After applying a response, successful local mutation response, or explicit reload response, update the clean baseline signature.

#### Copy / Labels

- Pending banner: `다른 참여자가 일정을 변경했어요.`
- Pending banner action: `최신 내용 보기`
- Reload confirmation title: `최신 일정으로 불러올까요?`
- Reload confirmation helper: `현재 편집 중인 내용은 저장되지 않고 사라져요.`
- Reload confirmation confirm: `불러오기`
- Reload confirmation cancel: `계속 편집`

#### Design Guardrails

- `.pi/rules/mobile-ui.md`와 `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드는 theme token의 color, spacing, radius, shadow, typography를 사용한다.
- raw hex color, 임의 spacing/radius 값을 추가하지 않는다.
- 제품 UI에 emoji나 decorative unicode를 사용하지 않는다.
- 기존 Day 일정 화면의 warm off-white background, white card, subtle border/shadow 패턴을 유지한다.
- pending banner/confirmation이 반복 가능한 패턴이면 이번 변경 범위 안에서만 small helper/component로 정리한다. 전체 UI refactor는 하지 않는다.

### API Contract

No API contract changes.

F-046 reuses the existing authenticated endpoint:

```text
GET /trips/{tripId}/days/{date}/itinerary
```

Request/response schema changes are not required.

Relevant existing response fields for the mobile signature:

- `day.date`
- `day.dayOrder`
- `items[].id`
- `items[].itemOrder`
- `items[].version`
- `items[].isLodging`
- `items[].place.id`
- `items[].place.name`
- `items[].place.placeType`
- `items[].place.address`

### DB Changes

No DB changes.

F-046 intentionally does not add a Day-level revision, trigger, notification table, or `updated_at` primitive. If polling load or diff precision becomes a problem, a future feature can add a lightweight server revision or push transport.

### Business Rules

- Only the currently open mobile Day itinerary detail screen participates in F-046 polling.
- Other participants are never blocked from editing because one user is editing locally.
- Remote changes are auto-applied only when doing so cannot overwrite local Day-screen draft/confirmation/in-flight mutation state.
- Local protected state blocks auto-apply but does not pause change detection.
- Pending remote updates collapse into one banner with no count, timestamp, author, or detail.
- User confirmation is required before discarding local Day-screen state to reload latest data.
- Existing F-029 optimistic conflict behavior remains the source of truth for simultaneous reorder saves.
- Existing mutation success behavior remains valid: mutation response or immediate `load()` result becomes the new clean baseline, then polling resumes.
- Existing explicit load behavior remains valid for auth, not-found, and retryable top-level states.
- Silent background polling failures must not replace usable current itinerary UI with a generic error screen.
- Leaving the route clears intervals, pending banner state, and local Day-screen draft state according to existing route lifecycle behavior.

## Acceptance Criteria

- [x] AC-01: Day screen initial focus still loads itinerary with existing `GET /trips/{tripId}/days/{date}/itinerary` behavior.
- [x] AC-02: While the Day screen is focused and app state is foreground/active, the app polls the existing itinerary GET endpoint every 10 seconds.
- [x] AC-03: Polling stops when the Day screen loses focus or the app is background/inactive.
- [x] AC-04: Returning to foreground on the focused Day screen triggers an immediate refetch before the next interval tick.
- [x] AC-05: Polling uses a stable user-visible itinerary signature and ignores response object identity differences.
- [x] AC-06: In view mode with no local protected state, a changed polling response automatically updates the displayed itinerary and clean baseline without requiring user action.
- [x] AC-07: In view mode, no pending remote-change banner is shown for auto-applied changes.
- [x] AC-08: Reorder editing/saving blocks polling auto-apply and keeps the local reorder draft intact.
- [x] AC-09: Place edit editing/saving blocks polling auto-apply and keeps the local edit form intact.
- [x] AC-10: Delete confirmation/deleting blocks polling auto-apply and keeps the delete UI state intact.
- [x] AC-11: Lodging setting/clearing blocks polling auto-apply and keeps existing mutation UI/error handling intact.
- [x] AC-12: When remote change is detected while auto-apply is blocked, exactly one persistent banner shows `다른 참여자가 일정을 변경했어요.` with `최신 내용 보기`.
- [x] AC-13: Multiple remote changes while blocked do not create multiple banners or counts.
- [x] AC-14: Tapping `최신 내용 보기` requires confirmation before local Day-screen state is discarded.
- [x] AC-15: Confirming reload clears local Day-screen edit/delete/reorder/lodging state and applies the latest server itinerary.
- [x] AC-16: Canceling reload confirmation preserves local state and keeps the pending banner visible.
- [x] AC-17: If a mutation fails while the pending banner is visible, the mutation error remains visible and the pending banner also remains visible.
- [x] AC-18: After a successful local mutation, the mutation response or immediate refetch result becomes the new clean baseline and normal polling resumes after protection clears.
- [x] AC-19: Background polling network/timeout/5xx/unknown failures fail silently and retry later without replacing the visible itinerary with an error state.
- [x] AC-20: Poll `401`, auth refresh failure, `403`, and `404` follow existing auth/not-found handling.
- [x] AC-21: No OpenAPI, generated client/server, API server, or DB migration changes are required for F-046.
- [x] AC-22: The spec and implementation do not introduce push transport, CRDT, edit locks, attribution, change history, cross-screen sync, or route-exit draft preservation.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-05: stable signature uses displayed row fields and ignores object identity | Mobile helper | `apps/mobile/lib/trips/shared-itinerary-updates.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-06, AC-07: view-mode changed signature auto-applies without pending banner | Mobile helper/state | `apps/mobile/lib/trips/shared-itinerary-updates.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-08~AC-13: protected local states suppress auto-apply and collapse pending remote changes into one banner | Mobile helper/state | `apps/mobile/lib/trips/shared-itinerary-updates.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-14~AC-16: reload confirmation copy and discard/reload decision behavior | Mobile helper/state | `apps/mobile/lib/trips/shared-itinerary-updates.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-17, AC-18: mutation failure coexists with pending banner; mutation success resets clean baseline | Mobile helper/screen state | `apps/mobile/lib/trips/shared-itinerary-updates.test.mts`, existing reorder/edit tests as needed | `pnpm --filter @i-um/mobile test` |
| AC-01~AC-04, AC-19, AC-20: screen integrates focus/AppState polling, silent poll failures, auth/not-found behavior | Mobile screen/type integration | `apps/mobile/app/trips/[tripId]/days/[date].tsx` | `pnpm --filter @i-um/mobile typecheck` + manual smoke |
| AC-21: contract/generated artifacts remain unchanged | Contract/generated drift | OpenAPI/generated diff review | `pnpm verify:generated` |
| AC-22: excluded real-time primitives are not introduced | Static review | OpenAPI routes, migrations, mobile routes | PR review + `pnpm verify:generated` |
| All mobile behavior remains type-safe | Mobile gate | Mobile package | `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck` |
| Workspace remains green before merge | Full gate | Workspace | `pnpm verify` |

## Regression Gaps

- Actual React Native timer, `AppState`, and `useFocusEffect` lifecycle behavior is not fully covered by the current pure Node mobile test setup.
  - Risk: polling could continue after background/unfocus, or foreground resume refetch could fail on device despite helper tests.
  - Follow-up: manual two-client/internal-build smoke is required for F-046; add a React Native component/e2e lifecycle harness in a later testing slice if this pattern expands.
- True multi-device concurrency timing is not deterministic in unit tests.
  - Risk: a stale in-flight poll response could race with a local mutation response if stale-response guards are incomplete.
  - Follow-up: cover helper-level stale-response decisions and perform manual smoke with two logged-in participants.

## TDD Implementation Plan

1. Red: shared update signature tests
   - Add failing tests for deterministic Day itinerary signatures from `GetDayItineraryResponse`: same content/different object identity is equal; changed `itemOrder`, `version`, lodging flag, place id/name/type/address differs.
   - Verify: `pnpm --filter @i-um/mobile test` fails.
2. Green: signature helper
   - Implement a small helper such as `buildDayItinerarySharedUpdateSignature(responseOrViewModel)` in `apps/mobile/lib/trips/shared-itinerary-updates.ts`.
   - Keep sorting deterministic by `itemOrder`.
   - Verify: `pnpm --filter @i-um/mobile test` passes for new signature tests.
3. Red: local protection and pending-banner decision tests
   - Add failing tests for protection states: reorder editing/saving, edit editing/saving, delete confirming/deleting, lodging setting/clearing.
   - Add tests that view mode auto-applies, protected mode sets one pending banner, repeated remote changes collapse, and cancel keeps pending state.
   - Verify: `pnpm --filter @i-um/mobile test` fails.
4. Green: shared update state helpers
   - Implement helpers for local protection aggregation, auto-apply decision, pending state, banner view model, and reload confirmation copy.
   - Keep copy in Korean and action-oriented.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
5. Red: baseline/reconcile tests
   - Add tests that successful mutation/refetch responses reset clean baseline, mutation failure can coexist with pending banner, and clearing protection with pending update requests immediate reconcile.
   - Verify: `pnpm --filter @i-um/mobile test` fails.
6. Green: baseline/reconcile helpers
   - Implement baseline update and stale-response guard decisions with sequence/latest-applied markers or equivalent pure functions.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
7. Screen integration
   - Update `apps/mobile/app/trips/[tripId]/days/[date].tsx` to wire `AppState`, `useFocusEffect`, interval cleanup, non-loading background refetch, pending banner, and confirmation UI.
   - Ensure poll response handling checks current local protection at response time.
   - Ensure intervals are cleaned on blur/unmount/background and duplicate polls do not overlap.
   - Verify: `pnpm --filter @i-um/mobile typecheck`.
8. Refactor
   - Move any formatting/state decision logic introduced in the screen into `apps/mobile/lib/trips/**` helpers.
   - Reuse theme tokens and existing card/button/list patterns; do not refactor unrelated Day screen UI.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
9. Generated/contract guard
   - Since F-046 should not change OpenAPI/generated/API/DB, verify generated drift remains clean.
   - Verify: `pnpm verify:generated`.
10. Regression gate
    - Verify: `pnpm verify` before PR readiness.
11. Manual smoke
    - Use two participants/devices or simulator sessions against the same trip/day.
    - Verify view-mode auto-apply within ~10 seconds.
    - Verify local reorder/edit/delete/lodging protection shows banner and does not overwrite local state.
    - Verify confirmed reload discards local state and applies latest itinerary.
    - Verify app background/foreground resume triggers immediate refresh.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: Pass (193 tests).
- `pnpm --filter @i-um/mobile typecheck`: Pass.
- `pnpm verify:generated`: Pass.
- `pnpm verify`: Pass.

### Manual Smoke

- View-mode two-client auto-apply: Not run; internal build/device smoke needed.
- Protected local edit pending banner: Not run; internal build/device smoke needed.
- Confirmed reload discards local state and applies latest itinerary: Not run; internal build/device smoke needed.
- Background/foreground resume refetch: Not run; internal build/device smoke needed.

## Verification Plan

### Automated Regression

```text
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify:generated
pnpm verify
```

### Manual Smoke

- [ ] Participant A opens a Day itinerary with existing places.
- [ ] Participant B changes the same Day itinerary from another device/session.
- [ ] Participant A stays in view mode and sees the changed itinerary within roughly one polling interval without tapping refresh.
- [ ] Participant A enters reorder mode, Participant B changes the itinerary, and Participant A sees one pending banner without losing local reorder order.
- [ ] Participant A taps `최신 내용 보기`, cancels confirmation, and local reorder state remains.
- [ ] Participant A taps `최신 내용 보기`, confirms `불러오기`, and latest server itinerary replaces local state.
- [ ] Repeat protected behavior for place edit, delete confirmation, and lodging setting/clearing when feasible.
- [ ] With the Day screen focused, background and foreground the app; verify an immediate refresh occurs on resume.
- [ ] Temporarily break network during polling; verify current itinerary remains visible and polling recovers after network returns.

## Release Notes

```text
- Day 일정 화면을 보고 있을 때 다른 참여자가 변경한 일정이 자동으로 최신화됩니다.
- 내가 순서 변경이나 장소 수정 중일 때는 화면을 자동으로 덮어쓰지 않고, 최신 일정을 불러올지 먼저 확인합니다.
```

## Open Questions

None for F-046 spec review.

## Follow-up Issues

- #89: 일정 순서 rank rebalance 정책.
- Future follow-up: polling 부하나 latency가 문제가 되면 Day-level revision, lightweight diff endpoint, SSE/WebSocket 등 push 기반 sync를 별도 feature로 검토한다.
