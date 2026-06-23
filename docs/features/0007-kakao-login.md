# Feature Slice: F-007 Kakao Login 실제 provider 연결 및 internal build 검증

## Metadata

- GitHub Issue: #7
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-22
- Updated: 2026-06-23

## Readiness / Status Gate

- Ouroboros clarification completed with ambiguity score `0.054`.
- Material product/API/DB/UI decisions for the spec are closed.
- Implementation may start after this spec is reviewed and approved.
- Kakao Developers manual setup for iOS staging is complete enough to implement.
- Final iOS internal build smoke may still depend on Apple Developer/EAS managed credential readiness. If Apple Developer Program approval or EAS credentials are not available at implementation time, record the blocked smoke result instead of enabling dev OAuth on public staging.

## Ouroboros Source

- Interview Session: `interview_20260622_151652`
- Seed: `seed_ca3c1a67a87a`
- PM Document: N/A
- Notes: Ouroboros clarified that F-007 should use Kakao Native SDK on iOS instead of the previous REST/AuthSession redirect URI assumption, preserve F-005 auth identity semantics, keep Kakao account-link UX out of scope, and separate automated regression coverage from real-provider manual smoke.

Context clarified before drafting:

- Kakao app: `이음(i-um)` / App ID `1493314`.
- iOS Bundle ID registered in Kakao Developers: `com.twotwobread.ium.staging`.
- Kakao Login is enabled.
- OpenID Connect is disabled and not required for this feature.
- Consent items are required for profile information, nickname, and account email.
- The owner will test with their own Kakao account; no additional Kakao tester/team member is required for this slice.
- Kakao Developers provides a native app scheme in the form `kakao{Native App Key}`. The actual key/scheme value must not be committed to git or pasted into GitHub issues.

## Goal

사용자가 iOS internal build에서 `Kakao로 계속하기`를 눌러 실제 Kakao Native SDK 로그인/동의를 완료하고, F-005 auth foundation의 내부 `User`, `auth_identity`, `auth_session`이 생성 또는 재사용되는 것을 검증한다.

이 feature는 기존 REST/AuthSession + custom redirect URI 전제를 iOS Kakao Native SDK 방식으로 바꾸고, 앱이 Kakao access token을 우리 API의 기존 Kakao verifier로 전달하는 vertical slice다.

## Problem

- 현재 모바일 Kakao login 코드는 `expo-auth-session`과 Kakao REST API Key/redirect URI를 전제로 한다.
- Kakao Developers의 로그인 Redirect URI 입력은 `ium://oauth` 같은 custom scheme을 허용하지 않아 현재 전제로는 실제 provider smoke를 안정적으로 완료할 수 없다.
- iOS internal build에서 Kakao Native SDK 기반으로 access token을 얻고 기존 F-005 API login/session/refresh/logout 모델과 연결되는지를 검증해야 한다.
- public staging에서 dev OAuth가 켜지면 실제 provider 검증 결과를 신뢰할 수 없으므로 반드시 비활성 상태를 확인해야 한다.

## User Flow

1. 사용자가 iOS internal build를 설치하고 앱을 연다.
2. 앱은 public staging API를 바라보고 `EXPO_PUBLIC_AUTH_DEV_MODE=false` 상태로 실행된다.
3. 사용자가 로그인 화면에서 `Kakao로 계속하기`를 누른다.
4. 앱은 Kakao Native SDK를 통해 KakaoTalk login을 시도하고, KakaoTalk이 없거나 사용할 수 없으면 SDK가 제공하는 Kakao account/web login 흐름으로 fallback한다.
5. 사용자가 Kakao 로그인과 필수 동의항목 동의를 완료한다.
6. 앱은 Kakao Native SDK에서 받은 access token을 기존 `/auth/oauth/login` API에 `provider: kakao` credential로 전달한다.
7. API는 Kakao user info를 검증하고 내부 user/session을 생성하거나 기존 Kakao identity user로 로그인한다.
8. 앱은 로그인 성공 후 authenticated 화면으로 이동한다.
9. 앱이 `/auth/me` 또는 refresh-backed current user flow를 통해 현재 user와 linked provider `kakao`를 확인한다.
10. 사용자가 앱을 종료/재실행해도 refresh flow로 로그인 상태가 유지된다.
11. 사용자가 로그아웃하면 현재 i-um server session과 local auth state가 지워지고 login screen으로 돌아간다.
12. 앱은 app-local Kakao SDK token/session도 가능하면 clear해서 stale provider token을 재사용하지 않는다. Kakao account unlink나 KakaoTalk global logout은 하지 않는다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App Config: iOS internal build에서 Kakao Native SDK가 요구하는 app key/scheme 설정을 EAS/local env 기반으로 주입
- [ ] App Config: `com.twotwobread.ium.staging` bundle id와 Kakao native scheme이 일관되게 설정됨
- [ ] App Dependency: Expo/EAS iOS build에서 동작하는 Kakao Native SDK 또는 React Native wrapper 도입
- [ ] App Auth: `getOAuthCredential('kakao')`가 Kakao Native SDK access token을 반환하도록 변경
- [ ] App Auth: KakaoTalk unavailable 시 Kakao account/web login fallback 지원
- [ ] App Auth: Kakao cancel/error/missing token을 기존 login error UX로 매핑
- [ ] App Auth: logout 시 i-um session/local state와 app-local Kakao SDK token/session clear
- [ ] App Auth: 기존 account screen의 provider-link path가 shared Kakao credential adapter 변경으로 깨지지 않도록 최소 호환성 유지
- [ ] API Contract: 기존 `/auth/oauth/login`, `/auth/me`, refresh, logout contract 재사용. OpenAPI 변경 없음이 기본값
- [ ] API Server: 기존 F-005 Kakao access-token verifier 재사용. API 변경 없음이 기본값
- [ ] DB: 기존 `users`, `auth_identities`, `auth_sessions` schema 재사용. DB 변경 없음
- [ ] Tests: Native SDK boundary를 mockable adapter로 분리하고 success/fallback/cancel/error/logout clearing behavior를 mobile unit test로 검증
- [ ] Tests: API auth regression suite로 Kakao access-token login, `/auth/me`, refresh, logout behavior가 깨지지 않았음을 확인
- [ ] Deployment: staging API env와 EAS preview/internal env 설정 문서화 및 적용
- [ ] Verification: iOS internal build에서 실제 Kakao Login manual smoke 결과와 build link 기록
- [ ] Verification: public staging에서 dev OAuth disabled check 기록

Scope control: 이 spec은 GitHub Issue #7에 한정한다. Apple provider, Android provider, 계정 삭제, unlink, production store 제출, Kakao social 기능은 포함하지 않는다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- Sign in with Apple 실제 provider 검증 (#6)
- Android Kakao Login 검증 및 Android platform/package 설정
- Kakao REST/AuthSession redirect URI 전략 유지 또는 `nika.it.kr` HTTPS callback 구현
- Kakao OpenID Connect 사용
- Kakao Client Secret 사용
- Kakao Admin Key/API 사용
- Kakao 친구 API, social graph, message/share API
- 신규 account-link UX 추가
- provider unlink
- 모든 기기 로그아웃
- 계정 삭제 (#12)
- production App Store 제출
- production/staging Kakao 앱 분리
- Kakao Native App Key 또는 scheme 값을 git/GitHub/spec에 기록하는 것

## UX / UI Requirements

### Screens

- `apps/mobile/app/login.tsx`
  - 기존 `Kakao로 계속하기` 버튼을 유지한다.
  - 버튼 label, layout, provider color token 사용 방식을 임의로 바꾸지 않는다.
  - Kakao Native SDK 호출 중에는 기존 loading state를 사용한다.
- `apps/mobile/app/account.tsx`
  - 기존 `Kakao 연결` path가 shared credential adapter 변경으로 깨지지 않아야 한다.
  - Issue #7은 새로운 account-link UX를 추가하지 않는다.

### States

- Loading: 사용자가 `Kakao로 계속하기`를 누르면 기존 `로그인 중...` loading state를 보여준다.
- Success: Kakao Native SDK login + API login 성공 후 authenticated app 화면으로 이동한다.
- Cancel: 사용자가 Kakao SDK login을 취소하면 기존 generic login failure copy를 보여준다. 별도 cancellation UX는 추가하지 않는다.
- Error: Kakao SDK/provider/API error는 기존 error state로 매핑한다.
- Conflict: API가 `ACCOUNT_LINK_REQUIRED`를 반환하면 기존 conflict guidance를 보여준다.
- Logout: logout 후 login screen으로 돌아간다.

### Copy / Labels

- Kakao login button: `Kakao로 계속하기`
- Loading: `로그인 중...`
- Invalid provider token: `로그인 정보를 확인할 수 없어요. 다시 시도해주세요.`
- Generic failure: `로그인에 실패했어요. 다시 시도해주세요.`
- Email conflict guidance: `이미 같은 이메일로 가입한 계정이 있어요. 기존 계정으로 로그인한 뒤 이 로그인 방법을 연결해주세요.`
- Existing account link CTA: `기존 계정으로 로그인`
- Account link success copy remains existing copy: `로그인 방법이 연결되었습니다.`

### Design Guardrails

- 기존 로그인/account 화면 구조를 유지한다.
- 화면 코드에 raw hex color, arbitrary spacing/radius 값을 추가하지 않는다.
- Kakao provider color가 필요하면 `apps/mobile/lib/design/theme.ts`의 provider token을 재사용하거나 token을 먼저 추가한다.
- Native provider integration 때문에 불필요한 UI refactor를 하지 않는다.

## API Contract

No API changes expected.

F-007은 기존 F-005 auth contract를 재사용한다.

### Endpoints

```text
POST /auth/oauth/login
GET /auth/me
POST /auth/token/refresh
POST /auth/logout
POST /auth/oauth/link
```

### Kakao Login Request

앱은 Kakao Native SDK에서 받은 access token을 기존 credential shape로 전달한다.

```json
{
  "provider": "kakao",
  "credential": {
    "accessToken": "<kakao-access-token>"
  },
  "device": {
    "platform": "ios"
  }
}
```

### Successful Login Response

기존 `login_success` response를 사용한다.

```json
{
  "result": "login_success",
  "user": {
    "id": "<user-id>",
    "displayName": "<display-name>",
    "email": "<email-or-null>",
    "emailVerified": true
  },
  "tokens": {
    "accessToken": "<jwt>",
    "refreshToken": "<refresh-token>",
    "expiresIn": 900
  }
}
```

### Errors

공통 에러 포맷을 따른다.

- Invalid Kakao token or dev OAuth attempt on staging:

```json
{
  "error": {
    "code": "INVALID_PROVIDER_TOKEN",
    "message": "invalid provider token",
    "details": []
  }
}
```

- Verified email belongs to another existing i-um user and Kakao identity is not linked:

```json
{
  "error": {
    "code": "ACCOUNT_LINK_REQUIRED",
    "message": "account link required",
    "details": [
      {
        "result": "link_required_conflict",
        "provider": "kakao"
      }
    ]
  }
}
```

## DB Changes

No DB changes.

F-007 reuses the F-005 auth tables:

- `users`
- `auth_identities`
- `auth_sessions`

No migration is expected. If implementation discovers a required schema change, update this spec before coding the migration.

## Environment / Configuration

### Kakao Developers

Manual setup status for this feature:

- Kakao app name: `이음(i-um)`
- Kakao app ID: `1493314`
- Kakao Login: enabled
- OIDC: disabled
- iOS Bundle ID: `com.twotwobread.ium.staging`
- Required consent items:
  - profile information
  - nickname
  - account email
- Test account: owner Kakao account
- Native app scheme: generated by Kakao in the form `kakao{Native App Key}`

Do not put Kakao Admin Key, Client Secret, raw tokens, Kakao password, or the actual Native App Key value in GitHub, git, or issue comments.

### API / Staging Runtime

Required:

```text
AUTH_TOKEN_SECRET=<secret-manager-value>
AUTH_ALLOW_DEV_OAUTH=false 또는 unset
```

Optional/unchanged for Apple compatibility:

```text
APPLE_CLIENT_ID=com.twotwobread.ium.staging
```

Rules:

- `AUTH_TOKEN_SECRET` must be injected through Secret Manager or equivalent secure env handling.
- `AUTH_ALLOW_DEV_OAUTH` must be false or unset on public staging/prod.
- Staging DB must be migrated through F-005 auth migration version or later.

### Mobile / EAS Preview Internal Build

Required:

```text
EXPO_PUBLIC_API_BASE_URL=<staging-cloud-run-url-or-approved-staging-domain>
EXPO_PUBLIC_AUTH_DEV_MODE=false
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=<kakao-native-app-key-without-kakao-prefix>
```

Expected native scheme derived by app config:

```text
kakao${EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY}
```

Implementation notes:

- Convert `apps/mobile/app.json` to an Expo config file if needed so iOS native config can be derived from build-time env without committing the key.
- Configure iOS URL scheme and any SDK-required `Info.plist` values through Expo config/config plugin.
- Remove Kakao login dependency on `EXPO_PUBLIC_KAKAO_REST_API_KEY` for the native iOS flow.
- If the selected Kakao SDK wrapper requires the scheme value directly instead of the raw Native App Key, document the env name and do not commit the value.

## Business Rules

- Kakao provider subject is the durable external identity.
- If Kakao provider subject is already linked, login returns the existing i-um user.
- If Kakao provider subject is not linked but Kakao returns a verified email matching another user, unauthenticated login is blocked with `ACCOUNT_LINK_REQUIRED` / `link_required_conflict` guidance.
- i-um does not auto-merge users by email.
- A new i-um user is created only when the Kakao provider subject is not linked and no verified-email conflict exists.
- Kakao account email is expected to be provided and verified in the manual smoke account because Kakao consent is required, but missing/unverified email does not itself block login if provider subject is valid under existing F-005 rules.
- Missing/unverified email means verified-email conflict detection cannot run; record as a verification finding only if observed.
- KakaoTalk app installation is not required. Native SDK login must fall back to Kakao account/web login if KakaoTalk is unavailable.
- Logout revokes the current i-um session and clears local app auth state.
- Logout also clears app-local Kakao SDK token/session when the SDK supports it.
- Logout must not unlink the Kakao provider identity and must not globally log out of KakaoTalk.
- Public staging/prod must reject dev OAuth credential attempts.

## Acceptance Criteria

- [ ] `docs/features/0007-kakao-login.md` exists and records the Ouroboros source, scope, regression plan, TDD plan, and verification plan for #7.
- [ ] Kakao Login implementation uses Kakao Native SDK on iOS instead of `expo-auth-session` redirect URI for real provider login.
- [ ] iOS build config derives or injects the Kakao native app key/scheme without committing the actual key value.
- [ ] `Kakao로 계속하기` succeeds on iOS internal build when KakaoTalk is installed.
- [ ] `Kakao로 계속하기` succeeds through Kakao account/web fallback when KakaoTalk is unavailable or not usable.
- [ ] Successful Kakao SDK login passes a Kakao access token to existing `/auth/oauth/login` with `provider: kakao`.
- [ ] API returns `login_success` and creates or returns the internal i-um user/session.
- [ ] `GET /auth/me` after login returns the current user and `linkedProviders` includes `kakao`.
- [ ] App restart keeps the user logged in through existing stored refresh/session flow.
- [ ] Logout revokes the current i-um session, clears local auth state, clears app-local Kakao SDK token/session if available, and returns to login screen.
- [ ] Existing conflict behavior is preserved: verified-email conflict blocks unauthenticated login with `ACCOUNT_LINK_REQUIRED` guidance and does not auto-merge accounts.
- [ ] Existing authenticated provider-link path is not broken by the Kakao credential adapter change.
- [ ] Public staging rejects a dev OAuth Kakao login attempt with `INVALID_PROVIDER_TOKEN` while `AUTH_ALLOW_DEV_OAUTH=false` or unset.
- [ ] Staging/internal verification commands, results, and iOS internal build link are recorded in the completion report or this spec's verification record.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| Kakao native adapter returns `{ accessToken }` on SDK success | Mobile auth adapter | `apps/mobile/lib/auth/*.test.mts` or equivalent new test file | `pnpm --filter @i-um/mobile test` |
| Kakao native adapter attempts KakaoTalk login and falls back to Kakao account/web login when KakaoTalk is unavailable | Mobile auth adapter | `apps/mobile/lib/auth/*.test.mts` or equivalent new test file | `pnpm --filter @i-um/mobile test` |
| Kakao cancel/provider failure maps to existing login error state and does not persist partial auth state | Mobile auth state/helper | `apps/mobile/lib/auth/*.test.mts` or equivalent new test file | `pnpm --filter @i-um/mobile test` |
| Logout calls i-um logout/local auth clearing and clears app-local Kakao SDK token/session when available | Mobile auth adapter/session | `apps/mobile/lib/auth/*.test.mts` or equivalent new test file | `pnpm --filter @i-um/mobile test` |
| Account screen provider-link path can still obtain Kakao credentials through the shared adapter | Mobile auth adapter/state | `apps/mobile/lib/auth/*.test.mts` or existing account flow helper test if extracted | `pnpm --filter @i-um/mobile test` |
| Mobile code typechecks with native SDK typings/config changes | Mobile typecheck | `apps/mobile` typecheck gate | `pnpm --filter @i-um/mobile typecheck` |
| Kakao access token login creates/returns user/session and existing Kakao identity logs into same user | API auth service/server | Existing `apps/api/internal/auth/service_test.go`, `apps/api/internal/server/server_test.go`; add targeted test only if API code changes or coverage gap is found | `pnpm --filter @i-um/api test` |
| Verified-email conflict returns `ACCOUNT_LINK_REQUIRED` and does not auto-merge | API auth service/server | Existing auth service/server tests; add/adjust if current coverage is insufficient | `pnpm --filter @i-um/api test` |
| `/auth/me`, refresh, and logout behavior remain compatible after Kakao login | API/mobile integration boundaries | Existing API auth tests and mobile auth client tests if present; add missing helper tests only for changed code | `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/mobile test` |
| OpenAPI/generated contract has no drift | Contract gate | generated drift gate | `pnpm verify:generated` |
| Full project regression remains green | Full gate | repository verification gate | `pnpm verify` |

## Regression Gaps

- Real Kakao Native SDK provider UI, KakaoTalk handoff, Kakao account/web login, and consent screen cannot be fully automated in the current unit test harness.
  - Risk: Native iOS configuration, Kakao console setup, or provider UI regressions may only be caught in internal build smoke.
  - Follow-up: Not split; F-007 manual smoke must record build link, device, account mode, and result before Done.
- EAS iOS internal build credential creation depends on Apple Developer Program/EAS managed credential readiness.
  - Risk: Implementation may be code-complete but final device smoke blocked by external account approval.
  - Follow-up: Record as blocked verification if approval/credentials are unavailable; do not enable dev OAuth as a substitute.

## TDD Implementation Plan

1. Red: Mobile auth adapter tests
   - Add tests around a mockable Kakao native SDK boundary for success, KakaoTalk-unavailable fallback, cancellation/error, missing access token, and logout SDK session clearing.
   - Verify: `pnpm --filter @i-um/mobile test` fails because the Kakao native adapter/config does not exist yet.
2. Green: Minimal Kakao Native SDK integration
   - Add an Expo/EAS-compatible Kakao Native SDK dependency or wrapper.
   - Add the smallest adapter that calls the SDK, handles KakaoTalk fallback, returns `{ accessToken }`, and exposes SDK logout/session clear.
   - Update `getOAuthCredential('kakao')` to use the adapter when `EXPO_PUBLIC_AUTH_DEV_MODE !== 'true'`.
   - Verify: `pnpm --filter @i-um/mobile test` passes for adapter behavior.
3. Red: Native app config/env validation
   - Add tests or config helper checks that fail when native app key/scheme env is missing for non-dev Kakao login.
   - Verify: `pnpm --filter @i-um/mobile test` or `pnpm --filter @i-um/mobile typecheck` fails before config helper is wired.
4. Green: App config and env plumbing
   - Convert `apps/mobile/app.json` to Expo config if required.
   - Inject Kakao native app key/scheme into iOS config without committing the actual value.
   - Document EAS preview env setup.
   - Verify: `pnpm --filter @i-um/mobile typecheck` passes.
5. Red/Green: Preserve login, conflict, account-link, and logout app states
   - Add or update mobile helper/state tests only where code changes create testable behavior.
   - Keep existing copy and UI structure.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
6. API regression check
   - Run existing API tests for login, account link conflict, `/auth/me`, refresh, and logout.
   - Add targeted API/provider verifier test only if implementation touches API code or reveals missing coverage needed to protect changed behavior.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
7. Contract/generated check
   - Since no OpenAPI change is expected, verify no generated drift.
   - Verify: `pnpm verify:generated` passes.
8. Refactor
   - Keep provider-specific native SDK details inside the auth adapter/config boundary.
   - Remove obsolete Kakao REST/AuthSession code only if it is no longer used by Apple or other flows.
   - Verify: rerun targeted mobile/API tests.
9. Regression gate
   - Verify: `pnpm verify` passes.
10. Staging/internal smoke
   - Configure staging/EAS env.
   - Build/install iOS internal build.
   - Run real Kakao login, session persistence, logout, and dev OAuth disabled checks.
   - Verify: record command results and build link.

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

### Staging API Smoke

```bash
CLOUD_RUN_URL="<staging-cloud-run-url>"

curl -i "$CLOUD_RUN_URL/health"
curl -i "$CLOUD_RUN_URL/ready"

curl -i -X POST "$CLOUD_RUN_URL/auth/oauth/login" \
  -H 'Content-Type: application/json' \
  -d '{"provider":"kakao","credential":{"devSubject":"should-fail"}}'
# expected: 401 INVALID_PROVIDER_TOKEN
```

### EAS / Internal Build Setup

Required EAS preview env values:

```text
EXPO_PUBLIC_API_BASE_URL=<staging-cloud-run-url-or-approved-staging-domain>
EXPO_PUBLIC_AUTH_DEV_MODE=false
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=<kakao-native-app-key-without-kakao-prefix>
```

Example commands, run from `apps/mobile`:

```bash
npx eas-cli@latest env:create \
  --environment preview \
  --name EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY \
  --value "<kakao-native-app-key-without-kakao-prefix>" \
  --visibility plaintext

npx eas-cli@latest build --profile preview --platform ios
```

Use interactive mode if EAS needs to create/select iOS credentials or register a test device.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Install iOS internal build on test iPhone.
- [ ] Confirm app points to staging API and dev auth mode is off.
- [ ] Tap `Kakao로 계속하기` with KakaoTalk installed and complete login/consent.
- [ ] Confirm app reaches authenticated state.
- [ ] Confirm `/auth/me` current user includes linked provider `kakao`.
- [ ] Confirm expected email/verified state from owner Kakao account is returned if visible in API response/log-safe verification.
- [ ] Kill/reopen app and confirm session remains through refresh flow.
- [ ] Logout and confirm login screen.
- [ ] Tap `Kakao로 계속하기` again and confirm SDK requests a fresh provider token rather than reusing a stale app-local token. KakaoTalk/web SSO may still avoid password entry.
- [ ] If possible, test Kakao account/web fallback by using a device/path where KakaoTalk login is unavailable.
- [ ] Record EAS build link, device, staging API URL, commands, results, and any blocked steps.

## Release Notes

```text
- iOS internal build에서 Kakao Native SDK 기반 실제 Kakao Login을 사용할 수 있게 한다.
- Kakao 로그인 후 기존 i-um auth session, refresh, /auth/me, logout 흐름과 연결된다.
- public staging에서 dev OAuth가 비활성화되어 실제 provider 검증만 허용된다.
```

## Open Questions

- None.

## Follow-up Issues

- #6: Sign in with Apple 실제 provider 연결 및 internal build 검증
- #12: 계정 삭제
- Future: Android Kakao Login 검증 및 Android platform/package 설정
- Future: production/staging Kakao 앱 분리 여부 결정

## Verification Record

Implementation completion must fill this section or include equivalent details in the completion report.

### Automated Regression Results

- `pnpm --filter @i-um/mobile test`: pass on 2026-06-23; covers Kakao Native SDK adapter success, KakaoTalk-unavailable fallback, cancellation/provider failure propagation, missing access token, native app key/scheme validation, and best-effort Kakao SDK logout clearing.
- `pnpm --filter @i-um/mobile typecheck`: pass on 2026-06-23.
- `pnpm --filter @i-um/api test`: pass on 2026-06-23; includes handler regression that rejects Kakao `devSubject` login with `INVALID_PROVIDER_TOKEN` when `AUTH_ALLOW_DEV_OAUTH` / `AllowDevOAuth` is false.
- `pnpm --filter @i-um/api build`: pass on 2026-06-23.
- `pnpm verify:generated`: pass on 2026-06-23.
- `pnpm verify`: pass on 2026-06-23.
- `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=dummy-native-key pnpm --filter @i-um/mobile exec expo config --type public --json`: pass on 2026-06-23; confirms dynamic config loads with the Kakao native plugin and staging bundle id.

### Staging / Internal Build Results

- Staging API URL: TBD
- `/health`: not run; staging URL was not provided in this implementation environment.
- `/ready`: not run; staging URL was not provided in this implementation environment.
- Dev OAuth disabled check: not run; staging URL was not provided in this implementation environment.
- EAS iOS internal build link: TBD; not run because the Kakao native app key, EAS credentials, and device/build access are not available in this implementation environment.
- Device smoke: not run; requires iOS internal build and owner Kakao account/device.
- Notes/blockers: Code-level implementation and automated regression checks are complete. Final Done still requires staging/internal manual smoke or an explicit blocked verification record with the actual staging/build constraints.
