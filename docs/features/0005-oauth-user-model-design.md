# Feature Slice: F-005 OAuth user model design

## Metadata

- GitHub Issue: #5
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-21
- Updated: 2026-06-21

## Ouroboros Source

- Interview Session: `interview_20260621_053834`
- Seed: `seed_4546e7fb5062`
- PM Document: N/A
- Notes: Ambiguity score `0.10`. Ouroboros clarified that F-005 should implement Apple OAuth and Kakao OAuth, explicit authenticated provider linking, same-email conflict guidance instead of automatic merge, multi-device sessions, server-side hashed rotating refresh tokens, current-session logout, API result types, mobile UX copy, and verification scenarios.

## Goal

사용자가 Apple 또는 Kakao로 로그인하고, 앱 재실행 후에도 로그인 상태를 유지하며, 필요할 때 현재 기기에서 로그아웃할 수 있는 MVP 인증 기반을 만든다.

이 기능은 이후 여행 생성, 동행자 초대, 지출/정산 권한 확인에 사용할 `users`, `auth_identities`, `auth_sessions` 모델과 OpenAPI-first 인증 계약을 함께 확정한다.

## Problem

- 기존 문서에서는 MVP 인증 방식이 임시 사용자 또는 간단한 자체 인증 사이에서 미정이었다.
- App Store 배포를 고려하면 Apple 로그인이 필요하고, 한국 사용자 타겟을 고려하면 Kakao 로그인이 필요하다.
- 동행자 초대와 정산 기능은 같은 사용자를 안정적으로 식별하고 여러 기기에서 세션을 유지할 수 있어야 한다.
- 이메일만으로 Apple/Kakao 계정을 자동 병합하면 Apple private relay email, Kakao email 동의/검증 상태, 이메일 재사용 문제로 잘못된 계정 병합 위험이 있다.
- access token과 refresh token 저장/회전/폐기 규칙이 없으면 모바일 자동 로그인과 로그아웃 동작을 안전하게 구현하기 어렵다.

## User Flow

### New login / signup

1. 사용자가 로그인 화면을 연다.
2. 사용자가 `Apple로 계속하기` 또는 `Kakao로 계속하기`를 누른다.
3. 모바일 앱이 provider SDK/OAuth credential을 얻는다.
4. 앱이 generated API client로 `POST /auth/oauth/login`을 호출한다.
5. 서버가 Apple/Kakao credential을 검증한다.
6. 기존 `auth_identity`가 있으면 해당 `user`로 로그인한다.
7. 기존 identity가 없고 같은 verified email 충돌도 없으면 새 `user`, `auth_identity`, `auth_session`을 만든다.
8. 서버가 access token, refresh token, user를 반환한다.
9. 앱이 세션을 저장하고 로그인 후 화면으로 이동하며 `로그인되었습니다.`를 표시한다.

### Same-email conflict while logged out

1. 사용자가 로그아웃 상태에서 새 provider로 로그인한다.
2. 서버가 provider credential을 검증한다.
3. 해당 `(provider, providerSubject)` identity는 없지만 같은 verified email의 다른 user가 존재한다.
4. 서버는 자동 병합하지 않고 `link_required_conflict` 결과를 반환한다.
5. 앱은 `이미 같은 이메일로 가입한 계정이 있어요. 기존 계정으로 로그인한 뒤 이 로그인 방법을 연결해주세요.`와 `기존 계정으로 로그인` CTA를 보여준다.

### Explicit provider linking

1. 사용자가 이미 Apple 또는 Kakao로 로그인되어 있다.
2. 사용자가 최소 계정 화면에서 아직 연결되지 않은 provider 연결을 시작한다.
3. 앱이 provider credential을 얻고 `POST /auth/oauth/link`를 호출한다.
4. 서버가 credential을 검증하고 `(provider, providerSubject)`가 다른 user에 연결되어 있지 않은지 확인한다.
5. 서버가 현재 user에 새 `auth_identity`를 연결한다.
6. 앱은 `로그인 방법이 연결되었습니다.`를 표시한다.

### Token refresh / logout

1. 앱이 access token 만료 또는 401을 감지한다.
2. 앱이 저장된 refresh token으로 `POST /auth/token/refresh`를 호출한다.
3. 서버가 refresh token hash를 검증하고 기존 token을 회전한다.
4. 서버가 새 access token과 새 refresh token을 반환한다.
5. refresh token이 만료, 폐기, 불일치하면 앱은 로컬 세션을 삭제하고 로그인 화면으로 이동하며 `다시 로그인해주세요.`를 표시한다.
6. 사용자가 로그아웃하면 앱이 `POST /auth/logout`을 호출하고 서버는 현재 session만 revoke한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 로그인 화면, 로그인 후 최소 계정/진단 화면, 현재 기기 로그아웃, 다른 provider 연결 CTA, conflict 안내 상태
- [ ] API Contract: OAuth login/link, token refresh, logout, current user 조회 endpoint와 request/response/error schema
- [ ] API Server: Apple/Kakao credential 검증, user/identity/session service, access token 발급, refresh token hash/rotation/revocation, auth middleware
- [ ] DB: `users`, `auth_identities`, `auth_sessions` migration, 필요한 unique constraint/index/query
- [ ] Generated Code: OpenAPI에서 Go server artifact와 TypeScript client/type 갱신
- [ ] Mobile API Integration: generated client를 사용한 login/link/refresh/logout 호출과 local session persistence
- [ ] Tests: provider verifier fake를 사용한 API service/handler test, token rotation test, mobile typecheck
- [ ] Deployment: staging API와 iOS internal build에서 Apple/Kakao happy path 중 가능한 범위를 검증하고, provider credential 제약은 완료 보고에 기록

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- Google, email/password, magic link 등 Apple/Kakao 외 로그인 provider
- 이메일만으로 계정을 자동 병합하는 동작
- 계정 탈퇴
- 계정 병합 관리자 도구
- provider unlink
- 전체 provider 관리 UI
  - 단, F-005 검증을 위한 최소 provider 연결 CTA와 성공/오류 상태는 포함한다.
- 프로필 편집
  - OAuth provider에서 받은 최소 display name/email/avatar snapshot 저장만 포함한다.
- 소셜 친구 목록, Kakao 친구 API, 연락처 연동
- 관리자 기능
- 모든 기기 로그아웃 또는 session 목록 관리
- provider access token 장기 저장
- production-grade fraud/risk scoring, device trust, MFA
- Web app OAuth callback flow

## UX / UI Requirements

### Screens

- `apps/mobile/app/login.tsx`: Apple/Kakao 로그인 진입 화면
- `apps/mobile/app/index.tsx`: 로그인 후 최소 home/diagnostic 화면. 현재 user, API/DB/session 상태, 로그아웃 진입점을 표시한다.
- `apps/mobile/app/account.tsx` 또는 동등한 최소 계정 화면: 현재 로그인 provider 상태, 아직 연결되지 않은 provider 연결 CTA, 현재 기기 로그아웃을 제공한다.

정확한 route 파일명은 구현 시 기존 Expo Router 구조에 맞춰 조정할 수 있지만, 사용자에게 보이는 상태와 flow는 유지한다.

### States

- Loading: provider SDK 진행 중 또는 API 호출 중 버튼 disabled/loading 상태를 표시한다.
- Empty: 로그인 전 상태는 login screen 자체로 처리한다.
- Error: provider token 검증 실패, 네트워크 실패, refresh 실패, provider already linked 상태를 사용자 문구로 매핑한다.
- Success: 로그인 성공, provider 연결 성공, logout 성공 상태를 표시한다.
- Conflict: 동일 verified email 충돌 시 자동 병합하지 않고 기존 계정 로그인 후 연결 안내를 표시한다.

### Copy / Labels

- Apple login: `Apple로 계속하기`
- Kakao login: `Kakao로 계속하기`
- Login success: `로그인되었습니다.`
- Same-email conflict: `이미 같은 이메일로 가입한 계정이 있어요. 기존 계정으로 로그인한 뒤 이 로그인 방법을 연결해주세요.`
- Same-email conflict CTA: `기존 계정으로 로그인`
- Provider link success: `로그인 방법이 연결되었습니다.`
- Refresh expired/revoked: `다시 로그인해주세요.`
- Logout: `로그아웃`

## API Contract

API 변경은 OpenAPI source of truth인 `packages/api-contract/openapi.yaml`에서 먼저 정의한다. 앱은 generated TypeScript client/type을 사용하고 hand-written duplicate fetch/type을 만들지 않는다.

### Auth model types

Provider enum:

```text
apple
kakao
```

Logical result enum:

```text
login_success
refresh_success
logout_success
provider_link_success
link_required_conflict
invalid_provider_token
provider_already_linked
invalid_refresh_token
```

`link_required_conflict`, `invalid_provider_token`, `provider_already_linked`, `invalid_refresh_token`은 HTTP error response로 반환하되, 앱이 구분할 수 있도록 공통 error code를 고정한다.

### Endpoints

```text
POST /auth/oauth/login
POST /auth/oauth/link
POST /auth/token/refresh
POST /auth/logout
GET  /auth/me
```

### `POST /auth/oauth/login`

Provider credential을 검증하고 신규 가입 또는 기존 identity 로그인을 수행한다.

#### Request

Apple 예시:

```json
{
  "provider": "apple",
  "credential": {
    "identityToken": "apple-jwt",
    "authorizationCode": "apple-authorization-code",
    "nonce": "optional-nonce"
  },
  "device": {
    "deviceName": "Syl's iPhone",
    "platform": "ios"
  }
}
```

Kakao 예시:

```json
{
  "provider": "kakao",
  "credential": {
    "accessToken": "kakao-access-token"
  },
  "device": {
    "deviceName": "Syl's iPhone",
    "platform": "ios"
  }
}
```

#### Success Response

HTTP status: `200`

```json
{
  "result": "login_success",
  "user": {
    "id": "user_123",
    "displayName": "민수",
    "email": "minsu@example.com",
    "avatarUrl": "https://example.com/avatar.png"
  },
  "tokens": {
    "accessToken": "jwt-access-token",
    "accessTokenExpiresAt": "2026-06-21T06:15:00Z",
    "refreshToken": "opaque-refresh-token",
    "refreshTokenExpiresAt": "2026-07-21T06:00:00Z"
  }
}
```

#### Errors

Invalid provider token:

HTTP status: `401`

```json
{
  "error": {
    "code": "INVALID_PROVIDER_TOKEN",
    "message": "provider token is invalid",
    "details": []
  }
}
```

Same verified email conflict:

HTTP status: `409`

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

### `POST /auth/oauth/link`

Authenticated endpoint. 현재 access token의 user에 새로운 provider identity를 연결한다.

#### Request

```json
{
  "provider": "kakao",
  "credential": {
    "accessToken": "kakao-access-token"
  }
}
```

#### Success Response

HTTP status: `200`

```json
{
  "result": "provider_link_success",
  "linkedIdentity": {
    "provider": "kakao",
    "email": "minsu@example.com",
    "emailVerified": true
  }
}
```

#### Errors

Provider identity already linked to a different user:

HTTP status: `409`

```json
{
  "error": {
    "code": "PROVIDER_ALREADY_LINKED",
    "message": "provider identity is already linked",
    "details": [
      {
        "result": "provider_already_linked",
        "provider": "kakao"
      }
    ]
  }
}
```

Unauthorized requests use the existing common `UNAUTHORIZED` format.

### `POST /auth/token/refresh`

Refresh token을 검증하고 rotating refresh token 방식으로 새 token pair를 발급한다.

#### Request

```json
{
  "refreshToken": "opaque-refresh-token"
}
```

#### Success Response

HTTP status: `200`

```json
{
  "result": "refresh_success",
  "tokens": {
    "accessToken": "new-jwt-access-token",
    "accessTokenExpiresAt": "2026-06-21T06:30:00Z",
    "refreshToken": "new-opaque-refresh-token",
    "refreshTokenExpiresAt": "2026-07-21T06:15:00Z"
  }
}
```

#### Errors

HTTP status: `401`

```json
{
  "error": {
    "code": "INVALID_REFRESH_TOKEN",
    "message": "refresh token is invalid",
    "details": [
      {
        "result": "invalid_refresh_token"
      }
    ]
  }
}
```

### `POST /auth/logout`

Authenticated endpoint. 현재 access token의 session만 revoke한다.

#### Request

No request body.

#### Response

HTTP status: `200`

```json
{
  "result": "logout_success"
}
```

### `GET /auth/me`

Authenticated endpoint. 현재 access token의 user와 연결된 provider 목록을 반환한다.

#### Request

No request body.

#### Response

HTTP status: `200`

```json
{
  "user": {
    "id": "user_123",
    "displayName": "민수",
    "email": "minsu@example.com",
    "avatarUrl": "https://example.com/avatar.png"
  },
  "linkedProviders": ["apple", "kakao"]
}
```

### Authentication

인증이 필요한 endpoint는 `Authorization: Bearer <accessToken>`을 사용한다.

Access token은 서버가 서명한 JWT로 시작한다. 최소 claims:

```json
{
  "sub": "user_123",
  "sid": "session_123",
  "iat": 1782021600,
  "exp": 1782022500
}
```

## DB Changes

### Tables

#### `users`

서비스 사용자 계정이다. OAuth provider와 독립적인 앱 내부 user를 나타낸다.

예상 schema:

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL,
  email text NULL,
  email_normalized text NULL,
  email_verified boolean NOT NULL DEFAULT false,
  avatar_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

#### `auth_identities`

Apple/Kakao provider identity와 앱 user를 연결한다.

예상 schema:

```sql
CREATE TABLE auth_identities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_subject text NOT NULL,
  email text NULL,
  email_normalized text NULL,
  email_verified boolean NOT NULL DEFAULT false,
  display_name text NULL,
  avatar_url text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT auth_identities_provider_check CHECK (provider IN ('apple', 'kakao')),
  CONSTRAINT auth_identities_provider_subject_unique UNIQUE (provider, provider_subject),
  CONSTRAINT auth_identities_user_provider_unique UNIQUE (user_id, provider)
);
```

#### `auth_sessions`

기기/app install 단위 app session이다. refresh token 원문은 저장하지 않고 hash만 저장한다.

예상 schema:

```sql
CREATE TABLE auth_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  refresh_token_hash text NOT NULL UNIQUE,
  refresh_token_expires_at timestamptz NOT NULL,
  revoked_at timestamptz NULL,
  last_used_at timestamptz NULL,
  rotated_at timestamptz NULL,
  device_name text NULL,
  platform text NULL,
  user_agent text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

### Constraints / Indexes

- `auth_identities(provider, provider_subject)` unique: provider identity의 primary lookup key
- `auth_identities(user_id, provider)` unique: MVP에서는 user당 provider별 identity 하나만 허용
- `auth_identities(email_normalized)` partial index where `email_verified = true`: same verified email conflict 탐지용
- `auth_sessions(refresh_token_hash)` unique: refresh token lookup/rotation 검증용
- `auth_sessions(user_id)` index: user별 session 조회/cleanup용
- `auth_sessions(refresh_token_expires_at)` index: 만료 session cleanup용
- `users(email_normalized)` non-unique index optional: user display/contact lookup 보조용

Email 관련 column은 unique constraint를 두지 않는다. 같은 email은 자동 병합 기준이 아니며, conflict/link 안내와 명시적 provider 연결 흐름으로 처리한다.

### Migration Notes

- migration은 `apps/api/migrations`에 goose migration으로 추가한다.
- PostgreSQL UUID 생성은 기존 DB extension 정책을 확인한 뒤 `pgcrypto`의 `gen_random_uuid()` 사용을 우선 검토한다.
- rollback은 `auth_sessions`, `auth_identities`, `users` 순서로 drop한다.
- F-003의 `app_metadata` foundation table은 유지한다.
- sqlc query는 user/identity/session create/find/update/revoke/rotate에 필요한 최소 query만 추가한다.

## Business Rules

### Provider support

- MVP provider는 Apple과 Kakao만 지원한다.
- App Store 배포를 위해 Apple login을 포함한다.
- 한국 사용자 타겟을 위해 Kakao login을 포함한다.
- Apple/Kakao 외 provider enum 값은 validation error로 거부한다.

### Identity rules

- 사용자 식별의 primary key는 항상 `(provider, provider_subject)`이다.
- `provider_subject`는 Apple `sub`, Kakao user id처럼 provider가 보장하는 고유 subject를 사용한다.
- 이메일은 보조 정보이며 nullable이다.
- 이메일만으로 계정을 자동 병합하지 않는다.
- 로그아웃 상태에서 새 provider login이 같은 verified email을 가진 기존 user와 충돌하면 `ACCOUNT_LINK_REQUIRED`를 반환한다.
- 계정 통합은 사용자가 이미 로그인한 상태에서 `POST /auth/oauth/link`를 성공한 경우에만 수행한다.
- provider identity가 이미 다른 user에 연결되어 있으면 현재 user에 연결하지 않고 `PROVIDER_ALREADY_LINKED`를 반환한다.

### Minimal profile storage

- 저장 가능한 최소 profile snapshot:
  - display name 또는 nickname
  - email if provided
  - email verified 여부
  - avatar URL if provided
- provider access token은 장기 저장하지 않는다.
- provider raw profile JSON 전체 저장은 MVP에서 피한다.
- Apple private relay email과 Kakao email 미제공/미검증 상태를 허용한다.

### Session and token rules

- user 하나는 여러 기기/app install에서 동시에 로그인할 수 있다.
- `auth_sessions`는 기기/app install 단위 session을 나타낸다.
- access token은 짧게 유지한다. 권장 lifetime: 15분.
- refresh token은 더 길게 유지한다. 권장 lifetime: 30일.
- refresh token은 opaque token으로 발급하고 DB에는 hash만 저장한다.
- raw refresh token은 DB, log, analytics에 저장하지 않는다.
- refresh 성공 시 기존 refresh token hash를 새 hash로 교체하고 새 refresh token을 반환한다.
- 만료, revoke, hash mismatch refresh token은 `INVALID_REFRESH_TOKEN`으로 거부한다.
- refresh token 재사용 의심(hash mismatch with known session) 시 해당 session revoke를 우선 검토한다.
- logout은 현재 access token의 `sid`에 해당하는 session만 revoke한다.
- 모든 기기 logout은 F-005 범위 밖이다.

### Auth middleware

- 인증이 필요한 endpoint는 Bearer access token을 검증한다.
- access token signature, expiry, `sub`, `sid`를 확인한다.
- `sid`의 session이 revoked/expired 상태이면 인증 실패로 처리한다.
- 인증 context에는 user id와 session id를 넣는다.

## Acceptance Criteria

- [ ] `docs/features/0005-oauth-user-model-design.md`에 Ouroboros 기반 feature spec + implementation plan이 작성되어 있다.
- [ ] `packages/api-contract/openapi.yaml`에 auth endpoint, schema, error code가 정의되어 있다.
- [ ] generated Go server artifact와 TypeScript client/type이 갱신되어 있다.
- [ ] DB migration으로 `users`, `auth_identities`, `auth_sessions`가 생성된다.
- [ ] sqlc query와 generated DB code가 user/identity/session lookup/create/link/rotate/revoke를 지원한다.
- [ ] Apple OAuth login이 신규 가입과 기존 identity 재로그인을 지원한다.
- [ ] Kakao OAuth login이 신규 가입과 기존 identity 재로그인을 지원한다.
- [ ] `POST /auth/oauth/login`은 성공 시 `login_success`, access token, refresh token, user를 반환한다.
- [ ] `POST /auth/oauth/login`은 로그아웃 상태의 동일 verified email 충돌 시 자동 병합하지 않고 `ACCOUNT_LINK_REQUIRED`를 반환한다.
- [ ] `POST /auth/oauth/login`은 provider credential 검증 실패 시 `INVALID_PROVIDER_TOKEN`을 반환한다.
- [ ] `POST /auth/oauth/link`는 인증된 사용자의 명시적 provider 연결 성공 시 `provider_link_success`를 반환한다.
- [ ] `POST /auth/oauth/link`는 provider identity가 다른 user에 이미 연결되어 있으면 `PROVIDER_ALREADY_LINKED`를 반환한다.
- [ ] `POST /auth/token/refresh`는 유효한 refresh token을 회전하고 새 access/refresh token을 반환한다.
- [ ] `POST /auth/token/refresh`는 만료, 폐기, 불일치 refresh token에 `INVALID_REFRESH_TOKEN`을 반환한다.
- [ ] `POST /auth/logout`은 현재 session만 revoke하고 `logout_success`를 반환한다.
- [ ] `GET /auth/me`는 현재 user와 linked provider 목록을 반환한다.
- [ ] Expo 앱 로그인 화면에 `Apple로 계속하기`와 `Kakao로 계속하기`가 표시된다.
- [ ] 로그인 성공 후 앱이 session을 저장하고 앱 재실행 시 자동 로그인 상태를 유지한다.
- [ ] 앱은 access token 만료 시 refresh token으로 자동 갱신한다.
- [ ] refresh token이 만료/폐기/invalid이면 앱은 local session을 지우고 로그인 화면으로 이동한다.
- [ ] 동일 verified email conflict 시 앱은 지정된 안내 문구와 `기존 계정으로 로그인` CTA를 표시한다.
- [ ] provider 연결 성공 시 앱은 `로그인 방법이 연결되었습니다.`를 표시한다.
- [ ] 로그아웃 시 앱은 local session을 삭제하고 로그인 화면으로 이동한다.
- [ ] API service/handler test와 token rotation test가 추가되어 있다.
- [ ] mobile typecheck와 root verification이 통과한다.
- [ ] staging API와 internal build에서 가능한 Apple/Kakao auth happy path와 refresh/logout flow를 검증하고 결과를 기록한다.

## Implementation Plan

1. Auth API contract 작성
   - 작업: `packages/api-contract/openapi.yaml`에 `/auth/oauth/login`, `/auth/oauth/link`, `/auth/token/refresh`, `/auth/logout`, `/auth/me`, provider enum, auth response/error schema, bearer auth scheme을 추가한다.
   - Verify: `pnpm generate`가 성공하고 generated Go/TypeScript artifact에 auth endpoint가 포함된다.

2. DB migration과 sqlc query 추가
   - 작업: `users`, `auth_identities`, `auth_sessions` migration과 user/identity/session create/find/link/rotate/revoke query를 추가한다.
   - Verify: local DB에서 `pnpm db:migrate`, `pnpm db:rollback`, 재-`pnpm db:migrate`가 성공하고 sqlc generation이 성공한다.

3. Auth domain/service skeleton 작성
   - 작업: `apps/api/internal/auth`에 provider verifier interface, user identity service, session/token service를 만든다.
   - Verify: fake provider verifier를 사용한 service unit test에서 신규 가입, 기존 로그인, same-email conflict, provider linking 성공/충돌이 통과한다.

4. Token 발급/검증/rotation 구현
   - 작업: access JWT 발급/검증, opaque refresh token 생성/hash 저장, refresh rotation, current-session logout revoke를 구현한다.
   - Verify: token unit test에서 만료, revoke, hash mismatch, rotation 후 old refresh invalid 처리가 통과한다.

5. Apple/Kakao provider verification 구현
   - 작업: Apple identity token 검증과 Kakao access token user-info 검증을 service behind interface로 구현한다. provider token 원문을 저장하지 않는다.
   - Verify: verifier unit test 또는 provider response fixture test가 성공한다. 실제 provider credential이 필요한 검증은 staging/internal manual check로 분리한다.

6. Auth HTTP handler와 middleware 구현
   - 작업: generated OpenAPI interface에 맞춰 auth handler를 구현하고 bearer auth middleware/context를 추가한다.
   - Verify: handler test에서 endpoint별 HTTP status/body/error code가 spec과 일치한다.

7. Mobile auth client/session storage 구현
   - 작업: Expo 앱에서 generated client로 login/link/refresh/logout/me를 호출하고, secure storage 기반 local session persistence를 구현한다.
   - Verify: mobile typecheck가 성공하고 앱 재실행 시 stored session 복원 로직이 동작한다.

8. Mobile login/account UI 구현
   - 작업: login screen, same-email conflict 안내, minimal account/link/logout UI, refresh failure redirect를 구현한다.
   - Verify: 앱에서 Apple/Kakao 버튼, conflict 문구, logout, provider link success 문구를 확인한다.

9. Staging/internal provider credential 연결
   - 작업: Apple/Kakao developer 설정, bundle id/package 설정, required env/secret, EAS internal build 환경을 문서화하고 staging API에 필요한 env를 설정한다.
   - Verify: staging API에서 `/auth` endpoint smoke가 성공하고 internal build에서 가능한 provider login happy path를 확인한다.

10. 최종 검증과 문서 업데이트
    - 작업: 자동 검증, DB migration 검증, staging/internal 수동 검증 결과를 feature 문서 또는 완료 보고에 기록한다.
    - Verify: acceptance criteria가 모두 충족되며, provider credential 또는 App Store/EAS 제약으로 미검증인 항목은 후속 issue로 분리한다.

## Verification Plan

### Automated

```text
pnpm install --frozen-lockfile
pnpm generate
pnpm verify
```

DB 포함 검증:

```text
pnpm db:up
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate
```

API 검증:

```text
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api test
DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm --filter @i-um/api build
```

Contract/generated consistency:

```text
pnpm generate
git diff --exit-code -- apps/api/internal/openapi apps/api/internal/db packages/api-contract/gen/ts
```

Mobile 검증:

```text
pnpm --filter @i-um/mobile typecheck
```

### Verification Results

- `pnpm install --frozen-lockfile`: pass
- `pnpm generate`: pass
- `pnpm --filter @i-um/api test`: pass
- `pnpm --filter @i-um/api build`: pass
- `pnpm --filter @i-um/mobile typecheck`: pass
- `pnpm verify`: pass
- `pnpm db:up`: pass
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:migrate`: pass, applied `00001_create_app_metadata.sql` and `00002_create_auth_tables.sql`
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:status`: pass, migration version 2 applied
- `DATABASE_URL=postgres://ium:ium@localhost:5432/ium?sslmode=disable pnpm db:rollback`: pass, rolled back `00002_create_auth_tables.sql`
- rollback 후 `pnpm db:migrate` 재실행: pass
- Local API dev OAuth smoke with `AUTH_ALLOW_DEV_OAUTH=true`: pass for Apple dev login, same verified email Kakao conflict, authenticated Kakao provider linking, `/auth/me`, refresh token rotation, old refresh rejection, current-session logout, and post-logout `UNAUTHORIZED`
- Real Apple OAuth on device/internal build: not run yet; requires Apple Developer/App Store credential setup in the target build environment
- Real Kakao OAuth on device/internal build: not run yet; requires Kakao REST API key and redirect registration for the target build
- Staging Cloud Run auth smoke: not run in this implementation pass; requires staging env/secret update for `AUTH_TOKEN_SECRET`, Apple audience, and optional dev OAuth flag

### Manual

- [ ] 신규 Apple login/signup이 성공하고 `login_success`를 반환한다.
- [ ] 신규 Kakao login/signup이 성공하고 `login_success`를 반환한다.
- [ ] 기존 Apple identity로 재로그인하면 기존 user로 로그인된다.
- [ ] 기존 Kakao identity로 재로그인하면 기존 user로 로그인된다.
- [ ] 로그아웃 상태에서 동일 verified email의 다른 provider로 로그인하면 자동 병합하지 않고 `ACCOUNT_LINK_REQUIRED`를 반환한다.
- [ ] 앱이 same-email conflict 문구와 `기존 계정으로 로그인` CTA를 표시한다.
- [ ] 로그인된 상태에서 다른 provider 연결이 성공하고 `provider_link_success`를 반환한다.
- [ ] 이미 다른 user에 연결된 provider identity 연결 시 `PROVIDER_ALREADY_LINKED`가 반환된다.
- [ ] access token 만료 후 refresh가 성공하고 새 token pair로 API 호출이 계속된다.
- [ ] revoked/expired refresh token 사용 시 앱이 local session을 삭제하고 로그인 화면으로 이동한다.
- [ ] 로그아웃 시 현재 session만 revoke되고 같은 user의 다른 session은 유지된다.
- [ ] staging Cloud Run API와 iOS internal build에서 가능한 auth flow를 확인한다.

## Release Notes

```text
- Apple/Kakao OAuth 기반 MVP 로그인 모델을 추가한다.
- users, auth_identities, auth_sessions 기반 사용자/identity/session 구조를 도입한다.
- 같은 verified email 계정은 자동 병합하지 않고 기존 계정 로그인 후 provider 연결을 안내한다.
- refresh token hash 저장과 rotation을 사용해 앱 자동 로그인과 현재 기기 로그아웃을 지원한다.
```

## Open Questions

None for implementation after spec approval.

Resolved by Ouroboros interview:

- OAuth provider는 Apple과 Kakao만 지원한다.
- 계정 통합은 로그인된 사용자의 명시적 provider linking으로만 수행한다.
- 로그아웃 상태에서 같은 verified email 충돌이 있으면 자동 병합하지 않고 account-link-required 안내를 반환한다.
- multi-device session을 허용한다.
- refresh token은 서버 DB에 hash만 저장하고 rotating 방식으로 갱신한다.
- logout은 현재 session만 revoke한다.

## Follow-up Issues

- TBD: 계정 탈퇴
- TBD: provider unlink 및 전체 provider 관리 UI
- TBD: 모든 기기 로그아웃/session 관리
- TBD: 프로필 편집
- TBD: OAuth 외 로그인 provider 추가 검토
