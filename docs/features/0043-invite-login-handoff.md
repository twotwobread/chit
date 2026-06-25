# Feature Slice: F-043 초대 링크 로그인 handoff

## Metadata

- GitHub Issue: #43
- Status: Implementation Complete (Manual Smoke Pending)
- Created: 2026-06-25
- Updated: 2026-06-25

## Source

- Issue: #43
- Ouroboros/PM/Seed: Interview `interview_20260625_121809`; Seed `seed_c0eb95c9472a`; ambiguity score `0.07`
- Notes: Ouroboros clarified F-043 as a mobile-only, transient invite login handoff. Login must return the user to `/invite/{token}` and reuse the existing F-042 invite acceptance screen; login must not accept the invite directly, and no API/DB/OpenAPI changes are planned.

## Goal

비로그인 사용자가 초대 링크로 앱에 들어온 뒤 로그인하면, 같은 초대 링크 화면으로 돌아와 기존 초대 수락 흐름이 이어진다.

F-043은 F-042의 logged-in invite acceptance를 확장하는 mobile handoff slice다. 로그인 전에는 초대 token을 서버에 보내지 않고, 로그인 성공 후 `/invite/{token}`로 복귀해서 기존 F-042 화면이 accept API를 호출하고 정상 결과/오류 상태를 보여준다.

## User Flow

1. 사용자가 F-041로 공유된 `inviteUrl`을 눌러 앱의 `/invite/{token}` 화면을 연다.
2. 앱은 token 형식을 검증한다.
3. token이 유효하지 않으면 기존 F-042 invalid invite 상태를 보여주고 handoff를 만들지 않는다.
4. token은 유효하지만 저장된 로그인 세션이 없거나 corrupt이면 앱은 accept API를 호출하지 않고 로그인 필요 상태를 보여준다.
5. 로그인 필요 상태는 `로그인하면 이 초대 링크로 돌아와요.` 안내와 `로그인하기` CTA를 보여준다.
6. 사용자가 `로그인하기`를 누르면 앱은 `/invite/{token}` return path를 transient pending handoff로 저장하고 `/login`으로 `replace` 이동한다.
7. `/login`은 pending handoff가 있을 때만 invite-aware subtitle `로그인하면 이 초대 링크로 돌아와요.`를 보여준다.
8. OAuth 로그인이 취소되거나 실패하면 사용자는 같은 `/login` 화면에 남고 pending handoff는 유지되어 재시도할 수 있다.
9. OAuth 로그인이 성공하면 앱은 pending handoff를 즉시 consume/clear하고 `/invite/{token}`로 `replace` 이동한다.
10. 복귀한 `/invite/{token}` 화면은 기존 F-042 흐름대로 저장된 세션을 확인하고 `POST /invites/{token}/accept`를 호출한다.
11. 앱은 F-042의 신규 참여, 이미 참여 중, owner already, 만료, 무효, 재시도 가능 오류 상태를 그대로 보여준다.
12. 사용자가 login 화면을 떠나거나 앱 process가 재시작되면 pending handoff는 유지되지 않는다.

## Scope

- App UI: yes
  - `apps/mobile/app/invite/[token].tsx`: login/auth-required action에서 invite handoff를 시작하고 login-required copy를 갱신
  - `apps/mobile/app/login.tsx`: pending invite handoff가 있을 때 invite-aware subtitle과 post-login return navigation 적용
- App Logic: yes
  - `apps/mobile/lib/trips/invite.ts` 또는 새 helper: invite login-required/auth-required copy 갱신
  - `apps/mobile/lib/trips/invite-login-handoff.ts` 또는 동등 helper: exact invite return path validation, transient pending handoff lifecycle, consume/clear/overwrite rules
- API Contract: no changes. Existing F-042 `POST /invites/{token}/accept` is reused after login return.
- API Server: no changes.
- DB: no changes.
- Generated Code: no generated API/sqlc changes expected.
- Tests: mobile helper tests and mobile typecheck.
- Deploy/Smoke: needed — staging/internal build or Expo runtime smoke for logged-out invite → login → return → accept result.

## Out of Scope

- Login screen에서 초대를 직접 수락하거나 `acceptTripInvite`를 호출하는 동작
- API contract, API server, DB schema, sqlc query, generated client/server 변경
- Web fallback에서 로그인/초대 수락 처리
- 앱 미설치 사용자의 install 후 deferred deep link 또는 universal/app link 운영 검증 (#130)
- OAuth provider 계정/credential 설정 변경
- F-042 invite acceptance business rules 변경: token 만료, idempotency, role handling, result/error copy는 그대로 유지
- 초대받은 여행의 마이페이지 반영 (#44, already complete) 또는 추가 list refresh behavior
- invite revoke/regenerate, pending invitee UI, invite use count/rate limit
- 일반 `/login` 화면의 provider button 순서/스타일/오류 copy 변경

## Requirements

### UI / UX

#### `/invite/{token}`

- Token extraction and validation keep the existing F-042 rule: arrays use the first param and valid tokens must pass `isInviteTokenFormatValid`.
- Invalid/missing token:
  - Do not create or overwrite pending handoff.
  - Show existing invalid invite state.
- Missing/corrupt stored session:
  - Do not call `acceptTripInvite`.
  - Show:
    - Title: `로그인이 필요합니다.`
    - Message: `로그인하면 이 초대 링크로 돌아와요.`
    - Primary CTA: `로그인하기`
    - Secondary CTA: `홈으로`
- 401/auth-expired after a stored session:
  - Continue to clear the invalid local session.
  - Show:
    - Title: `다시 로그인해주세요.`
    - Message: `로그인하면 이 초대 링크로 돌아와요.`
    - Primary CTA: `로그인하기`
    - Secondary CTA: `홈으로`
- `로그인하기` action:
  - Validate the current token again before creating handoff.
  - Store only exact return path `/invite/{token}` in transient mobile state.
  - Navigate to `/login` with `router.replace` semantics.
- `홈으로` continues to replace to `/` and must not create handoff.
- Retry and success behavior from F-042 remains unchanged.

#### `/login`

- Normal entry without pending invite handoff keeps current UI:
  - Title: `이음`
  - Subtitle: `여행을 함께 이어가려면 로그인해주세요.`
  - Successful login: `router.replace('/')`
- Invite-aware entry with valid pending handoff:
  - Title remains `이음`.
  - Subtitle becomes `로그인하면 이 초대 링크로 돌아와요.`
  - OAuth provider buttons, loading state, and existing error copy remain unchanged.
  - Successful login consumes/clears pending handoff before navigation, then `router.replace('/invite/{token}')`.
- OAuth cancel/provider failure/API login failure:
  - Keep the user on the same login screen.
  - Preserve the pending invite handoff so a retry can still return to `/invite/{token}`.
- Leaving `/login` without successful login:
  - Back/Home/other navigation clears pending handoff.
  - App process restart clears pending handoff because it is transient and not persisted.
- Back stack:
  - Use `replace` for invite → login and login → invite transitions.
  - After successful login return, the invite-aware login screen must not remain as the previous screen.

### Handoff State Rules

F-043 introduces a transient mobile-only pending handoff. It may be implemented as module-level in-memory state or an equivalent non-persistent app-state helper; it must not be stored in SecureStore/AsyncStorage/server state.

A valid handoff contains:

```text
returnPath = /invite/{token}
token = {token}
```

Validation rules:

- Only exact internal path shape `/invite/{token}` is accepted.
- `{token}` must pass `isInviteTokenFormatValid`.
- Query strings, external URLs, encoded path traversal, other internal paths, missing tokens, invalid tokens, and variant invite paths are unsafe.
- Unsafe paths are never saved or consumed; if encountered during login success, the app falls back to `/`.

Lifecycle rules:

- Pending handoff is created only from the invite screen `로그인하기` CTA.
- The most recently opened valid invite link wins. Creating a handoff for `/invite/{otherToken}` overwrites an existing valid pending handoff.
- Invalid invite links do not overwrite an existing valid pending handoff.
- Successful login consumes and clears the pending handoff immediately before replacing to `/invite/{token}`.
- OAuth cancel/failure preserves the pending handoff while the user remains on the same login screen.
- Back/Home/other navigation away from login clears pending handoff.
- Process restart clears pending handoff.
- Normal `/login` entry does not read stale handoff after it has been cleared and must not become invite-aware.

### API Contract

No API contract changes.

F-043 reuses the existing F-042 endpoint after login return:

```text
POST /invites/{token}/accept
```

The login screen must not call this endpoint. The invite screen remains the only mobile route that calls `acceptTripInvite(token)`.

### DB Changes

No DB changes.

F-043 reads/writes no new server-side state. The `trip_invites` and `trip_participants` behavior remains owned by F-041/F-042.

### Business Rules

- A logged-out invite link user must not need to manually reopen the link after login.
- Login handoff is a one-time convenience, not durable invite storage.
- Handoff must be safe against open redirect and path injection by accepting only validated internal invite paths.
- Existing F-042 invite acceptance remains the source of truth for token expiry, not-found, idempotency, and role-specific result states.
- Existing normal login behavior remains unchanged unless a valid pending invite handoff exists.

## Acceptance Criteria

- [x] AC-01: `docs/features/0043-invite-login-handoff.md` contains the reviewed feature spec and TDD implementation plan.
- [x] AC-02: F-043 implementation makes no OpenAPI, API server, DB migration, sqlc, or generated API changes.
- [x] AC-03: The handoff helper accepts only exact `/invite/{token}` paths where token passes `isInviteTokenFormatValid`; unsafe paths are rejected.
- [x] AC-04: Missing/corrupt-session users opening valid `/invite/{token}` do not call accept API and see `로그인이 필요합니다.` / `로그인하면 이 초대 링크로 돌아와요.` with `로그인하기` and `홈으로` actions.
- [x] AC-05: 401/auth-expired invite users clear local session and see `다시 로그인해주세요.` / `로그인하면 이 초대 링크로 돌아와요.` with the same login handoff action.
- [x] AC-06: Tapping `로그인하기` from a valid invite stores a transient one-time handoff for `/invite/{token}` and replaces to `/login`.
- [x] AC-07: `/login` with a valid pending invite handoff shows invite-aware subtitle `로그인하면 이 초대 링크로 돌아와요.`; normal `/login` keeps existing generic subtitle.
- [x] AC-08: Successful OAuth login with a valid pending handoff consumes/clears it and replaces to the same `/invite/{token}`.
- [x] AC-09: After returning to `/invite/{token}`, the existing F-042 flow calls `acceptTripInvite(token)` and renders normal accept result/error states.
- [x] AC-10: OAuth cancel/failure keeps the pending handoff while the user remains on the same login screen, so retrying login can still return to `/invite/{token}`.
- [x] AC-11: Back/Home/other navigation away from login and app process restart do not preserve the pending handoff.
- [x] AC-12: If login success sees no valid pending handoff or an unsafe return path, the app falls back to `/`.
- [x] AC-13: Creating a new valid invite handoff before login overwrites the previous one; invalid invite links do not overwrite an existing valid handoff.
- [x] AC-14: Invite → login and login → invite transitions use replace semantics so the invite-aware login screen is not left in back history.
- [x] AC-15: F-043 does not change provider button behavior, normal login error copy, or F-042 success/expired/invalid/retryable invite result copy.

## Regression Test Plan

| Behavior / AC | Layer | Test File / Gate | Command |
|---|---|---|---|
| AC-03, AC-12: exact invite return path validation rejects external URLs, query strings, traversal, other paths, missing/invalid tokens | Mobile helper | `apps/mobile/lib/trips/invite-login-handoff.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| AC-06, AC-08, AC-11, AC-13: pending handoff create/peek/consume/clear lifecycle, one-time consumption, latest valid wins, invalid does not overwrite | Mobile helper | `apps/mobile/lib/trips/invite-login-handoff.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-04, AC-05: login-required/auth-required invite view models use new handoff copy | Mobile helper | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-07, AC-08, AC-10, AC-12: login helper maps pending handoff to invite-aware subtitle and post-login redirect while preserving retry on OAuth failure | Mobile helper/screen logic | `apps/mobile/lib/auth/login-handoff.test.mts` or `apps/mobile/lib/trips/invite-login-handoff.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-09, AC-15: existing invite accept response/error view models remain unchanged | Mobile regression | `apps/mobile/lib/trips/invite.test.mts` | `pnpm --filter @i-um/mobile test` |
| AC-02, AC-06~AC-09: screens compile with Expo Router params/actions and no generated API drift | Mobile typecheck/generated drift | `apps/mobile/app/invite/[token].tsx`, `apps/mobile/app/login.tsx`, generated review | `pnpm --filter @i-um/mobile typecheck`; `pnpm verify:generated` |

## Regression Gaps

- Native Expo Router back stack behavior and hardware/browser-provider back interactions cannot be fully proven by the current pure Node mobile test setup.
  - Risk: A device-specific navigation edge case could leave `/login` in history or clear/preserve handoff at the wrong time.
  - Follow-up: Cover with internal build/manual smoke for invite → login → return, OAuth cancel retry, and back behavior.
- App process restart during an external OAuth provider flow cannot be fully automated in current unit tests.
  - Risk: A platform may restore route state differently than the transient helper model expects.
  - Follow-up: Manual smoke should terminate/reopen the app from invite-aware login and confirm normal login fallback or lost handoff.

## TDD Implementation Plan

1. Red: Add invite handoff helper tests
   - Create tests for exact `/invite/{token}` validation, unsafe path rejection, no query/external URL/path traversal acceptance, create/peek/consume clear, latest valid invite wins, invalid invite does not overwrite, and fallback when no valid pending handoff exists.
   - Verify: `pnpm --filter @i-um/mobile test` fails because helper does not exist.
2. Green: Implement transient handoff helper
   - Add `apps/mobile/lib/trips/invite-login-handoff.ts` or equivalent with pure validation and small in-memory lifecycle helpers.
   - Do not persist to SecureStore/AsyncStorage.
   - Verify: `pnpm --filter @i-um/mobile test`.
3. Red: Update invite copy tests
   - Change login-required/auth-required copy expectations in `apps/mobile/lib/trips/invite.test.mts` to `로그인하면 이 초대 링크로 돌아와요.`.
   - Verify failure against current copy.
4. Green: Update invite view models
   - Update `buildInviteLoginRequiredViewModel` and `buildInviteAuthRequiredViewModel` copy only.
   - Keep success/expired/invalid/retryable F-042 copy unchanged.
   - Verify: `pnpm --filter @i-um/mobile test`.
5. Red: Add login handoff behavior tests
   - Cover invite-aware subtitle, normal generic subtitle, success redirect target selection, one-time consume before redirect, OAuth failure preserving pending handoff, and invalid/unsafe fallback to `/`.
   - Verify failure against current login behavior.
6. Green: Wire invite screen and login screen
   - In `/invite/{token}`, make login/auth-required action create a pending handoff for the current valid token and `router.replace('/login')`.
   - In `/login`, show invite-aware subtitle only when helper has a valid pending handoff.
   - On successful login, consume pending handoff and replace to `/invite/{token}`; otherwise replace to `/`.
   - Preserve pending handoff on login error because the screen remains active.
   - Clear pending handoff when leaving login without success.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck`.
7. Refactor: Keep screen orchestration thin
   - Move formatting/validation/lifecycle logic out of screen files into helpers.
   - Avoid changing provider button styling, normal login error copy, or F-042 accept state logic.
   - Verify: `pnpm --filter @i-um/mobile test`.
8. Gate: Run final relevant checks
   - `pnpm --filter @i-um/mobile test`
   - `pnpm --filter @i-um/mobile typecheck`
   - `pnpm verify:generated`
   - Broader `pnpm verify` before PR if implementation proceeds in the same branch.

## Verification Plan

### Automated Regression

- `pnpm --filter @i-um/mobile test`: required before implementation completion.
- `pnpm --filter @i-um/mobile typecheck`: required before implementation completion.
- `pnpm verify:generated`: required to prove no generated API drift.
- `pnpm verify`: recommended before PR after implementation.

### Manual Smoke

- Logged-out device opens valid invite link, sees login-needed invite copy, taps login, completes OAuth, returns to invite screen, accepts invite, and can view trip.
- Logged-out invite login, cancel/fail OAuth once, retry login, then returns to invite screen.
- Normal `/login` entry keeps generic subtitle and returns to `/` after login.
- Invite-aware login back/Home behavior does not return to stale invite after later normal login.
- If possible, terminate/reopen app while on invite-aware login and confirm pending handoff does not survive.

## Verification Record

### Automated Regression

- `pnpm --filter @i-um/mobile test`: pass — 175 tests.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass — no generated drift.

### Manual Smoke

- Logged-out invite → login → return → accept: not run — needs internal build/staging OAuth smoke.
- OAuth cancel/failure retry: not run — needs device/provider smoke.
- Normal login isolation: not run — needs app runtime smoke.

## Release Notes

- 초대 링크를 받은 사용자가 로그인하지 않은 상태여도, 로그인 후 초대 링크 화면으로 자동 복귀해 초대 수락을 이어갈 수 있게 한다.

## Open Questions

- None

## Follow-up Issues

- #130: 초대 링크 앱 미설치/앱 링크 fallback 핸들링 and real Universal Link/App Link/store fallback verification.
