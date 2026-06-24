# Feature Slice: F-011 내 이름 수정

## Metadata

- GitHub Issue: #11
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-24
- Updated: 2026-06-24

## Readiness / Status Gate

- Ouroboros clarification was resumed and completed for the previously ambiguous display-name contract.
- Final ambiguity score: `0.138` (below the `0.2` seed-generation threshold).
- Seed generated: `seed_c576757dba25`.
- Material product/API/mobile decisions are closed for this slice; `Open Questions` is `None`.
- Locked contract: trim leading/trailing whitespace, require 1–20 Unicode code points after trim, allow duplicate display names, do not restrict Unicode character classes, preserve internal whitespace, treat identical-after-trim submissions as successful idempotent updates, and update only canonical `users.display_name`.
- This document is a spec + TDD implementation plan only; no code implementation has started in this slice.

## Ouroboros Source

- Auto Session: `auto_0c508d2a746e` (`--skip-run`, originally blocked before seed generation)
- Interview Session: `interview_20260624_053921`
- Seed: `seed_c576757dba25`
- Ambiguity Score: `0.138`
- PM Document: N/A
- Notes: Ouroboros clarified the display-name product contract, including Unicode code-point length semantics and idempotent identical-after-trim success behavior.

## Goal

로그인한 사용자가 앱에서 내 표시 이름을 수정하고, 수정된 이름을 `GET /me` 기반 프로필 화면과 계정 화면에서 즉시 확인할 수 있다.

API 관점에서는 canonical `PATCH /me`가 현재 사용자의 `displayName`을 변경한다.

## Problem

- OAuth provider에서 받은 이름은 앱에서 사용자가 원하는 표시 이름과 다를 수 있다.
- 현재 마이페이지/계정 화면은 프로필 이름을 보여주지만 사용자가 직접 수정할 수 없다.
- 이후 여행, 동행자, 정산 화면에서 사용자 이름을 일관되게 쓰려면 canonical current-user profile update API가 필요하다.
- 이름 수정은 auth/profile 도메인의 기본 계정 관리 기능이며 계정 삭제(#12)보다 먼저 안전한 profile edit 흐름을 고정해야 한다.

## User Flow

1. 사용자가 로그인한 상태로 `마이페이지`에서 `계정 관리`를 누른다.
2. 앱이 `계정` 화면에 현재 표시 이름과 `이름 수정` action을 보여준다.
3. 사용자가 `이름 수정`을 누르면 현재 이름이 입력값으로 채워진 편집 상태가 열린다.
4. 사용자가 새 이름을 입력하고 `저장`을 누른다.
5. 앱은 빈 값/길이 오류를 즉시 안내하고, 통과하면 generated client로 `PATCH /me`를 호출한다.
6. 서버는 bearer access token을 검증하고, 이름을 trim/validate한 뒤 현재 user의 `users.display_name`을 저장한다.
7. 서버는 업데이트된 `AuthMeResponse`를 반환한다.
8. 앱은 화면 상태와 저장된 session user를 업데이트하고 `이름이 수정되었어요.`를 표시한다.
9. 사용자가 마이페이지로 돌아가면 새 이름이 프로필 요약에 표시된다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: `apps/mobile/app/account.tsx`에 현재 이름 표시, inline edit form, 저장/취소, validation/saving/error/success 상태 추가
- [ ] App UI: `apps/mobile/app/mypage.tsx`는 기존 focus reload/current profile flow를 통해 수정된 이름을 표시한다
- [ ] Mobile API Integration: generated `PATCH /me` operation을 사용하는 shared auth client helper 추가
- [ ] Mobile Session: `PATCH /me` 성공 시 local stored session의 `user.displayName`을 반환된 값으로 갱신
- [ ] API Contract: `PATCH /me`, `UpdateMeRequest`, response `AuthMeResponse`, validation/401/common error schema
- [ ] API Server: auth handler/service/repository에 current user display name update 추가
- [ ] DB: 기존 `users.display_name`과 `updated_at` 사용, sqlc update query 추가, schema migration 없음
- [ ] Generated Code: OpenAPI에서 Go server interface와 TypeScript client/type 갱신, sqlc generated code 갱신
- [ ] Tests: API validation/auth/success, OpenAPI/generated drift, mobile auth helper/session update, mobile display-name validation helper
- [ ] Deployment: staging/internal build 또는 local dev auth에서 name edit happy path와 validation smoke 확인

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 이메일 수정
- 프로필 이미지/avatar 수정 또는 업로드
- OAuth provider profile 정보 갱신 또는 provider display name 재동기화
- provider unlink/link UX 변경
- 계정 삭제(#12)
- `PATCH /auth/me` compatibility alias 추가
- `GET /auth/me` deprecation/removal policy 변경
- display name uniqueness 보장 또는 username/handle 예약어 정책
- 기존 `trip_participants.display_name` snapshot backfill/update
- 기존 여행 참여자 목록에서 과거에 저장된 이름을 즉시 바꾸는 동작
- 관리자용 user profile edit 기능

## UX / UI Requirements

### Screens

- `apps/mobile/app/account.tsx`
  - 현재 `사용자: <displayName>` 영역을 `내 이름` 섹션으로 정리한다.
  - read state에서는 현재 표시 이름과 `이름 수정` button을 보여준다.
  - edit state에서는 `이름` input, `저장`, `취소` actions를 보여준다.
  - 저장 성공 후 read state로 돌아가고 성공 메시지를 보여준다.
  - 기존 provider linking, logout, back behavior는 유지한다.
- `apps/mobile/app/mypage.tsx`
  - 별도 edit form을 추가하지 않는다.
  - `계정 관리` 진입점은 유지한다.
  - account에서 돌아왔을 때 기존 focus reload를 통해 새 displayName을 보여준다.

정확한 컴포넌트 분리는 구현 시 기존 Expo Router/React Native 구조에 맞춰 조정할 수 있지만, 사용자가 보는 흐름과 상태는 유지한다.

### States

- Loading: 기존 계정 정보 loading state를 유지한다.
- Read: 현재 표시 이름과 `이름 수정` action을 보여준다.
- Editing: input에 현재 display name을 채우고 `저장`, `취소`를 제공한다.
- Saving: 저장 중에는 input/action을 중복 제출할 수 없고 `저장 중...`을 보여준다.
- Validation Error: empty-after-trim 또는 20 Unicode code points 초과는 API 호출 전에도 `이름은 1~20자로 입력해주세요.`로 안내한다.
- API Error: 네트워크/서버 실패는 기존 이름을 유지하고 `이름을 수정할 수 없어요. 다시 시도해주세요.`를 보여준다.
- Login Required: session이 없거나 refresh가 실패하면 기존 auth error handling처럼 로그인 필요 상태로 전환한다.
- Success: 새 이름을 표시하고 `이름이 수정되었어요.`를 보여준다.

### Copy / Labels

- Section title: `내 이름`
- Edit CTA: `이름 수정`
- Input label/placeholder: `이름`
- Save CTA: `저장`
- Saving CTA: `저장 중...`
- Cancel CTA: `취소`
- Success: `이름이 수정되었어요.`
- Validation: `이름은 1~20자로 입력해주세요.`
- Generic error: `이름을 수정할 수 없어요. 다시 시도해주세요.`

### Design Requirements

- `docs/design/README.md`, `docs/design/mobile-ui-reference.md`, `apps/mobile/lib/design/theme.ts`를 따른다.
- 화면 코드에 raw hex color, 임의 spacing/radius 값을 추가하지 않는다.
- 기존 account card/button style을 유지하되 중복 UI가 늘어나면 공용 primitive 후보를 검토한다.
- 제품 UI에 emoji를 사용하지 않는다.

## API Contract

OpenAPI source of truth인 `packages/api-contract/openapi.yaml`을 먼저 수정한다.

### Endpoints

```text
PATCH /me
```

- OperationId: `updateMe`
- Tags: `Auth`
- Security: bearer access token required
- No `PATCH /auth/me` alias in this slice

### Request

```json
{
  "displayName": "지영"
}
```

Schema draft:

```yaml
UpdateMeRequest:
  type: object
  required:
    - displayName
  additionalProperties: false
  properties:
    displayName:
      type: string
      minLength: 1
      maxLength: 20
      description: Server trims leading/trailing whitespace, counts Unicode code points after trim, then validates and persists the value.
```

OpenAPI `minLength`/`maxLength` are documentation/generation aids for the accepted normalized bounds, not the sole conformance mechanism. Authoritative conformance is defined by trim-then-Unicode-code-point validation in server/mobile code and regression tests because standard OpenAPI string length keywords do not express "after trim" semantics.

Validation behavior:

- Server trims leading/trailing whitespace before validation and storing.
- Empty-after-trim is invalid.
- Values longer than 20 Unicode code points after trim are invalid.
- Length is counted by Unicode code points, not bytes and not grapheme clusters.
- Duplicate display names across users are allowed.
- Korean, English, numbers, spaces, emoji, and other Unicode characters are allowed. This slice does not introduce a character whitelist.
- Internal whitespace is preserved.
- Identical-after-trim values are treated as successful idempotent updates.

### Response

HTTP status: `200`

Returns updated `AuthMeResponse` so the mobile app can reuse the same current-profile state shape.

```json
{
  "user": {
    "id": "user_123",
    "displayName": "지영",
    "email": "jiyoung@example.com",
    "avatarUrl": null
  },
  "linkedProviders": ["kakao"]
}
```

Response guarantees:

- `user.id`, `email`, `avatarUrl`, and `linkedProviders` are preserved from current profile state.
- `user.displayName` is the normalized/stored value.
- A request whose trimmed value equals the current stored value still returns `200` with `AuthMeResponse`.
- Provider subject ids, raw provider tokens, session ids, and raw provider profile JSON are not exposed.

### Errors

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

Validation error:

HTTP status: `400`

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "invalid auth request",
    "details": [
      {
        "field": "displayName",
        "message": "이름은 1~20자로 입력해주세요."
      }
    ]
  }
}
```

Validation error guarantees:

- Empty-after-trim and over-20-code-point values return the same field-level details shape.
- The app may show the API field message or its identical local validation copy.
- Validation failures do not change the stored display name.

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

No DB schema changes.

### Tables

- `users`: update existing `display_name` and `updated_at` for the authenticated user.
- `auth_identities`: no change. Provider profile snapshots are not rewritten.
- `auth_sessions`: no change. Existing sessions remain valid.
- `trip_participants`: no change in this slice. Existing participant display-name snapshots are not backfilled.

### Constraints / Indexes

No new constraints or indexes.

The 1–20 Unicode-code-point rule is enforced in API/service validation for this slice. If the team wants DB-level enforcement for `users.display_name`, update this spec before implementation and add a migration verification plan.

### Migration Notes

- No goose migration is expected.
- Add or update sqlc query code for `UpdateUserDisplayName` in `apps/api/queries/auth.sql` and regenerate DB code.
- DB migration apply/rollback verification is not required unless implementation changes schema.

## Business Rules

- Only an authenticated current user can update their own display name.
- The display name is trimmed before validation and persistence.
- The stored display name must be 1–20 Unicode code points after trimming.
- API length validation uses Go `len([]rune(trimmed))`; mobile pre-submit validation uses TypeScript `[...trimmed].length`.
- Byte length and grapheme-cluster/user-visible-character segmentation are out of scope for this slice.
- Duplicate display names are allowed.
- No Unicode character whitelist is introduced.
- Internal whitespace is preserved except for leading/trailing trim.
- Same-value updates after trimming are treated as successful idempotent updates and return `200 AuthMeResponse`.
- Validation failure does not change the existing display name.
- Validation errors include a field-level `displayName` message suitable for app display.
- The update changes canonical `users.display_name` only.
- `auth_identities.display_name` remains a provider snapshot and is not updated.
- Existing `trip_participants.display_name` rows are treated as snapshots and are not changed in this slice.
- `GET /me` after a successful update returns the new display name.
- `GET /auth/me` remains a deprecated compatibility read alias and should also show the updated name because it uses the same current-profile service.
- Existing access/refresh token validity is not changed by a display-name update.
- Mobile must use the generated API client/type for `PATCH /me`, not a hand-written duplicate request type.

## Acceptance Criteria

- [ ] `docs/features/0011-update-my-display-name.md` exists and records the Ouroboros source, scope, regression plan, TDD plan, and verification plan for #11.
- [ ] OpenAPI defines canonical `PATCH /me` with `UpdateMeRequest` and `AuthMeResponse` response.
- [ ] No `PATCH /auth/me` compatibility alias is added.
- [ ] Go server interface and TypeScript API client are regenerated from OpenAPI.
- [ ] Authenticated `PATCH /me` updates the current user's `users.display_name`.
- [ ] Successful `PATCH /me` returns `AuthMeResponse` with the updated normalized `user.displayName`.
- [ ] `GET /me` after a successful update returns the updated display name.
- [ ] Leading/trailing whitespace is trimmed before storing and returning the name.
- [ ] Internal whitespace inside a display name is preserved.
- [ ] Empty-after-trim display names are rejected with `400 VALIDATION_ERROR`, field-level `displayName` details, and no stored-name change.
- [ ] Display names longer than 20 Unicode code points after trim are rejected with `400 VALIDATION_ERROR`, field-level `displayName` details, and no stored-name change.
- [ ] Display names with exactly 20 Unicode code points after trim are accepted.
- [ ] Length validation is based on Unicode code points rather than bytes, and is enforced by server/mobile validators rather than relying only on OpenAPI `minLength`/`maxLength`.
- [ ] Duplicate display names across users are allowed.
- [ ] Identical-after-trim submissions return `200 AuthMeResponse` as successful idempotent updates.
- [ ] Missing/invalid bearer token returns `401 UNAUTHORIZED` and does not change any user.
- [ ] No DB migration is added for the planned scope.
- [ ] `auth_identities.display_name` and existing `trip_participants.display_name` rows are not rewritten.
- [ ] Mobile account screen lets a logged-in user edit, save, cancel, and retry display-name changes.
- [ ] Mobile validation shows `이름은 1~20자로 입력해주세요.` without calling the API for empty/too-long values.
- [ ] Mobile success state shows `이름이 수정되었어요.` and updates the visible account display name.
- [ ] Mobile local stored session user is updated from the successful `PATCH /me` response.
- [ ] MyPage profile summary shows the updated display name after returning/focus reload.
- [ ] API/server tests cover success, trim, code-point validation, field-level validation error, unchanged previous value on validation, duplicate-name allowance, idempotent same-value success, and unauthorized behavior.
- [ ] Mobile tests cover auth helper update/refresh/session behavior and display-name validation helper behavior.
- [ ] Generated drift, API tests/build, mobile tests/typecheck, and full `pnpm verify` pass.
- [ ] Staging/internal or local dev-auth smoke confirms the name edit happy path and validation behavior.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| `PATCH /me` is present in OpenAPI with `UpdateMeRequest`, `AuthMeResponse`, auth security, and no `PATCH /auth/me` alias | API contract/generated | `packages/api-contract/openapi.yaml` and generated artifacts | `pnpm verify:generated` |
| Auth service trims valid names, accepts exactly 20 Unicode code points, rejects empty-after-trim and >20 code points, preserves internal whitespace, allows duplicates, treats same-value updates as idempotent success, and keeps previous value on validation failure | API service | `apps/api/internal/auth/service_test.go` | `pnpm --filter @i-um/api test` |
| Auth service counts length by Unicode code points rather than bytes | API service | `apps/api/internal/auth/service_test.go` | `pnpm --filter @i-um/api test` |
| Repository/sqlc updates only `users.display_name` and `updated_at` for the authenticated user | DB/query compile + API tests | `apps/api/queries/auth.sql`, `apps/api/internal/db/auth.sql.go`, API tests | `pnpm --filter @i-um/api test` |
| Authenticated `PATCH /me` returns updated `AuthMeResponse`; subsequent `GET /me` returns the same updated display name | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Identical-after-trim `PATCH /me` returns `200 AuthMeResponse` without creating a client error | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Missing/invalid bearer token returns `UNAUTHORIZED` and does not update user data | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Invalid request body, empty-after-trim, and >20 code points return `VALIDATION_ERROR` with field-level `displayName` details | API handler/server | `apps/api/internal/server/server_test.go` | `pnpm --filter @i-um/api test` |
| Go server interface and TypeScript generated client include `updateMe` with no drift | Contract/generated gate | generated drift gate | `pnpm verify:generated` |
| Mobile `updateDisplayNameWithRefresh` uses generated `updateMe`, configures bearer token, refreshes once on 401, maps validation errors, and saves returned user to local session | Mobile auth helper | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Mobile display-name form validation trims input, counts Unicode code points, preserves internal whitespace, and blocks empty/>20-code-point submissions before API call | Mobile pure logic | `apps/mobile/lib/auth/display-name.test.mts` | `pnpm --filter @i-um/mobile test` |
| Account/mypage TypeScript remains compatible with generated `AuthMeResponse` and new update helper | Mobile typecheck | `apps/mobile/app/account.tsx`, `apps/mobile/app/mypage.tsx`, auth helper | `pnpm --filter @i-um/mobile typecheck` |
| Full project regression remains green | Full gate | repository verification gate | `pnpm verify` |

## Regression Gaps

- React Native component-level rendering of the inline account edit form is not currently covered by a component/render test harness.
  - Risk: layout/press/input wiring regressions may require manual smoke to catch.
  - Mitigation: keep the UI state small, move normalization/validation/API helper behavior into tested pure/helper code, and run mobile typecheck plus manual smoke.
  - Follow-up: create a React Native component test harness before adding a second editable profile field/form or before reusing this inline edit pattern on another screen.

## TDD Implementation Plan

Expected file mapping for implementation:

| Concern | Expected path |
|---|---|
| OpenAPI contract | `packages/api-contract/openapi.yaml` |
| API handler/server tests | `apps/api/internal/server/server_test.go` |
| API handler implementation | `apps/api/internal/server/auth_handlers.go` |
| API service validation tests | `apps/api/internal/auth/service_test.go` |
| API service/repository interface | `apps/api/internal/auth/service.go`, `apps/api/internal/auth/types.go` |
| API storage adapter | `apps/api/internal/storage/auth_repository.go` |
| SQL query and generated DB code | `apps/api/queries/auth.sql`, `apps/api/internal/db/auth.sql.go` |
| Generated OpenAPI code | `apps/api/internal/openapi/server.gen.go`, `packages/api-contract/gen/ts/services/AuthService.ts`, `packages/api-contract/gen/ts/models/UpdateMeRequest.ts`, `packages/api-contract/gen/ts/models/AuthMeResponse.ts`, `packages/api-contract/gen/ts/index.ts` |
| Mobile auth helper/tests | `apps/mobile/lib/auth/client.ts`, `apps/mobile/lib/auth/client.test.mts` |
| Mobile display-name validation helper/tests | `apps/mobile/lib/auth/display-name.ts`, `apps/mobile/lib/auth/display-name.test.mts` |
| Account edit UI | `apps/mobile/app/account.tsx` |
| MyPage updated-name reflection | `apps/mobile/app/mypage.tsx` |
| Existing current-profile reuse | `apps/api/internal/server/auth_handlers.go`, `apps/api/internal/auth/service.go` (`GET /me` behavior should be reused unchanged unless regression tests fail) |

1. Red: API/server behavior tests
   - Add failing server tests for authenticated `PATCH /me` success, trim behavior, `GET /me` reflecting the update, identical-after-trim idempotent success, invalid body/field-level validation, and unauthorized behavior.
   - Verify: `pnpm --filter @i-um/api test` fails because `PATCH /me` does not exist yet.
2. Red: auth service validation tests
   - Add failing service tests for trim, empty-after-trim, exactly 20 Unicode code points, >20 Unicode code points, Unicode code-point counting rather than bytes, internal whitespace preservation, same-value success, duplicate-name allowance, and previous-value preservation on validation failure.
   - Verify: `pnpm --filter @i-um/api test` fails until service/repository behavior exists.
3. Green: OpenAPI-first contract and generated code
   - Add `PATCH /me` and `UpdateMeRequest` to `packages/api-contract/openapi.yaml` with `maxLength: 20` and validation/error response documentation.
   - Regenerate Go openapi server code and TypeScript client/types.
   - Verify: `pnpm verify:generated` passes after generated artifacts are committed.
4. Green: API service/repository/handler
   - Add repository interface method and sqlc query to update only `users.display_name`/`updated_at`.
   - Add auth service method that normalizes and validates displayName before repository update using Unicode code-point length.
   - Add `PATCH /me` handler using existing `requireAuth`, current profile mapping, common error format, and field-level displayName validation details.
   - Verify: `pnpm --filter @i-um/api test` and `pnpm --filter @i-um/api build` pass.
5. Red: mobile auth helper tests
   - Add failing tests for `updateDisplayNameWithRefresh`: bearer configuration, one refresh retry on 401, validation error mapping, session user persistence from response.
   - Verify: `pnpm --filter @i-um/mobile test` fails until helper is implemented.
6. Red: mobile display-name validation helper tests
   - Add failing pure tests for trim, empty, 20-code-point boundary, >20-code-point rejection, Unicode code-point counting, and preserving internal whitespace.
   - Verify: `pnpm --filter @i-um/mobile test` fails until helper exists.
7. Green: mobile account edit flow
   - Implement generated-client auth helper and display-name validation helper.
   - Add inline edit UI to `apps/mobile/app/account.tsx` using existing theme tokens and current auth error patterns.
   - Update local state/stored session after success; preserve provider link/logout behavior.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
8. Refactor: UX/design cleanup
   - Keep account screen simple, remove duplicated validation logic, and ensure no raw design values were introduced.
   - Verify: rerun targeted API/mobile tests and typecheck.
9. Regression gate
   - Verify: `pnpm verify` passes.
10. Manual smoke
   - Use local dev auth or staging/internal build to edit display name, check validation, submit identical-after-trim input, return to mypage, and confirm updated name is visible.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/api build
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

No DB migration verification is expected because F-011 should not change DB schema. If implementation adds DB schema constraints, update this spec first and add migration apply/status/rollback verification.

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] Log in with local dev OAuth or real Apple/Kakao provider in an approved staging/internal environment.
- [ ] Open `마이페이지` → `계정 관리`.
- [ ] Tap `이름 수정`, enter ` 지영 `, save, and confirm success copy plus displayed name `지영`.
- [ ] Return to `마이페이지` and confirm profile summary shows `지영`.
- [ ] Try blank/whitespace-only name and confirm validation copy appears and previous name remains.
- [ ] Try >20-code-point name and confirm validation copy appears and previous name remains.
- [ ] Restart the app or reload session and confirm `GET /me` still returns the updated name.
- [ ] Confirm provider linking and logout actions on the account screen still work or are not visually broken.
- [ ] Confirm staging/internal build smoke result is recorded in the completion report.

### Verification Results

- Initial `pnpm --filter @i-um/api test`: failed as expected after adding F-011 regression tests because `UpdateDisplayName` and `PATCH /me` were not implemented yet.
- Initial `pnpm --filter @i-um/mobile test`: failed as expected after adding F-011 mobile regression tests because `updateDisplayNameWithRefresh` and `display-name.ts` were not implemented yet.
- `pnpm install --frozen-lockfile`: pass.
- `pnpm generate`: initially failed before install because the worktree did not have `openapi` CLI dependencies installed; passed after install.
- `pnpm --filter @i-um/api generate`: pass.
- `pnpm --filter @i-um/api test`: pass.
- `pnpm --filter @i-um/api build`: pass.
- `pnpm --filter @i-um/mobile test`: pass.
- `pnpm --filter @i-um/mobile typecheck`: pass.
- `pnpm verify:generated`: pass.
- `pnpm verify`: pass.
- Manual device/simulator smoke: not run in this environment.
- Staging/internal build smoke: not run in this environment.

## Release Notes

```text
- 계정 화면에서 내 표시 이름을 수정할 수 있게 한다.
- PATCH /me API로 현재 사용자의 displayName을 업데이트한다.
- 수정된 이름은 GET /me 기반 프로필/마이페이지 화면에 반영된다.
```

## Open Questions

None.

Resolved by Ouroboros interview:

- Display-name contract is trim leading/trailing whitespace, require 1–20 Unicode code points after trim, allow duplicate names, do not restrict Unicode character classes, and preserve internal whitespace.
- Length is enforced by Unicode code points, not bytes or grapheme clusters.
- Identical-after-trim submissions return `200 AuthMeResponse` as successful idempotent updates.
- UI location is inline edit in `계정 관리` (`apps/mobile/app/account.tsx`), not a new screen or direct edit form on `마이페이지`.
- Existing `trip_participants.display_name` snapshot updates are out of scope for F-011.

## Follow-up Issues

- TBD: If required, update/backfill existing trip participant display-name snapshots when a user changes their profile display name.
- #12: 계정 삭제
