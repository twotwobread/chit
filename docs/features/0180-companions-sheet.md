# Feature Slice: AppBar 동행자 Sheet 연결

## Metadata

- GitHub Issue: #180
- Status: In Progress
- Created: 2026-06-29
- Updated: 2026-06-29

## Source

- Issue: #180 — [Mobile UI Refactor follow-up] AppBar 동행자 Sheet 연결
- Depends on: #175 merged into `origin/develop`
- Related: #40 participant list, #41 invite link, #126 Kakao share issue, #169 overlay follow-up
- Ouroboros/PM/Seed: `interview_20260628_172931` / `seed_0273ab100e5e` (ambiguity 0.08)
- Current sources: `apps/mobile/app/trips/[tripId]/_layout.tsx`, `apps/mobile/app/trips/[tripId]/participants.tsx`, `apps/mobile/lib/trip-ui/CompanionsSheet.tsx`, `apps/mobile/lib/trips/participants.ts`, `apps/mobile/lib/trips/invite.ts`

## Goal

트립 AppBar의 동행자 아바타 탭을 route push가 아닌 trip shell 내부 `CompanionsSheet` overlay로 연결한다. 기존 `/trips/{tripId}/participants` route는 deep link/fallback 및 기존 관리 화면으로 유지하며, invite/share/remove 정책과 API 동작을 변경하지 않는다.

## Scope

- App UI: yes — `apps/mobile/app/trips/[tripId]/_layout.tsx` owns sheet open/load/action state
- Shared UI: yes — `CompanionsSheet` supports loading/error/action feedback, fallback share, and remove busy state
- Mobile helpers: yes — participant view model maps to companion sheet participants
- API/DB/generated: no changes
- Existing participants route: preserve as-is

## Out of Scope

- Removing or shrinking `/trips/{tripId}/participants`
- New invite/participant API behavior
- Owner/member permission policy changes
- Kakao native share bug fix (#126)
- #169 broad overlay cleanup for registration/edit/select flows

## Behavior

- AppBar avatar press opens `CompanionsSheet` with local `visible` state in trip shell.
- Opening/closing the sheet does not call `router.push` and does not grow the back stack.
- The sheet loads the full participant list with `listTripParticipants`, not only `participantSummary.previewNames`.
- Owner check reuses `canCreateTripInvite(getTripDetail, getMeWithRefresh().user.id)`.
- Invite actions reuse existing helpers:
  - `createTripInvite`
  - `buildInviteCopyText`
  - `buildKakaoInviteTemplate`
  - `buildFallbackShareContent`
  - existing invite error/Kakao failure copy
- Participant removal is available only for owner-removable member rows via existing `canRemoveMembers` view-model guard. The action requires explicit confirmation and reuses `removeTripParticipant` plus existing removal error copy.
- Successful removal updates the open sheet immediately and refreshes shell trip detail in the background so AppBar participant summary can update without close/reopen.

## Acceptance Criteria

- [ ] AppBar companion avatar press opens `CompanionsSheet` as a non-navigating overlay.
- [ ] Sheet open/close does not push `/participants` or any other route.
- [ ] Sheet loads and shows the full participant list.
- [ ] Owner-only invite create/copy/Kakao/fallback share works in sheet with visible feedback.
- [ ] Existing `/trips/{tripId}/participants` route remains available and behavior is preserved.
- [ ] Removal, if shown, is owner-only, member-only, confirmed, updates sheet state, and uses existing error copy.
- [ ] Successful removal refreshes AppBar summary in background.
- [ ] API/DB/generated code unchanged.
- [ ] `pnpm --filter @i-um/mobile test` passes.
- [ ] `pnpm --filter @i-um/mobile typecheck` passes.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| Participant rows map to companion sheet participants and current user marker | Unit | `apps/mobile/lib/trips/participants.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing participant owner/member/remove failure helpers | Unit | existing participant tests | `pnpm --filter @i-um/mobile test` |
| Shell overlay action wiring and shared sheet props compile | Typecheck | TypeScript | `pnpm --filter @i-um/mobile typecheck` |
| Theme/token rule | Static grep | touched files | `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" ...` |

## Regression Gaps

- Route-stack behavior is verified by code review/typecheck, not automated navigation tests.
  - Risk: future refactors could reintroduce route push.
  - Follow-up: manual smoke and/or navigation-level test harness.
- Kakao share success depends on native app/environment.
  - Risk: #126 remains.
  - Follow-up: #126.

## TDD Implementation Plan

1. Red: add helper test for companion sheet participant mapping/current-user marker.
2. Green: add helper mapping in `participants.ts` without changing existing route helpers.
3. Green: extend `CompanionsSheet` with loading/error/action feedback/fallback share/remove busy props.
4. Green: wire AppBar avatar `onPressMembers` in trip shell, load participants on open, and reuse existing invite/share/remove helpers.
5. Gate: run mobile tests/typecheck/lint/format and token grep.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass (273 tests, 17 suites)
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm --filter @i-um/mobile lint`: pass
- `pnpm --filter @i-um/mobile format:check`: pass
- `rg -n "#[0-9a-fA-F]{3,8}|rgba\(" apps/mobile/app/trips/[tripId]/_layout.tsx apps/mobile/lib/trip-ui/CompanionsSheet.tsx apps/mobile/lib/trips/participants.ts apps/mobile/lib/trips/participants.test.mts`: pass (no matches)

### Manual Smoke

- Sheet open/close/invite/share/remove: not run — no device session available; automated gates passed

## Release Notes

- Team-facing: 트립 AppBar 동행자 아바타에서 동행자 sheet를 바로 열 수 있게 한다. 기존 참여자 route는 유지된다.

## Open Questions

- None for this slice.

## Follow-up Issues

- #126 — Kakao native share issue
- #169 — broader BottomSheet overlay migration
