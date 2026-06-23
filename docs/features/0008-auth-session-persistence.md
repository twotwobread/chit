# Feature Slice: F-008 인증 세션 유지

## Metadata

- GitHub Issue: #8
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Readiness / Status Gate

- Ouroboros clarification completed with ambiguity score `0.0755`.
- Material product/API/DB/UI decisions for the spec are closed.
- Implementation may start after this spec is reviewed and approved.
- This slice is intentionally provider-agnostic after initial login. Kakao is the preferred manual smoke provider because #7 establishes real Kakao Login, but F-008 session restore must depend on i-um access/refresh tokens, not Kakao tokens.

## Ouroboros Source

- Interview Session: `interview_20260623_112105`
- Seed: `seed_32aeb5a80909`
- PM Document: N/A
- Notes: Ouroboros clarified missing-session, corrupt-session, retryable failure, non-retryable refresh failure, SecureStore write failure, logout failure, and single-flight refresh race behavior for F-008.

Context clarified before drafting:

- Kakao OAuth/Kakao Native SDK is only the initial identity proof/login entry.
- After `/auth/oauth/login` succeeds, the source of truth for app session state is the i-um API-issued JWT access token plus opaque rotating refresh token.
- App relaunch/session restore must not call Kakao or depend on Kakao access token validity.
- F-005 already defines `users`, `auth_identities`, `auth_sessions`, `/auth/me`, `/auth/token/refresh`, and `/auth/logout`.
- F-007 validates that Kakao login can issue an i-um auth session. F-008 validates that the issued i-um session persists and refreshes correctly after app relaunch.

## Goal

사용자가 Kakao Login 등으로 한 번 로그인한 뒤 앱을 종료/재실행해도, i-um 자체 access token과 refresh token으로 로그인 상태가 안전하게 복구된다.

이 feature는 OAuth provider별 동작을 확장하지 않고, 앱 시작과 보호된 화면/API 접근 시 저장된 i-um 세션을 검증·갱신·삭제하는 provider-agnostic session persistence 규칙을 고정한다.

## Problem

- F-005/F-007에서 로그인과 refresh token 기반 세션 모델은 생겼지만, 앱 재실행 시 branch별 UX와 token 처리 규칙이 feature 단위로 고정되어 있지 않다.
- refresh token은 rotating 방식이므로 중복 refresh가 병렬로 발생하면 한 요청의 성공 후 다른 요청의 실패를 세션 무효로 오판할 수 있다.
- 저장된 세션이 없을 때, 손상되었을 때, 네트워크 오류일 때, refresh가 비재시도성으로 실패했을 때의 UI/저장소/API 호출 규칙이 명확해야 한다.
- Kakao access token을 세션 유지 수단으로 오해하면 앱 재실행이 provider 상태에 불필요하게 의존하게 된다.

## User Flow

### Normal app relaunch with valid access token

1. 사용자가 Kakao Login 등으로 로그인해 i-um access/refresh token을 받은 상태에서 앱을 종료한다.
2. 사용자가 앱을 재실행한다.
3. 앱은 SecureStore에서 저장된 i-um 세션을 읽는다.
4. 저장된 세션이 정상이고 access token으로 `GET /auth/me`가 성공하면 authenticated 화면을 보여준다.
5. 이 과정에서 Kakao SDK/API는 호출하지 않는다.

### App relaunch with expired access token and valid refresh token

1. 앱 재실행 시 저장된 i-um 세션이 있다.
2. 앱은 저장된 access token으로 `GET /auth/me`를 호출한다.
3. `GET /auth/me`가 `UNAUTHORIZED`이면 저장된 refresh token으로 `POST /auth/token/refresh`를 한 번 호출한다.
4. refresh 성공 시 새 access token과 새 refresh token을 SecureStore에 저장한다.
5. 앱은 새 access token으로 `GET /auth/me`를 다시 한 번 호출한다.
6. 성공하면 authenticated 화면을 보여준다.

### No stored session

1. 앱 시작 시 SecureStore에 저장된 i-um 세션이 없다.
2. 앱은 이를 오류가 아닌 정상 logged-out 상태로 본다.
3. 앱은 `/auth/me`, `/auth/token/refresh`, Kakao SDK/API를 호출하지 않는다.
4. 앱은 login/needsLogin 상태와 `로그인이 필요합니다.`를 보여준다.

### Corrupt or invalid local session payload

1. 앱 시작 시 SecureStore에 값은 있지만 JSON 파싱이 실패하거나 필수 필드가 없다.
2. 앱은 저장된 세션을 corrupt session으로 판단한다.
3. 앱은 부분 credential로 API 또는 Kakao를 호출하지 않는다.
4. 앱은 로컬 세션을 삭제하고 login/needsLogin 상태와 `다시 로그인해주세요.`를 보여준다.

### Retryable bootstrap failure

1. 앱 시작/보호 화면 접근 중 `/auth/me` 또는 `/auth/token/refresh` 호출이 네트워크 오류, timeout, 5xx 등 retryable error로 실패한다.
2. 앱은 저장된 토큰을 삭제하지 않는다.
3. 앱은 로그인 화면으로 보내지 않고 기존 startup/home recovery 상태에 머문다.
4. 앱은 `홈을 불러올 수 없어요.`와 `다시 시도`를 보여준다.
5. 사용자가 `다시 시도`를 누르면 전체 bootstrap sequence를 처음부터 다시 실행한다.
6. 이 slice에서는 자동 retry loop, retry limit, backoff를 추가하지 않는다.

### Non-retryable refresh failure

1. `GET /auth/me`가 `UNAUTHORIZED`라서 refresh를 시도한다.
2. `POST /auth/token/refresh`가 `INVALID_REFRESH_TOKEN`, `UNAUTHORIZED`, revoked/expired/not found refresh token 등 비재시도성 인증 실패를 반환한다.
3. 앱은 저장된 세션을 삭제한다.
4. 앱은 login/needsLogin 상태와 `다시 로그인해주세요.`를 보여준다.

### Logout

1. 사용자가 로그아웃을 누른다.
2. 앱은 현재 access token으로 `POST /auth/logout`을 시도한다.
3. API 성공 여부와 무관하게 앱은 이 기기에서의 로그아웃을 우선 보장한다.
4. 앱은 로컬 i-um 세션을 삭제하고 login/needsLogin 상태로 이동한다.
5. Kakao SDK local session clear는 가능하면 best-effort로 수행한다.
6. Kakao unlink, KakaoTalk global logout, 모든 기기 로그아웃은 하지 않는다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App Auth: 저장된 i-um session payload validation을 명확히 한다.
- [ ] App Auth: 앱 시작/보호 화면/API 접근에서 재사용할 provider-agnostic session restore 또는 ensure-authenticated helper를 정리한다.
- [ ] App Auth: `GET /auth/me → 필요 시 /auth/token/refresh → /auth/me` bootstrap sequence를 고정한다.
- [ ] App Auth: refresh 성공 후 새 token pair를 SecureStore에 저장하고, 저장 실패 시 authenticated UI로 진입하지 않는다.
- [ ] App Auth: missing/corrupt/retryable/non-retryable/persistence-failure/logout branch별 local storage 처리와 UI 결과를 구현한다.
- [ ] App Auth: bootstrap/refresh single-flight를 적용해 concurrent refresh token rotation race를 방지한다.
- [ ] App UI: 기존 home/startup loading, retryable error, needsLogin 상태를 유지·보완한다. 새 전용 route는 기본값으로 추가하지 않는다.
- [ ] API Contract: 기존 F-005 auth endpoints를 재사용한다. OpenAPI 변경 없음이 기본값이다.
- [ ] API Server: 기존 refresh/logout/session behavior를 재사용한다. API 변경 없음이 기본값이다.
- [ ] DB: 기존 `auth_sessions` schema와 rotating refresh token 저장 방식을 재사용한다. DB 변경 없음이 기본값이다.
- [ ] Tests: mobile session restore/storage/client behavior에 대한 unit regression test를 추가한다.
- [ ] Tests: API auth refresh/logout regression suite가 깨지지 않았음을 확인한다.
- [ ] Verification: Kakao Login으로 발급된 i-um session에서 앱 kill/reopen, refresh, logout manual smoke를 기록한다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- Kakao Login 자체 구현 변경 (#7 범위)
- Sign in with Apple 실제 provider 검증 (#6)
- Kakao access token 장기 저장 또는 Kakao token refresh
- 앱 재실행 시 Kakao SDK/API를 통한 자동 재로그인
- background→foreground lifecycle listener 추가
- proactive/periodic token refresh
- 자동 retry loop, retry limit, exponential backoff
- 모든 기기 로그아웃/session 목록 관리
- provider unlink, account deletion, profile editing
- API auth contract 변경
- DB schema/migration 변경
- production-grade device trust, MFA, risk scoring

## UX / UI Requirements

### Screens

- `apps/mobile/app/index.tsx`
  - 앱 시작 시 저장된 세션이 있으면 기존 loading state를 보여준다.
  - retryable bootstrap failure는 기존 home/startup recovery state에서 `홈을 불러올 수 없어요.`와 `다시 시도`를 보여준다.
  - missing session은 정상 logged-out state로 `로그인이 필요합니다.`를 보여준다.
  - invalid/corrupt/expired prior session은 `다시 로그인해주세요.`를 보여준다.
- `apps/mobile/app/login.tsx`
  - 세션이 없거나 무효가 된 경우 진입하는 로그인 화면이다.
  - Kakao/Apple 로그인 버튼 자체는 F-008에서 변경하지 않는다.
- `apps/mobile/app/account.tsx` 또는 `apps/mobile/app/mypage.tsx`
  - 기존 logout 진입점은 API 실패와 무관하게 local logout을 완료해야 한다.

정확한 route/file은 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, 새 dedicated bootstrap route를 추가하지 않는 것이 기본값이다.

### States

- Loading: 저장된 세션으로 bootstrap 중일 때 기존 loading state를 유지한다.
- Normal logged-out: 저장된 세션이 없으면 오류로 보지 않고 `로그인이 필요합니다.`를 보여준다.
- Invalid prior session: corrupt session 또는 non-retryable refresh failure이면 로컬 세션을 삭제하고 `다시 로그인해주세요.`를 보여준다.
- Retryable recovery: 네트워크/timeout/5xx 등 retryable failure이면 토큰을 유지하고 `홈을 불러올 수 없어요.`와 `다시 시도`를 보여준다.
- Success: `/auth/me`가 성공하면 authenticated 화면을 보여준다.
- Logout: API 결과와 무관하게 로컬 세션 삭제 후 login/needsLogin으로 이동한다.

### Copy / Labels

- Normal logged-out: `로그인이 필요합니다.`
- Invalid prior session: `다시 로그인해주세요.`
- Bootstrap loading: `홈을 불러오는 중...`
- Retryable bootstrap failure: `홈을 불러올 수 없어요.`
- Retry button: `다시 시도`
- Logout: `로그아웃`

## API Contract

No API changes.

F-008 reuses the F-005 auth contract.

### Endpoints

```text
GET  /auth/me
POST /auth/token/refresh
POST /auth/logout
POST /auth/oauth/login
```

### Bootstrap Sequence

```text
1. Read stored i-um session from SecureStore.
2. If missing: no API call, show logged-out state.
3. If corrupt: clear local session, no API call, show invalid prior session state.
4. If present: GET /auth/me with Authorization: Bearer <stored accessToken>.
5. If GET /auth/me succeeds: authenticated.
6. If GET /auth/me returns UNAUTHORIZED: POST /auth/token/refresh with stored refreshToken.
7. If refresh succeeds: persist new tokens, then retry GET /auth/me once.
8. If final GET /auth/me succeeds: authenticated.
9. If refresh returns non-retryable auth failure: clear local session and show invalid prior session state.
10. If a retryable network/server failure occurs: keep local session and show retryable recovery state.
```

### Request / Response

No request/response schema changes.

Refresh continues to use:

```json
{
  "refreshToken": "opaque-refresh-token"
}
```

Refresh success continues to return:

```json
{
  "result": "refresh_success",
  "tokens": {
    "accessToken": "new-jwt-access-token",
    "accessTokenExpiresAt": "2026-06-23T12:15:00Z",
    "refreshToken": "new-opaque-refresh-token",
    "refreshTokenExpiresAt": "2026-07-23T12:00:00Z"
  }
}
```

### Errors

Common error format remains unchanged.

Non-retryable refresh/auth failures include:

```text
INVALID_REFRESH_TOKEN
UNAUTHORIZED
revoked refresh token
expired refresh token
refresh token not found
```

Retryable failures include:

```text
network error
timeout
5xx
temporary server unavailable
unknown transport failure without a stable auth error code
```

## DB Changes

No DB changes.

F-008 reuses the F-005 auth tables:

- `users`
- `auth_identities`
- `auth_sessions`

No migration is expected. If implementation discovers a required schema change, update this spec before coding the migration.

## Business Rules

### OAuth dependency boundary

- OAuth provider credential verification happens only at login/link time.
- Kakao access token is not a session persistence dependency.
- App relaunch/session restore must not call Kakao SDK/API.
- The source of truth for a logged-in app session is the i-um `auth_session` plus i-um access/refresh tokens.

### Stored session validity

A stored session is corrupt if any of the following is true:

- SecureStore value is not valid JSON.
- `user` is missing.
- `tokens` is missing.
- `tokens.accessToken` is missing or empty.
- `tokens.refreshToken` is missing or empty.
- Required `AuthUser` identity fields needed by the generated type are missing or empty.

Rules:

- Missing stored session is normal logged-out state, not an error.
- Corrupt stored session must be deleted immediately.
- Corrupt stored session must not be sent to the API.
- Raw tokens and corrupt payload contents must not be logged.

### Refresh and persistence

- Access token failure triggers at most one refresh attempt per bootstrap sequence.
- Refresh success rotates the refresh token. The newly returned access/refresh token pair must be persisted before authenticated UI is shown.
- If SecureStore write fails during login or refresh, this is a local persistence failure.
- On local persistence failure after refresh, the app must not keep an in-memory-only authenticated session.
- On local persistence failure after refresh, the app should best-effort clear local session and show `다시 로그인해주세요.` because the old refresh token may already be invalid.

### Retry behavior

- User-tapped retry reruns the full bootstrap sequence from the beginning.
- F-008 does not add automatic retry loops, retry limits, or backoff.
- Retryable network/server failures keep stored tokens.
- Non-retryable refresh/auth failures delete stored tokens.

### Concurrency

- Only one in-flight bootstrap/refresh operation may exist per app process.
- Concurrent callers must await the same in-flight operation instead of issuing parallel refresh requests.
- This prevents rotating refresh token race conditions.
- If a stale duplicate refresh failure can still occur after another refresh already saved newer tokens, it must not overwrite the newer valid stored session or force logout.
- The preferred implementation is to prevent duplicate refresh requests with single-flight behavior.

### Logout

- User-initiated logout prioritizes this-device logout.
- App should attempt `POST /auth/logout` when a stored session exists.
- API success is not required before clearing local i-um session.
- Local i-um session must be cleared in a `finally`-equivalent path.
- Kakao SDK local session clear is best-effort and must not block i-um local logout.
- Logout does not unlink provider identity and does not globally log out of KakaoTalk.

## Acceptance Criteria

- [ ] `docs/features/0008-auth-session-persistence.md` exists and records the Ouroboros source, scope, regression plan, TDD plan, and verification plan for #8.
- [ ] The spec defines session persistence as provider-agnostic i-um access/refresh token behavior after initial OAuth login.
- [ ] App relaunch with no stored session performs no `/auth/me`, `/auth/token/refresh`, or Kakao call and shows normal logged-out state with `로그인이 필요합니다.`.
- [ ] App relaunch with corrupt stored session clears local session without API/Kakao calls and shows `다시 로그인해주세요.`.
- [ ] App relaunch with valid access token calls `/auth/me` and enters authenticated UI on success.
- [ ] App relaunch with expired access token and valid refresh token calls `/auth/token/refresh` once, persists the rotated token pair, retries `/auth/me` once, and enters authenticated UI on success.
- [ ] Refresh non-retryable auth failure clears local session and shows `다시 로그인해주세요.`.
- [ ] Retryable network/server failure during bootstrap/refresh keeps stored tokens and shows recovery UI with `홈을 불러올 수 없어요.` and `다시 시도`.
- [ ] Tapping `다시 시도` reruns the full bootstrap sequence from the beginning without automatic retry loop/backoff.
- [ ] SecureStore write failure during login/refresh does not allow authenticated in-memory-only fallback.
- [ ] SecureStore write failure after refresh best-effort clears local session and shows `다시 로그인해주세요.`.
- [ ] Concurrent bootstrap/refresh callers share one in-flight operation and do not issue parallel refresh requests.
- [ ] Stale duplicate refresh failure cannot overwrite a newer valid stored session or force logout.
- [ ] User logout attempts `/auth/logout` when possible but clears local i-um session and returns to login/needsLogin regardless of API result.
- [ ] Logout clears app-local Kakao SDK session best-effort when available.
- [ ] Existing API auth regression tests for refresh rotation, invalid refresh, `/auth/me`, and logout still pass.
- [ ] Kakao Login manual smoke confirms that a Kakao-issued i-um session survives app kill/reopen through i-um refresh/session restore, not Kakao re-login.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| Missing stored session returns normal logged-out/needsLogin state and does not call API or Kakao | Mobile auth/session restore | `apps/mobile/lib/auth/session-restore.test.mts` or equivalent new helper test | `pnpm --filter @i-um/mobile test` |
| Corrupt JSON stored session is cleared and no API/Kakao call is made | Mobile session storage | `apps/mobile/lib/auth/session.test.mts` or `session-restore.test.mts` | `pnpm --filter @i-um/mobile test` |
| Missing/empty required stored session fields are treated as corrupt and cleared | Mobile session storage | `apps/mobile/lib/auth/session.test.mts` or `session-restore.test.mts` | `pnpm --filter @i-um/mobile test` |
| Valid stored access token calls `/auth/me` and returns authenticated user without refresh | Mobile auth client/helper | `apps/mobile/lib/auth/client.test.mts` or `session-restore.test.mts` | `pnpm --filter @i-um/mobile test` |
| Expired/rejected access token triggers exactly one refresh and retries `/auth/me` once after saving new tokens | Mobile auth client/helper | `apps/mobile/lib/auth/client.test.mts` or `session-restore.test.mts` | `pnpm --filter @i-um/mobile test` |
| Refresh success persists rotated access/refresh tokens before authenticated result is returned | Mobile auth client/storage | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Non-retryable refresh failure clears local session and maps to needsLogin/`다시 로그인해주세요.` | Mobile auth client/state | `apps/mobile/lib/auth/client.test.mts` and small UI state helper test if extracted | `pnpm --filter @i-um/mobile test` |
| Retryable network/server failure keeps stored tokens and maps to recovery retry state | Mobile auth client/state | `apps/mobile/lib/auth/client.test.mts` and small UI state helper test if extracted | `pnpm --filter @i-um/mobile test` |
| Retry action reruns the full bootstrap sequence from the beginning | Mobile state/helper | `apps/mobile/lib/auth/session-restore.test.mts` or extracted home state helper test | `pnpm --filter @i-um/mobile test` |
| SecureStore write failure during login/refresh does not return authenticated success and best-effort clears local session | Mobile auth client/storage | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Concurrent restore/refresh callers share one in-flight operation and only one refresh request is sent | Mobile auth client/concurrency | `apps/mobile/lib/auth/client.test.mts` or `session-restore.test.mts` | `pnpm --filter @i-um/mobile test` |
| Stale duplicate refresh failure cannot clear a newer valid stored session | Mobile auth client/concurrency | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Logout clears local i-um session and Kakao local session best-effort even when `/auth/logout` fails | Mobile auth client/logout | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile code typechecks after auth helper/state changes | Mobile typecheck | `apps/mobile` typecheck gate | `pnpm --filter @i-um/mobile typecheck` |
| API refresh rotation, invalid refresh, `/auth/me`, and logout behavior remain compatible | API auth service/server | Existing `apps/api/internal/auth/service_test.go`, `apps/api/internal/server/server_test.go`; add targeted test only if coverage gap is found | `pnpm --filter @i-um/api test` |
| No OpenAPI/generated drift because no contract change is expected | Contract gate | generated drift gate | `pnpm verify:generated` |
| Full project regression remains green | Full gate | repository verification gate | `pnpm verify` |

## Regression Gaps

- Real mobile app process death/relaunch and SecureStore persistence across OS app restart cannot be fully proven by Node unit tests.
  - Risk: Native runtime or EAS configuration issues could break real-device session restore despite helper tests passing.
  - Follow-up: F-008 manual smoke must record internal build/device result for Kakao login → kill/reopen → authenticated restore.
- Real Kakao provider UI is not automated in this slice.
  - Risk: Kakao Login provider setup regressions are caught by F-007/manual smoke rather than F-008 unit tests.
  - Follow-up: Use Kakao only as the manual initial login provider; do not treat provider UI smoke as regression coverage for session persistence logic.

## TDD Implementation Plan

1. Red: Mobile session payload validation tests
   - Add tests for missing stored session, invalid JSON, missing `user`, missing `tokens`, empty `accessToken`, empty `refreshToken`, and missing required user identity fields.
   - Verify: `pnpm --filter @i-um/mobile test` fails because current storage/helper does not validate every corrupt shape.
2. Green: Minimal stored session validation
   - Add the smallest validation boundary around SecureStore reads or session restore input.
   - Ensure corrupt payload is cleared without logging token values.
   - Verify: `pnpm --filter @i-um/mobile test` passes targeted storage tests.
3. Red: Bootstrap branch tests
   - Add tests for valid access token success, `UNAUTHORIZED` access followed by refresh success and `/auth/me` retry, refresh non-retryable failure, and retryable network/server failure.
   - Verify: `pnpm --filter @i-um/mobile test` fails on missing branch classification or missing retry-state separation.
4. Green: Provider-agnostic bootstrap helper
   - Introduce or refine a reusable `getCurrentUserWithRefresh`/`ensureAuthenticatedSession` helper that accepts mockable API/storage dependencies where needed.
   - Keep Kakao credential logic out of bootstrap.
   - Persist refreshed tokens before returning authenticated success.
   - Verify: targeted mobile auth tests pass.
5. Red: Persistence failure tests
   - Add tests where refresh succeeds but SecureStore save fails.
   - Verify: test fails until the helper refuses in-memory-only authenticated fallback and clears local state best-effort.
6. Green: Persistence failure handling
   - Make login/refresh save failure surface as an invalid prior session/local persistence failure state.
   - Do not keep authenticated in-memory-only session after save failure.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
7. Red: Single-flight concurrency tests
   - Add tests with concurrent callers that would otherwise issue parallel refresh requests.
   - Verify: test fails until only one refresh request is made and callers share the result.
8. Green: Single-flight implementation
   - Add a process-local in-flight promise around bootstrap/refresh.
   - Ensure stale duplicate refresh failure cannot clear a newer saved session.
   - Verify: concurrency tests pass.
9. Red/Green: UI state mapping
   - Extract minimal state mapping helper if needed for home startup states.
   - Cover normal logged-out, invalid prior session, retryable recovery, retry action, and authenticated success.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
10. Red/Green: Logout failure handling
    - Add tests that `/auth/logout` throws but local i-um session and Kakao local session clear still run.
    - Verify: targeted logout tests pass.
11. API and contract regression check
    - No OpenAPI/DB changes expected. Run existing API tests and generated drift check.
    - Verify: `pnpm verify:generated`, `pnpm --filter @i-um/api test`, `pnpm --filter @i-um/api build` pass.
12. Regression gate
    - Verify: `pnpm verify` passes.
13. Internal build smoke
    - Use Kakao Login to create an i-um session.
    - Kill/reopen app and verify session restore occurs without re-running Kakao login.
    - Verify logout returns to login/needsLogin and local session stays cleared after reopen.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm verify
```

If implementation unexpectedly adds DB changes, also run:

```text
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
```

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Install iOS internal build configured for staging API and real Kakao Login.
- [ ] Start with no stored session and confirm login/needsLogin shows `로그인이 필요합니다.` without automatic Kakao login.
- [ ] Tap `Kakao로 계속하기` and complete real Kakao Login.
- [ ] Confirm authenticated home/account screen loads.
- [ ] Kill the app completely and reopen it.
- [ ] Confirm the app restores the i-um session and reaches authenticated UI without showing Kakao consent/login again.
- [ ] If possible, wait for access token expiry or force an expired access token scenario, then confirm refresh restores the session.
- [ ] Simulate or observe network failure during startup and confirm retryable recovery keeps the session and `다시 시도` works.
- [ ] Tap logout and confirm login/needsLogin after API success.
- [ ] Repeat logout with API offline if feasible and confirm local logout still succeeds.
- [ ] Reopen after logout and confirm the app stays logged out.

### Staging API Smoke

```bash
CLOUD_RUN_URL="<staging-cloud-run-url>"

curl -i "$CLOUD_RUN_URL/health"
curl -i "$CLOUD_RUN_URL/ready"
```

Optional API-level refresh/logout smoke can be run only with locally generated test credentials or dev OAuth in a non-public environment. Do not paste raw tokens into GitHub/chat/logs.

### Verification Results

- `pnpm install --frozen-lockfile`: pass.
- Initial `pnpm --filter @i-um/mobile test`: fail as expected after adding F-008 regression tests; the new tests required missing session validation/client dependency injection and exposed existing logout API-failure propagation.
- `pnpm --filter @i-um/mobile test`: pass; covers stored session validation, corrupt local session clearing, valid access bootstrap, refresh success rotation persistence, retryable refresh failure token retention, non-retryable refresh failure clearing, SecureStore write failure after refresh, single-flight refresh, and logout local clear on API failure.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm verify:generated`: pass.
- `pnpm verify`: pass.
- Manual mobile runtime check on simulator/emulator/physical device: not run in this environment.
- Staging `/health`: pass, HTTP 200 against the current Cloud Run service URL.
- Staging `/ready`: pass, HTTP 200 against the current Cloud Run service URL.
- Staging auth endpoint smoke: blocked on 2026-06-23; `POST /auth/oauth/login` returned HTTP 404 against the current Cloud Run service URL, indicating the deployed staging API image/route does not yet expose the F-005 auth endpoint or the target URL/revision is not the auth-enabled API. Dev OAuth disabled behavior must be rechecked after deploying an auth-enabled API revision.
- EAS preview env values for `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_AUTH_DEV_MODE`, and `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY`: created/updated from local `.env` on 2026-06-23 without printing secret values.
- `npx expo config --type public --json`: pass with staging bundle id, Kakao native plugin, and Kakao native scheme configured.
- `EAS_NO_VCS=1 npx eas-cli@latest build --profile preview --platform ios --non-interactive --no-wait --message "F008 auth session persistence smoke"`: fail; EAS could not find iOS credentials suitable for internal distribution in non-interactive mode. First iOS internal build must be run interactively so EAS can create/select Apple credentials and register the test device.
- iOS internal build/device smoke: not run yet; blocked by first-time interactive EAS iOS credential setup and device access.

## Release Notes

```text
- 앱 재실행 후 i-um access/refresh token 기반으로 로그인 상태를 복구하는 세션 유지 규칙을 정리한다.
- OAuth provider token에 의존하지 않고 `/auth/me`와 rotating refresh token으로 세션을 검증·갱신한다.
- refresh race, corrupt local session, retryable network failure, logout failure 처리 기준을 명확히 한다.
```

## Open Questions

None for implementation after spec approval.

Spec approved for implementation by user request on 2026-06-23.

Resolved by Ouroboros interview:

- 저장된 세션이 없으면 정상 logged-out 상태로 처리한다.
- corrupt stored session은 삭제하고 API/Kakao 호출을 하지 않는다.
- retryable network/server failure는 토큰을 유지하고 retry UI에 머문다.
- non-retryable refresh failure는 토큰을 삭제하고 `다시 로그인해주세요.`를 보여준다.
- refresh 성공 후 SecureStore 저장 실패는 authenticated fallback 없이 local persistence failure로 처리한다.
- logout은 API 결과와 무관하게 local logout을 완료한다.
- concurrent bootstrap/refresh는 single-flight로 묶어 refresh token rotation race를 방지한다.
- background→foreground listener와 proactive refresh는 이번 slice에서 제외한다.

## Follow-up Issues

- TBD: background→foreground lifecycle 기반 proactive session check가 필요해지면 별도 feature로 분리한다.
- TBD: 모든 기기 로그아웃/session 목록 관리는 별도 auth/session management feature로 분리한다.
