# Feature Slice: F-010 내 프로필 조회

## Metadata

- GitHub Issue: #10
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-24
- Updated: 2026-06-24

## Readiness / Status Gate

- Ouroboros clarification completed with ambiguity score `0.0535`.
- Material product/API/mobile migration decisions for this draft are closed.
- Spec approved for implementation by user request on 2026-06-24.
- F-010 is a compatibility transition slice: `GET /me` becomes canonical, while `GET /auth/me` remains available as a deprecated alias during the rollout.

## Ouroboros Source

- Interview Session: `interview_20260623_152028`
- Seed: `seed_d9eb4af96760`
- PM Document: N/A
- Notes: Ouroboros clarified that F-010 should introduce canonical `GET /me`, keep existing `GET /auth/me` as a deprecated compatibility alias, preserve the current `AuthMeResponse` shape byte-for-byte, migrate active in-repo mobile current-profile usage to generated `/me`, and require automated API/OpenAPI/mobile regression coverage.

## Goal

로그인한 사용자가 canonical `GET /me` API를 통해 내 user id, display name, optional profile fields, and linked provider 정보를 조회할 수 있다.

기존 `GET /auth/me`는 이 slice에서 제거하지 않고 같은 동작을 하는 deprecated compatibility alias로 유지한다.

## Problem

- GitHub Issue #10은 `GET /me` 기반 내 프로필 조회를 요구하지만, 기존 F-005 auth foundation은 `GET /auth/me`를 current-user endpoint로 제공한다.
- 이후 기능들이 current profile 조회 경로를 일관되게 사용하려면 canonical path를 정해야 한다.
- 이미 배포되었거나 개발 중인 F-005/F-008/F-013 흐름이 `GET /auth/me`에 의존할 수 있으므로 즉시 제거하면 호환성 리스크가 있다.
- API path만 바꾸더라도 OpenAPI/generated client/mobile helper/test가 함께 이동하지 않으면 앱과 서버 계약이 어긋날 수 있다.

## User Flow

1. 사용자가 Apple/Kakao login 또는 기존 저장된 i-um session으로 로그인 상태가 된다.
2. 앱이 current profile이 필요한 화면 또는 auth bootstrap helper에서 generated client의 canonical `/me` operation을 호출한다.
3. API server는 bearer access token을 검증한다.
4. 서버는 기존 `auth.Me` service logic을 사용해 현재 user와 linked provider 목록을 조회한다.
5. 앱은 기존과 같은 profile/session UI 상태를 표시한다.
6. 오래된 앱 또는 compatibility 검증에서 `GET /auth/me`를 호출해도 같은 response/error behavior가 유지된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 새 화면 없음. 기존 mypage/account/session 관련 UI behavior 유지
- [ ] Mobile API Integration: active in-repo current-profile helper/screens/tests/mocks를 generated `/me` operation으로 전환
- [ ] API Contract: canonical `GET /me` 추가, existing `GET /auth/me`는 deprecated alias로 OpenAPI에 유지
- [ ] API Server: existing `auth.Me` service와 current user response mapping 재사용, `/me` route 추가
- [ ] DB: 기존 `users`, `auth_identities`, `auth_sessions` 재사용. migration 없음
- [ ] Generated Code: OpenAPI에서 Go server interface와 TypeScript client/type 갱신
- [ ] Tests: `/me`와 deprecated `/auth/me` parity, 401/common error behavior, generated drift, mobile helper migration 검증
- [ ] Deployment: staging/internal build 또는 local dev auth 환경에서 profile-dependent screens가 기존처럼 동작하는지 smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- `GET /auth/me` 제거
- `GET /auth/me` removal date 확정
- response field rename, nesting 변경, provider label cleanup
- display name 수정 (#11)
- account deletion (#12)
- provider unlink, 모든 기기 로그아웃, session 목록 관리
- profile image upload or avatar editing
- provider subject id, provider raw token, session id, provider raw profile JSON 노출
- email 기반 계정 병합 또는 auth identity business rule 변경
- DB schema/migration 변경
- 새로운 마이페이지/계정관리 UI 추가 또는 redesign

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx`: current profile 조회 경로는 `/me`로 이동하지만 화면 copy/layout/상태는 기존 behavior를 유지한다.
- `apps/mobile/app/account.tsx`: account/provider 상태 조회가 필요하면 `/me` 기반 generated client path를 사용한다.
- `apps/mobile/app/index.tsx`: session bootstrap/current user 확인이 필요하면 shared current-user helper를 통해 `/me`를 사용한다.

### States

- Loading: 기존 profile/session loading state를 유지한다.
- Empty: 인증된 user profile은 항상 있어야 한다. 별도 empty profile state는 추가하지 않는다.
- Error: canonical `/me`와 deprecated `/auth/me` 모두 기존 common error format을 따른다.
- Login required: missing/invalid access token은 기존 auth flow와 동일하게 `UNAUTHORIZED`로 처리된다.
- Success: 기존 `AuthMeResponse`와 같은 data로 현재 profile UI를 렌더링한다.

### Copy / Labels

No new user-facing copy is expected.

Existing mypage/account copy must not change just because the API path changes.

## API Contract

OpenAPI source of truth인 `packages/api-contract/openapi.yaml`을 먼저 수정한다.

### Endpoints

Canonical endpoint:

```text
GET /me
```

Deprecated compatibility endpoint:

```text
GET /auth/me
```

Implementation notes:

- `GET /me` operationId should be a new canonical generated operation such as `getMe`.
- `GET /auth/me` keeps its existing operationId for compatibility, but OpenAPI marks it `deprecated: true`.
- Both operations use the `Auth` tag unless implementation discovers a stronger generated-client reason to separate them.

### Request

No request body.

Both endpoints require:

```text
Authorization: Bearer <accessToken>
```

### Response

Both endpoints return the existing `AuthMeResponse` shape byte-for-byte.

```json
{
  "user": {
    "id": "user_123",
    "displayName": "민수",
    "email": "minsu@example.com",
    "avatarUrl": null
  },
  "linkedProviders": ["apple", "kakao"]
}
```

Allowed response fields:

- `user.id`: internal i-um user id
- `user.displayName`
- `user.email`: nullable, only if already present in `AuthMeResponse`
- `user.avatarUrl`: nullable, only if already present in `AuthMeResponse`
- `linkedProviders`: existing `AuthProvider[]`

Explicitly forbidden in this slice:

- provider subject ids
- provider access/refresh/id tokens
- i-um session ids
- raw provider profile JSON
- newly invented profile editing fields

### Errors

Both endpoints have identical runtime semantics.

Unauthorized:

HTTP status: `401`

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "unauthorized",
    "details": []
  }
}
```

Unexpected server error uses the existing common error format.

```json
{
  "error": {
    "code": "INTERNAL_ERROR",
    "message": "internal server error",
    "details": []
  }
}
```

## DB Changes

No DB changes.

F-010 reuses the existing auth tables:

- `users`
- `auth_identities`
- `auth_sessions`

No goose migration or sqlc query change is expected. If implementation discovers a required schema/query change, update this spec before coding it.

## Business Rules

- `GET /me` is the canonical current-profile endpoint after F-010.
- `GET /auth/me` remains available as a deprecated compatibility alias during this slice.
- `GET /me` and `GET /auth/me` must have identical bearer-auth requirements, success body, linked provider ordering, and common error behavior.
- The current profile is determined only from the authenticated i-um access token.
- The endpoint returns the internal i-um user, not the provider account as the primary identity.
- Provider list comes from linked `auth_identities` and uses existing `AuthProvider` enum values.
- Response shape must remain byte-for-byte compatible with the existing `AuthMeResponse` contract.
- F-010 does not add profile editing, provider unlink, account merge, or account deletion behavior.
- Active in-repo mobile code should not intentionally call deprecated `/auth/me` after F-010. Remaining `/auth/me` references should be limited to compatibility tests, generated legacy client output, and deprecation documentation.

## Acceptance Criteria

- [ ] `docs/features/0010-get-my-profile.md` exists and records the Ouroboros source, scope, regression plan, TDD plan, and verification plan for #10.
- [ ] OpenAPI defines canonical `GET /me` for current profile retrieval.
- [ ] OpenAPI keeps `GET /auth/me` published and marks it deprecated.
- [ ] `GET /me` and deprecated `GET /auth/me` return the same `AuthMeResponse` shape byte-for-byte.
- [ ] `GET /me` and deprecated `GET /auth/me` have identical bearer-auth, success, 401, and common error behavior.
- [ ] The response contains only internal user id, display name, optional existing email/avatar fields, and linked provider enum values.
- [ ] The response does not expose provider subject ids, raw provider tokens, session ids, or raw provider profile JSON.
- [ ] Go and TypeScript generated code is refreshed from OpenAPI.
- [ ] API server reuses existing `auth.Me` service logic for both endpoint paths.
- [ ] No DB migration is added for F-010.
- [ ] Shared mobile current-user helper uses the generated `/me` operation.
- [ ] Active in-repo mobile profile/session/account/mypage code no longer intentionally calls deprecated `/auth/me` after F-010.
- [ ] Existing mypage/account/session UI behavior remains unchanged while switching to `/me`.
- [ ] API/server tests cover authenticated success parity between `/me` and `/auth/me`.
- [ ] API/server tests cover missing/invalid bearer token behavior for `/me` and `/auth/me`.
- [ ] Generated drift checks prove OpenAPI, Go generated server code, and TypeScript client output are in sync.
- [ ] Mobile regression tests or typecheck cover the current-profile helper migration and preserve current profile flows.
- [ ] Staging/internal or local dev-auth smoke confirms profile-dependent screens still load after login.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| `GET /me` returns current user and linked providers for an authenticated session | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Deprecated `GET /auth/me` returns the same `AuthMeResponse` payload as `GET /me` for the same authenticated session | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Missing/invalid bearer token returns the same `UNAUTHORIZED` common error behavior for `/me` and `/auth/me` | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| `/me` is canonical and `/auth/me` is marked deprecated in published OpenAPI | API contract/generated | `packages/api-contract/openapi.yaml` and generated artifacts | `pnpm verify:generated` |
| Go server interface and TypeScript client are regenerated with no drift | Contract/generated gate | generated drift gate | `pnpm verify:generated` |
| Shared mobile current-user helper calls the generated `/me` operation and preserves refresh behavior | Mobile auth helper | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing mypage/account/session current-profile flows keep their UI behavior after the helper switches to `/me` | Mobile app/typecheck and helper tests | `apps/mobile/lib/auth/client.test.mts`, `apps/mobile/app/*.tsx` typecheck | `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` |
| No active in-repo mobile app/helper code intentionally calls deprecated `/auth/me` after migration | Static check / review gate | `apps/mobile/app`, `apps/mobile/lib` | `rg -n "getCurrentUser|/auth/me" apps/mobile/app apps/mobile/lib` |
| Full project regression remains green | Full gate | repository verification gate | `pnpm verify` |

## Regression Gaps

- None for planned in-repo behavior.

Deployed older app versions depending on `/auth/me` are protected by server compatibility tests for the deprecated alias. Final production removal of `/auth/me` is intentionally out of scope and must be handled by a later rollout/removal slice.

## TDD Implementation Plan

1. Red: API parity tests
   - Add failing handler/server tests for authenticated `GET /me`, deprecated `GET /auth/me`, identical response payloads, and matching missing/invalid bearer token behavior.
   - Verify: `pnpm --filter @i-um/api test` fails because `/me` does not exist yet or `/auth/me` is not marked/deprecated as planned.
2. Red: contract/deprecation expectation
   - Add or update OpenAPI expectations so `/me` is canonical and `/auth/me` is `deprecated: true`.
   - Verify: `pnpm verify:generated` fails until OpenAPI and generated artifacts are updated.
3. Green: OpenAPI-first contract and generated code
   - Add `GET /me` to `packages/api-contract/openapi.yaml` with existing `AuthMeResponse`.
   - Mark `GET /auth/me` as deprecated without changing its response shape.
   - Run generation for Go server and TypeScript client.
   - Verify: `pnpm verify:generated` passes after generated artifacts are committed.
4. Green: API route implementation
   - Reuse existing `auth.Me` service and current user response mapping for both `/me` and `/auth/me`.
   - Keep `/auth/me` runtime behavior unchanged except for deprecation metadata in OpenAPI.
   - Verify: `pnpm --filter @i-um/api test` passes targeted handler tests.
5. Red: mobile helper migration tests
   - Update/add mobile auth helper tests so active current-profile calls expect generated `/me` operation usage and existing refresh/session behavior remains intact.
   - Verify: `pnpm --filter @i-um/mobile test` fails until helper dependencies and mocks are moved from legacy operation naming.
6. Green: mobile generated client migration
   - Switch shared current-user helper and affected mocks/tests/screens to the generated `/me` operation.
   - Preserve existing mypage/account/session UI behavior and copy.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
7. Refactor: compatibility boundaries
   - Remove accidental active app usage of deprecated `/auth/me` while leaving explicit compatibility tests/docs/generated legacy code.
   - Verify: `rg -n "getCurrentUser|/auth/me" apps/mobile/app apps/mobile/lib` shows no unintended active usage.
8. Regression gate
   - Verify: `pnpm verify` passes.
9. Manual smoke
   - Use local dev auth or staging/internal build to login and confirm profile-dependent screens still load.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
rg -n "getCurrentUser|/auth/me" apps/mobile/app apps/mobile/lib
pnpm verify
```

No DB migration verification is expected because F-010 should not change DB schema. If implementation unexpectedly adds DB changes, update this spec first and add migration apply/status/rollback verification.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Log in with local dev OAuth or real Apple/Kakao provider in an approved staging/internal environment.
- [ ] Open a profile-dependent screen such as mypage/account and confirm current user display name and linked provider information load.
- [ ] Confirm app restart/session restore still reaches authenticated UI and current profile data loads through the shared helper.
- [ ] If a test token is available in a non-public environment, call `GET /me` and deprecated `GET /auth/me` and confirm the response bodies match.
- [ ] Confirm no user-visible copy/layout changed solely because of the endpoint migration.
- [ ] Confirm public staging/prod does not enable dev OAuth as a substitute for provider/session verification.

### Verification Results

- Initial `pnpm --filter @i-um/api test`: failed as expected after adding F-010 handler regression tests because `GET /me` returned 404 before implementation.
- `pnpm install --frozen-lockfile`: pass.
- `pnpm generate`: pass.
- `pnpm verify:generated`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `rg -n "getCurrentUser|/auth/me" apps/mobile/app apps/mobile/lib`: pass, no active mobile app/lib references found.
- `pnpm verify`: pass.
- Manual device/simulator smoke: not run in this environment.
- Staging/internal build smoke: not run in this environment.

## Release Notes

```text
- 내 프로필 조회 API의 canonical endpoint를 GET /me로 정리한다.
- 기존 GET /auth/me는 호환성 유지를 위해 deprecated alias로 남긴다.
- 앱의 current-profile 조회는 generated /me client를 사용하도록 이동한다.
```

## Open Questions

None.

Spec approved for implementation by user request on 2026-06-24.

Resolved by Ouroboros interview:

- `GET /me` is canonical for F-010.
- `GET /auth/me` remains as deprecated compatibility alias with no hard removal date.
- Both endpoint paths share identical `AuthMeResponse` and runtime semantics.
- Active in-repo mobile usage must migrate to generated `/me` in this slice.
- Automated regression scope includes API parity, OpenAPI/generated drift, and mobile behavior preservation.

## Follow-up Issues

- TBD: Remove deprecated `GET /auth/me` after generated clients and deployed app versions no longer depend on it.
- #11: 내 이름 수정
- #12: 계정 삭제
