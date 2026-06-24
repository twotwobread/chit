# Feature Slice: F-006 Sign in with Apple 실제 provider 연결 및 internal build 검증

## Metadata

- GitHub Issue: #6
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-24
- Updated: 2026-06-24

## Readiness / Status Gate

- Ouroboros clarification completed with ambiguity score `0.069` (`0.07` rounded in interview output).
- Implementation must not start until this spec is reviewed and approved.
- Apple manual setup is tracked by #69 and remains a prerequisite for real-device smoke.
- If Apple Developer Program, Sign in with Apple capability, EAS iOS credentials, or a test device Apple ID are not ready at implementation time, record the smoke as blocked; do not enable dev OAuth on public staging as a substitute.

## Source

- Issue: #6 — https://github.com/twotwobread/i-um/issues/6
- Dependency: #69 — Apple/Kakao OAuth provider manual setup umbrella
- Ouroboros Interview Session: `interview_20260624_131658`
- Ouroboros Seed: `seed_5f564d3df16b`
- PM Document: N/A
- Notes: Ouroboros clarified that F-006 should add real Apple login for the iOS internal staging path while introducing only the minimum OAuth provider abstraction needed now. The mobile login/link provider registry must be separate from the F-009 logout cleanup registry, and Apple must never silently fall back to Kakao or dev OAuth.

Context verified before drafting:

- `packages/api-contract/openapi.yaml` already defines `AuthProvider` values `apple` and `kakao`, `OAuthCredential`, `POST /auth/oauth/login`, `POST /auth/oauth/link`, `GET /auth/me`, refresh, and logout.
- `apps/mobile/lib/auth/oauth.ts` currently uses `if provider === 'apple' ... else Kakao`, which creates an implicit unsupported-provider-to-Kakao fallback. F-006 must remove this pattern.
- `apps/mobile/app/login.tsx` and `apps/mobile/app/account.tsx` currently hard-code provider labels/styles/order in screen code.
- `apps/api/internal/auth/provider.go` currently dispatches provider verification with a `switch` over Apple/Kakao; F-006 should move this toward a verifier registry/map or equivalent seam.
- `apps/mobile/lib/auth/provider-cleanup.ts` already owns F-009 best-effort logout cleanup and currently registers Kakao cleanup. F-006 login/link provider metadata must not be merged into that cleanup registry.

## Goal

사용자가 iOS internal build에서 `Apple로 계속하기`를 눌러 실제 Sign in with Apple을 완료하고, 기존 F-005 인증 모델의 내부 `User`, `auth_identity`, `auth_session`이 생성 또는 재사용되는 것을 검증한다.

동시에 Kakao 기반 구현을 유지하면서 Apple과 향후 OAuth provider를 추가하기 쉬운 최소 추상화를 도입한다. 핵심은 provider-specific credential acquisition, UI label/style metadata, server-side verifier dispatch를 한 곳의 registry/strategy boundary로 모으고, unsupported provider를 Kakao로 fallback하지 않는 것이다.

## Problem

- 현재 모바일 credential acquisition은 Apple이 아니면 Kakao로 처리하는 fallback 형태라서 provider가 늘어날수록 안전하지 않다.
- Login/account 화면에는 provider label/style/linked-state copy가 흩어져 있어 Apple/Kakao 또는 미래 provider의 UI가 쉽게 diverge할 수 있다.
- API provider verification도 provider-specific branch가 core flow에 계속 추가될 위험이 있다.
- Sign in with Apple은 실제 iOS capability/EAS credential/staging env가 맞아야 검증되므로, automated regression과 manual smoke 범위를 명확히 분리해야 한다.
- public staging에서 dev OAuth가 켜지면 실제 provider 검증 결과를 신뢰할 수 없다.

## User Flow

### New or returning Apple login

1. 사용자가 iOS internal build를 설치하고 앱을 연다.
2. 앱은 public staging API를 바라보고 `EXPO_PUBLIC_AUTH_DEV_MODE=false` 상태로 실행된다.
3. 로그인 화면은 shared login/link provider registry에서 Apple/Kakao provider metadata를 읽어 기존 순서인 Apple → Kakao로 표시한다.
4. 사용자가 `Apple로 계속하기`를 누른다.
5. Apple provider credential adapter가 `expo-apple-authentication` availability를 확인하고 Apple sign-in sheet를 연다.
6. 사용자가 Apple 인증을 완료한다.
7. 앱은 Apple `identityToken`과, 있을 경우 `authorizationCode`, `email`, `emailVerified`, `displayName` snapshot을 기존 `/auth/oauth/login`에 `provider: apple`로 보낸다.
8. API Apple verifier는 identity token의 issuer, configured audience, expiry, subject, RS256 signature/JWKS를 검증한다.
9. API는 verified Apple subject를 provider identity key로 사용해 기존 Apple identity가 있으면 해당 user/session을 반환하고, 없으면 기존 F-005 flow로 user/identity/session을 생성한다.
10. 앱은 로그인 성공 후 authenticated 화면으로 이동한다.
11. 앱은 `/auth/me` 또는 refresh-backed current user flow에서 current user와 linked provider `apple`을 확인한다.
12. 앱 종료/재실행 후에도 저장된 refresh/session flow로 로그인 상태가 유지된다.
13. 사용자가 로그아웃하면 F-009 logout flow를 통해 현재 i-um session/local state가 정리되고 login screen으로 돌아간다.

### Apple account linking from account screen

1. 이미 로그인한 사용자가 account screen을 연다.
2. 화면은 같은 shared login/link provider registry에서 provider list, label, linked-state copy, availability, credential adapter metadata를 읽는다.
3. Apple이 아직 연결되지 않았으면 `Apple 연결` action을 표시한다.
4. 사용자가 Apple 연결을 누르면 Apple credential adapter가 login flow와 같은 방식으로 credential을 얻는다.
5. 앱은 기존 `/auth/oauth/link`에 `provider: apple` credential을 보낸다.
6. API는 verified Apple subject가 다른 user에 이미 연결되어 있으면 기존 `PROVIDER_ALREADY_LINKED` contract를 반환한다.
7. 새 Apple identity이면 현재 authenticated user에 연결한다.
8. 연결된 후 account screen은 기존 pattern대로 disabled linked state와 shared label 기반 `Apple 연결됨` copy를 보여준다.

### Unsupported/unavailable Apple path

1. Apple이 지원되지 않는 platform/build/device에서 Apple provider가 registry availability에 의해 숨겨지거나 disabled될 수 있다.
2. Apple adapter가 직접 호출되더라도 explicit unavailable/unsupported error로 실패해야 한다.
3. 이 실패는 Kakao credential acquisition, dev OAuth credential, 또는 다른 provider request로 대체되면 안 된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App Auth: login/link 전용 shared OAuth provider registry/config 도입
  - provider id
  - shared label
  - login button label 또는 label builder
  - linked-state copy 또는 label builder
  - button styling metadata using theme provider tokens
  - availability/gating
  - credential adapter
- [ ] App Auth: `getOAuthCredential(provider)`가 registry lookup으로 credential adapter를 선택하고 unsupported provider는 explicit error로 실패
- [ ] App Auth: 현재 `apple else Kakao` fallback 제거
- [ ] App Auth: Apple credential adapter가 `identityToken`을 필수 token으로 획득하고 optional snapshot fields를 pass-through
- [ ] App Auth: Kakao credential adapter를 같은 interface의 첫 concrete native provider adapter로 유지
- [ ] App UI: login screen이 provider labels/order/styles/credential action을 shared registry metadata에서 가져오도록 정리
- [ ] App UI: account screen provider-link UI가 login과 같은 provider registry metadata를 사용하고 existing linked presentation을 유지
- [ ] App UI: Apple provider는 iOS internal/staging-capable path에서 노출/활성화되며 unsupported path에서는 registry availability로 hide/disable 가능
- [ ] API Contract: 기존 OpenAPI `/auth/oauth/login`, `/auth/oauth/link`, `/auth/me`, refresh, logout contract 재사용. OpenAPI 변경 없음이 기본값
- [ ] API Server: Apple identity token verifier를 provider verifier registry/map 또는 equivalent strategy boundary로 분리
- [ ] API Server: API verifier registry는 mobile provider registry와 독립이며 API contract의 provider id만 공유
- [ ] API Server: Apple verifier가 issuer/audience/expiry/subject/signature/JWKS validation을 수행
- [ ] API Server: 기존 auth service login/link/user/session behavior와 error contract 유지
- [ ] DB: 기존 `users`, `auth_identities`, `auth_sessions` schema 재사용. DB migration 없음
- [ ] Tests: mobile registry/no-fallback/Apple adapter/Kakao regression/account-link metadata tests 추가 또는 보강
- [ ] Tests: API verifier registry dispatch, Apple token validation, service login/link identity matching/conflict tests 추가 또는 보강
- [ ] Deployment: staging API env와 EAS preview/internal env를 실제 provider 검증용으로 설정
- [ ] Verification: iOS internal build에서 real Sign in with Apple, `/auth/me`, restart persistence, logout, dev OAuth disabled smoke 결과 기록

Scope control: 이 spec은 GitHub Issue #6에 한정한다. Provider abstraction은 Apple 추가 시 provider-specific 변경 지점을 줄이는 최소 추상화이며, future provider framework 전체 구현이 아니다.

## Out of Scope

- Kakao Login 실제 provider 검증 (#7)
- 계정 삭제 (#12)
- provider unlink
- 모든 기기 로그아웃
- production App Store 제출
- production Apple client id/service id 구성
- multi-environment Apple config expansion
- Apple private key, client secret, server-side authorization-code exchange
- Apple refresh token handling
- Apple provider token revoke 고도화
- Apple profile/email backfill 또는 provider profile resync
- Android Sign in with Apple behavior
- 신규 account-link UX redesign
- F-009 logout provider cleanup registry 통합 또는 재설계
- Kakao Native SDK behavior 변경 beyond shared adapter interface compatibility

## Requirements

### UI / UX

#### Screens

- `apps/mobile/app/login.tsx`
  - Provider buttons are rendered from the shared login/link provider registry where practical.
  - Supported provider order remains Apple then Kakao wherever both are shown.
  - `Apple로 계속하기` and `Kakao로 계속하기` labels come from shared provider metadata or label builders.
  - Provider styling uses `apps/mobile/lib/design/theme.ts` tokens such as `theme.providerColor.appleBg`, `appleText`, `kakaoBg`, `kakaoText`; do not add raw colors in screen code.
  - Loading state reuses existing `로그인 중...` copy.
  - Apple unavailable/unsupported adapter errors use an existing appropriate error state/copy; exact mobile error taxonomy is implementation detail, but fallback is forbidden.
- `apps/mobile/app/account.tsx`
  - Provider link actions are rendered from the same shared login/link provider registry where practical.
  - Linked state reuses the existing disabled presentation.
  - Linked copy is derived from shared provider label, e.g. `Apple 연결됨`, `Kakao 연결됨`.
  - Unlinked actions use shared label-derived copy, e.g. `Apple 연결`, `Kakao 연결`.
  - Do not add a new account-link UX or provider management flow in this slice.

#### States

- Ready: Apple button/action is enabled on the iOS internal/staging-capable path.
- Unavailable/unsupported: Apple may be hidden/disabled by registry availability. If invoked anyway, adapter fails explicitly and does not call Kakao/dev credential paths.
- Loading: Existing login/link loading handling is reused.
- Success: Login navigates to authenticated app; link updates account screen and shows existing success copy `로그인 방법이 연결되었습니다.`.
- Invalid provider token: Existing copy `로그인 정보를 확인할 수 없어요. 다시 시도해주세요.` is reused.
- Email conflict: Existing `ACCOUNT_LINK_REQUIRED` guidance is reused.
- Provider already linked: Existing `PROVIDER_ALREADY_LINKED` account-link copy is reused.

#### Copy / Labels

- Login button: `Apple로 계속하기`
- Account unlinked action: `Apple 연결`
- Account linked state: `Apple 연결됨`
- Loading: `로그인 중...`
- Invalid provider token: `로그인 정보를 확인할 수 없어요. 다시 시도해주세요.`
- Generic failure: `로그인에 실패했어요. 다시 시도해주세요.`
- Account link success: `로그인 방법이 연결되었습니다.`
- Account link provider already linked: `이미 다른 계정에 연결된 로그인 방법입니다.`

### Mobile Provider Abstraction

Minimum shared login/link provider registry contract:

```ts
type LoginLinkProviderConfig = {
  id: AuthProvider;
  label: string;
  order: number;
  availability: () => ProviderAvailability;
  buttonStyle: ProviderButtonStyleKeyOrTokens;
  loginLabel: () => string;
  linkLabel: (linked: boolean) => string;
  getCredential: () => Promise<OAuthCredential>;
};
```

Implementation may choose exact TypeScript names/shapes, but it must satisfy these invariants:

- Login and account-link entry points use the same provider config source for provider order, labels, linked-state copy, styling metadata, availability/gating, and credential adapter selection.
- `getOAuthCredential(provider)` performs a registry lookup by provider id.
- Unsupported provider id returns an explicit unsupported-provider error.
- Apple unavailable/unsupported device/build returns an explicit unavailable/provider error.
- Unsupported/unavailable provider paths never fallback to Kakao, dev OAuth, or another provider.
- Dev OAuth remains controlled only by explicit `EXPO_PUBLIC_AUTH_DEV_MODE=true` on mobile and `AUTH_ALLOW_DEV_OAUTH=true` on API; public staging uses false/unset.
- Kakao remains a concrete adapter under the same interface and its existing native SDK behavior remains covered.
- This registry is for login/link credential acquisition and UI metadata only. It must not include logout cleanup semantics.
- F-009 logout cleanup remains in `apps/mobile/lib/auth/provider-cleanup.ts` or equivalent separate cleanup registry.

### Apple Credential Adapter

- The adapter uses `expo-apple-authentication` for real iOS Apple sign-in.
- `identityToken` is required for API login/link.
- Missing `identityToken` is an adapter error and must not submit another provider.
- `authorizationCode` may be passed through when present but is not exchanged server-side in F-006.
- `email`, `emailVerified`, and full-name-derived `displayName` may be passed through when present.
- Optional snapshot fields are non-authoritative and missing values must not block login/link.
- No Apple private key, client secret, raw identity token, authorization code, Apple account password, or 2FA code may be committed, logged, or pasted into issue/chat/spec verification records.

### API Contract

No API changes expected.

F-006 reuses the existing F-005/F-008 auth contract:

```text
POST /auth/oauth/login
POST /auth/oauth/link
GET /auth/me
POST /auth/token/refresh
POST /auth/logout
```

#### Apple Login Request

```json
{
  "provider": "apple",
  "credential": {
    "identityToken": "<apple-identity-token>",
    "authorizationCode": "<optional-authorization-code>",
    "email": "<optional-email>",
    "emailVerified": true,
    "displayName": "<optional-display-name>"
  },
  "device": {
    "platform": "ios"
  }
}
```

Only `identityToken` is required for F-006 Apple verification. Other fields are optional snapshots.

#### Successful Login Response

Existing `AuthLoginResponse` with `result: login_success` is used.

#### Account Link Request

```json
{
  "provider": "apple",
  "credential": {
    "identityToken": "<apple-identity-token>"
  }
}
```

Requires bearer auth as defined by the existing `/auth/oauth/link` contract.

#### Errors

Common error format is preserved.

- Missing/invalid Apple token, invalid audience/signature/expiry, Apple verifier failure, or dev credential attempt while `AUTH_ALLOW_DEV_OAUTH=false`:

```json
{
  "error": {
    "code": "INVALID_PROVIDER_TOKEN",
    "message": "invalid provider token",
    "details": []
  }
}
```

- Verified email belongs to another existing i-um user and Apple provider subject is not linked:

```json
{
  "error": {
    "code": "ACCOUNT_LINK_REQUIRED",
    "message": "account link required",
    "details": [
      {
        "result": "link_required_conflict",
        "provider": "apple"
      }
    ]
  }
}
```

- Apple provider identity already linked to another user during authenticated link:

```json
{
  "error": {
    "code": "PROVIDER_ALREADY_LINKED",
    "message": "provider identity is already linked",
    "details": [
      {
        "result": "provider_already_linked",
        "provider": "apple"
      }
    ]
  }
}
```

### API Provider Verification

Server-side verifier abstraction requirements:

- API provider verification is separate from the mobile login/link provider registry.
- The only cross-boundary provider identifier is the `provider` string from the API contract.
- Provider-specific verification lives behind a provider verifier registry/map/strategy keyed by `auth.Provider` or equivalent.
- Core login/link service flow must not grow provider-specific verification branches for each future provider.
- Apple verifier validates:
  - token is present and non-empty
  - JWT format is valid
  - header algorithm is `RS256`
  - Apple issuer is `https://appleid.apple.com`
  - `aud` equals configured `APPLE_CLIENT_ID` for staging (`com.twotwobread.ium.staging`)
  - `exp` is in the future
  - `sub` is present and non-empty
  - signature validates against Apple JWKS
- Exact JWKS caching/retry behavior is not pinned in F-006. Caching may be a later optimization.
- Missing config or failed validation maps to `INVALID_PROVIDER_TOKEN`.
- Do not log raw identity tokens, authorization codes, provider subjects, or emails in error logs.

### DB Changes

No DB changes.

F-006 reuses existing auth tables:

- `users`
- `auth_identities`
- `auth_sessions`

No migration or sqlc query change is expected. If implementation discovers a required schema change, update this spec before coding the migration.

### Environment / Configuration

#### Apple Developer / EAS Manual Setup (#69)

Required before real-device smoke:

- Apple Developer Program active
- Apple Developer Team access confirmed
- Bundle ID `com.twotwobread.ium.staging` confirmed
- Sign in with Apple capability enabled for the staging Bundle ID
- EAS iOS internal build credentials ready or agent authorized to create/select them interactively
- Test device signed in with Apple ID

Agent needs, but must not publish secrets:

- Apple Developer Team ID
- staging bundle id confirmation
- Whether EAS credentials may be created/selected interactively

Never share:

- Apple private key
- Apple client secret
- raw identity/access token
- Apple account password or 2FA code

#### API / Staging Runtime

Required:

```text
AUTH_TOKEN_SECRET=<secret-manager-value>
APPLE_CLIENT_ID=com.twotwobread.ium.staging
AUTH_ALLOW_DEV_OAUTH=false
```

Optional compatibility:

```text
APPLE_BUNDLE_ID=com.twotwobread.ium.staging
```

Rules:

- `AUTH_TOKEN_SECRET` must be injected through Secret Manager or equivalent secure env handling.
- `AUTH_ALLOW_DEV_OAUTH` must be false or unset on public staging/prod.
- Staging DB must include F-005 auth migrations.

#### Mobile / EAS Preview Internal Build

Required:

```text
EXPO_PUBLIC_API_BASE_URL=<staging-cloud-run-url-or-approved-staging-domain>
EXPO_PUBLIC_AUTH_DEV_MODE=false
```

Rules:

- Do not use dev OAuth for public staging/internal provider smoke.
- Apple capability and EAS iOS credentials are platform setup, not runtime secrets in this spec.
- Existing Kakao env remains controlled by #7 and should not be changed for Apple verification except where needed for shared registry compatibility.

### Business Rules

- Verified Apple subject (`sub`) is the durable external identity key for provider `apple`.
- If an `apple` identity already exists for the verified subject, login returns the existing i-um user and creates a new i-um session.
- If no `apple` identity exists, unauthenticated login creates a new i-um user/identity/session unless existing verified-email conflict rules block signup.
- If no `apple` identity exists and a verified Apple email matches another existing i-um user, login returns existing `ACCOUNT_LINK_REQUIRED` conflict and does not auto-merge users.
- Verified-email conflict detection runs only when Apple provides a verified email.
- Missing Apple email, unverified email, or missing display name never blocks login/link.
- Optional Apple email/displayName snapshots may be stored on the identity/user at creation time under existing F-005 semantics, but they are not authoritative for account selection.
- Existing default display name behavior applies when Apple does not provide a display name.
- Authenticated Apple link uses existing `/auth/oauth/link` semantics.
- If Apple subject is linked to the current user, link is idempotent under existing service behavior.
- If Apple subject is linked to another user, link returns `PROVIDER_ALREADY_LINKED`.
- Logout remains F-009 current-session/local cleanup behavior and does not unlink Apple or revoke Apple tokens.
- Public staging/prod must reject dev OAuth credential attempts.
- Unsupported providers and unavailable Apple paths fail explicitly and never fallback to Kakao.

## Acceptance Criteria

- [ ] `docs/features/0006-sign-in-with-apple.md` exists and records the Ouroboros interview, ambiguity score, seed, scope, regression plan, TDD plan, and verification plan for #6.
- [ ] Mobile login/link provider registry is the single source of truth for provider order, labels, linked-state copy, button styling metadata, availability/gating, and credential adapter selection.
- [ ] Login screen and account screen consume shared provider metadata where practical; provider-specific labels are not scattered as `provider === 'apple' ? 'Apple' : 'Kakao'` branches.
- [ ] Supported provider order remains Apple then Kakao wherever both are shown.
- [ ] `getOAuthCredential(provider)` uses registry lookup and returns explicit unsupported/unavailable provider errors instead of falling back to Kakao.
- [ ] Unsupported provider behavior is covered by a mobile unit test.
- [ ] Apple unavailable/unsupported adapter path fails explicitly and never submits Kakao/dev OAuth credentials.
- [ ] Kakao login behavior remains covered after the provider abstraction.
- [ ] Apple credential adapter follows the same credential adapter shape as Kakao and returns `identityToken` plus optional snapshots.
- [ ] Account screen Apple linking uses the existing authenticated `/auth/oauth/link` flow.
- [ ] Account screen shows Apple linked state with existing disabled presentation and shared-label copy.
- [ ] API provider verification has a registry/map/strategy boundary keyed by provider id, separate from mobile provider config.
- [ ] Apple identityToken verification validates issuer, audience, expiry, subject, and RS256 signature/JWKS.
- [ ] Missing/invalid Apple identityToken returns `INVALID_PROVIDER_TOKEN`.
- [ ] Apple login with an existing verified subject returns the existing i-um user/session.
- [ ] Apple login with a new verified subject creates a new i-um user/identity/session using existing F-005 behavior.
- [ ] Missing Apple email/displayName does not block login/link and default display name behavior is preserved.
- [ ] Existing verified-email conflict behavior is preserved when Apple provides a verified email matching another user.
- [ ] Existing `PROVIDER_ALREADY_LINKED` behavior is preserved when Apple identity is linked to another user.
- [ ] `GET /auth/me` after Apple login returns current user and `linkedProviders` includes `apple`.
- [ ] App restart keeps the user logged in through existing stored refresh/session flow.
- [ ] Logout revokes/clears the current i-um session through F-009 behavior and returns to login screen.
- [ ] This slice does not change OpenAPI or DB schema unless this spec is updated first.
- [ ] Staging API has `AUTH_TOKEN_SECRET`, `APPLE_CLIENT_ID=com.twotwobread.ium.staging`, and dev OAuth disabled.
- [ ] iOS internal build is created with Sign in with Apple available.
- [ ] Public staging rejects a dev OAuth Apple login attempt with `INVALID_PROVIDER_TOKEN` while `AUTH_ALLOW_DEV_OAUTH=false` or unset.
- [ ] Staging/internal verification command results and iOS internal build link are recorded before Done.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| Mobile provider registry returns Apple/Kakao in supported order and exposes shared label/link label/style/availability metadata | Mobile auth registry | `apps/mobile/lib/auth/oauth-providers.test.mts` or equivalent | `pnpm --filter @i-um/mobile test` |
| `getOAuthCredential('apple')` and `getOAuthCredential('kakao')` dispatch through registry adapters rather than `if/else` fallback | Mobile auth credential | `apps/mobile/lib/auth/oauth.test.mts` or `oauth-providers.test.mts` | `pnpm --filter @i-um/mobile test` |
| Unsupported provider id fails explicitly and does not call Kakao adapter | Mobile auth credential | `apps/mobile/lib/auth/oauth.test.mts` | `pnpm --filter @i-um/mobile test` |
| Apple unavailable/unsupported adapter path fails explicitly and does not call Kakao/dev credential paths | Mobile Apple adapter | `apps/mobile/lib/auth/apple.test.mts` or `oauth.test.mts` | `pnpm --filter @i-um/mobile test` |
| Apple adapter returns `{ identityToken }` and optional snapshots on successful `expo-apple-authentication` result | Mobile Apple adapter | `apps/mobile/lib/auth/apple.test.mts` or `oauth.test.mts` | `pnpm --filter @i-um/mobile test` |
| Apple adapter rejects missing `identityToken` | Mobile Apple adapter | `apps/mobile/lib/auth/apple.test.mts` or `oauth.test.mts` | `pnpm --filter @i-um/mobile test` |
| Kakao native adapter still returns `{ accessToken }`, fallback behavior still works, and stays under same registry interface | Mobile Kakao adapter regression | `apps/mobile/lib/auth/kakao.test.mts`, `oauth-providers.test.mts` | `pnpm --filter @i-um/mobile test` |
| Login/account provider copy comes from shared metadata or extracted render model rather than hard-coded scattered label branches | Mobile UI/helper | `apps/mobile/lib/auth/oauth-providers.test.mts` or extracted account/login view-model tests | `pnpm --filter @i-um/mobile test` |
| Account link path can obtain Apple and Kakao credentials through the shared registry and preserves linked disabled copy | Mobile auth/link helper | `apps/mobile/lib/auth/oauth-providers.test.mts` or account view-model tests | `pnpm --filter @i-um/mobile test` |
| Mobile code typechecks after registry/refactor/native typings | Mobile typecheck | `apps/mobile` typecheck gate | `pnpm --filter @i-um/mobile typecheck` |
| API verifier registry dispatches Apple/Kakao by provider id and rejects unsupported providers | API auth verifier | `apps/api/internal/auth/provider_test.go` or equivalent | `pnpm --filter @i-um/api test` |
| Apple verifier validates issuer/audience/expiry/subject/signature with fixture JWKS and maps malformed/missing config/token to invalid-provider-token behavior | API auth verifier | `apps/api/internal/auth/provider_test.go` | `pnpm --filter @i-um/api test` |
| Apple existing-subject login returns existing user/session | API auth service | `apps/api/internal/auth/service_test.go` | `pnpm --filter @i-um/api test` |
| Apple new-subject login creates user/identity/session and supports missing email/displayName | API auth service | `apps/api/internal/auth/service_test.go` | `pnpm --filter @i-um/api test` |
| Apple verified-email conflict returns `ACCOUNT_LINK_REQUIRED` and does not auto-merge | API auth service/server | `apps/api/internal/auth/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Apple account link creates identity for current user or returns `PROVIDER_ALREADY_LINKED` when another user owns subject | API auth service/server | `apps/api/internal/auth/service_test.go`, `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Invalid Apple token request maps to common `INVALID_PROVIDER_TOKEN` response | API server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| `/auth/me`, refresh, and logout behavior remain compatible after Apple login | API/mobile auth regression | Existing auth service/server/mobile client tests | `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/mobile test` |
| OpenAPI/generated contract has no drift | Contract gate | generated drift gate | `pnpm verify:generated` |
| Full project regression remains green | Full gate | repository verification gate | `pnpm verify` |

## Regression Gaps

- Real Apple system sign-in sheet, Apple ID account state, Apple Developer capability, and EAS iOS internal credentials cannot be fully automated in the current unit test harness.
  - Risk: Native entitlement, Team ID, Bundle ID, or EAS credential issues may only appear in the installed internal build.
  - Follow-up: F-006 manual smoke must record build link, device, staging API URL alias (not secrets), and pass/fail before Done.
- Live Apple JWKS/network behavior can be exercised with integration or fixture tests, but real provider UI/token issuance remains manual.
  - Risk: Unit fixture validation may pass while provider-issued token audience/capability config is wrong.
  - Follow-up: Manual staging smoke must verify a real Apple login against `APPLE_CLIENT_ID=com.twotwobread.ium.staging`.
- Non-iOS/unsupported platform UI behavior is not an acceptance target beyond explicit no-fallback adapter behavior.
  - Risk: Unsupported builds may expose a disabled or generic error path depending on implementation.
  - Follow-up: Add platform-specific UX acceptance only if Android/web support becomes product scope.

## TDD Implementation Plan

1. Red: Mobile provider registry contract tests
   - Add tests for supported provider order Apple → Kakao, shared labels/link labels/styles/availability metadata, and credential adapter lookup.
   - Add tests proving login/link metadata can be consumed from the same provider registry without screen-local provider label ternaries.
   - Verify: `pnpm --filter @i-um/mobile test` fails before registry exists or before screens/helpers use it.
2. Red: No-fallback credential dispatch tests
   - Add tests that `getOAuthCredential('apple')` calls only the Apple adapter, `getOAuthCredential('kakao')` calls only the Kakao adapter, and unsupported provider id rejects without calling Kakao.
   - Add tests that Apple unavailable/missing identity token rejects explicitly and does not return dev/Kakao credentials.
   - Verify: `pnpm --filter @i-um/mobile test` fails against the current `if apple else Kakao` behavior.
3. Green: Minimal mobile registry and adapters
   - Introduce the smallest login/link provider registry/config needed for Apple and Kakao.
   - Move Apple credential code into an Apple adapter boundary if needed.
   - Keep Kakao native credential code behind the same adapter shape.
   - Update `getOAuthCredential(provider)` to use registry lookup and explicit errors.
   - Verify: `pnpm --filter @i-um/mobile test` passes targeted tests.
4. Green: Login/account UI metadata sourcing
   - Refactor login and account provider action rendering to consume provider registry metadata where practical.
   - Preserve existing visual layout, copy, provider order, and linked disabled state.
   - Keep screen-specific layout in screens; move provider formatting/metadata into `apps/mobile/lib/auth/**`.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
5. Red: API provider verifier registry tests
   - Add tests for provider verifier registry/map dispatch for Apple/Kakao and unsupported provider behavior.
   - Add Apple verifier tests using deterministic JWT/JWKS fixtures for valid token, bad audience, expired token, missing subject, bad signature, and missing config.
   - Verify: `pnpm --filter @i-um/api test` fails before registry/fixture coverage is complete.
6. Green: API verifier boundary and Apple validation
   - Refactor `HTTPProviderVerifier` or equivalent to keep provider-specific verification behind a registry/map/strategy boundary.
   - Preserve existing dev OAuth gating and Kakao verification behavior.
   - Ensure Apple validation checks issuer, audience, expiry, subject, and RS256 signature/JWKS.
   - Verify: `pnpm --filter @i-um/api test` passes targeted tests.
7. Red/Green: Auth service and server regression
   - Add or confirm tests for Apple existing-subject login, new-subject creation with missing optional snapshots, verified-email conflict, account link success, provider already linked, invalid token server error mapping, `/auth/me`, refresh, and logout compatibility.
   - Implement only minimal changes needed if current behavior/coverage is incomplete.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
8. Contract/generated gate
   - Since no OpenAPI/DB change is expected, verify no generated drift.
   - Verify: `pnpm verify:generated` passes.
9. Refactor pass
   - Remove leftover scattered provider label/style/credential branches introduced by Apple/Kakao handling.
   - Keep login/link provider registry separate from F-009 logout cleanup registry.
   - Ensure no logs/tests/docs include raw provider tokens or secrets.
   - Verify: rerun targeted mobile/API tests.
10. Full regression gate
    - Verify: `pnpm verify` passes.
11. Staging/internal smoke
    - Confirm #69 Apple manual setup and staging env readiness.
    - Build/install iOS internal build with `EXPO_PUBLIC_AUTH_DEV_MODE=false`.
    - Run real Apple login, `/auth/me`, app restart persistence, logout, and dev OAuth disabled checks.
    - Record command results, build link, device/platform, and manual smoke outcome in the verification record or completion report.

## Verification Plan

### Automated Regression

```text
pnpm verify:generated
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm verify
```

### Staging Smoke Commands

```bash
# staging health
curl -i "$CLOUD_RUN_URL/health"
curl -i "$CLOUD_RUN_URL/ready"

# dev OAuth must be disabled on public staging
curl -i -X POST "$CLOUD_RUN_URL/auth/oauth/login" \
  -H 'Content-Type: application/json' \
  -d '{"provider":"apple","credential":{"devSubject":"should-fail"},"device":{"platform":"ios"}}'
# expected: 401 INVALID_PROVIDER_TOKEN
```

Do not paste raw Apple identity tokens into chat, GitHub issues, commit messages, or this document.

### Manual Device Smoke

- [ ] Confirm Apple Developer Team and Sign in with Apple capability are ready for `com.twotwobread.ium.staging`.
- [ ] Confirm staging API has `AUTH_TOKEN_SECRET`, `APPLE_CLIENT_ID=com.twotwobread.ium.staging`, and `AUTH_ALLOW_DEV_OAUTH=false` or unset.
- [ ] Confirm EAS internal iOS build uses `EXPO_PUBLIC_API_BASE_URL=<staging-url>` and `EXPO_PUBLIC_AUTH_DEV_MODE=false`.
- [ ] Install iOS internal build on a test device signed in with Apple ID.
- [ ] Open app and confirm Apple provider is available on login screen.
- [ ] Tap `Apple로 계속하기`.
- [ ] Complete Apple sheet.
- [ ] Confirm app enters authenticated state.
- [ ] Confirm `GET /auth/me` returns current user and `linkedProviders` includes `apple`.
- [ ] Kill/reopen app and confirm session remains through refresh/session persistence.
- [ ] Log out and confirm login screen is shown.
- [ ] Confirm logout does not unlink Apple provider identity.
- [ ] Confirm public staging dev OAuth request fails with `INVALID_PROVIDER_TOKEN`.

## Verification Record

### Automated Regression

- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm verify`: pass.

### Manual Smoke

- Apple Developer setup (#69): not verified in this implementation pass.
- iOS internal build link: not created in this implementation pass.
- Real Apple login: not run; requires #69 manual setup and internal build.
- `/auth/me` linked provider `apple`: not run manually.
- Restart session persistence: not run manually.
- Logout: not run manually.
- Public staging dev OAuth disabled check: not run manually.

## Release Notes

```text
- iOS internal build에서 Sign in with Apple로 로그인하고 기존 이음 계정/session flow를 사용할 수 있게 됩니다.
- Apple/Kakao 로그인 provider metadata와 credential acquisition을 shared registry로 정리해 향후 OAuth provider 추가 시 변경 지점을 줄입니다.
```

## Open Questions

- [ ] Apple Developer Team ID가 확인되었는가? (#69)
- [ ] staging Bundle ID `com.twotwobread.ium.staging`가 Apple Developer Console에서 최종 확정되었는가? (#69)
- [ ] Sign in with Apple capability가 해당 Bundle ID에 활성화되었는가? (#69)
- [ ] Agent가 EAS iOS credentials를 interactive하게 생성/선택해도 되는가? (#69)
- [ ] 실제 smoke에 사용할 iOS device가 Apple ID로 로그인되어 있는가? (#69)

## Follow-up Issues

- #69: Apple/Kakao OAuth provider manual setup umbrella
- #7: Kakao Login 실제 provider 연결 및 internal build 검증
- #9: 로그아웃 provider cleanup abstraction boundary 유지
- #12: 계정 삭제
- Future: production App Store Sign in with Apple config, Apple auth-code exchange/revoke, or provider profile resync if product/App Store review requires it
- Future: Additional OAuth provider implementation using the registry/verifier seams introduced by F-006
