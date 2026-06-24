# Feature Slice: F-044 초대 후 마이페이지 반영

## Metadata

- GitHub Issue: #44
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-24
- Updated: 2026-06-24

## Source

- Issue: #44
- Ouroboros/PM/Seed: Interview `interview_20260624_142235`; ambiguity score `0.09`; Seed `seed_22bb1ff497f4`.
- Notes: Ouroboros clarified F-044 as a minimal verification slice: after accepting an invite, the invited trip must be visible on the next MyPage entry/focus using existing list behavior. Immediate UI updates, badges, toasts, copy changes, and new sorting/section rules are excluded. If current behavior already satisfies the requirement, completion may be spec + regression tests + smoke verification without production code changes.

## Goal

초대 링크를 수락한 사용자가 다음 마이페이지 진입 또는 포커스 갱신 시 `내 여행` 목록에서 초대받은 여행을 확인할 수 있다.

F-044는 F-042의 초대 수락 결과가 기존 `GET /trips`와 마이페이지 여행 목록에 연결되어 있음을 보장하는 slice다. 목록 카드에는 초대받은 여행명과 기존 역할 표시 규칙에 따른 `동행자` 라벨이 함께 보여야 한다.

## User Flow

1. Owner가 초대 링크를 만들고 다른 로그인 사용자가 F-042 흐름으로 초대를 수락한다.
2. 초대 수락 API는 해당 사용자를 여행의 `member` 참여자로 저장한다.
3. 사용자가 마이페이지로 진입하거나 이미 열린 마이페이지가 다시 focus된다.
4. 앱은 기존 MyPage focus/re-entry 흐름으로 `listMyTrips()`를 호출한다.
5. 서버는 authenticated user의 `trip_participants` row를 기준으로 `GET /trips` 응답을 만든다.
6. 앱은 기존 `내 여행` 카드/section UI 안에 초대받은 여행을 표시한다.
7. 사용자는 해당 카드에서 여행명과 역할 라벨 `동행자`를 확인할 수 있고, 카드를 누르면 기존 `/trips/{tripId}` 상세로 이동한다.

## Scope

- App UI: yes — 새 UI는 추가하지 않고 `apps/mobile/app/mypage.tsx`의 기존 MyPage focus/re-entry 목록 갱신과 카드 표시가 초대 수락 member trip에도 동작함을 보장
- App Logic: yes — `apps/mobile/lib/trips/mypage.ts`의 기존 role label/card view model 규칙을 초대받은 `member` trip 회귀 대상으로 고정
- API Contract: no new endpoint/schema — 기존 `POST /invites/{token}/accept`와 `GET /trips`/`TripListItem.myRole`/`participantCount` 계약을 사용
- API Server: no new behavior expected — 기존 invite accept가 만든 participant membership을 기존 trip listing이 반환하는지 보장
- DB: no schema migration expected — 기존 `trip_invites`, `trip_participants`, `trips`를 사용; 필요 시 기존 list query/accept transaction gap만 수정
- Generated Code: not expected unless a verified contract/sqlc drift or gap requires query change
- Tests: yes — invite accept → member `GET /trips` visibility, storage list after accept, mobile role-label/card regression
- Deploy/Smoke: needed — staging 또는 internal build에서 invite accept 후 MyPage 재진입/focus 확인

## Out of Scope

- 초대 수락 직후 마이페이지 목록을 background invalidate/refetch하거나 자동으로 MyPage로 이동시키는 동작
- 초대 수락 성공 화면에 `마이페이지에서 보기` CTA를 추가하는 동작
- 토스트, badge, “새로 초대됨” 표시, 별도 empty-state 전환 copy 등 추가 인지 UI
- 초대받은 여행의 정확한 section 위치, 정렬 위치, current trip shortcut 포함 여부를 F-044에서 새로 정의하는 것. 기존 MyPage grouping/sorting 규칙에 위임한다.
- 비로그인 사용자의 로그인 후 invite 복귀 handoff (#43)
- 참여자 제거 (#45), invite revoke/regenerate, single-use invite, pending invitee UI
- API pagination/filtering, participant role policy 변경, DB schema 변경

## Requirements

### UI / UX

- Screens: `apps/mobile/app/mypage.tsx`
  - 기존 header, profile/settings, bottom menu, `내 여행` card 구조를 유지한다.
  - 마이페이지 진입 또는 focus 시 기존 `useFocusEffect` 기반 reload가 실행되어야 한다.
  - 초대 수락 member trip이 `GET /trips` 응답에 포함되면 기존 section/card 렌더링을 통해 표시되어야 한다.
  - 해당 카드에는 여행명과 기존 role label mapping에 따른 `동행자`가 보여야 한다.
  - 카드를 누르면 기존 `tripDetailPath(tripId)` / `/trips/{tripId}`로 이동한다.
- States:
  - Loading/empty/error/success 상태 copy와 layout은 기존 MyPage 동작을 유지한다.
  - F-044는 초대받은 여행의 exact section, 정렬 위치, current shortcut 노출 여부를 새로 고정하지 않는다.
  - 목록이 비어 있던 사용자가 초대를 수락한 뒤 MyPage를 다시 열면 기존 empty state 대신 해당 여행 카드가 보여야 한다.
- Copy:
  - 새 product copy는 추가하지 않는다.
  - 역할 라벨은 기존 mapping을 사용한다: `member` → `동행자`, `owner` → `주최자`.
- Styling:
  - 생산 코드 변경이 필요할 경우 `theme` token과 기존 shared primitive/card 패턴만 사용한다.
  - raw hex color, 임의 spacing/radius, emoji를 추가하지 않는다.

### API Contract

No API contract changes.

F-044 relies on existing OpenAPI source of truth:

```text
POST /invites/{token}/accept
GET /trips
```

Required contract assumptions:

- `POST /invites/{token}/accept` is authenticated and creates or confirms a `trip_participants` membership.
- New invite accept success returns `role: "member"`, `alreadyAccepted: false`.
- `GET /trips` is authenticated and returns trips where the current user has a participant row.
- `TripListItem.myRole` reflects the current user's role for that trip.
- `TripListItem.participantCount` includes the owner and accepted member after acceptance.

### DB Changes

No DB schema changes.

Existing DB behavior required for this slice:

- Invite acceptance inserts exactly one `trip_participants` row for a new invited user with role `member`.
- `ListTripsByParticipantUser` joins `trips` to `trip_participants` by authenticated user id.
- An accepted member row is sufficient for the trip to appear in `GET /trips`.
- Existing ordering by participant join/create/id remains owned by the list query and is not changed by F-044.

If verification finds a gap, fix the smallest responsible layer:

- accept transaction did not persist membership → fix invite accept repository/service
- list query filters out accepted members → fix list query/repository mapping
- API omits `myRole` or count → fix mapper/server regression
- mobile card drops member role label → fix MyPage view model/rendering

### Business Rules

- A user who successfully accepts an active invite becomes a `member` participant of that trip.
- Membership is the source of truth for MyPage visibility.
- The invited trip should appear for the invited user on the next MyPage entry/focus refresh; no real-time push or immediate screen-to-screen state sync is required.
- Existing MyPage grouping, sorting, current-trip shortcut, and empty/error/loading behavior continue to apply unchanged.
- A `member` trip card displays the existing Korean role label `동행자`.
- Idempotent re-accepting does not create duplicate list cards because the participant uniqueness rule remains in effect.

## Acceptance Criteria

- [x] AC-01: `docs/features/0044-invited-trip-in-mypage.md` contains the reviewed feature spec and TDD implementation plan.
- [x] AC-02: After a logged-in non-participant accepts a valid invite, the server persists a `member` participant row for that user/trip.
- [x] AC-03: On the accepted user's next `GET /trips`, the accepted trip appears in the response.
- [x] AC-04: The accepted trip's `TripListItem` includes the accepted trip name and `myRole: "member"`.
- [x] AC-05: MyPage next entry/focus calls the existing list flow and can render the accepted trip card from the refreshed response.
- [x] AC-06: The rendered MyPage card for the accepted trip shows the trip name and role label `동행자`.
- [x] AC-07: Tapping the accepted trip card keeps the existing navigation to `/trips/{tripId}`.
- [x] AC-08: F-044 does not add immediate post-accept MyPage invalidation, auto-navigation, toast, badge, new copy, or new sorting/section rules.
- [x] AC-09: If current production behavior already satisfies AC-02 through AC-07, implementation may be limited to regression tests, verification record, and smoke evidence.
- [ ] AC-10: Staging or internal build smoke verifies Owner creates invite → second logged-in user accepts → second user opens/focuses MyPage → invited trip card shows trip name and `동행자`.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Accept invite creates member membership used by list query | DB/storage integration | `apps/api/internal/storage/trip_repository_test.go` | `pnpm --filter @i-um/api test` |
| Accept invite then `GET /trips` returns accepted trip as member | API handler/integration | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Service list preserves member role and participant count | API service | `apps/api/internal/trip/service_test.go` | `pnpm --filter @i-um/api test` |
| MyPage card view model maps accepted member trip to `동행자` and keeps detail route | Mobile helper | `apps/mobile/lib/trips/mypage.test.mts` | `pnpm --filter @i-um/mobile test` |
| MyPage route/list client remains type-safe | Mobile typecheck | `apps/mobile/app/mypage.tsx`, `apps/mobile/lib/trips/client.ts` | `pnpm --filter @i-um/mobile typecheck` |
| No generated contract drift | Generated gate | OpenAPI/sqlc/generated artifacts | `pnpm verify:generated` |
| Final integrated gate | Repo | relevant API/mobile/generated gates | `pnpm verify` |

## Regression Gaps

- Full Expo Router focus/re-entry behavior for `apps/mobile/app/mypage.tsx` is not currently covered by an automated mobile screen/e2e harness.
  - Risk: helper tests can pass while a screen-level focus wiring regression prevents reload on a device.
  - Follow-up: cover F-044 with internal build smoke now; add route/component e2e coverage when the project introduces a mobile UI integration harness.

## TDD Implementation Plan

1. Red: Storage regression for accept → list visibility
   - Extend `TestAcceptTripInviteCreatesAndReusesParticipant` or add a storage integration test that accepts an invite as a new user, then calls `ListTripsByParticipantUser(memberUserID)`.
   - Expected assertion: returned trips include the accepted `tripID`, trip name, `MyRole == member`, and `ParticipantCount == 2`.
   - Verify: `pnpm --filter @i-um/api test` should fail if accept persistence or list query does not connect.

2. Green: Minimal storage/API fix only if needed
   - If the red test fails, fix the smallest responsible repository/query/transaction mapping.
   - No DB migration or API contract change is expected.
   - Verify: `pnpm --filter @i-um/api test`.

3. Red: API handler regression for accept → `GET /trips`
   - Add a server test that creates a trip/invite, accepts as a second logged-in user, then requests `GET /trips` with the second user's token.
   - Expected assertion: response has one card candidate with accepted trip `id`, `name`, `myRole: "member"`, and participant count including owner + member.
   - Verify: `pnpm --filter @i-um/api test` should fail if handler/service/mappers do not expose the accepted membership.

4. Green: Minimal server/service fix only if needed
   - If the handler regression fails, fix service/list mapper wiring without changing contract semantics.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/api build`.

5. Red: Mobile MyPage card regression
   - Add or refine `apps/mobile/lib/trips/mypage.test.mts` coverage with a trip named like `초대받은 여행`, `myRole: "member"`, and a deterministic date.
   - Expected assertion: `buildMyTripsSuccessViewModel` includes the trip in some existing section and maps `roleLabel` to `동행자`; `tripDetailPath(tripId)` remains `/trips/{tripId}`.
   - Verify: `pnpm --filter @i-um/mobile test` should fail if member role/card view-model behavior regresses.

6. Green: Minimal mobile fix only if needed
   - If mobile tests fail, fix helper/rendering while preserving existing MyPage loading/empty/error/success layout and copy.
   - Do not add toast/badge/auto-navigation/new copy for F-044.
   - Verify: `pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.

7. Refactor
   - Keep invite acceptance concerns in invite tests and MyPage rendering concerns in MyPage helper/screen tests.
   - Avoid duplicating OpenAPI DTOs; keep generated types/client as the source.
   - Verify: `pnpm --filter @i-um/api test && pnpm --filter @i-um/mobile test`.

8. Gate
   - Run generated, API, mobile, and repo verification relevant to the final diff.
   - Verify: `pnpm verify:generated && pnpm --filter @i-um/api test && pnpm --filter @i-um/api build && pnpm --filter @i-um/mobile test && pnpm --filter @i-um/mobile typecheck`.
   - Before completion, run `pnpm verify` unless a documented environment constraint blocks it.

## Verification Record

### Automated Regression

- `pnpm install --frozen-lockfile`: pass — prepared this worktree's local `node_modules` after the first mobile test run failed because dependencies were not linked in the new worktree
- `pnpm verify:generated`: pass
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile test`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass

### Manual Smoke

- Owner creates invite link in staging/internal build: not run — implementation/smoke phase pending
- Second logged-in user accepts invite: not run — implementation/smoke phase pending
- Second user opens or refocuses MyPage and sees invited trip name: not run — implementation/smoke phase pending
- Same MyPage card shows `동행자`: not run — implementation/smoke phase pending
- Card opens `/trips/{tripId}` detail: not run — implementation/smoke phase pending

## Release Notes

- 초대 링크로 참여한 여행이 다음 마이페이지 진입 또는 갱신 시 `내 여행` 목록에 표시되도록 보장한다.
- 초대받은 여행 카드는 기존 카드 규칙대로 여행명과 `동행자` 역할을 보여준다.

## Open Questions

- None for F-044 MVP. Spec approval is still required before implementation.

## Follow-up Issues

- #43: 초대 링크 로그인 handoff
- #45: 참여자 제거
- Follow-up TBD: MyPage route/component e2e harness for focus/re-entry behavior
