# Feature Slice: F-009 로그아웃

## Metadata

- GitHub Issue: #9
- Status: In Progress
- Owner: TBD
- Target Sprint: TBD
- Created: 2026-06-23
- Updated: 2026-06-23

## Readiness / Status Gate

- Ouroboros clarification completed with ambiguity score `0.067`; follow-up clarification reduced remaining ambiguity to `0.06`.
- Material product/API/DB/UI/provider-cleanup decisions for this logout slice are closed.
- Implementation may start after this spec is reviewed and approved.
- This slice is intentionally limited to this-device client logout behavior using the existing auth contract and session model.

## Ouroboros Source

- Interview Session: `interview_20260623_142556`
- Seed: `seed_e44cb61881d1` (generated via Ouroboros MCP)
- PM Document: N/A
- Notes: Ouroboros clarified logout completion criteria, entry points, duplicate-tap handling, no API/DB expansion, observable regression evidence, replace/reset navigation, attempt-then-finally cleanup order, silent partial-failure UX, and provider cleanup abstraction. Kakao is the first concrete provider cleanup implementation, but core logout flow must support future OAuth provider cleanup adapters.

## Goal

사용자가 앱에서 `로그아웃`을 누르면 서버 로그아웃 성공 여부와 무관하게 이 기기의 i-um 인증 상태가 제거되고, 로그인 전 상태로 돌아간다.

## Problem

- 사용자는 공용 기기나 개인 기기에서 현재 i-um 세션을 명확하게 종료할 수 있어야 한다.
- 네트워크 오류나 서버 로그아웃 실패가 발생해도 이 기기에서는 인증 화면에 다시 진입할 수 없어야 한다.
- OAuth provider logout, provider unlink, 모든 기기 로그아웃과 이 기기 local logout의 범위가 혼동되지 않아야 한다.
- 중복 탭이나 뒤로가기로 인해 로그아웃 직후 인증 화면이 다시 노출되면 보안/UX 리스크가 생긴다.

## User Flow

### Stored session exists

1. 사용자가 인증된 상태로 마이페이지 또는 계정 화면을 연다.
2. 사용자가 `로그아웃` 버튼을 누른다.
3. 앱은 로그아웃 진행 중 상태로 전환하고 중복 탭을 막거나 동일 요청으로 합친다.
4. 앱은 저장된 access token으로 기존 `POST /auth/logout`을 한 번 시도한다.
5. API 성공 여부와 무관하게 앱은 finally-equivalent cleanup path에서 다음을 수행한다.
   - OAuth provider cleanup adapter/registry를 통해 provider local session clear를 best-effort로 시도한다. Kakao가 첫 concrete implementation이다.
   - 저장된 i-um session을 삭제한다.
   - API bearer token 설정을 제거한다.
6. 앱은 `/login`으로 replace/reset 이동한다.
7. 사용자는 뒤로가기로 마이페이지, 계정 화면, 기타 인증 화면을 다시 볼 수 없다. 다시 사용하려면 새로 로그인해야 한다.

### No stored session

1. 사용자가 예외적으로 저장된 session 없이 로그아웃 동작을 트리거한다.
2. 앱은 `POST /auth/logout`을 호출하지 않는다.
3. 앱은 로컬 인증 상태가 없는 것을 정상 logged-out 상태로 보고 `/login` 또는 로그인 필요 상태를 유지한다.

### Server failure or offline

1. 사용자가 `로그아웃`을 누른다.
2. `POST /auth/logout`이 네트워크 오류, timeout, 5xx, 401 등으로 실패한다.
3. 앱은 실패 메시지나 재시도 요구로 사용자를 막지 않는다.
4. 앱은 local cleanup을 완료하고 `/login`으로 replace/reset 이동한다.

## Scope

이번 feature slice에 포함되는 범위다.

- [ ] App UI: 마이페이지 설정 섹션의 `로그아웃` 버튼 동작을 F-009 계약에 맞춘다.
- [ ] App UI: 계정 화면의 `로그아웃` 버튼 동작을 F-009 계약에 맞춘다.
- [ ] App UI: 로그아웃 진행 중 중복 탭을 방지하거나 동일 로그아웃 흐름으로 coalesce한다.
- [ ] App Navigation: 로그아웃 완료 후 `/login`으로 replace/reset 이동해 뒤로가기로 인증 화면에 복귀하지 못하게 한다.
- [ ] App Auth: 저장된 session이 있으면 기존 `POST /auth/logout`을 1회 시도한다.
- [ ] App Auth: server logout 성공 여부와 무관하게 local i-um session과 API bearer token을 제거한다.
- [ ] App Auth: OAuth provider cleanup adapter/registry를 사용해 Kakao local session clear를 best-effort로 시도하고 실패해도 i-um local logout을 막지 않는다.
- [ ] App Auth: core logout flow와 screen code가 Kakao-specific cleanup을 직접 hard-code하지 않도록 provider cleanup abstraction을 둔다.
- [ ] API Contract: 기존 `POST /auth/logout` 계약을 재사용한다. 새 endpoint/schema는 추가하지 않는다.
- [ ] API Server: 기존 auth logout/revoke 동작을 재사용한다. 새 서버 동작은 기본 범위에 없다.
- [ ] DB: 기존 `auth_sessions` 모델을 재사용한다. migration은 없다.
- [ ] Tests: mobile auth client/logout flow 단위 테스트로 no-session, success, failure/offline, provider cleanup/Kakao clear failure, duplicate tap, replace navigation side effect를 검증한다.
- [ ] Deployment: staging 또는 internal build에서 로그아웃 happy path와 offline/server-failure-equivalent local logout을 smoke 확인한다.

## Out of Scope

이번 기능에서 명시적으로 하지 않는 것들이다.

- 신규 logout API endpoint 추가
- OpenAPI schema 변경
- DB schema/migration 변경
- 모든 기기 로그아웃/session 목록 관리
- OAuth provider unlink
- Kakao account unlink 또는 KakaoTalk global logout
- Apple/Kakao provider 자체 로그인 구현 변경
- Kakao 외 OAuth provider의 실제 cleanup adapter 구현
- 로그아웃 확인 모달
- 로그아웃 성공/실패 toast 또는 별도 결과 화면
- 자동 retry loop, retry limit, exponential backoff
- background server revoke after immediate navigation
- 계정 삭제 (#12)

## UX / UI Requirements

### Screens

- `apps/mobile/app/mypage.tsx`
  - 인증된 사용자의 `설정` 섹션에 `로그아웃` 버튼을 제공한다.
  - 버튼을 누르면 F-009 logout flow를 시작한다.
  - logout in-progress 동안 버튼은 비활성화되거나 동일 흐름으로 coalesce되어 중복 로그아웃 요청을 만들지 않는다.
- `apps/mobile/app/account.tsx`
  - 계정 관리 화면의 기존 `로그아웃` 버튼도 동일한 F-009 logout flow를 사용한다.
  - 화면별로 서로 다른 logout semantics를 만들지 않는다.
- `/login`
  - logout 완료 후 replace/reset 방식으로 진입하는 logged-out 완료 상태다.

### States

- Ready: `로그아웃` 버튼을 누를 수 있다.
- Logging out: 로그아웃 flow가 진행 중이며 중복 탭은 무시되거나 같은 promise/result를 공유한다. 필요하면 버튼 label은 `로그아웃 중...`으로 표시한다.
- Success / Completed: server result와 무관하게 local cleanup이 끝나면 `/login`으로 replace/reset 이동한다.
- Server failure/offline/provider cleanup failure: 별도 오류 화면이나 toast를 보여주지 않고 local logout 완료를 우선한다.
- No stored session: API 호출 없이 logged-out/login 상태를 보장한다.

### Copy / Labels

- Logout button: `로그아웃`
- Optional in-progress label: `로그아웃 중...`
- Login route copy는 기존 로그인 화면 copy를 재사용한다.
- Server logout 실패 전용 사용자 문구는 이 slice에서 추가하지 않는다.

## API Contract

No API changes.

F-009는 기존 F-005/F-008 auth contract를 재사용한다.

### Endpoints

```text
POST /auth/logout
```

### Request

No request body.

Authorization header는 저장된 i-um access token을 사용한다.

```text
Authorization: Bearer <accessToken>
```

### Response

기존 `AuthLogoutResponse`를 사용한다.

```json
{
  "result": "logout_success"
}
```

### Errors

공통 에러 포맷을 따른다. 단, F-009 client logout UX는 error response를 사용자 차단 상태로 노출하지 않고 local logout을 완료한다.

```json
{
  "error": {
    "code": "UNAUTHORIZED",
    "message": "unauthorized",
    "details": []
  }
}
```

## DB Changes

No DB changes.

### Tables

- 기존 `auth_sessions` revocation behavior를 그대로 사용한다.

### Constraints / Indexes

- No changes.

### Migration Notes

- No migration.
- DB migration apply/rollback 검증은 이 slice에 필요하지 않다.

## Business Rules

- 로그아웃은 이 기기의 i-um local session 종료를 우선 보장한다.
- 저장된 session이 있으면 `POST /auth/logout`을 1회 시도한다.
- `POST /auth/logout` 성공 여부는 local session 삭제의 전제 조건이 아니다.
- local i-um session 삭제와 API bearer token 제거는 finally-equivalent cleanup path에서 수행한다.
- OAuth provider local cleanup은 adapter/registry를 통해 best-effort로 실행한다. Kakao가 첫 concrete implementation이며, 실패해도 i-um local logout은 계속되어야 한다.
- Core logout flow와 screen code는 Kakao-specific cleanup을 직접 hard-code하지 않는다. 미래 provider는 cleanup adapter를 추가하는 방식으로 붙인다.
- 저장된 session이 없으면 `POST /auth/logout`을 호출하지 않는다.
- 로그아웃 진행 중 중복 탭은 중복 server call이나 예외 상태를 만들지 않아야 한다.
- 로그아웃 완료 후 navigation은 push가 아니라 replace/reset 성격이어야 한다.
- 로그아웃 완료 후 뒤로가기로 인증 화면을 다시 볼 수 없어야 한다.
- 로그아웃은 provider unlink, KakaoTalk global logout, 모든 기기 로그아웃을 의미하지 않는다.

## Acceptance Criteria

- [ ] `docs/features/0009-logout.md`가 존재하고 Ouroboros source, scope, regression plan, TDD plan, verification plan을 기록한다.
- [ ] 마이페이지 설정 섹션과 계정 화면에서 동일한 logout flow가 시작된다.
- [ ] 저장된 i-um session이 있으면 현재 access token으로 `POST /auth/logout`을 정확히 한 번 시도한다.
- [ ] 저장된 i-um session이 없으면 `POST /auth/logout`을 호출하지 않고 logged-out/login 상태를 보장한다.
- [ ] `POST /auth/logout` 성공 후 local i-um session, provider local session cleanup(Kakao first), API bearer token이 정리되고 `/login`으로 replace/reset 이동한다.
- [ ] `POST /auth/logout` 실패 또는 offline 상황에서도 local i-um session과 API bearer token이 정리되고 `/login`으로 replace/reset 이동한다.
- [ ] Provider local cleanup 또는 Kakao local session clear가 실패해도 local i-um session 삭제와 `/login` 이동이 막히지 않는다.
- [ ] Provider cleanup은 adapter/registry abstraction으로 구현되어 core logout flow와 screen code가 Kakao-specific cleanup에 직접 의존하지 않는다.
- [ ] 로그아웃 진행 중 중복 탭은 중복 server logout call 또는 unhandled error를 만들지 않는다.
- [ ] 로그아웃 완료 후 뒤로가기로 마이페이지/계정 등 인증 화면에 복귀할 수 없다.
- [ ] 이 slice는 OpenAPI, API server behavior, DB schema를 변경하지 않는다.
- [ ] 변경된 mobile logout behavior는 자동화 regression test와 연결된다.

## Regression Test Plan

코드로 남고 CI/`pnpm verify`에서 반복 실행되는 회귀 테스트 계획이다. Manual smoke는 이 표를 대체하지 않는다.

| Behavior / Acceptance Criteria | Layer | Test File / Gate | Command |
|---|---|---|---|
| Stored session logout configures access token, attempts `POST /auth/logout` once, invokes provider cleanup once, clears stored i-um session, and unconfigures API auth | Mobile auth client | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| No stored session skips `POST /auth/logout` and leaves auth client in logged-out state | Mobile auth client | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Server logout failure/offline still clears local i-um session and API auth | Mobile auth client | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Provider cleanup/Kakao local clear failure does not block local i-um session clear or API auth clear | Mobile auth client | `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Kakao cleanup is wired through a provider cleanup adapter/registry so adding a fake future provider does not require changing core logout flow tests | Mobile provider cleanup | `apps/mobile/lib/auth/provider-cleanup.test.mts` or `apps/mobile/lib/auth/client.test.mts` | `pnpm --filter @i-um/mobile test` |
| Duplicate logout taps are prevented or coalesced into one effective logout flow | Mobile logout state/helper | `apps/mobile/lib/auth/logout-flow.test.mts` | `pnpm --filter @i-um/mobile test` |
| Logout completion uses replace/reset navigation to `/login` and does not push a back-stack entry to authenticated screens | Mobile logout state/helper | `apps/mobile/lib/auth/logout-flow.test.mts` | `pnpm --filter @i-um/mobile test` |
| Existing API logout/revoke behavior remains compatible | API auth regression | Existing `apps/api/internal/auth/service_test.go` and `apps/api/internal/server/server_test.go`; add targeted test only if coverage gap is found | `pnpm --filter @i-um/api test` |
| No OpenAPI/generated drift is introduced | Contract/generated gate | `pnpm verify:generated` | `pnpm verify:generated` |

## Regression Gaps

- None

## TDD Implementation Plan

1. Red: Mobile auth client logout side-effect tests를 먼저 보강한다.
   - Add/extend tests in `apps/mobile/lib/auth/client.test.mts` for stored-session success, no-session no-call, server failure/offline local cleanup, provider cleanup/Kakao clear failure best-effort, and API auth unconfigure.
   - Add a provider cleanup abstraction test proving Kakao cleanup is registered/called through an adapter and a fake future provider can be added without changing core logout flow code.
   - Verify: `pnpm --filter @i-um/mobile test` fails for missing or incomplete logout/provider cleanup guarantees.
2. Red: Mobile logout UI/state helper tests를 추가한다.
   - Add `apps/mobile/lib/auth/logout-flow.test.mts` for duplicate-tap prevention/coalescing and replace/reset navigation side effect.
   - If needed, introduce a small helper such as `beginLogout`, `completeLogout`, or `runLogoutFlow` that can be tested without Expo component rendering.
   - Verify: `pnpm --filter @i-um/mobile test` fails because helper/flow behavior is not implemented yet.
3. Green: `logoutCurrentSession` 또는 그 주변 logout helper를 최소 수정한다.
   - Ensure stored session path configures token, attempts logout once, and always runs provider cleanup/local/API auth cleanup in a finally-equivalent path.
   - Introduce the smallest provider cleanup adapter/registry needed for Kakao first, without adding speculative provider features.
   - Ensure provider cleanup/Kakao clear errors are caught or isolated so local i-um cleanup still runs.
   - Ensure no-session path skips server call and returns logged-out-ready result.
   - Verify: `pnpm --filter @i-um/mobile test` passes.
4. Green: 마이페이지와 계정 화면을 공통 logout flow에 연결한다.
   - Disable/coalesce duplicate taps during logging out.
   - Use `router.replace('/login')` or equivalent reset after cleanup.
   - Avoid adding confirmation modal or success/failure toast.
   - Verify: `pnpm --filter @i-um/mobile typecheck` passes.
5. Refactor: 중복 logout screen logic이 생기면 작은 shared helper로 정리한다.
   - Keep screen code simple and avoid unrelated UI refactors.
   - Keep provider-specific code inside provider cleanup adapters, not in screen code or core navigation flow.
   - Verify: `pnpm --filter @i-um/mobile test` and `pnpm --filter @i-um/mobile typecheck` pass.
6. Regression gate
   - Verify: `pnpm verify` passes.

## Verification Plan

완료 전 실행할 자동화 회귀 검증 명령과 manual smoke 절차를 분리해서 작성한다.

### Automated Regression

```text
pnpm verify:generated
pnpm --filter @i-um/api test
pnpm --filter @i-um/mobile test
pnpm --filter @i-um/mobile typecheck
pnpm verify
```

### Manual Smoke

아래 항목은 실제 기기, staging, internal build, 환경변수 연결을 확인하는 보조 smoke check다. Regression Test Plan을 대체하지 않는다.

- [ ] 로그인한 상태에서 마이페이지 `로그아웃`을 누르면 `/login`으로 이동한다.
- [ ] 로그인한 상태에서 계정 화면 `로그아웃`을 누르면 `/login`으로 이동한다.
- [ ] 로그아웃 직후 뒤로가기로 마이페이지/계정 화면이 다시 보이지 않는다.
- [ ] 로그아웃 후 앱을 재실행해도 로그인 상태가 복구되지 않는다.
- [ ] 가능한 경우 API offline 또는 staging API 차단 상태에서 `로그아웃`을 눌러도 local logout이 완료되는지 확인한다.
- [ ] Kakao Login으로 로그인한 세션에서 로그아웃 후 재실행 시 i-um session이 남아 있지 않은지 확인한다.

## Release Notes

```text
- 사용자가 마이페이지 또는 계정 화면에서 이 기기 로그아웃을 수행할 수 있습니다.
- 서버 로그아웃 실패 상황에서도 로컬 인증 상태를 정리하고 로그인 화면으로 돌아갑니다.
```

## Open Questions

- None

## Follow-up Issues

- #12: 계정 삭제는 로그아웃과 별도 기능으로 다룬다.
- Future: 모든 기기 로그아웃/session 목록 관리가 필요하면 별도 issue로 분리한다.
- Future: OAuth provider unlink 또는 Kakao account unlink가 필요하면 별도 issue로 분리한다.
